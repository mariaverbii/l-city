"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateActHeader } from "../../actions/acts";

type ActHeader = {
  id: number;
  number: string | null;
  signCity: string;
  customerName: string | null;
  customerBasis: string | null;
  customerApartment: string | null;
  agreementNumber: string | null;
  agreementDate: string;
  contractorPersonName: string | null;
  contractorPersonRole: string | null;
  periodFrom: string;
  periodTo: string;
};

export default function ActHeaderEditor({
  act,
  editable,
}: {
  act: ActHeader;
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
      const result = await updateActHeader(act.id, formData);
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
          <p className="card-kicker">Реквизиты</p>
          <h2>Данные акта</h2>
        </div>
      </div>

      <div className="work-filter-grid">
        <div>
          <label className="field-label" htmlFor="act-number">
            Номер акта
          </label>
          <input
            className="text-input"
            defaultValue={act.number ?? ""}
            disabled={!editable}
            id="act-number"
            name="number"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="act-sign-city">
            Город/населённый пункт (для «г. ___»)
          </label>
          <input
            className="text-input"
            defaultValue={act.signCity}
            disabled={!editable}
            id="act-sign-city"
            name="signCity"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="act-period-from">
            Период с
          </label>
          <input
            className="text-input"
            defaultValue={act.periodFrom}
            disabled={!editable}
            id="act-period-from"
            name="periodFrom"
            type="date"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="act-period-to">
            Период по
          </label>
          <input
            className="text-input"
            defaultValue={act.periodTo}
            disabled={!editable}
            id="act-period-to"
            name="periodTo"
            type="date"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="act-customer-name">
            Заказчик — ФИО представителя собственников
          </label>
          <input
            className="text-input"
            defaultValue={act.customerName ?? ""}
            disabled={!editable}
            id="act-customer-name"
            name="customerName"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="act-customer-apartment">
            № квартиры (если подписант — председатель совета дома)
          </label>
          <input
            className="text-input"
            defaultValue={act.customerApartment ?? ""}
            disabled={!editable}
            id="act-customer-apartment"
            name="customerApartment"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="act-customer-basis">
            Основание полномочий Заказчика
          </label>
          <input
            className="text-input"
            defaultValue={act.customerBasis ?? ""}
            disabled={!editable}
            id="act-customer-basis"
            name="customerBasis"
            placeholder="Например, решение общего собрания собственников от ..."
            type="text"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="act-agreement-number">
            Номер договора управления
          </label>
          <input
            className="text-input"
            defaultValue={act.agreementNumber ?? ""}
            disabled={!editable}
            id="act-agreement-number"
            name="agreementNumber"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="act-agreement-date">
            Дата договора управления
          </label>
          <input
            className="text-input"
            defaultValue={act.agreementDate}
            disabled={!editable}
            id="act-agreement-date"
            name="agreementDate"
            type="date"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="act-contractor-role">
            Исполнитель — должность подписанта
          </label>
          <input
            className="text-input"
            defaultValue={act.contractorPersonRole ?? ""}
            disabled={!editable}
            id="act-contractor-role"
            name="contractorPersonRole"
            type="text"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="act-contractor-name">
            Исполнитель — ФИО подписанта
          </label>
          <input
            className="text-input"
            defaultValue={act.contractorPersonName ?? ""}
            disabled={!editable}
            id="act-contractor-name"
            name="contractorPersonName"
            type="text"
          />
        </div>
      </div>

      {message && <p className="feedback success">{message}</p>}
      {error && <p className="feedback error">{error}</p>}

      {editable && (
        <div className="form-actions">
          <button className="primary-button" disabled={isPending} type="submit">
            {isPending ? "Сохраняем..." : "Сохранить данные акта"}
          </button>
        </div>
      )}
    </form>
  );
}
