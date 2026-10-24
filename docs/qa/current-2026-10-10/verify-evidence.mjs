import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sha='fcde52a0b801a6d57b4d5914596dde72bf490ae9';
let links=0;
for(const name of fs.readdirSync(here).filter(n=>n.endsWith('.md'))) {
  const text=fs.readFileSync(path.join(here,name),'utf8');
  assert(!/__LIFECYCLE_COUNTS__|__COMBINATION_TABLE__/.test(text),`${name}: unfinished report`);
  for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    if(/^[a-z]+:/i.test(match[1])||match[1].startsWith('#'))continue;
    const target=path.resolve(here,decodeURIComponent(match[1].split('#')[0]));
    assert(fs.existsSync(target),`${name}: missing ${match[1]}`);links++;
  }
}
for(const run of ['source-macos','lifecycle-macos']) {
  const dir=path.join(here,'evidence',run),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
  assert.equal(m.sourceSha??m.auditedCliSha,sha);
  const rows=fs.readFileSync(path.join(dir,'results.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(new Set(rows.map(r=>r.id)).size,rows.length,`${run}: duplicate IDs`);
  for(const row of rows) {
    assert(['PASS','FAIL','NOT TESTED','INFO'].includes(row.status),row.id);
    if(row.stdout) {
      assert(fs.existsSync(path.join(dir,row.stdout)),row.id);
      assert(fs.existsSync(path.join(dir,row.stderr)),row.id);
      if(row.status==='PASS')assert.equal(row.exit,Number(row.expected.match(/^exit (\d+)$/)?.[1]),row.id);
    }
  }
  if(run==='lifecycle-macos') {
    assert(m.completedAt,'lifecycle is incomplete');
    assert.equal(m.scriptSha256,hash(path.join(here,'run-matrix.mjs')));
    for(const t of m.templates)for(const pm of ['npm','pnpm','yarn','bun']) {
      const prefix=`${t.framework}-${pm}-`,commandRows=rows.filter(r=>r.id.startsWith(prefix)&&!r.id.endsWith('-provenance'));
      assert.equal(commandRows.length,13,`${prefix}: missing planned stages`);
    }
    for(const status of ['PASS','FAIL','NOT TESTED'])assert.equal(m.counts[status],rows.filter(r=>r.status===status).length);
  }
}
const ci=JSON.parse(fs.readFileSync(path.join(here,'evidence/ci/manifest.json')));
assert.equal(ci.sourceSha,sha);assert.equal(ci.jobs.length,22);
for(const j of ci.jobs) {assert.equal(j.conclusion,'success');assert(j.checkoutShaFound);assert.equal(j.sha256,hash(path.join(here,'evidence/ci',j.log)));}
const published=JSON.parse(fs.readFileSync(path.join(here,'evidence/npm-published/manifest.json')));
for(const r of published.results) {assert.equal(r.result.status,'PASS');assert.equal(r.result.version,'2.6.1');assert.equal(r.result.gitHead,'4c83d0a75ec20117edc8880aba065bdb21edfa6d');for(const f of r.files)assert.equal(f.sha256,hash(path.join(here,'evidence/npm-published',f.path)));}
const triage=JSON.parse(fs.readFileSync(path.join(here,'evidence/sveltekit-yarn-triage/manifest.json')));
assert.equal(triage.sourceSha,sha);assert.deepEqual(triage.rows.map(r=>r.exit),[1,0,0]);
assert.equal(triage.packageJsonBefore,triage.packageJsonAfter);assert.equal(triage.rows[0].configBefore,false);assert.equal(triage.rows[1].configAfter,true);
const candidate=JSON.parse(fs.readFileSync(path.join(here,'evidence/sveltekit-yarn-candidate-fix/manifest.json')));
assert.equal(candidate.exit,0);assert.equal(candidate.configBefore,false);assert.equal(candidate.configAfter,true);assert.equal(candidate.originalPackageRestored,true);
assert.equal(candidate.packageJsonOriginalSha256,triage.packageJsonBefore);assert.equal(candidate.node,'v24.13.0');
for(const r of triage.rows)for(const key of ['stdout','stderr'])assert(fs.existsSync(path.join(here,'evidence/sveltekit-yarn-triage',r[key])));
for(const key of ['stdout','stderr','patch'])assert(fs.existsSync(path.join(here,'evidence/sveltekit-yarn-candidate-fix',candidate[key])));
console.log(`Evidence verified: ${links} relative links; distinct source/artifact identities; 22 CI logs; 20 planned lifecycle combinations.`);
