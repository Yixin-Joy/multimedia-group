/* Pure analytics shared by the Node-RED HTTP flow and the regression tests. */
function analyzeTraffic(rows, options = {}) {
  const step = 900000, end = +new Date(options.end), hours = Number(options.hours || 168);
  const start = end - hours * 3600000;
  const valid = rows.filter(r => Number.isFinite(r.avgSpeedKmh) && r.avgSpeedKmh >= 0 && r.avgSpeedKmh <= 200).map(r=>({...r,district:r.district==='Central and Western'?'Central & Western':r.district}));
  const selected = r => (!options.district || r.district === options.district) && (!options.road || r.roadBase === options.road) && (!options.direction || r.direction === options.direction);
  const history = valid.filter(selected);
  const bins = history.filter(r => +new Date(r.binStart) >= start && +new Date(r.binStart) < end);
  const slow = r => r.avgSpeedKmh < 20 && r.totalVolume > 0;
  const round = x => Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
  function groups(items, key) {
    const g = new Map();
    for (const r of items) {const k = key(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r);}
    return [...g].map(([name, a]) => ({name, n:a.length, speed:round(a.reduce((s,r)=>s+r.avgSpeedKmh,0)/a.length), volume:a.reduce((s,r)=>s+(Number(r.totalVolume)||0),0), slow:a.filter(slow).length, slowShare:round(100*a.filter(slow).length/a.length), detectors:new Set(a.map(r=>r.detectorId)).size}));
  }
  const local = r => new Date(+new Date(r.binStart) + 8*3600000);
  const dayType = r => [0,6].includes(local(r).getUTCDay()) ? 'Weekend' : 'Weekday';
  const period = r => {const h=local(r).getUTCHours(); return h>=7&&h<10?'AM peak (07–10)':h>=17&&h<20?'PM peak (17–20)':'Off-peak';};
  const perDetector = new Map();
  for(const r of history) {if(!perDetector.has(r.detectorId)) perDetector.set(r.detectorId,[]); perDetector.get(r.detectorId).push(r);}
  const episodes=[], relative=[],latest=[];
  for(const [id,a] of perDetector) {
    a.sort((x,y)=>+new Date(x.binStart)-+new Date(y.binStart));
    if(a.length)latest.push(a[a.length-1]);
    // Baseline precedes each observation: no future observations enter the median.
    const prior=[],sorted=[]; let run=null;
    for(const r of a) {
      const t=+new Date(r.binStart), inWindow=t>=start&&t<end;
      if(inWindow && slow(r)) {
        if(run && t-run.last===step) {run.last=t;run.buckets++;}
        else {if(run) episodes.push(run);run={detectorId:id,road:r.roadBase,district:r.district,direction:r.direction,start:t,last:t,buckets:1};}
      } else if(run) {episodes.push(run);run=null;}
      if(inWindow && prior.length>=96 && t-prior[0].t>=2*86400000) {
        const m=sorted.length>>1;
        const median=sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2;
        if(median>0) relative.push({detectorId:id,flag:r.totalVolume>0&&r.avgSpeedKmh<0.5*median});
      }
      if(r.totalVolume>0) {prior.push({t,v:r.avgSpeedKmh});let lo=0,hi=sorted.length;while(lo<hi){const m=(lo+hi)>>1;if(sorted[m]<r.avgSpeedKmh)lo=m+1;else hi=m;}sorted.splice(lo,0,r.avgSpeedKmh);}
    }
    if(run) episodes.push(run);
  }
  episodes.forEach(r=>{r.minutes=r.buckets*15;r.review=r.minutes>=360?'Review prolonged signal / sensor quality':'Observed low-speed run';r.end=r.last+step;r.start=new Date(r.start).toISOString();r.end=new Date(r.end).toISOString();delete r.last;});
  episodes.sort((a,b)=>b.minutes-a.minutes);
  const road=groups(bins,r=>`${r.roadBase || 'Unknown'} · ${r.direction || 'Unknown'}`).sort((a,b)=>b.slowShare-a.slowShare||b.n-a.n);
  const summary=groups(bins,()=> 'All selected detector-buckets')[0] || {n:0,speed:null,volume:0,slow:0,slowShare:null,detectors:0};
  const dayCounts={Weekday:new Set(bins.filter(r=>dayType(r)==='Weekday').map(r=>local(r).toISOString().slice(0,10))).size,Weekend:new Set(bins.filter(r=>dayType(r)==='Weekend').map(r=>local(r).toISOString().slice(0,10))).size};
  return {generatedAt:new Date().toISOString(),start:new Date(start).toISOString(),end:new Date(end).toISOString(),summary,dayCounts,latest,
    actualStart:bins.length?new Date(bins.reduce((m,r)=>Math.min(m,+new Date(r.binStart)),Infinity)).toISOString():null,
    trend:groups(bins,r=>new Date(r.binStart).toISOString()).sort((a,b)=>a.name.localeCompare(b.name)),
    districts:groups(bins,r=>r.district||'Unknown').sort((a,b)=>a.speed-b.speed),roads:road,
    hourly:groups(bins,r=>`${dayType(r)}|${String(local(r).getUTCHours()).padStart(2,'0')}`).sort((a,b)=>a.name.localeCompare(b.name)),
    peaks:groups(bins,r=>`${dayType(r)} · ${period(r)}`),
    heatmap:groups(bins,r=>`${r.district||'Unknown'}|${local(r).getUTCHours()}`),
    episodes:episodes.slice(0,30),episodeCount:episodes.length,
    relative:{eligible:relative.length,count:relative.filter(r=>r.flag).length,share:relative.length?round(100*relative.filter(r=>r.flag).length/relative.length):null},
    options:{districts:[...new Set(valid.map(r=>r.district).filter(Boolean))].sort(),roads:[...new Set(valid.filter(r=>!options.district||r.district===options.district).map(r=>r.roadBase).filter(Boolean))].sort(),directions:[...new Set(valid.filter(r=>(!options.district||r.district===options.district)&&(!options.road||r.roadBase===options.road)).map(r=>r.direction).filter(Boolean))].sort()}};
}
if(typeof module !== 'undefined') module.exports={analyzeTraffic};
