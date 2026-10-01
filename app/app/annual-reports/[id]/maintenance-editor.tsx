"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  moveMaintenanceItemToRepair,
  updateMaintenanceItem,
} from "../../actions/annual-reports";

type Item = {
  id: number;
  workName: string;
  unit: string | null;
  unitPriceKopecks: number | null;
  planQuantity: number | null;
  planCostKopecks: number | null;
  actualQuantity: number | null;
  actualCostKopecks: number | null;
  categoryConfirmed: boolean;
};

function toRubles(kopecks: number | null) {
  return kopecks !== null ? (kopecks / 100).toFixed(2) : "";
}

function Row({ item, editable }: { item: Item; editable: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateMaintenanceItem(item.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function moveToRepair() {
    setError(null);
    startTransition(async () => {
      const result = await moveMaintenanceItemToRepair(item.id);
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
          <label className="field-label">Наименование работы (услуги)</label>
          <input
            className="text-input"
            defaultValue={item.workName}
            disabled={!editable}
            name="workName"
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
            placeholder="напр. м², шт."
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Цена за единицу, ₽</label>
          <input
            className="text-input"
            defaultValue={toRubles(item.unitPriceKopecks)}
            disabled={!editable}
            inputMode="decimal"
            name="unitPriceKopecks"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">По перечню — кол-во</label>
          <input
            className="text-input"
            defaultValue={item.planQuantity ?? ""}
            disabled={!editable}
            inputMode="decimal"
            name="planQuantity"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">По перечню — стоимость, ₽</label>
          <input
            className="text-input"
            defaultValue={toRubles(item.planCostKopecks)}
            disabled={!editable}
            inputMode="decimal"
            name="planCostKopecks"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Выполнено — кол-во</label>
          <input
            className="text-input"
            defaultValue={item.actualQuantity ?? ""}
            disabled={!editable}
            inputMode="decimal"
            name="actualQuantity"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Выполнено — стоимость, ₽</label>
          <input
            className="text-input"
            defaultValue={toRubles(item.actualCostKopecks)}
            disabled={!editable}
            inputMode="decimal"
            name="actualCostKopecks"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">
            <input
              defaultChecked={item.categoryConfirmed}
              disabled={!editable}
              name="categoryConfirmed"
              type="checkbox"
            />{" "}
            Раздел проверен
          </label>
        </div>
        {editable && (
          <div className="act-line-item-actions">
            <button className="secondary-button" disabled={isPending} type="submit">
              Сохранить
            </button>
            <button
              className="secondary-button"
              disabled={isPending}
              onClick={moveToRepair}
              title="Перенести в Раздел 2 (текущий ремонт)"
              type="button"
            >
              → Раздел 2
            </button>
          </div>
        )}
      </form>
      {!item.categoryConfirmed && (
        <p className="act-line-item-warning">
          Предложено автоматически — проверьте, что это «содержание», а не
          «текущий ремонт».
        </p>
      )}
      {error && <p className="feedback error">{error}</p>}
    </li>
  );
}

export default function MaintenanceEditor({
  items,
  editable,
}: {
  items: Item[];
  editable: boolean;
}) {
  const total = items.reduce((sum, item) => sum + (item.actualCostKopecks ?? 0), 0);

  return (
    <div className="list-card">
      <div className="list-heading">
        <div>
          <p className="card-kicker">Раздел 1</p>
          <h2>Работы по содержанию общего имущества</h2>
        </div>
        <span className="list-total">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            ▤
          </span>
          <p>Нет работ по содержанию за этот год</p>
        </div>
      ) : (
        <ul className="record-list">
          {items.map((item) => (
            <Row editable={editable} item={item} key={item.id} />
          ))}
        </ul>
      )}

      <p className="report-total">
        <strong>Итого выполнено:</strong>{" "}
        {new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2 }).format(total / 100)} ₽
      </p>
    </div>
  );
}
