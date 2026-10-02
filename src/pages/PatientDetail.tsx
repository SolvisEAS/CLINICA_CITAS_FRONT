import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { STATUS_LABEL, formatCI, formatDateShort, formatTime, initials } from "../lib/format";
import { useGoBack } from "../lib/navigation";
import {
  createTreatmentRecord,
  errorText,
  getPatientDetail,
  type Appointment,
  type PatientDetail as PatientDetailData,
} from "../services/api";

/** Consulta propuesta para asociar a un registro nuevo: la última de este doctor que ya empezó. */
function defaultAppointment(appointments: Appointment[], doctorId: number | null) {
  const now = Date.now();
  return (
    appointments
      .filter((a) => a.doctor === doctorId && a.status !== "CANCELADA" && new Date(a.start_datetime).getTime() <= now)
      .sort((a, b) => b.start_datetime.localeCompare(a.start_datetime))[0] ?? null
  );
}

export default function PatientDetail() {
  const { documentNumber = "" } = useParams<{ documentNumber: string }>();
  const goBack = useGoBack("/pacientes");
  const { user } = useAuth();

  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${documentNumber}-${reloadToken}`;
  const [state, setState] = useState<{ key: string; patient: PatientDetailData | null; error: string }>({
    key: "",
    patient: null,
    error: "",
  });
  // Al recargar después de guardar se sigue mostrando la ficha anterior hasta que llega la nueva.
  const firstLoad = state.key !== requestKey && state.patient?.document_number !== documentNumber;

  // null = todavía no se tocó: se usa la consulta propuesta. "" = sin consulta asociada.
  const [appointmentChoice, setAppointmentChoice] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [observations, setObservations] = useState("");
  const [treatment, setTreatment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let ignore = false;
    getPatientDetail(documentNumber)
      .then((patient) => {
        if (!ignore) setState({ key: requestKey, patient, error: "" });
      })
      .catch((err) => {
        if (ignore) return;
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        const error =
          status === 403
            ? "Solo podés ver la ficha de pacientes que tuvieron al menos un turno con vos."
            : status === 404
              ? "No existe un paciente con ese CI."
              : "No se pudo cargar la ficha del paciente.";
        setState({ key: requestKey, patient: null, error });
      });
    return () => {
      ignore = true;
    };
  }, [documentNumber, requestKey]);

  const patient = state.patient;
  const linkable = (patient?.appointments ?? []).filter((a) => a.status !== "CANCELADA");
  const proposed = patient ? defaultAppointment(patient.appointments, user?.doctor_id ?? null) : null;
  const selectedAppointmentId = appointmentChoice ?? (proposed ? String(proposed.id) : "");
  const selectedAppointment = linkable.find((a) => String(a.id) === selectedAppointmentId) ?? null;

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!observations.trim()) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await createTreatmentRecord(documentNumber, {
        reason: reason.trim() || selectedAppointment?.notes || "",
        description: observations.trim(),
        treatment: treatment.trim(),
        appointment: selectedAppointment?.id,
      });
      setReason("");
      setObservations("");
      setTreatment("");
      setAppointmentChoice(null);
      setSaved(true);
      setReloadToken((t) => t + 1);
    } catch (err) {
      setSaveError(errorText(err) || "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Ficha del paciente</h2>
          <div className="sub">Datos de contacto, consultas e historial de tratamientos.</div>
        </div>
        <button className="button button-secondary" onClick={goBack}>
          <Icon name="chevronLeft" size={16} /> Volver
        </button>
      </div>

      {firstLoad ? (
        <p className="sub">Cargando ficha...</p>
      ) : !patient ? (
        <p className="empty-state">{state.error}</p>
      ) : (
        <div className="patient-grid">
          <div>
            <div className="card card-pad">
              <div className="patient-header">
                <span className="avatar avatar-lg">{initials(patient.name)}</span>
                <div>
                  <h3>{patient.name}</h3>
                  <div className="sub">CI {formatCI(patient.document_number)}</div>
                </div>
              </div>
              <dl className="info-list">
                <div><dt>Teléfono</dt><dd>{patient.phone || "—"}</dd></div>
                <div><dt>Correo</dt><dd>{patient.email || "—"}</dd></div>
                <div>
                  <dt>Última consulta</dt>
                  <dd>{patient.last_visit ? formatDateShort(patient.last_visit) : "Sin consultas previas"}</dd>
                </div>
              </dl>
            </div>

            <div className="card card-pad">
              <h3>Consultas</h3>
              {patient.appointments.length === 0 ? (
                <p className="empty-state">Sin consultas registradas.</p>
              ) : (
                <ul className="mini-list">
                  {patient.appointments.map((a) => (
                    <li key={a.id}>
                      <span>
                        <b>
                          {formatDateShort(a.start_datetime)} · {formatTime(a.start_datetime)}
                        </b>
                        <small>
                          {a.doctor_name}
                          {a.notes ? ` · ${a.notes}` : ""}
                        </small>
                      </span>
                      <span className={`tag tag-${a.status.toLowerCase()}`}>{STATUS_LABEL[a.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="card card-pad">
            <h3>Historial de tratamientos</h3>
            {patient.treatment_records.length === 0 ? (
              <p className="empty-state">Todavía no hay registros en el historial.</p>
            ) : (
              patient.treatment_records.map((r) => (
                <article key={r.id} className="record">
                  <small>
                    {formatDateShort(r.date)} · {r.doctor_name}
                  </small>
                  <b>{r.reason || "Consulta"}</b>
                  <div className="record-block">
                    <span>Observaciones</span>
                    <p>{r.description}</p>
                  </div>
                  {r.treatment && (
                    <div className="record-block">
                      <span>Tratamiento / indicaciones</span>
                      <p>{r.treatment}</p>
                    </div>
                  )}
                </article>
              ))
            )}

            <form className="record-form" onSubmit={handleSave}>
              <h3>Agregar registro</h3>
              <div className="field">
                <label htmlFor="record-appointment">Consulta (define la fecha del registro)</label>
                <select
                  id="record-appointment"
                  value={selectedAppointmentId}
                  onChange={(e) => setAppointmentChoice(e.target.value)}
                >
                  <option value="">Sin consulta asociada (fecha de hoy)</option>
                  {linkable.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatDateShort(a.start_datetime)} {formatTime(a.start_datetime)} · {a.doctor_name}
                      {a.notes ? ` · ${a.notes}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="reason">
                  Motivo de consulta <span className="optional">(opcional)</span>
                </label>
                <input
                  id="reason"
                  placeholder={selectedAppointment?.notes || "Ej. Control general"}
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="observations">Observaciones</label>
                <textarea
                  id="observations"
                  placeholder="Detalle de la consulta, hallazgos, diagnóstico..."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="treatment">
                  Tratamiento / indicaciones <span className="optional">(opcional)</span>
                </label>
                <textarea
                  id="treatment"
                  placeholder="Tratamiento realizado, medicación, próximos pasos..."
                  value={treatment}
                  onChange={(e) => setTreatment(e.target.value)}
                />
              </div>
              {saveError && <p className="error-text">{saveError}</p>}
              {saved && <p className="success-text">Registro guardado en el historial.</p>}
              <button className="button" type="submit" disabled={saving || !observations.trim()}>
                {saving ? "Guardando..." : "Guardar en el historial"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
