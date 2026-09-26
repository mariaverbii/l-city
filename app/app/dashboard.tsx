"use client";

import { FormEvent, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
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
import {
  confirmCompletedWorkCost,
  createCompletedWork,
  deleteCompletedWork,
  revertCompletedWorkCostConfirmation,
  setCompletedWorkCost,
  updateCompletedWork,
} from "./actions/completed-works";

type House = {
  id: number;
  address: string;
};

type Employee = {
  id: number;
  fullName: string;
  role: string;
  phone: string;
  maxUserId: string | null;
};

type CompletedWork = {
  id: number;
  description: string;
  location: string;
  volume: string;
  materials: string;
  beforePhotoKey: string | null;
  afterPhotoKey: string | null;
  costKopecks: number | null;
  costConfirmed: boolean;
  createdAt: Date;
  house: {
    id: number;
    address: string;
  };
  employee: {
    id: number;
    fullName: string;
    role: string;
  };
};

type Tab = "houses" | "employees" | "works";

type CostStatus = "all" | "none" | "calculated" | "confirmed";

type DashboardProps = {
  houses: House[];
  employees: Employee[];
  completedWorks: CompletedWork[];
  initialTab: Tab;
  workFilters: {
    houseId: string;
    employeeId: string;
    from: string;
    to: string;
    costStatus: CostStatus;
  };
};

const emptyWorkForm = {
  houseId: "",
  employeeId: "",
  description: "",
  location: "",
  volume: "",
  materials: "",
};

function photoUrl(key: string) {
  return `/api/work-photos/${key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function formatCost(costKopecks: number | null) {
  if (costKopecks === null) {
    return "Не рассчитано";
  }

  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(costKopecks / 100)} ₽`;
}

export default function Dashboard({
  houses,
  employees,
  completedWorks,
  initialTab,
  workFilters,
}: DashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [editingHouseId, setEditingHouseId] = useState<number | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [editingWorkId, setEditingWorkId] = useState<number | null>(null);
  const [houseAddress, setHouseAddress] = useState("");
  const [employeeForm, setEmployeeForm] = useState({
    fullName: "",
    role: "",
    phone: "",
  });
  const [workForm, setWorkForm] = useState(emptyWorkForm);
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

  function submitWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const editingId = editingWorkId;

    startTransition(async () => {
      const result =
        editingId === null
          ? await createCompletedWork(formData)
          : await updateCompletedWork(editingId, formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      form.reset();
      setWorkForm(emptyWorkForm);
      setEditingWorkId(null);
      setMessage(
        editingId === null
          ? "Работа добавлена в журнал."
          : "Изменения сохранены.",
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

  function startWorkEditing(work: CompletedWork) {
    resetFeedback();
    setActiveTab("works");
    setEditingWorkId(work.id);
    setWorkForm({
      houseId: String(work.house.id),
      employeeId: String(work.employee.id),
      description: work.description,
      location: work.location,
      volume: work.volume,
      materials: work.materials,
    });
  }

  function cancelWorkEditing() {
    setEditingWorkId(null);
    setWorkForm(emptyWorkForm);
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

  function removeWork(work: CompletedWork) {
    if (!window.confirm(`Удалить запись о работе «${work.description}»?`)) {
      return;
    }

    resetFeedback();
    startTransition(async () => {
      const result = await deleteCompletedWork(work.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Запись о работе удалена.");
      router.refresh();
    });
  }

  function submitWorkCost(work: CompletedWork, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetFeedback();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await setCompletedWorkCost(work.id, formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Стоимость сохранена.");
      router.refresh();
    });
  }

  function confirmWorkCost(work: CompletedWork) {
    if (
      !window.confirm(
        `Подтвердить стоимость «${formatCost(work.costKopecks)}» для записи «${work.description}»? После подтверждения изменить стоимость нельзя без отмены подтверждения.`,
      )
    ) {
      return;
    }

    resetFeedback();
    startTransition(async () => {
      const result = await confirmCompletedWorkCost(work.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Стоимость подтверждена.");
      router.refresh();
    });
  }

  function revertWorkCostConfirmation(work: CompletedWork) {
    if (
      !window.confirm(
        `Отменить подтверждение стоимости для записи «${work.description}»?`,
      )
    ) {
      return;
    }

    resetFeedback();
    startTransition(async () => {
      const result = await revertCompletedWorkCostConfirmation(work.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage("Подтверждение стоимости отменено.");
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
            Дома, сотрудники и журнал выполненных работ
          </p>
        </div>
        <div className="header-stat">
          <span className="header-stat-value">
            {activeTab === "houses"
              ? houses.length
              : activeTab === "employees"
                ? employees.length
                : completedWorks.length}
          </span>
          <span>
            {activeTab === "houses"
              ? "домов"
              : activeTab === "employees"
                ? "сотрудников"
                : "записей"}
          </span>
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
        <button
          className={activeTab === "works" ? "tab active" : "tab"}
          onClick={() => {
            setActiveTab("works");
            resetFeedback();
          }}
          type="button"
        >
          Выполненные работы
          <span className="tab-count">{completedWorks.length}</span>
        </button>
        <Link className="tab" href="/acts">
          Акты
        </Link>
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
      ) : activeTab === "employees" ? (
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
                      <div
                        className={`max-badge ${
                          employee.maxUserId ? "max-linked" : "max-not-linked"
                        }`}
                      >
                        {employee.maxUserId
                          ? "MAX-бот подключён"
                          : "MAX-бот не подключён"}
                      </div>
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
      ) : (
        <section className="content-grid work-grid" aria-labelledby="works-heading">
          <div className="form-card">
            <div className="card-heading">
              <div>
                <p className="card-kicker">
                  {editingWorkId === null ? "Новая запись" : "Редактирование"}
                </p>
                <h2 id="works-heading">
                  {editingWorkId === null
                    ? "Добавить выполненную работу"
                    : "Изменить запись"}
                </h2>
              </div>
              <span className="card-icon" aria-hidden="true">
                {editingWorkId === null ? "+" : "↗"}
              </span>
            </div>
            <form onSubmit={submitWork}>
              <label className="field-label" htmlFor="work-house">
                Дом
              </label>
              <select
                className="text-input"
                id="work-house"
                name="houseId"
                onChange={(event) =>
                  setWorkForm((current) => ({
                    ...current,
                    houseId: event.target.value,
                  }))
                }
                required
                value={workForm.houseId}
              >
                <option value="">Выберите дом</option>
                {houses.map((house) => (
                  <option key={house.id} value={house.id}>
                    {house.address}
                  </option>
                ))}
              </select>

              <label className="field-label" htmlFor="work-employee">
                Сотрудник
              </label>
              <select
                className="text-input"
                id="work-employee"
                name="employeeId"
                onChange={(event) =>
                  setWorkForm((current) => ({
                    ...current,
                    employeeId: event.target.value,
                  }))
                }
                required
                value={workForm.employeeId}
              >
                <option value="">Выберите сотрудника</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName} · {employee.role}
                  </option>
                ))}
              </select>

              <label className="field-label" htmlFor="work-description">
                Категория / описание работы
              </label>
              <textarea
                className="text-input text-area"
                id="work-description"
                name="description"
                onChange={(event) =>
                  setWorkForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Например, ремонт подъездного освещения"
                required
                rows={3}
                value={workForm.description}
              />

              <label className="field-label" htmlFor="work-location">
                Место проведения
              </label>
              <input
                className="text-input"
                id="work-location"
                name="location"
                onChange={(event) =>
                  setWorkForm((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Например, подъезд №2, этаж 3"
                required
                type="text"
                value={workForm.location}
              />

              <label className="field-label" htmlFor="work-volume">
                Объём работ
              </label>
              <input
                className="text-input"
                id="work-volume"
                name="volume"
                onChange={(event) =>
                  setWorkForm((current) => ({
                    ...current,
                    volume: event.target.value,
                  }))
                }
                placeholder="Например, 12 светильников"
                required
                type="text"
                value={workForm.volume}
              />

              <label className="field-label" htmlFor="work-materials">
                Использованные материалы
              </label>
              <textarea
                className="text-input text-area"
                id="work-materials"
                name="materials"
                onChange={(event) =>
                  setWorkForm((current) => ({
                    ...current,
                    materials: event.target.value,
                  }))
                }
                placeholder="Свободное описание материалов"
                rows={2}
                value={workForm.materials}
              />

              <div className="photo-fields">
                <div>
                  <label className="field-label" htmlFor="before-photo">
                    Фото до
                  </label>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="file-input"
                    id="before-photo"
                    name="beforePhoto"
                    type="file"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="after-photo">
                    Фото после
                  </label>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="file-input"
                    id="after-photo"
                    name="afterPhoto"
                    type="file"
                  />
                </div>
              </div>
              <p className="field-hint">
                JPG, PNG или WebP, до 10 МБ. При редактировании новый файл заменит
                текущий.
              </p>

              <div className="form-actions">
                <button className="primary-button" disabled={isPending} type="submit">
                  {isPending
                    ? "Сохраняем..."
                    : editingWorkId === null
                      ? "Добавить в журнал"
                      : "Сохранить"}
                </button>
                {editingWorkId !== null && (
                  <button
                    className="secondary-button"
                    onClick={cancelWorkEditing}
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
                <p className="card-kicker">Журнал работ</p>
                <h2>Выполненные работы</h2>
              </div>
              <span className="list-total">{completedWorks.length}</span>
            </div>
            <form className="work-filters" method="get">
              <input name="tab" type="hidden" value="works" />
              <div className="work-filter-grid">
                <div>
                  <label className="field-label" htmlFor="filter-house">
                    Дом
                  </label>
                  <select
                    className="text-input"
                    defaultValue={workFilters.houseId}
                    id="filter-house"
                    name="houseId"
                  >
                    <option value="">Все дома</option>
                    {houses.map((house) => (
                      <option key={house.id} value={house.id}>
                        {house.address}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="filter-employee">
                    Сотрудник
                  </label>
                  <select
                    className="text-input"
                    defaultValue={workFilters.employeeId}
                    id="filter-employee"
                    name="employeeId"
                  >
                    <option value="">Все сотрудники</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.fullName} · {employee.role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="filter-from">
                    Дата от
                  </label>
                  <input
                    className="text-input"
                    defaultValue={workFilters.from}
                    id="filter-from"
                    name="from"
                    type="date"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="filter-to">
                    Дата до
                  </label>
                  <input
                    className="text-input"
                    defaultValue={workFilters.to}
                    id="filter-to"
                    name="to"
                    type="date"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="filter-cost-status">
                    Стоимость
                  </label>
                  <select
                    className="text-input"
                    defaultValue={workFilters.costStatus}
                    id="filter-cost-status"
                    name="costStatus"
                  >
                    <option value="all">Все записи</option>
                    <option value="none">Не рассчитано</option>
                    <option value="calculated">Рассчитано (не подтверждено)</option>
                    <option value="confirmed">Подтверждено</option>
                  </select>
                </div>
              </div>
              <div className="work-filter-actions">
                <button className="primary-button" type="submit">
                  Применить фильтры
                </button>
                <a className="filter-reset" href="?tab=works">
                  Сбросить фильтры
                </a>
              </div>
            </form>
            {completedWorks.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">
                  ✓
                </span>
                <p>Записей пока нет</p>
                <span>Добавьте первую выполненную работу с помощью формы.</span>
              </div>
            ) : (
              <ul className="record-list work-list">
                {completedWorks.map((work) => (
                  <li className="record-row work-row" key={work.id}>
                    <div className="record-mark" aria-hidden="true">
                      ✓
                    </div>
                    <div className="record-main work-main">
                      <strong>{work.description}</strong>
                      <span>
                        {work.house.address} · {work.employee.fullName}
                      </span>
                      <span>
                        {work.location} · Объём: {work.volume}
                      </span>
                      {work.materials && (
                        <span>Материалы: {work.materials}</span>
                      )}
                      <span>
                        {new Intl.DateTimeFormat("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        }).format(new Date(work.createdAt))}
                      </span>
                      {(work.beforePhotoKey || work.afterPhotoKey) && (
                        <div className="photo-previews">
                          {work.beforePhotoKey && (
                            <Image
                              alt={`Фото до: ${work.description}`}
                              src={photoUrl(work.beforePhotoKey)}
                              width={320}
                              height={240}
                              unoptimized
                            />
                          )}
                          {work.afterPhotoKey && (
                            <Image
                              alt={`Фото после: ${work.description}`}
                              src={photoUrl(work.afterPhotoKey)}
                              width={320}
                              height={240}
                              unoptimized
                            />
                          )}
                        </div>
                      )}
                      <div className="work-cost">
                        <span
                          className={
                            work.costConfirmed
                              ? "cost-badge cost-confirmed"
                              : work.costKopecks !== null
                                ? "cost-badge cost-calculated"
                                : "cost-badge cost-none"
                          }
                        >
                          {work.costConfirmed
                            ? `Подтверждено: ${formatCost(work.costKopecks)}`
                            : work.costKopecks !== null
                              ? `Рассчитано: ${formatCost(work.costKopecks)}`
                              : "Стоимость не рассчитана"}
                        </span>
                        {work.costConfirmed ? (
                          <button
                            className="secondary-button"
                            disabled={isPending}
                            onClick={() => revertWorkCostConfirmation(work)}
                            type="button"
                          >
                            Отменить подтверждение
                          </button>
                        ) : (
                          <form
                            className="cost-form"
                            onSubmit={(event) => submitWorkCost(work, event)}
                          >
                            <label
                              className="sr-only"
                              htmlFor={`cost-${work.id}`}
                            >
                              Стоимость, ₽
                            </label>
                            <input
                              className="text-input cost-input"
                              defaultValue={
                                work.costKopecks !== null
                                  ? (work.costKopecks / 100).toFixed(2)
                                  : ""
                              }
                              id={`cost-${work.id}`}
                              inputMode="decimal"
                              name="costRubles"
                              placeholder="Стоимость, ₽"
                              type="text"
                            />
                            <button
                              className="secondary-button"
                              disabled={isPending}
                              type="submit"
                            >
                              Сохранить стоимость
                            </button>
                            {work.costKopecks !== null && (
                              <button
                                className="primary-button"
                                disabled={isPending}
                                onClick={() => confirmWorkCost(work)}
                                type="button"
                              >
                                Подтвердить
                              </button>
                            )}
                          </form>
                        )}
                      </div>
                    </div>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() => startWorkEditing(work)}
                        type="button"
                      >
                        Изменить
                      </button>
                      <button
                        className="danger-button"
                        disabled={isPending}
                        onClick={() => removeWork(work)}
                        type="button"
                      >
                        Удалить
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="report-trigger">
              <p className="card-kicker">Отчёт</p>
              <h2>Сформировать отчёт по дому</h2>
              <form
                action="/report"
                className="report-trigger-grid"
                method="get"
                target="_blank"
              >
                <div>
                  <label className="field-label" htmlFor="report-house">
                    Дом
                  </label>
                  <select
                    className="text-input"
                    defaultValue=""
                    id="report-house"
                    name="houseId"
                    required
                  >
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
                  <label className="field-label" htmlFor="report-from">
                    Дата от
                  </label>
                  <input
                    className="text-input"
                    id="report-from"
                    name="from"
                    type="date"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="report-to">
                    Дата до
                  </label>
                  <input
                    className="text-input"
                    id="report-to"
                    name="to"
                    type="date"
                  />
                </div>
                <button className="primary-button" type="submit">
                  Открыть отчёт
                </button>
              </form>
              <p className="field-hint">
                Отчёт откроется в новой вкладке — там можно распечатать его
                или сохранить как PDF.
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
