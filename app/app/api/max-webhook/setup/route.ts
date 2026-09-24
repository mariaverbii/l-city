import { timingSafeEqual } from "node:crypto";
import { getBot } from "../../../max-bot/client";

// One-time (idempotent — safe to call again) admin action that registers
// this app's webhook URL with MAX, using the token and secret already set
// as MAX_BOT_TOKEN / MAX_WEBHOOK_SECRET on the server. Deliberately not
// something Claude runs by typing the bot token into a web form anywhere:
// the token only ever lives in the server's own environment variables,
// and this route just makes the one registration API call
// (`bot.api.subscribe`) that only the server, not a browser, can make.
// Visiting this URL with the correct `secret` query parameter is what
// triggers it — GET rather than POST only because it's meant to be
// opened directly in a browser once, by whoever holds the secret.
export async function GET(request: Request) {
  const secretParam = new URL(request.url).searchParams.get("secret");
  const expected = process.env.MAX_WEBHOOK_SECRET;

  if (!expected) {
    return Response.json(
      { ok: false, error: "MAX_WEBHOOK_SECRET не задан на сервере." },
      { status: 500 },
    );
  }

  if (!secretParam || !isEqual(secretParam, expected)) {
    return Response.json({ ok: false, error: "Неверный secret." }, { status: 403 });
  }

  const webhookUrl = `${new URL(request.url).origin}/api/max-webhook`;

  try {
    const result = await getBot().api.subscribe(webhookUrl, expected, [
      "message_created",
      "message_callback",
      "bot_started",
    ]);
    return Response.json({ ok: true, webhookUrl, result });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        webhookUrl,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function isEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

