// Adds only the D2 tab. Existing collector/cleaning nodes remain unchanged.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'), fp=path.join(root,'node-red-data/flows.json');
const original=JSON.parse(fs.readFileSync(fp,'utf8'));
const tab='d200000000000001',nodes=[{id:tab,type:'tab',label:'D2 Traffic Dashboard',disabled:false,info:'Read-only dashboard: /traffic. No writes to source or aggregate collections.'}];
let i=10;const id=()=>`d2${String(i++).padStart(14,'0')}`;
function add(type,props,wires=[]){const n={id:id(),type,z:tab,x:180+(i%5)*200,y:80+Math.floor(i/5)*80,...props,wires};nodes.push(n);return n;}
const response=add('http response',{name:'Traffic HTTP response',statusCode:'',headers:{}});
function fun(name,func,next){return add('function',{name,func,outputs:1,noerr:0,initialize:'',finalize:'',libs:[]},[[next.id]]);}
function http(url,next){return add('http in',{name:url,url,method:'get',upload:false,swaggerDoc:''},[[next.id]]);}
function db(collection,next){return add('mongodb4',{name:`Read ${collection}`,clientNode:'9000000000000001',mode:'collection',collection,operation:'aggregate',output:'toArray',maxTimeMS:'60000',handleDocId:false},[[next.id]]);}
for(const [url,file,mime] of [['/traffic','index.html','text/html'],['/traffic/','index.html','text/html'],['/traffic/app.js','app.js','application/javascript'],['/traffic/style.css','style.css','text/css'],['/traffic/leaflet.js','vendor/leaflet.js','application/javascript'],['/traffic/leaflet.css','vendor/leaflet.css','text/css']]){
 const content=fs.readFileSync(path.join(root,'dashboard',file),'utf8');
 http(url,fun(`Serve ${file}`,`msg.headers={'Content-Type':${JSON.stringify(mime+'; charset=utf-8')}};msg.payload=${JSON.stringify(content)};return msg;`,response));
}
const catalogResult=fun('Catalog response',"msg.headers={'Content-Type':'application/json','Cache-Control':'no-store'};msg.payload={generatedAt:new Date().toISOString(),detectors:msg.payload};return msg;",response);
const catalogDb=db('traffic_detector_catalog',catalogResult);
http('/traffic/api/catalog',fun('Join latest to full catalog',`msg.payload=[[{$lookup:{from:'traffic_latest',localField:'detectorId',foreignField:'detectorId',as:'latest'}},{$project:{_id:0,detectorId:1,district:1,roadEn:1,direction:1,latitude:1,longitude:1,latest:{$arrayElemAt:['$latest',0]}}}]];return msg;`,catalogDb));
const analysis=fs.readFileSync(path.join(root,'dashboard/analytics.js'),'utf8').replace(/if\(typeof module[^\n]+/,'');
const result=fun('Compute traffic metrics',analysis+`\nconst result=analyzeTraffic(msg.payload,msg.d2);result.anchorMode=msg.d2.mode;result.latestAvailable=msg.d2.latest;flow.set('d2cache',{key:msg.d2.key,at:Date.now(),result});msg.payload=result;msg.headers={'Content-Type':'application/json','Cache-Control':'no-store'};return msg;`,response);
const historyDb=db('traffic_detector_15m',result);
const historyQuery=fun('Bounded aggregate history',`const latest=msg.payload[0]?.binStart;const q=msg.req.query||{};const mode=['live','snapshot','seed'].includes(q.mode)?q.mode:'seed';const end=mode==='seed'?new Date('2026-11-16T01:15:00Z'):mode==='live'?new Date():latest?new Date(+new Date(latest)+900000):new Date();const hours=[1,6,24,168].includes(Number(q.hours))?Number(q.hours):24;msg.d2={end:end.toISOString(),hours,mode,latest:latest||null,district:String(q.district||'').slice(0,200),road:String(q.road||'').slice(0,250),direction:String(q.direction||'').slice(0,100)};msg.d2.key=JSON.stringify(msg.d2);const cached=flow.get('d2cache');if(cached&&cached.key===msg.d2.key&&Date.now()-cached.at<60000){msg.payload=cached.result;msg.headers={'Content-Type':'application/json'};node.send([null,msg]);return null;}msg.payload=[[{$match:{binStart:{$gte:new Date(+end-(hours+72)*3600000),$lt:end},avgSpeedKmh:{$gte:0,$lte:200}}},{$project:{_id:0,binStart:1,detectorId:1,district:1,roadBase:1,direction:1,avgSpeedKmh:1,totalVolume:1,avgOccupancyPct:1,latestObservedAt:1}}]];return [msg,null];`,historyDb);
historyQuery.outputs=2;historyQuery.wires=[[historyDb.id],[response.id]];
const latestDb=db('traffic_detector_15m',historyQuery);
http('/traffic/api/analytics',fun('Find latest available time',"msg.payload=[[{$sort:{binStart:-1}},{$limit:1},{$project:{_id:0,binStart:1}}]];return msg;",latestDb));
const fail=fun('Explicit failure response',"node.warn(msg.error?.message||'Traffic query failed');msg.statusCode=503;msg.headers={'Content-Type':'application/json'};msg.payload={error:'Traffic data unavailable. Check MongoDB / Node-RED logs and retry.'};return msg;",response);
add('catch',{name:'D2 query errors',scope:null,uncaught:false},[[fail.id]]);
const combined=original.filter(n=>n.id!==tab&&n.z!==tab).concat(nodes);
fs.writeFileSync(fp,JSON.stringify(combined,null,2)+'\n');
fs.writeFileSync(path.join(root,'dashboard/traffic-flow.json'),JSON.stringify(nodes,null,2)+'\n');
console.log(`Built ${nodes.length} traffic nodes; retained ${combined.length-nodes.length} original nodes.`);
