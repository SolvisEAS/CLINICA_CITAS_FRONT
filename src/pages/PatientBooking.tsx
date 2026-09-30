import { useEffect, useState } from "react";
import { AvailabilityCalendar } from "../components/AvailabilityCalendar";
import {
  checkPatientExists,
  createAppointment,
  extractFieldErrors,
  getAvailability,
  getDoctors,
  type ApiFieldErrors,
  type Appointment,
  type Doctor,
  type Slot,
} from "../services/api";

type Step = "cedula" | "datos" | "confirmada";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PatientBooking() {
  const [step, setStep] = useState<Step>("cedula");

  const [documentNumber, setDocumentNumber] = useState("");
  const [checking, setChecking] = useState(false);
  const [knownPatient, setKnownPatient] = useState(false);
  const [cedulaError, setCedulaError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [showAvailability, setShowAvailability] = useState(false);
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ApiFieldErrors>({});
  const [confirmed, setConfirmed] = useState<Appointment | null>(null);

  useEffect(() => {
    getDoctors().then(setDoctors).catch(() => setDoctors([]));
  }, []);

  async function handleShowAvailability() {
    if (!selectedDoctor || !date) return;
    setShowAvailability(true);
    setLoadingAvailability(true);
    setSelectedSlot(null);
    try {
      setAvailability(await getAvailability(selectedDoctor, date));
    } catch {
      setAvailability([]);
    } finally {
      setLoadingAvailability(false);
    }
  }

  function handleSelectDoctor(id: number | null) {
    setSelectedDoctor(id);
    setShowAvailability(false);
    setAvailability([]);
    setSelectedSlot(null);
  }

  function handleSelectDate(iso: string) {
    setDate(iso);
    setShowAvailability(false);
    setSelectedSlot(null);
  }

  async function handleCheckCedula() {
    const trimmed = documentNumber.trim();
    if (!trimmed) {
      setCedulaError("Ingresá tu cédula para continuar.");
      return;
    }
    setCedulaError("");
    setChecking(true);
    try {
      const result = await checkPatientExists(trimmed);
      if (result.exists) {
        setKnownPatient(true);
        setName(result.name ?? "");
      } else {
        setKnownPatient(false);
        setName("");
      }
    } catch {
      // No pudimos verificar (red/servidor): seguimos igual y pedimos
      // los datos como si fuera la primera vez, no bloqueamos la reserva.
      setKnownPatient(false);
      setName("");
    } finally {
      setChecking(false);
      setStep("datos");
    }
  }

  async function handleSubmit() {
    if (!selectedDoctor || !selectedSlot) return;
    setSubmitting(true);
    setErrors({});
    try {
      const appointment = await createAppointment({
        document_number: documentNumber.trim(),
        name,
        phone,
        email,
        doctor: selectedDoctor,
        start_datetime: selectedSlot,
        notes: notes || undefined,
      });
      setConfirmed(appointment);
      setStep("confirmada");
    } catch (err) {
      setErrors(extractFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  }

  function resetAll() {
    setStep("cedula");
    setDocumentNumber("");
    setKnownPatient(false);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setSelectedDoctor(null);
    setShowAvailability(false);
    setSelectedSlot(null);
    setAvailability([]);
    setErrors({});
    setConfirmed(null);
  }

  if (step === "confirmada" && confirmed) {
    return (
      <div className="page-narrow">
        <div className="card card-success">
          <h2>Cita confirmada</h2>
          <p>
            Quedó agendada tu cita con <strong>{confirmed.doctor_name}</strong> el{" "}
            <strong>{new Date(confirmed.start_datetime).toLocaleString("es-UY")}</strong>.
          </p>
          <p>
            Guardá tu cédula (<strong>{confirmed.patient}</strong>): la vas a necesitar para
            consultar, cambiar o cancelar tu cita más adelante.
          </p>
          <button className="button" onClick={resetAll}>
            Agendar otra cita
          </button>
        </div>
      </div>
    );
  }

  if (step === "cedula") {
    return (
      <div className="page-narrow">
        <div className="hero-text">
          <h1>Reservá tu cita</h1>
          <p className="hint-text">Rápido, sin cuenta ni contraseña.</p>
        </div>
        <div className="card">
          <p>Ingresá tu cédula de identidad para empezar.</p>
          <div className="field">
            <label htmlFor="cedula">Cédula de identidad</label>
            <input
              id="cedula"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheckCedula()}
              placeholder="Ej: 4.123.456-7"
              autoFocus
            />
          </div>
          {cedulaError && <p className="error-text">{cedulaError}</p>}
          <button className="button button-block" onClick={handleCheckCedula} disabled={checking}>
            {checking ? "Verificando..." : "Continuar"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wide">
      <button className="link-button" onClick={() => setStep("cedula")}>
        &larr; Cambiar cédula
      </button>
      <h2>Reservar una cita</h2>

      <div className="booking-layout">
        <div className="card">
          <h3>Tus datos</h3>
          {knownPatient ? (
            <p className="hint-text">
              ¡Hola de nuevo, {name}! Confirmá tus datos de contacto para agendar.
            </p>
          ) : (
            <p className="hint-text">
              No encontramos esa cédula: completá tus datos para tu primera cita.
            </p>
          )}

          <div className="field">
            <label htmlFor="name">Nombre completo</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name && <p className="error-text">{errors.name.join(" ")}</p>}
          </div>
          <div className="field">
            <label htmlFor="phone">Teléfono</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {errors.phone && <p className="error-text">{errors.phone.join(" ")}</p>}
          </div>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <p className="error-text">{errors.email.join(" ")}</p>}
          </div>
          <div className="field">
            <label htmlFor="notes">Notas (opcional)</label>
            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <h3>Elegí doctor y horario</h3>
          {doctors.length === 0 ? (
            <p className="empty-state">Todavía no hay doctores disponibles para reservar.</p>
          ) : (
            <div className="field">
              <label htmlFor="doctor">Doctor</label>
              <select
                id="doctor"
                value={selectedDoctor ?? ""}
                onChange={(e) => handleSelectDoctor(Number(e.target.value) || null)}
              >
                <option value="">Seleccioná un doctor</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} — {d.specialty}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedDoctor && (
            <>
              <AvailabilityCalendar selectedDate={date} onSelectDate={handleSelectDate} />

              {!showAvailability ? (
                <button className="button button-block" onClick={handleShowAvailability}>
                  Ver detalles del {new Date(date + "T00:00:00").toLocaleDateString("es-UY")}
                </button>
              ) : (
                <div className="field">
                  <label>
                    Horarios disponibles el{" "}
                    {new Date(date + "T00:00:00").toLocaleDateString("es-UY", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </label>
                  {loadingAvailability ? (
                    <p className="hint-text">Buscando horarios...</p>
                  ) : availability.length === 0 ? (
                    <p className="hint-text">No hay horarios libres ese día. Probá otro día.</p>
                  ) : (
                    <div className="slot-grid">
                      {availability.map((slot) => (
                        <button
                          key={slot.start_datetime}
                          className={`slot-button ${
                            selectedSlot === slot.start_datetime ? "slot-button-active" : ""
                          }`}
                          onClick={() => setSelectedSlot(slot.start_datetime)}
                        >
                          {new Date(slot.start_datetime).toLocaleTimeString("es-UY", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.start_datetime && (
                    <p className="error-text">{errors.start_datetime.join(" ")}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {errors.non_field_errors && <p className="error-text">{errors.non_field_errors.join(" ")}</p>}

      <button
        className="button button-block button-confirm"
        onClick={handleSubmit}
        disabled={submitting || !selectedDoctor || !selectedSlot || !name || !phone || !email}
      >
        {submitting ? "Agendando..." : "Confirmar cita"}
      </button>
    </div>
  );
}
