import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useAuth } from "../context/AuthContext";
import { getAllUsers, type AdminUser } from "../services/api";

export default function AdminHome() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getAllUsers()
      .then(setUsers)
      .catch(() => setFailed(true));
  }, []);

  const doctors = (users ?? []).filter((u) => u.role === "DOCTOR");
  const count = (value: number) => (users === null ? "–" : value);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Panel de administración</h2>
          <div className="sub">Hola, {user?.first_name || user?.username}. Desde acá gestionás los usuarios médicos.</div>
        </div>
        <Link className="button" to="/usuarios/nuevo">
          <Icon name="plus" size={16} /> Crear usuario médico
        </Link>
      </div>

      {failed && <p className="error-text">No se pudo cargar el resumen de usuarios.</p>}

      <div className="stats">
        <div className="card stat">
          <span>Doctores activos</span>
          <strong>{count(doctors.filter((u) => u.is_active).length)}</strong>
        </div>
        <div className="card stat">
          <span>Doctores inactivos</span>
          <strong>{count(doctors.filter((u) => !u.is_active).length)}</strong>
        </div>
        <div className="card stat">
          <span>Administradores</span>
          <strong>{count((users ?? []).filter((u) => u.role === "ADMIN" || u.is_superuser).length)}</strong>
        </div>
        <div className="card stat">
          <span>Doctores sin especialidad</span>
          <strong>{count(doctors.filter((u) => !u.doctor?.specialty).length)}</strong>
        </div>
      </div>

      <div className="choice-grid">
        <Link to="/usuarios" className="card choice-card choice-link">
          <span className="choice-icon">
            <Icon name="users" size={22} />
          </span>
          <h3>Usuarios médicos</h3>
          <p className="sub">Crear, editar, activar o desactivar cuentas y restablecer contraseñas.</p>
        </Link>
        <Link to="/horarios" className="card choice-card choice-link">
          <span className="choice-icon">
            <Icon name="clock" size={22} />
          </span>
          <h3>Horarios de atención</h3>
          <p className="sub">Definir los días y horarios en que atiende cada doctor.</p>
        </Link>
      </div>
    </div>
  );
}
