import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute({
  children,
  requireAdmin = false,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
}) {
  const { user, loading } = useAuth();

  if (loading) return <p className="page-loading">Cargando...</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && user.role !== "ADMIN") return <Navigate to="/agenda" replace />;

  return <>{children}</>;
}
