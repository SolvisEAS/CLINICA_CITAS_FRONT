import axios from "axios";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../lib/navigation";
import type { Me } from "../services/api";

export default function DoctorLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, sessionEnd, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Página protegida que se quiso abrir sin sesión (la pone ProtectedRoute); si no, el inicio de cada rol.
  const from = (location.state as { from?: string } | null)?.from;
  const destinationFor = (me: Me) => (from && from !== "/login" ? from : homeFor(me));

  // replace: así "atrás" desde el panel no vuelve al login (que rebotaría de nuevo al panel).
  if (!loading && user) return <Navigate to={destinationFor(user)} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const me = await login(username, password);
      navigate(destinationFor(me), { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError("Usuario o contraseña incorrectos, o la cuenta está desactivada.");
      } else {
        setError("No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card narrow-card login-card" onSubmit={handleSubmit}>
      <div className="eyebrow">Acceso profesional</div>
      <h2>Ingresá al sistema</h2>
      <div className="sub">Usá el usuario y la contraseña que te dio la clínica.</div>
      {sessionEnd === "expired" && <div className="notice">Tu sesión venció. Ingresá de nuevo para continuar.</div>}
      <div className="field">
        <label htmlFor="username">Usuario</label>
        <input
          id="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="button button-block" type="submit" disabled={submitting || !username || !password}>
        {submitting ? "Ingresando..." : "Ingresar"}
      </button>
    </form>
  );
}
