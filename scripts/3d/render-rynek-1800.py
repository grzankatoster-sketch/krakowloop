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
scene.view_settings.exposure = -0.6


def material(name, rgb, rough=0.85):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


PLASTER = material("plaster", (0.78, 0.70, 0.58))
ROOF = material("roof tiles", (0.42, 0.17, 0.10))
BRICK = material("gothic brick", (0.55, 0.26, 0.16))
STONE = material("stone", (0.70, 0.66, 0.58))
COBBLE = material("square", (0.38, 0.35, 0.31), 0.95)
COPPER = material("copper", (0.25, 0.42, 0.36), 0.6)

# today's buildings
bpy.ops.import_scene.gltf(filepath=GLB)
for ob in bpy.context.selected_objects:
    if ob.type == "MESH":
        for slot in ob.material_slots:
            if slot.material and "roof" in slot.material.name.lower():
                slot.material = ROOF
            elif slot.material:
                slot.material = PLASTER
        # the importer's two primitives come as one mesh with two materials (walls, roofs)
        if len(ob.material_slots) == 2:
            ob.material_slots[0].material = PLASTER
            ob.material_slots[1].material = ROOF

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

# the arcaded loggia on the eastern corner, facing the Cloth Hall: a low arcade of piers
for i in range(4):
    p = local(L2 + 2.2, -W2 + 1.2 + i * 2.6, 2.4)
    bpy.ops.mesh.primitive_cube_add(size=1, location=p, scale=(0.7, 0.7, 4.8))
    put(bpy.context.object).data.materials.append(STONE)
bpy.ops.mesh.primitive_cube_add(size=1, location=local(L2 + 2.2, -W2 + 5.1, 5.2), scale=(3.2, 9.0, 0.8))
put(bpy.context.object).data.materials.append(STONE)

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
sun.data.energy = 2.6
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
else:
    cam.location = Vector((95, 70, 68))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 35

for name, show in ((f"rynek-1800-{VIEW}", True), (f"rynek-dzis-{VIEW}", False)):
    hall.hide_render = not show
    scene.render.filepath = f"{OUT}/{name}.png"
    bpy.ops.render.render(write_still=True)
    print("wrote", scene.render.filepath)
