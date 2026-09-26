"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeActLineItem, updateActLineItem } from "../../actions/acts";

type LineItem = {
  id: number;
  workName: string;
  periodicity: string;
  unit: string | null;
  unitCostKopecks: number | null;
  totalCostKopecks: number;
};

function formatCost(costKopecks: number) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(costKopecks / 100)} ₽`;
}

function LineItemRow({
  item,
  editable,
}: {
  item: LineItem;
  editable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const needsReview = !item.unit || item.unitCostKopecks === null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateActLineItem(item.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(`Убрать «${item.workName}» из акта?`)) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await removeActLineItem(item.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="record-row act-line-item-row">
      <form className="act-line-item-form" onSubmit={submit}>
        <div>
          <label className="field-label">Наименование вида работы</label>
          <input
            className="text-input"
            defaultValue={item.workName}
            disabled={!editable}
            name="workName"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Периодичность/показатель</label>
          <input
            className="text-input"
            defaultValue={item.periodicity}
            disabled={!editable}
            name="periodicity"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Единица измерения</label>
          <input
            className="text-input"
            defaultValue={item.unit ?? ""}
            disabled={!editable}
            name="unit"
            placeholder="напр. м², шт., усл."
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Стоимость за единицу, ₽</label>
          <input
            className="text-input"
            defaultValue={
              item.unitCostKopecks !== null
                ? (item.unitCostKopecks / 100).toFixed(2)
                : ""
            }
            disabled={!editable}
            inputMode="decimal"
            name="unitCostRubles"
            type="text"
          />
        </div>
        <div className="act-line-item-total">
          <span className="field-label">Цена, ₽</span>
          <strong>{formatCost(item.totalCostKopecks)}</strong>
        </div>
        {editable && (
          <div className="act-line-item-actions">
            <button className="secondary-button" disabled={isPending} type="submit">
              Сохранить
            </button>
            <button
              className="danger-button"
              disabled={isPending}
              onClick={remove}
              type="button"
            >
              Убрать
            </button>
          </div>
        )}
      </form>
      {needsReview && (
        <p className="act-line-item-warning">
          Требует проверки: не заполнена единица измерения и/или стоимость за
          единицу.
        </p>
      )}
      {error && <p className="feedback error">{error}</p>}
    </li>
  );
}

export default function ActLineItemsEditor({
  lineItems,
  editable,
}: {
  actId: number;
  lineItems: LineItem[];
  editable: boolean;
}) {
  const total = lineItems.reduce((sum, item) => sum + item.totalCostKopecks, 0);

  return (
    <div className="list-card">
      <div className="list-heading">
        <div>
          <p className="card-kicker">Таблица акта</p>
          <h2>Работы в акте</h2>
        </div>
        <span className="list-total">{lineItems.length}</span>
      </div>

      {lineItems.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            ▤
          </span>
          <p>В акте пока нет работ</p>
          <span>Добавьте работы ниже.</span>
        </div>
      ) : (
        <ul className="record-list">
          {lineItems.map((item) => (
            <LineItemRow editable={editable} item={item} key={item.id} />
          ))}
        </ul>
      )}

      <p className="report-total">
        <strong>Итого:</strong> {formatCost(total)}
      </p>
    </div>
  );
}
