import { timingSafeEqual } from "node:crypto";
import { Bot, Keyboard } from "@maxhub/max-bot-api";

// A single `Bot` instance for outgoing calls (`bot.api.sendMessageToUser`,
// `bot.api.subscribe`, ...). Its constructor only builds the HTTP client —
// it makes no network call and needs no `.start()`/`.startWebhook()` — so
// it's safe to create once per server process and reuse. This app never
// calls `bot.start()` or the library's own webhook server: incoming
// updates are received and parsed by our own Next.js route
// (app/api/max-webhook/route.ts) instead, because the library's update
// dispatcher (`handleUpdate`) is a private method that can't be driven by
// a custom Next.js request/response, and its `webhookCallback` targets
// Node's raw `http.IncomingMessage`/`ServerResponse`, not the Web-standard
// `Request`/`Response` Next.js route handlers use.
let botInstance: Bot | null = null;

export function getBot(): Bot {
  const token = process.env.MAX_BOT_TOKEN;

  if (!token) {
    throw new Error("MAX_BOT_TOKEN не задан.");
  }

  if (!botInstance) {
    botInstance = new Bot(token);
  }

  return botInstance;
}

// Verifies the `X-Max-Bot-Api-Secret` header MAX sends with every webhook
// request against the secret registered when subscribing
// (`bot.api.subscribe(url, secret, ...)`). Mirrors the official client's
// own `Webhook#isSecretValid` (github.com/max-messenger/max-bot-api-client-ts,
// src/core/network/webhook.ts): a length check before `timingSafeEqual`,
// since that throws on mismatched buffer lengths rather than returning
// false.
export function isWebhookSecretValid(headerValue: string | null): boolean {
  const secret = process.env.MAX_WEBHOOK_SECRET;

  if (!secret) {
    // No secret configured yet — reject everything rather than accepting
    // unauthenticated requests. Set MAX_WEBHOOK_SECRET before subscribing
    // the webhook in production.
    return false;
  }

  if (!headerValue) {
    return false;
  }

  const a = Buffer.from(headerValue);
  const b = Buffer.from(secret);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export { Keyboard };
