import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  createWeeklySchedule,
  deleteWeeklySchedule,
  extractFieldErrors,
  getDoctors,
  getWeeklySchedules,
  type Doctor,
  type WeeklyScheduleBlock,
} from "../services/api";

const WEEKDAYS = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sábado" },
  { value: 6, label: "Domingo" },
];

function formatTime(t: string) {
  return t.slice(0, 5);
}

export default function WeeklySchedule() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);

  const [schedules, setSchedules] = useState<WeeklyScheduleBlock[]>([]);
  const [loading, setLoading] = useState(false);

  const [weekday, setWeekday] = useState(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) getDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, [isAdmin]);

  function reload() {
    if (isAdmin && !selectedDoctor) {
      setSchedules([]);
      return;
    }
    setLoading(true);
    getWeeklySchedules(isAdmin ? selectedDoctor! : undefined)
      .then(setSchedules)
      .catch(() => setSchedules([]))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- indicador de carga; `reload` también se reusa como handler tras agregar/borrar un bloque
  useEffect(reload, [isAdmin, selectedDoctor]);

  async function handleAdd() {
    setError("");
    setSubmitting(true);
    try {
      await createWeeklySchedule({
        weekday,
        start_time: startTime,
        end_time: endTime,
        doctor: isAdmin && selectedDoctor ? selectedDoctor : undefined,
      });
      reload();
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      setError(Object.values(fieldErrors).flat().join(" "));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setError("");
    try {
      await deleteWeeklySchedule(id);
      setSchedules((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError("No se pudo borrar ese horario.");
    }
  }

  const canManage = !isAdmin || !!selectedDoctor;

  return (
    <div className="page-wide">
      <h2>Mi horario semanal</h2>
      <p className="hint-text">
        Definí los bloques horarios en los que atendés cada día. Los pacientes solo van a poder
        reservar turnos dentro de estos horarios.
      </p>

      {isAdmin && (
        <div className="card">
          <div className="field">
            <label htmlFor="doctor">Doctor</label>
            <select
              id="doctor"
              value={selectedDoctor ?? ""}
              onChange={(e) => setSelectedDoctor(Number(e.target.value) || null)}
            >
              <option value="">Seleccioná un doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {canManage && (
        <>
          <div className="card">
            <h3>Agregar bloque horario</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="weekday">Día</label>
                <select id="weekday" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                  {WEEKDAYS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="start">Desde</label>
                <input
                  id="start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="end">Hasta</label>
                <input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="button" onClick={handleAdd} disabled={submitting}>
              {submitting ? "Agregando..." : "Agregar bloque"}
            </button>
          </div>

          <div className="card">
            <h3>Horario actual</h3>
            {loading ? (
              <p className="hint-text">Cargando...</p>
            ) : (
              <div className="schedule-week">
                {WEEKDAYS.map((w) => {
                  const blocks = schedules.filter((s) => s.weekday === w.value);
                  return (
                    <div className="schedule-day" key={w.value}>
                      <strong>{w.label}</strong>
                      {blocks.length === 0 ? (
                        <span className="hint-text">Sin horario</span>
                      ) : (
                        <div className="schedule-blocks">
                          {blocks.map((b) => (
                            <span className="schedule-chip" key={b.id}>
                              {formatTime(b.start_time)}–{formatTime(b.end_time)}
                              <button
                                className="schedule-chip-remove"
                                onClick={() => handleDelete(b.id)}
                                aria-label="Quitar bloque"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
