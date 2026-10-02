import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homeFor } from "../lib/navigation";

/**
 * `require`: "doctor" (tiene perfil de doctor) o "admin" (administra usuarios). Quien no
 * cumple va a su propia pantalla de inicio. El backend valida lo mismo con permisos.
 */
export function ProtectedRoute({ children, require }: { children: ReactNode; require?: "doctor" | "admin" }) {
  const { user, loading, sessionEnd } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-loading">Cargando...</p>;
  if (!user) {
    // Se recuerda a dónde quería ir para volver ahí después del login, salvo que haya cerrado
    // sesión a propósito (el próximo en entrar puede ser otro doctor).
    const state = sessionEnd === "logout" ? null : { from: location.pathname + location.search };
    return <Navigate to="/login" replace state={state} />;
  }
  if ((require === "doctor" && !user.doctor_id) || (require === "admin" && !user.is_admin)) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return <>{children}</>;
}
