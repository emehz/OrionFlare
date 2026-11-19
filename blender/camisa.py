"""
Orion Flare: genera la camisa 3D con simulación de tela real en Blender.

Uso (sin abrir Blender):
  blender -b --factory-startup --python blender/camisa.py -- --corte regular --salida public/modelos/camisas/regular.glb [--render carpeta]

Qué hace:
  1. Crea un maniquí invisible (modificador Skin) del tamaño adecuado para el corte.
  2. Crea la camisa como cuerpo tubular + mangas, con el contorno real de la tabla de tallas
     (el ancho de la tabla es la camisa extendida: el contorno es el doble).
  3. Une las costuras de los hombros y la deja caer sobre el maniquí con la simulación de tela de
     Blender (algodón), sujetándola de los hombros como en un maniquí de tienda.
  4. Guarda en cada vértice las coordenadas "de patrón" en cm (para poner los diseños) y la zona
     (frente, espalda, manga izquierda, manga derecha), agrega el cuello acanalado y exporta un .glb.

Unidades: la simulación corre en metros (como espera Blender); al exportar se escala a cm.
Ejes en Blender: Z arriba, el frente de la camisa mira hacia −Y (así queda +Z en three.js).
"""
import argparse
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

# ───────────────────────── parámetros por corte ─────────────────────────
PULG = 2.54
CORTES = {
    # talla base de cada corte (la web escala a las demás tallas): ancho y largo en pulgadas
    "regular": dict(ancho=22, largo=29, holgura=16, over=False, dama=False, manga="corta", cuello="redondo", nino=False),
    "oversize": dict(ancho=24, largo=29, holgura=30, over=True, dama=False, manga="corta", cuello="redondo", nino=False),
    "larga": dict(ancho=22, largo=29, holgura=16, over=False, dama=False, manga="larga", cuello="redondo", nino=False),
    "sin": dict(ancho=22, largo=29, holgura=14, over=False, dama=False, manga="sin", cuello="redondo", nino=False),
    "dama": dict(ancho=19.125, largo=26.25, holgura=8, over=False, dama=True, manga="corta", cuello="redondo", nino=False),
    "dama-v": dict(ancho=19.125, largo=26, holgura=8, over=False, dama=True, manga="corta", cuello="v", nino=False),
    "crop": dict(ancho=20, largo=17, largo_cuerpo=26.25, holgura=10, over=False, dama=True, manga="corta", cuello="redondo", nino=False, crop=True),
    "infantil": dict(ancho=14.5, largo=20, holgura=10, over=False, dama=False, manga="corta", cuello="redondo", nino=True),
}

EXP = 2.5  # superelipse: un poco plana al frente y atrás
PROF = 0.6  # profundidad / ancho de la sección del cuerpo


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--corte", default="regular", choices=list(CORTES))
    p.add_argument("--salida", required=True)
    p.add_argument("--render", default="")
    p.add_argument("--cuadros", type=int, default=100)
    return p.parse_args(argv)


def seccion(theta, a, b):
    c, s = math.cos(theta), math.sin(theta)
    return (a * math.copysign(abs(c) ** (2 / EXP), c), b * math.copysign(abs(s) ** (2 / EXP), s))


def perimetro_unidad():
    p, (px, pz) = 0.0, seccion(0, 1, PROF)
    for i in range(1, 721):
        x, z = seccion(i / 720 * 2 * math.pi, 1, PROF)
        p += math.hypot(x - px, z - pz)
        px, pz = x, z
    return p


def suave(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ───────────────────────── escena ─────────────────────────
def limpiar():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    esc = bpy.context.scene
    esc.unit_settings.system = "METRIC"
    esc.gravity = (0, 0, -9.81)
    return esc


def objeto(nombre, malla):
    ob = bpy.data.objects.new(nombre, malla)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def aplicar_modificadores(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    malla = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    viejo = ob.data
    ob.modifiers.clear()
    ob.data = malla
    bpy.data.meshes.remove(viejo)


# ───────────────────────── maniquí ─────────────────────────
def maniqui(c, P, centros_sisa):
    """Cuerpo sencillo con el modificador Skin. Medidas en metros.
    Los brazos salen por el centro de cada sisa, con el ángulo de la manga."""
    W, L = P["W"] / 100, P["L"] / 100
    arriba = L / 2
    hombro_z = arriba - P["pendiente"] / 100 - 0.012
    # el cuerpo tiene su propio largo (una crop top es corta, pero la persona no)
    L = c.get("largo_cuerpo", c["largo"]) * PULG / 100
    sisa_cuerpo = min(L * 0.42, P["W"] / 100 * 0.43)
    # contorno del pecho = contorno de la camisa − holgura
    contorno = (2 * P["W"] - c["holgura"]) / 100
    rx = contorno / 5.27  # perímetro de una elipse con ry = 0.66·rx ≈ 5.27·rx
    ry = rx * 0.66
    cintura = 0.86 if c["dama"] else (1.0 if c["nino"] else 0.94)
    k = 0.72 if c["nino"] else 1.0
    # la "bola" del hombro nunca más grande que la sisa (si no, empuja la tela del pecho)
    r_hombro = min(0.058 * k, P["sisa"] / math.pi / 100 * 0.75)
    pts = [
        (0, 0, arriba - L - 0.12, rx * 0.98, ry * 1.02),  # 0 cadera (bajo el ruedo)
        (0, 0, arriba - L * 0.6, rx * cintura, ry * 0.92),  # 1 cintura
        (0, 0, arriba - sisa_cuerpo * 0.9, rx, ry),  # 2 pecho
        (0, 0, hombro_z - 0.07 * k, rx * (1.0 if c["nino"] else 0.97), ry * 0.95),  # 3 parte alta del pecho
        (0, 0, hombro_z - 0.005, 0.07 * k, 0.065 * k),  # 4 base del cuello
        (0, 0, arriba + 0.06, 0.055 * k, 0.055 * k),  # 5 cuello
    ]
    verts = [Vector(p[:3]) for p in pts]
    aristas = [(i, i + 1) for i in range(len(pts) - 1)]
    radios = [(p[3], p[4]) for p in pts]
    # hombros anchos (la tela apoya en ellos) y brazos con el ángulo de la manga
    ang = math.radians(P["angulo"])
    largo_brazo = max(P["largo_manga"] / 100 + 0.1, 0.25)
    for n, s in enumerate((1, -1)):
        if centros_sisa:
            h = centros_sisa[n] - Vector((s * 0.025 * k, 0, 0))
        else:
            h = Vector((s * (P["a_hombro"] / 100 - 0.06 * k), 0, hombro_z - r_hombro - 0.02))
        i0 = len(verts)
        verts.append(h)
        radios.append((r_hombro, r_hombro))
        aristas.append((3, i0))
        if c["manga"] != "sin":
            # el brazo siempre más delgado que la manga (si no, la tela "explota" en el puño)
            r_puno = P["boca"] / math.pi / 100
            fin = h + Vector((s * math.cos(ang), 0, -math.sin(ang))) * largo_brazo
            verts.append(fin)
            radios.append((min(0.04 * k, r_puno * 0.62), min(0.04 * k, r_puno * 0.62)))
            aristas.append((i0, i0 + 1))
    m = bpy.data.meshes.new("maniqui")
    m.from_pydata([tuple(v) for v in verts], aristas, [])
    ob = objeto("maniqui", m)
    skin = ob.modifiers.new("Skin", "SKIN")
    skin.use_smooth_shade = True
    for i, r in enumerate(radios):
        ob.data.skin_vertices[0].data[i].radius = r
    ob.data.skin_vertices[0].data[0].use_root = True
    ob.modifiers.new("Subdiv", "SUBSURF").levels = 2
    aplicar_modificadores(ob)
    col = ob.modifiers.new("Colision", "COLLISION")
    ob.collision.thickness_outer = 0.006
    ob.collision.cloth_friction = 8
    ob.hide_render = True
    return ob


# ───────────────────────── camisa ─────────────────────────
def parametros(c):
    W, L = c["ancho"] * PULG, c["largo"] * PULG
    over, dama = c["over"], c["dama"]
    largo_manga = W * (0.38 if over else 0.28 if dama else 0.36)
    angulo = 40 if over else 52
    boca = W * (0.42 if over else 0.30 if dama else 0.33)
    if c["manga"] == "larga":
        largo_manga, angulo, boca = L * 0.8, 62, W * 0.2
    P = dict(
        W=W, L=L,
        caida=W * 0.05 if over else (-W * 0.03 if dama else 0),
        pendiente=5.2 if over else 4.2,
        sisa=min(L * 0.42, W * (0.5 if over else 0.38 if dama else 0.43)),
        largo_manga=largo_manga, angulo=angulo, boca=boca,
        cintura=0.07 if c["dama"] and not c.get("crop") else 0,
        ancho_cuello=max(6.5 if not c["nino"] else 5, W * 0.165),
        prof_frente=max(9, W * 0.3) if c["cuello"] == "v" else max(5 if not c["nino"] else 4, W * 0.15),
        prof_espalda=2.2,
    )
    a_base = 2 * W / perimetro_unidad()
    P["a_base"] = a_base
    P["a_hombro"] = a_base + max(0, P["caida"])
    return P


def construir_camisa(c, P):
    """Malla de la camisa (en cm, luego se escala a m). Devuelve el objeto con atributos de patrón."""
    W, L = P["W"], P["L"]
    arriba, abajo = L / 2, -L / 2
    y_axila = arriba - P["sisa"]
    nw = P["ancho_cuello"]
    con_mangas = c["manga"] != "sin"

    def semiancho(y):
        a = P["a_base"]
        if P["cintura"]:
            yc = abajo + L * 0.42
            a *= 1 - P["cintura"] * math.exp(-(((y - yc) / (L * 0.18)) ** 2))
        a *= 1 + 0.02 * (1 - suave(abajo, abajo + 10, y))
        if P["caida"] > 0:
            a += P["caida"] * suave(y_axila - 6, arriba - 2, y)
        if not con_mangas:
            a = a + (nw + 6.5 - a) * suave(y_axila, arriba, y)
        return a

    a_hombro = semiancho(arriba)

    def borde(x, frente):
        ax = abs(x)
        if ax < nw:
            t = ax / nw
            prof = P["prof_frente"] if frente else P["prof_espalda"]
            caida = prof * (1 - t) if (frente and c["cuello"] == "v") else prof * math.sqrt(max(0, 1 - t * t))
            zr = nw * 0.78 * math.sqrt(max(0, 1 - t * t))
            return arriba - caida, (1 if frente else -1) * zr
        t = min(1, (ax - nw) / max(1, a_hombro - nw))
        y = arriba - P["pendiente"] * t ** 1.25
        return y, 0.0

    bm = bmesh.new()
    capa_cm = bm.loops.layers.uv.new("UVMap")  # x, y de patrón en cm
    capa_dat = bm.loops.layers.uv.new("datos")  # zona, peso
    zona_v, cm_v, peso_v, pin_v = {}, {}, {}, {}

    U, R = 96, 64
    columnas = []
    for i in range(U):
        th = i / U * 2 * math.pi
        frente = math.sin(th) >= 0
        xs, _ = seccion(th, a_hombro, a_hombro * PROF)
        y_top, z_top = borde(xs, frente)
        col = []
        for j in range(R + 1):
            v = j / R
            y = abajo + v * (y_top - abajo)
            a = semiancho(y)
            x, z = seccion(th, a, a * PROF)
            d = y_top - y
            if d < 10:
                t = 1 - d / 10
                k = math.sqrt(max(0, 1 - t * t))
                z = z_top + (z - z_top) * k
                if abs(xs) < nw:
                    x = xs + (x - xs) * k
            vert = bm.verts.new((x, -z, y))  # Blender: el frente mira a −Y (queda +Z en la web), Z = altura
            zona_v[vert] = 0 if frente else 1
            peso_v[vert] = min(1, max(0, (y_axila + 4 - y) / (y_axila + 4 - abajo))) ** 1.3
            # se sujeta de los hombros; el borde de un cuello en V queda libre para que caiga natural
            libre = c["cuello"] == "v" and frente and abs(xs) < nw
            base_pin = max(0.0, 1 - d / 3.0) if d < 3 else 0.0
            pin_v[vert] = base_pin * 0.4 if libre else base_pin
            col.append(vert)
        columnas.append(col)

    # coordenadas de patrón: distancia sobre la tela desde el centro de cada cara
    for j in range(R + 1):
        largos = [0.0]
        for i in range(1, U + 1):
            a, b = columnas[i - 1][j].co, columnas[i % U][j].co
            largos.append(largos[-1] + math.hypot(b.x - a.x, b.y - a.y))
        cf, ce = largos[U // 4], largos[3 * U // 4]
        for i in range(U):
            vert = columnas[i][j]
            s = largos[i]
            cm_v[vert] = ((cf - s) if zona_v[vert] == 0 else (ce - s), arriba - vert.co.z)

    # Sisas: con mangas, no se crean las caras del costado entre la axila y el hombro.
    ang_sisa = math.radians(30)

    def en_sisa(i, j):
        if not con_mangas:
            return False
        th = (i + 0.5) / U * 2 * math.pi
        cerca_lado = min(abs(math.atan2(math.sin(th), math.cos(th))), abs(math.atan2(math.sin(th - math.pi), math.cos(th - math.pi))))
        return cerca_lado < ang_sisa and columnas[i][j].co.z >= y_axila - 0.01

    for i in range(U):
        i2 = (i + 1) % U
        for j in range(R):
            if en_sisa(i, j):
                continue
            bm.faces.new((columnas[i][j], columnas[i2][j], columnas[i2][j + 1], columnas[i][j + 1]))

    # unir la costura de los hombros (frente y espalda llegan al mismo punto)
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts], dist=0.05)
    for v in [v for v in bm.verts if not v.link_faces]:
        bm.verts.remove(v)

    # Mangas cosidas a la sisa: cada manga sale del borde del agujero y se va volviendo un tubo
    largo_manga = 0.0
    centros_sisa = []
    if con_mangas:
        r0 = P["sisa"] / math.pi
        r1 = P["boca"] / math.pi
        ang = math.radians(P["angulo"])
        T = 22
        largo_manga = P["largo_manga"]
        for signo in (1, -1):
            # borde de la sisa de este lado, ordenado como un anillo
            bordes = [e for e in bm.edges if e.is_boundary and all(signo * v.co.x > nw * 1.2 and v.co.z > y_axila - 0.5 for v in e.verts)]
            vecinos = {}
            for e in bordes:
                a, b = e.verts
                vecinos.setdefault(a, []).append(b)
                vecinos.setdefault(b, []).append(a)
            inicio_v = next(iter(vecinos))
            anillo0, previo, actual = [inicio_v], None, inicio_v
            while True:
                sig = [n for n in vecinos[actual] if n is not previo]
                if not sig or sig[0] is inicio_v:
                    break
                previo, actual = actual, sig[0]
                anillo0.append(actual)
            centro0 = sum((v.co for v in anillo0), Vector()) / len(anillo0)
            centros_sisa.append(centro0.copy())
            dire = Vector((signo * math.cos(ang), 0, -math.sin(ang)))
            e1 = Vector((signo * math.sin(ang), 0, math.cos(ang)))  # parte de arriba de la manga
            e2 = Vector((0, -1, 0))  # frente
            fases = []
            for v in anillo0:
                d = v.co - centro0
                fases.append(math.atan2(d.dot(e2), d.dot(e1)))
            largo = P["largo_manga"]
            anillos = [anillo0]
            for k in range(1, T + 1):
                t = k / T
                radio = r0 + (r1 - r0) * t ** 0.8
                centro = centro0 + dire * (1.0 + t * largo)
                mezcla = suave(0.0, 0.25, t)  # del borde de la sisa al tubo redondo
                anillo = []
                for v, ph in zip(anillo0, fases):
                    circulo = centro + e1 * (math.cos(ph) * radio) + e2 * (math.sin(ph) * radio * 0.86)
                    borde_desplazado = v.co + dire * (1.0 + t * largo)
                    p = borde_desplazado.lerp(circulo, mezcla)
                    nv = bm.verts.new(p)
                    zona_v[nv] = 2 if signo > 0 else 3
                    dph = math.atan2(math.sin(ph - math.pi / 4), math.cos(ph - math.pi / 4))
                    cm_v[nv] = (-dph * radio * signo, t * largo)
                    peso_v[nv] = 0.25 + 0.75 * t
                    pin_v[nv] = 0.0
                    anillo.append(nv)
                anillos.append(anillo)
            n = len(anillo0)
            for k in range(T):
                for s in range(n):
                    s2 = (s + 1) % n
                    bm.faces.new((anillos[k][s], anillos[k][s2], anillos[k + 1][s2], anillos[k + 1][s]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        # que las normales apunten hacia afuera (el ruedo del frente debe mirar a −Y)
        frente_bajo = [f for f in bm.faces if f.calc_center_median().z < abajo + 5 and f.calc_center_median().y < -5]
        if frente_bajo and sum(f.normal.y for f in frente_bajo) > 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)

    for f in bm.faces:
        for lp in f.loops:
            v = lp.vert
            lp[capa_cm].uv = cm_v.get(v, (0, 0))
            lp[capa_dat].uv = (zona_v.get(v, 0), peso_v.get(v, 0))
    bm.normal_update()

    m = bpy.data.meshes.new("camisa")
    bm.to_mesh(m)
    pins = [pin_v.get(v, 0.0) for v in bm.verts]
    bm.free()
    ob = objeto("camisa", m)
    grupo = ob.vertex_groups.new(name="pin")
    for i, w in enumerate(pins):
        if w > 0:
            grupo.add([i], w, "REPLACE")
    ob.scale = (0.01, 0.01, 0.01)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in ob.data.polygons:
        p.use_smooth = True
    return ob, [c_ * 0.01 for c_ in centros_sisa]


def simular(ob, cuadros):
    mod = ob.modifiers.new("Tela", "CLOTH")
    s = mod.settings
    # jersey de algodón: algo más firme que el preset "Cotton" para que caiga sin ondularse
    s.quality = 12
    s.mass = 0.2
    s.air_damping = 3
    s.tension_stiffness = 25
    s.compression_stiffness = 25
    s.shear_stiffness = 10
    s.bending_stiffness = 1.2
    s.tension_damping = 8
    s.compression_damping = 8
    s.shear_damping = 8
    s.bending_damping = 1.0
    s.vertex_group_mass = "pin"
    s.pin_stiffness = 1.0
    cs = mod.collision_settings
    cs.distance_min = 0.004
    cs.use_self_collision = False
    cs.collision_quality = 4
    esc = bpy.context.scene
    esc.frame_start, esc.frame_end = 1, cuadros
    mod.point_cache.frame_start, mod.point_cache.frame_end = 1, cuadros
    for f in range(1, cuadros + 1):
        esc.frame_set(f)
    aplicar_modificadores(ob)
    # suaviza el "ruido" de la simulación sin borrar los pliegues grandes
    sm = ob.modifiers.new("Suavizar", "CORRECTIVE_SMOOTH")
    sm.iterations = 4
    sm.factor = 0.5
    sm.use_only_smooth = True
    aplicar_modificadores(ob)


def cuello(ob, c, P):
    """Cuello acanalado: extruye el borde del cuello hacia arriba y adentro."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    capa_cm = bm.loops.layers.uv["UVMap"]
    capa_dat = bm.loops.layers.uv["datos"]
    alto = P["L"] / 200
    bordes = [e for e in bm.edges if e.is_boundary and all(v.co.z > alto - 0.16 and abs(v.co.x) < P["ancho_cuello"] / 100 * 1.3 for v in e.verts)]
    if not bordes:
        bm.free()
        return
    res = bmesh.ops.extrude_edge_only(bm, edges=bordes)
    nuevos = [g for g in res["geom"] if isinstance(g, bmesh.types.BMVert)]
    centro = Vector((0, 0, 0))
    for v in nuevos:
        centro += v.co
    centro /= len(nuevos)
    for v in nuevos:
        hacia = Vector((centro.x - v.co.x, centro.y - v.co.y, 0))
        v.co += Vector((0, 0, 0.018)) + hacia.normalized() * 0.004
    for f in res["geom"]:
        if isinstance(f, bmesh.types.BMFace):
            for lp in f.loops:
                lp[capa_dat].uv = (-1, 0)
                lp[capa_cm].uv = (0, 0)
    bm.normal_update()
    bm.to_mesh(ob.data)
    bm.free()


def render(ob, carpeta, nombre):
    os.makedirs(carpeta, exist_ok=True)
    esc = bpy.context.scene
    esc.render.engine = "BLENDER_WORKBENCH"
    esc.display.shading.light = "STUDIO"
    esc.display.shading.color_type = "SINGLE"
    esc.display.shading.single_color = (0.06, 0.06, 0.065)
    esc.display.shading.show_cavity = True
    esc.display.shading.cavity_type = "BOTH"
    esc.display.shading.show_specular_highlight = False
    esc.render.resolution_x, esc.render.resolution_y = 900, 1000
    esc.world = bpy.data.worlds.new("fondo")
    esc.world.color = (0.92, 0.92, 0.92)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    esc.collection.objects.link(cam)
    esc.camera = cam
    cam.data.lens = 70
    for vista, ang in (("frente", 0), ("tres-cuartos", 35), ("espalda", 180)):
        r = math.radians(ang)
        d = 3.0
        cam.location = (math.sin(r) * d, -math.cos(r) * d, 0.02)
        cam.rotation_euler = (math.radians(90), 0, r)
        esc.render.filepath = os.path.join(carpeta, f"{nombre}-{vista}.png")
        bpy.ops.render.render(write_still=True)


def exportar(ob, salida):
    # a cm para la web
    ob.scale = (100, 100, 100)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=salida,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="NONE",
        export_yup=True,
    )


def main():
    a = args()
    c = CORTES[a.corte]
    limpiar()
    P = parametros(c)
    ob, centros = construir_camisa(c, P)
    maniqui(c, P, centros)
    simular(ob, a.cuadros)
    cuello(ob, c, P)
    if a.render:
        render(ob, a.render, a.corte)
    exportar(ob, a.salida)
    print(f"LISTO {a.corte}: {len(ob.data.vertices)} vértices -> {a.salida}")


main()
