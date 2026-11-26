# Project guide for Node.js beginners

A tour of how this repo is laid out and how Node.js and TypeScript concepts show up in it. For the design and data model, see [ARCHITECTURE.md](../ARCHITECTURE.md).

## The big picture

market-pulse is **not a web server**. It is a script that starts, does one hourly run (fetch news, score it, email a digest) and exits. Something external (a scheduler such as cron or GitHub Actions) starts it again an hour later.

```text
npm run dev  ->  src/index.ts  ->  runJob() in src/job.ts  ->  exits
```

## Top-level files

| File / folder | What it is |
|---|---|
| `package.json` | The project's manifest: name, scripts, and the list of libraries it uses. |
| `package-lock.json` | The exact versions installed. Commit it; never edit it by hand. |
| `node_modules/` | Downloaded libraries (created by `npm install`). Git-ignored, never edit. |
| `tsconfig.json` | TypeScript settings for editing and type checking. |
| `tsconfig.build.json` | TypeScript settings for producing the `dist/` build. |
| `dist/` | Compiled JavaScript from `npm run build`. Git-ignored. |
| `.env` | Your real secrets and settings. Git-ignored, never commit it. |
| `.env.example` | A template of `.env` with placeholders. Commit this one. |
| `.gitignore` | Files Git should skip (`node_modules`, `dist`, `.env`). |
| `docker-compose.yml` | Starts a local PostgreSQL database in Docker. |
| `db/schema.sql` | SQL that creates the four tables. Docker runs it when the database is first created. |
| `docs/` | The architecture diagram and this guide. |
| `test/` | Automated tests. |

## package.json explained

```jsonc
"type": "module"        // use modern `import ... from` syntax, not `require()`
"engines": {"node": ">=20"}
"scripts": {            // run with: npm run <name>
  "dev":       "tsx src/index.ts",        // run the TypeScript directly (development)
  "build":     "tsc -p tsconfig.build.json", // compile TS -> JS into dist/
  "start":     "node dist/index.js",      // run the compiled build (production)
  "typecheck": "tsc --noEmit",            // check types only, produce nothing
  "test":      "node --import tsx --test test/*.test.ts",
  "db:up":     "docker compose up -d",    // start Postgres
  "db:down":   "docker compose down"      // stop Postgres
}
```

- **dependencies** are needed at runtime: `pg` (talk to Postgres) and `dotenv` (load `.env`).
- **devDependencies** are only for development: `typescript`, `tsx` (runs TS without a build step), and type definitions (`@types/*`).
- Add a library with `npm install <name>`; add a dev-only one with `npm install -D <name>`.

## TypeScript in one minute

TypeScript is JavaScript plus type annotations. Node can't run it directly, so:

- in development, `tsx` runs `.ts` files on the fly (`npm run dev`);
- for production, `tsc` compiles `src/*.ts` into `dist/*.js`, which Node runs (`npm run build` then `npm start`).

Because of `"type": "module"`, imports of your own files **must end in `.js`** even though the source is `.ts`:

```ts
import { runJob } from './job.js';   // correct, although the file is job.ts
```

## The `src/` folder

Each subfolder has one job, and files in them import only what they need.

| Path | Responsibility | Status |
|---|---|---|
| `src/index.ts` | Entry point. Loads `.env`, builds the config, database, scorer and mailer, calls `runJob`, closes the database, exits. | done |
| `src/job.ts` | One hourly run, step by step: fetch, store, score, select, send. It only coordinates; it contains no SQL or HTTP. | done |
| `src/config.ts` | Reads environment variables, validates them and returns one typed `Config` object. Fails early with a clear message if something is wrong. | done |
| `src/db.ts` | Creates the Postgres connection pool. | done |
| `src/types.ts` | Shared types (`Article`, `ScoreResult`, ...) and the `Scorer` and `Mailer` interfaces. | done |
| `src/feed/` | Download and parse the RSS feeds. `normalizeUrl.ts` cleans URLs so duplicates are caught. | `fetchFeeds` is a stub |
| `src/store/` | **All SQL lives here.** Nothing else talks to the database. | stubs |
| `src/scoring/` | `prompt.ts` holds the LLM prompt; `index.ts` will call the model and validate its JSON reply. | stub |
| `src/digest/` | Turns scored articles into the email subject, text and HTML. | stub |
| `src/mail/` | Sends the email. The dry-run console version exists; the real sender is to be added. | partial |

### Why interfaces (`Scorer`, `Mailer`)?

`job.ts` depends on the *shape* (`score(article)`, `send(message)`), not on a specific vendor. So you can swap the LLM or email provider, or use a fake in tests, without touching `job.ts`.

### Why `async` / `await` everywhere?

Network and database calls take time. `await` pauses that function until the result arrives without freezing Node. Any function that awaits is marked `async` and returns a `Promise`. Errors from awaited calls are caught with `try/catch`, as in `job.ts`.

## How a run flows through the files

1. `index.ts` calls `loadConfig()` (config.ts) and `createPool()` (db.ts).
2. `runJob()` in `job.ts` calls:
   1. `fetchFeeds()` from `feed/` to download items.
   2. `storeNewArticles()` from `store/` to save the new ones.
   3. `findUnscored()`, `scorer.score()`, `saveScore()` to score them.
   4. `selectDeliverable()` to find priority 4 and 5 articles not yet emailed.
   5. `buildDigest()` from `digest/`, then `createPendingDelivery()`, `mailer.send()` and `markDeliverySent()`.
3. `index.ts` prints the result counts, closes the pool and the process exits.

## Configuration: `.env`

`dotenv` loads `.env` into `process.env` when `index.ts` starts. `config.ts` then reads and validates those values. Locally you copy `.env.example` to `.env`. In production you set the same variables in the host's secrets settings. `DRY_RUN=true` prints the email instead of sending it, so use it while developing.

## Tests

Tests use Node's built-in runner (`node:test`), with no extra framework. Run them with `npm test`. Current tests cover `config.ts` and `normalizeUrl.ts`. New tests go in `test/` and must end in `.test.ts`.

## Everyday commands

```bash
npm install        # first time, and after package.json changes
npm run db:up      # start the database
npm run typecheck  # find type errors
npm test           # run tests
npm run dev        # run one job (needs the stubs implemented)
npm run build      # compile to dist/
npm start          # run the compiled build
```

## Where to add code

| I want to... | Go to |
|---|---|
| Change how feeds are read | `src/feed/` |
| Change a SQL query or add a column | `src/store/` and `db/schema.sql` |
| Tune what counts as high priority | `src/scoring/prompt.ts` and `PRIORITY_THRESHOLD` in `.env` |
| Change the email's look | `src/digest/` |
| Switch email or LLM provider | `src/mail/` or `src/scoring/` (implement the interface) |
| Add a setting | `src/config.ts`, then `.env.example` |
