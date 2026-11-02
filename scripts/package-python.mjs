import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
// Python's zipfile preserves the same relative paths used by lessons and tests.
const py = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
if (!existsSync(py)) throw new Error('Create the project .venv first.');
mkdirSync('public',{recursive:true});
execFileSync(py,['-c', [
  'from pathlib import Path',
  'from zipfile import ZipFile, ZIP_DEFLATED',
  'root = Path.cwd()',
  'with ZipFile(root / "public/python-course.zip", "w", ZIP_DEFLATED) as archive:',
  '    for folder in ("python", "tests/python"):',
  '        for p in sorted((root / folder).rglob("*")):',
  '            if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc": archive.write(p, p.relative_to(root))',
  '    for name in ("pytest.ini", "requirements.txt", "LICENSE"):',
  '        if (root / name).exists(): archive.write(root / name, name)',
  '    archive.write(root / "python/README.md", "README.md")',
  '    for data_name in ("traces.json", "hierarchy.json", "chaining.json", "contracts.json", "resources.json", "diagnostics.json", "reliability.json", "concurrency.json", "project.json", "foundations.json"):',
  '        archive.write(root / "src/data" / data_name, "src/data/" + data_name)',
  '    archive.write(root / "docs/PYTHON_SEMANTICS.md", "docs/PYTHON_SEMANTICS.md")',
].join('\n')],{stdio:'inherit'});
console.log('Packaged public/python-course.zip');
