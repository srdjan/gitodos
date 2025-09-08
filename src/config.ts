// Application configuration loading (keep pure; validate inputs)
// TODO: Load from environment and/or JSON file; validate with zod.
// TODO: Manage secrets via environment/keystore; avoid committing secrets.

export type AppConfig = {
  readonly port: number;
  readonly env: "development" | "production" | "test";
};

export const getConfig = (): AppConfig => {
  const port = Number(Deno.env.get("PORT") ?? 8000);
  const env = (Deno.env.get("ENV") ?? "development") as AppConfig["env"];
  return { port, env };
};

