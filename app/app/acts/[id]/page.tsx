import Link from "next/link";
import { db } from "../../db";
import PrintButton from "./print-button";
import ActStatusControls from "./act-status-controls";
import ActHeaderEditor from "./act-header-editor";
import ActLineItemsEditor from "./act-line-items-editor";
import AddWorksForm from "./add-works-form";

function formatDate(date: Date | null) {
  if (!date) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function toDateInputValue(date: Date | null) {
  if (!date) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function formatCost(costKopecks: number | null) {
  if (costKopecks === null) {
    return null;
  }
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(costKopecks / 100)} ₽`;
}

function blank(value: string | null | undefined, width = 40) {
  return value && value.trim() ? value : "_".repeat(width);
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Черновик",
  ready: "Готов",
  signed: "Подписан",
};

export default async function ActPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actId = Number(id);

  if (!Number.isInteger(actId) || actId < 1) {
    return (
      <main className="page-shell">
        <p className="report-error">Некорректный номер акта.</p>
      </main>
    );
  }

  const act = await db.act.findUnique({
    where: { id: actId },
    include: {
      house: { select: { id: true, address: true } },
      lineItems: { orderBy: { id: "asc" } },
      changeLogEntries: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!act) {
    return (
      <main className="page-shell">
        <p className="report-error">Акт не найден.</p>
      </main>
    );
  }

  const eligibleWorks = await db.completedWork.findMany({
    where: {
      houseId: act.houseId,
      costConfirmed: true,
      actLineItem: { is: null },
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

  const editable = act.status !== "signed";
  const totalRublesText = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(act.totalKopecks / 100);

  return (
    <main className="page-shell">
      <div className="no-print">
        <header className="page-header">
          <div>
            <p className="eyebrow">Акт выполненных работ · 761/пр</p>
            <h1>{act.house.address}</h1>
            <p className="page-description">
              Период: {formatDate(act.periodFrom)} — {formatDate(act.periodTo)}
            </p>
          </div>
          <Link className="secondary-button" href="/acts">
            ← К списку актов
          </Link>
        </header>

        <div className="act-toolbar">
          <span className={`act-status-badge act-status-${act.status}`}>
            {STATUS_LABEL[act.status] ?? act.status}
          </span>
          <ActStatusControls actId={act.id} status={act.status} />
          <PrintButton />
        </div>

        <ActHeaderEditor
          act={{
            id: act.id,
            number: act.number,
            signCity: act.signCity,
            customerName: act.customerName,
            customerBasis: act.customerBasis,
            customerApartment: act.customerApartment,
            agreementNumber: act.agreementNumber,
            agreementDate: toDateInputValue(act.agreementDate),
            contractorPersonName: act.contractorPersonName,
            contractorPersonRole: act.contractorPersonRole,
            periodFrom: toDateInputValue(act.periodFrom),
            periodTo: toDateInputValue(act.periodTo),
          }}
          editable={editable}
        />

        <ActLineItemsEditor
          actId={act.id}
          editable={editable}
          lineItems={act.lineItems.map((item) => ({
            id: item.id,
            workName: item.workName,
            periodicity: item.periodicity,
            unit: item.unit,
            unitCostKopecks: item.unitCostKopecks,
            totalCostKopecks: item.totalCostKopecks,
          }))}
        />

        {editable && (
          <AddWorksForm
            actId={act.id}
            works={eligibleWorks.map((work) => ({
              ...work,
              createdAt: work.createdAt.toISOString(),
            }))}
          />
        )}

        {act.changeLogEntries.length > 0 && (
          <div className="list-card">
            <div className="list-heading">
              <div>
                <p className="card-kicker">Журнал изменений</p>
                <h2>История правок</h2>
              </div>
            </div>
            <ul className="change-log">
              {act.changeLogEntries.map((entry) => (
                <li key={entry.id}>
                  <span className="change-log-field">{entry.field}</span>:{" "}
                  <span className="change-log-old">{entry.oldValue ?? "—"}</span>
                  {" → "}
                  <span className="change-log-new">{entry.newValue ?? "—"}</span>
                  <span className="change-log-date">
                    {" "}
                    ({formatDate(entry.createdAt)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <article className="act-print-sheet">
        <h1 className="act-print-title">
          ФОРМА АКТА
          <br />
          ПРИЕМКИ ОКАЗАННЫХ УСЛУГ И (ИЛИ) ВЫПОЛНЕННЫХ РАБОТ ПО СОДЕРЖАНИЮ И
          ТЕКУЩЕМУ РЕМОНТУ ОБЩЕГО ИМУЩЕСТВА В МНОГОКВАРТИРНОМ ДОМЕ
        </h1>

        <p className="act-print-center">
          АКТ N {blank(act.number, 10)}
          <br />
          ПРИЕМКИ ОКАЗАННЫХ УСЛУГ И (ИЛИ) ВЫПОЛНЕННЫХ РАБОТ ПО СОДЕРЖАНИЮ И
          ТЕКУЩЕМУ РЕМОНТУ ОБЩЕГО ИМУЩЕСТВА В МНОГОКВАРТИРНОМ ДОМЕ
        </p>

        <p className="act-print-dateline">
          {act.signCity}{" "}
          <span className="act-print-fill">
            {act.signedAt ? formatDate(act.signedAt) : "«___» __________ ____ г."}
          </span>
        </p>

        <p>
          Собственники помещений в многоквартирном доме, расположенном по
          адресу: <strong>{act.house.address}</strong>, именуемые в дальнейшем
          «Заказчик», в лице{" "}
          <span className="act-print-fill">{blank(act.customerName, 50)}</span>
          {act.customerApartment && (
            <>
              , являющегося собственником квартиры N {act.customerApartment}
            </>
          )}
          , действующего на основании{" "}
          <span className="act-print-fill">{blank(act.customerBasis, 50)}</span>
          , с одной стороны, и <strong>{act.contractorName}</strong>, именуем
          в дальнейшем «Исполнитель», в лице{" "}
          <span className="act-print-fill">
            {blank(
              act.contractorPersonRole && act.contractorPersonName
                ? `${act.contractorPersonRole} ${act.contractorPersonName}`
                : act.contractorPersonName,
              50,
            )}
          </span>
          , с другой стороны, совместно именуемые «Стороны», составили
          настоящий Акт о нижеследующем.
        </p>

        <p>
          1. Исполнителем предъявлены к приемке следующие оказанные на
          основании договора управления многоквартирным домом N{" "}
          {blank(act.agreementNumber, 15)} от{" "}
          {act.agreementDate ? formatDate(act.agreementDate) : "________"} г.
          (далее — «Договор») услуги и (или) выполненные работы по
          содержанию и текущему ремонту общего имущества в многоквартирном
          доме, расположенном по адресу: {act.house.address}, за период с{" "}
          {formatDate(act.periodFrom)} по {formatDate(act.periodTo)}:
        </p>

        <table className="act-print-table">
          <thead>
            <tr>
              <th>Наименование вида работы (услуги)</th>
              <th>
                Периодичность/количественный показатель выполненной работы
                (оказанной услуги)
              </th>
              <th>Единица измерения работы (услуги)</th>
              <th>
                Стоимость / сметная стоимость выполненной работы (оказанной
                услуги) за единицу
              </th>
              <th>Цена выполненной работы (оказанной услуги), в рублях</th>
            </tr>
          </thead>
          <tbody>
            {act.lineItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="act-print-empty">
                  Работы не выбраны
                </td>
              </tr>
            ) : (
              act.lineItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.workName}</td>
                  <td>{item.periodicity}</td>
                  <td>{item.unit ?? "—"}</td>
                  <td>{formatCost(item.unitCostKopecks) ?? "—"}</td>
                  <td>{formatCost(item.totalCostKopecks)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <p>
          2. Всего за период с {formatDate(act.periodFrom)} по{" "}
          {formatDate(act.periodTo)} выполнено работ (оказано услуг) на общую
          сумму {totalRublesText} рублей.
        </p>

        <p>
          3. Работы (услуги) выполнены (оказаны) полностью, в установленные
          сроки, с надлежащим качеством.
        </p>

        <p>4. Претензий по выполнению условий Договора Стороны друг к другу не имеют.</p>

        <p>
          Настоящий Акт составлен в 2-х экземплярах, имеющих одинаковую
          юридическую силу, по одному для каждой из Сторон.
        </p>
        
        <p className="act-print-center">Подписи Сторон:</p>

        <table className="act-print-signatures">
          <tbody>
            <tr>
              <td>Исполнитель —</td>
              <td className="act-print-fill">
                {blank(
                  act.contractorPersonRole && act.contractorPersonName
                    ? `${act.contractorPersonRole}, ${act.contractorPersonName}`
                    : act.contractorPersonName,
                  40,
                )}
              </td>
              <td className="act-print-fill">{"_".repeat(20)}</td>
            </tr>
            <tr>
              <td className="act-print-hint" colSpan={2}>
                &nbsp;
              </td>
              <td className="act-print-hint">(подпись)</td>
            </tr>
            <tr>
              <td>Заказчик —</td>
              <td className="act-print-fill">{blank(act.customerName, 40)}</td>
              <td className="act-print-fill">{"_".repeat(20)}</td>
            </tr>
            <tr>
              <td className="act-print-hint" colSpan={2}>
                &nbsp;
              </td>
              <td className="act-print-hint">(подпись)</td>
            </tr>
          </tbody>
        </table>

        <p className="act-print-note">
          Форма — приложение к приказу Минстроя России от 26.10.2015 №761/пр.
        </p>
      </article>
    </main>
  );
}
