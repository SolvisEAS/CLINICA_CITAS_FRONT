import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatCI, initials, onlyDigits } from "../lib/format";
import { getPatients, type Patient } from "../services/api";

export default function Patients() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let ignore = false;
    getPatients(1)
      .then((res) => {
        if (ignore) return;
        setPatients(res.results);
        setNextPage(res.next ? 2 : null);
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function loadMore() {
    if (!nextPage) return;
    setLoadingMore(true);
    try {
      const res = await getPatients(nextPage);
      setPatients((prev) => [...(prev ?? []), ...res.results]);
      setNextPage(res.next ? nextPage + 1 : null);
    } catch {
      setFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const term = search.trim().toLowerCase();
  const termDigits = onlyDigits(term);
  const visible = (patients ?? []).filter(
    (p) => !term || p.name.toLowerCase().includes(term) || (termDigits && p.document_number.includes(termDigits))
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Pacientes</h2>
          <div className="sub">
            {user?.role === "ADMIN"
              ? "Todos los pacientes registrados en la clínica."
              : "Pacientes que tuvieron al menos un turno con vos."}
          </div>
        </div>
      </div>

      <div className="card card-pad">
        <input
          className="input"
          placeholder="Buscar por nombre o CI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {failed ? (
          <p className="error-text">No se pudo cargar la lista de pacientes.</p>
        ) : patients === null ? (
          <p className="sub">Cargando pacientes...</p>
        ) : visible.length === 0 ? (
          <p className="empty-state">{patients.length === 0 ? "Todavía no hay pacientes." : "Ningún paciente coincide con la búsqueda."}</p>
        ) : (
          <ul className="patient-list">
            {visible.map((p) => (
              <li key={p.document_number}>
                <Link to={`/pacientes/${p.document_number}`} className="patient-item">
                  <span className="avatar">{initials(p.name)}</span>
                  <span className="patient-item-main">
                    <b>{p.name}</b>
                    <small>CI {formatCI(p.document_number)}</small>
                  </span>
                  <span className="patient-item-meta">{p.phone}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {nextPage && !failed && (
          <button className="button button-secondary button-block" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Cargando..." : "Cargar más pacientes"}
          </button>
        )}
      </div>
    </div>
  );
}
