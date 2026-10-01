import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { initials } from "../lib/format";
import { Icon, type IconName } from "./Icon";

const LINKS: { to: string; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { to: "/agenda", label: "Agenda", icon: "calendar" },
  { to: "/pacientes", label: "Pacientes", icon: "users" },
  { to: "/horario", label: "Mi horario", icon: "clock" },
  { to: "/usuarios", label: "Usuarios", icon: "shield", adminOnly: true },
];

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const fullName = user ? `${user.first_name} ${user.last_name}`.trim() || user.username : "";

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark">+</span> Clínica
        </div>
        <nav className="sidebar-nav">
          {LINKS.filter((l) => !l.adminOnly || user?.role === "ADMIN").map((l) => (
            <NavLink key={l.to} to={l.to} aria-label={l.label} title={l.label}>
              <Icon name={l.icon} /> <span>{l.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar avatar-dark">{initials(fullName)}</span>
            <span>
              <b>{fullName}</b>
              <small>{user?.role === "ADMIN" ? "Administrador" : "Doctor"}</small>
            </span>
          </div>
          {/* Al quedar sin usuario, ProtectedRoute redirige al login reemplazando la entrada del historial. */}
          <button className="sidebar-logout" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión">
            <Icon name="logout" /> <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  );
}
