import {readFile,writeFile,rename} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=new URL('../dist/app.html',import.meta.url);
const notices=(await readFile(new URL('../LICENSE',import.meta.url),'utf8'))+'\n\n'+(await readFile(new URL('../docs/THIRD_PARTY_NOTICES.md',import.meta.url),'utf8'));
const html=(await readFile(source,'utf8'))+'\n<script type="application/json" id="third-party-notices">'+JSON.stringify(notices).replace(/</g,'\\u003c')+'</script>\n';
if (/<script\b[^>]*\bsrc\s*=/i.test(html) || /<link\b[^>]*rel=["']stylesheet["']/i.test(html))
  throw new Error('Offline HTML still references external JavaScript or CSS.');
if(!html.includes('data:application/zip;base64,'))throw new Error('Python download is not embedded.');
await rename(source,new URL('../dist/index.html',import.meta.url));
await writeFile(new URL('../dist/index.html',import.meta.url),html);
await writeFile(new URL('../index.html',import.meta.url),html);
console.log('Standalone course ready: '+fileURLToPath(new URL('../index.html',import.meta.url)));
