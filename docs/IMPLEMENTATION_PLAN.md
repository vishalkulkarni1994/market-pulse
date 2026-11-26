# Phase-wise implementation plan

Where the project stands: the design, config, database schema, URL normalisation, console dry-run mailer and the job orchestration in `src/job.ts` are done. The feed fetcher, store queries, AI scorer, digest builder and real mailer are stubs that throw `not implemented`. There is no scheduler yet.

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the design and [PROJECT_GUIDE.md](PROJECT_GUIDE.md) for a tour of the code.

| Phase | Goal | Files | Rough effort |
|---|---|---|---|
| 0 | Prerequisites and decisions | none | 1 hr |
| 1 | Feed fetcher | `src/feed/` | 2 to 3 hrs |
| 2 | Store layer | `src/store/` | 3 to 4 hrs |
| 3 | AI scorer | `src/scoring/` | 4 to 6 hrs |
| 4 | Digest and mail | `src/digest/`, `src/mail/` | 3 to 4 hrs |
| 5 | Scheduling and deployment | `.github/workflows/` | 2 to 3 hrs |
| 6 | Hardening | CI, logging, alerts | 2 to 4 hrs |

Phases 1 to 4 are the core. Phase 3 is the riskiest, because the quality of the prompt decides whether the alerts are any good.

## Phase 0: Prerequisites

- [x] Confirm each Business Standard RSS feed returns fresh items. Checked 5 Oct 2026 around 17:00 IST. All six feeds returned HTTP 200 with `application/rss+xml`:

  | Feed | Items | Newest item | Verdict |
  |---|---|---|---|
  | economy-102 | 35 | 5 Oct 15:56 | fresh |
  | markets-106 | 35 | 5 Oct 15:04 | fresh |
  | finance-103 | 35 | 5 Oct 15:02 | fresh |
  | home_page_top_stories | 11 | 5 Oct 16:06 | fresh |
  | latest | 128 | 5 Oct 16:48 | fresh, broadest |
  | markets/stock-market-news-10618 | 15 | 17 Sep | **stale, do not use** |

  The first `<link>` in each feed is the channel link, not an article, so the parser must skip it. `latest.rss` has an empty `<link>`; check for empty links too.
- [x] Read the terms of use for personal reuse of the feeds. **Business Standard** was ruled out (see below). **Times of India** allows personal use of its RSS feeds and is the chosen source.

  **Terms findings.** Without prior written consent, the terms prohibit:
  - using "robots, spiders, scripts ... or any ... automatic device" to access or collect Content (1.1 item 2);
  - using Content in connection with any machine learning or AI system, including "grounding" and retrieval-augmented generation (item 3);
  - caching or archiving Content (item 5);
  - ignoring robots.txt, and they state that robots.txt does not count as consent (item 4).

  The terms do not mention RSS specifically, and there is no personal or non-commercial exception. A scheduled script that reads the feeds and sends headlines to an LLM appears to fall inside items 2 and 3, and storing articles in Postgres touches item 5. This is my reading of the text, not legal advice. `ARCHITECTURE.md` currently says the RSS page states no reuse terms; that is out of date.

  **Alternative checked: Times of India RSS** (5 Oct 2026, ~17:00 IST). All four feeds returned HTTP 200 with fresh items:

  | Feed | URL | Items | Newest |
  |---|---|---|---|
  | Business | `https://timesofindia.indiatimes.com/business/rssfeeds/1898055.cms` | 20 | 5 Oct 16:39 |
  | India | `https://timesofindia.indiatimes.com/india/rssfeeds/-2128936835.cms` | 20 | 5 Oct 16:18 |
  | Top stories | `https://timesofindia.indiatimes.com/rssfeedstopstories.cms` | 46 | 5 Oct 16:10 |
  | Most recent | `https://timesofindia.indiatimes.com/rssfeedmostrecent.cms` | 50 | 5 Oct 16:12 |

  Its RSS page (`/rss.cms`, "Use of Rss Feeds") says TOI "grants you permission to only access and make personal use of its RSS feeds". It forbids copying, publishing, distributing or disseminating the feeds, and displaying, hosting, aggregating, reselling or commercial use. It says not to keep copies except for personal use. It does not mention AI or LLMs. A private tool that emails headlines to yourself fits the personal-use grant. The grey areas are sending the text to an LLM API (a third party) and keeping articles in a database, so keep to headline, description, link and your own summary. Date formats differ between feeds (ISO 8601 in some, RFC 822 in others), so the parser must accept both. `robots.txt` disallows `/feeds/` and `*rssarticleshow*`, which these URLs do not match.

  **Decision (5 Oct 2026): switch to Times of India.** Defaults are TOI Business and Top stories. The earlier options were: (a) email Business Standard for written permission (assist@bsmail.in or feedback@bsmail.in are listed in the terms); (b) switch to a source that explicitly permits this, such as an official API, a licensed news feed, or another outlet whose terms allow it; (c) proceed at your own risk for private use, accepting that the terms are against it.
- [x] LLM provider: **Anthropic** (model to be chosen; start with a small, cheap one such as Haiku 4.5 and check the priority 4 and 5 results by hand).
- [ ] Choose the email provider. It sits behind the `Mailer` interface, so the choice is easy to change later.
- [x] News source: **Times of India RSS feeds** for v1. Claude's web search tool (restricted to one domain) is deferred; revisit later, most likely to verify priority 4 and 5 stories or as a fallback if feeds go stale.
- [ ] Run `npm install`, `npm run db:up`, `npm run typecheck` and `npm test` to confirm the baseline.

**Done when:** the feeds are confirmed live, providers are chosen, and the baseline passes.

## Phase 1: Feed fetcher (`src/feed/index.ts`)

- [ ] Handle the TOI feed format: CDATA-wrapped fields, escaped `<img>` HTML in descriptions, a channel-level `<link>` to skip, and both ISO 8601 and RFC 822 dates.
- [ ] Fetch each feed with a timeout and a User-Agent header.
- [ ] Parse the RSS with `fast-xml-parser` or `rss-parser` into `FeedItem`s.
- [ ] Run every link through `normalizeUrl`.
- [ ] Set `publishedAt` to null when `pubDate` is missing or malformed.
- [ ] If a feed fails, log it and continue with the others.
- [ ] Tests: a saved RSS fixture in `test/`, plus a failing-feed case.

**Done when:** `fetchFeeds` returns normalised items from the live feeds, and one broken feed does not abort the run.

## Phase 2: Store layer (`src/store/index.ts`)

Implement the seven queries:

- [ ] `storeNewArticles`: `INSERT ... ON CONFLICT (url) DO NOTHING`, returning how many rows were really inserted.
- [ ] `findUnscored`: articles with no row in `scores`, oldest first, with a limit.
- [ ] `saveScore`: insert one row into `scores`.
- [ ] `selectDeliverable`: priority at or above the threshold and not in `delivery_items`.
- [ ] `createPendingDelivery`: one transaction inserting the delivery and its items.
- [ ] `markDeliverySent`: set `status = 'sent'` and `sent_at = now()`.
- [ ] `markDeliveryFailed`: set `status = 'failed'` and delete its items so the articles can be sent again.
- [ ] Convert `bigint` ids to numbers in the store layer, as `types.ts` documents.
- [ ] Tests against the Docker Postgres: duplicate inserts, an article that cannot be in two emails, and release on failure.

**Done when:** a second `npm run dev` adds 0 new articles. Scoring still throws here, so use a temporary fake scorer to check the rest.

## Phase 3: AI scorer (`src/scoring/index.ts`)

- [ ] Implement the provider client behind `Scorer`, using `SYSTEM_PROMPT` and `buildUserPrompt`.
- [ ] Parse the JSON reply and validate every field: priority 1 to 5, a known direction, `sectors` as a string array, non-empty `reason` and `summary`.
- [ ] Throw on anything invalid, so the article stays unscored and is retried next run.
- [ ] Add retries with backoff for rate limits and transient errors.
- [ ] Run the prompt on 30 to 50 real articles and hand-check the priority 4 and 5 results. Tune the prompt and confirm the threshold.
- [ ] Tests: the validator against good, bad and truncated JSON.

**Done when:** a real run scores articles, and the high-priority ones are sensible when you read them.

## Phase 4: Digest and mail

`src/digest/index.ts`

- [ ] Build the subject line with the article count and the top headline.
- [ ] List each article as a linked headline with priority, direction, sectors and reason, in plain text and simple HTML.
- [ ] Escape HTML, sort by priority then time, and add the "not investment advice" line.

`src/mail/index.ts`

- [ ] Add the real mailer (SMTP via `nodemailer`, or a transactional email API).
- [ ] Add the `EMAIL_PROVIDER_*` variables to `config.ts` and `.env.example`, validated only when `DRY_RUN=false`.
- [ ] Log stale `pending` deliveries for review, as `ARCHITECTURE.md` describes.
- [ ] Tests: digest output, HTML escaping, and the empty-list case.

**Done when:** a dry run prints a good digest, then one real email arrives in your inbox.

## Phase 5: Scheduling and deployment

- [ ] Decide where the hourly job runs. Suggested for a personal project: a scheduled GitHub Actions workflow with a free-tier hosted Postgres (Neon or Supabase). The alternative is a small VM with cron.
- [ ] Add `.github/workflows/hourly.yml` with a cron schedule, a `workflow_dispatch` trigger, and secrets for `DATABASE_URL`, `LLM_API_KEY` and the email settings.
- [ ] Apply `db/schema.sql` to the hosted database.
- [ ] Optionally limit runs to market hours on weekdays. GitHub's cron can drift by several minutes.
- [ ] Run with `DRY_RUN=true` for a day or two, then turn it off.

**Done when:** hourly runs fire unattended and an email arrives only when something qualifies.

## Phase 6: Hardening

- [ ] Add a CI workflow that runs typecheck and tests on pull requests.
- [ ] Add structured logging with per-run counts and a cost estimate.
- [ ] Get notified on repeated failures (for example GitHub Actions failure emails).
- [ ] Check for stale `pending` deliveries on each run.
- [ ] Confirm no secrets are committed.
- [ ] Verify `npm run build` and `npm start` work from `dist/`.
- [ ] Update the README status section.

**Done when:** failures surface without you checking, and CI is green.

## Later

From `ARCHITECTURE.md`, not committed: a UI with a GraphQL API, a message broker with an outbox table, observability in Grafana, validation against Sensex and Nifty moves, and more news sources.
