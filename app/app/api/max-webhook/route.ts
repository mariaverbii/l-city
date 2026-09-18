import { handleUpdate, isWebhookSecretValid } from "../../max-bot/handler";
import type { Update } from "../../max-bot/types";

// Receives MAX Bot API webhook updates. This is a custom handler rather
// than the official `@maxhub/max-bot-api` client's own `bot.webhookCallback()`
// / `bot.start({mode:'webhook'})`, for two reasons verified directly from
// the client's source (github.com/max-messenger/max-bot-api-client-ts):
//   1. Its webhook server targets Node's raw `http.IncomingMessage`/
//      `ServerResponse`, not the Web-standard `Request`/`Response` that
//      Next.js App Router route handlers use.
//   2. Its update dispatcher (`Bot#handleUpdate`) is a private class
//      field, so even a request/response shim couldn't feed a manually
//      parsed update into the library's own `.on()`/scenario system.
// So this route re-implements just the verified wire contract (the
// `X-Max-Bot-Api-Secret` header check, immediate 200 OK, then process)
// and calls straight into our own handler, while still reusing the
// library's `Api` class for every outgoing call (see ../../max-bot/client.ts).
export async function POST(request: Request) {
  const secretHeader = request.headers.get("x-max-bot-api-secret");

  if (!isWebhookSecretValid(secretHeader)) {
    return new Response("Forbidden", { status: 403 });
  }

  let update: Update;

  try {
    update = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Matches the official client's own webhook handler: respond 200
  // immediately, then process — so MAX doesn't retry delivery just
  // because our processing (database writes, downloading a photo) takes
  // longer than its response timeout. This app runs as a standing
  // `next start` Node process (not a frozen-after-response serverless
  // function), so the event loop keeps running the update handler after
  // the response is sent.
  void handleUpdate(update).catch((error) => {
    console.error("Ошибка обработки обновления MAX-бота:", error);
  });

  return new Response("OK", { status: 200 });
}
