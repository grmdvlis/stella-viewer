"""Build one responsive PC/phone deliverable from the shared source."""
from pathlib import Path
from datetime import datetime
import subprocess
import shutil
import zipfile

root=Path(__file__).resolve().parent.parent
subprocess.run(['node','build.js'],cwd=root,check=True)
out=root/'outputs'
out.mkdir(exist_ok=True)
archive_dir=root/'work'/'outputs-archive'/datetime.now().strftime('%Y%m%d-%H%M%S-%f')
for name in ['bamgyeol-pc','bamgyeol-iphone','bamgyeol','bamgyeol-pc.zip','bamgyeol-iphone.zip','bamgyeol.zip']:
    old=(out/name).resolve()
    old.relative_to(out.resolve())
    if old.exists():
        destination=(archive_dir/name).resolve()
        destination.relative_to(root.resolve())
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.move(str(old),str(destination))
excluded={'.git','dist','work','outputs','node_modules','__pycache__'}
with zipfile.ZipFile(out/'bamgyeol.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for path in root.rglob('*'):
        rel=path.relative_to(root)
        if path.is_file() and not any(part in excluded for part in rel.parts):
            archive.write(path,Path('bamgyeol')/rel)
with zipfile.ZipFile(out/'bamgyeol.zip') as archive:
    archive.extractall(out)
print('Updated outputs/bamgyeol.zip and outputs/bamgyeol/ (PC + iPhone + Android)')
