import { Link } from 'react-router-dom'
import { PRENDAS } from '../data/prendas'
import { calcularPrecio, formatoUSD, NOTA_ENVIO } from '../data/precios'

const EJEMPLOS = [
  { prenda: 'unisex', talla: 'L', lados: [{ anchoCm: 10, altoCm: 10 }], texto: 'Logo pequeño en el pecho, 10 × 10 cm' },
  { prenda: 'unisex', talla: 'L', lados: [{ anchoCm: 28, altoCm: 35 }], texto: 'Estampado grande al frente, 28 × 35 cm' },
  { prenda: 'oversize', talla: '2XL', lados: [{ anchoCm: 38, altoCm: 45 }], texto: 'Espalda completa, 38 × 45 cm' },
]

export function Precios() {
  return (
    <section id="precios" className="seccion" aria-labelledby="titulo-precios">
      <div className="seccion__cabeza">
        <h2 id="titulo-precios">El precio depende del tamaño de tu diseño</h2>
        <p>Pagas la camisa y el área que ocupa tu estampado, no un metro entero de película. El configurador te muestra el total exacto mientras diseñas.</p>
      </div>
      <ol className="precios">
        {EJEMPLOS.map((e) => {
          const prenda = PRENDAS.find((p) => p.id === e.prenda)!
          const talla = prenda.tallas.find((t) => t.talla === e.talla)!
          const { unitario } = calcularPrecio(prenda, talla, e.lados)
          return (
            <li key={e.texto} className="precio">
              <span className="precio__monto">{formatoUSD(unitario)}</span>
              <span className="precio__que">{prenda.nombre} talla {e.talla}</span>
              <span className="precio__detalle">{e.texto}</span>
            </li>
          )
        })}
      </ol>
      <p className="precios__nota">Precio final por camisa, sin cargos escondidos. {NOTA_ENVIO}</p>
      <Link to="/crear" className="boton">Calcular el mío</Link>
    </section>
  )
}
