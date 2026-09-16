import { db } from "../../../db";
import { storage } from "../../../storage";

const contentTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  if (!key.startsWith("completed-work/")) {
    return new Response("Not found", { status: 404 });
  }

  const work = await db.completedWork.findFirst({
    where: {
      OR: [{ beforePhotoKey: key }, { afterPhotoKey: key }],
    },
    select: {
      beforePhotoKey: true,
      beforePhotoType: true,
      afterPhotoKey: true,
      afterPhotoType: true,
    },
  });

  if (!work) {
    return new Response("Not found", { status: 404 });
  }

  const result = await storage.downloadAsBytes(key);

  if (!result.ok) {
    return new Response("Not found", { status: 404 });
  }

  const extension = key.split(".").pop()?.toLowerCase() ?? "";
  const contentType =
    key === work.beforePhotoKey
      ? work.beforePhotoType
      : key === work.afterPhotoKey
        ? work.afterPhotoType
        : contentTypes[extension];

  return new Response(result.value[0] as unknown as BodyInit, {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Type": contentType ?? "application/octet-stream",
    },
  });
}