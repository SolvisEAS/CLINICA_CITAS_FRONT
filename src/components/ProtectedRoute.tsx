import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading, sessionEnd } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-loading">Cargando...</p>;
  if (!user) {
    // Se recuerda a dónde quería ir para volver ahí después del login, salvo que haya cerrado
    // sesión a propósito (el próximo en entrar puede ser otro doctor).
    const state = sessionEnd === "logout" ? null : { from: location.pathname + location.search };
    return <Navigate to="/login" replace state={state} />;
  }
  if (requireAdmin && user.role !== "ADMIN") return <Navigate to="/agenda" replace />;

  return <>{children}</>;
}
