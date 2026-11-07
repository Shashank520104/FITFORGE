import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3005),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
});

export type ProgressConfig = z.infer<typeof schema>;

export function loadProgressConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ProgressConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      `Invalid Progress Service configuration: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
