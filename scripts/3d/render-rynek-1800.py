"""
The Main Square around 1800, before the Town Hall was pulled down (1820): a massing
reconstruction on today's buildings, rendered in Blender. Two frames from the same camera: with the
Town Hall ("then") and without it ("today"), for the Time Lens comparison.

Run (no window):
  "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P scripts/3d/render-rynek-1800.py -- <out dir> [samples]

What is known and used (sources in the app's credits):
  - Town Hall: stone and brick, rectangle 30 x 10 m, perpendicular to the Cloth Hall, in the
    south-western part of the square; the tower adjoined it on the south-east; three storeys;
    stepped, blind-arched gables with pinnacles; octagonal turrets on the western corners; an arcaded
    loggia on the eastern corner. Demolished 1820 (the tower stayed). pl.wikipedia.org/wiki/Ratusz_w_Krakowie,
    medievalheritage.eu (after M. Kowalski and P. Opaliński, Historical Museum of Kraków);
    position after the city plan by Dominik Pucek, 1787.
  - Everything else: GUGiK LoD2 3D buildings, 2017 (CC BY 4.0) = today's massing.
What is NOT known and is only suggested: exact heights, the gables' exact drawing, window rhythm,
colours. The picture is labelled in the app as a reconstruction, not a view.
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
WINDOW = material("window", (0.03, 0.03, 0.04), 0.3)

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
# axes measured on the GUGiK outlines: the Cloth Hall runs 62.8° from east, so the Town Hall
# (perpendicular to it) runs -27.2°; the tower's centre is at (-45.6, -19.1)
A = math.radians(-27.2)
U = Vector((math.cos(A), math.sin(A), 0))  # along the hall, towards the east end
V = Vector((-math.sin(A), math.cos(A), 0))  # across the hall, towards the north
TOWER = Vector((-45.6, -19.1, 0))
# the hall stands north-west of the tower, a small courtyard between them
CENTRE = TOWER - U * 22 + V * 12
LENGTH, WIDTH, WALL = 30.0, 10.0, 14.0  # three storeys
RIDGE = WALL + 9.0

hall = bpy.data.collections.new("Town Hall 1800")
scene.collection.children.link(hall)


def put(ob):
    for c in ob.users_collection:
        c.objects.unlink(ob)
    hall.objects.link(ob)
    return ob


def local(u, v, z):
    return CENTRE + U * u + V * v + Vector((0, 0, z))


def mesh(name, verts, faces, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(p) for p in verts], [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    scene.collection.objects.link(ob)
    return put(ob)


# walls: a box
L2, W2 = LENGTH / 2, WIDTH / 2
box = [local(u, v, z) for z in (0, WALL) for (u, v) in ((-L2, -W2), (L2, -W2), (L2, W2), (-L2, W2))]
mesh("hall walls", box, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], BRICK)

# windows: three storeys of eight on each long wall
for side in (-W2 - 0.04, W2 + 0.04):
    for storey in range(3):
        for bay in range(8):
            u = -L2 + 2.4 + bay * (LENGTH - 4.8) / 7
            z = 1.8 + storey * 4.3
            q = [local(u - 0.6, side, z), local(u + 0.6, side, z), local(u + 0.6, side, z + 2.3), local(u - 0.6, side, z + 2.3)]
            mesh(f"window {side:+.0f} {storey} {bay}", q, [(0, 1, 2, 3)], WINDOW)
# the gables' blind arcades: tall dark niches on the upper storey of each end
for end in (-L2 - 0.66, L2 + 0.66):
    for i in range(3):
        v = -W2 + 2.5 + i * 2.5
        q = [local(end, v - 0.45, WALL + 0.6), local(end, v + 0.45, WALL + 0.6), local(end, v + 0.45, WALL + 5.5 - abs(i - 1) * 1.5), local(end, v - 0.45, WALL + 5.5 - abs(i - 1) * 1.5)]
        mesh(f"blind arch {end:+.0f} {i}", q, [(0, 1, 2, 3)], WINDOW)

# roof: a steep gable roof along the hall
roof = [local(-L2, -W2, WALL), local(L2, -W2, WALL), local(L2, 0, RIDGE), local(-L2, 0, RIDGE), local(L2, W2, WALL), local(-L2, W2, WALL)]
mesh("hall roof", roof, [(0, 1, 2, 3), (3, 2, 4, 5)], ROOF)

# stepped gables at both ends, a little proud of the roof: five steps each side
for end in (-L2 - 0.05, L2 + 0.05):
    steps = 5
    for i in range(steps):
        v0 = -W2 + i * (W2 / steps)
        v1 = W2 - i * (W2 / steps)
        z0 = WALL + (RIDGE + 2.5 - WALL) * i / steps
        z1 = WALL + (RIDGE + 2.5 - WALL) * (i + 1) / steps
        g = [local(end, v0, z0), local(end, v1, z0), local(end, v1, z1), local(end, v0, z1)]
        g2 = [p + U * (0.6 if end > 0 else -0.6) for p in g]
        mesh(f"gable step {i}", g + g2, [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], BRICK)
        # a pinnacle on each step's corners
        for v in (v0, v1):
            bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.35, depth=2.2, location=local(end, v, z1 + 1.1))
            put(bpy.context.object).data.materials.append(STONE)

# octagonal turrets on the western corners
for v in (-W2, W2):
    base = local(-L2, v, 0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=1.9, depth=WALL + 5, location=base + Vector((0, 0, (WALL + 5) / 2)))
    put(bpy.context.object).data.materials.append(STONE)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=2.3, depth=6, location=base + Vector((0, 0, WALL + 5 + 3)))
    put(bpy.context.object).data.materials.append(COPPER)

# the arcaded loggia on the eastern corner, facing the Cloth Hall: three arches on four piers under
# a small tiled lean-to roof
LOG_U = L2 + 2.4
for i in range(4):
    bpy.ops.mesh.primitive_cube_add(size=1, location=local(LOG_U, -W2 + 1.0 + i * 2.7, 1.9), scale=(0.55, 0.55, 3.8))
    put(bpy.context.object).data.materials.append(STONE)
for i in range(3):
    # a round arch over each opening: a band of stone along a half circle, spring points on the piers
    mid_v, spring, r_in, r_out, depth, n = -W2 + 2.35 + i * 2.7, 3.8, 1.1, 1.45, 0.28, 16
    verts, faces = [], []
    for k in range(n + 1):
        t = math.pi * k / n
        for r in (r_in, r_out):
            for du in (-depth, depth):
                verts.append(local(LOG_U + du, mid_v - r * math.cos(t), spring + r * math.sin(t)))
    for k in range(n):
        q = k * 4
        # inner, outer, front, back faces of this segment
        faces += [(q, q + 1, q + 5, q + 4), (q + 2, q + 3, q + 7, q + 6), (q, q + 2, q + 6, q + 4), (q + 1, q + 3, q + 7, q + 5)]
    mesh(f"loggia arch {i}", verts, faces, STONE)
bpy.ops.mesh.primitive_cube_add(size=1, location=local(LOG_U, -W2 + 5.05, 5.4), scale=(0.7, 9.0, 0.9))
put(bpy.context.object).data.materials.append(STONE)
lean = [local(L2, -W2, 8.2), local(L2, -W2 + 10.1, 8.2), local(LOG_U + 0.8, -W2 + 10.1, 5.8), local(LOG_U + 0.8, -W2, 5.8)]
mesh("loggia roof", lean, [(0, 1, 2, 3)], ROOF)

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
target = CENTRE + Vector((0, 0, 8))
if VIEW == "plan":
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 260
    cam.location = Vector((0, 0, 300))
    cam.rotation_euler = (0, 0, 0)
elif VIEW == "street":
    cam.location = CENTRE + U * 38 + V * 30 + Vector((0, 0, 1.7))
    cam.rotation_euler = ((CENTRE + Vector((0, 0, 9))) - cam.location).to_track_quat("-Z", "Y").to_euler()
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
