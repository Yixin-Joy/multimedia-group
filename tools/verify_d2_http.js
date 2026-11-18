const assert=require('node:assert/strict'),fs=require('fs');
async function get(path){const r=await fetch('http://127.0.0.1:1880'+path,{signal:AbortSignal.timeout(120000)});assert.equal(r.status,200);return r;}
(async()=>{
 const results=[];
 for(const path of ['/traffic','/traffic/app.js','/traffic/style.css','/traffic/leaflet.js','/traffic/leaflet.css']){await get(path);results.push({test:path,result:'PASS'});}
 const c=await (await get('/traffic/api/catalog')).json();assert.equal(c.detectors.length,807);assert.equal(new Set(c.detectors.map(d=>d.detectorId)).size,807);results.push({test:'Real catalog contains 807 unique detectors',result:'PASS'});
 const e=await (await get('/traffic/api/analytics?mode=seed&hours=1&district=NONEXISTENT_TEST_FILTER')).json();assert.equal(e.summary.n,0);assert.equal(e.summary.speed,null);results.push({test:'Empty district is explicit null/no samples',result:'PASS'});
 const d=await (await get('/traffic/api/analytics?mode=seed&hours=6&district=Kwun%20Tong&road=Kwun%20Tong%20Road&direction=South%20East')).json();assert(d.summary.n>0);assert(d.districts.every(r=>r.name==='Kwun Tong'));assert(d.roads.every(r=>r.name==='Kwun Tong Road · South East'));results.push({test:'District / road / direction filters are applied consistently',result:'PASS',n:d.summary.n});
 const original=JSON.parse(require('child_process').execFileSync('git',['show','HEAD:node-red-data/flows.json'],{encoding:'utf8'})),current=JSON.parse(fs.readFileSync('node-red-data/flows.json','utf8'));
 for(const n of original)assert.deepEqual(current.find(x=>x.id===n.id),n);results.push({test:'All original collector and cleaning nodes unchanged',result:'PASS',nodes:original.length});
 fs.writeFileSync('docs/evidence/http_tests.json',JSON.stringify({at:new Date().toISOString(),results},null,2));console.log(results);
})().catch(e=>{console.error(e);process.exitCode=1;});
