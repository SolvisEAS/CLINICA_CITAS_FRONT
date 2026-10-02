import { useState, type FormEvent } from "react";
import { errorText, setUserPassword, type AdminUser } from "../services/api";

/** Restablecer la contraseña de un usuario. La contraseña anterior nunca se muestra ni se recupera. */
export function PasswordModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmation) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await setUserPassword(user.id, password, confirmation);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h3 id="password-modal-title">Restablecer contraseña</h3>
        <p className="sub">
          Nueva contraseña para <b>{user.username}</b>. Comunicásela por un medio seguro.
        </p>
        <div className="field">
          <label htmlFor="new-password">Contraseña nueva</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="new-password-confirm">Repetí la contraseña</label>
          <input
            id="new-password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="button" disabled={saving || !password || !confirmation}>
            {saving ? "Guardando..." : "Guardar contraseña"}
          </button>
        </div>
      </form>
    </div>
  );
}
