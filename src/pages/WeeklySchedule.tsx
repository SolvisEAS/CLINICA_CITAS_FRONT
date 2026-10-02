import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  createWeeklySchedule,
  deleteWeeklySchedule,
  errorText,
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

/**
 * mode "own": el doctor logueado gestiona su horario. mode "admin": un administrador elige
 * el doctor. En ambos casos se manda el doctor explícito, así funciona igual para un
 * superusuario que además es doctor (el backend le exige indicarlo).
 */
export default function WeeklySchedule({ mode }: { mode: "own" | "admin" }) {
  const { user } = useAuth();
  const isAdmin = mode === "admin";

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [pickedDoctor, setPickedDoctor] = useState<number | null>(null);
  const doctorId = isAdmin ? pickedDoctor : user?.doctor_id ?? null;

  // `key` indica de qué doctor (y versión) es la lista cargada; si no coincide, se está cargando.
  const [version, setVersion] = useState(0);
  const requestKey = `${doctorId}-${version}`;
  const [loaded, setLoaded] = useState<{ key: string; blocks: WeeklyScheduleBlock[] }>({ key: "", blocks: [] });
  const loading = loaded.key !== requestKey;
  const schedules = loading ? [] : loaded.blocks;

  const [weekday, setWeekday] = useState(0);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) getDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!doctorId) return;
    let ignore = false;
    getWeeklySchedules(doctorId)
      .then((blocks) => {
        if (!ignore) setLoaded({ key: requestKey, blocks });
      })
      .catch(() => {
        if (!ignore) setLoaded({ key: requestKey, blocks: [] });
      });
    return () => {
      ignore = true;
    };
  }, [doctorId, requestKey]);

  async function handleAdd() {
    if (!doctorId) return;
    setError("");
    setSubmitting(true);
    try {
      await createWeeklySchedule({ weekday, start_time: startTime, end_time: endTime, doctor: doctorId });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setError("");
    try {
      await deleteWeeklySchedule(id);
      setLoaded((prev) => ({ ...prev, blocks: prev.blocks.filter((s) => s.id !== id) }));
    } catch {
      setError("No se pudo borrar ese horario.");
    }
  }

  const canManage = Boolean(doctorId);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{isAdmin ? "Horarios de atención" : "Mi horario semanal"}</h2>
          <div className="sub">
            Bloques horarios de atención de cada día. Los pacientes solo pueden reservar turnos dentro de estos
            horarios.
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="card">
          <div className="field">
            <label htmlFor="doctor">Doctor</label>
            <select
              id="doctor"
              value={pickedDoctor ?? ""}
              onChange={(e) => setPickedDoctor(Number(e.target.value) || null)}
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
