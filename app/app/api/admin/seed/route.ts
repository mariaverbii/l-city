import { timingSafeEqual } from "node:crypto";
import { db } from "../../../db";

// One-time, idempotent admin action requested directly by the company's
// director (in chat, not through the dashboard form) to seed the initial
// house list and her own employee record in one go, instead of clicking
// through the "add house" / "add employee" form 21+1 times by hand.
// Guarded by the same secret used for the MAX webhook setup route
// (../../max-webhook/setup/route.ts) — both are one-time server-side admin
// actions meant to be triggered once by whoever holds that secret, never
// exposed to employees or automated regularly.
const HOUSE_ADDRESSES: string[] = [
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 1",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 2",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 3",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 4",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 5",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 6",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 7",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 8",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 9",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 10",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Садовая, д. 14",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Детская, д. 1",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Детская, д. 3",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Детская, д. 5",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Ленинградская, д. 18",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Советская, д. 3",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Советская, д. 4",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Советская, д. 6",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Советская, д. 8",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Советская, д. 10",
  "Ленинградская область, Ломоносовский район, д. Лаголово, ул. Советская, д. 12",
];

const EMPLOYEES: { fullName: string; role: string; phone: string }[] = [
  {
    fullName: "Вербицкая Мария Игоревна",
    role: "генеральный директор",
    phone: "+79119290399",
  },
];

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(-10);
}

export async function GET(request: Request) {
  const secretParam = new URL(request.url).searchParams.get("secret");
  const expected = process.env.MAX_WEBHOOK_SECRET;

  if (!expected) {
    return Response.json(
      { ok: false, error: "Секрет не задан на сервере." },
      { status: 500 },
    );
  }

  if (!secretParam || !isEqual(secretParam, expected)) {
    return Response.json({ ok: false, error: "Неверный secret." }, { status: 403 });
  }

  const existingHouses = await db.house.findMany({ select: { address: true } });
  const existingAddresses = new Set(existingHouses.map((h) => h.address));
  const newHouseAddresses = HOUSE_ADDRESSES.filter(
    (address) => !existingAddresses.has(address),
  );

  if (newHouseAddresses.length > 0) {
    await db.house.createMany({
      data: newHouseAddresses.map((address) => ({ address })),
    });
  }

  const existingEmployees = await db.employee.findMany({ select: { phone: true } });
  const existingPhones = new Set(
    existingEmployees.map((e) => normalizePhone(e.phone)),
  );
  const newEmployees = EMPLOYEES.filter(
    (e) => !existingPhones.has(normalizePhone(e.phone)),
  );

  if (newEmployees.length > 0) {
    await db.employee.createMany({ data: newEmployees });
  }

  return Response.json({
    ok: true,
    housesAdded: newHouseAddresses.length,
    housesSkipped: HOUSE_ADDRESSES.length - newHouseAddresses.length,
    employeesAdded: newEmployees.length,
    employeesSkipped: EMPLOYEES.length - newEmployees.length,
  });
}

function isEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

