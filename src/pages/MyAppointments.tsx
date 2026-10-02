import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AvailabilityPicker } from "../components/AvailabilityPicker";
import { DoctorList } from "../components/DoctorList";
import { Icon } from "../components/Icon";
import { STATUS_LABEL, formatCI, formatDateLong, formatDateShort, formatTime, onlyDigits, toISODate } from "../lib/format";
import {
  TOO_MANY_ATTEMPTS,
  extractFieldErrors,
  getDoctors,
  getMyAppointments,
  isTooManyAttempts,
  modifyMyAppointment,
  type ApiFieldErrors,
  type Doctor,
  type PublicAppointment,
  type Slot,
} from "../services/api";

type Step = "ci" | "lista" | "modificar" | "confirmar" | "exito";
const STEPS: Step[] = ["ci", "lista", "modificar", "confirmar", "exito"];

function longDate(datetime: string) {
  return formatDateLong(toISODate(new Date(datetime)));
}

export default function MyAppointments() {
  // El paso va en la URL (?paso=...) para que "atrás"/"adelante" del navegador recorran el flujo.
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedParam = searchParams.get("paso") as Step | null;
  const requestedStep: Step = requestedParam && STEPS.includes(requestedParam) ? requestedParam : "ci";

  const [ci, setCi] = useState("");
  const [ciError, setCiError] = useState("");
  const [checking, setChecking] = useState(false);
  // CI consultada y sus consultas futuras. Si la CI del campo cambia, hay que volver a consultar.
  const [lookup, setLookup] = useState<{ ci: string; items: PublicAppointment[] } | null>(null);

  const [selected, setSelected] = useState<PublicAppointment | null>(null);
  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [newDoctor, setNewDoctor] = useState<Doctor | null>(null);
  const [newSlot, setNewSlot] = useState<Slot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ApiFieldErrors>({});
  const [done, setDone] = useState<PublicAppointment | null>(null);

  useEffect(() => {
    getDoctors()
      .then(setDoctors)
      .catch(() => setDoctors([]));
  }, []);

  function go(next: Step, options?: { replace?: boolean }) {
    setSearchParams(next === "ci" ? {} : { paso: next }, options);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const back = () => navigate(-1);

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    if (ci.length < 4) {
      setCiError("Ingresá tu número de CI completo, solo números.");
      return;
    }
    setCiError("");
    setChecking(true);
    try {
      setLookup({ ci, items: await getMyAppointments(ci) });
      go("lista");
    } catch (err) {
      setCiError(
        isTooManyAttempts(err) ? TOO_MANY_ATTEMPTS : "No pudimos consultar tus citas. Revisá tu conexión e intentá de nuevo."
      );
    } finally {
      setChecking(false);
    }
  }

  function startModify(appointment: PublicAppointment) {
    setSelected(appointment);
    setNewDoctor(doctors?.find((d) => d.id === appointment.doctor) ?? null);
    setNewSlot(null);
    setErrors({});
    go("modificar");
  }

  function handleSelectDoctor(d: Doctor) {
    if (d.id === newDoctor?.id) return;
    setNewDoctor(d);
    setNewSlot(null);
  }

  function handleSelectSlot(slot: Slot) {
    setNewSlot(slot);
    setErrors({});
    go("confirmar");
  }

  async function handleConfirm() {
    if (!lookup || !selected || !newDoctor || !newSlot) return;
    setSubmitting(true);
    setErrors({});
    try {
      const updated = await modifyMyAppointment(lookup.ci, selected.id, {
        start_datetime: newSlot.start_datetime,
        ...(newDoctor.id !== selected.doctor ? { doctor: newDoctor.id } : {}),
      });
      setLookup({
        ci: lookup.ci,
        items: lookup.items
          .map((a) => (a.id === updated.id ? updated : a))
          .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime)),
      });
      setDone(updated);
      // replace: "atrás" desde el éxito no debe volver a confirmar un cambio ya hecho.
      go("exito", { replace: true });
    } catch (err) {
      setErrors(extractFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Cada paso exige los datos de los anteriores; si faltan (recarga, link directo, cambió la
  // CI y avanzó con "adelante"), se lo manda al paso que corresponde.
  const listed = lookup !== null && lookup.ci === ci;
  const allowed: Record<Step, boolean> = {
    ci: true,
    lista: listed,
    modificar: listed && selected !== null && selected.can_modify,
    confirmar: listed && selected !== null && newDoctor !== null && newSlot !== null,
    exito: done !== null,
  };
  const step: Step = allowed[requestedStep] ? requestedStep : listed ? "lista" : "ci";
  if (step !== requestedStep) {
    return <Navigate to={step === "ci" ? "/mis-consultas" : `/mis-consultas?paso=${step}`} replace />;
  }

  if (step === "ci") {
    return (
      <form className="card narrow-card" onSubmit={handleLookup}>
        <div className="eyebrow">Mis consultas</div>
        <h2>Consultá tus próximas citas</h2>
        <div className="sub">Ingresá tu número de CI para ver las consultas que tenés agendadas.</div>
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
          {checking ? "Consultando..." : "Consultar"}
        </button>
      </form>
    );
  }

  if (step === "lista" && lookup) {
    return (
      <>
        <div className="title-row">
          <div>
            <h2>Mis consultas futuras</h2>
            <div className="sub">CI {formatCI(lookup.ci)}</div>
          </div>
          <button className="button button-secondary" onClick={back}>
            Cambiar CI
          </button>
        </div>
        {lookup.items.length === 0 ? (
          <div className="card narrow-card">
            <p className="empty-state">No encontramos consultas futuras asociadas a este número de CI.</p>
            <Link className="button button-block" to="/agendar">
              Agendar una consulta
            </Link>
          </div>
        ) : (
          <div className="appointment-cards">
            {lookup.items.map((a) => (
              <article key={a.id} className="card appointment-card">
                <div className="appointment-when">
                  <strong>{formatDateShort(a.start_datetime)}</strong>
                  <span>{formatTime(a.start_datetime)}</span>
                </div>
                <div className="appointment-what">
                  <small>{longDate(a.start_datetime)}</small>
                  <b>{a.doctor_name}</b>
                  {a.doctor_specialty && <span>Especialidad: {a.doctor_specialty}</span>}
                  <span>
                    Estado: <span className={`tag tag-${a.status.toLowerCase()}`}>{STATUS_LABEL[a.status]}</span>
                  </span>
                </div>
                {a.can_modify && (
                  <button className="button button-secondary" onClick={() => startModify(a)}>
                    Modificar consulta
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </>
    );
  }

  if (step === "modificar" && selected) {
    return (
      <>
        <div className="title-row">
          <div>
            <h2>Modificar consulta</h2>
            <div className="sub">
              Actual: {selected.doctor_name} · {longDate(selected.start_datetime)} · {formatTime(selected.start_datetime)}
            </div>
          </div>
          <button className="button button-secondary" onClick={back}>
            Volver
          </button>
        </div>
        <div className="booking-grid">
          <div className="card card-pad">
            <h3>Doctor</h3>
            {doctors === null ? (
              <p className="sub">Cargando doctores...</p>
            ) : (
              <DoctorList doctors={doctors} selectedId={newDoctor?.id ?? null} onSelect={handleSelectDoctor} />
            )}
          </div>
          <div className="card card-pad">
            <h3>Nueva fecha y horario</h3>
            {newDoctor ? (
              <AvailabilityPicker key={newDoctor.id} doctorId={newDoctor.id} selectedSlot={newSlot} onSelectSlot={handleSelectSlot} />
            ) : (
              <p className="empty-state">Elegí un doctor para ver su disponibilidad.</p>
            )}
          </div>
        </div>
      </>
    );
  }

  if (step === "confirmar" && lookup && selected && newDoctor && newSlot) {
    const slotTaken = Boolean(errors.start_datetime);
    return (
      <div className="card narrow-card">
        <div className="eyebrow">Confirmar modificación</div>
        <h2>Revisá el cambio</h2>
        <div className="change-summary">
          <dl className="summary summary-muted">
            <div><dt>Antes</dt><dd /></div>
            <div><dt>Doctor</dt><dd>{selected.doctor_name}</dd></div>
            <div><dt>Fecha</dt><dd>{longDate(selected.start_datetime)}</dd></div>
            <div><dt>Horario</dt><dd>{formatTime(selected.start_datetime)}</dd></div>
          </dl>
          <dl className="summary">
            <div><dt>Ahora</dt><dd /></div>
            <div><dt>Doctor</dt><dd>{newDoctor.full_name}</dd></div>
            <div><dt>Fecha</dt><dd>{longDate(newSlot.start_datetime)}</dd></div>
            <div><dt>Horario</dt><dd>{formatTime(newSlot.start_datetime)}</dd></div>
          </dl>
        </div>
        <p className="sub">El horario anterior queda libre para otro paciente.</p>

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
            {submitting ? "Guardando..." : "Confirmar modificación"}
          </button>
        )}
        <button className="button button-secondary button-block" onClick={back} disabled={submitting}>
          Cambiar horario
        </button>
      </div>
    );
  }

  if (step === "exito" && done) {
    return (
      <div className="card narrow-card success-card">
        <div className="success-icon">
          <Icon name="check" size={30} />
        </div>
        <h2>Consulta modificada</h2>
        <p className="sub">Tu consulta quedó registrada con los nuevos datos.</p>
        <dl className="summary">
          <div><dt>CI</dt><dd>{formatCI(ci)}</dd></div>
          <div><dt>Doctor</dt><dd>{done.doctor_name}</dd></div>
          <div><dt>Fecha</dt><dd>{longDate(done.start_datetime)}</dd></div>
          <div><dt>Horario</dt><dd>{formatTime(done.start_datetime)}</dd></div>
        </dl>
        <div className="button-row">
          <button className="button" onClick={() => go("lista", { replace: true })}>
            Ver mis consultas
          </button>
          <Link className="button button-secondary" to="/">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
