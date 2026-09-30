import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="app-brand">
          Clínica Odontológica
        </Link>
        <nav className="app-nav">
          {user ? (
            <>
              <span className="app-nav-user">
                {user.first_name} {user.last_name}
              </span>
              <NavLink to="/agenda" className={({ isActive }) => (isActive ? "app-nav-active" : "")}>
                Mi agenda
              </NavLink>
              <NavLink to="/horario" className={({ isActive }) => (isActive ? "app-nav-active" : "")}>
                Mi horario
              </NavLink>
              {user.role === "ADMIN" && (
                <NavLink to="/usuarios" className={({ isActive }) => (isActive ? "app-nav-active" : "")}>
                  Usuarios
                </NavLink>
              )}
              <button className="link-button" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link to="/login">Acceso doctores</Link>
          )}
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
