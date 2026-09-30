import Link from "next/link";
import { db } from "../db";
import NewReportForm from "./new-report-form";

// See app/app/acts/page.tsx for why this is needed: this page queries the
// database directly and has no searchParams to trigger dynamic rendering
// automatically, so without this the build tries to statically prerender it
// when the build server can't reach the database.
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  ready: "Готов",
  published: "Размещён",
};

export default async function AnnualReportsPage() {
  const [houses, reports] = await Promise.all([
    db.house.findMany({
      select: { id: true, address: true },
      orderBy: { id: "asc" },
    }),
    db.annualReport.findMany({
      select: {
        id: true,
        year: true,
        status: true,
        house: { select: { address: true } },
        _count: { select: { maintenanceItems: true, repairItems: true } },
      },
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const currentYear = new Date().getFullYear();

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Официальные документы</p>
          <h1>Годовые отчёты перед собственниками</h1>
          <p className="page-description">
            Форма отчёта — по приказу Минстроя №728/пр
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
            <h2>Сформировать отчёт за год</h2>
          </div>
        </div>
        <NewReportForm defaultYear={currentYear} houses={houses} />
        <p className="field-hint">
          Работы по содержанию и текущему ремонту система разберёт по
          разделам автоматически (по описанию) — после создания отчёта
          обязательно проверьте разбивку и заполните разделы 2–5 вручную.
        </p>
      </div>

      <div className="list-card">
        <div className="list-heading">
          <div>
            <p className="card-kicker">Список</p>
            <h2>Отчёты по домам</h2>
          </div>
          <span className="list-total">{reports.length}</span>
        </div>
        {reports.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">
              ▤
            </span>
            <p>Отчётов пока нет</p>
            <span>Сформируйте первый отчёт с помощью формы выше.</span>
          </div>
        ) : (
          <ul className="record-list">
            {reports.map((report) => (
              <li className="record-row" key={report.id}>
                <div className="record-mark" aria-hidden="true">
                  {report.year}
                </div>
                <div className="record-main">
                  <strong>{report.house.address}</strong>
                  <span>
                    {report._count.maintenanceItems} работ по содержанию ·{" "}
                    {report._count.repairItems} по ремонту
                  </span>
                  <span className={`act-status-badge act-status-${report.status === "published" ? "signed" : report.status}`}>
                    {STATUS_LABEL[report.status] ?? report.status}
                  </span>
                </div>
                <div className="row-actions">
                  <Link className="text-button" href={`/annual-reports/${report.id}`}>
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
