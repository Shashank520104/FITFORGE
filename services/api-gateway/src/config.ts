import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  AUTH_SERVICE_URL: z.url(),
  WORKOUT_SERVICE_URL: z.url(),
  NUTRITION_SERVICE_URL: z.url(),
  PROGRESS_SERVICE_URL: z.url(),
  PROFILE_SERVICE_URL: z.url(),
  PERSONALIZATION_SERVICE_URL: z.url(),
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default("redis://localhost:6379"),
  JWT_SECRET: z.string().min(32),
  UPSTREAM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(5000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10000).default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(3600000)
    .default(60000),
});

export type GatewayConfig = z.infer<typeof environmentSchema>;

export function loadGatewayConfig(
  environment: NodeJS.ProcessEnv = process.env,
): GatewayConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      `Invalid API Gateway configuration: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
