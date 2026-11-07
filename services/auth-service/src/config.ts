import { z } from "zod";

const environmentSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3002),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    COOKIE_SECURE: z.enum(["true", "false"]).optional(),
  })
  .transform(({ COOKIE_SECURE, NODE_ENV, ...config }) => ({
    ...config,
    COOKIE_SECURE:
      COOKIE_SECURE === "true" ||
      (COOKIE_SECURE === undefined && NODE_ENV === "production"),
  }));

export type AuthConfig = z.infer<typeof environmentSchema>;

export function loadAuthConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AuthConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      `Invalid Auth Service configuration: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
