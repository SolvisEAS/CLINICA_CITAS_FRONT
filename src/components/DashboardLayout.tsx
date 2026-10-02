import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { initials } from "../lib/format";
import { Icon, type IconName } from "./Icon";

type NavItem = { to: string; label: string; icon: IconName };

const DOCTOR_LINKS: NavItem[] = [
  { to: "/agenda", label: "Agenda", icon: "calendar" },
  { to: "/pacientes", label: "Pacientes", icon: "users" },
  { to: "/horario", label: "Mi horario", icon: "clock" },
];

const ADMIN_LINKS: NavItem[] = [
  { to: "/panel", label: "Panel", icon: "shield" },
  { to: "/usuarios", label: "Usuarios médicos", icon: "users" },
  { to: "/horarios", label: "Horarios", icon: "clock" },
];

function NavGroup({ title, items }: { title?: string; items: NavItem[] }) {
  return (
    <>
      {title && <div className="sidebar-section">{title}</div>}
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} aria-label={item.label} title={item.label}>
          <Icon name={item.icon} /> <span>{item.label}</span>
        </NavLink>
      ))}
    </>
  );
}

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const fullName = user ? `${user.first_name} ${user.last_name}`.trim() || user.username : "";
  const isDoctor = Boolean(user?.doctor_id);
  const isAdmin = Boolean(user?.is_admin);
  const roleLabel = isDoctor && isAdmin ? "Doctor · Administrador" : isAdmin ? "Administrador" : "Doctor";

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="logo-mark">+</span> Clínica
        </div>
        <nav className="sidebar-nav">
          {isDoctor && <NavGroup title={isAdmin ? "Consultorio" : undefined} items={DOCTOR_LINKS} />}
          {isAdmin && <NavGroup title={isDoctor ? "Administración" : undefined} items={ADMIN_LINKS} />}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="avatar avatar-dark">{initials(fullName)}</span>
            <span>
              <b>{fullName}</b>
              <small>{roleLabel}</small>
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
