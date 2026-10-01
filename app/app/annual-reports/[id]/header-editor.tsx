"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAnnualReportHeader } from "../../actions/annual-reports";

type Header = {
  id: number;
  orgFullName: string | null;
  receptionAddress: string | null;
  ogrnOrInn: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  totalAreaSqm: number | null;
};

export default function HeaderEditor({
  report,
  editable,
}: {
  report: Header;
  editable: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateAnnualReportHeader(report.id, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Сохранено.");
      router.refresh();
    });
  }

  return (
    <form className="list-card" onSubmit={submit}>
      <div className="list-heading">
        <div>
          <p className="card-kicker">Шапка формы</p>
          <h2>Реквизиты организации и дома</h2>
        </div>
      </div>

      <div className="work-filter-grid">
        <div>
          <label className="field-label" htmlFor="ar-org-name">
            Полное наименование организации
          </label>
          <input
            className="text-input"
            defaultValue={report.orgFullName ?? ""}
            disabled={!editable}
            id="ar-org-name"
            name="orgFullName"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ar-reception-address">
            Адрес приёма населения по вопросам отчёта
          </label>
          <input
            className="text-input"
            defaultValue={report.receptionAddress ?? ""}
            disabled={!editable}
            id="ar-reception-address"
            name="receptionAddress"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ar-ogrn-inn">
            ОГРН/ИНН
          </label>
          <input
            className="text-input"
            defaultValue={report.ogrnOrInn ?? ""}
            disabled={!editable}
            id="ar-ogrn-inn"
            name="ogrnOrInn"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ar-total-area">
            Общая площадь помещений в доме, м²
          </label>
          <input
            className="text-input"
            defaultValue={report.totalAreaSqm ?? ""}
            disabled={!editable}
            id="ar-total-area"
            inputMode="decimal"
            name="totalAreaSqm"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ar-contact-name">
            ФИО и должность ответственного за разъяснения по отчёту
          </label>
          <input
            className="text-input"
            defaultValue={report.contactName ?? ""}
            disabled={!editable}
            id="ar-contact-name"
            name="contactName"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ar-contact-phone">
            Телефон ответственного лица
          </label>
          <input
            className="text-input"
            defaultValue={report.contactPhone ?? ""}
            disabled={!editable}
            id="ar-contact-phone"
            name="contactPhone"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ar-contact-email">
            Email ответственного лица (если есть)
          </label>
          <input
            className="text-input"
            defaultValue={report.contactEmail ?? ""}
            disabled={!editable}
            id="ar-contact-email"
            name="contactEmail"
            type="text"
          />
        </div>
      </div>

      {message && <p className="feedback success">{message}</p>}
      {error && <p className="feedback error">{error}</p>}

      {editable && (
        <div className="form-actions">
          <button className="primary-button" disabled={isPending} type="submit">
            {isPending ? "Сохраняем..." : "Сохранить реквизиты"}
          </button>
        </div>
      )}
    </form>
  );
}
