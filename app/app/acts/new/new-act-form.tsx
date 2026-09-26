"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAct } from "../../actions/acts";

type Work = {
  id: number;
  description: string;
  location: string;
  volume: string;
  costKopecks: number | null;
  createdAt: string;
  employee: { fullName: string };
};

type Props = {
  houseId: number;
  periodFrom: string;
  periodTo: string;
  works: Work[];
};

function formatCost(costKopecks: number | null) {
  if (costKopecks === null) {
    return "—";
  }

  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(costKopecks / 100)} ₽`;
}

export default function NewActForm({ houseId, periodFrom, periodTo, works }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(
    new Set(works.map((work) => work.id)),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalKopecks = works
    .filter((work) => selected.has(work.id))
    .reduce((sum, work) => sum + (work.costKopecks ?? 0), 0);

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (selected.size === 0) {
      setError("Выберите хотя бы одну работу.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    formData.set("houseId", String(houseId));
    formData.set("periodFrom", periodFrom);
    formData.set("periodTo", periodTo);
    formData.delete("completedWorkIds");
    selected.forEach((id) => formData.append("completedWorkIds", String(id)));

    startTransition(async () => {
      const result = await createAct(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.push(`/acts/${result.actId}`);
    });
  }

  return (
    <form className="list-card" onSubmit={submit}>
      <div className="list-heading">
        <div>
          <p className="card-kicker">Подписант от Исполнителя</p>
          <h2>Данные для акта</h2>
        </div>
      </div>

      <div className="work-filter-grid">
        <div>
          <label className="field-label" htmlFor="contractor-person-role">
            Должность
          </label>
          <input
            className="text-input"
            defaultValue="Генеральный директор"
            id="contractor-person-role"
            name="contractorPersonRole"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="contractor-person-name">
            ФИО
          </label>
          <input
            className="text-input"
            id="contractor-person-name"
            name="contractorPersonName"
            type="text"
          />
        </div>
      </div>

      <div className="list-heading">
        <div>
          <p className="card-kicker">
            Работы с подтверждённой стоимостью за выбранный период
          </p>
          <h2>Что включить в акт</h2>
        </div>
        <span className="list-total">
          {selected.size} из {works.length}
        </span>
      </div>

      {works.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">
            !
          </span>
          <p>Нет работ с подтверждённой стоимостью за этот период</p>
          <span>
            Сначала подтвердите стоимость нужных работ в разделе «Выполненные
            работы».
          </span>
        </div>
      ) : (
        <ul className="record-list">
          {works.map((work) => (
            <li className="record-row" key={work.id}>
              <div className="record-mark" aria-hidden="true">
                <input
                  checked={selected.has(work.id)}
                  onChange={() => toggle(work.id)}
                  type="checkbox"
                />
              </div>
              <div className="record-main">
                <strong>{work.description}</strong>
                <span>
                  {work.location} · Объём: {work.volume}
                </span>
                <span>
                  {work.employee.fullName} ·{" "}
                  {new Intl.DateTimeFormat("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }).format(new Date(work.createdAt))}
                </span>
                <span>Стоимость: {formatCost(work.costKopecks)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="feedback error">{error}</p>}

      <div className="form-actions">
        <span className="report-total-inline">
          Сумма выбранных работ: {formatCost(totalKopecks)}
        </span>
        <button className="primary-button" disabled={isPending || works.length === 0} type="submit">
          {isPending ? "Создаём акт..." : "Создать акт"}
        </button>
      </div>
    </form>
  );
}
