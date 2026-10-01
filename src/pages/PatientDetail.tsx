import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { STATUS_LABEL, formatCI, formatDateShort, formatTime, initials } from "../lib/format";
import { useGoBack } from "../lib/navigation";
import {
  createTreatmentRecord,
  extractFieldErrors,
  getDoctors,
  getPatientDetail,
  type Doctor,
  type PatientDetail as PatientDetailData,
} from "../services/api";

/** Última consulta atendida; si no hay, el último turno ya pasado que no se canceló. */
function lastVisit(patient: PatientDetailData) {
  const now = Date.now();
  const past = patient.appointments.filter(
    (a) => a.status !== "CANCELADA" && new Date(a.start_datetime).getTime() <= now
  );
  const attended = past.filter((a) => a.status === "ATENDIDA");
  const pick = (attended.length ? attended : past).sort((a, b) => b.start_datetime.localeCompare(a.start_datetime))[0];
  return pick ? formatDateShort(pick.start_datetime) : "Sin consultas previas";
}

export default function PatientDetail() {
  const { documentNumber = "" } = useParams<{ documentNumber: string }>();
  const goBack = useGoBack("/pacientes");
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${documentNumber}-${reloadToken}`;
  const [state, setState] = useState<{ key: string; patient: PatientDetailData | null; error: string }>({
    key: "",
    patient: null,
    error: "",
  });
  // Al recargar después de guardar se sigue mostrando la ficha anterior hasta que llega la nueva.
  const firstLoad = state.key !== requestKey && state.patient?.document_number !== documentNumber;

  const [reason, setReason] = useState("");
  const [observations, setObservations] = useState("");
  const [treatment, setTreatment] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [recordDoctor, setRecordDoctor] = useState<number | null>(null);
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

  useEffect(() => {
    // Un ADMIN indica qué doctor firma el registro; a un DOCTOR lo asigna el backend.
    if (isAdmin) getDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, [isAdmin]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!observations.trim() || (isAdmin && !recordDoctor)) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      await createTreatmentRecord(documentNumber, {
        reason: reason.trim(),
        description: observations.trim(),
        treatment: treatment.trim(),
        doctor: isAdmin && recordDoctor ? recordDoctor : undefined,
      });
      setReason("");
      setObservations("");
      setTreatment("");
      setSaved(true);
      setReloadToken((t) => t + 1);
    } catch (err) {
      setSaveError(Object.values(extractFieldErrors(err)).flat().join(" ") || "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  const patient = state.patient;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Ficha del paciente</h2>
          <div className="sub">Datos de contacto, turnos e historial de tratamientos.</div>
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
                <div><dt>Última consulta</dt><dd>{lastVisit(patient)}</dd></div>
              </dl>
            </div>

            <div className="card card-pad">
              <h3>Turnos</h3>
              {patient.appointments.length === 0 ? (
                <p className="empty-state">Sin turnos registrados.</p>
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
                    {formatDateShort(r.created_at)} · {r.doctor_name}
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
              {isAdmin && (
                <div className="field">
                  <label htmlFor="record-doctor">Doctor que firma el registro</label>
                  <select
                    id="record-doctor"
                    value={recordDoctor ?? ""}
                    onChange={(e) => setRecordDoctor(Number(e.target.value) || null)}
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
                <label htmlFor="reason">
                  Motivo / tipo de consulta <span className="optional">(opcional)</span>
                </label>
                <input
                  id="reason"
                  placeholder="Ej. Control general"
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
              <button
                className="button"
                type="submit"
                disabled={saving || !observations.trim() || (isAdmin && !recordDoctor)}
              >
                {saving ? "Guardando..." : "Guardar en el historial"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
