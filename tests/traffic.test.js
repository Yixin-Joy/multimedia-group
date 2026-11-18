const {test}=require('node:test');const assert=require('node:assert/strict');
const {analyzeTraffic}=require('../dashboard/analytics');
const t=Date.parse('2026-11-14T00:00:00Z'),step=900000;
function row(n,speed=10,volume=1,id='A'){return {binStart:new Date(t+n*step),detectorId:id,avgSpeedKmh:speed,totalVolume:volume,district:'Test district',roadBase:'Test road',direction:'East'};}
const opts={end:new Date(t+8*step),hours:24};
test('missing buckets and zero volume break low-speed runs',()=>{const a=analyzeTraffic([row(0),row(1),row(3),row(4,0,0),row(5)],opts);assert.deepEqual(a.episodes.map(e=>e.minutes),[30,15,15]);assert.equal(a.summary.slow,4);});
test('multiple detectors never merge into one duration',()=>{const a=analyzeTraffic([row(0),row(1),row(0,10,1,'B'),row(1,10,1,'B')],opts);assert.deepEqual(a.episodes.map(e=>e.minutes),[30,30]);});
test('20 km/h is not below the strict threshold; invalid speeds excluded',()=>{const a=analyzeTraffic([row(0,20),row(1,19),row(2,-1),row(3,201),row(4,null)],opts);assert.equal(a.summary.n,2);assert.equal(a.summary.slow,1);assert.equal(a.summary.speed,19.5);});
test('empty filter yields null not fabricated zero speed',()=>{const a=analyzeTraffic([row(0)],{...opts,district:'Absent'});assert.equal(a.summary.n,0);assert.equal(a.summary.speed,null);assert.equal(a.episodes.length,0);});
test('Hong Kong Saturday boundary classifies UTC Friday 16:00 as weekend',()=>{const r={...row(0),binStart:new Date('2026-11-13T16:00:00Z')};assert.equal(analyzeTraffic([r],opts).dayCounts.Weekend,1);});
test('historical baseline excludes future low speed and requires sufficient span',()=>{const a=Array.from({length:193},(_,n)=>row(n,80));a.push(row(193,10));const result=analyzeTraffic(a,{end:new Date(t+194*step),hours:1});assert.equal(result.relative.count,1);assert.equal(result.relative.eligible,2);});
test('sampled counts are summed while network speed weights detectors equally',()=>{const a=analyzeTraffic([row(0,10,1),row(0,90,99,'B')],opts);assert.equal(a.summary.speed,50);assert.equal(a.summary.volume,100);});
test('end boundary excluded and filtered road does not leak into other statistics',()=>{const a=analyzeTraffic([row(0),{...row(1),roadBase:'Other'},row(8)],{...opts,road:'Test road'});assert.equal(a.summary.n,1);assert.equal(a.roads.length,1);});
test('generated flow has unique IDs and only read-only D2 database operations',()=>{const f=require('../node-red-data/flows.json');assert.equal(new Set(f.map(n=>n.id)).size,f.length);for(const n of f.filter(n=>n.z==='d200000000000001'&&n.type==='mongodb4'))assert.equal(n.operation,'aggregate');});
