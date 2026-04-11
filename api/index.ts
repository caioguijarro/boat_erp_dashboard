import "dotenv/config";
import express from "express";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use((req: any, res: any, next: any) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});

let appReady = false;
let initError: string | null = null;

async function initApp() {
  try {
    const { registerOAuthRoutes } = await import("../server/_core/oauth");
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");
    const { webhookRouter } = await import("../server/webhook");
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { syncPedidos, syncProdutos } = await import("../server/olistSync");

    registerOAuthRoutes(app);
    app.use("/api/webhook", webhookRouter);
    app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

    app.get('/api/cron/sync-pedidos', async (req: any, res: any) => {
      try { res.json(await syncPedidos(2)); } catch (err) { res.status(500).json({ error: String(err) }); }
    });
    app.get('/api/cron/sync-produtos', async (req: any, res: any) => {
      try { res.json(await syncProdutos()); } catch (err) { res.status(500).json({ error: String(err) }); }
    });

    appReady = true;
    console.log("[App] Initialized successfully");
  } catch (err: any) {
    initError = String(err?.stack ?? err);
    console.error("[App] Initialization failed:", initError);
  }
}

const initPromise = initApp();

app.use("/api", async (req: any, res: any) => {
  await initPromise;
  if (!appReady) {
    res.status(500).json({ error: "App initialization failed", detail: initError });
    return;
  }
  res.status(404).json({ error: "Not found" });
});

export default app;
