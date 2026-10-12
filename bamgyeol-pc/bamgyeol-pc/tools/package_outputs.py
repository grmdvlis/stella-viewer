"""Build and overwrite the two canonical PC/iPhone deliverables."""
from pathlib import Path
import subprocess
import zipfile
import shutil
from datetime import datetime

root = Path(__file__).resolve().parent.parent
subprocess.run(['node', 'build.js'], cwd=root, check=True)
out = root / 'outputs'
out.mkdir(exist_ok=True)
excluded = {'.git', 'dist', 'work', 'outputs', 'node_modules', '__pycache__'}
with zipfile.ZipFile(out / 'bamgyeol-pc.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in root.rglob('*'):
        rel = path.relative_to(root)
        if path.is_file() and not any(part in excluded for part in rel.parts):
            archive.write(path, Path('bamgyeol-pc') / rel)
with zipfile.ZipFile(out / 'bamgyeol-iphone.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in (root / 'dist').rglob('*'):
        if path.is_file():
            archive.write(path, Path('bamgyeol-iphone') / path.relative_to(root / 'dist'))
print('Updated outputs/bamgyeol-pc.zip and outputs/bamgyeol-iphone.zip')
# Keep the user-extracted upload folders current as well, retaining recoverable
# previous contents outside outputs instead of leaving stale deployment files.
for name in ['bamgyeol-pc', 'bamgyeol-iphone']:
    folder=(out/name).resolve()
    folder.relative_to(out.resolve())
    if folder.exists():
        backup=root/'work'/'outputs-archive'/datetime.now().strftime('%Y%m%d-%H%M%S')/name
        backup.resolve().relative_to(root.resolve())
        backup.parent.mkdir(parents=True,exist_ok=True)
        shutil.move(str(folder),str(backup))
    with zipfile.ZipFile(out/(name+'.zip')) as archive:
        archive.extractall(out)
