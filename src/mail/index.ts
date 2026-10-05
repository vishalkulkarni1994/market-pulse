import type { Config } from '../config.js';
import type { EmailMessage, Mailer } from '../types.js';

/** Prints the email instead of sending it. Used when DRY_RUN=true. */
class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<void> {
    console.log(`--- DRY RUN: email to "${message.to}" ---`);
    console.log(`Subject: ${message.subject}\n`);
    console.log(message.text);
  }
}

/**
 * TODO: add a real mailer (SMTP or an email API) once a provider is chosen,
 * and return it when `config.dryRun` is false.
 */
export function createMailer(config: Config): Mailer {
  if (config.dryRun) {
    return new ConsoleMailer();
  }
  throw new Error('not implemented: real mailer (set DRY_RUN=true for now)');
}
