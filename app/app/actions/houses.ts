"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";

export type HouseActionResult =
  | { ok: true }
  | { ok: false; error: string };

type AddressResult = { address: string } | { error: string };

function getAddress(formData: FormData): AddressResult {
  const address = String(formData.get("address") ?? "").trim();

  if (!address) {
    return { error: "Укажите адрес дома." };
  }

  if (address.length > 200) {
    return { error: "Адрес не должен быть длиннее 200 символов." };
  }

  return { address };
}

export async function createHouse(formData: FormData): Promise<HouseActionResult> {
  const result = getAddress(formData);

  if ("error" in result) {
    return { ok: false, error: result.error };
  }

  try {
    await db.house.create({ data: { address: result.address } });
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось добавить дом. Попробуйте ещё раз." };
  }
}

export async function updateHouse(
  id: number,
  formData: FormData,
): Promise<HouseActionResult> {
  const result = getAddress(formData);

  if ("error" in result) {
    return { ok: false, error: result.error };
  }

  try {
    await db.house.update({
      where: { id },
      data: { address: result.address },
    });
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось сохранить изменения. Попробуйте ещё раз." };
  }
}

export async function deleteHouse(id: number): Promise<HouseActionResult> {
  try {
    await db.house.delete({ where: { id } });
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось удалить дом. Попробуйте ещё раз." };
  }
}