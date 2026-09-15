"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";

export type EmployeeActionResult =
  | { ok: true }
  | { ok: false; error: string };

type EmployeeDataResult =
  | { fullName: string; role: string; phone: string }
  | { error: string };

function getEmployeeData(formData: FormData): EmployeeDataResult {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName || !role || !phone) {
    return { error: "Заполните все поля сотрудника." };
  }

  if (fullName.length > 120 || role.length > 120 || phone.length > 40) {
    return { error: "Проверьте длину введённых данных." };
  }

  return { fullName, role, phone };
}

export async function createEmployee(
  formData: FormData,
): Promise<EmployeeActionResult> {
  const result = getEmployeeData(formData);

  if ("error" in result) {
    return { ok: false, error: result.error };
  }

  try {
    await db.employee.create({ data: result });
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось добавить сотрудника. Попробуйте ещё раз." };
  }
}

export async function updateEmployee(
  id: number,
  formData: FormData,
): Promise<EmployeeActionResult> {
  const result = getEmployeeData(formData);

  if ("error" in result) {
    return { ok: false, error: result.error };
  }

  try {
    await db.employee.update({
      where: { id },
      data: result,
    });
    revalidatePath("/");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Не удалось сохранить изменения. Попробуйте ещё раз.",
    };
  }
}

export async function deleteEmployee(id: number): Promise<EmployeeActionResult> {
  try {
    await db.employee.delete({ where: { id } });
    revalidatePath("/");
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Не удалось удалить сотрудника. Попробуйте ещё раз.",
    };
  }
}