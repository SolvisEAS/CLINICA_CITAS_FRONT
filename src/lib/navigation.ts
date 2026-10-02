import { useLocation, useNavigate } from "react-router-dom";
import type { Me } from "../services/api";

/** Pantalla de inicio de cada usuario: el doctor va a su agenda; un administrador sin consultorio, al panel. */
export function homeFor(user: Me) {
  if (user.doctor_id) return "/agenda";
  if (user.is_admin) return "/panel";
  return "/sin-acceso";
}

/**
 * "Volver" dentro de la app: retrocede en el historial, salvo que esta sea la
 * primera pantalla abierta (link directo, pestaña nueva) — ahí retroceder
 * sacaría al usuario del sitio, así que se va a `fallback`.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  const location = useLocation();
  return () => {
    if (location.key === "default") navigate(fallback, { replace: true });
    else navigate(-1);
  };
}
