import type { GlobalOptions } from './types.js';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GRAY = '\x1b[90m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';

/**
 * Logger that respects --verbose and --json flags.
 * All CLI output should go through this to maintain consistent formatting.
 */
export class Logger {
  constructor(private readonly options: GlobalOptions) {}

  /** Print an informational message. */
  info(message: string): void {
    if (this.options.json) return;
    console.log(message);
  }

  /** Print a success message (green). */
  success(message: string): void {
    if (this.options.json) return;
    console.log(`${GREEN}✔${RESET} ${message}`);
  }

  /** Print a warning message (yellow). */
  warn(message: string): void {
    if (this.options.json) return;
    console.warn(`${YELLOW}⚠${RESET} ${message}`);
  }

  /** Print an error message (red). */
  error(message: string): void {
    if (this.options.json) {
      console.error(JSON.stringify({ error: message }));
    } else {
      console.error(`${RED}✖${RESET} ${message}`);
    }
  }

  /** Print a debug message (only when --verbose is set). */
  debug(message: string): void {
    if (!this.options.verbose) return;
    if (this.options.json) return;
    console.log(`${GRAY}[debug]${RESET} ${message}`);
  }

  /** Print a step in a multi-step process. */
  step(n: number, total: number, message: string): void {
    if (this.options.json) return;
    console.log(`${GRAY}[${n}/${total}]${RESET} ${message}`);
  }

  /** Print a header/banner message. */
  header(message: string): void {
    if (this.options.json) return;
    console.log(`\n${BOLD}${CYAN}${message}${RESET}\n`);
  }

  /** Output structured JSON data (used when --json flag is set). */
  json(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Create a Logger instance from commander's parsed global options.
 */
export function createLogger(options: GlobalOptions): Logger {
  return new Logger(options);
}
