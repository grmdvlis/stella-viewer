import { horizontal, project } from './astro.js?v=0.7.0';
import { AIM_RADIUS, MOBILE_FOV, DESKTOP_FOV, HORIZON_WIDTH, shouldDisplayStar, closestTarget } from './sky-model.js?v=0.7.0';
import { createPlanetCache, SOLAR_SYSTEM, planetDisplaySize } from './planets.js?v=0.7.0';

import {DEEP_SKY,starDetails,eclipticPoint} from './sky-details.js?v=0.7.0';
import {createArtLayer} from './constellation-art.js?v=0.7.0';
import {zoomFov,constellationCenter,guideDirection,guideEndpoint} from './viewer-navigation.js?v=0.7.0';
const ecliptic=Array.from({length:181},(_,i)=>eclipticPoint(i*2));

export function createSkyRenderer(ctx) {
  const drawArt=createArtLayer();
  const getPlanets = createPlanetCache();
  const images = new Map(SOLAR_SYSTEM.map(p => {
    const image = new Image();
    image.src = `assets/planets/${p.body.toLowerCase()}.svg`;
    return [p.body, image];
  }));
  let horizonKey = '', coordinates = new Map();

  return ({ width, height, az, alt, lat, lon, time, stars, constellations, mobile, faint, deepSky=true, cameraBasis=null, artwork=true, artCatalog={},zoomLevel=0,searchTarget=null }) => {
    const fov = zoomFov(mobile ? MOBILE_FOV : DESKTOP_FOV,zoomLevel);
    const fit = mobile ? 'long' : 'short';
    const key = `${Math.floor(time.getTime() / 60000)}:${lat}:${lon}`;
    if (key !== horizonKey) { coordinates = new Map(); horizonKey = key; }
    const projected = new Map();
    const pos = point => {
      const id = point.join(',');
      if (!coordinates.has(id)) coordinates.set(id, horizontal(point[0], point[1], lat, lon, time));
      if (!projected.has(id)) {
        const h = coordinates.get(id);
        projected.set(id, project(h.az, h.alt, az, alt, width, height, fov, fit, cameraBasis));
      }
      return projected.get(id);
    };
    const inView = (p, margin = 0) => p && p.x >= -margin && p.x <= width + margin && p.y >= -margin && p.y <= height + margin;

    ctx.clearRect(0, 0, width, height);
    const background = ctx.createRadialGradient(width * .55, height * .4, 0, width * .55, height * .4, Math.max(width, height) * .8);
    background.addColorStop(0, '#0c172b');
    background.addColorStop(.65, '#080e1d');
    background.addColorStop(1, '#040811');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    // Keep the same constellation hit radius as the visible aiming circle.
    let active = null, distance = AIM_RADIUS;
    for (const c of constellations) {
      for (const line of c.lines) {
        let previous = null;
        for (const point of line) {
          const p = pos(point);
          if (p) {
            let d = Math.hypot(p.x - width / 2, p.y - height / 2);
            if (previous) {
              const vx = p.x - previous.x, vy = p.y - previous.y;
              const k = Math.max(0, Math.min(1, ((width / 2 - previous.x) * vx + (height / 2 - previous.y) * vy) / (vx * vx + vy * vy || 1)));
              d = Math.min(d, Math.hypot(previous.x + k * vx - width / 2, previous.y + k * vy - height / 2));
            }
            if (d < distance) { distance = d; active = c; }
          }
          previous = p;
        }
      }
    }
    if(active && artwork)drawArt(ctx,artCatalog[active.id],pos);

    const targets = [];
    let visibleStars = 0;
    for (const s of stars) {
      if (!shouldDisplayStar(s, mobile, faint)) continue;
      const p = pos(s.geometry.coordinates);
      if (!inView(p)) continue;
      visibleStars++;
      const magnitude = s.properties.mag;
      const radius = Math.max(.55, (mobile ? 2.25 : 2.6) - magnitude * .32);
      if (magnitude < 3) {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 5);
        glow.addColorStop(0, '#dbe9ff55');
        glow.addColorStop(1, '#dbe9ff00');
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - radius * 5, p.y - radius * 5, radius * 10, radius * 10);
      }
      ctx.fillStyle = `rgba(235,241,255,${Math.max(.22, 1 - magnitude * .1)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
      if (s.named) targets.push({ ...starDetails(s), ...p, ...coordinates.get(s.geometry.coordinates.join(',')) });
    }

    if (active) {
      ctx.strokeStyle = active.id===searchTarget?.id?'#f2d374':'#bce8d6a0'; ctx.lineWidth = 1;
      for (const line of active.lines) {
        ctx.beginPath(); let previous = null;
        for (const point of line) {
          const p = pos(point);
          if (p) { if (previous) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
          previous = p;
        }
        ctx.stroke();
      }
    }

    if(searchTarget){
      ctx.save();ctx.strokeStyle='#f2d374';ctx.lineWidth=1.6;
      for(const line of searchTarget.lines){
        ctx.beginPath();let previous=null;
        for(const point of line){const p=pos(point);if(p){if(previous&&Math.hypot(p.x-previous.x,p.y-previous.y)<Math.max(width,height)*2)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}previous=p;}
        ctx.stroke();
      }
      const center=constellationCenter(searchTarget),h=horizontal(center.ra,center.dec,lat,lon,time),p=pos([center.ra,center.dec]);
      const inside=p&&p.x>35&&p.x<width-35&&p.y>80&&p.y<height-140;
      const end=inside?p:guideEndpoint(guideDirection(h,az,alt,cameraBasis),width,height);
      ctx.strokeStyle='#ee7a80';ctx.lineWidth=1.5;ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(width/2,height/2);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);
      if(!inside){
        const a=Math.atan2(end.y-height/2,end.x-width/2);ctx.beginPath();ctx.moveTo(end.x-10*Math.cos(a-.5),end.y-10*Math.sin(a-.5));ctx.lineTo(end.x,end.y);ctx.lineTo(end.x-10*Math.cos(a+.5),end.y-10*Math.sin(a+.5));ctx.stroke();
      }
      ctx.fillStyle='#f2d374';ctx.font='12px sans-serif';ctx.textAlign='center';
      ctx.fillText(searchTarget.name+(h.alt<0?' · 지평선 아래':''),Math.max(145,Math.min(width-100,end.x)),end.y-14);ctx.restore();
    }

    // The red horizon uses the same projection/FOV as stars and planets.
    ctx.strokeStyle = '#dd5d6588'; ctx.lineWidth = HORIZON_WIDTH;
    ctx.beginPath(); let previous = null;
    for (let angle = 0; angle <= 360; angle++) {
      const p = project(angle, 0, az, alt, width, height, fov, fit, cameraBasis);
      if (p) {
        if (previous && Math.hypot(p.x - previous.x, p.y - previous.y) < Math.max(width, height)) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      }
      previous = p;
    }
    ctx.stroke();
    ctx.font = '700 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#e99699';
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].forEach((direction, i) => {
      const p = project(i * 45, 0, az, alt, width, height, fov, fit, cameraBasis);
      if (inView(p, 30)) ctx.fillText(direction, p.x, p.y + 24);
    });

    ctx.save();
    ctx.strokeStyle='#dfbf778c';ctx.lineWidth=1.3;ctx.setLineDash([5,6]);
    ctx.beginPath();
    let last=null;
    for(const point of ecliptic){
      const p=pos(point);
      if(inView(p,35)){
        if(last)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);
        last=p;
      }else last=null;
    }
    ctx.stroke();ctx.setLineDash([]);
    const solar=getPlanets(time,lat,lon);
    const sunRA=solar.find(o=>o.body==='Sun').ra*Math.PI/180;
    const solarLongitude=Math.atan2(Math.sin(sunRA)/Math.cos(23.4393*Math.PI/180),Math.cos(sunRA))*180/Math.PI;
    ctx.fillStyle='#e1c58b';ctx.font='11px sans-serif';
    for(const longitude of [solarLongitude+8,solarLongitude+188]){
      const p=pos(eclipticPoint(longitude));
      if(inView(p))ctx.fillText('황도',p.x,p.y-8);
    }
    for(const o of deepSky?DEEP_SKY:[]){
      const point=[o.ra,o.dec],p=pos(point);
      if(!inView(p))continue;
      ctx.strokeStyle='#b7a5dfb0';ctx.lineWidth=1;
      ctx.beginPath();
      if(o.kind==='galaxy')ctx.ellipse(p.x,p.y,7,3,-.5,0,Math.PI*2);
      else if(o.kind==='cluster'){ctx.setLineDash([2,2]);ctx.arc(p.x,p.y,6,0,Math.PI*2)}
      else if(o.kind==='blackHole'){
        for(let i=0;i<=40;i++){
          const a=i*.26,r=.4+i*.17;
          const x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;
          if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
        }
      }
      else ctx.rect(p.x-4,p.y-4,8,8);
      ctx.stroke();ctx.setLineDash([]);
      targets.push({...o,...p,...coordinates.get(point.join(','))});
    }
    ctx.restore();
    const planets = solar.flatMap(planet => {
      const p = project(planet.az, planet.alt, az, alt, width, height, fov, fit, cameraBasis);
      return inView(p, 40) ? [{ ...planet, ...p, kind: 'planet' }] : [];
    });
    targets.push(...planets);
    const target = closestTarget(targets, width, height);
    for (const planet of planets) {
      const focused = target?.kind === 'planet' && target.body === planet.body;
      const size = planetDisplaySize(focused);
      const image = images.get(planet.body);
      ctx.save();
      // As with the stars, the virtual sky can be explored below the horizon.
      ctx.globalAlpha = planet.alt < 0 ? .45 : 1;
      if (focused) {
        ctx.shadowColor = planet.color;
        ctx.shadowBlur = 12;
      }
      if (image.complete && image.naturalWidth) ctx.drawImage(image, planet.x - size / 2, planet.y - size / 2, size, size);
      ctx.restore();
    }
    return { active, target, fov, visibleStars, visiblePlanets: planets.length };
  };
}
