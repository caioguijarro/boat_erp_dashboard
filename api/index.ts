import "dotenv/config";
import express from "express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { webhookRouter } from "../server/webhook";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { syncPedidos, syncProdutos } from "../server/olistSync";

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

registerOAuthRoutes(app);
app.use("/api/webhook", webhookRouter);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

app.get('/api/cron/sync-pedidos', async (req: any, res: any) => {
  try {
    const result = await syncPedidos(2);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/cron/sync-produtos', async (req: any, res: any) => {
  try {
    const result = await syncProdutos();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default app;
