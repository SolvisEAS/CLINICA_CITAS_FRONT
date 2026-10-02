import { Link, NavLink, Outlet } from "react-router-dom";

export function PublicLayout() {
  return (
    <div className="public">
      <header className="topbar">
        <Link to="/" className="logo" aria-label="Clínica Odontológica, inicio">
          <span className="logo-mark">+</span> <span className="logo-text">Clínica Odontológica</span>
        </Link>
        <nav className="topnav">
          <NavLink to="/" end>
            Portal paciente
          </NavLink>
          <NavLink to="/login">Acceso profesionales</NavLink>
        </nav>
      </header>
      <main className="wrap">
        <Outlet />
      </main>
    </div>
  );
}
