import 'dotenv/config';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { runJob } from './job.js';
import { createScorer } from './scoring/index.js';
import { createMailer } from './mail/index.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = createPool(config.databaseUrl);
  try {
    const result = await runJob({
      config,
      db,
      scorer: createScorer(config),
      mailer: createMailer(config),
    });
    console.log(JSON.stringify(result));
  } finally {
    await db.end();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
