import pino from "pino";
import { env } from "./env.js";

/**
 * Structured logger using pino.
 *
 * In development, logs are pretty-printed with colors.
 * In production, logs are JSON for structured log aggregation.
 *
 * @example
 * ```ts
 * import { logger } from '@printr/sdk/logger';
 *
 * logger.info({ user_id: '123' }, 'User logged in');
 * logger.error({ error: err.message }, 'Operation failed');
 * ```
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.LOG_FORMAT === "pretty"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
  // Redact sensitive fields
  redact: {
    paths: [
      "*.privateKey",
      "*.private_key",
      "*.password",
      "*.secret",
      "*.apiKey",
      "*.api_key",
      "*.token",
      "authorization",
      "*.authorization",
    ],
    censor: "[REDACTED]",
  },
});

/**
 * Create a child logger with additional context.
 *
 * @example
 * ```ts
 * const toolLogger = logger.child({ tool: 'printr_launch_token' });
 * toolLogger.info({ duration_ms: 123 }, 'Tool executed');
 * ```
 */
export const createLogger = (context: Record<string, unknown>) => logger.child(context);
