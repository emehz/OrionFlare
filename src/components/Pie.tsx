import { Link } from 'react-router-dom'
import { NEGOCIO, enlaceWhatsApp } from '../data/negocio'
import { urlPublica } from '../lib/rutas'

export function Pie() {
  return (
    <footer className="pie">
      <div className="pie__marca">
        <Link to="/" className="marca" aria-label="Orion Flare, inicio">
          <img src={urlPublica('brand/wordmark-blanco.png')} alt="" width={200} height={44} className="marca__logotipo" />
        </Link>
        <p>Camisas de algodón estampadas en DTF con el diseño que tú elijas. Hecho en {NEGOCIO.ciudad}. Envíos a todo El Salvador.</p>
      </div>
      <div>
        <h2>Contacto</h2>
        <ul>
          <li><a href={enlaceWhatsApp('Hola Orion Flare')} target="_blank" rel="noopener noreferrer">WhatsApp {NEGOCIO.whatsappLegible}</a></li>
          <li><a href={`mailto:${NEGOCIO.correo}`}>{NEGOCIO.correo}</a></li>
          <li><a href={`https://www.instagram.com/${NEGOCIO.instagram}/`} target="_blank" rel="noopener noreferrer">Instagram @{NEGOCIO.instagram}</a></li>
          <li>{NEGOCIO.respuesta}</li>
        </ul>
      </div>
      <div>
        <h2>Información legal</h2>
        <ul>
          <li><Link to="/legal/terminos">Términos y condiciones</Link></li>
          <li><Link to="/legal/privacidad">Política de privacidad</Link></li>
          <li><Link to="/legal/cambios">Cambios y devoluciones</Link></li>
          <li><Link to="/legal/cookies">Cookies y almacenamiento</Link></li>
          <li><Link to="/legal/aviso">Aviso legal</Link></li>
        </ul>
      </div>
      <span className="pie__vertical" aria-hidden="true">オリオンフレア</span>
    </footer>
  )
}
