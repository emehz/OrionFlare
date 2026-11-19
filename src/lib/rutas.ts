/** URL de un archivo de /public respetando la ruta base (GitHub Pages publica en /OrionFlare/). */
export function urlPublica(ruta: string) {
  return `${import.meta.env.BASE_URL}${ruta.replace(/^\//, '')}`
}
