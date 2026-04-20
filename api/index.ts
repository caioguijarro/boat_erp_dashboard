import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

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

// Lazy-load all server modules with explicit .js extensions so
// @vercel/node can resolve them after TypeScript compilation.
// Error is exposed as JSON so we can diagnose the exact failing module.
let initError: any = null;
let initDone = false;

const initPromise = (async () => {
  try {
    const [
      { registerOAuthRoutes },
      { appRouter },
      { createContext },
      { webhookRouter },
      { syncPedidos, syncProdutos },
    ] = await Promise.all([
      import("../server/_core/oauth.js"),
      import("../server/routers.js"),
      import("../server/_core/context.js"),
      import("../server/webhook.js"),
      import("../server/olistSync.js"),
    ]);

    registerOAuthRoutes(app);
    app.use("/api/webhook", webhookRouter);

    app.use(
      "/api/trpc",
      createExpressMiddleware({ router: appRouter, createContext })
    );

    app.get("/api/cron/sync-pedidos", async (req: any, res: any) => {
      try {
        const result = await syncPedidos(2);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    app.get("/api/cron/sync-produtos", async (req: any, res: any) => {
      try {
        const result = await syncProdutos();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    initDone = true;
  } catch (err: any) {
    initError = err;
    console.error("[API Init Error]", err?.code, err?.message, err?.requireStack?.join?.(" -> "));

    // Expose error on all /api routes so we can diagnose it
    app.use("/api", (_req: any, res: any) => {
      res.status(500).json({
        error: "API initialization failed",
        code: err?.code,
        message: err?.message,
        module: err?.moduleName ?? err?.url,
        requireStack: err?.requireStack,
      });
    });
  }
})();

// Block requests until init completes
app.use(async (_req: any, _res: any, next: any) => {
  await initPromise;
  next();
});

export default app;
