import { useState } from "react";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toISO(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m - 1, day: d };
}

/** Matriz de semanas (lunes a domingo) para un mes, con null en los huecos. */
function buildMonthMatrix(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=domingo..6=sábado -> lo pasamos a 0=lunes..6=domingo
  const leading = (firstDay.getDay() + 6) % 7;

  const cells: (number | null)[] = Array(leading).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

interface Props {
  selectedDate: string;
  onSelectDate: (iso: string) => void;
}

export function AvailabilityCalendar({ selectedDate, onSelectDate }: Props) {
  const selected = parseISO(selectedDate);
  const [viewYear, setViewYear] = useState(selected.year);
  const [viewMonth, setViewMonth] = useState(selected.month);

  const today = new Date();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const weeks = buildMonthMatrix(viewYear, viewMonth);

  function goToPrevMonth() {
    const prev = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(prev.getFullYear());
    setViewMonth(prev.getMonth());
  }

  function goToNextMonth() {
    const next = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button className="link-button" onClick={goToPrevMonth} aria-label="Mes anterior">
          &larr;
        </button>
        <strong>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </strong>
        <button className="link-button" onClick={goToNextMonth} aria-label="Mes siguiente">
          &rarr;
        </button>
      </div>
      <div className="calendar-grid calendar-weekdays">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      {weeks.map((week, i) => (
        <div className="calendar-grid" key={i}>
          {week.map((day, j) => {
            if (day === null) return <span key={j} />;
            const iso = toISO(viewYear, viewMonth, day);
            const isPast = iso < todayISO;
            const isSelected = iso === selectedDate;
            const isToday = iso === todayISO;
            return (
              <button
                key={j}
                className={[
                  "calendar-day",
                  isSelected && "calendar-day-selected",
                  isToday && !isSelected && "calendar-day-today",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={isPast}
                onClick={() => onSelectDate(iso)}
              >
                {day}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
