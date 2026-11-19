import { useState } from 'react'
import { PRENDAS, PULGADA } from '../data/prendas'

export function Tallas() {
  const [id, setId] = useState(PRENDAS[0].id)
  const [unidad, setUnidad] = useState<'cm' | 'in'>('cm')
  const prenda = PRENDAS.find((p) => p.id === id)!
  const fmt = (v: number) => (unidad === 'cm' ? (v * PULGADA).toFixed(1) : v % 1 === 0 ? String(v) : v.toFixed(2).replace(/0$/, ''))

  return (
    <section id="tallas" className="seccion seccion--papel" aria-labelledby="titulo-tallas">
      <div className="seccion__cabeza">
        <h2 id="titulo-tallas">Tabla de tallas</h2>
        <p>Medidas de la camisa extendida sobre una mesa. <strong>Ancho</strong>: de axila a axila. <strong>Largo</strong>: del punto más alto del hombro al borde inferior.</p>
      </div>
      <div className="tallas__controles">
        <div className="segmentos" role="tablist" aria-label="Tipo de prenda">
          {PRENDAS.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === id} className="segmento" onClick={() => setId(p.id)}>
              {p.corto}
            </button>
          ))}
        </div>
        <div className="segmentos segmentos--chico" role="group" aria-label="Unidad">
          <button className="segmento" aria-pressed={unidad === 'cm'} onClick={() => setUnidad('cm')}>cm</button>
          <button className="segmento" aria-pressed={unidad === 'in'} onClick={() => setUnidad('in')}>pulgadas</button>
        </div>
      </div>
      <div className="tabla-envoltura" role="tabpanel" aria-label={prenda.nombre}>
        <table className="tabla">
          <caption className="solo-lectores">{prenda.nombre}, medidas en {unidad === 'cm' ? 'centímetros' : 'pulgadas'}</caption>
          <thead>
            <tr>
              <th scope="row">Talla</th>
              {prenda.tallas.map((t) => <th key={t.talla} scope="col">{t.talla}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Ancho</th>
              {prenda.tallas.map((t) => <td key={t.talla}>{fmt(t.ancho)}</td>)}
            </tr>
            <tr>
              <th scope="row">Largo</th>
              {prenda.tallas.map((t) => <td key={t.talla}>{fmt(t.largo)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
