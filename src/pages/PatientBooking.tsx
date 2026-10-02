import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AvailabilityPicker } from "../components/AvailabilityPicker";
import { DoctorList } from "../components/DoctorList";
import { Icon } from "../components/Icon";
import { StepIndicator } from "../components/StepIndicator";
import { formatCI, formatDateLong, formatTime, onlyDigits, toISODate } from "../lib/format";
import {
  TOO_MANY_ATTEMPTS,
  checkPatientExists,
  createAppointment,
  extractFieldErrors,
  getDoctors,
  isTooManyAttempts,
  type ApiFieldErrors,
  type Appointment,
  type Doctor,
  type Slot,
} from "../services/api";

type Step = "ci" | "datos" | "doctor" | "confirmar" | "exito";

const STEPS: Step[] = ["ci", "datos", "doctor", "confirmar", "exito"];

const STEP_INDEX: Record<Step, number> = { ci: 0, datos: 0, doctor: 1, confirmar: 3, exito: 3 };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PatientBooking() {
  // El paso va en la URL (?paso=...) para que "atrás"/"adelante" del navegador recorran el flujo.
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedParam = searchParams.get("paso") as Step | null;
  const requestedStep: Step = requestedParam && STEPS.includes(requestedParam) ? requestedParam : "ci";

  const [ci, setCi] = useState("");
  const [ciError, setCiError] = useState("");
  const [checking, setChecking] = useState(false);
  // null = todavía no se verificó. Guarda la CI verificada: si el paciente vuelve y la cambia, hay que revalidar.
  // Si existe, solo tenemos el nombre (el backend no expone más).
  const [patient, setPatient] = useState<{ ci: string; exists: boolean; name: string } | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dataErrors, setDataErrors] = useState<Record<string, string>>({});

  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ApiFieldErrors>({});
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);

  useEffect(() => {
    getDoctors()
      .then((list) => {
        setDoctors(list);
        if (list.length > 0) setDoctor((current) => current ?? list[0]);
      })
      .catch(() => setDoctors([]));
  }, []);

  function go(next: Step, options?: { replace?: boolean }) {
    setSearchParams(next === "ci" ? {} : { paso: next }, options);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const back = () => navigate(-1);

  async function handleIdentify(e: FormEvent) {
    e.preventDefault();
    if (ci.length < 4) {
      setCiError("Ingresá tu número de CI completo, solo números.");
      return;
    }
    setCiError("");
    setChecking(true);
    try {
      const result = await checkPatientExists(ci);
      if (patient && patient.ci !== ci) {
        // Volvió atrás y cambió de CI: no arrastrar datos ni horario del intento anterior.
        setName("");
        setPhone("");
        setEmail("");
        setSlot(null);
      }
      if (result.exists) {
        setPatient({ ci, exists: true, name: result.name ?? "" });
        go("doctor");
      } else {
        setPatient({ ci, exists: false, name: "" });
        go("datos");
      }
    } catch (err) {
      setCiError(
        isTooManyAttempts(err) ? TOO_MANY_ATTEMPTS : "No pudimos verificar tu CI. Revisá tu conexión e intentá de nuevo."
      );
    } finally {
      setChecking(false);
    }
  }

  function handleNewPatientData(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Ingresá tu nombre completo.";
    if (onlyDigits(phone).length < 6) found.phone = "Ingresá un número de teléfono válido.";
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) found.email = "Revisá el formato del correo.";
    setDataErrors(found);
    if (Object.keys(found).length === 0) go("doctor");
  }

  function handleSelectDoctor(d: Doctor) {
    if (d.id === doctor?.id) return;
    setDoctor(d);
    setSlot(null);
  }

  function handleSelectSlot(s: Slot) {
    setSlot(s);
    setErrors({});
    go("confirmar");
  }

  async function handleConfirm() {
    if (!doctor || !slot) return;
    setSubmitting(true);
    setErrors({});
    try {
      const appointment = await createAppointment({
        document_number: ci,
        doctor: doctor.id,
        start_datetime: slot.start_datetime,
        notes: reason.trim(),
        ...(patient?.exists ? {} : { name: name.trim(), phone: phone.trim(), email: email.trim() }),
      });
      setConfirmed(appointment);
      setReason("");
      // replace: "atrás" desde el éxito no debe volver a la confirmación de un turno ya creado.
      go("exito", { replace: true });
    } catch (err) {
      setErrors(extractFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setCi("");
    setPatient(null);
    setName("");
    setPhone("");
    setEmail("");
    setDataErrors({});
    setSlot(null);
    setReason("");
    setErrors({});
    setConfirmed(null);
    go("ci", { replace: true });
  }

  const patientName = patient?.exists ? patient.name : name.trim();
  const slotTaken = Boolean(errors.start_datetime);

  // Cada paso exige los datos de los anteriores. Si faltan (recargó la página, abrió un link
  // con ?paso=..., o cambió la CI y avanzó con "adelante"), se lo manda al paso que corresponde.
  const identified = patient !== null && patient.ci === ci;
  const dataReady = identified && (patient.exists || (name.trim() !== "" && onlyDigits(phone).length >= 6));
  const allowed: Record<Step, boolean> = {
    ci: true,
    datos: identified && !patient.exists,
    doctor: dataReady,
    confirmar: dataReady && doctor !== null && slot !== null,
    exito: confirmed !== null,
  };
  const step: Step = allowed[requestedStep] ? requestedStep : dataReady ? "doctor" : "ci";
  if (step !== requestedStep) {
    return <Navigate to={step === "ci" ? "/agendar" : `/agendar?paso=${step}`} replace />;
  }

  if (step === "ci") {
    return (
      <div className="hero">
        <div className="card hero-card">
          <div className="eyebrow">Agenda online</div>
          <h1>Agendá tu consulta de forma simple.</h1>
          <p>
            Ingresá tu número de documento para consultar si ya tenemos tus datos y elegí el doctor, el día y el
            horario que prefieras. Sin crear cuenta ni contraseña.
          </p>
          <StepIndicator current={0} />
        </div>

        <form className="card booking-card" onSubmit={handleIdentify}>
          <h2>Comenzar</h2>
          <div className="sub">Solo necesitamos tu CI para empezar.</div>
          <div className="field">
            <label htmlFor="ci">Número de documento (CI)</label>
            <input
              id="ci"
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ej. 4567890"
              maxLength={15}
              value={ci}
              onChange={(e) => setCi(onlyDigits(e.target.value))}
              autoFocus
            />
            <span className="field-hint">Solo números, sin puntos, comas ni guiones.</span>
          </div>
          {ciError && <p className="error-text">{ciError}</p>}
          <button className="button button-block" type="submit" disabled={checking}>
            {checking ? "Verificando..." : "Continuar"}
          </button>
          <div className="notice">
            Si es tu primera consulta, después te vamos a pedir tu nombre y teléfono. El correo electrónico es
            opcional.
          </div>
        </form>
      </div>
    );
  }

  if (step === "datos") {
    return (
      <>
        <StepIndicator current={STEP_INDEX.datos} />
        <form className="card narrow-card" onSubmit={handleNewPatientData}>
          <div className="eyebrow">Nuevo paciente</div>
          <h2>Completá tus datos</h2>
          <div className="sub">No encontramos una ficha previa con el CI {formatCI(ci)}.</div>
          <div className="field">
            <label htmlFor="name">Nombre completo</label>
            <input id="name" placeholder="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} />
            {dataErrors.name && <p className="error-text">{dataErrors.name}</p>}
          </div>
          <div className="field">
            <label htmlFor="phone">Teléfono</label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              placeholder="0981 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {dataErrors.phone && <p className="error-text">{dataErrors.phone}</p>}
          </div>
          <div className="field">
            <label htmlFor="email">
              Correo electrónico <span className="optional">(opcional)</span>
            </label>
            <input
              id="email"
              type="email"
              placeholder="nombre@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {dataErrors.email && <p className="error-text">{dataErrors.email}</p>}
          </div>
          <button className="button button-block" type="submit">
            Continuar al agendamiento
          </button>
          <button className="button button-secondary button-block" type="button" onClick={back}>
            Volver
          </button>
        </form>
      </>
    );
  }

  if (step === "doctor") {
    return (
      <>
        <StepIndicator current={doctor ? 2 : 1} />
        <div className="title-row">
          <div>
            <h2>{patient?.exists ? `Hola, ${patientName}` : "Elegí un doctor"}</h2>
            <div className="sub">Seleccioná con quién querés consultar y elegí un día con turnos libres.</div>
          </div>
          <button className="button button-secondary" onClick={back}>
            Volver
          </button>
        </div>
        <div className="booking-grid">
          <div className="card card-pad">
            {doctors === null ? <p className="sub">Cargando doctores...</p> : (
              <DoctorList doctors={doctors} selectedId={doctor?.id ?? null} onSelect={handleSelectDoctor} />
            )}
          </div>
          <div className="card card-pad">
            {doctor ? (
              <AvailabilityPicker key={doctor.id} doctorId={doctor.id} selectedSlot={slot} onSelectSlot={handleSelectSlot} />
            ) : (
              <p className="empty-state">Elegí un doctor para ver su disponibilidad.</p>
            )}
          </div>
        </div>
      </>
    );
  }

  if (step === "confirmar" && doctor && slot) {
    return (
      <>
        <StepIndicator current={STEP_INDEX.confirmar} />
        <div className="card narrow-card">
          <div className="eyebrow">Confirmar turno</div>
          <h2>Revisá los datos</h2>
          <dl className="summary">
            <div><dt>Paciente</dt><dd>{patientName}</dd></div>
            <div><dt>CI</dt><dd>{formatCI(ci)}</dd></div>
            <div><dt>Doctor</dt><dd>{doctor.full_name}</dd></div>
            <div><dt>Fecha</dt><dd>{formatDateLong(toISODate(new Date(slot.start_datetime)))}</dd></div>
            <div><dt>Horario</dt><dd>{formatTime(slot.start_datetime)}</dd></div>
          </dl>
          <div className="field">
            <label htmlFor="reason">
              Motivo de la consulta <span className="optional">(opcional)</span>
            </label>
            <input
              id="reason"
              placeholder="Ej. Control, dolor de muela, limpieza..."
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {Object.entries(errors).map(([field, messages]) => (
            <p key={field} className="error-text">
              {Array.isArray(messages) ? messages.join(" ") : String(messages)}
            </p>
          ))}

          {slotTaken ? (
            <button className="button button-block" onClick={back}>
              Elegir otro horario
            </button>
          ) : (
            <button className="button button-block" onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Agendando..." : "Confirmar agendamiento"}
            </button>
          )}
          <button className="button button-secondary button-block" onClick={back} disabled={submitting}>
            Cambiar horario
          </button>
        </div>
      </>
    );
  }

  if (step === "exito" && confirmed) {
    return (
      <div className="card narrow-card success-card">
        <div className="success-icon">
          <Icon name="check" size={30} />
        </div>
        <h2>Turno confirmado</h2>
        <p className="sub">
          Tu consulta quedó registrada. Presentate unos minutos antes de la hora indicada. Para consultar o cancelar
          tu turno, comunicate con la clínica indicando tu CI.
        </p>
        <dl className="summary">
          <div><dt>Paciente</dt><dd>{confirmed.patient_name}</dd></div>
          <div><dt>CI</dt><dd>{formatCI(confirmed.patient)}</dd></div>
          <div><dt>Doctor</dt><dd>{confirmed.doctor_name}</dd></div>
          <div><dt>Fecha</dt><dd>{formatDateLong(toISODate(new Date(confirmed.start_datetime)))}</dd></div>
          <div><dt>Horario</dt><dd>{formatTime(confirmed.start_datetime)}</dd></div>
        </dl>
        <button className="button" onClick={restart}>
          Nuevo agendamiento
        </button>
      </div>
    );
  }

  return null;
}
