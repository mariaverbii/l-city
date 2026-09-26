import Link from "next/link";
import { db } from "../db";

// Force dynamic rendering: this page queries the database directly and has
// no dynamic API (no searchParams) to trigger that automatically. Without
// this, Next.js tries to statically prerender it at build time, when the
// build server cannot reach the database — causing the build to time out.
export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCost(costKopecks: number) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(costKopecks / 100)} ₽`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  ready: "Готов",
  signed: "Подписан",
};

export default async function ActsPage() {
  const [houses, acts] = await Promise.all([
    db.house.findMany({
      select: { id: true, address: true },
      orderBy: { id: "asc" },
    }),
    db.act.findMany({
      select: {
        id: true,
        number: true,
        status: true,
        periodFrom: true,
        periodTo: true,
        totalKopecks: true,
        house: { select: { address: true } },
        _count: { select: { lineItems: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Официальные документы</p>
          <h1>Акты выполненных работ</h1>
          <p className="page-description">
            Форма акта — по приказу Минстроя №761/пр
          </p>
        </div>
        <Link className="primary-button" href="/">
          ← В панель управления
        </Link>
      </header>

      <div className="list-card">
        <div className="list-heading">
          <div>
            <p className="card-kicker">Новый документ</p>
            <h2>Сформировать акт</h2>
          </div>
        </div>
        <form action="/acts/new" className="work-filter-grid" method="get">
          <div>
            <label className="field-label" htmlFor="new-act-house">
              Дом
            </label>
            <select className="text-input" id="new-act-house" name="houseId" required>
              <option disabled value="">
                Выберите дом
              </option>
              {houses.map((house) => (
                <option key={house.id} value={house.id}>
                  {house.address}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="new-act-from">
              Период с
            </label>
            <input className="text-input" id="new-act-from" name="periodFrom" required type="date" />
          </div>
          <div>
            <label className="field-label" htmlFor="new-act-to">
              Период по
            </label>
            <input className="text-input" id="new-act-to" name="periodTo" required type="date" />
          </div>
          <button className="primary-button" type="submit">
            Выбрать работы для акта
          </button>
        </form>
        <p className="field-hint">
          На следующем шаге вы выберете, какие выполненные работы с
          подтверждённой стоимостью войдут в акт.
        </p>
      </div>

      <div className="list-card">
        <div className="list-heading">
          <div>
            <p className="card-kicker">Список</p>
            <h2>Акты по домам</h2>
          </div>
          <span className="list-total">{acts.length}</span>
        </div>
        {acts.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">
              ▤
            </span>
            <p>Актов пока нет</p>
            <span>Сформируйте первый акт с помощью формы выше.</span>
          </div>
        ) : (
          <ul className="record-list">
            {acts.map((act) => (
              <li className="record-row" key={act.id}>
                <div className="record-mark" aria-hidden="true">
                  {act.number ?? "—"}
                </div>
                <div className="record-main">
                  <strong>{act.house.address}</strong>
                  <span>
                    Период: {formatDate(act.periodFrom)} — {formatDate(act.periodTo)} ·{" "}
                    {act._count.lineItems}{" "}
                    {act._count.lineItems === 1 ? "работа" : "работ"}
                  </span>
                  <span>Сумма: {formatCost(act.totalKopecks)}</span>
                  <span className={`act-status-badge act-status-${act.status}`}>
                    {STATUS_LABEL[act.status] ?? act.status}
                  </span>
                </div>
                <div className="row-actions">
                  <Link className="text-button" href={`/acts/${act.id}`}>
                    Открыть
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
