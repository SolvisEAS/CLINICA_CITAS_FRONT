import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";

export default function PublicHome() {
  return (
    <>
      <div className="home-intro">
        <div className="eyebrow">Agenda online</div>
        <h1>¿Qué querés hacer?</h1>
        <p className="sub">Sin crear cuenta ni contraseña: solo necesitás tu número de CI.</p>
      </div>

      <div className="choice-grid">
        <div className="card choice-card">
          <span className="choice-icon">
            <Icon name="plus" size={22} />
          </span>
          <h2>Agendar consulta</h2>
          <p className="sub">Seleccioná un doctor, fecha y horario.</p>
          <Link className="button button-block" to="/agendar">
            Agendar consulta
          </Link>
        </div>

        <div className="card choice-card">
          <span className="choice-icon">
            <Icon name="calendar" size={22} />
          </span>
          <h2>Consultar mis consultas</h2>
          <p className="sub">Consultá tus próximas citas utilizando tu número de CI.</p>
          <Link className="button button-secondary button-block" to="/mis-consultas">
            Consultar mis consultas
          </Link>
        </div>
      </div>
    </>
  );
}
