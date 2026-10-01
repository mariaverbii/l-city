"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  publishAnnualReport,
  revertAnnualReportToDraft,
  setAnnualReportReady,
} from "../../actions/annual-reports";

type Props = {
  reportId: number;
  status: string;
};

export default function StatusControls({ reportId, status }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Не удалось выполнить действие.");
        return;
      }
      router.refresh();
    });
  }

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Отметить отчёт размещённым? После этого редактирование будет недоступно.")) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    handle(() => publishAnnualReport(reportId, formData));
  }

  return (
    <div className="act-status-controls">
      {status === "draft" && (
        <button
          className="primary-button"
          disabled={isPending}
          onClick={() => handle(() => setAnnualReportReady(reportId))}
          type="button"
        >
          Отметить готовым
        </button>
      )}
      {status === "ready" && (
        <>
          <button
            className="secondary-button"
            disabled={isPending}
            onClick={() => handle(() => revertAnnualReportToDraft(reportId))}
            type="button"
          >
            Вернуть в черновик
          </button>
          <form className="inline-form" onSubmit={publish}>
            <input
              aria-label="Дата размещения отчёта"
              className="text-input"
              defaultValue={new Date().toISOString().slice(0, 10)}
              name="publishedAt"
              type="date"
            />
            <button className="primary-button" disabled={isPending} type="submit">
              Отметить размещённым
            </button>
          </form>
        </>
      )}
      {error && <p className="feedback error">{error}</p>}
    </div>
  );
}
