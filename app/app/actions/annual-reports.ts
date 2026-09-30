"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";

export type AnnualReportActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type CreateAnnualReportResult =
  | { ok: true; reportId: number }
  | { ok: false; error: string };

const REQUIRED_HEADER_FIELDS: Array<{
  key:
    | "orgFullName"
    | "receptionAddress"
    | "ogrnOrInn"
    | "contactName"
    | "contactPhone"
    | "totalAreaSqm"
    | "repairBalanceOpeningKopecks"
    | "repairDueFromOwnersKopecks"
    | "repairBalanceClosingKopecks"
    | "managementServiceCostKopecks"
    | "claimsSentCount"
    | "lawsuitsSentCount"
    | "recoveredKopecks";
  label: string;
}> = [
  { key: "orgFullName", label: "полное наименование организации" },
  { key: "receptionAddress", label: "адрес приёма населения" },
  { key: "ogrnOrInn", label: "ОГРН/ИНН" },
  { key: "contactName", label: "ФИО и должность ответственного лица" },
  { key: "contactPhone", label: "телефон ответственного лица" },
  { key: "totalAreaSqm", label: "общая площадь помещений в доме" },
  { key: "repairBalanceOpeningKopecks", label: "остаток средств на текущий ремонт на 1 января (Раздел 2)" },
  { key: "repairDueFromOwnersKopecks", label: "сумма к внесению на текущий ремонт за период (Раздел 2)" },
  { key: "repairBalanceClosingKopecks", label: "остаток средств на текущий ремонт на 31 декабря (Раздел 2)" },
  { key: "managementServiceCostKopecks", label: "стоимость услуг по управлению (Раздел 3)" },
  { key: "claimsSentCount", label: "количество претензий должникам (Раздел 4)" },
  { key: "lawsuitsSentCount", label: "количество исковых заявлений (Раздел 4)" },
  { key: "recoveredKopecks", label: "сумма, взысканная принудительно (Раздел 4)" },
];

// Простая эвристика "что предложить" для разделения работ между Разделом 1
// (содержание) и Разделом 2 (текущий ремонт) — см. docs/regulatory/
// prikaz-728pr-godovoy-otchet.md. Это ТОЛЬКО предложение: каждая строка
// остаётся со статусом categoryConfirmed=false, пока Мария не проверит её
// сама, и отчёт нельзя перевести в "ready", пока не проверены все строки —
// см. setAnnualReportReady. Список ключевых слов не исчерпывающий и может
// ошибаться, поэтому в него специально не заложено ничего решающего для
// самого текста отчёта, только начальная сортировка строк по разделам.
const REPAIR_KEYWORDS = [
  "ремонт кровл",
  "ремонт крыш",
  "замена кровл",
  "капитальн",
  "замена труб",
  "замена стояк",
  "замена окон",
  "замена двер",
  "замена лифт",
  "ремонт лифт",
  "демонтаж",
  "монтаж",
  "реконструкц",
  "восстановлен",
  "отмостк",
  "ремонт фасад",
  "утепление фасад",
  "герметизац",
  "замена электропровод",
  "замена кабел",
  "ремонт систем",
  "ремонт подъезд",
  "покраска фасад",
];

function classifyWork(description: string): "maintenance" | "repair" {
  const normalized = description.toLowerCase().replace(/ё/g, "е");
  const isRepair = REPAIR_KEYWORDS.some((keyword) => normalized.includes(keyword));
  return isRepair ? "repair" : "maintenance";
}

function optionalText(formData: FormData, field: string, maxLength: number) {
  const raw = String(formData.get(field) ?? "").trim();
  return raw ? raw.slice(0, maxLength) : null;
}

function optionalKopecks(formData: FormData, field: string): number | null | "invalid" {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return "invalid";
  return Math.round(Number(normalized) * 100);
}

function optionalInt(formData: FormData, field: string): number | null | "invalid" {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return "invalid";
  return Number(raw);
}

function optionalFloat(formData: FormData, field: string): number | null | "invalid" {
  const raw = String(formData.get(field) ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return "invalid";
  return Number(normalized);
}

async function assertReportEditable(reportId: number) {
  const report = await db.annualReport.findUnique({
    where: { id: reportId },
    select: { status: true },
  });

  if (!report) {
    return "Отчёт не найден.";
  }

  if (report.status === "published") {
    return "Отчёт уже опубликован и больше не может редактироваться.";
  }

  return null;
}

export async function createAnnualReport(
  formData: FormData,
): Promise<CreateAnnualReportResult> {
  const houseId = Number(formData.get("houseId"));
  const year = Number(formData.get("year"));

  if (!Number.isInteger(houseId) || houseId < 1) {
    return { ok: false, error: "Выберите дом." };
  }

  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return { ok: false, error: "Укажите корректный год." };
  }

  const house = await db.house.findUnique({ where: { id: houseId }, select: { id: true } });

  if (!house) {
    return { ok: false, error: "Дом не найден." };
  }

  const existing = await db.annualReport.findUnique({
    where: { houseId_year: { houseId, year } },
    select: { id: true },
  });

  if (existing) {
    return { ok: false, error: `Отчёт за ${year} год по этому дому уже создан.` };
  }

  // Реквизиты компании (шапка формы) не меняются от дома к дому — берём их
  // из самого свежего уже существующего отчёта, если такой есть, чтобы не
  // вводить заново. Если отчётов ещё не было, поля остаются пустыми —
  // "ОГРН/ИНН" и адрес приёма населения система не может выдумать сама.
  const mostRecentReport = await db.annualReport.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      orgFullName: true,
      receptionAddress: true,
      ogrnOrInn: true,
      contactName: true,
      contactPhone: true,
      contactEmail: true,
    },
  });

  const works = await db.completedWork.findMany({
    where: {
      houseId,
      costConfirmed: true,
      annualReportMaintenanceItem: { is: null },
      annualReportRepairItem: { is: null },
      createdAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    select: {
      id: true,
      description: true,
      volume: true,
      costKopecks: true,
      actLineItem: {
        select: {
          act: { select: { number: true } },
        },
      },
    },
  });

  try {
    const report = await db.$transaction(async (tx) => {
      const created = await tx.annualReport.create({
        data: {
          houseId,
          year,
          orgFullName: mostRecentReport?.orgFullName ?? "ООО «Л-Сити»",
          receptionAddress: mostRecentReport?.receptionAddress ?? null,
          ogrnOrInn: mostRecentReport?.ogrnOrInn ?? null,
          contactName: mostRecentReport?.contactName ?? null,
          contactPhone: mostRecentReport?.contactPhone ?? null,
          contactEmail: mostRecentReport?.contactEmail ?? null,
        },
      });

      for (const work of works) {
        const category = classifyWork(work.description);
        const costKopecks = work.costKopecks ?? 0;

        if (category === "repair") {
          await tx.annualReportRepairItem.create({
            data: {
              reportId: created.id,
              completedWorkId: work.id,
              workName: work.description,
              costKopecks,
              volumeWithUnit: work.volume,
              actReference: work.actLineItem?.act.number
                ? `Акт №${work.actLineItem.act.number}`
                : null,
            },
          });
        } else {
          await tx.annualReportMaintenanceItem.create({
            data: {
              reportId: created.id,
              completedWorkId: work.id,
              workName: work.description,
              actualQuantity: null,
              actualCostKopecks: costKopecks,
              planCostKopecks: costKopecks,
            },
          });
        }
      }

      await tx.annualReportBillingRow.createMany({
        data: [
          { reportId: created.id, category: "owners" },
          { reportId: created.id, category: "tenants" },
        ],
      });

      return created;
    });

    revalidatePath("/annual-reports");
    return { ok: true, reportId: report.id };
  } catch {
    return { ok: false, error: "Не удалось создать отчёт." };
  }
}

export async function updateAnnualReportHeader(
  reportId: number,
  formData: FormData,
): Promise<AnnualReportActionResult> {
  const editableError = await assertReportEditable(reportId);
  if (editableError) return { ok: false, error: editableError };

  const totalAreaSqm = optionalFloat(formData, "totalAreaSqm");
  if (totalAreaSqm === "invalid") {
    return { ok: false, error: "Укажите корректную площадь (число)." };
  }

  try {
    await db.annualReport.update({
      where: { id: reportId },
      data: {
        orgFullName: optionalText(formData, "orgFullName", 300),
        receptionAddress: optionalText(formData, "receptionAddress", 300),
        ogrnOrInn: optionalText(formData, "ogrnOrInn", 50),
        contactName: optionalText(formData, "contactName", 200),
        contactPhone: optionalText(formData, "contactPhone", 50),
        contactEmail: optionalText(formData, "contactEmail", 200),
        totalAreaSqm,
      },
    });
    revalidatePath(`/annual-reports/${reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить реквизиты отчёта." };
  }
}

export async function updateAnnualReportFinancials(
  reportId: number,
  formData: FormData,
): Promise<AnnualReportActionResult> {
  const editableError = await assertReportEditable(reportId);
  if (editableError) return { ok: false, error: editableError };

  const repairBalanceOpeningKopecks = optionalKopecks(formData, "repairBalanceOpeningKopecks");
  const repairDueFromOwnersKopecks = optionalKopecks(formData, "repairDueFromOwnersKopecks");
  const repairBalanceClosingKopecks = optionalKopecks(formData, "repairBalanceClosingKopecks");
  const managementServiceCostKopecks = optionalKopecks(formData, "managementServiceCostKopecks");
  const claimsSentCount = optionalInt(formData, "claimsSentCount");
  const lawsuitsSentCount = optionalInt(formData, "lawsuitsSentCount");
  const recoveredKopecks = optionalKopecks(formData, "recoveredKopecks");

  const values = [
    repairBalanceOpeningKopecks,
    repairDueFromOwnersKopecks,
    repairBalanceClosingKopecks,
    managementServiceCostKopecks,
    claimsSentCount,
    lawsuitsSentCount,
    recoveredKopecks,
  ];

  if (values.includes("invalid")) {
    return { ok: false, error: "Проверьте введённые суммы и количества — где-то некорректное значение." };
  }

  try {
    await db.annualReport.update({
      where: { id: reportId },
      data: {
        repairBalanceOpeningKopecks: repairBalanceOpeningKopecks as number | null,
        repairDueFromOwnersKopecks: repairDueFromOwnersKopecks as number | null,
        repairBalanceClosingKopecks: repairBalanceClosingKopecks as number | null,
        managementServiceCostKopecks: managementServiceCostKopecks as number | null,
        claimsSentCount: claimsSentCount as number | null,
        lawsuitsSentCount: lawsuitsSentCount as number | null,
        recoveredKopecks: recoveredKopecks as number | null,
      },
    });
    revalidatePath(`/annual-reports/${reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить финансовые данные отчёта." };
  }
}

export async function updateBillingRow(
  rowId: number,
  formData: FormData,
): Promise<AnnualReportActionResult> {
  const row = await db.annualReportBillingRow.findUnique({
    where: { id: rowId },
    select: { reportId: true },
  });

  if (!row) return { ok: false, error: "Строка не найдена." };

  const editableError = await assertReportEditable(row.reportId);
  if (editableError) return { ok: false, error: editableError };

  const openingDebtKopecks = optionalKopecks(formData, "openingDebtKopecks");
  const accruedKopecks = optionalKopecks(formData, "accruedKopecks");
  const receivedKopecks = optionalKopecks(formData, "receivedKopecks");
  const closingDebtKopecks = optionalKopecks(formData, "closingDebtKopecks");

  if ([openingDebtKopecks, accruedKopecks, receivedKopecks, closingDebtKopecks].includes("invalid")) {
    return { ok: false, error: "Проверьте введённые суммы." };
  }

  try {
    await db.annualReportBillingRow.update({
      where: { id: rowId },
      data: {
        openingDebtKopecks: openingDebtKopecks as number | null,
        accruedKopecks: accruedKopecks as number | null,
        receivedKopecks: receivedKopecks as number | null,
        closingDebtKopecks: closingDebtKopecks as number | null,
      },
    });
    revalidatePath(`/annual-reports/${row.reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить строку начислений." };
  }
}

export async function updateMaintenanceItem(
  itemId: number,
  formData: FormData,
): Promise<AnnualReportActionResult> {
  const item = await db.annualReportMaintenanceItem.findUnique({
    where: { id: itemId },
    select: { reportId: true },
  });

  if (!item) return { ok: false, error: "Строка не найдена." };

  const editableError = await assertReportEditable(item.reportId);
  if (editableError) return { ok: false, error: editableError };

  const workName = String(formData.get("workName") ?? "").trim();
  if (!workName) {
    return { ok: false, error: "Укажите наименование работы." };
  }

  const unit = optionalText(formData, "unit", 100);
  const unitPriceKopecks = optionalKopecks(formData, "unitPriceKopecks");
  const planQuantity = optionalFloat(formData, "planQuantity");
  const planCostKopecks = optionalKopecks(formData, "planCostKopecks");
  const actualQuantity = optionalFloat(formData, "actualQuantity");
  const actualCostKopecks = optionalKopecks(formData, "actualCostKopecks");
  const categoryConfirmed = formData.get("categoryConfirmed") === "on";

  if (
    [unitPriceKopecks, planCostKopecks, actualCostKopecks].includes("invalid") ||
    [planQuantity, actualQuantity].includes("invalid")
  ) {
    return { ok: false, error: "Проверьте введённые числа." };
  }

  try {
    await db.annualReportMaintenanceItem.update({
      where: { id: itemId },
      data: {
        workName,
        unit,
        unitPriceKopecks: unitPriceKopecks as number | null,
        planQuantity: planQuantity as number | null,
        planCostKopecks: planCostKopecks as number | null,
        actualQuantity: actualQuantity as number | null,
        actualCostKopecks: actualCostKopecks as number | null,
        categoryConfirmed,
      },
    });
    revalidatePath(`/annual-reports/${item.reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить строку." };
  }
}

export async function updateRepairItem(
  itemId: number,
  formData: FormData,
): Promise<AnnualReportActionResult> {
  const item = await db.annualReportRepairItem.findUnique({
    where: { id: itemId },
    select: { reportId: true },
  });

  if (!item) return { ok: false, error: "Строка не найдена." };

  const editableError = await assertReportEditable(item.reportId);
  if (editableError) return { ok: false, error: editableError };

  const workName = String(formData.get("workName") ?? "").trim();
  if (!workName) {
    return { ok: false, error: "Укажите наименование работы." };
  }

  const costRaw = optionalKopecks(formData, "costKopecks");
  if (costRaw === "invalid" || costRaw === null) {
    return { ok: false, error: "Укажите корректную стоимость работы." };
  }

  const categoryConfirmed = formData.get("categoryConfirmed") === "on";

  try {
    await db.annualReportRepairItem.update({
      where: { id: itemId },
      data: {
        workName,
        basis: optionalText(formData, "basis", 300),
        costKopecks: costRaw,
        volumeWithUnit: optionalText(formData, "volumeWithUnit", 200),
        actReference: optionalText(formData, "actReference", 300),
        categoryConfirmed,
      },
    });
    revalidatePath(`/annual-reports/${item.reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить строку." };
  }
}

// Переносит строку из Раздела 1 в Раздел 2 или обратно — на случай если
// автоматическая подсказка ошиблась. Основные поля переносятся,
// специфичные для раздела (план/факт или основание/акт) начинаются заново
// пустыми — заполнить их можно сразу после переноса.
export async function moveMaintenanceItemToRepair(itemId: number): Promise<AnnualReportActionResult> {
  const item = await db.annualReportMaintenanceItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Строка не найдена." };

  const editableError = await assertReportEditable(item.reportId);
  if (editableError) return { ok: false, error: editableError };

  try {
    await db.$transaction(async (tx) => {
      await tx.annualReportRepairItem.create({
        data: {
          reportId: item.reportId,
          completedWorkId: item.completedWorkId,
          workName: item.workName,
          costKopecks: item.actualCostKopecks ?? 0,
          volumeWithUnit: null,
        },
      });
      await tx.annualReportMaintenanceItem.delete({ where: { id: itemId } });
    });
    revalidatePath(`/annual-reports/${item.reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось перенести строку в Раздел 2." };
  }
}

export async function moveRepairItemToMaintenance(itemId: number): Promise<AnnualReportActionResult> {
  const item = await db.annualReportRepairItem.findUnique({ where: { id: itemId } });
  if (!item) return { ok: false, error: "Строка не найдена." };

  const editableError = await assertReportEditable(item.reportId);
  if (editableError) return { ok: false, error: editableError };

  try {
    await db.$transaction(async (tx) => {
      await tx.annualReportMaintenanceItem.create({
        data: {
          reportId: item.reportId,
          completedWorkId: item.completedWorkId,
          workName: item.workName,
          actualCostKopecks: item.costKopecks,
          planCostKopecks: item.costKopecks,
        },
      });
      await tx.annualReportRepairItem.delete({ where: { id: itemId } });
    });
    revalidatePath(`/annual-reports/${item.reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось перенести строку в Раздел 1." };
  }
}

export async function setAnnualReportReady(reportId: number): Promise<AnnualReportActionResult> {
  const report = await db.annualReport.findUnique({
    where: { id: reportId },
    include: { maintenanceItems: true, repairItems: true, billingRows: true },
  });

  if (!report) return { ok: false, error: "Отчёт не найден." };

  if (report.status !== "draft") {
    return { ok: false, error: "Отчёт уже готов или опубликован." };
  }

  const missing = REQUIRED_HEADER_FIELDS.filter((field) => {
    const value = report[field.key];
    return value === null || value === undefined;
  }).map((field) => field.label);

  const unconfirmed =
    report.maintenanceItems.filter((item) => !item.categoryConfirmed).length +
    report.repairItems.filter((item) => !item.categoryConfirmed).length;

  if (unconfirmed > 0) {
    missing.push(
      `проверка раздела (содержание/ремонт) для ${unconfirmed} ${
        unconfirmed === 1 ? "строки" : "строк"
      }`,
    );
  }

  const billingIncomplete = report.billingRows.some(
    (row) =>
      row.openingDebtKopecks === null ||
      row.accruedKopecks === null ||
      row.receivedKopecks === null ||
      row.closingDebtKopecks === null,
  );

  if (billingIncomplete) {
    missing.push("начисления и поступления по собственникам/нанимателям (Раздел 5)");
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Отчёт не может быть переведён в статус «Готов» — не хватает: ${missing.join("; ")}.`,
    };
  }

  try {
    await db.annualReport.update({ where: { id: reportId }, data: { status: "ready" } });
    revalidatePath(`/annual-reports/${reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось изменить статус отчёта." };
  }
}

export async function revertAnnualReportToDraft(reportId: number): Promise<AnnualReportActionResult> {
  const report = await db.annualReport.findUnique({ where: { id: reportId }, select: { status: true } });
  if (!report) return { ok: false, error: "Отчёт не найден." };

  if (report.status !== "ready") {
    return { ok: false, error: "Вернуть в черновик можно только отчёт со статусом «Готов»." };
  }

  try {
    await db.annualReport.update({ where: { id: reportId }, data: { status: "draft" } });
    revalidatePath(`/annual-reports/${reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось изменить статус отчёта." };
  }
}

export async function publishAnnualReport(
  reportId: number,
  formData: FormData,
): Promise<AnnualReportActionResult> {
  const report = await db.annualReport.findUnique({ where: { id: reportId }, select: { status: true } });
  if (!report) return { ok: false, error: "Отчёт не найден." };

  if (report.status !== "ready") {
    return { ok: false, error: "Отметить размещённым можно только отчёт со статусом «Готов»." };
  }

  const raw = String(formData.get("publishedAt") ?? "").trim();
  const publishedAt = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T00:00:00.000Z`) : new Date();

  try {
    await db.annualReport.update({
      where: { id: reportId },
      data: { status: "published", publishedAt },
    });
    revalidatePath(`/annual-reports/${reportId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось отметить отчёт размещённым." };
  }
}
