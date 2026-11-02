import { readdirSync,readFileSync,writeFileSync } from 'node:fs';
const examples={};
for(const file of readdirSync('python/examples').filter(f=>/^\d{2}-.+\.py$/.test(f)).sort())
  examples[file.slice(0,-3)]=readFileSync('python/examples/'+file,'utf8').replace(/\r\n/g,'\n').trim();
const output=JSON.stringify(examples,null,2)+'\n';
if(process.argv.includes('--check')) {
  if(readFileSync('src/data/examples.json','utf8')!==output)throw new Error('Example data out of date: run node scripts/sync-examples.mjs');
} else writeFileSync('src/data/examples.json',output);
console.log('Synchronized '+Object.keys(examples).length+' runnable examples.');
