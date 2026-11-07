import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3007),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  REPORT_ENCRYPTION_KEY: z.string().min(1),
  OLLAMA_BASE_URL: z.url().default("http://ollama:11434"),
  OLLAMA_MODEL: z.string().trim().min(1).default("qwen2.5:3b"),
});

export type PersonalizationConfig = z.infer<typeof schema>;

export function loadPersonalizationConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PersonalizationConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      `Invalid Personalization Service configuration: ${z.prettifyError(result.error)}`,
    );
  }
  if (
    Buffer.from(result.data.REPORT_ENCRYPTION_KEY, "base64url").length !== 32
  ) {
    throw new Error(
      "REPORT_ENCRYPTION_KEY must be a base64url-encoded 32-byte key",
    );
  }
  return result.data;
}
