import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getAgenda, getDoctors, updateAppointmentStatus, type Appointment, type Doctor } from "../services/api";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_LABEL: Record<Appointment["status"], string> = {
  CONFIRMADA: "Confirmada",
  ATENDIDA: "Atendida",
  NO_ASISTIO: "No asistió",
  CANCELADA: "Cancelada",
};

export default function DoctorAgenda() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [date, setDate] = useState(todayISO());
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      getDoctors().then(setDoctors).catch(() => setDoctors([]));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && !doctorId) return;
    let ignore = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- indicador de carga para un fetch disparado por date/doctorId/isAdmin
    setLoading(true);
    getAgenda(date, isAdmin && doctorId ? doctorId : undefined)
      .then((res) => {
        if (ignore) return;
        setAppointments(res.appointments);
        setActionError("");
      })
      .catch(() => {
        if (!ignore) setAppointments([]);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [date, doctorId, isAdmin]);

  async function handleStatus(id: number, status: "ATENDIDA" | "NO_ASISTIO" | "CANCELADA") {
    setActionError("");
    try {
      const updated = await updateAppointmentStatus(id, status);
      setAppointments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    } catch {
      setActionError("No se pudo actualizar el estado de la cita.");
    }
  }

  return (
    <div className="page-wide">
      <div className="page-header-row">
        <h2>Mi agenda</h2>
        <Link className="button" to="/agenda/nueva">
          Agendar cita
        </Link>
      </div>

      <div className="toolbar">
        <div className="field field-inline">
          <label htmlFor="date">Fecha</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {isAdmin && (
          <div className="field field-inline">
            <label htmlFor="doctor">Doctor</label>
            <select
              id="doctor"
              value={doctorId ?? ""}
              onChange={(e) => setDoctorId(Number(e.target.value) || null)}
            >
              <option value="">Seleccioná un doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {actionError && <p className="error-text">{actionError}</p>}

      {loading ? (
        <p className="hint-text">Cargando agenda...</p>
      ) : isAdmin && !doctorId ? (
        <p className="empty-state">Elegí un doctor para ver su agenda.</p>
      ) : appointments.length === 0 ? (
        <p className="empty-state">No hay citas agendadas para ese día.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Hora</th>
              <th>Paciente</th>
              <th>Estado</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a) => (
              <tr key={a.id}>
                <td>
                  {new Date(a.start_datetime).toLocaleTimeString("es-UY", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  <Link to={`/pacientes/${a.patient}`}>{a.patient_name}</Link>
                </td>
                <td>
                  <span className={`badge badge-${a.status.toLowerCase()}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td>{a.notes || "—"}</td>
                <td className="table-actions">
                  {a.status === "CONFIRMADA" && (
                    <>
                      <button className="link-button" onClick={() => handleStatus(a.id, "ATENDIDA")}>
                        Atendida
                      </button>
                      <button className="link-button" onClick={() => handleStatus(a.id, "NO_ASISTIO")}>
                        No asistió
                      </button>
                      <button
                        className="link-button link-button-danger"
                        onClick={() => handleStatus(a.id, "CANCELADA")}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
