# market-pulse

Hourly email alerts for Indian market-moving news. It reads Times of India RSS feeds, scores each new article with an LLM, and emails a digest when something is high priority.

Status: project skeleton. The configuration, database schema and URL normalisation work and have tests. The feed fetcher, database queries, AI scorer, digest builder and real email sender are stubs that throw `not implemented`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and the diagram. New to Node.js? Read [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) for a tour of the project structure.

## Quick start

Requires Node.js 20 or later and Docker (for the local database).

```bash
npm install
cp .env.example .env      # on Windows PowerShell: Copy-Item .env.example .env
npm run db:up             # starts Postgres and creates the tables from db/schema.sql
npm run typecheck
npm test
```

`npm run dev` runs one job. Until the stubs are implemented it stops with `not implemented: createScorer`.

## Layout

```text
market-pulse/
├── ARCHITECTURE.md        design and data model
├── docs/
│   └── architecture.svg   architecture diagram
├── db/
│   └── schema.sql         tables: articles, scores, deliveries, delivery_items
├── src/
│   ├── index.ts           entry point: runs one job and exits
│   ├── job.ts             one hourly run, step by step
│   ├── config.ts          environment variables, validated
│   ├── db.ts              Postgres connection pool
│   ├── types.ts           shared types and the Scorer / Mailer interfaces
│   ├── feed/              fetch RSS, normalise URLs
│   ├── store/             all database queries
│   ├── scoring/           LLM prompt and scorer
│   ├── digest/            build the email content
│   └── mail/              send (or print, in dry-run mode) the email
├── test/                  tests (node:test)
├── docker-compose.yml     local Postgres
└── .env.example           configuration template
```

## Monetisation

The plan for turning this into a paid product is in [docs/MONETISATION_PLAN.md](docs/MONETISATION_PLAN.md). The TOI feeds in this repo are for personal use only and must not be used for a paid product.

## Implementation order

The full phase-by-phase plan with checklists is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). In short:

1. `feed`: download and parse the feeds, use `normalizeUrl` on every link.
2. `store`: the seven queries; each has a TODO describing what it should do.
3. `scoring`: choose a provider, call it with the prompt in `scoring/prompt.ts`, validate the JSON.
4. `digest` and `mail`: build the email, then add a real sender.
5. Choose where the hourly job runs and add its schedule.

## Disclaimer

market-pulse summarises news for information only. It is not investment advice, and its scores are model output that may be wrong.
