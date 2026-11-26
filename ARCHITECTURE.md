# market-pulse: Architecture

Status: design draft for v1 (5 Oct 2026). No code yet.

market-pulse watches Times of India RSS feeds for Indian economy and market news that is likely to move the Sensex or Nifty, scores each new article with an LLM, and emails a short digest every hour, but only when something is high priority.

![market-pulse architecture](docs/architecture.svg)

## Goals and non-goals

**Goals**

- Surface market-moving Indian news (trade deals, RBI policy, Budget, inflation and GDP data, SEBI and regulatory moves) without watching feeds all day.
- Send at most one email per hour, and none when nothing qualifies.
- Keep v1 small enough to build and run alone.

**Non-goals for v1**

- Other news sources, global news, or per-company alerts.
- A web UI, user accounts or multiple recipients.
- Trading signals. The output is information only, not investment advice.

## How a run works

The job runs once an hour and executes these steps in order. The steps do not call each other's internals; they hand work over through PostgreSQL.

1. **Scheduler** starts the job.
2. **Fetcher** downloads the configured RSS feeds and parses the items.
3. **Dedup + store** normalises each article URL and inserts only the ones not seen before.
4. **AI scorer** reads articles that have no score yet, asks the LLM for a structured score, and saves it.
5. **Digest builder** selects articles with priority 4 or 5 that have not been emailed.
6. **Mailer** records the delivery, then sends one email containing all of them.
7. **Email provider** delivers it to your inbox.

If step 5 finds nothing, no email is sent.

## Components

| Component | Responsibility | Notes |
|---|---|---|
| Scheduler | Triggers a run every hour | Hosting not decided; see open questions |
| Fetcher | Reads RSS, returns title, link, published time, description | One HTTP GET per feed |
| Dedup + store | Normalises URLs, inserts new articles | Unique constraint on `url` is the real guard |
| AI scorer | Calls the LLM, validates the JSON, stores the score | Only scores new articles, capped per run |
| Digest builder | Chooses what goes in this hour's email | Priority at or above the threshold, not yet delivered |
| Mailer | Records the delivery, sends the email, updates status | Plain text plus simple HTML |
| PostgreSQL | Articles, scores, deliveries | Single source of truth |

## Data sources

v1 reads the Times of India (TOI) RSS feeds. All four feeds below returned fresh items on 5 Oct 2026.

| Feed | URL | Used by default |
|---|---|---|
| Business | `https://timesofindia.indiatimes.com/business/rssfeeds/1898055.cms` | yes |
| Top stories | `https://timesofindia.indiatimes.com/rssfeedstopstories.cms` | yes |
| India | `https://timesofindia.indiatimes.com/india/rssfeeds/-2128936835.cms` | no |
| Most recent | `https://timesofindia.indiatimes.com/rssfeedmostrecent.cms` | no |

Why TOI and not Business Standard: Business Standard's terms of use prohibit automated access and any use of its content with AI systems without written consent. TOI's RSS page grants permission "to only access and make personal use of its RSS feeds", forbids copying, publishing, distributing or commercial use, and says not to keep copies except for personal use. It does not mention AI. This is a plain reading of the terms, not legal advice. See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md), Phase 0, for the details.

To stay within personal use, store only the headline, link, publish time, a short description and your own AI summary, never full article text. Send the digest only to yourself and link back to the original.

TOI is a general newspaper, so its business feed carries less market-specific news than a markets-only feed. The LLM priority score is what filters it.

### Feed format notes

- Links, titles and descriptions are wrapped in CDATA.
- Descriptions can start with an escaped `<img>` tag; strip HTML before storing or scoring.
- The first `<link>` in a feed is the channel link, not an article.
- Dates appear as ISO 8601 in some feeds and RFC 822 in others; the parser must accept both.
- Article URLs look like `.../articleshow/134701115.cms`.

### URL normalisation

The same article can appear under several URLs. Before the duplicate check:

1. Lowercase the host.
2. Remove a leading `/amp` path segment.
3. Drop the query string and fragment.
4. Remove any trailing slash.

Example:

```text
https://timesofindia.indiatimes.com/business/india-business/some-story/articleshow/134701115.cms?from=mdr#top
-> https://timesofindia.indiatimes.com/business/india-business/some-story/articleshow/134701115.cms
```

## Data model

```mermaid
erDiagram
    ARTICLES ||--o| SCORES : "scored as"
    ARTICLES ||--o| DELIVERY_ITEMS : "included in"
    DELIVERIES ||--|{ DELIVERY_ITEMS : contains

    ARTICLES {
        bigint id PK
        text url UK
        text title
        text description
        timestamptz published_at
        timestamptz fetched_at
        text feed
    }
    SCORES {
        bigint article_id PK
        int priority
        text direction
        text sectors
        text reason
        text summary
        text model
        timestamptz scored_at
    }
    DELIVERIES {
        bigint id PK
        timestamptz created_at
        timestamptz sent_at
        text status
        text recipient
    }
    DELIVERY_ITEMS {
        bigint delivery_id FK
        bigint article_id UK
    }
```

Notes:

- `articles.url` is unique, so a second insert of the same story does nothing.
- `delivery_items.article_id` is unique, so an article can appear in at most one email.
- `scores.sectors` can be a Postgres `text[]` column; it is shown as `text` here because the diagram syntax has no array type.
- `deliveries.status` is one of `pending`, `sent`, `failed`.

## Scoring contract

The scorer asks the LLM for strict JSON and rejects anything that does not match.

| Field | Type | Meaning |
|---|---|---|
| `priority` | integer 1 to 5 | Likely impact on the Indian market |
| `direction` | `positive`, `negative`, `neutral`, `unclear` | Expected effect on sentiment |
| `sectors` | list of strings | Sectors most affected, empty if broad |
| `reason` | string | One sentence on why it matters |
| `summary` | string | One or two sentence summary in the model's own words |

| Priority | Meaning | Example |
|---|---|---|
| 5 | Likely to move the whole market today | Surprise RBI rate decision |
| 4 | Material, broad impact | Stalled trade talks with a major partner |
| 3 | Relevant to some sectors | A sector-specific policy change |
| 2 | Background or commentary | Analyst views on the economy |
| 1 | Not market relevant | Lifestyle or general news |

Priority 4 and 5 trigger the email. The threshold is configurable.

Illustrative output for the India-US trade talks story (not a measured result):

```json
{
  "priority": 4,
  "direction": "negative",
  "sectors": ["exporters"],
  "reason": "Trade talks with the US have stalled, which raises tariff uncertainty.",
  "summary": "The finance minister said further concessions would be very difficult, and the US trade representative said a deal is not imminent."
}
```

The prompt needs testing against real articles before the threshold is trusted.

## Reliability decisions

| Situation | Behaviour |
|---|---|
| A feed is down or returns garbage | Log it and continue with the other feeds |
| The LLM call fails or returns invalid JSON | The article stays unscored and is retried next run |
| Too many new articles in one run | Score up to a fixed cap; the rest wait for the next run |
| The same story arrives twice | The unique `url` constraint drops it |
| Email sending fails | Mark the delivery `failed` and release its articles so the next run can include them |
| The job crashes after sending but before marking `sent` | The delivery stays `pending` and its articles are not re-sent, so a duplicate email is avoided at the cost of possibly missing a retry; log stale `pending` rows for review |

Sending order matters: write the `pending` delivery and its items in one transaction first, then send, then mark `sent`.

## Configuration

Proposed environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | none |
| `FEED_URLS` | Comma-separated feed list | TOI Business, Top stories |
| `LLM_API_KEY` | Key for the scoring model | none |
| `LLM_MODEL` | Model used for scoring | choose a small, cheap model |
| `PRIORITY_THRESHOLD` | Minimum priority to email | `4` |
| `MAX_SCORED_PER_RUN` | Cap on LLM calls per run | `30` |
| `EMAIL_TO` | Your address | none |
| `EMAIL_PROVIDER_*` | SMTP or API credentials | none |
| `DRY_RUN` | Print the email instead of sending | `false` |

Keep secrets out of the repository. Commit a `.env.example` with placeholder values only.

## Open questions

- Where does the hourly job run? Options include a scheduled GitHub Actions workflow, a small VM with cron, or a container job on a cloud provider.
- Where does Postgres live? A local container for development; a free-tier hosted instance if the job runs in the cloud.
- Which email provider? Any SMTP account or a transactional email API would work.
- Which model and what does an hour of scoring cost? Measure after the first real run.
- Is sending TOI headlines and descriptions to an LLM API within TOI's personal-use permission? It does not mention AI, so keep text minimal and revisit if the project grows beyond personal use.

## Possible later versions

Not committed, listed in the order they would probably be tackled.

1. **UI**: a small React app with a GraphQL API to change the threshold, view alert history, and mark alerts useful or not.
2. **Events**: move the hand-offs from the database to a message broker such as RabbitMQ, with an outbox table so a database write and its event never disagree.
3. **Observability**: metrics for articles fetched, alerts sent, scoring latency and cost, shown in Grafana.
4. **Validation**: record Sensex and Nifty levels at publish time and one to two hours later, to measure whether high-priority alerts really preceded moves.
5. **More sources**: additional Indian outlets, with story grouping so one event produces one alert.

## Disclaimer

market-pulse provides news summaries for information only. It is not investment advice, and its priority scores are model output that may be wrong.
