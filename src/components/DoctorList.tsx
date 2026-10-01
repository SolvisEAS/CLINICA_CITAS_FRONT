import { initials } from "../lib/format";
import type { Doctor } from "../services/api";

interface Props {
  doctors: Doctor[];
  selectedId: number | null;
  onSelect: (doctor: Doctor) => void;
}

export function DoctorList({ doctors, selectedId, onSelect }: Props) {
  if (doctors.length === 0) {
    return <p className="empty-state">Todavía no hay doctores disponibles.</p>;
  }
  return (
    <div className="doctor-list">
      {doctors.map((d) => (
        <button
          key={d.id}
          className={`doctor-item ${d.id === selectedId ? "selected" : ""}`}
          aria-pressed={d.id === selectedId}
          onClick={() => onSelect(d)}
        >
          <span className="avatar">{initials(d.full_name)}</span>
          <span>
            <b>{d.full_name}</b>
            {d.specialty && <small>{d.specialty}</small>}
          </span>
        </button>
      ))}
    </div>
  );
}
