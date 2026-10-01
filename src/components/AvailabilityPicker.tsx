import { useEffect, useRef, useState } from "react";
import { formatDateLong, formatMonthYear, formatTime, toISODate, todayISO } from "../lib/format";
import { getAvailability, getAvailableDays, type Slot } from "../services/api";
import { Icon } from "./Icon";

const WEEKDAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

/** Celdas del mes (lunes a domingo), con null en los huecos del inicio. */
function monthCells(year: number, month: number) {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISODate(new Date(year, month, d)));
  return cells;
}

/** Rango a consultar: del mes visible, solo desde hoy en adelante. null si el mes ya pasó. */
function monthRange(year: number, month: number) {
  const today = todayISO();
  const first = toISODate(new Date(year, month, 1));
  const last = toISODate(new Date(year, month + 1, 0));
  if (last < today) return null;
  return { start: first < today ? today : first, end: last };
}

interface Props {
  /** Usar `key={doctorId}` en el padre: al cambiar de doctor se reinicia todo. */
  doctorId: number;
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
}

export function AvailabilityPicker({ doctorId, selectedSlot, onSelectSlot }: Props) {
  const now = new Date();
  // Al volver desde la confirmación ("Cambiar horario") se reabre en el día ya elegido.
  const [initialDate] = useState(() => (selectedSlot ? toISODate(new Date(selectedSlot.start_datetime)) : null));
  const [view, setView] = useState(() => {
    const base = selectedSlot ? new Date(selectedSlot.start_datetime) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const viewKey = `${view.year}-${view.month}`;
  const [days, setDays] = useState<{ key: string; available: Set<string>; failed: boolean }>({
    key: "",
    available: new Set(),
    failed: false,
  });
  const loadingDays = days.key !== viewKey;

  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsFailed, setSlotsFailed] = useState(false);
  const slotRequest = useRef(0);
  // Si el mes en el que se abre no tiene días libres (típico a fin de mes), se pasa solo al siguiente, una vez.
  const autoAdvancePending = useRef(initialDate === null);

  useEffect(() => {
    if (!initialDate) return;
    const requestId = ++slotRequest.current;
    getAvailability(doctorId, initialDate)
      .then((result) => {
        if (requestId === slotRequest.current) setSlots(result);
      })
      .catch(() => {
        if (requestId === slotRequest.current) setSlotsFailed(true);
      });
  }, [doctorId, initialDate]);

  useEffect(() => {
    let ignore = false;
    const range = monthRange(view.year, view.month);
    const request = range ? getAvailableDays(doctorId, range.start, range.end) : Promise.resolve([]);
    request
      .then((result) => {
        if (ignore) return;
        if (autoAdvancePending.current) {
          autoAdvancePending.current = false;
          if (result.length === 0) {
            const next = new Date(view.year, view.month + 1, 1);
            setView({ year: next.getFullYear(), month: next.getMonth() });
            return;
          }
        }
        setDays({ key: viewKey, available: new Set(result.map((d) => d.date)), failed: false });
      })
      .catch(() => {
        if (!ignore) setDays({ key: viewKey, available: new Set(), failed: true });
      });
    return () => {
      ignore = true;
    };
  }, [doctorId, view.year, view.month, viewKey]);

  async function selectDate(iso: string) {
    const requestId = ++slotRequest.current;
    setSelectedDate(iso);
    setSlots(null);
    setSlotsFailed(false);
    try {
      const result = await getAvailability(doctorId, iso);
      if (requestId === slotRequest.current) setSlots(result);
    } catch {
      if (requestId === slotRequest.current) setSlotsFailed(true);
    }
  }

  function changeMonth(delta: number) {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  }

  const isCurrentMonth = view.year === now.getFullYear() && view.month === now.getMonth();
  const today = todayISO();

  return (
    <div>
      <div className="cal-head">
        <button className="cal-nav" onClick={() => changeMonth(-1)} disabled={isCurrentMonth} aria-label="Mes anterior">
          <Icon name="chevronLeft" />
        </button>
        <strong>{formatMonthYear(view.year, view.month)}</strong>
        <button className="cal-nav" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
          <Icon name="chevronRight" />
        </button>
      </div>

      <div className="cal-dow">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className={`cal-days ${loadingDays ? "is-loading" : ""}`}>
        {monthCells(view.year, view.month).map((iso, i) => {
          if (!iso) return <div key={`empty-${i}`} className="cal-day empty" />;
          const available = !loadingDays && days.available.has(iso);
          const classes = [
            "cal-day",
            available ? "available" : "off",
            iso === selectedDate ? "selected" : "",
            iso === today ? "today" : "",
          ].join(" ");
          return (
            <button
              key={iso}
              className={classes}
              disabled={!available}
              aria-pressed={iso === selectedDate}
              aria-label={`${formatDateLong(iso)}${available ? "" : ", sin disponibilidad"}`}
              onClick={() => selectDate(iso)}
            >
              <span className="num">{Number(iso.slice(8))}</span>
              {available && <span className="cal-dot" />}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span>
          <i className="cal-dot" /> Con turnos libres
        </span>
        <span>
          <i className="cal-dot off" /> Sin disponibilidad
        </span>
      </div>
      {!loadingDays && days.failed && <p className="error-text">No pudimos cargar la disponibilidad. Intentá de nuevo.</p>}
      {!loadingDays && !days.failed && days.available.size === 0 && (
        <p className="sub">No hay días con turnos libres en este mes. Probá con el mes siguiente.</p>
      )}

      <div className="slots">
        {!selectedDate ? (
          <>
            <b>Seleccioná un día disponible</b>
            <div className="sub">Los horarios se van a mostrar acá.</div>
          </>
        ) : (
          <>
            <b>Horarios disponibles · {formatDateLong(selectedDate)}</b>
            {slotsFailed ? (
              <p className="error-text">No pudimos cargar los horarios. Intentá de nuevo.</p>
            ) : slots === null ? (
              <p className="sub">Buscando horarios...</p>
            ) : slots.length === 0 ? (
              <p className="sub">Ya no quedan horarios libres ese día. Elegí otro.</p>
            ) : (
              <div className="slot-grid">
                {slots.map((slot) => (
                  <button
                    key={slot.start_datetime}
                    className={`slot ${selectedSlot?.start_datetime === slot.start_datetime ? "selected" : ""}`}
                    onClick={() => onSelectSlot(slot)}
                  >
                    {formatTime(slot.start_datetime)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
