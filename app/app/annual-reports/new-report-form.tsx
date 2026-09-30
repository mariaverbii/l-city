"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAnnualReport } from "../actions/annual-reports";

type House = { id: number; address: string };

export default function NewReportForm({
  houses,
  defaultYear,
}: {
  houses: House[];
  defaultYear: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAnnualReport(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/annual-reports/${result.reportId}`);
    });
  }

  return (
    <form action={submit} className="work-filter-grid">
      <div>
        <label className="field-label" htmlFor="new-ar-house">
          Дом
        </label>
        <select className="text-input" id="new-ar-house" name="houseId" required>
          <option disabled value="">
            Выберите дом
          </option>
          {houses.map((house) => (
            <option key={house.id} value={house.id}>
              {house.address}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="new-ar-year">
          Год
        </label>
        <input
          className="text-input"
          defaultValue={defaultYear}
          id="new-ar-year"
          inputMode="numeric"
          name="year"
          required
          type="text"
        />
      </div>
      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Создаём..." : "Создать отчёт"}
      </button>
      {error && <p className="feedback error">{error}</p>}
    </form>
  );
}
