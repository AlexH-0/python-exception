import {readFile,writeFile,mkdir,readdir,lstat,copyFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,dirname,relative,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const args=process.argv.slice(2);
if(args.length && (args.length!==2 || args[0]!=='--output'))throw new Error('Usage: npm run release:source -- --output release/name');
const target=resolve(root,args[1] || `release/exception-lab-${pkg.version}`);
const releaseRoot=join(root,'release');
if(!target.startsWith(releaseRoot+sep))throw new Error('Output must be a new directory inside release/.');
if(existsSync(target)||existsSync(target+'.zip'))throw new Error('Output exists. Choose a fresh --output; existing files are never removed.');
const selected=[];
const excludedDirs=new Set(['__pycache__','.pytest_cache','node_modules','.venv','.git']);
async function tree(folder) {
 for(const entry of await readdir(join(root,folder),{withFileTypes:true})) {
  const name=folder+'/'+entry.name;
  if(entry.isSymbolicLink())throw new Error('Symlink is not permitted: '+name);
  if(entry.isDirectory()) {if(!excludedDirs.has(entry.name))await tree(name);}
  else if(entry.isFile() && !/\.(pyc|log|tsbuildinfo)$/.test(name)) {
   if(name.includes('visual.spec.ts-snapshots/')&&!name.includes('/guided-v2/'))continue;
   if(name==='scripts/repair-local-python.ps1')continue;
   if(entry.name.startsWith('.env'))throw new Error('Environment file is not permitted: '+name);
   selected.push(name);
  }
 }
}
for(const folder of ['src','python','tests','scripts','.github','docs/images'])await tree(folder);
selected.push(...['README.md','README_START.txt','CONTRIBUTING.md','CHANGELOG.md','LICENSE','.gitignore','.gitattributes','.nvmrc','.python-version','package.json','package-lock.json','tsconfig.json','vite.config.ts','playwright.config.ts','playwright.offline.config.ts','playwright.extended.config.ts','pytest.ini','requirements.txt','app.html','index.html','Start-Course.ps1','Start-Course.cmd','public/python-course.zip','docs/THIRD_PARTY_NOTICES.md','docs/CURRICULUM.md','docs/INTERACTION_MATRIX.md','docs/PYTHON_SEMANTICS.md','docs/QA_RELEASE.md','docs/RELEASE_GUIDE.md']);
const privatePath=/[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]|\/(?:home|Users)\/[^\s/]+\//;
const credentials=/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bsk-[A-Za-z0-9]{32,}\b/;
const files=[];
for(const name of [...new Set(selected)].sort()) {
 const source=join(root,name);if(!(await lstat(source)).isFile())throw new Error('Not a regular file: '+name);
 const bytes=await readFile(source);
 if(!/\.(?:png|jpg|woff2|zip)$/.test(name)) {
  const text=bytes.toString('utf8');
  if(privatePath.test(text)||credentials.test(text))throw new Error('Review private data in '+name);
 }
 files.push({path:name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
// Validate before creating output so an audit failure leaves no partial delivery.
await mkdir(target,{recursive:true});
for(const file of files) {await mkdir(dirname(join(target,file.path)),{recursive:true});await copyFile(join(root,file.path),join(target,file.path));}
let sourceCommit=null, sourceTreeDirty=null;try {
 if(resolve(execFileSync('git',['rev-parse','--show-toplevel'],{cwd:root,encoding:'utf8'}).trim())===resolve(root)) {
  sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  sourceTreeDirty=Boolean(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim());
 }
}catch{}
await writeFile(join(target,'RELEASE_MANIFEST.json'),JSON.stringify({version:pkg.version,sourceCommit,sourceTreeDirty,files},null,2)+'\n');
const python=join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
execFileSync(python,['-c',`from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import sys
folder=Path(sys.argv[1])
with ZipFile(str(folder)+'.zip','w',ZIP_DEFLATED) as z:
    for path in sorted(folder.rglob('*')):
        if path.is_file(): z.write(path,Path(folder.name)/path.relative_to(folder))`,target],{stdio:'inherit'});
const checksum=createHash('sha256').update(await readFile(target+'.zip')).digest('hex');
await writeFile(target+'.zip.sha256',checksum+'  '+relative(dirname(target),target)+'.zip\n');
console.log(`Prepared ${files.length} source files: ${relative(root,target)}\nZIP SHA-256: ${checksum}`);
