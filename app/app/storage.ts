import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.S3_REGION || "ru-1",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  },
});

const bucket = process.env.S3_BUCKET ?? "";

type UploadResult = { ok: true } | { ok: false; error: unknown };
type DownloadResult =
  | { ok: true; value: [Buffer] }
  | { ok: false; error: unknown };
type DeleteOptions = { ignoreNotFound?: boolean };

async function uploadFromBytes(
  key: string,
  bytes: Buffer,
): Promise<UploadResult> {
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
      }),
    );
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

async function downloadAsBytes(key: string): Promise<DownloadResult> {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    const bytes = await result.Body?.transformToByteArray();

    if (!bytes) {
      return { ok: false, error: new Error("Пустой ответ от хранилища") };
    }

    return { ok: true, value: [Buffer.from(bytes)] };
  } catch (error) {
    return { ok: false, error };
  }
}

async function deleteObject(
  key: string,
  options?: DeleteOptions,
): Promise<UploadResult> {
  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return { ok: true };
  } catch (error) {
    if (options?.ignoreNotFound) {
      return { ok: true };
    }

    return { ok: false, error };
  }
}

export const storage = {
  uploadFromBytes,
  downloadAsBytes,
  delete: deleteObject,
};
