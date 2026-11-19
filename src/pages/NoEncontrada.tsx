import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function NoEncontrada() {
  useEffect(() => {
    document.title = 'Página no encontrada — Orion Flare'
  }, [])
  return (
    <section className="hecho trama" aria-labelledby="titulo-404" style={{ minHeight: '100svh', padding: '120px var(--margen) 80px', display: 'grid', alignContent: 'center', gap: 22, justifyItems: 'start' }}>
      <p aria-hidden="true" style={{ fontFamily: 'var(--display)', fontSize: 'clamp(5rem, 18vw, 13rem)', lineHeight: 1, color: 'var(--bermellon)' }}>404</p>
      <h1 id="titulo-404" style={{ fontSize: 'clamp(2rem, 5vw, 3.4rem)' }}>Esta página se perdió en el espacio.</h1>
      <p style={{ color: 'var(--gris)', maxWidth: '48ch' }}>El enlace puede estar mal escrito o la página ya no existe. Vuelve al inicio o empieza a diseñar tu camisa.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link to="/crear" className="boton">Diseñar la mía</Link>
        <Link to="/" className="boton boton--fantasma">Ir al inicio</Link>
      </div>
    </section>
  )
}
