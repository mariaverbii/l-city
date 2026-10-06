// Shared helper for the optional AI-assistance features: cleaning up a work
// description and suggesting a cost. Used by both the web panel
// (actions/completed-works.ts) and the MAX bot (max-bot/handler.ts), so the
// behavior is identical no matter where a work entry is created.
//
// Best-effort by design: if ANTHROPIC_API_KEY isn't set (admin hasn't added
// it yet on the hosting panel) or the API call fails/times out for any
// reason, callers get nulls back and fall back to the employee's own text /
// no suggestion — the app must keep working without this key.
//
// IMPORTANT: this NEVER sets or confirms official cost — it only returns a
// suggestion (costSuggestedKopecks) that office staff can choose to copy
// into the real cost field when reviewing the entry. That matches the
// project's hard rule that AI must never auto-approve financial data, and
// that only a director-confirmed cost goes into official documents.

import { db } from "./db";

type SimilarWork = {
  description: string;
  costRubles: number;
};

type AnalyzeInput = {
  description: string;
  location: string;
  volume: string;
  materials: string;
};

export type AnalyzeResult = {
  description: string | null;
  costSuggestedKopecks: number | null;
};

const EMPTY_RESULT: AnalyzeResult = { description: null, costSuggestedKopecks: null };

// A handful of recent, director-confirmed entries, used as price reference
// points for the cost suggestion. Deliberately simple (just "recent" rather
// than matched by house/category) — there's no "Расценки" rate table in the
// system yet, so this is the best grounding available for now.
async function getSimilarConfirmedWorks(limit = 8): Promise<SimilarWork[]> {
  const rows = await db.completedWork.findMany({
    where: { costConfirmed: true, costKopecks: { not: null } },
    select: { description: true, costKopecks: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows
    .filter(
      (row): row is { description: string; costKopecks: number } =>
        row.costKopecks !== null,
    )
    .map((row) => ({ description: row.description, costRubles: row.costKopecks / 100 }));
}

// Entry point used by both the web panel (actions/completed-works.ts) and
// the MAX bot (max-bot/handler.ts) when a new work entry is being saved.
// Looks up price-reference examples itself so callers just pass the raw
// fields entered for this one record.
export async function analyzeCompletedWork(
  input: AnalyzeInput,
): Promise<AnalyzeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return EMPTY_RESULT;
  }

  const similar = await getSimilarConfirmedWorks();

  const similarBlock = similar.length
    ? similar
        .slice(0, 8)
        .map((w, i) => `${i + 1}. «${w.description}» — ${w.costRubles} ₽`)
        .join("\n")
    : "(нет похожих подтверждённых записей)";

  const prompt = [
    "Ты помогаешь управляющей компании вести учёт выполненных работ по домам.",
    "Дано описание работы, которое ввёл сотрудник, и примеры похожих УЖЕ ПОДТВЕРЖДЁННЫХ записей с их стоимостью (только для ориентира по цене, не как точный ответ).",
    "",
    `Описание от сотрудника: ${input.description}`,
    `Место: ${input.location || "не указано"}`,
    `Объём: ${input.volume || "не указан"}`,
    `Материалы: ${input.materials || "не использовались"}`,
    "",
    "Похожие подтверждённые записи для ориентира по цене:",
    similarBlock,
    "",
    "Ответь СТРОГО в формате JSON без пояснений и без markdown-разметки, одним объектом вида:",
    '{"description": "краткое официальное описание работы, 1-2 предложения, деловым стилем, на русском языке", "costRubles": число (оценка стоимости в рублях) или null, если оценить невозможно}',
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return EMPTY_RESULT;
    }

    const json = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = json.content?.find((block) => block.type === "text")?.text?.trim();

    if (!text) {
      return EMPTY_RESULT;
    }

    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      return EMPTY_RESULT;
    }

    const parsed = JSON.parse(match[0]) as {
      description?: unknown;
      costRubles?: unknown;
    };

    const description =
      typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description.trim()
        : null;

    const costRubles =
      typeof parsed.costRubles === "number" &&
      Number.isFinite(parsed.costRubles) &&
      parsed.costRubles >= 0
        ? parsed.costRubles
        : null;

    return {
      description,
      costSuggestedKopecks: costRubles !== null ? Math.round(costRubles * 100) : null,
    };
  } catch {
    return EMPTY_RESULT;
  }
}
