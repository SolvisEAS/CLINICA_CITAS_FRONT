import { useEffect, useState } from "react";
import {
  createUser,
  extractFieldErrors,
  getUsers,
  setUserPassword,
  type AdminUser,
  type ApiFieldErrors,
} from "../services/api";

const emptyForm = {
  username: "",
  password: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "DOCTOR" as "DOCTOR" | "ADMIN",
  specialty: "",
  appointment_duration_minutes: 30,
};

export default function UserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<ApiFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  function load() {
    setLoading(true);
    getUsers()
      .then((list) => setUsers(list.filter((u) => u.role !== "PACIENTE")))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect -- indicador de carga; `load` también se reusa como handler tras crear un usuario
  useEffect(load, []);

  async function handleCreate() {
    setSubmitting(true);
    setErrors({});
    try {
      await createUser({
        ...form,
        phone: form.phone || undefined,
        specialty: form.role === "DOCTOR" ? form.specialty : undefined,
        appointment_duration_minutes: form.role === "DOCTOR" ? form.appointment_duration_minutes : undefined,
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      setErrors(extractFieldErrors(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetPassword() {
    if (!passwordTarget || !newPassword) return;
    setPasswordError("");
    setPasswordSuccess("");
    try {
      await setUserPassword(passwordTarget.id, newPassword);
      setPasswordSuccess(`Contraseña actualizada para ${passwordTarget.username}.`);
      setNewPassword("");
      setPasswordTarget(null);
    } catch (err) {
      const fieldErrors = extractFieldErrors(err);
      setPasswordError(Object.values(fieldErrors).flat().join(" "));
    }
  }

  return (
    <div className="page-wide">
      <h2>Usuarios del sistema</h2>
      <p className="hint-text">
        Creá cuentas de doctores o administradores, y reseteá contraseñas cuando haga falta.
      </p>

      <section className="card">
        <h3>Nuevo usuario</h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="role">Rol</label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "DOCTOR" | "ADMIN" })}
            >
              <option value="DOCTOR">Doctor</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
            />
            {errors.username && <p className="error-text">{errors.username.join(" ")}</p>}
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña inicial</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            {errors.password && <p className="error-text">{errors.password.join(" ")}</p>}
          </div>
          <div className="field">
            <label htmlFor="first_name">Nombre</label>
            <input
              id="first_name"
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="last_name">Apellido</label>
            <input
              id="last_name"
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Correo</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            {errors.email && <p className="error-text">{errors.email.join(" ")}</p>}
          </div>
          <div className="field">
            <label htmlFor="phone">Teléfono (opcional)</label>
            <input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          {form.role === "DOCTOR" && (
            <>
              <div className="field">
                <label htmlFor="specialty">Especialidad</label>
                <input
                  id="specialty"
                  value={form.specialty}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="duration">Duración del turno (minutos)</label>
                <input
                  id="duration"
                  type="number"
                  min={5}
                  value={form.appointment_duration_minutes}
                  onChange={(e) =>
                    setForm({ ...form, appointment_duration_minutes: Number(e.target.value) })
                  }
                />
              </div>
            </>
          )}
        </div>

        {errors.non_field_errors && <p className="error-text">{errors.non_field_errors.join(" ")}</p>}

        <button
          className="button"
          onClick={handleCreate}
          disabled={submitting || !form.username || !form.password || !form.first_name}
        >
          {submitting ? "Creando..." : "Crear usuario"}
        </button>
      </section>

      <section className="card">
        <h3>Usuarios existentes</h3>
        {loading ? (
          <p className="hint-text">Cargando...</p>
        ) : users.length === 0 ? (
          <p className="empty-state">Todavía no hay doctores ni administradores creados.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Correo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.first_name} {u.last_name}
                  </td>
                  <td>{u.username}</td>
                  <td>{u.role === "ADMIN" ? "Administrador" : "Doctor"}</td>
                  <td>{u.email}</td>
                  <td>
                    <button className="link-button" onClick={() => setPasswordTarget(u)}>
                      Resetear contraseña
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {passwordSuccess && <p className="hint-text">{passwordSuccess}</p>}
      </section>

      {passwordTarget && (
        <div className="modal-backdrop" onClick={() => setPasswordTarget(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Nueva contraseña para {passwordTarget.username}</h3>
            <div className="field">
              <label htmlFor="new-password">Contraseña nueva</label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
              />
            </div>
            {passwordError && <p className="error-text">{passwordError}</p>}
            <div className="modal-actions">
              <button className="link-button" onClick={() => setPasswordTarget(null)}>
                Cancelar
              </button>
              <button className="button" onClick={handleSetPassword} disabled={!newPassword}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
