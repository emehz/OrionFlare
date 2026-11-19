import { Link, NavLink, useLocation } from 'react-router-dom'
import { urlPublica } from '../lib/rutas'

export function Cabecera() {
  const { pathname } = useLocation()
  return (
    <header className="cabecera">
      <Link to="/" className="marca" aria-label="Orion Flare, inicio">
        <img src={urlPublica('brand/wordmark-blanco.png')} alt="" width={160} height={35} className="marca__logotipo" />
      </Link>
      {pathname !== '/crear' && (
        <nav className="nav" aria-label="Principal">
          <a href={`${import.meta.env.BASE_URL}#tallas`}>Tallas</a>
          <a href={`${import.meta.env.BASE_URL}#precios`}>Precios</a>
          <a href={`${import.meta.env.BASE_URL}#preguntas`}>Preguntas</a>
          <NavLink to="/crear" className="boton">Diseñar la mía</NavLink>
        </nav>
      )}
    </header>
  )
}
