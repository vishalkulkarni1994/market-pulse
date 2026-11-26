# Monetisation plan

Goal: turn market-pulse from a private tool into a paid alert product. This plan sits on top of [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): Phases 1 to 4 there (fetcher, store, scorer, digest and mail) are still the core and must be built first.

## Ground rules (these shape the design)

These are not optional features. They are the constraints the product has to live inside.

1. **Never sell newspaper content.** TOI's RSS permission is personal use only and forbids commercial use. Business Standard prohibits automated access and AI use outright. The paid product must not run on either. TOI stays as the private-testing source only.
2. **Use sources that are public by nature.** Official government and regulator releases are the best base. Check each source's reuse terms before launch and record them in this repo.
3. **Sell the filtering, not the news.** Each alert is a headline, a link to the original, a priority and a one-line neutral reason in your own words.
4. **Stay on the news side of the advice line.** No buy, sell or hold calls, no price targets, no per-stock predictions. Describe what happened and which areas it touches. Keep the "not investment advice" notice on every alert. I cannot judge from here whether a given wording crosses a regulatory line; the safest choice is to stay conservative.

## Source candidates (checked 5 Oct 2026)

| Source | Feed | Items | Newest | Notes |
|---|---|---|---|---|
| RBI press releases | `https://www.rbi.org.in/pressreleases_rss.xml` | 10 | 5 Oct 13:45 | Rate decisions, policy, liquidity |
| RBI notifications | `https://www.rbi.org.in/notifications_rss.xml` | 10 | 1 Oct | Regulation and circulars |
| SEBI | `https://www.sebi.gov.in/sebirss.xml` | 30 | 1 Oct | Orders, circulars, market rules |
| PIB (finance) | `https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3` | 20 | no pubDate | Government announcements |
| NSE announcements | `https://www.nseindia.com/api/corporate-announcements` | 0 | n/a | Returned a 13-byte reply to a plain request. Needs its official data product or API, so skip for now |

Still to do: read each site's terms for automated access and reuse, and keep that note in this repo. A licensed news API is the alternative if you need broader coverage than regulator feeds give.

These sources are official but slow-moving. They cover policy events, not company news or market commentary, so alerts will be fewer and higher quality. Whether that is enough for subscribers to pay for is the main product question to test first.

## Phases

| Phase | Goal | Effort |
|---|---|---|
| M0 | Private validation on TOI | 4 to 6 weeks, mostly waiting |
| M1 | Source layer: multiple sources behind one interface | 1 to 2 days |
| M2 | Multi-recipient data model | 1 day |
| M3 | Subscriber signup and email delivery at scale | 2 to 3 days |
| M4 | Payments | 2 to 3 days |
| M5 | Production hosting and monitoring | 2 to 3 days |
| M6 | Launch, measure, iterate | ongoing |

### M0: Private validation (do alongside Phases 1 to 4)
- [ ] Build the core pipeline for yourself on the TOI feeds (personal use).
- [ ] Log every priority 4 and 5 alert with the time it was sent.
- [ ] Record Sensex and Nifty at alert time and 1 to 2 hours later (see "Validation" in `ARCHITECTURE.md`).
- [ ] After 4 to 6 weeks, judge honestly: were the alerts useful, timely and mostly right?

**Gate:** do not build M2 onwards until the alerts are good enough that you would pay for them.

### M1: Source layer
- [ ] Turn `fetchFeeds` into a list of `Source` adapters (RSS first), each with a name, a parser and a rate limit.
- [ ] Add RBI, SEBI and PIB adapters. Parse their date formats (RFC 822, and SEBI's `01 Oct, 2026 +0530`).
- [ ] Add a `source` column to `articles`.
- [ ] Make the sources a config switch so TOI can be turned off in production.
- [ ] Tune the scoring prompt for regulator and policy text, since it is written differently from news.

### M2: Multi-recipient data model
- [ ] Add `subscribers` (id, email, status, plan, created_at, unsubscribed_at).
- [ ] Change `deliveries` to be per subscriber, and keep one article from being sent twice to the same subscriber (unique on subscriber and article).
- [ ] Score each article once and reuse the score for all subscribers, so LLM cost does not grow with the user count.
- [ ] Add a migration, not just edits to `schema.sql`.

### M3: Signup and delivery
- [ ] Simple signup page with double opt-in (confirm by link).
- [ ] One-click unsubscribe link in every email, and a working `List-Unsubscribe` header.
- [ ] Move to a transactional email provider and set up SPF, DKIM and DMARC for your sending domain.
- [ ] Send in batches, with retries and bounce handling.
- [ ] Store minimal personal data: email address only unless you need more.

### M4: Payments
- [ ] Pick a provider that works for Indian customers (Razorpay or Stripe).
- [ ] Offer a free daily digest and a paid plan for instant alerts.
- [ ] Use webhooks to switch subscriber status on payment, renewal, failure and cancellation.
- [ ] Never store card details; the provider handles them.
- [ ] Add a refund and cancellation process before taking money.

### M5: Production
- [ ] Move from a free scheduled job to a small always-on service or a reliable scheduler.
- [ ] Managed Postgres with backups.
- [ ] Logging, error alerts, and a daily "pipeline ran" heartbeat so silent failures are noticed.
- [ ] A cost dashboard: LLM spend per day against revenue.
- [ ] Secrets in the host's secret store, never in the repo.

### M6: Launch
- [ ] Publish a clear page: what the product is, what it is not (no advice), where the data comes from, and your terms and privacy policy.
- [ ] Start with a small beta (10 to 50 people) at a low price.
- [ ] Track: signups, confirmations, open rate, churn, and alerts judged useful.
- [ ] Add the optional UI and API from "Possible later versions" only if subscribers ask.

## Revenue model to test first

| Plan | Price (starting guess) | What they get |
|---|---|---|
| Free | ₹0 | One digest a day |
| Paid | ₹199 to ₹499 a month | Instant priority 4 and 5 alerts, plus history |

Break-even is roughly: monthly infrastructure and LLM cost divided by the price. Measure the real cost per hourly run in M0 first; it is the number everything else depends on.

## Risks to keep an eye on

- **Thin content from official sources.** Mitigation: M0 validation, and add a licensed news API if needed.
- **Accuracy.** A wrong or late alert costs trust fast. Keep the validation tracking running after launch.
- **Content or advice rules.** The design above is conservative, but rules and terms change. Re-read each source's terms before launch and whenever you add a source.
- **Email deliverability.** Alert emails that land in spam kill the product. Set up SPF, DKIM and DMARC and watch bounce rates.
