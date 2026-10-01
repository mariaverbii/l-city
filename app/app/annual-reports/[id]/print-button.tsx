"use client";

export default function PrintButton() {
  return (
    <button
      className="primary-button"
      onClick={() => window.print()}
      type="button"
    >
      Печать / Сохранить как PDF
    </button>
  );
}
