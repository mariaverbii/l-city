import Link from "next/link";
import { db } from "../../db";
import NewActForm from "./new-act-form";

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
  return value;
}

export default async function NewActPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const houseId = parsePositiveId(getSearchParam(params, "houseId"));
  const periodFrom = parseDate(getSearchParam(params, "periodFrom"));
  const periodTo = parseDate(getSearchParam(params, "periodTo"));

  if (!houseId || !periodFrom || !periodTo) {
    return (
      <main className="page-shell">
        <p className="report-error">
          Не указан дом или период. Вернитесь к списку актов и заполните форму.
        </p>
        <Link className="primary-button" href="/acts">
          ← К списку актов
        </Link>
      </main>
    );
  }

  const house = await db.house.findUnique({
    where: { id: houseId },
    select: { id: true, address: true },
  });

  if (!house) {
    return (
      <main className="page-shell">
        <p className="report-error">Дом не найден.</p>
      </main>
    );
  }

  // Eligible = confirmed cost, within the chosen period, not already used
  // in another act's line item — exactly the works this act is allowed to
  // include per the "только подтверждённая стоимость" rule.
  const eligibleWorks = await db.completedWork.findMany({
    where: {
      houseId,
      costConfirmed: true,
      actLineItem: { is: null },
      createdAt: {
        gte: new Date(`${periodFrom}T00:00:00.000Z`),
        lt: (() => {
          const date = new Date(`${periodTo}T00:00:00.000Z`);
          date.setUTCDate(date.getUTCDate() + 1);
          return date;
        })(),
      },
    },
    select: {
      id: true,
      description: true,
      location: true,
      volume: true,
      costKopecks: true,
      createdAt: true,
      employee: { select: { fullName: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const unconfirmedCount = await db.completedWork.count({
    where: {
      houseId,
      costConfirmed: false,
      createdAt: {
        gte: new Date(`${periodFrom}T00:00:00.000Z`),
        lt: (() => {
          const date = new Date(`${periodTo}T00:00:00.000Z`);
          date.setUTCDate(date.getUTCDate() + 1);
          return date;
        })(),
      },
    },
  });

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Новый акт</p>
          <h1>{house.address}</h1>
          <p className="page-description">
            Период: {periodFrom} — {periodTo}
          </p>
        </div>
        <Link className="secondary-button" href="/acts">
          ← К списку актов
        </Link>
      </header>

      {unconfirmedCount > 0 && (
        <p className="feedback error">
          В этом периоде есть {unconfirmedCount}{" "}
          {unconfirmedCount === 1 ? "работа" : "работ"} без подтверждённой
          стоимости — они не показаны ниже и не могут быть включены в акт,
          пока стоимость не подтверждена в разделе «Выполненные работы».
        </p>
      )}

      <NewActForm
        houseId={houseId}
        periodFrom={periodFrom}
        periodTo={periodTo}
        works={eligibleWorks.map((work) => ({
          ...work,
          createdAt: work.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
