import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3004),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  OLLAMA_BASE_URL: z.url().default("http://ollama:11434"),
  OLLAMA_MODEL: z.string().trim().min(1).default("qwen2.5:3b"),
});

export type NutritionConfig = z.infer<typeof schema>;

export function loadNutritionConfig(
  environment: NodeJS.ProcessEnv = process.env,
): NutritionConfig {
  const result = schema.safeParse(environment);
  if (!result.success) {
    throw new Error(
      `Invalid Nutrition Service configuration: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
