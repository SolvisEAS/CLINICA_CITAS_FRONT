import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AvailabilityPicker } from "../components/AvailabilityPicker";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { formatCI, formatDateLong, formatTime, onlyDigits, toISODate } from "../lib/format";
import { useGoBack } from "../lib/navigation";
import {
  checkPatientExists,
  createAppointment,
  errorText,
  extractFieldErrors,
  type ApiFieldErrors,
  type Slot,
} from "../services/api";

/** El doctor logueado agenda un turno en su propia agenda para un paciente. */
export default function BookForPatient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const goBack = useGoBack("/agenda");
  // La ruta exige perfil de doctor (ProtectedRoute require="doctor").
  const doctorId = user!.doctor_id!;
  const doctorName = `${user!.first_name} ${user!.last_name}`.trim() || user!.username;

  const [ci, setCi] = useState("");
  const [checking, setChecking] = useState(false);
  const [ciError, setCiError] = useState("");
  const [patient, setPatient] = useState<{ ci: string; exists: boolean; name: string } | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [slot, setSlot] = useState<Slot | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ApiFieldErrors>({});

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (ci.length < 4) {
      setCiError("Ingresá el CI completo, solo números.");
      return;
    }
    setCiError("");
    setChecking(true);
    try {
      const result = await checkPatientExists(ci);
      setPatient({ ci, exists: result.exists, name: result.name ?? "" });
    } catch (err) {
      setCiError(errorText(err));
    } finally {
      setChecking(false);
    }
  }

  async function handleConfirm() {
    if (!patient || !slot) return;
    setSubmitting(true);
    setErrors({});
    try {
      await createAppointment({
        document_number: patient.ci,
        doctor: doctorId,
        start_datetime: slot.start_datetime,
        notes: reason.trim(),
        ...(patient.exists ? {} : { name: name.trim(), phone: phone.trim(), email: email.trim() }),
      });
      // replace: "atrás" desde la ficha vuelve a la agenda, no a este formulario ya enviado.
      navigate(`/pacientes/${patient.ci}`, { replace: true });
    } catch (err) {
      setErrors(extractFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  }

  const newPatientReady = patient?.exists || (name.trim() && onlyDigits(phone).length >= 6);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Agendar turno a un paciente</h2>
          <div className="sub">Buscá al paciente por CI, elegí día y horario en tu agenda y confirmá.</div>
        </div>
        <button className="button button-secondary" onClick={goBack}>
          <Icon name="chevronLeft" size={16} /> Agenda
        </button>
      </div>

      <div className="booking-grid">
        <form className="card card-pad" onSubmit={handleSearch}>
          <h3>1 · Paciente</h3>
          <div className="field">
            <label htmlFor="ci">CI del paciente</label>
            <div className="input-row">
              <input
                id="ci"
                className="input"
                inputMode="numeric"
                placeholder="Solo números"
                maxLength={15}
                value={ci}
                onChange={(e) => {
                  setCi(onlyDigits(e.target.value));
                  setPatient(null);
                }}
              />
              <button className="button" type="submit" disabled={checking}>
                {checking ? "..." : "Buscar"}
              </button>
            </div>
          </div>
          {ciError && <p className="error-text">{ciError}</p>}

          {patient?.exists && (
            <div className="notice notice-ok">
              Paciente registrado: <b>{patient.name}</b> (CI {formatCI(patient.ci)}).
            </div>
          )}
          {patient && !patient.exists && (
            <>
              <div className="notice">Paciente nuevo: completá sus datos.</div>
              <div className="field">
                <label htmlFor="name">Nombre completo</label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="phone">Teléfono</label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="email">
                  Correo <span className="optional">(opcional)</span>
                </label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </>
          )}
        </form>

        <div className="card card-pad">
          <h3>2 · Día y horario</h3>
          <AvailabilityPicker doctorId={doctorId} selectedSlot={slot} onSelectSlot={setSlot} />

          {slot && patient && newPatientReady && (
            <div className="confirm-inline">
              <h3>3 · Confirmar</h3>
              <dl className="summary">
                <div><dt>Paciente</dt><dd>{patient.exists ? patient.name : name.trim()}</dd></div>
                <div><dt>CI</dt><dd>{formatCI(patient.ci)}</dd></div>
                <div><dt>Doctor</dt><dd>{doctorName}</dd></div>
                <div><dt>Fecha</dt><dd>{formatDateLong(toISODate(new Date(slot.start_datetime)))}</dd></div>
                <div><dt>Horario</dt><dd>{formatTime(slot.start_datetime)}</dd></div>
              </dl>
              <div className="field">
                <label htmlFor="reason">
                  Motivo de la consulta <span className="optional">(opcional)</span>
                </label>
                <input id="reason" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {Object.entries(errors).map(([field, messages]) => (
                <p key={field} className="error-text">
                  {Array.isArray(messages) ? messages.join(" ") : String(messages)}
                </p>
              ))}
              <button className="button button-block" onClick={handleConfirm} disabled={submitting}>
                {submitting ? "Agendando..." : "Confirmar turno"}
              </button>
            </div>
          )}
          {slot && (!patient || !newPatientReady) && (
            <p className="notice">Completá los datos del paciente para confirmar el turno.</p>
          )}
        </div>
      </div>
    </div>
  );
}
