"""
Orion Flare: convierte el mockup "Animated Walking Tshirt" (Brock Creative) en un modelo liviano para la web.

  blender -b "<ruta>/Animated Walking Tshirt.blend" --python blender/mockup.py -- --abc "<ruta>/animationcache-001.abc" --cuadro 0 --salida public/modelos/camisas/mockup.glb [--render carpeta] [--explorar]

  --explorar   solo renderiza varios cuadros de la animación para elegir la pose más quieta.

Qué hace:
  1. Toma un solo cuadro de la animación de caminar (la camisa queda quieta en esa pose).
  2. Reduce la malla (de ~470 mil vértices a ~25 mil) conservando el UV del patrón.
  3. A partir del UV del patrón (frente, espalda, manga izquierda, manga derecha) calcula la zona
     y las coordenadas en cm de cada vértice, igual que las camisas generadas por camisa.py.
  4. Centra y escala la camisa a una talla L unisex (56 × 74 cm) y la exporta en .glb.
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

ANCHO_BASE = 22 * 2.54  # cm, talla L unisex
LARGO_BASE = 29 * 2.54


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--abc", required=True)
    p.add_argument("--cuadro", type=int, default=0)
    p.add_argument("--salida", default="")
    p.add_argument("--render", default="")
    p.add_argument("--explorar", action="store_true")
    p.add_argument("--vertices", type=int, default=26000)
    return p.parse_args(argv)


def preparar(abc):
    esc = bpy.context.scene
    for cf in bpy.data.cache_files:
        cf.filepath = abc
    ob = bpy.data.objects["cloth_parent"]
    return esc, ob


def camara(esc, objetivo_z, distancia, angulo):
    cam = esc.camera
    r = math.radians(angulo)
    cam.location = (math.sin(r) * distancia, -math.cos(r) * distancia, objetivo_z)
    cam.rotation_euler = (math.radians(90), 0, r)


def render_workbench(esc, ruta, res=700):
    esc.render.engine = "BLENDER_WORKBENCH"
    esc.display.shading.light = "STUDIO"
    esc.display.shading.color_type = "SINGLE"
    esc.display.shading.single_color = (0.06, 0.06, 0.065)
    esc.display.shading.show_cavity = True
    esc.render.resolution_x = res
    esc.render.resolution_y = int(res * 1.1)
    esc.render.film_transparent = False
    if not esc.world:
        esc.world = bpy.data.worlds.new("fondo")
    esc.world.color = (0.9, 0.9, 0.9)
    esc.render.filepath = ruta
    bpy.ops.render.render(write_still=True)


def malla_del_cuadro(ob, cuadro):
    bpy.context.scene.frame_set(cuadro)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    m = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    m.transform(ob.matrix_world)
    estatica = bpy.data.objects.new("camisa", m)
    bpy.context.scene.collection.objects.link(estatica)
    ob.hide_render = True
    ob.hide_viewport = True
    return estatica


def reducir(ob, objetivo):
    n = len(ob.data.vertices)
    if n <= objetivo:
        return
    dec = ob.modifiers.new("Reducir", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = objetivo / n
    dec.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    m = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    viejo = ob.data
    ob.modifiers.clear()
    ob.data = m
    bpy.data.meshes.remove(viejo)


def islas_de(bm, uv):
    visto, islas = set(), []
    for f in bm.faces:
        if f.index in visto:
            continue
        pila, caras = [f], []
        visto.add(f.index)
        while pila:
            c = pila.pop()
            caras.append(c)
            for e in c.edges:
                for g in e.link_faces:
                    if g.index not in visto:
                        visto.add(g.index)
                        pila.append(g)
        us = [l[uv].uv for c in caras for l in c.loops]
        bb = (min(p.x for p in us), max(p.x for p in us), min(p.y for p in us), max(p.y for p in us))
        islas.append((caras, bb))
    return islas


def limpiar_capas(ob):
    """Deja una sola capa de tela: quita la capa interior de cada pieza y las tiras del grosor de los bordes
    (salvo las del cuello, que forman el cuello acanalado). La web dibuja el interior por el otro lado de la cara."""
    m = ob.data
    bm = bmesh.new()
    bm.from_mesh(m)
    bm.faces.ensure_lookup_table()
    uv = bm.loops.layers.uv[0]
    zs = [v.co.z for v in bm.verts]
    z_min, z_max = min(zs), max(zs)
    alto = z_max - z_min
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    islas = islas_de(bm, uv)
    borrar = []
    grupos = {}
    for caras, bb in islas:
        tira = bb[1] - bb[0] < 0.05 or bb[3] - bb[2] < 0.05 or len(caras) < 2000
        vs = {v for c in caras for v in c.verts}
        if tira:
            arriba = max(v.co.z for v in vs) > z_max - alto * 0.12
            if not arriba:
                borrar += caras
            continue
        clave = (tuple(round(b, 3) for b in bb), len(caras))
        radio = sum(math.hypot(v.co.x - cx, v.co.y - cy) for v in vs) / len(vs)
        grupos.setdefault(clave, []).append((radio, caras))
    for lista in grupos.values():
        lista.sort(key=lambda t: t[0])
        for _, caras in lista[:-1]:  # todas menos la más externa
            borrar += caras
    bmesh.ops.delete(bm, geom=list(set(borrar)), context="FACES")
    bm.to_mesh(m)
    bm.free()
    print("TRAS_LIMPIAR", len(m.vertices), "vértices")


def zonas_y_patron(ob):
    """Zona y cm de patrón a partir del UV del mockup.

    Plantilla del mockup: frente arriba-izq., espalda arriba-der., mangas abajo. La manga de abajo-izq.
    ("LEFT" en la plantilla) es la izquierda de quien MIRA: queda en −x, o sea la manga derecha de quien
    la usa. Cada pieza viene doble (capa exterior e interior) y los bordes/cuello son tiras finas con UV
    casi sin área: esas tiras no llevan estampado (zona −1).
    """
    m = ob.data
    bm = bmesh.new()
    bm.from_mesh(m)
    uv = bm.loops.layers.uv[0]
    capa_cm = bm.loops.layers.uv.new("UVMap")
    capa_dat = bm.loops.layers.uv.new("datos")

    def zona_por_uv(u, v):
        if v > 0.30:
            return 0 if u < 0.5 else 1
        return 3 if u < 0.5 else 2

    # islas (piezas conectadas)
    visto = set()
    islas = []
    for f in bm.faces:
        if f.index in visto:
            continue
        pila, caras = [f], []
        visto.add(f.index)
        while pila:
            c = pila.pop()
            caras.append(c)
            for e in c.edges:
                for g in e.link_faces:
                    if g.index not in visto:
                        visto.add(g.index)
                        pila.append(g)
        us = [l[uv].uv for c in caras for l in c.loops]
        bb = (min(p.x for p in us), max(p.x for p in us), min(p.y for p in us), max(p.y for p in us))
        islas.append((caras, bb))

    # límites UV de cada pieza "de verdad" (las islas grandes con área)
    lim = {}
    for caras, bb in islas:
        if bb[1] - bb[0] < 0.05 or bb[3] - bb[2] < 0.05 or len(caras) < 2000:
            continue
        z = zona_por_uv((bb[0] + bb[1]) / 2, (bb[2] + bb[3]) / 2)
        l = lim.setdefault(z, list(bb))
        l[0], l[1], l[2], l[3] = min(l[0], bb[0]), max(l[1], bb[1]), min(l[2], bb[2]), max(l[3], bb[3])
    print("PIEZAS_UV", lim)
    cm_u = ANCHO_BASE / (lim[0][1] - lim[0][0])
    cm_v = LARGO_BASE / (lim[0][3] - lim[0][2])

    for caras, bb in islas:
        tira = bb[1] - bb[0] < 0.05 or bb[3] - bb[2] < 0.05 or len(caras) < 2000
        z = -1 if tira else zona_por_uv((bb[0] + bb[1]) / 2, (bb[2] + bb[3]) / 2)
        l = lim.get(z)
        for c in caras:
            for lp in c.loops:
                u, v = lp[uv].uv
                if z < 0 or l is None:
                    lp[capa_cm].uv = (0, 0)
                    lp[capa_dat].uv = (-1, 0.5)
                    continue
                x = (u - (l[0] + l[1]) / 2) * cm_u
                y = (l[3] - v) * cm_v  # desde el borde superior de la pieza (hombro / copa de la manga)
                alto = (l[3] - l[2]) or 1
                lp[capa_cm].uv = (x, y)
                lp[capa_dat].uv = (z, min(1.0, max(0.0, (l[3] - v) / alto)))
    bm.to_mesh(m)
    bm.free()
    return cm_u, cm_v


def centrar_y_escalar(ob):
    m = ob.data
    xs = [v.co.x for v in m.vertices]
    ys = [v.co.y for v in m.vertices]
    zs = [v.co.z for v in m.vertices]
    alto = max(zs) - min(zs)
    centro = Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, (max(zs) + min(zs)) / 2))
    # el largo de la camisa (hombro a ruedo) ≈ altura total menos lo que sube el cuello (~2 cm)
    escala = (LARGO_BASE + 2) / alto / 100  # a metros; al exportar se multiplica por 100
    for v in m.vertices:
        v.co = (v.co - centro) * escala
    print("ESCALA", escala, "ALTO_ORIGINAL", alto)


def exportar(ob, salida):
    ob.scale = (100, 100, 100)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # solo los UV que usa la web: patrón en cm y datos (zona, peso)
    for nombre in [u.name for u in ob.data.uv_layers]:
        if nombre not in ("UVMap", "datos"):
            ob.data.uv_layers.remove(ob.data.uv_layers[nombre])
    ob.data.uv_layers.active = ob.data.uv_layers["UVMap"]
    ob.data.materials.clear()
    for p in ob.data.polygons:
        p.use_smooth = True
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=salida, export_format="GLB", use_selection=True, export_apply=True,
        export_texcoords=True, export_normals=True, export_materials="NONE", export_yup=True,
    )


def main():
    a = args()
    esc, ob = preparar(a.abc)
    if a.explorar:
        os.makedirs(a.render, exist_ok=True)
        for c in range(esc.frame_start, esc.frame_end + 1, 15):
            esc.frame_set(c)
            camara(esc, 1.4, 9, 0)
            render_workbench(esc, os.path.join(a.render, f"cuadro-{c:03d}.png"), 360)
        return
    camisa = malla_del_cuadro(ob, a.cuadro)
    print("VERTICES_ORIGINALES", len(camisa.data.vertices))
    # una sola capa, después las zonas (con las piezas intactas) y al final se reduce la malla
    limpiar_capas(camisa)
    zonas_y_patron(camisa)
    reducir(camisa, a.vertices)
    centrar_y_escalar(camisa)
    if a.render:
        os.makedirs(a.render, exist_ok=True)
        for vista, ang in (("frente", 0), ("tres-cuartos", 35), ("espalda", 180)):
            camara(esc, 0, 3.0, ang)
            esc.camera.data.lens = 70
            render_workbench(esc, os.path.join(a.render, f"mockup-{vista}.png"), 900)
    if a.salida:
        exportar(camisa, a.salida)
    print("LISTO", len(camisa.data.vertices), "vértices")


main()
