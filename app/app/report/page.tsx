import { db } from "../db";
import PrintButton from "./print-button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCost(costKopecks: number | null, costConfirmed: boolean) {
  if (!costConfirmed || costKopecks === null) {
    return "—";
  }

  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(costKopecks / 100)} ₽`;
}

function pluralize(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  }

  return many;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const houseId = parsePositiveId(getSearchParam(params, "houseId"));
  const from = parseDate(getSearchParam(params, "from"));
  const to = parseDate(getSearchParam(params, "to"));

  if (!houseId) {
    return (
      <main className="report-page">
        <p className="report-error">
          Не указан дом для отчёта. Вернитесь назад и выберите дом в форме
          отчёта.
        </p>
      </main>
    );
  }

  const house = await db.house.findUnique({
    where: { id: houseId },
    select: { id: true, address: true },
  });

  if (!house) {
    return (
      <main className="report-page">
        <p className="report-error">Дом не найден.</p>
      </main>
    );
  }

  const works = await db.completedWork.findMany({
    where: {
      houseId,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lt: getNextDate(to) } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      description: true,
      location: true,
      volume: true,
      materials: true,
      costKopecks: true,
      costConfirmed: true,
      createdAt: true,
      employee: { select: { fullName: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const totalConfirmedKopecks = works.reduce(
    (sum, work) =>
      work.costConfirmed && work.costKopecks !== null
        ? sum + work.costKopecks
        : sum,
    0,
  );
  const unconfirmedCount = works.filter((work) => !work.costConfirmed).length;
  const unconfirmedVerb =
    unconfirmedCount % 10 === 1 && unconfirmedCount % 100 !== 11
      ? "не включена"
      : "не включены";

  const periodLabel =
    from && to
      ? `${formatDate(new Date(`${from}T00:00:00.000Z`))} — ${formatDate(new Date(`${to}T00:00:00.000Z`))}`
      : from
        ? `с ${formatDate(new Date(`${from}T00:00:00.000Z`))}`
        : to
          ? `по ${formatDate(new Date(`${to}T00:00:00.000Z`))}`
          : "за весь период";

  return (
    <main className="report-page">
      <div className="report-toolbar no-print">
        <PrintButton />
      </div>

      <header className="report-header">
        <p className="report-company">ООО «Л-Сити»</p>
        <h1>Отчёт о выполненных работах</h1>
        <p className="report-meta">
          Дом: {house.address} · Период: {periodLabel}
        </p>
        <p className="report-generated">
          Сформировано: {formatDate(new Date())}
        </p>
      </header>

      {works.length === 0 ? (
        <p className="report-empty">
          За выбранный период работ по этому дому не зарегистрировано.
        </p>
      ) : (
        <table className="report-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Описание работы</th>
              <th>Место</th>
              <th>Объём</th>
              <th>Материалы</th>
              <th>Исполнитель</th>
              <th>Стоимость</th>
            </tr>
          </thead>
          <tbody>
            {works.map((work) => (
              <tr key={work.id}>
                <td>{formatDate(work.createdAt)}</td>
                <td>{work.description}</td>
                <td>{work.location}</td>
                <td>{work.volume}</td>
                <td>{work.materials || "—"}</td>
                <td>{work.employee.fullName}</td>
                <td>{formatCost(work.costKopecks, work.costConfirmed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <footer className="report-footer">
        <p className="report-total">
          <strong>Итого подтверждённая стоимость:</strong>{" "}
          {formatCost(totalConfirmedKopecks, true)}
        </p>
        {unconfirmedCount > 0 && (
          <p className="report-note">
            {unconfirmedCount}{" "}
            {pluralize(unconfirmedCount, "запись", "записи", "записей")} без
            подтверждённой стоимости {unconfirmedVerb} в итоговую сумму.
          </p>
        )}
        <p className="report-note">
          Внутренний рабочий отчёт. Не является официальным актом выполненных
          работ.
        </p>
      </footer>
    </main>
  );
}

