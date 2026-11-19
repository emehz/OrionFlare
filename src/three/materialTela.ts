import * as THREE from 'three'

/*
 * Material de algodón con los diseños dibujados directamente en la tarjeta gráfica.
 * Mover o cambiar el tamaño de un diseño solo cambia números (uniforms): no se vuelve a pintar
 * ninguna imagen, por eso no hay lag al usar las barras.
 */

export const MAX_DISENOS = 8

const vacia = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
  t.needsUpdate = true
  return t
})()

let normalTejido: THREE.Texture | null = null
function texturaTejido() {
  if (normalTejido) return normalTejido
  // mapa de alturas de punto de jersey (filas de "V") convertido a mapa de normales
  const N = 128
  const alto = new Float32Array(N * N)
  const colsV = 16, filasV = 22
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * colsV, v = (y / N) * filasV
      const fu = u - Math.floor(u), fv = v - Math.floor(v)
      const brazo = Math.abs(fu - 0.5) * 2 // dos "patas" de la V
      const h = Math.sin(Math.PI * Math.min(1, Math.abs(brazo - fv) * 1.6)) * 0.5 + Math.sin(Math.PI * fu) * 0.5
      alto[y * N + x] = h + (Math.random() - 0.5) * 0.15
    }
  }
  const datos = new Uint8Array(N * N * 4)
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const h = (xx: number, yy: number) => alto[((yy + N) % N) * N + ((xx + N) % N)]
      const dx = (h(x + 1, y) - h(x - 1, y)) * 1.2
      const dy = (h(x, y + 1) - h(x, y - 1)) * 1.2
      const len = Math.hypot(dx, dy, 1)
      const i = (y * N + x) * 4
      datos[i] = ((-dx / len) * 0.5 + 0.5) * 255
      datos[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      datos[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      datos[i + 3] = 255
    }
  }
  const t = new THREE.DataTexture(datos, N, N)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = 8
  t.needsUpdate = true
  normalTejido = t
  return t
}

export interface UniformsTela {
  uDisTex: { value: THREE.Texture[] }
  uDisRect: { value: THREE.Vector4[] }
  uDisZona: { value: number[] }
  uDisN: { value: number }
  uActivo: { value: number }
  uGuia: { value: number }
  uEtiqueta: { value: THREE.Texture }
  uEtiquetaRect: { value: THREE.Vector4 }
  uLargo: { value: number }
  uLargoManga: { value: number }
  uLag: { value: number }
  uSway: { value: THREE.Vector2 }
}

export function crearMaterialTela() {
  const u: UniformsTela = {
    uDisTex: { value: Array.from({ length: MAX_DISENOS }, () => vacia) },
    uDisRect: { value: Array.from({ length: MAX_DISENOS }, () => new THREE.Vector4()) },
    uDisZona: { value: Array.from({ length: MAX_DISENOS }, () => -9) },
    uDisN: { value: 0 },
    uActivo: { value: -1 },
    uGuia: { value: 0 },
    uEtiqueta: { value: vacia },
    uEtiquetaRect: { value: new THREE.Vector4(-4, 2.5, 8, 4.3) },
    uLargo: { value: 70 },
    uLargoManga: { value: 20 },
    uLag: { value: 0 },
    uSway: { value: new THREE.Vector2() },
  }

  const material = new THREE.MeshPhysicalMaterial({
    color: '#121214',
    roughness: 0.94,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#555555'),
    normalMap: texturaTejido(),
    normalScale: new THREE.Vector2(0.28, 0.28),
    side: THREE.DoubleSide,
  })

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aZona;
        attribute vec2 aCm;
        attribute float aPeso;
        varying float vZona;
        varying vec2 vCm;
        uniform float uLag;
        uniform vec2 uSway;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vZona = aZona;
        vCm = aCm;
        // física ligera: lo de abajo (ruedo, puños) se queda atrás al girar y se balancea
        float pesoFisica = aPeso * aPeso;
        float giro = uLag * pesoFisica;
        transformed.xz += giro * vec2(-transformed.z, transformed.x);
        transformed.xz += uSway * pesoFisica;`,
      )

    let bucle = ''
    for (let i = 0; i < MAX_DISENOS; i++) {
      bucle += `
      if (${i} < uDisN && zonaFrag == int(uDisZona[${i}] + 0.5)) {
        vec4 r = uDisRect[${i}];
        vec2 q = (vCm - r.xy) / r.zw;
        if (gl_FrontFacing && q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) {
          vec4 t = texture2D(uDisTex[${i}], vec2(q.x, 1.0 - q.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, t.a);
          tintaEncima = max(tintaEncima, t.a);
        }
        if (uGuia > 0.5 && ${i} == uActivo && gl_FrontFacing) guia = max(guia, lineasGuia(vCm, r, zonaFrag >= 2 ? 1.0 : 0.0));
      }`
    }

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying float vZona;
        varying vec2 vCm;
        uniform sampler2D uDisTex[${MAX_DISENOS}];
        uniform vec4 uDisRect[${MAX_DISENOS}];
        uniform float uDisZona[${MAX_DISENOS}];
        uniform int uDisN;
        uniform int uActivo;
        uniform float uGuia;
        uniform sampler2D uEtiqueta;
        uniform vec4 uEtiquetaRect;
        uniform float uLargo;
        uniform float uLargoManga;

        // contorno y cotas del diseño seleccionado (en cm sobre la tela)
        float lineasGuia(vec2 p, vec4 r, float abajo) {
          float g = 0.0;
          float w = 0.16;
          vec2 a = r.xy, b = r.xy + r.zw;
          bool dentroX = p.x > a.x - w && p.x < b.x + w;
          bool dentroY = p.y > a.y - w && p.y < b.y + w;
          float borde = min(min(abs(p.x - a.x), abs(p.x - b.x)), min(abs(p.y - a.y), abs(p.y - b.y)));
          if (dentroX && dentroY && borde < w) g = mod(floor((p.x + p.y) * 1.2), 2.0) < 1.0 ? 1.0 : 0.0;
          // cota horizontal arriba y vertical a la derecha
          float cy = abajo > 0.5 ? b.y + 2.0 : a.y - 2.0, cx = b.x + 2.0;
          if (abs(p.y - cy) < w && p.x > a.x && p.x < b.x) g = 1.0;
          if ((abs(p.x - a.x) < w || abs(p.x - b.x) < w) && abs(p.y - cy) < 0.7) g = 1.0;
          if (abs(p.x - cx) < w && p.y > a.y && p.y < b.y) g = 1.0;
          if ((abs(p.y - a.y) < w || abs(p.y - b.y) < w) && abs(p.x - cx) < 0.7) g = 1.0;
          return g;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        int zonaFrag = int(floor(vZona + 0.5));
        float guia = 0.0;
        float tintaEncima = 0.0;
        if (zonaFrag < 0) diffuseColor.rgb *= 0.88; // cuello acanalado
        // costura del ruedo y de los puños
        float hasta = zonaFrag <= 1 ? uLargo - vCm.y : uLargoManga - vCm.y;
        if (zonaFrag >= 0 && hasta > 1.9 && hasta < 2.05) diffuseColor.rgb *= 0.78;
        ${bucle}
        if (!gl_FrontFacing) {
          diffuseColor.rgb *= 0.5; // interior en sombra
          if (zonaFrag == 1) {
            vec2 q = (vCm - uEtiquetaRect.xy) / uEtiquetaRect.zw;
            if (q.x >= 0.0 && q.x <= 1.0 && q.y >= 0.0 && q.y <= 1.0) {
              vec4 e = texture2D(uEtiqueta, vec2(1.0 - q.x, 1.0 - q.y));
              diffuseColor.rgb = mix(diffuseColor.rgb, e.rgb, e.a);
            }
          }
        }
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.898, 0.22, 0.118), guia);`,
      )
  }
  material.customProgramCacheKey = () => 'tela-orion-v2'
  return { material, uniforms: u }
}
