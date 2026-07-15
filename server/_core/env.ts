import { z } from "zod";

const envSchema = z.object({
  VITE_AUTH_MODE: z.string().optional().default("oauth"),
  VITE_APP_ID: z.string().optional().default(""),
  JWT_SECRET: z.string().optional().default(""),
  DATABASE_URL: z.string().optional().default(""),
  OAUTH_SERVER_URL: z.string().optional().default(""),
  OWNER_OPEN_ID: z.string().optional().default(""),
  LOCAL_AUTH_NAME: z.string().optional().default("Administrador"),
  LOCAL_AUTH_EMAIL: z.string().optional().default("admin@boat.local"),
  NODE_ENV: z.string().optional().default("development"),
  BUILT_IN_FORGE_API_URL: z.string().optional().default(""),
  BUILT_IN_FORGE_API_KEY: z.string().optional().default(""),
  OLIST_API_TOKEN: z.string().optional().default(""),
  OLIST_WRITEBACK_ENABLED: z.string().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error("❌ Variáveis de ambiente inválidas:", _env.error.format());
  throw new Error("Invalid environment variables");
}

export const ENV = {
  authMode: _env.data.VITE_AUTH_MODE.trim().toLowerCase(),
  appId: _env.data.VITE_APP_ID,
  cookieSecret: _env.data.JWT_SECRET,
  databaseUrl: _env.data.DATABASE_URL,
  oAuthServerUrl: _env.data.OAUTH_SERVER_URL,
  ownerOpenId: _env.data.OWNER_OPEN_ID,
  localAuthName: _env.data.LOCAL_AUTH_NAME,
  localAuthEmail: _env.data.LOCAL_AUTH_EMAIL,
  isProduction: _env.data.NODE_ENV === "production",
  forgeApiUrl: _env.data.BUILT_IN_FORGE_API_URL,
  forgeApiKey: _env.data.BUILT_IN_FORGE_API_KEY,
  olistApiToken: _env.data.OLIST_API_TOKEN,
  // Write-back do CRM no Tiny fica SEMPRE ativo por padrão; só desliga se
  // OLIST_WRITEBACK_ENABLED for explicitamente "false".
  olistWritebackEnabled: _env.data.OLIST_WRITEBACK_ENABLED.trim().toLowerCase() !== "false",
  adminPassword: _env.data.ADMIN_PASSWORD,
};
