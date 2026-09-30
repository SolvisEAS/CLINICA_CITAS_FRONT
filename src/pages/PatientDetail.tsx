import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createTreatmentRecord,
  getDoctors,
  getPatientDetail,
  type Doctor,
  type PatientDetail as PatientDetailData,
} from "../services/api";

const STATUS_LABEL: Record<string, string> = {
  CONFIRMADA: "Confirmada",
  ATENDIDA: "Atendida",
  NO_ASISTIO: "No asistió",
  CANCELADA: "Cancelada",
};

export default function PatientDetail() {
  const { documentNumber } = useParams<{ documentNumber: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [patient, setPatient] = useState<PatientDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [description, setDescription] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [treatmentDoctor, setTreatmentDoctor] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  function load() {
    if (!documentNumber) return;
    setLoading(true);
    setLoadError("");
    getPatientDetail(documentNumber)
      .then(setPatient)
      .catch(() => setLoadError("No se pudo cargar la ficha del paciente."))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- indicador de carga; `load` también se reusa como handler tras guardar un tratamiento
  useEffect(load, [documentNumber]);

  useEffect(() => {
    // Un ADMIN debe indicar qué doctor firma la nota; un DOCTOR queda
    // asignado automáticamente en el backend (ver apps/patients/views.py).
    if (isAdmin) getDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, [isAdmin]);

  async function handleAddTreatment() {
    if (!documentNumber || !description.trim()) return;
    if (isAdmin && !treatmentDoctor) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      await createTreatmentRecord(documentNumber, {
        description: description.trim(),
        doctor: isAdmin && treatmentDoctor ? treatmentDoctor : undefined,
      });
      setDescription("");
      load();
    } catch {
      setSubmitError("No se pudo guardar la nota de tratamiento.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="page-loading">Cargando ficha...</p>;
  if (loadError || !patient) return <p className="error-text">{loadError}</p>;

  return (
    <div className="page-wide">
      <Link className="link-button" to="/agenda">
        &larr; Volver a la agenda
      </Link>

      <div className="page-header-row">
        <h2>{patient.name}</h2>
      </div>
      <p className="hint-text">
        Cédula: {patient.document_number} · Teléfono: {patient.phone} · Correo: {patient.email}
      </p>

      <section className="card">
        <h3>Turnos</h3>
        {patient.appointments.length === 0 ? (
          <p className="empty-state">Este paciente no tiene turnos registrados.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Doctor</th>
                <th>Estado</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {patient.appointments.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.start_datetime).toLocaleString("es-UY")}</td>
                  <td>{a.doctor_name}</td>
                  <td>
                    <span className={`badge badge-${a.status.toLowerCase()}`}>
                      {STATUS_LABEL[a.status]}
                    </span>
                  </td>
                  <td>{a.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h3>Historial de tratamientos</h3>
        {patient.treatment_records.length === 0 ? (
          <p className="empty-state">Todavía no hay notas de tratamiento.</p>
        ) : (
          <ul className="treatment-list">
            {patient.treatment_records.map((t) => (
              <li key={t.id}>
                <div className="treatment-meta">
                  <strong>{t.doctor_name}</strong>
                  <span>{new Date(t.created_at).toLocaleString("es-UY")}</span>
                </div>
                <p>{t.description}</p>
              </li>
            ))}
          </ul>
        )}

        {isAdmin && (
          <div className="field">
            <label htmlFor="treatment-doctor">Doctor que firma la nota</label>
            <select
              id="treatment-doctor"
              value={treatmentDoctor ?? ""}
              onChange={(e) => setTreatmentDoctor(Number(e.target.value) || null)}
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
        <div className="field">
          <label htmlFor="description">Agregar nota de tratamiento</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        {submitError && <p className="error-text">{submitError}</p>}
        <button
          className="button"
          onClick={handleAddTreatment}
          disabled={submitting || !description.trim() || (isAdmin && !treatmentDoctor)}
        >
          {submitting ? "Guardando..." : "Guardar nota"}
        </button>
      </section>
    </div>
  );
}
