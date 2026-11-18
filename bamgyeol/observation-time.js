import lookup from './vendor/tz-lookup.js?v=0.7.3';

export function observationZone(latitude,longitude){
  return lookup(latitude,longitude);
}

const formatters = new Map();
function localParts(date, timeZone) {
  if (!formatters.has(timeZone)) {
    formatters.set(timeZone,new Intl.DateTimeFormat('en-CA',{
      timeZone, year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23',
    }));
  }
  const parts = Object.fromEntries(formatters.get(timeZone).formatToParts(date).map(p => [p.type,p.value]));
  return `${parts.year.padStart(4,'0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function timeInputValue(date,timeZone){
  return localParts(date,timeZone).slice(0,16);
}

export function localObservationDate(input,timeZone){
  if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(input))return null;
  const wallTime=Date.parse(input+':00Z');
  if(!Number.isFinite(wallTime))return null;
  // Sample offsets around the intended date so skipped and repeated local times are handled.
  const day=86_400_000;
  const offsets=new Set([-day,0,day].map(delta=>{
    const instant=wallTime+delta;
    return Date.parse(localParts(new Date(instant),timeZone)+'Z')-instant;
  }));
  const matches=[...offsets].map(offset=>new Date(wallTime-offset))
    .filter(date=>timeInputValue(date,timeZone)===input);
  return matches.length?new Date(Math.min(...matches)):null;
}
