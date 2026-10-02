import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PasswordModal } from "../components/PasswordModal";
import { useAuth } from "../context/AuthContext";
import { errorText, getAllUsers, updateUser, type AdminUser } from "../services/api";

type RoleFilter = "TODOS" | "DOCTOR" | "ADMIN";

function fullName(u: AdminUser) {
  return `${u.first_name} ${u.last_name}`.trim() || "—";
}

function roleLabel(u: AdminUser) {
  if (u.is_superuser) return "Superusuario";
  return u.role === "ADMIN" ? "Administrador" : u.role === "DOCTOR" ? "Doctor" : "Sin rol";
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<RoleFilter>("TODOS");
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);
  // Mensaje que deja el formulario de alta/edición al volver.
  const location = useLocation();
  const [message, setMessage] = useState((location.state as { message?: string } | null)?.message ?? "");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    getAllUsers()
      .then(setUsers)
      .catch(() => setFailed(true));
  }, []);

  async function toggleActive(u: AdminUser) {
    setActionError("");
    setMessage("");
    try {
      const updated = await updateUser(u.id, { is_active: !u.is_active });
      setUsers((prev) => prev?.map((x) => (x.id === updated.id ? updated : x)) ?? null);
      setMessage(`${updated.username} quedó ${updated.is_active ? "activo" : "inactivo"}.`);
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  const visible = (users ?? []).filter((u) => filter === "TODOS" || u.role === filter);
  // Solo un superusuario puede modificar a otro superusuario (el backend lo valida igual).
  const meIsSuperuser = Boolean(users?.find((u) => u.id === me?.id)?.is_superuser);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Usuarios médicos</h2>
          <div className="sub">Cuentas de doctores y administradores. Un usuario inactivo no puede iniciar sesión.</div>
        </div>
        <Link className="button" to="/usuarios/nuevo">
          <Icon name="plus" size={16} /> Crear usuario médico
        </Link>
      </div>

      <div className="card card-pad">
        <div className="title-row">
          <div className="tabs tabs-compact" role="tablist">
            {(["TODOS", "DOCTOR", "ADMIN"] as RoleFilter[]).map((f) => (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                className={`tab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f === "TODOS" ? "Todos" : f === "DOCTOR" ? "Doctores" : "Administradores"}
              </button>
            ))}
          </div>
        </div>

        {message && <p className="success-text">{message}</p>}
        {actionError && <p className="error-text">{actionError}</p>}

        {failed ? (
          <p className="error-text">No se pudo cargar la lista de usuarios.</p>
        ) : users === null ? (
          <p className="sub">Cargando usuarios...</p>
        ) : visible.length === 0 ? (
          <p className="empty-state">No hay usuarios en esta categoría.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Especialidad</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const isSelf = u.id === me?.id;
                  const lockedSuperuser = u.is_superuser && !meIsSuperuser;
                  return (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>
                        {u.role === "DOCTOR" ? "Dr/a. " : ""}
                        {fullName(u)}
                      </td>
                      <td>{u.doctor?.specialty || "—"}</td>
                      <td>{roleLabel(u)}</td>
                      <td>
                        <span className={`tag ${u.is_active ? "tag-activo" : "tag-inactivo"}`}>
                          {u.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="table-actions">
                        <Link className="button button-secondary button-sm" to={`/usuarios/${u.id}`}>
                          Editar
                        </Link>
                        {!lockedSuperuser && (
                          <button className="button button-secondary button-sm" onClick={() => setPasswordFor(u)}>
                            Contraseña
                          </button>
                        )}
                        {!isSelf && !lockedSuperuser && (
                          <button
                            className={`button button-sm ${u.is_active ? "button-danger" : "button-secondary"}`}
                            onClick={() => toggleActive(u)}
                          >
                            {u.is_active ? "Desactivar" : "Activar"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {passwordFor && (
        <PasswordModal
          user={passwordFor}
          onClose={() => setPasswordFor(null)}
          onDone={() => {
            setMessage(`Contraseña actualizada para ${passwordFor.username}.`);
            setPasswordFor(null);
          }}
        />
      )}
    </div>
  );
}
