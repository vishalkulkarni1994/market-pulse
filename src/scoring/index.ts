import type { Config } from '../config.js';
import type { Scorer } from '../types.js';

export { SYSTEM_PROMPT, buildUserPrompt } from './prompt.js';

/**
 * TODO: pick an LLM provider, call it with SYSTEM_PROMPT and buildUserPrompt,
 * parse the reply as JSON and validate every field (priority 1 to 5, known
 * direction, and so on). Reject anything that does not match, so the article
 * is retried on the next run.
 */
export function createScorer(config: Config): Scorer {
  void config;
  throw new Error('not implemented: createScorer');
}
