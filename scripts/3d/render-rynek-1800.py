"""
The Main Square around 1800, before the Town Hall was pulled down (1820): a massing
reconstruction on today's buildings, rendered in Blender. Two frames from the same camera: with the
Town Hall ("then") and without it ("today"), for the Time Lens comparison.

Run (no window):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P scripts/3d/render-rynek-1800.py -- <out dir> [samples]

What is known and used (Wikimedia Commons, public domain; copies and licences in
02_dane/media_pd/ratusz/sources.json):
  - the ground plan "Rzuty poziome" (Tab. I, before 1900): the parts of the complex and where they stand;
  - Karol Balicki's elevations (1851): the north block's Renaissance attic with round blind arches and a
    crest of pinnacles, oval windows under it, three rows of windows; the Gothic wing's stepped gable;
  - F. C. Dietrich, view of the square and the Town Hall (1820): the hipped roof, the arcaded porch;
  - M. Stachowicz, Kościuszko's Oath (1797): colours (grey block, red brick wing, red roofs);
  - pl.wikipedia.org/wiki/Ratusz_w_Krakowie: demolished 1820, the tower kept.
  Today's buildings: GUGiK LoD2 3D buildings, 2017 (CC BY 4.0).
NOT known, only suggested: the plan has no scale bar (its tower is taken as 10 m wide), exact heights,
window counts, colours of each part. Labelled in the app as a reconstruction, not a view.
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "."
SAMPLES = int(argv[1]) if len(argv) > 1 else 64
GLB = r"C:\Users\grzan\Desktop\strona\02_dane\gugik_3d\modele\rynek-area.glb"

# scene: metres, +X east, +Y north, +Z up in Blender (the glTF importer turns glTF's Y-up)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
prefs = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = backend
        prefs.get_devices()
        if any(d.type == backend for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == backend
            scene.cycles.device = "GPU"
            break
    except TypeError:
        continue
scene.render.resolution_x = 1600
scene.render.resolution_y = 1000
scene.view_settings.view_transform = "AgX"
scene.view_settings.exposure = -1.1
scene.view_settings.look = "AgX - Medium High Contrast"


def material(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def node_material(name, build, rough=0.85):
    """A material whose colour comes from a small node graph: build(nodes, links) -> colour socket."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    links.new(build(nodes, links), bsdf.inputs["Base Color"])
    return m


def facade_coords(nodes, links, scale=1.0):
    """World position folded onto the walls: along the wall (x + y), up the wall (z), in metres."""
    geo = nodes.new("ShaderNodeNewGeometry")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(geo.outputs["Position"], sep.inputs[0])
    add = nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    links.new(sep.outputs[0], add.inputs[0])
    links.new(sep.outputs[1], add.inputs[1])
    comb = nodes.new("ShaderNodeCombineXYZ")
    links.new(add.outputs[0], comb.inputs[0])
    links.new(sep.outputs[2], comb.inputs[1])
    return comb.outputs[0]


def plaster_graph(nodes, links):
    # each house its own colour: ochre, sand, rose, grey-green, as on the square's plastered fronts
    info = nodes.new("ShaderNodeObjectInfo")
    ramp = nodes.new("ShaderNodeValToRGB")
    cols = [(0.62, 0.38, 0.16), (0.70, 0.55, 0.30), (0.60, 0.30, 0.25), (0.42, 0.46, 0.34), (0.74, 0.50, 0.22)]
    ramp.color_ramp.interpolation = "CONSTANT"
    while len(ramp.color_ramp.elements) < len(cols):
        ramp.color_ramp.elements.new(0.5)
    for i, c in enumerate(cols):
        ramp.color_ramp.elements[i].position = i / len(cols)
        ramp.color_ramp.elements[i].color = (*c, 1)
    # the model's houses are one object: vary by position instead, block by block
    vor = nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 0.09
    links.new(vor.outputs["Color"], ramp.inputs["Fac"]) if False else links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
    # windows: a grid of dark openings, a storey (3.6 m) tall and 3.2 m apart
    bricks = nodes.new("ShaderNodeTexBrick")
    links.new(facade_coords(nodes, links), bricks.inputs["Vector"])
    bricks.inputs["Scale"].default_value = 1.0
    bricks.inputs["Mortar Size"].default_value = 1.05
    bricks.inputs["Mortar Smooth"].default_value = 0.0
    bricks.offset = 0.0
    bricks.inputs["Brick Width"].default_value = 3.2
    bricks.inputs["Row Height"].default_value = 3.6
    bricks.inputs["Color1"].default_value = (0.12, 0.12, 0.13, 1)
    bricks.inputs["Color2"].default_value = (0.16, 0.15, 0.15, 1)
    links.new(ramp.outputs["Color"], bricks.inputs["Mortar"])
    return bricks.outputs["Color"]


def roof_graph(nodes, links):
    bricks = nodes.new("ShaderNodeTexBrick")
    links.new(facade_coords(nodes, links), bricks.inputs["Vector"])
    bricks.inputs["Scale"].default_value = 1.0
    bricks.inputs["Brick Width"].default_value = 0.32
    bricks.inputs["Row Height"].default_value = 0.22
    bricks.inputs["Mortar Size"].default_value = 0.012
    bricks.inputs["Color1"].default_value = (0.40, 0.14, 0.08, 1)
    bricks.inputs["Color2"].default_value = (0.47, 0.19, 0.10, 1)
    bricks.inputs["Mortar"].default_value = (0.18, 0.08, 0.05, 1)
    return bricks.outputs["Color"]


def brick_graph(nodes, links):
    bricks = nodes.new("ShaderNodeTexBrick")
    links.new(facade_coords(nodes, links), bricks.inputs["Vector"])
    bricks.inputs["Scale"].default_value = 1.0
    bricks.inputs["Brick Width"].default_value = 0.28
    bricks.inputs["Row Height"].default_value = 0.085
    bricks.inputs["Mortar Size"].default_value = 0.01
    bricks.inputs["Color1"].default_value = (0.50, 0.22, 0.13, 1)
    bricks.inputs["Color2"].default_value = (0.58, 0.28, 0.16, 1)
    bricks.inputs["Mortar"].default_value = (0.62, 0.56, 0.48, 1)
    return bricks.outputs["Color"]


def cobble_graph(nodes, links):
    tex = nodes.new("ShaderNodeTexCoord")
    vor = nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 5.0
    links.new(tex.outputs["Object"], vor.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.07, 0.065, 0.06, 1)
    ramp.color_ramp.elements[1].position = 0.35
    ramp.color_ramp.elements[1].color = (0.19, 0.17, 0.15, 1)
    links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
    return ramp.outputs["Color"]


PLASTER = node_material("plaster", plaster_graph)
ROOF = node_material("roof tiles", roof_graph, 0.7)
BRICK = node_material("gothic brick", brick_graph, 0.9)
STONE = material("stone", (0.70, 0.66, 0.58))
CLOTH = material("cloth hall", (0.84, 0.76, 0.60))
COBBLE = node_material("square", cobble_graph, 0.95)
COPPER = material("copper", (0.25, 0.42, 0.36), 0.6)
WINDOW = material("window", (0.03, 0.03, 0.04), 0.9)

# today's buildings
bpy.ops.import_scene.gltf(filepath=GLB)
# materials by the group names written by extract-area.mjs: houses get plaster with windows, the
# brick landmarks (Town Hall Tower, St Mary's) brick, the Cloth Hall its light stone
WALLS = {"wall": PLASTER, "tower-wall": BRICK, "stmarys-wall": BRICK, "cloth-wall": CLOTH}
for ob in bpy.context.selected_objects:
    if ob.type == "MESH":
        for slot in ob.material_slots:
            name = slot.material.name.split(".")[0] if slot.material else ""
            slot.material = ROOF if name.endswith("roof") else WALLS.get(name, PLASTER)

# the square
bpy.ops.mesh.primitive_plane_add(size=900, location=(0, 0, 0))
bpy.context.object.data.materials.append(COBBLE)

# ---------------------------------------------------------------- the Town Hall, around 1800
# After the ground plan in "Rzuty poziome" (Tab. I, lithograph before 1900, public domain: west at the
# top, east at the bottom, south left, north right), the elevations by Karol Balicki (1851), the view
# by F. C. Dietrich (1820) and M. Stachowicz's "Kościuszko's Oath" (1797). The plan has no scale bar:
# its tower is taken as 10 m wide, which gives a complex of about 47 x 38 m and a north-east front of
# about 37 m, as in Balicki's elevation. Heights follow the elevations' proportions. Approximate.
#
# Axes of the square: E = along the square's east (perpendicular to the Cloth Hall), N = along the
# Cloth Hall. The complex is laid out in (e, n) metres from its south-west corner.
A = math.radians(-27.2)
E_AX = Vector((math.cos(A), math.sin(A), 0))
N_AX = Vector((-math.sin(A), math.cos(A), 0))
TOWER = Vector((-45.6, -19.1, 0))
# the tower's centre in plan coordinates: e 32.2, n 5
ORIGIN = TOWER - E_AX * 32.2 - N_AX * 5.0
DEPTH, LONG = 38.4, 46.8  # e and n extent of the complex

hall = bpy.data.collections.new("Town Hall 1800")
scene.collection.children.link(hall)


def put(ob):
    for c in ob.users_collection:
        c.objects.unlink(ob)
    hall.objects.link(ob)
    return ob


def at(e, n, z=0.0):
    return ORIGIN + E_AX * e + N_AX * n + Vector((0, 0, z))


def mesh(name, verts, faces, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    scene.collection.objects.link(ob)
    return put(ob)


BOX_FACES = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]


def box(name, e0, e1, n0, n1, z0, z1, mat):
    v = [at(e, n, z) for z in (z0, z1) for (e, n) in ((e0, n0), (e1, n0), (e1, n1), (e0, n1))]
    return mesh(name, v, BOX_FACES, mat)


def openings(name, face, a0, a1, fixed, rows, per_row, z0, storey, w, h, mat=None, oval=False, round_top=False):
    """Dark openings on a wall: face 'e' (wall at e = fixed, runs along n) or 'n' (wall at n = fixed)."""
    for r in range(rows):
        for k in range(per_row):
            c = a0 + (k + 0.5) * (a1 - a0) / per_row
            z = z0 + r * storey
            if oval:
                pts = [(c + math.cos(t) * w / 2, z + h / 2 + math.sin(t) * h / 2) for t in (i * math.pi / 6 for i in range(12))]
            elif round_top:
                # a round-headed blind arch: straight sides, a half circle on top
                pts = [(c - w / 2, z), (c + w / 2, z)] + [(c + math.cos(t) * w / 2, z + h - w / 2 + math.sin(t) * w / 2) for t in (i * math.pi / 8 for i in range(9))] + [(c - w / 2, z)]
                pts = pts[:-1]
            else:
                pts = [(c - w / 2, z), (c + w / 2, z), (c + w / 2, z + h), (c - w / 2, z + h)]
            verts = [at(fixed, x, zz) if face == 'e' else at(x, fixed, zz) for (x, zz) in pts]
            mesh(f"{name} {r} {k}", verts, [tuple(range(len(verts)))], mat or WINDOW)


GREY = material("grey render", (0.46, 0.44, 0.41))

# 1) the north block: granaries and offices, rendered grey, three storeys under a Renaissance attic
N0, N1, WALL_N = 20.3, LONG, 17.0
box("north block", 0, DEPTH, N0, N1, 0, WALL_N, GREY)
# the attic: a parapet on top, blind round arches on its faces, a crest of pinnacles
box("attic", -0.3, DEPTH + 0.3, N0 - 0.3, N1 + 0.3, WALL_N, WALL_N + 0.6, STONE)  # cornice
box("attic wall", 0, DEPTH, N0, N1, WALL_N + 0.6, WALL_N + 4.2, GREY)
for face, a0, a1, fixed, n in (("n", 0, DEPTH, N1 + 0.03, 10), ("n", 0, DEPTH, N0 - 0.03, 10), ("e", N0, N1, DEPTH + 0.03, 7), ("e", N0, N1, -0.03, 7)):
    openings(f"attic arch {face}{fixed:.0f}", face, a0, a1, fixed, 1, n, WALL_N + 1.0, 0, 1.6, 2.8, WINDOW, round_top=True)
    # crest: a pinnacle between every second arch
    for k in range(0, n + 1, 2):
        c = a0 + k * (a1 - a0) / n
        loc = at(fixed, c, WALL_N + 5.4) if face == 'e' else at(c, fixed, WALL_N + 5.4)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.45, depth=2.4, location=loc)
        put(bpy.context.object).data.materials.append(STONE)
# windows: three rows on the east (market) and north fronts, a row of oval windows under the attic
openings("north block windows E", "e", N0, N1, DEPTH + 0.03, 3, 7, 2.2, 4.4, 1.1, 1.9)
openings("north block ovals E", "e", N0, N1, DEPTH + 0.03, 1, 7, 15.2, 0, 0.9, 0.6, oval=True)
openings("north block windows N", "n", 0, DEPTH, N1 + 0.03, 3, 9, 2.2, 4.4, 1.1, 1.9)
openings("north block ovals N", "n", 0, DEPTH, N1 + 0.03, 1, 9, 15.2, 0, 0.9, 0.6, oval=True)
# a large hipped roof behind the attic, as Dietrich drew it in 1820
rz, rt = WALL_N + 3.4, WALL_N + 12.0
roof_v = [at(1.5, N0 + 1.5, rz), at(DEPTH - 1.5, N0 + 1.5, rz), at(DEPTH - 1.5, N1 - 1.5, rz), at(1.5, N1 - 1.5, rz),
          at(DEPTH / 2, N0 + 8, rt), at(DEPTH / 2, N1 - 8, rt)]
mesh("north block roof", roof_v, [(0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (3, 0, 4, 5)], ROOF)

# 2) the Gothic hall in the middle (Town Hall chamber and Lords' Room): red brick, perpendicular to the
# Cloth Hall, a steep roof along it and stepped, blind-arched gables at both ends
M0, M1, WALL_M = 9.5, 20.3, 14.0
RIDGE = WALL_M + 9.0
box("gothic hall", 0, DEPTH, M0, M1, 0, WALL_M, BRICK)
mid = (M0 + M1) / 2
mesh("gothic roof", [at(0, M0, WALL_M), at(DEPTH, M0, WALL_M), at(DEPTH, mid, RIDGE), at(0, mid, RIDGE), at(DEPTH, M1, WALL_M), at(0, M1, WALL_M)],
     [(0, 1, 2, 3), (3, 2, 4, 5)], ROOF)
for end in (-0.05, DEPTH + 0.05):
    steps = 5
    out = 0.6 if end > 0 else -0.6
    for i in range(steps):
        n0 = M0 + i * (mid - M0) / steps
        n1 = M1 - i * (M1 - mid) / steps
        z0 = WALL_M + (RIDGE + 2.5 - WALL_M) * i / steps
        z1 = WALL_M + (RIDGE + 2.5 - WALL_M) * (i + 1) / steps
        g = [at(end, n0, z0), at(end, n1, z0), at(end, n1, z1), at(end, n0, z1)]
        g2 = [p + E_AX * out for p in g]
        mesh(f"gable step {end:.0f} {i}", g + g2, BOX_FACES, BRICK)
        for nn in (n0, n1):
            bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.3, depth=2.0, location=at(end + out / 2, nn, z1 + 1.0))
            put(bpy.context.object).data.materials.append(STONE)
    # tall pointed blind arches and windows in the gable, as in Balicki's north-west view
    for k in range(4):
        c = M0 + 2.2 + k * (M1 - M0 - 4.4) / 3
        top = WALL_M + 7.5 - abs(k - 1.5) * 2.2
        pts = [(c - 0.55, WALL_M - 5.0), (c + 0.55, WALL_M - 5.0), (c + 0.55, top), (c, top + 1.0), (c - 0.55, top)]
        verts = [at(end + out * 1.02, x, z) for (x, z) in pts]
        mesh(f"gothic window {end:.0f} {k}", verts, [tuple(range(5))], WINDOW)
openings("gothic hall windows E", "e", M0, M1, DEPTH + 0.03, 2, 3, 2.5, 5.0, 1.1, 2.6)

# 3) the south-west wing: prisons and the courtyard, lower, with an arcaded, crenellated gallery
box("prison wing", 0, 14.8, 0, M0, 0, 9.0, GREY)
mesh("prison roof", [at(0, 0, 9.0), at(14.8, 0, 9.0), at(14.8, M0 / 2, 13.0), at(0, M0 / 2, 13.0), at(14.8, M0, 9.0), at(0, M0, 9.0)],
     [(0, 1, 2, 3), (3, 2, 4, 5)], ROOF)
box("courtyard wall", 14.8, 26.8, 0, 0.8, 0, 6.5, STONE)
openings("courtyard gallery", "n", 15.2, 26.4, -0.03, 1, 5, 3.4, 0, 1.4, 2.2)
for k in range(9):
    e = 15.0 + k * 1.45
    box(f"merlon {k}", e, e + 0.8, 0, 0.8, 6.5, 7.4, STONE)

# 4) the arcaded porch (ganek) along the whole market front, as on the plan and in Dietrich's view
G0, G1 = DEPTH, DEPTH + 3.8
arches = 12
for k in range(arches + 1):
    n = 4.0 + k * (LONG - 4.0 + 2.7) / arches
    box(f"porch pier {k}", G1 - 0.6, G1, n - 0.3, n + 0.3, 0, 3.6, STONE)
for k in range(arches):
    n = 4.0 + (k + 0.5) * (LONG - 4.0 + 2.7) / arches
    r_in, r_out, verts, faces, nn = 1.25, 1.55, [], [], 12
    for i in range(nn + 1):
        t = math.pi * i / nn
        for r in (r_in, r_out):
            for de in (-0.6, 0.0):
                verts.append(at(G1 + de, n - r * math.cos(t), 3.6 + r * math.sin(t) * 0.8))
    for i in range(nn):
        q = i * 4
        faces += [(q, q + 1, q + 5, q + 4), (q + 2, q + 3, q + 7, q + 6), (q, q + 2, q + 6, q + 4), (q + 1, q + 3, q + 7, q + 5)]
    mesh(f"porch arch {k}", verts, faces, STONE)
box("porch beam", G1 - 0.6, G1, 4.0 - 0.3, LONG + 2.7 + 0.3, 5.0, 5.7, STONE)
mesh("porch roof", [at(G0, 4.0 - 0.3, 8.0), at(G0, LONG + 3.0, 8.0), at(G1 + 0.4, LONG + 3.0, 5.7), at(G1 + 0.4, 4.0 - 0.3, 5.7)], [(0, 1, 2, 3)], ROOF)

# ---------------------------------------------------------------- light and camera
world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
nt = world.node_tree
sky = nt.nodes.new("ShaderNodeTexSky")
for kind in ("MULTIPLE_SCATTERING", "NISHITA", "HOSEK_WILKIE"):
    try:
        sky.sky_type = kind
        break
    except TypeError:
        continue
sky.sun_elevation = math.radians(32)
sky.sun_rotation = math.radians(200)
nt.links.new(sky.outputs["Color"], nt.nodes["Background"].inputs["Color"])
nt.nodes["Background"].inputs["Strength"].default_value = 0.18

sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.2
sun.data.color = (1.0, 0.93, 0.82)
sun.rotation_euler = (math.radians(58), 0, math.radians(200))
scene.collection.objects.link(sun)

# CAMERA: "tower" = from above St Mary's side, looking west-south-west over the Cloth Hall to the
# Town Hall; "plan" = straight down, to check where the Town Hall stands
VIEW = argv[2] if len(argv) > 2 else "tower"
cam = bpy.data.objects.new("camera", bpy.data.cameras.new("camera"))
scene.collection.objects.link(cam)
scene.camera = cam
CENTRE = at(DEPTH / 2, LONG / 2)
target = CENTRE + Vector((0, 0, 8))
if VIEW == "plan":
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 260
    cam.location = Vector((0, 0, 300))
    cam.rotation_euler = (0, 0, 0)
elif VIEW == "street":
    cam.location = at(DEPTH + 17, LONG + 22, 1.7)
    cam.rotation_euler = ((at(DEPTH / 2, LONG / 2 - 6, 11)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 22
else:
    cam.location = Vector((95, 70, 68))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 35

for name, show in ((f"rynek-1800-{VIEW}", True), (f"rynek-dzis-{VIEW}", False)):
    hall.hide_render = not show
    scene.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
    print("wrote", scene.render.filepath)
