/**
 * Global CLI options shared across all commands.
 */
export interface GlobalOptions {
  /** Enable verbose logging output */
  verbose: boolean;
  /** Format output as JSON instead of human-readable text */
  json: boolean;
}

/**
 * Options for the `init` command.
 */
export interface InitOptions extends GlobalOptions {}

/**
 * Options for the `scan` command.
 */
export interface ScanOptions extends GlobalOptions {}

/**
 * Options for the `watch` command.
 */
export interface WatchOptions extends GlobalOptions {}

/**
 * Options for the `explain` command.
 */
export interface ExplainOptions extends GlobalOptions {
  /** The file or folder path to explain */
  path: string;
}

/**
 * Options for the `generate` command.
 */
export interface GenerateOptions extends GlobalOptions {}

/**
 * Options for the `status` command.
 */
export interface StatusOptions extends GlobalOptions {}

/**
 * A command handler function.
 * Each command module exports a handler matching this signature.
 */
export type CommandHandler<T extends GlobalOptions = GlobalOptions> = (
  options: T
) => Promise<void>;
