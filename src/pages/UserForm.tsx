import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PasswordModal } from "../components/PasswordModal";
import { useAuth } from "../context/AuthContext";
import { useGoBack } from "../lib/navigation";
import {
  createUser,
  extractFieldErrors,
  getUser,
  updateUser,
  type AdminUser,
  type ApiFieldErrors,
  type UserInput,
} from "../services/api";

const EMPTY: UserInput = {
  first_name: "",
  last_name: "",
  username: "",
  email: "",
  phone: "",
  role: "DOCTOR",
  is_active: true,
  specialty: "",
  appointment_duration_minutes: 30,
};

function fromUser(u: AdminUser): UserInput {
  return {
    first_name: u.first_name,
    last_name: u.last_name,
    username: u.username,
    email: u.email,
    phone: u.phone,
    role: u.role === "ADMIN" ? "ADMIN" : "DOCTOR",
    is_active: u.is_active,
    specialty: u.doctor?.specialty ?? "",
    appointment_duration_minutes: u.doctor?.appointment_duration_minutes ?? 30,
  };
}

/** Alta (/usuarios/nuevo) y edición (/usuarios/:id) de un usuario médico o administrador. */
export default function UserForm() {
  const { userId } = useParams<{ userId: string }>();
  const editingId = userId ? Number(userId) : null;
  const navigate = useNavigate();
  const goBack = useGoBack("/usuarios");
  const { user: me } = useAuth();

  const [loaded, setLoaded] = useState<{ id: number | null; user: AdminUser | null; error: string }>({
    id: null,
    user: null,
    error: "",
  });
  const loading = editingId !== null && loaded.id !== editingId;
  const [form, setForm] = useState<UserInput>(EMPTY);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [errors, setErrors] = useState<ApiFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (editingId === null) return;
    let ignore = false;
    getUser(editingId)
      .then((u) => {
        if (ignore) return;
        setLoaded({ id: editingId, user: u, error: "" });
        setForm(fromUser(u));
      })
      .catch(() => {
        if (!ignore) setLoaded({ id: editingId, user: null, error: "No se encontró ese usuario." });
      });
    return () => {
      ignore = true;
    };
  }, [editingId]);

  const set = <K extends keyof UserInput>(key: K, value: UserInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const isSelf = editingId !== null && editingId === me?.id;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (editingId === null && password !== passwordConfirm) {
      setErrors({ password_confirm: ["Las contraseñas no coinciden."] });
      return;
    }
    setSaving(true);
    setErrors({});
    const payload: UserInput = {
      ...form,
      ...(form.role === "DOCTOR" ? {} : { specialty: undefined, appointment_duration_minutes: undefined }),
    };
    try {
      const saved =
        editingId === null
          ? await createUser({ ...payload, password, password_confirm: passwordConfirm })
          : await updateUser(editingId, payload);
      navigate("/usuarios", {
        replace: true,
        state: { message: `${saved.username} ${editingId === null ? "fue creado" : "fue actualizado"}.` },
      });
    } catch (err) {
      setErrors(extractFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (name: string) =>
    errors[name] ? <p className="error-text">{([] as string[]).concat(errors[name]).join(" ")}</p> : null;

  if (loading) return <p className="page-loading">Cargando usuario...</p>;
  if (editingId !== null && !loaded.user) return <p className="empty-state">{loaded.error}</p>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{editingId === null ? "Crear usuario médico" : `Editar ${loaded.user?.username}`}</h2>
          <div className="sub">
            {editingId === null
              ? "La cuenta queda lista para iniciar sesión si está activa."
              : "Los cambios se aplican en el próximo inicio de sesión del usuario."}
          </div>
        </div>
        <button className="button button-secondary" onClick={goBack}>
          <Icon name="chevronLeft" size={16} /> Volver
        </button>
      </div>

      <form className="card card-pad form-card" onSubmit={handleSubmit}>
        <h3>Datos personales</h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="first_name">Nombre</label>
            <input id="first_name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            {fieldError("first_name")}
          </div>
          <div className="field">
            <label htmlFor="last_name">Apellido</label>
            <input id="last_name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            {fieldError("last_name")}
          </div>
          <div className="field">
            <label htmlFor="email">
              Correo <span className="optional">(opcional)</span>
            </label>
            <input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            {fieldError("email")}
          </div>
          <div className="field">
            <label htmlFor="phone">
              Teléfono <span className="optional">(opcional)</span>
            </label>
            <input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            {fieldError("phone")}
          </div>
        </div>

        <h3>Acceso</h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="username">Usuario</label>
            <input
              id="username"
              autoComplete="off"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
            />
            {fieldError("username")}
          </div>
          <div className="field">
            <label htmlFor="is_active">Estado</label>
            <select
              id="is_active"
              value={form.is_active ? "1" : "0"}
              onChange={(e) => set("is_active", e.target.value === "1")}
              disabled={isSelf}
            >
              <option value="1">Activo: puede iniciar sesión</option>
              <option value="0">Inactivo: no puede iniciar sesión</option>
            </select>
            {isSelf && <span className="field-hint">No podés desactivar tu propio usuario.</span>}
            {fieldError("is_active")}
          </div>
          <div className="field">
            <label htmlFor="role">Rol y permisos</label>
            <select
              id="role"
              value={form.role}
              onChange={(e) => set("role", e.target.value as UserInput["role"])}
              disabled={isSelf}
            >
              <option value="DOCTOR">Doctor: agenda, pacientes e historial</option>
              <option value="ADMIN">Administrador: gestiona usuarios y horarios</option>
            </select>
            <span className="field-hint">
              Cada rol trae los permisos de su grupo. Los permisos finos de cada grupo se ajustan desde el admin de
              Django (superusuario).
            </span>
            {fieldError("role")}
          </div>
        </div>

        {editingId === null ? (
          <div className="form-grid">
            <div className="field">
              <label htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {fieldError("password")}
            </div>
            <div className="field">
              <label htmlFor="password_confirm">Repetí la contraseña</label>
              <input
                id="password_confirm"
                type="password"
                autoComplete="new-password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
              {fieldError("password_confirm")}
            </div>
          </div>
        ) : (
          <div className="field">
            <label>Contraseña</label>
            <div>
              <button type="button" className="button button-secondary" onClick={() => setShowPassword(true)}>
                Restablecer contraseña
              </button>
            </div>
            <span className="field-hint">Por seguridad la contraseña actual no se muestra ni se puede recuperar.</span>
            {passwordMessage && <p className="success-text">{passwordMessage}</p>}
          </div>
        )}

        {form.role === "DOCTOR" && (
          <>
            <h3>Datos del doctor</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="specialty">Especialidad</label>
                <input
                  id="specialty"
                  placeholder="Ej. Ortodoncia"
                  value={form.specialty}
                  onChange={(e) => set("specialty", e.target.value)}
                />
                {fieldError("specialty")}
              </div>
              <div className="field">
                <label htmlFor="duration">Duración de cada turno (minutos)</label>
                <input
                  id="duration"
                  type="number"
                  min={5}
                  max={240}
                  value={form.appointment_duration_minutes}
                  onChange={(e) => set("appointment_duration_minutes", Number(e.target.value))}
                />
                {fieldError("appointment_duration_minutes")}
              </div>
            </div>
          </>
        )}

        {fieldError("non_field_errors")}
        <div className="button-row">
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Guardando..." : editingId === null ? "Crear usuario" : "Guardar cambios"}
          </button>
          <button type="button" className="button button-secondary" onClick={goBack}>
            Cancelar
          </button>
        </div>
      </form>

      {showPassword && loaded.user && (
        <PasswordModal
          user={loaded.user}
          onClose={() => setShowPassword(false)}
          onDone={() => {
            setShowPassword(false);
            setPasswordMessage("Contraseña actualizada.");
          }}
        />
      )}
    </div>
  );
}
