import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { formatCI, formatDateShort, initials } from "../lib/format";
import { getPatients, type Patient } from "../services/api";

export default function Patients() {
  // En la URL (?q=) para que la búsqueda siga ahí al volver de una ficha.
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const setSearch = (value: string) => setSearchParams(value ? { q: value } : {}, { replace: true });

  // `key` = búsqueda a la que corresponde la lista cargada; mientras no coincida, se está buscando.
  const [result, setResult] = useState<{ key: string; patients: Patient[]; nextPage: number | null; failed: boolean }>({
    key: "\u0000",
    patients: [],
    nextPage: null,
    failed: false,
  });
  const term = search.trim();
  const loading = result.key !== term;
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let ignore = false;
    // Espera a que se deje de tipear para no consultar en cada letra.
    const timer = setTimeout(() => {
      getPatients(1, term)
        .then((res) => {
          if (!ignore) setResult({ key: term, patients: res.results, nextPage: res.next ? 2 : null, failed: false });
        })
        .catch(() => {
          if (!ignore) setResult({ key: term, patients: [], nextPage: null, failed: true });
        });
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [term]);

  async function loadMore() {
    if (!result.nextPage) return;
    setLoadingMore(true);
    try {
      const res = await getPatients(result.nextPage, term);
      setResult((prev) => ({
        ...prev,
        patients: [...prev.patients, ...res.results],
        nextPage: res.next ? (prev.nextPage ?? 1) + 1 : null,
      }));
    } catch {
      setResult((prev) => ({ ...prev, failed: true }));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Pacientes</h2>
          <div className="sub">Pacientes que tuvieron al menos un turno con vos.</div>
        </div>
      </div>

      <div className="card card-pad">
        <input
          className="input"
          type="search"
          placeholder="Buscar por nombre o CI..."
          aria-label="Buscar paciente"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="sub">Buscando...</p>
        ) : result.failed ? (
          <p className="error-text">No se pudo cargar la lista de pacientes.</p>
        ) : result.patients.length === 0 ? (
          <p className="empty-state">{term ? "Ningún paciente coincide con la búsqueda." : "Todavía no tenés pacientes."}</p>
        ) : (
          <ul className="patient-list">
            {result.patients.map((p) => (
              <li key={p.document_number}>
                <Link to={`/pacientes/${p.document_number}`} className="patient-item">
                  <span className="avatar">{initials(p.name)}</span>
                  <span className="patient-item-main">
                    <b>{p.name}</b>
                    <small>CI {formatCI(p.document_number)}</small>
                  </span>
                  <span className="patient-item-contact">
                    <small>{p.phone}</small>
                    <small>{p.email || "Sin correo"}</small>
                  </span>
                  <span className="patient-item-meta">
                    <small>Última consulta</small>
                    <b>{p.last_visit ? formatDateShort(p.last_visit) : "—"}</b>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {!loading && result.nextPage && !result.failed && (
          <button className="button button-secondary button-block" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Cargando..." : "Cargar más pacientes"}
          </button>
        )}
      </div>
    </div>
  );
}
