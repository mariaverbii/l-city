"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  moveRepairItemToMaintenance,
  updateRepairItem,
} from "../../actions/annual-reports";

type Item = {
  id: number;
  workName: string;
  basis: string | null;
  costKopecks: number;
  volumeWithUnit: string | null;
  actReference: string | null;
  categoryConfirmed: boolean;
};

function toRubles(kopecks: number) {
  return (kopecks / 100).toFixed(2);
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
      const result = await updateRepairItem(item.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function moveToMaintenance() {
    setError(null);
    startTransition(async () => {
      const result = await moveRepairItemToMaintenance(item.id);
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
          <label className="field-label">Наименование работы</label>
          <input
            className="text-input"
            defaultValue={item.workName}
            disabled={!editable}
            name="workName"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Основание проведения работы</label>
          <input
            className="text-input"
            defaultValue={item.basis ?? ""}
            disabled={!editable}
            name="basis"
            placeholder="напр. решение ОСС от ..."
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Стоимость, ₽</label>
          <input
            className="text-input"
            defaultValue={toRubles(item.costKopecks)}
            disabled={!editable}
            inputMode="decimal"
            name="costKopecks"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Объём с единицами измерения</label>
          <input
            className="text-input"
            defaultValue={item.volumeWithUnit ?? ""}
            disabled={!editable}
            name="volumeWithUnit"
            type="text"
          />
        </div>
        <div>
          <label className="field-label">Реквизиты акта / ссылка</label>
          <input
            className="text-input"
            defaultValue={item.actReference ?? ""}
            disabled={!editable}
            name="actReference"
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
              onClick={moveToMaintenance}
              title="Перенести в Раздел 1 (содержание)"
              type="button"
            >
              → Раздел 1
            </button>
          </div>
        )}
      </form>
      {!item.categoryConfirmed && (
        <p className="act-line-item-warning">
          Предложено автоматически — проверьте, что это «текущий ремонт», а
          не «содержание».
        </p>
      )}
      {error && <p className="feedback error">{error}</p>}
    </li>
  );
}

export default function RepairEditor({
  items,
  editable,
}: {
  items: Item[];
  editable: boolean;
}) {
  const total = items.reduce((sum, item) => sum + item.costKopecks, 0);

  return (
    <div className="list-card">
      <div className="list-heading">
        <div>
          <p className="card-kicker">Раздел 2</p>
          <h2>Работы по текущему ремонту</h2>
        </div>
        <span className="list-total">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            ▤
          </span>
          <p>Нет работ по текущему ремонту за этот год</p>
        </div>
      ) : (
        <ul className="record-list">
          {items.map((item) => (
            <Row editable={editable} item={item} key={item.id} />
          ))}
        </ul>
      )}

      <p className="report-total">
        <strong>Итого:</strong>{" "}
        {new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2 }).format(total / 100)} ₽
      </p>
    </div>
  );
}
