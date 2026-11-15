# Blender 导入脚本：File > Import > glTF 导入 blocktower_3d.glb 后，本脚本设置帧率/帧范围/渲染比例并加载混合音轨
# 用法：Blender → Scripting → 打开本文件 → Run Script（与 blocktower_3d.glb、timeline3d.json 放同一目录）
import bpy, json, os
base = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.path.dirname(os.path.abspath(__file__))
tl = json.load(open(os.path.join(base, 'timeline3d.json'), encoding='utf-8'))
glb = os.path.join(base, 'blocktower_3d.glb')
if os.path.exists(glb) and not any(o.name.startswith('Stump') for o in bpy.data.objects):
    bpy.ops.import_scene.gltf(filepath=glb)
sc = bpy.context.scene
sc.render.fps = int(round(tl['fps']))
sc.frame_start = 0
sc.frame_end = int(round(tl['duration'] * tl['fps']))
sc.render.resolution_x = tl['width']; sc.render.resolution_y = tl['height']; sc.render.resolution_percentage = 100
cam = next((o for o in bpy.data.objects if o.type == 'CAMERA'), None)
if cam: sc.camera = cam
wav = os.path.join(base, 'audio', 'mix.wav')
if os.path.exists(wav):
    if not sc.sequence_editor: sc.sequence_editor_create()
    sc.sequence_editor.sequences.new_sound('mix', wav, 1, 0)
print('Block Tower 导入完成：', tl['stats'])
