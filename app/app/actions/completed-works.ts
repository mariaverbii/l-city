"use server";

import { revalidatePath } from "next/cache";
import { db } from "../db";
import { storage } from "../storage";

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type CompletedWorkActionResult =
  | { ok: true }
  | { ok: false; error: string };

type WorkDataResult = {
  houseId: number;
  employeeId: number;
  description: string;
  location: string;
  volume: string;
  materials: string;
};

type WorkDataValidation =
  | { data: WorkDataResult }
  | { error: string };

type UploadedPhoto = {
  key: string;
  type: string;
};

function getWorkData(formData: FormData): WorkDataValidation {
  const houseId = Number(formData.get("houseId"));
  const employeeId = Number(formData.get("employeeId"));
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const volume = String(formData.get("volume") ?? "").trim();
  const materials = String(formData.get("materials") ?? "").trim();

  if (
    !Number.isInteger(houseId) ||
    houseId < 1 ||
    !Number.isInteger(employeeId) ||
    employeeId < 1
  ) {
    return { error: "Выберите дом и сотрудника." };
  }

  if (!description || !location || !volume) {
    return { error: "Заполните описание, место проведения и объём работ." };
  }

  if (
    description.length > 300 ||
    location.length > 200 ||
    volume.length > 100 ||
    materials.length > 1000
  ) {
    return { error: "Проверьте длину введённых данных." };
  }

  return {
    data: { houseId, employeeId, description, location, volume, materials },
  };
}

function getPhoto(
  formData: FormData,
  fieldName: "beforePhoto" | "afterPhoto",
) {
  const value = formData.get(fieldName);

  if (
    typeof File === "undefined" ||
    !(value instanceof File) ||
    value.size === 0
  ) {
    return null;
  }

  if (!allowedPhotoTypes.has(value.type)) {
    throw new Error("Поддерживаются только JPG, PNG и WebP.");
  }

  if (value.size > MAX_PHOTO_SIZE) {
    throw new Error("Размер каждой фотографии не должен превышать 10 МБ.");
  }

  return value;
}

function getPhotoExtension(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

async function uploadPhoto(
  file: File | null,
  side: "before" | "after",
): Promise<UploadedPhoto | null> {
  if (!file) {
    return null;
  }

  const key = `completed-work/${crypto.randomUUID()}-${side}.${getPhotoExtension(file.type)}`;
  const result = await storage.uploadFromBytes(
    key,
    Buffer.from(await file.arrayBuffer()),
  );

  if (!result.ok) {
    throw new Error("Не удалось сохранить фотографию в хранилище.");
  }

  return { key, type: file.type };
}

async function deletePhotos(photos: Array<string | null | undefined>) {
  await Promise.all(
    photos
      .filter((photo): photo is string => Boolean(photo))
      .map((photo) => storage.delete(photo, { ignoreNotFound: true })),
  );
}

async function validateRelations(houseId: number, employeeId: number) {
  const [house, employee] = await Promise.all([
    db.house.findUnique({ where: { id: houseId }, select: { id: true } }),
    db.employee.findUnique({ where: { id: employeeId }, select: { id: true } }),
  ]);

  if (!house || !employee) {
    return "Выбранный дом или сотрудник не найден.";
  }

  return null;
}

export async function createCompletedWork(
  formData: FormData,
): Promise<CompletedWorkActionResult> {
  const validation = getWorkData(formData);

  if ("error" in validation) {
    return { ok: false, error: validation.error };
  }

  const relationError = await validateRelations(
    validation.data.houseId,
    validation.data.employeeId,
  );

  if (relationError) {
    return { ok: false, error: relationError };
  }

  let beforePhoto: UploadedPhoto | null = null;
  let afterPhoto: UploadedPhoto | null = null;

  try {
    beforePhoto = await uploadPhoto(getPhoto(formData, "beforePhoto"), "before");
    afterPhoto = await uploadPhoto(getPhoto(formData, "afterPhoto"), "after");

    await db.completedWork.create({
      data: {
        ...validation.data,
        beforePhotoKey: beforePhoto?.key,
        beforePhotoType: beforePhoto?.type,
        afterPhotoKey: afterPhoto?.key,
        afterPhotoType: afterPhoto?.type,
      },
    });
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    await deletePhotos([beforePhoto?.key, afterPhoto?.key]);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось добавить запись о работе.",
    };
  }
}

export async function updateCompletedWork(
  id: number,
  formData: FormData,
): Promise<CompletedWorkActionResult> {
  const validation = getWorkData(formData);

  if ("error" in validation) {
    return { ok: false, error: validation.error };
  }

  const relationError = await validateRelations(
    validation.data.houseId,
    validation.data.employeeId,
  );

  if (relationError) {
    return { ok: false, error: relationError };
  }

  const current = await db.completedWork.findUnique({
    where: { id },
    select: {
      beforePhotoKey: true,
      afterPhotoKey: true,
    },
  });

  if (!current) {
    return { ok: false, error: "Запись о работе не найдена." };
  }

  let beforePhoto: UploadedPhoto | null = null;
  let afterPhoto: UploadedPhoto | null = null;

  try {
    beforePhoto = await uploadPhoto(getPhoto(formData, "beforePhoto"), "before");
    afterPhoto = await uploadPhoto(getPhoto(formData, "afterPhoto"), "after");

    await db.completedWork.update({
      where: { id },
      data: {
        ...validation.data,
        ...(beforePhoto
          ? {
              beforePhotoKey: beforePhoto.key,
              beforePhotoType: beforePhoto.type,
            }
          : {}),
        ...(afterPhoto
          ? {
              afterPhotoKey: afterPhoto.key,
              afterPhotoType: afterPhoto.type,
            }
          : {}),
      },
    });

    await deletePhotos([
      beforePhoto ? current.beforePhotoKey : null,
      afterPhoto ? current.afterPhotoKey : null,
    ]);
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    await deletePhotos([beforePhoto?.key, afterPhoto?.key]);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось сохранить изменения.",
    };
  }
}

export async function deleteCompletedWork(
  id: number,
): Promise<CompletedWorkActionResult> {
  const current = await db.completedWork.findUnique({
    where: { id },
    select: { beforePhotoKey: true, afterPhotoKey: true },
  });

  if (!current) {
    return { ok: false, error: "Запись о работе не найдена." };
  }

  try {
    await db.completedWork.delete({ where: { id } });
    await deletePhotos([current.beforePhotoKey, current.afterPhotoKey]);
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось удалить запись о работе." };
  }
}