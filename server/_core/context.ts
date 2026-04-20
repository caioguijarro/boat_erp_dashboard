import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const now = new Date();
  return {
    req: opts.req,
    res: opts.res,
    user: {
      id: 0,
      openId: "local-admin",
      name: "Admin",
      email: "admin@boatbeer.com.br",
      loginMethod: "local",
      role: "admin",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
  };
}
