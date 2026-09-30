import axios from "axios";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DoctorLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

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
        setError(
          "No pudimos conectar con el servidor. Puede ser un problema de CORS o de red — revisá la consola del navegador."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow">
      <form className="card" onSubmit={handleSubmit}>
        <h2>Acceso doctores</h2>
        <div className="field">
          <label htmlFor="username">Usuario</label>
          <input
            id="username"
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "Ingresando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
