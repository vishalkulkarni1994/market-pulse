export const DEFAULT_FEED_URLS: readonly string[] = [
  'https://www.business-standard.com/rss/economy-102.rss',
  'https://www.business-standard.com/rss/markets-106.rss',
  'https://www.business-standard.com/rss/home_page_top_stories.rss',
];

export interface Config {
  databaseUrl: string;
  feedUrls: string[];
  /** Email only articles scoring at or above this priority (1 to 5). */
  priorityThreshold: number;
  /** Upper limit of LLM scoring calls in one run. */
  maxScoredPerRun: number;
  llmApiKey: string | undefined;
  llmModel: string | undefined;
  emailTo: string;
  emailFrom: string;
  /** When true, print the digest instead of sending it. */
  dryRun: boolean;
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

function optional(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function intInRange(env: Env, name: string, fallback: number, min: number, max: number): number {
  const raw = optional(env, name);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}, got "${raw}"`);
  }
  return value;
}

function bool(env: Env, name: string, fallback: boolean): boolean {
  const raw = optional(env, name)?.toLowerCase();
  if (raw === undefined) return fallback;
  if (['1', 'true', 'yes'].includes(raw)) return true;
  if (['0', 'false', 'no'].includes(raw)) return false;
  throw new Error(`${name} must be true or false, got "${raw}"`);
}

/** Reads and validates configuration. Pass `env` explicitly in tests. */
export function loadConfig(env: Env = process.env): Config {
  const dryRun = bool(env, 'DRY_RUN', false);
  const feedList = optional(env, 'FEED_URLS');

  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    feedUrls: feedList
      ? feedList.split(',').map((u) => u.trim()).filter(Boolean)
      : [...DEFAULT_FEED_URLS],
    priorityThreshold: intInRange(env, 'PRIORITY_THRESHOLD', 4, 1, 5),
    maxScoredPerRun: intInRange(env, 'MAX_SCORED_PER_RUN', 30, 1, 500),
    llmApiKey: optional(env, 'LLM_API_KEY'),
    llmModel: optional(env, 'LLM_MODEL'),
    // A dry run only prints the email, so recipient and sender can be empty.
    emailTo: dryRun ? (optional(env, 'EMAIL_TO') ?? '') : required(env, 'EMAIL_TO'),
    emailFrom: dryRun ? (optional(env, 'EMAIL_FROM') ?? '') : required(env, 'EMAIL_FROM'),
    dryRun,
  };
}
