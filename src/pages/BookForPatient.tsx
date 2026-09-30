import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AvailabilityCalendar } from "../components/AvailabilityCalendar";
import { useAuth } from "../context/AuthContext";
import {
  checkPatientExists,
  createAppointment,
  extractFieldErrors,
  getAvailability,
  getDoctors,
  type ApiFieldErrors,
  type Doctor,
  type Slot,
} from "../services/api";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BookForPatient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "ADMIN";

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [myDoctorId, setMyDoctorId] = useState<number | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null);

  const [documentNumber, setDocumentNumber] = useState("");
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [knownPatient, setKnownPatient] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [date, setDate] = useState(todayISO());
  const [showAvailability, setShowAvailability] = useState(false);
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ApiFieldErrors>({});

  useEffect(() => {
    getDoctors().then((list) => {
      setDoctors(list);
      if (!isAdmin && user) {
        const mine = list.find((d) => d.email === user.email);
        if (mine) {
          setMyDoctorId(mine.id);
          setSelectedDoctor(mine.id);
        }
      }
    });
  }, [isAdmin, user]);

  const activeDoctor = isAdmin ? selectedDoctor : myDoctorId;

  async function handleShowAvailability() {
    if (!checked || !activeDoctor || !date) return;
    setShowAvailability(true);
    setLoadingAvailability(true);
    setSelectedSlot(null);
    try {
      setAvailability(await getAvailability(activeDoctor, date));
    } catch {
      setAvailability([]);
    } finally {
      setLoadingAvailability(false);
    }
  }

  function handleSelectDate(iso: string) {
    setDate(iso);
    setShowAvailability(false);
    setSelectedSlot(null);
  }

  async function handleCheckCedula() {
    const trimmed = documentNumber.trim();
    if (!trimmed) return;
    setChecking(true);
    setErrors({});
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
      // No pudimos verificar (red/servidor): seguimos igual, se completa
      // como paciente nuevo en vez de bloquear el agendamiento.
      setKnownPatient(false);
      setName("");
    } finally {
      setChecking(false);
      setChecked(true);
    }
  }

  async function handleSubmit() {
    if (!activeDoctor || !selectedSlot) return;
    setSubmitting(true);
    setErrors({});
    try {
      await createAppointment({
        document_number: documentNumber.trim(),
        name,
        phone,
        email,
        doctor: activeDoctor,
        start_datetime: selectedSlot,
        notes: notes || undefined,
      });
      navigate(`/pacientes/${documentNumber.trim()}`);
    } catch (err) {
      setErrors(extractFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow">
      <h2>Agendar cita a un paciente</h2>

      <div className="card">
        <div className="field field-inline">
          <label htmlFor="cedula">Cédula del paciente</label>
          <input
            id="cedula"
            value={documentNumber}
            onChange={(e) => {
              setDocumentNumber(e.target.value);
              setChecked(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCheckCedula()}
          />
          <button className="button" onClick={handleCheckCedula} disabled={checking}>
            {checking ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {checked && (
          <>
            <p className="hint-text">
              {knownPatient
                ? `Paciente reconocido: ${name}. Confirmá sus datos de contacto.`
                : "Paciente nuevo: completá sus datos."}
            </p>

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

            {isAdmin && (
              <div className="field">
                <label htmlFor="doctor">Doctor</label>
                <select
                  id="doctor"
                  value={selectedDoctor ?? ""}
                  onChange={(e) => {
                    setSelectedDoctor(Number(e.target.value) || null);
                    setShowAvailability(false);
                  }}
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

            {activeDoctor && (
              <>
                <AvailabilityCalendar selectedDate={date} onSelectDate={handleSelectDate} />

                {!showAvailability ? (
                  <button className="button button-block" onClick={handleShowAvailability}>
                    Ver detalles del {new Date(date + "T00:00:00").toLocaleDateString("es-UY")}
                  </button>
                ) : (
                  <div className="field">
                    <label>Horarios disponibles</label>
                    {loadingAvailability ? (
                      <p className="hint-text">Buscando horarios...</p>
                    ) : availability.length === 0 ? (
                      <p className="hint-text">No hay horarios libres ese día.</p>
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

            <div className="field">
              <label htmlFor="notes">Notas (opcional)</label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {errors.non_field_errors && (
              <p className="error-text">{errors.non_field_errors.join(" ")}</p>
            )}

            <button
              className="button"
              onClick={handleSubmit}
              disabled={submitting || !activeDoctor || !selectedSlot || !name || !phone || !email}
            >
              {submitting ? "Agendando..." : "Confirmar cita"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
