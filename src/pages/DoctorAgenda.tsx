import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { STATUS_LABEL, addDays, formatCI, formatDateLong, formatTime, toISODate, todayISO } from "../lib/format";
import {
  errorText,
  getAgenda,
  getUpcomingAppointments,
  updateAppointmentStatus,
  type Appointment,
} from "../services/api";

type Filter = "TODAS" | Appointment["status"];

const FILTERS: { value: Filter; label: string }[] = [
  { value: "TODAS", label: "Todas" },
  { value: "CONFIRMADA", label: "Pendientes" },
  { value: "ATENDIDA", label: "Atendidas" },
  { value: "NO_ASISTIO", label: "No asistió" },
  { value: "CANCELADA", label: "Canceladas" },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function fechaFrom(params: URLSearchParams) {
  const value = params.get("fecha");
  return value && ISO_DATE.test(value) ? value : todayISO();
}

export default function DoctorAgenda() {
  const { user } = useAuth();
  // Vista, fecha y filtro viven en la URL (?vista=&fecha=&estado=): al volver de una ficha
  // la agenda queda igual. Se usa replace para que cambiar de día no llene el historial.
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("vista") === "proximas" ? "proximas" : "dia";
  const date = fechaFrom(searchParams);
  const estadoParam = searchParams.get("estado") as Filter | null;
  const filter: Filter = estadoParam && FILTERS.some((f) => f.value === estadoParam) ? estadoParam : "TODAS";

  // Se parte de la URL real y no de `searchParams`: React Router le pasa al updater los parámetros
  // del último render, así que con varios clics seguidos en ‹ › se pisarían y se perdería alguno.
  function updateParams(changes: (current: URLSearchParams) => Record<string, string | null>) {
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes(current))) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  }
  const dateParam = (value: string) => ({ fecha: value === todayISO() ? null : value });
  const setDate = (value: string) => updateParams(() => dateParam(value));
  const shiftDate = (days: number) => updateParams((current) => dateParam(addDays(fechaFrom(current), days)));
  const setFilter = (value: Filter) => updateParams(() => ({ estado: value === "TODAS" ? null : value }));
  const setView = (value: "dia" | "proximas") => updateParams(() => ({ vista: value === "dia" ? null : value }));

  const firstName = user?.first_name || user?.username || "";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>
            {greeting()}, {firstName}
          </h2>
          <div className="sub">{formatDateLong(todayISO())}</div>
        </div>
        <Link className="button" to="/agenda/nueva">
          <Icon name="plus" size={16} /> Agendar turno
        </Link>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={view === "dia"} className={`tab ${view === "dia" ? "active" : ""}`} onClick={() => setView("dia")}>
          Agenda del día
        </button>
        <button
          role="tab"
          aria-selected={view === "proximas"}
          className={`tab ${view === "proximas" ? "active" : ""}`}
          onClick={() => setView("proximas")}
        >
          Próximas consultas
        </button>
      </div>

      {view === "dia" ? (
        <DayView date={date} filter={filter} setDate={setDate} shiftDate={shiftDate} setFilter={setFilter} />
      ) : (
        <UpcomingView />
      )}
    </div>
  );
}

function DayView({
  date,
  filter,
  setDate,
  shiftDate,
  setFilter,
}: {
  date: string;
  filter: Filter;
  setDate: (value: string) => void;
  shiftDate: (days: number) => void;
  setFilter: (value: Filter) => void;
}) {
  // `key` identifica qué agenda está cargada; mientras no coincida con la pedida, se muestra "cargando".
  const [agenda, setAgenda] = useState<{ key: string; appointments: Appointment[]; failed: boolean }>({
    key: "",
    appointments: [],
    failed: false,
  });
  const loading = agenda.key !== date;
  const [actionError, setActionError] = useState("");
  // Reloj para "próximo turno": avanza solo mientras la agenda queda abierta.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let ignore = false;
    getAgenda(date)
      .then((res) => {
        if (!ignore) setAgenda({ key: date, appointments: res.appointments, failed: false });
      })
      .catch(() => {
        if (!ignore) setAgenda({ key: date, appointments: [], failed: true });
      });
    return () => {
      ignore = true;
    };
  }, [date]);

  async function handleStatus(id: number, status: "ATENDIDA" | "NO_ASISTIO" | "CANCELADA") {
    setActionError("");
    try {
      const updated = await updateAppointmentStatus(id, status);
      setAgenda((prev) => ({ ...prev, appointments: prev.appointments.map((a) => (a.id === id ? updated : a)) }));
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  const appointments = loading
    ? []
    : [...agenda.appointments].sort((a, b) => a.start_datetime.localeCompare(b.start_datetime));
  const active = appointments.filter((a) => a.status !== "CANCELADA");
  const attended = appointments.filter((a) => a.status === "ATENDIDA").length;
  const pending = appointments.filter((a) => a.status === "CONFIRMADA");
  const nextAppointment =
    date < todayISO() ? null : pending.find((a) => new Date(a.start_datetime).getTime() > now) ?? null;
  const visible = filter === "TODAS" ? appointments : appointments.filter((a) => a.status === filter);

  return (
    <>
      <div className="agenda-toolbar">
        <div className="date-nav">
          <button className="icon-button" onClick={() => shiftDate(-1)} aria-label="Día anterior">
            <Icon name="chevronLeft" />
          </button>
          <input type="date" className="input" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="icon-button" onClick={() => shiftDate(1)} aria-label="Día siguiente">
            <Icon name="chevronRight" />
          </button>
          {date !== todayISO() && (
            <button className="button button-secondary button-sm" onClick={() => setDate(todayISO())}>
              Hoy
            </button>
          )}
        </div>
        <strong className="toolbar-date">{formatDateLong(date)}</strong>
      </div>

      <div className="stats">
        <div className="card stat">
          <span>Consultas del día</span>
          <strong>{loading ? "–" : active.length}</strong>
        </div>
        <div className="card stat">
          <span>Atendidas</span>
          <strong>{loading ? "–" : attended}</strong>
        </div>
        <div className="card stat">
          <span>Pendientes</span>
          <strong>{loading ? "–" : pending.length}</strong>
        </div>
        <div className="card stat">
          <span>Próximo turno</span>
          <strong>{loading || !nextAppointment ? "–" : formatTime(nextAppointment.start_datetime)}</strong>
          {!loading && nextAppointment && <small>{nextAppointment.patient_name}</small>}
        </div>
      </div>

      <div className="card card-pad">
        <div className="title-row">
          <h3>Consultas</h3>
          <select
            className="input select-auto"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            aria-label="Filtrar por estado"
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {actionError && <p className="error-text">{actionError}</p>}

        {loading ? (
          <p className="sub">Cargando agenda...</p>
        ) : agenda.failed ? (
          <p className="error-text">No se pudo cargar la agenda. Intentá de nuevo.</p>
        ) : visible.length === 0 ? (
          <p className="empty-state">
            {appointments.length === 0 ? "No hay consultas agendadas para este día." : "No hay consultas con ese estado."}
          </p>
        ) : (
          <ul className="appt-list">
            {visible.map((a) => (
              <li key={a.id} className={`appt ${a.status === "CANCELADA" ? "is-cancelled" : ""}`}>
                <div className="appt-time">{formatTime(a.start_datetime)}</div>
                <div className="appt-patient">
                  <Link to={`/pacientes/${a.patient}`}>{a.patient_name}</Link>
                  <small>
                    CI {formatCI(a.patient)} · {a.notes || "Sin motivo indicado"}
                  </small>
                </div>
                <div className="appt-actions">
                  <span className={`tag tag-${a.status.toLowerCase()}`}>{STATUS_LABEL[a.status]}</span>
                  {a.status === "CONFIRMADA" && (
                    <>
                      <button className="button button-sm" onClick={() => handleStatus(a.id, "ATENDIDA")}>
                        Atendida
                      </button>
                      <button className="button button-secondary button-sm" onClick={() => handleStatus(a.id, "NO_ASISTIO")}>
                        No asistió
                      </button>
                      <button className="button button-danger button-sm" onClick={() => handleStatus(a.id, "CANCELADA")}>
                        Cancelar
                      </button>
                    </>
                  )}
                  <Link className="button button-secondary button-sm" to={`/pacientes/${a.patient}`}>
                    Ver ficha
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function UpcomingView() {
  const [items, setItems] = useState<Appointment[] | null>(null);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let ignore = false;
    getUpcomingAppointments(1)
      .then((res) => {
        if (ignore) return;
        setItems(res.results);
        setNextPage(res.next ? 2 : null);
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function loadMore() {
    if (!nextPage) return;
    setLoadingMore(true);
    try {
      const res = await getUpcomingAppointments(nextPage);
      setItems((prev) => [...(prev ?? []), ...res.results]);
      setNextPage(res.next ? nextPage + 1 : null);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (failed) return <p className="error-text">No se pudieron cargar las próximas consultas.</p>;
  if (items === null) return <p className="sub">Cargando próximas consultas...</p>;
  if (items.length === 0) return <p className="empty-state">No tenés consultas pendientes a partir de ahora.</p>;

  // Agrupadas por día, en el orden en que vienen (cronológico).
  const groups: { day: string; appointments: Appointment[] }[] = [];
  for (const a of items) {
    const day = toISODate(new Date(a.start_datetime));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.appointments.push(a);
    else groups.push({ day, appointments: [a] });
  }

  return (
    <div className="card card-pad">
      {groups.map((group) => (
        <section key={group.day} className="day-group">
          <h3>{formatDateLong(group.day)}</h3>
          <ul className="appt-list">
            {group.appointments.map((a) => (
              <li key={a.id} className="appt">
                <div className="appt-time">{formatTime(a.start_datetime)}</div>
                <div className="appt-patient">
                  <Link to={`/pacientes/${a.patient}`}>{a.patient_name}</Link>
                  <small>
                    CI {formatCI(a.patient)} · {a.notes || "Sin motivo indicado"}
                  </small>
                </div>
                <div className="appt-actions">
                  <span className="tag tag-confirmada">{STATUS_LABEL[a.status]}</span>
                  <Link className="button button-secondary button-sm" to={`/pacientes/${a.patient}`}>
                    Ver ficha
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {nextPage && (
        <button className="button button-secondary button-block" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? "Cargando..." : "Ver más"}
        </button>
      )}
    </div>
  );
}
