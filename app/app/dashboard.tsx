"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createEmployee,
  deleteEmployee,
  updateEmployee,
} from "./actions/employees";
import {
  createHouse,
  deleteHouse,
  updateHouse,
} from "./actions/houses";

type House = {
  id: number;
  address: string;
};

type Employee = {
  id: number;
  fullName: string;
  role: string;
  phone: string;
};

type Tab = "houses" | "employees";

type DashboardProps = {
  houses: House[];
  employees: Employee[];
};

export default function Dashboard({ houses, employees }: DashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("houses");
  const [editingHouseId, setEditingHouseId] = useState<number | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [houseAddress, setHouseAddress] = useState("");
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    role: "",
    phone: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetFeedback() {
    setMessage(null);
    setError(null);
  }

  function submitHouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    const formData = new FormData(event.currentTarget);
    const editingId = editingHouseId;

    startTransition(async () => {
      const result =
        editingId === null
          ? await createHouse(formData)
          : await updateHouse(editingId, formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setHouseAddress("");
      setEditingHouseId(null);
      setMessage(editingId === null ? "Дом добавлен." : "Изменения сохранены.");
      router.refresh();
    });
  }

  function submitEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    const formData = new FormData(event.currentTarget);
    const editingId = editingEmployeeId;

    startTransition(async () => {
      const result =
        editingId === null
          ? await createEmployee(formData)
          : await updateEmployee(editingId, formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setEmployeeForm({ fullName: "", role: "", phone: "" });
      setEditingEmployeeId(null);
      setMessage(
        editingId === null ? "Сотрудник добавлен." : "Изменения сохранены.",
      );
      router.refresh();
    });
  }

  function startHouseEditing(house: House) {
    resetFeedback();
    setActiveTab("houses");
    setEditingHouseId(house.id);
    setHouseAddress(house.address);
  }

  function startEmployeeEditing(employee: Employee) {
    resetFeedback();
    setActiveTab("employees");
    setEditingEmployeeId(employee.id);
    setEmployeeForm({
      fullName: employee.fullName,
      role: employee.role,
      phone: employee.phone,
    });
  }

  function cancelHouseEditing() {
    setEditingHouseId(null);
    setHouseAddress("");
    resetFeedback();
  }

  function cancelEmployeeEditing() {
    setEditingEmployeeId(null);
    setEmployeeForm({ fullName: "", role: "", phone: "" });
    resetFeedback();
  }

  function removeHouse(house: House) {
    if (!window.confirm(`Удалить дом «${house.address}»?`)) {
      return;
    }

    resetFeedback();
    startTransition(async () => {
      const result = await deleteHouse(house.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Дом удалён.");
      router.refresh();
    });
  }

  function removeEmployee(employee: Employee) {
    if (!window.confirm(`Удалить сотрудника «${employee.fullName}»?`)) {
      return;
    }

    resetFeedback();
    startTransition(async () => {
      const result = await deleteEmployee(employee.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Сотрудник удалён.");
      router.refresh();
    });
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Управление недвижимостью</p>
          <h1>Л-Сити</h1>
          <p className="page-description">
            Дома и сотрудники в одном месте
          </p>
        </div>
        <div className="header-stat">
          <span className="header-stat-value">
            {activeTab === "houses" ? houses.length : employees.length}
          </span>
          <span>{activeTab === "houses" ? "домов" : "сотрудников"}</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Разделы управления">
        <button
          className={activeTab === "houses" ? "tab active" : "tab"}
          onClick={() => {
            setActiveTab("houses");
            resetFeedback();
          }}
          type="button"
        >
          Дома
          <span className="tab-count">{houses.length}</span>
        </button>
        <button
          className={activeTab === "employees" ? "tab active" : "tab"}
          onClick={() => {
            setActiveTab("employees");
            resetFeedback();
          }}
          type="button"
        >
          Сотрудники
          <span className="tab-count">{employees.length}</span>
        </button>
      </nav>

      {message && <p className="feedback success">{message}</p>}
      {error && <p className="feedback error">{error}</p>}

      {activeTab === "houses" ? (
        <section className="content-grid" aria-labelledby="houses-heading">
          <div className="form-card">
            <div className="card-heading">
              <div>
                <p className="card-kicker">
                  {editingHouseId === null ? "Новый объект" : "Редактирование"}
                </p>
                <h2 id="houses-heading">
                  {editingHouseId === null ? "Добавить дом" : "Изменить дом"}
                </h2>
              </div>
              <span className="card-icon" aria-hidden="true">
                {editingHouseId === null ? "+" : "↗"}
              </span>
            </div>
            <form onSubmit={submitHouse}>
              <label className="field-label" htmlFor="house-address">
                Адрес дома
              </label>
              <input
                className="text-input"
                id="house-address"
                name="address"
                onChange={(event) => setHouseAddress(event.target.value)}
                placeholder="Например, ул. Ленина, 10"
                required
                type="text"
                value={houseAddress}
              />
              <div className="form-actions">
                <button className="primary-button" disabled={isPending} type="submit">
                  {isPending
                    ? "Сохраняем..."
                    : editingHouseId === null
                      ? "Добавить дом"
                      : "Сохранить"}
                </button>
                {editingHouseId !== null && (
                  <button
                    className="secondary-button"
                    onClick={cancelHouseEditing}
                    type="button"
                  >
                    Отменить
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="list-card">
            <div className="list-heading">
              <div>
                <p className="card-kicker">Список объектов</p>
                <h2>Дома в управлении</h2>
              </div>
              <span className="list-total">{houses.length}</span>
            </div>
            {houses.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">
                  ⌂
                </span>
                <p>Домов пока нет</p>
                <span>Добавьте первый дом с помощью формы.</span>
              </div>
            ) : (
              <ul className="record-list">
                {houses.map((house) => (
                  <li className="record-row" key={house.id}>
                    <div className="record-mark" aria-hidden="true">
                      {house.id}
                    </div>
                    <div className="record-main">
                      <strong>{house.address}</strong>
                      <span>Дом №{house.id}</span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() => startHouseEditing(house)}
                        type="button"
                      >
                        Изменить
                      </button>
                      <button
                        className="danger-button"
                        disabled={isPending}
                        onClick={() => removeHouse(house)}
                        type="button"
                      >
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : (
        <section className="content-grid" aria-labelledby="employees-heading">
          <div className="form-card">
            <div className="card-heading">
              <div>
                <p className="card-kicker">
                  {editingEmployeeId === null ? "Новая запись" : "Редактирование"}
                </p>
                <h2 id="employees-heading">
                  {editingEmployeeId === null
                    ? "Добавить сотрудника"
                    : "Изменить сотрудника"}
                </h2>
              </div>
              <span className="card-icon" aria-hidden="true">
                {editingEmployeeId === null ? "+" : "↗"}
              </span>
            </div>
            <form onSubmit={submitEmployee}>
              <label className="field-label" htmlFor="employee-name">
                ФИО
              </label>
              <input
                className="text-input"
                id="employee-name"
                name="fullName"
                onChange={(event) =>
                  setEmployeeForm((current) => ({
                    ...current,
                    fullName: event.target.value,
                  }))
                }
                placeholder="Например, Иванов Иван Иванович"
                required
                type="text"
                value={employeeForm.fullName}
              />

              <label className="field-label" htmlFor="employee-role">
                Должность
              </label>
              <input
                className="text-input"
                id="employee-role"
                name="role"
                onChange={(event) =>
                  setEmployeeForm((current) => ({
                    ...current,
                    role: event.target.value,
                  }))
                }
                placeholder="Например, управляющий"
                required
                type="text"
                value={employeeForm.role}
              />

              <label className="field-label" htmlFor="employee-phone">
                Телефон
              </label>
              <input
                className="text-input"
                id="employee-phone"
                name="phone"
                onChange={(event) =>
                  setEmployeeForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="+7 (900) 000-00-00"
                required
                type="tel"
                value={employeeForm.phone}
              />

              <div className="form-actions">
                <button className="primary-button" disabled={isPending} type="submit">
                  {isPending
                    ? "Сохраняем..."
                    : editingEmployeeId === null
                      ? "Добавить сотрудника"
                      : "Сохранить"}
                </button>
                {editingEmployeeId !== null && (
                  <button
                    className="secondary-button"
                    onClick={cancelEmployeeEditing}
                    type="button"
                  >
                    Отменить
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="list-card">
            <div className="list-heading">
              <div>
                <p className="card-kicker">Команда</p>
                <h2>Сотрудники</h2>
              </div>
              <span className="list-total">{employees.length}</span>
            </div>
            {employees.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">
                  ◎
                </span>
                <p>Сотрудников пока нет</p>
                <span>Добавьте первого сотрудника с помощью формы.</span>
              </div>
            ) : (
              <ul className="record-list">
                {employees.map((employee) => (
                  <li className="record-row employee-row" key={employee.id}>
                    <div className="record-mark employee-mark" aria-hidden="true">
                      {employee.fullName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="record-main">
                      <strong>{employee.fullName}</strong>
                      <span>
                        {employee.role} · {employee.phone}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() => startEmployeeEditing(employee)}
                        type="button"
                      >
                        Изменить
                      </button>
                      <button
                        className="danger-button"
                        disabled={isPending}
                        onClick={() => removeEmployee(employee)}
                        type="button"
                      >
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  );
}