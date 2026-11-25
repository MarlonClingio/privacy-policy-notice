export interface AppConfig {
  port: number;
  databasePath: string;
  sessionTtlMinutes: number;
  seedDemoData: boolean;
  isProduction: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    databasePath: env.DATABASE_PATH ?? './data/app.db',
    sessionTtlMinutes: Number(env.SESSION_TTL_MINUTES ?? 120),
    seedDemoData: (env.SEED_DEMO_DATA ?? 'true') === 'true',
    isProduction: env.NODE_ENV === 'production',
  };
}
