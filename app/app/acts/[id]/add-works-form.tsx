"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addWorksToAct } from "../../actions/acts";

type Work = {
  id: number;
  description: string;
  location: string;
  volume: string;
  costKopecks: number | null;
  createdAt: string;
  employee: { fullName: string };
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

export default function AddWorksForm({
  actId,
  works,
}: {
  actId: number;
  works: Work[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    setMessage(null);

    if (selected.size === 0) {
      setError("Выберите хотя бы одну работу.");
      return;
    }

    const formData = new FormData();
    selected.forEach((id) => formData.append("completedWorkIds", String(id)));

    startTransition(async () => {
      const result = await addWorksToAct(actId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSelected(new Set());
      setMessage("Работы добавлены в акт.");
      router.refresh();
    });
  }

  if (works.length === 0) {
    return null;
  }

  return (
    <form className="list-card" onSubmit={submit}>
      <div className="list-heading">
        <div>
          <p className="card-kicker">
            Другие работы этого дома с подтверждённой стоимостью
          </p>
          <h2>Добавить работы в акт</h2>
        </div>
        <span className="list-total">
          {selected.size} из {works.length}
        </span>
      </div>
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
      {message && <p className="feedback success">{message}</p>}
      {error && <p className="feedback error">{error}</p>}
      <div className="form-actions">
        <button className="primary-button" disabled={isPending} type="submit">
          {isPending ? "Добавляем..." : "Добавить выбранные работы"}
        </button>
      </div>
    </form>
  );
}
