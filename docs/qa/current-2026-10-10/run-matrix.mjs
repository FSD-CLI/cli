import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const value = (key) => process.argv[process.argv.indexOf(`--${key}`) + 1];
if (!process.argv.includes('--work') || !process.argv.includes('--out')) throw new Error('Required: --work <new directory> --out <new directory>');
const work = path.resolve(value('work'));
const out = path.resolve(value('out'));
for (const dir of [work, out]) {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`Refusing non-empty directory: ${dir}`);
}
if (work === root || work.startsWith(root + path.sep) || root.startsWith(work + path.sep) || work === os.homedir() || work === path.parse(work).root) throw new Error('Workspace must be outside the repository');
fs.mkdirSync(work, {recursive:true});
fs.mkdirSync(path.join(out, 'logs'), {recursive:true});
const git = (...args) => spawnSync('git', args, {cwd:root, encoding:'utf8'}).stdout.trim();
const sourceSha = git('rev-parse', 'HEAD');
const templates = (await import(pathToFileURL(path.join(root, 'bin/core/template-registry.mjs')))).listTemplates({includePlanned:false});
const managers = ['npm', 'pnpm', 'yarn', 'bun'];
const version = command => {
  const r = spawnSync(command, ['--version'], {encoding:'utf8'});
  return r.status === 0 ? r.stdout.trim() : null;
};
const manifest = {startedAt:new Date().toISOString(), sourceSha, cliVersion:JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version,
  scriptSha256:crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  platform:`${os.type()} ${os.release()} ${os.arch()}`, node:process.version, tools:Object.fromEntries(managers.map(pm=>[pm,version(pm)])),
  root, work, out, templates:templates.map(t=>({framework:t.value,repository:t.repo,ref:t.ref})),
  scope:'macOS source lifecycle, five frameworks x four package managers; fresh managed upgrades; runtime/browser/historical upgrades excluded'};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest,null,2)+'\n');
const results = [];
const record = row => { results.push(row); fs.appendFileSync(path.join(out, 'results.jsonl'), JSON.stringify({...row,sourceSha})+'\n'); console.log(`${row.status} ${row.id}`); };
async function run(id, cmd, args, cwd) {
  const startedAt = new Date().toISOString();
  const stdout = `logs/${id}.stdout.log`, stderr = `logs/${id}.stderr.log`;
  const fo = fs.openSync(path.join(out,stdout),'w'), fe = fs.openSync(path.join(out,stderr),'w');
  const child = spawn(cmd,args,{cwd,env:{...process.env,CI:'1',HUSKY:'0'},stdio:['ignore',fo,fe],windowsHide:true});
  let timedOut=false, spawnError=null;
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},900000);
  const exit = await new Promise(resolve=>{child.once('error',e=>{spawnError=e.message;resolve(null);});child.once('close',code=>resolve(code));});
  clearTimeout(timer); fs.closeSync(fo); fs.closeSync(fe);
  const row={id,command:[cmd,...args],cwd,expected:'exit 0',exit,timedOut,spawnError,startedAt,endedAt:new Date().toISOString(),stdout,stderr,status:exit===0&&!timedOut&&!spawnError?'PASS':'FAIL'};
  record(row); return row.status==='PASS';
}
const cli=path.join(root,'bin/index.mjs');
const stages=['create-install','generate-feature','generate-entity','generate-widget','generate-page','generate-auth','doctor','check','upgrade-check','upgrade-dry-run','upgrade-apply','upgrade-recheck','quality-build'];
async function combo(template, pm) {
  const id=`${template.value}-${pm}`, project=path.join(work,id);
  const plan=[['create-install',process.execPath,[cli,id,'--framework',template.value,'--package-manager',pm,'--yes','--no-start'],work],
    ...[['feature','checkout'],['entity','product'],['widget','cart-summary'],['page','account'],['feature','auth']].map(([kind,name])=>[`generate-${name==='auth'?'auth':kind}`,process.execPath,[cli,'--generate',kind,name],project]),
    ['doctor',process.execPath,[cli,'doctor'],project],['check',process.execPath,[cli,'check'],project],
    ['upgrade-check',process.execPath,[cli,'upgrade','--check'],project],['upgrade-dry-run',process.execPath,[cli,'upgrade','--dry-run'],project],
    ['upgrade-apply',process.execPath,[cli,'upgrade','--yes','--no-install','--allow-dirty'],project],
    ['upgrade-recheck',process.execPath,[cli,'upgrade','--check'],project],['quality-build',pm,['run','ci'],project]];
  let ready=!!manifest.tools[pm];
  for(const [stage,command,args,cwd] of plan) {
    if(!ready) {record({id:`${id}-${stage}`,status:'NOT TESTED',expected:'exit 0',reason:manifest.tools[pm]?'earlier stage in this combination failed':`${pm} unavailable`});continue;}
    ready=await run(`${id}-${stage}`,command,args,cwd);
  }
  if(fs.existsSync(path.join(project,'.fsd/template.json'))) {
    const provenance=JSON.parse(fs.readFileSync(path.join(project,'.fsd/template.json')));
    fs.writeFileSync(path.join(out,`${id}-template.json`),JSON.stringify(provenance,null,2)+'\n');
    record({id:`${id}-provenance`,status:provenance.resolvedCommit===template.ref?'PASS':'FAIL',expected:template.ref,observed:provenance.resolvedCommit});
  }
}
const queue=templates.flatMap(t=>managers.map(pm=>[t,pm]));
await Promise.all([0,1].map(async()=>{while(queue.length){const [template,pm]=queue.shift();await combo(template,pm);}}));
const counts=Object.fromEntries(['PASS','FAIL','NOT TESTED'].map(s=>[s,results.filter(r=>r.status===s).length]));
manifest.completedAt=new Date().toISOString();manifest.counts=counts;
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(counts));process.exitCode=counts.FAIL?1:0;
