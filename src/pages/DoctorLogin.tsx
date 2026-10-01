import axios from "axios";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DoctorLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  if (!loading && user) return <Navigate to="/agenda" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      navigate("/agenda");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError("Usuario o contraseña incorrectos.");
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
      <h2>Ingresá a tu agenda</h2>
      <div className="sub">Usá el usuario y la contraseña que te dio la clínica.</div>
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
