import { db } from "./db";
import Dashboard from "./dashboard";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

type DashboardTab = "houses" | "employees" | "works";

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveId(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function parseDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : "";
}

function getNextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

type CostStatus = "all" | "none" | "calculated" | "confirmed";

function parseCostStatus(value: string | undefined): CostStatus {
  return value === "none" || value === "calculated" || value === "confirmed"
    ? value
    : "all";
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const houseId = parsePositiveId(getSearchParam(params, "houseId"));
  const employeeId = parsePositiveId(getSearchParam(params, "employeeId"));
  const from = parseDate(getSearchParam(params, "from"));
  const to = parseDate(getSearchParam(params, "to"));
  const costStatus = parseCostStatus(getSearchParam(params, "costStatus"));
  const requestedTab = getSearchParam(params, "tab");
  const initialTab: DashboardTab =
    requestedTab === "employees" || requestedTab === "works"
      ? requestedTab
      : "houses";

  const completedWorkWhere = {
    ...(houseId ? { houseId } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from
              ? { gte: new Date(`${from}T00:00:00.000Z`) }
              : {}),
            ...(to ? { lt: getNextDate(to) } : {}),
          },
        }
      : {}),
    ...(costStatus === "none"
      ? { costKopecks: null }
      : costStatus === "calculated"
        ? { costKopecks: { not: null }, costConfirmed: false }
        : costStatus === "confirmed"
          ? { costConfirmed: true }
          : {}),
  };

  const [houses, employees, completedWorks] = await Promise.all([
    db.house.findMany({
      select: { id: true, address: true },
      orderBy: { id: "asc" },
    }),
    db.employee.findMany({
      select: { id: true, fullName: true, role: true, phone: true },
      orderBy: { id: "asc" },
    }),
    db.completedWork.findMany({
      where: completedWorkWhere,
      select: {
        id: true,
        description: true,
        location: true,
        volume: true,
        materials: true,
        beforePhotoKey: true,
        afterPhotoKey: true,
        costKopecks: true,
        costConfirmed: true,
        createdAt: true,
        house: { select: { id: true, address: true } },
        employee: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <Dashboard
      completedWorks={completedWorks}
      employees={employees}
      houses={houses}
      initialTab={initialTab}
      workFilters={{
        costStatus,
        employeeId: employeeId ? String(employeeId) : "",
        from,
        houseId: houseId ? String(houseId) : "",
        to,
      }}
    />
  );
}
