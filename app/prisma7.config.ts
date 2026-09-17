import { defineConfig } from "prisma/config";

// Prefer a single DATABASE_URL when present (e.g. local development).
// In production, the connection is built here, in code, from discrete
// DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME parameters and properly
// percent-encoded with encodeURIComponent. This avoids storing a
// pre-encoded connection string as a single environment variable on the
// hosting platform, whose UI silently URL-decodes percent-encoded
// characters on save and would corrupt a password containing special
// characters embedded in a URL.
function buildDatabaseUrl(): string | undefined {
  if (process.env["DATABASE_URL"]) {
    return process.env["DATABASE_URL"];
  }

  const host = process.env["DB_HOST"];
  const port = process.env["DB_PORT"] ?? "5432";
  const user = process.env["DB_USER"];
  const password = process.env["DB_PASSWORD"];
  const database = process.env["DB_NAME"];

  if (!host || !user || !password || !database) {
    return undefined;
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: buildDatabaseUrl(),
  },
});
