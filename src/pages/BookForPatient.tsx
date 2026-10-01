import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AvailabilityPicker } from "../components/AvailabilityPicker";
import { DoctorList } from "../components/DoctorList";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { formatCI, formatDateLong, formatTime, onlyDigits, toISODate } from "../lib/format";
import { useGoBack } from "../lib/navigation";
import {
  checkPatientExists,
  createAppointment,
  extractFieldErrors,
  getDoctors,
  type ApiFieldErrors,
  type Doctor,
  type Slot,
} from "../services/api";

export default function BookForPatient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const goBack = useGoBack("/agenda");
  const isAdmin = user?.role === "ADMIN";

  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);

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

  useEffect(() => {
    getDoctors()
      .then((list) => {
        setDoctors(list);
        // El backend no expone el perfil de doctor del usuario logueado: se lo identifica por el correo.
        const own = isAdmin ? list[0] : list.find((d) => d.email === user?.email);
        setDoctor((current) => current ?? own ?? null);
      })
      .catch(() => setDoctors([]));
  }, [isAdmin, user?.email]);

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
    } catch {
      setCiError("No se pudo verificar el CI. Intentá de nuevo.");
    } finally {
      setChecking(false);
    }
  }

  async function handleConfirm() {
    if (!patient || !doctor || !slot) return;
    setSubmitting(true);
    setErrors({});
    try {
      await createAppointment({
        document_number: patient.ci,
        doctor: doctor.id,
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
  const ownProfileMissing = !isAdmin && doctors !== null && !doctor;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Agendar turno a un paciente</h2>
          <div className="sub">Buscá al paciente por CI, elegí día y horario y confirmá.</div>
        </div>
        <button className="button button-secondary" onClick={goBack}>
          <Icon name="chevronLeft" size={16} /> Agenda
        </button>
      </div>

      {ownProfileMissing && (
        <p className="error-text">Tu usuario no tiene un perfil de doctor asociado. Pedile a un administrador que lo cree.</p>
      )}

      <div className="booking-grid">
        <div>
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

          {isAdmin && (
            <div className="card card-pad">
              <h3>Doctor</h3>
              {doctors === null ? (
                <p className="sub">Cargando...</p>
              ) : (
                <DoctorList
                  doctors={doctors}
                  selectedId={doctor?.id ?? null}
                  onSelect={(d) => {
                    setDoctor(d);
                    setSlot(null);
                  }}
                />
              )}
            </div>
          )}
        </div>

        <div className="card card-pad">
          <h3>2 · Día y horario</h3>
          {doctor ? (
            <AvailabilityPicker key={doctor.id} doctorId={doctor.id} selectedSlot={slot} onSelectSlot={setSlot} />
          ) : (
            <p className="empty-state">Elegí un doctor para ver su disponibilidad.</p>
          )}

          {slot && patient && newPatientReady && doctor && (
            <div className="confirm-inline">
              <h3>3 · Confirmar</h3>
              <dl className="summary">
                <div><dt>Paciente</dt><dd>{patient.exists ? patient.name : name.trim()}</dd></div>
                <div><dt>CI</dt><dd>{formatCI(patient.ci)}</dd></div>
                <div><dt>Doctor</dt><dd>{doctor.full_name}</dd></div>
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
