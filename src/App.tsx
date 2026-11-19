import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Cabecera } from './components/Cabecera'
import { Pie } from './components/Pie'
import { BotonWhatsApp } from './components/BotonWhatsApp'

const Inicio = lazy(() => import('./pages/Home'))
const Crear = lazy(() => import('./pages/Crear'))
const Legal = lazy(() => import('./pages/Legal'))
const NoEncontrada = lazy(() => import('./pages/NoEncontrada'))

const TITULOS: Record<string, string> = {
  '/': 'Orion Flare — Camisas estampadas con tu diseño, en 3D y a tamaño real',
  '/crear': 'Diseña tu camisa — Orion Flare',
}

function Titulo() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (TITULOS[pathname]) document.title = TITULOS[pathname]
    if (!location.hash) window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  return (
    <>
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <Titulo />
      <Cabecera />
      <main id="contenido">
        <Suspense fallback={<div style={{ minHeight: '100svh' }} aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/crear" element={<Crear />} />
            <Route path="/legal/:pagina" element={<Legal />} />
            <Route path="*" element={<NoEncontrada />} />
          </Routes>
        </Suspense>
      </main>
      {pathname !== '/crear' && <Pie />}
      {pathname !== '/crear' && <BotonWhatsApp />}
    </>
  )
}
