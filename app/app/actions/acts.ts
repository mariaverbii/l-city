"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";

export type ActActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type CreateActResult =
  | { ok: true; actId: number }
  | { ok: false; error: string };

const REQUIRED_HEADER_FIELDS: Array<{
  key:
    | "number"
    | "customerName"
    | "customerBasis"
    | "agreementNumber"
    | "agreementDate"
    | "contractorPersonName"
    | "contractorPersonRole";
  label: string;
}> = [
  { key: "number", label: "номер акта" },
  { key: "customerName", label: "ФИО представителя собственников (Заказчик)" },
  { key: "customerBasis", label: "основание полномочий Заказчика" },
  { key: "agreementNumber", label: "номер договора" },
  { key: "agreementDate", label: "дата договора" },
  { key: "contractorPersonName", label: "ФИО подписанта от Исполнителя" },
  { key: "contractorPersonRole", label: "должность подписанта от Исполнителя" },
];

function parseDateInput(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();

  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function optionalText(formData: FormData, field: string, maxLength: number) {
  const raw = String(formData.get(field) ?? "").trim();

  if (!raw) {
    return null;
  }

  return raw.slice(0, maxLength);
}

async function recomputeActTotal(actId: number) {
  const total = await db.actLineItem.aggregate({
    where: { actId },
    _sum: { totalCostKopecks: true },
  });

  await db.act.update({
    where: { id: actId },
    data: { totalKopecks: total._sum.totalCostKopecks ?? 0 },
  });
}

async function assertActEditable(actId: number) {
  const act = await db.act.findUnique({
    where: { id: actId },
    select: { status: true },
  });

  if (!act) {
    return "Акт не найден.";
  }

  if (act.status === "signed") {
    return "Акт подписан и больше не может редактироваться.";
  }

  return null;
}

// Validates a set of CompletedWork ids against the "только подтверждённая
// стоимость" rule before they become act line items — the same principle
// Мария specified for the Годовой отчёт, applied here too: an act is an
// official document, so every line in it has to trace to a cost that was
// actually confirmed, never a calculated-but-unconfirmed figure.
async function validateWorksForAct(houseId: number, workIds: number[]) {
  const works = await db.completedWork.findMany({
    where: { id: { in: workIds } },
    select: {
      id: true,
      houseId: true,
      description: true,
      costConfirmed: true,
      costKopecks: true,
      actLineItem: { select: { id: true } },
    },
  });

  const found = new Map(works.map((work) => [work.id, work]));

  for (const id of workIds) {
    const work = found.get(id);

    if (!work) {
      return `Запись о работе №${id} не найдена.`;
    }

    if (work.houseId !== houseId) {
      return `Работа №${id} относится к другому дому и не может быть включена в этот акт.`;
    }

    if (work.actLineItem) {
      return `Работа №${id} уже включена в другой акт.`;
    }

    if (!work.costConfirmed || work.costKopecks === null) {
      return `Работа №${id} не может быть включена в акт: стоимость не подтверждена.`;
    }
  }

  return null;
}

export async function createAct(formData: FormData): Promise<CreateActResult> {
  const houseId = Number(formData.get("houseId"));
  const periodFrom = parseDateInput(formData.get("periodFrom"));
  const periodTo = parseDateInput(formData.get("periodTo"));
  const workIds = formData
    .getAll("completedWorkIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (!Number.isInteger(houseId) || houseId < 1) {
    return { ok: false, error: "Выберите дом." };
  }

  if (!periodFrom || !periodTo || periodFrom > periodTo) {
    return { ok: false, error: "Укажите корректный период акта." };
  }

  if (workIds.length === 0) {
    return {
      ok: false,
      error: "Выберите хотя бы одну выполненную работу с подтверждённой стоимостью.",
    };
  }

  const house = await db.house.findUnique({
    where: { id: houseId },
    select: { id: true },
  });

  if (!house) {
    return { ok: false, error: "Дом не найден." };
  }

  const validationError = await validateWorksForAct(houseId, workIds);

  if (validationError) {
    return { ok: false, error: validationError };
  }

  const works = await db.completedWork.findMany({
    where: { id: { in: workIds } },
    select: { id: true, description: true, volume: true, costKopecks: true },
  });

  try {
    const act = await db.$transaction(async (tx) => {
      const created = await tx.act.create({
        data: {
          houseId,
          periodFrom,
          periodTo,
          contractorPersonName: optionalText(formData, "contractorPersonName", 200),
          contractorPersonRole: optionalText(formData, "contractorPersonRole", 200),
          totalKopecks: works.reduce(
            (sum, work) => sum + (work.costKopecks ?? 0),
            0,
          ),
        },
      });

      await tx.actLineItem.createMany({
        data: works.map((work) => ({
          actId: created.id,
          completedWorkId: work.id,
          workName: work.description,
          periodicity: work.volume,
          totalCostKopecks: work.costKopecks ?? 0,
        })),
      });

      return created;
    });

    revalidatePath("/acts");
    return { ok: true, actId: act.id };
  } catch {
    return { ok: false, error: "Не удалось создать акт." };
  }
}

export async function addWorksToAct(
  actId: number,
  formData: FormData,
): Promise<ActActionResult> {
  const editableError = await assertActEditable(actId);

  if (editableError) {
    return { ok: false, error: editableError };
  }

  const act = await db.act.findUnique({
    where: { id: actId },
    select: { houseId: true },
  });

  if (!act) {
    return { ok: false, error: "Акт не найден." };
  }

  const workIds = formData
    .getAll("completedWorkIds")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (workIds.length === 0) {
    return { ok: false, error: "Выберите хотя бы одну работу для добавления." };
  }

  const validationError = await validateWorksForAct(act.houseId, workIds);

  if (validationError) {
    return { ok: false, error: validationError };
  }

  const works = await db.completedWork.findMany({
    where: { id: { in: workIds } },
    select: { id: true, description: true, volume: true, costKopecks: true },
  });

  try {
    await db.actLineItem.createMany({
      data: works.map((work) => ({
        actId,
        completedWorkId: work.id,
        workName: work.description,
        periodicity: work.volume,
        totalCostKopecks: work.costKopecks ?? 0,
      })),
    });
    await recomputeActTotal(actId);
    revalidatePath(`/acts/${actId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось добавить работы в акт." };
  }
}

export async function removeActLineItem(
  lineItemId: number,
): Promise<ActActionResult> {
  const lineItem = await db.actLineItem.findUnique({
    where: { id: lineItemId },
    select: { actId: true },
  });

  if (!lineItem) {
    return { ok: false, error: "Строка акта не найдена." };
  }
  
  const editableError = await assertActEditable(lineItem.actId);

  if (editableError) {
    return { ok: false, error: editableError };
  }

  try {
    await db.actLineItem.delete({ where: { id: lineItemId } });
    await recomputeActTotal(lineItem.actId);
    revalidatePath(`/acts/${lineItem.actId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось убрать строку из акта." };
  }
}

export async function updateActLineItem(
  lineItemId: number,
  formData: FormData,
): Promise<ActActionResult> {
  const lineItem = await db.actLineItem.findUnique({
    where: { id: lineItemId },
  });

  if (!lineItem) {
    return { ok: false, error: "Строка акта не найдена." };
  }

  const editableError = await assertActEditable(lineItem.actId);

  if (editableError) {
    return { ok: false, error: editableError };
  }

  const workName = String(formData.get("workName") ?? "").trim();
  const periodicity = String(formData.get("periodicity") ?? "").trim();
  const unit = optionalText(formData, "unit", 100);
  const unitCostRaw = String(formData.get("unitCostRubles") ?? "").trim();

  if (!workName || !periodicity) {
    return {
      ok: false,
      error: "Заполните наименование работы и периодичность/показатель.",
    };
  }

  let unitCostKopecks: number | null = null;

  if (unitCostRaw) {
    const normalized = unitCostRaw.replace(",", ".");

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      return { ok: false, error: "Укажите корректную стоимость за единицу." };
    }

    unitCostKopecks = Math.round(Number(normalized) * 100);
  }

  const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

  if (lineItem.unit !== unit) {
    changes.push({ field: "lineItem.unit", oldValue: lineItem.unit, newValue: unit });
  }

  if (lineItem.unitCostKopecks !== unitCostKopecks) {
    changes.push({
      field: "lineItem.unitCostKopecks",
      oldValue: lineItem.unitCostKopecks === null ? null : String(lineItem.unitCostKopecks),
      newValue: unitCostKopecks === null ? null : String(unitCostKopecks),
    });
  }

  if (lineItem.workName !== workName) {
    changes.push({ field: "lineItem.workName", oldValue: lineItem.workName, newValue: workName });
  }

  if (lineItem.periodicity !== periodicity) {
    changes.push({
      field: "lineItem.periodicity",
      oldValue: lineItem.periodicity,
      newValue: periodicity,
    });
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.actLineItem.update({
        where: { id: lineItemId },
        data: { workName, periodicity, unit, unitCostKopecks },
      });

      if (changes.length > 0) {
        await tx.actChangeLogEntry.createMany({
          data: changes.map((change) => ({ actId: lineItem.actId, ...change })),
        });
      }
    });

    revalidatePath(`/acts/${lineItem.actId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить строку акта." };
  }
}

export async function updateActHeader(
  actId: number,
  formData: FormData,
): Promise<ActActionResult> {
  const editableError = await assertActEditable(actId);

  if (editableError) {
    return { ok: false, error: editableError };
  }

  const current = await db.act.findUniqueOrThrow({ where: { id: actId } });

  const number = optionalText(formData, "number", 50);
  const signCity = optionalText(formData, "signCity", 100) ?? current.signCity;
  const customerName = optionalText(formData, "customerName", 200);
  const customerBasis = optionalText(formData, "customerBasis", 300);
  const customerApartment = optionalText(formData, "customerApartment", 20);
  const agreementNumber = optionalText(formData, "agreementNumber", 50);
  const agreementDate = parseDateInput(formData.get("agreementDate"));
  const contractorPersonName = optionalText(formData, "contractorPersonName", 200);
  const contractorPersonRole = optionalText(formData, "contractorPersonRole", 200);
  const periodFrom = parseDateInput(formData.get("periodFrom")) ?? current.periodFrom;
  const periodTo = parseDateInput(formData.get("periodTo")) ?? current.periodTo;

  if (periodFrom > periodTo) {
    return { ok: false, error: "Дата начала периода не может быть позже даты окончания." };
  }

  const changeLog: Array<{ field: string; oldValue: string | null; newValue: string | null }> =
    [];

  if (current.number !== number) {
    changeLog.push({ field: "act.number", oldValue: current.number, newValue: number });
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.act.update({
        where: { id: actId },
        data: {
          number,
          signCity,
          customerName,
          customerBasis,
          customerApartment,
          agreementNumber,
          agreementDate,
          contractorPersonName,
          contractorPersonRole,
          periodFrom,
          periodTo,
        },
      });

      if (changeLog.length > 0) {
        await tx.actChangeLogEntry.createMany({
          data: changeLog.map((entry) => ({ actId, ...entry })),
        });
      }
    });

    revalidatePath(`/acts/${actId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить данные акта." };
  }
}

export async function setActReady(actId: number): Promise<ActActionResult> {
  const act = await db.act.findUnique({
    where: { id: actId },
    include: { lineItems: true },
  });

  if (!act) {
    return { ok: false, error: "Акт не найден." };
  }

  if (act.status !== "draft") {
    return { ok: false, error: "Акт уже готов или подписан." };
  }

  const missing = REQUIRED_HEADER_FIELDS.filter(
    (field) => !act[field.key],
  ).map((field) => field.label);

  if (act.lineItems.length === 0) {
    missing.push("хотя бы одна выполненная работа в акте");
  }

  const incompleteLines = act.lineItems.filter(
    (item) => !item.unit || item.unitCostKopecks === null,
  );

  if (incompleteLines.length > 0) {
    missing.push(
      `единица измерения и стоимость за единицу для ${incompleteLines.length} ${
        incompleteLines.length === 1 ? "строки" : "строк"
      } акта`,
    );
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Акт не может быть переведён в статус «Готов» — не хватает: ${missing.join("; ")}.`,
    };
  }

  try {
    await db.act.update({ where: { id: actId }, data: { status: "ready" } });
    revalidatePath(`/acts/${actId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось изменить статус акта." };
  }
}

export async function revertActToDraft(actId: number): Promise<ActActionResult> {
  const act = await db.act.findUnique({ where: { id: actId }, select: { status: true } });

  if (!act) {
    return { ok: false, error: "Акт не найден." };
  }

  if (act.status !== "ready") {
    return { ok: false, error: "Вернуть в черновик можно только акт со статусом «Готов»." };
  }

  try {
    await db.act.update({ where: { id: actId }, data: { status: "draft" } });
    revalidatePath(`/acts/${actId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось изменить статус акта." };
  }
}

export async function markActSigned(
  actId: number,
  formData: FormData,
): Promise<ActActionResult> {
  const act = await db.act.findUnique({ where: { id: actId }, select: { status: true } });

  if (!act) {
    return { ok: false, error: "Акт не найден." };
  }
  
  if (act.status !== "ready") {
    return {
      ok: false,
      error: "Отметить подписанным можно только акт со статусом «Готов».",
    };
  }

  const signedAt = parseDateInput(formData.get("signedAt")) ?? new Date();

  try {
    await db.act.update({
      where: { id: actId },
      data: { status: "signed", signedAt },
    });
    revalidatePath(`/acts/${actId}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось отметить акт как подписанный." };
  }
}
