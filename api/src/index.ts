import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./env";
import { createPublicApp } from "./app";
import { createGatewayApp } from "./admin-gateway";

// The public API (app.ts) serves content.xahabcse.me/api/*.
const app = createPublicApp();

// Named entrypoint reachable only through a service binding from portfolio-api-hono
// (admin.xahabcse.me). It is the only way into /api/admin. See admin-gateway.ts.
const gatewayApp = createGatewayApp();

export class AdminGateway extends WorkerEntrypoint<Env> {
  async fetch(request: Request): Promise<Response> {
    return gatewayApp.fetch(request, this.env, this.ctx);
  }
}

export default app;
export { RateLimitDO } from "./durable-objects/rate-limit";
