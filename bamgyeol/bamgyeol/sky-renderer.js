import { horizontal, project } from './astro.js?v=0.5.1';
import { AIM_RADIUS, MOBILE_FOV, DESKTOP_FOV, HORIZON_WIDTH, shouldDisplayStar, closestTarget } from './sky-model.js?v=0.5.1';
import { createPlanetCache, SOLAR_SYSTEM, planetDisplaySize } from './planets.js?v=0.5.1';

export function createSkyRenderer(ctx) {
  const getPlanets = createPlanetCache();
  const images = new Map(SOLAR_SYSTEM.map(p => {
    const image = new Image();
    image.src = `assets/planets/${p.body.toLowerCase()}.svg`;
    return [p.body, image];
  }));
  let horizonKey = '', coordinates = new Map();

  return ({ width, height, az, alt, lat, lon, time, stars, constellations, mobile, faint, cameraBasis=null }) => {
    const fov = mobile ? MOBILE_FOV : DESKTOP_FOV;
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
      if (s.named) targets.push({ ...s.named, ...p, kind: 'star' });
    }

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
    if (active) {
      ctx.strokeStyle = '#bce8d6a0'; ctx.lineWidth = 1;
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

    const planets = getPlanets(time, lat, lon).flatMap(planet => {
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
