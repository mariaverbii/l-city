"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markActSigned, revertActToDraft, setActReady } from "../../actions/acts";

type Props = {
  actId: number;
  status: string;
};

export default function ActStatusControls({ actId, status }: Props) {
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

  return (
    <div className="act-status-controls">
      {status === "draft" && (
        <button
          className="primary-button"
          disabled={isPending}
          onClick={() => handle(() => setActReady(actId))}
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
            onClick={() => handle(() => revertActToDraft(actId))}
            type="button"
          >
            Вернуть в черновик
          </button>
          <button
            className="primary-button"
            disabled={isPending}
            onClick={() => {
              if (!window.confirm("Отметить акт как подписанный? После этого редактирование будет недоступно.")) {
                return;
              }
              const formData = new FormData();
              handle(() => markActSigned(actId, formData));
            }}
            type="button"
          >
            Отметить подписанным
          </button>
        </>
      )}
      {error && <p className="feedback error">{error}</p>}
    </div>
  );
}
