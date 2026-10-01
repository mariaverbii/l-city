import Link from "next/link";
import { db } from "../../db";
import PrintButton from "./print-button";
import StatusControls from "./status-controls";
import HeaderEditor from "./header-editor";
import MaintenanceEditor from "./maintenance-editor";
import RepairEditor from "./repair-editor";

function formatDate(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatRub(kopecks: number | null | undefined) {
  if (kopecks === null || kopecks === undefined) return "—";
  return `${new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(kopecks / 100)} ₽`;
}

function blank(value: string | number | null | undefined, width = 30) {
  if (value === null || value === undefined) return "_".repeat(width);
  const text = String(value).trim();
  return text ? text : "_".repeat(width);
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  ready: "Готов",
  published: "Размещён",
};

export default async function AnnualReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reportId = Number(id);

  if (!Number.isInteger(reportId) || reportId < 1) {
    return (
      <main className="page-shell">
        <p className="report-error">Некорректный номер отчёта.</p>
      </main>
    );
  }

  const report = await db.annualReport.findUnique({
    where: { id: reportId },
    include: {
      house: { select: { id: true, address: true } },
      maintenanceItems: { orderBy: { id: "asc" } },
      repairItems: { orderBy: { id: "asc" } },
    },
  });

  if (!report) {
    return (
      <main className="page-shell">
        <p className="report-error">Отчёт не найден.</p>
      </main>
    );
  }

  const editable = report.status !== "published";

  const maintenanceTotal = report.maintenanceItems.reduce(
    (sum, item) => sum + (item.actualCostKopecks ?? 0),
    0,
  );
  const repairTotal = report.repairItems.reduce((sum, item) => sum + item.costKopecks, 0);

  return (
    <main className="page-shell">
      <div className="no-print">
        <header className="page-header">
          <div>
            <p className="eyebrow">Годовой отчёт · 728/пр</p>
            <h1>
              {report.house.address} — {report.year} год
            </h1>
          </div>
          <Link className="secondary-button" href="/annual-reports">
            ← К списку отчётов
          </Link>
        </header>

        <div className="act-toolbar">
          <span className={`act-status-badge act-status-${report.status === "published" ? "signed" : report.status}`}>
            {STATUS_LABEL[report.status] ?? report.status}
          </span>
          <StatusControls reportId={report.id} status={report.status} />
          <PrintButton />
        </div>

        <HeaderEditor
          editable={editable}
          report={{
            id: report.id,
            orgFullName: report.orgFullName,
            receptionAddress: report.receptionAddress,
            ogrnOrInn: report.ogrnOrInn,
            contactName: report.contactName,
            contactPhone: report.contactPhone,
            contactEmail: report.contactEmail,
            totalAreaSqm: report.totalAreaSqm,
          }}
        />

        <MaintenanceEditor editable={editable} items={report.maintenanceItems} />
        <RepairEditor editable={editable} items={report.repairItems} />

        <p className="field-hint">
          Разделы 2 (остатки на ремонт), 3, 4 и 5 система не отслеживает —
          в печатной форме ниже они оставлены пустыми для заполнения от
          руки уже в скачанном/распечатанном файле.
        </p>
      </div>

      <article className="act-print-sheet">
        <h1 className="act-print-title">ОТЧЕТ О ДЕЯТЕЛЬНОСТИ ПО УПРАВЛЕНИЮ МНОГОКВАРТИРНЫМ ДОМОМ</h1>

        <p>
          Отчет о деятельности по управлению многоквартирным домом по адресу:{" "}
          <strong>{report.house.address}</strong> за <strong>{report.year}</strong> год
        </p>
        <p className="act-print-fill">{blank(report.orgFullName, 50)}</p>
        <p className="act-print-hint">(полное наименование лица, осуществляющего управление МКД)</p>
        <p className="act-print-fill">{blank(report.receptionAddress, 50)}</p>
        <p className="act-print-hint">(адрес места приёма населения по вопросам отчёта)</p>
        <p className="act-print-fill">{blank(report.ogrnOrInn, 30)}</p>
        <p className="act-print-hint">(ОГРН/ИНН)</p>

        <p>Лицо, уполномоченное давать разъяснения по отчету:</p>
        <p className="act-print-fill">{blank(report.contactName, 40)}</p>
        <p className="act-print-fill">
          {blank(
            [report.contactPhone, report.contactEmail].filter(Boolean).join(", "),
            40,
          )}
        </p>

        <p>
          Общая площадь жилых и нежилых помещений в многоквартирном доме,
          принадлежащих собственникам (без учёта общего имущества):{" "}
          {report.totalAreaSqm !== null ? `${report.totalAreaSqm} м²` : "______ м²"}
        </p>

        <p>
          Дата размещения отчета:{" "}
          {report.publishedAt ? formatDate(report.publishedAt) : "«___» __________ ____ г."}
        </p>

        <p className="act-print-center">
          Раздел 1. За отчетный период выполнены следующие работы (оказаны
          следующие услуги) по содержанию общего имущества собственников
          помещений в многоквартирном доме:
        </p>

        <table className="act-print-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Наименование работы (услуги)</th>
              <th>Ед. изм.</th>
              <th>Цена за ед., ₽</th>
              <th>По перечню — кол-во</th>
              <th>По перечню — стоимость, ₽</th>
              <th>Выполнено — кол-во</th>
              <th>Выполнено — стоимость, ₽</th>
            </tr>
          </thead>
          <tbody>
            {report.maintenanceItems.length === 0 ? (
              <tr>
                <td className="act-print-empty" colSpan={8}>
                  Работ не выявлено
                </td>
              </tr>
            ) : (
              report.maintenanceItems.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.workName}</td>
                  <td>{item.unit ?? "—"}</td>
                  <td>{item.unitPriceKopecks !== null ? formatRub(item.unitPriceKopecks) : "—"}</td>
                  <td>{item.planQuantity ?? "—"}</td>
                  <td>{formatRub(item.planCostKopecks)}</td>
                  <td>{item.actualQuantity ?? "—"}</td>
                  <td>{formatRub(item.actualCostKopecks)}</td>
                </tr>
              ))
            )}
            <tr>
              <td colSpan={5}>
                <strong>ИТОГО</strong>
              </td>
              <td>
                <strong>
                  {formatRub(
                    report.maintenanceItems.reduce((s, i) => s + (i.planCostKopecks ?? 0), 0),
                  )}
                </strong>
              </td>
              <td>—</td>
              <td>
                <strong>{formatRub(maintenanceTotal)}</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <p className="act-print-center">
          Раздел 2. За отчетный период выполнены следующие работы по
          текущему ремонту общего имущества собственников помещений в
          многоквартирном доме:
        </p>

        <p>
          Остаток (перерасход) денежных средств на финансирование текущего
          ремонта на 1 января отчетного периода: {blank(null, 20)} ₽
        </p>
        <p>
          Общий объем денежных средств, подлежащий внесению собственниками в
          качестве платы за текущий ремонт за отчетный период: {blank(null, 20)} ₽
        </p>
        <p>
          Стоимость работ по текущему ремонту, выполненных за отчетный
          период: {formatRub(repairTotal)}
        </p>
        <p>
          Остаток (перерасход) денежных средств на финансирование текущего
          ремонта на 31 декабря отчетного периода: {blank(null, 20)} ₽
        </p>

        <table className="act-print-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Наименование работы</th>
              <th>Основание проведения работы</th>
              <th>Стоимость, ₽</th>
              <th>Объём с ед. измерения</th>
              <th>Реквизиты акта / ссылка</th>
            </tr>
          </thead>
          <tbody>
            {report.repairItems.length === 0 ? (
              <tr>
                <td className="act-print-empty" colSpan={6}>
                  Работ не выявлено
                </td>
              </tr>
            ) : (
              report.repairItems.map((item, index) => (
                <tr key={item.id}>
                  <td>{index + 1}</td>
                  <td>{item.workName}</td>
                  <td>{item.basis ?? "—"}</td>
                  <td>{formatRub(item.costKopecks)}</td>
                  <td>{item.volumeWithUnit ?? "—"}</td>
                  <td>{item.actReference ?? "—"}</td>
                </tr>
              ))
            )}
            <tr>
              <td colSpan={3}>
                <strong>ИТОГО</strong>
              </td>
              <td>
                <strong>{formatRub(repairTotal)}</strong>
              </td>
              <td>—</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>

        <p className="act-print-center">Раздел 3.</p>
        <p>
          Стоимость услуг по управлению многоквартирным домом, оказанных за
          отчетный период: {blank(null, 20)} ₽
        </p>

        <p className="act-print-center">
          Раздел 4. Сведения о претензионно-исковой работе в отношении
          собственников и нанимателей помещений в многоквартирном доме,
          имеющих задолженность по оплате за жилое помещение и (или)
          коммунальные услуги:
        </p>

        <table className="act-print-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Направлено претензий должникам</th>
              <th>Направлено исков / заявлений на суд. приказ</th>
              <th>Сумма, взысканная принудительно, ₽</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{blank(null, 10)}</td>
              <td>{blank(null, 10)}</td>
              <td>{blank(null, 15)} ₽</td>
            </tr>
          </tbody>
        </table>

        <p className="act-print-center">
          Раздел 5. Сведения о начислениях и поступлении средств от
          собственников и нанимателей помещений в многоквартирном доме за
          отчетный период:
        </p>

        <table className="act-print-table">
          <thead>
            <tr>
              <th>№</th>
              <th>Вид платежа</th>
              <th>Задолженность на начало, ₽</th>
              <th>Начислено, ₽</th>
              <th>Поступило, ₽</th>
              <th>Задолженность на 1 января след. периода, ₽</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Платежи собственников помещений в многоквартирном доме</td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Платежи нанимателей помещений в многоквартирном доме</td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
            </tr>
            <tr>
              <td colSpan={2}>
                <strong>ИТОГО</strong>
              </td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
              <td>{blank(null, 12)}</td>
            </tr>
          </tbody>
        </table>

        <p className="act-print-note">
          Форма — приложение №2 к приказу Минстроя России от 20.11.2025
          №728/пр.
        </p>
      </article>
    </main>
  );
}
