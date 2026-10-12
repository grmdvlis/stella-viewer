export const MOBILE_FOV = 60;
export const DESKTOP_FOV = 70;
export const AIM_RADIUS = 43;
export const HORIZON_WIDTH = 2;

// HIP identifiers come from d3-celestial's starnames catalog. Positions and
// magnitudes always come from the same star catalog used by the sky renderer.
export const NAMED_STARS = [
  { id: 11767, name: '북극성', en: 'Polaris' },
  { id: 32349, name: '시리우스', en: 'Sirius' },
  { id: 91262, name: '베가', en: 'Vega' },
  { id: 69673, name: '아르크투루스', en: 'Arcturus' },
  { id: 27989, name: '베텔게우스', en: 'Betelgeuse' },
  { id: 24436, name: '리겔', en: 'Rigel' },
  { id: 24608, name: '카펠라', en: 'Capella' },
  { id: 37279, name: '프로키온', en: 'Procyon' },
  { id: 97649, name: '알타이르', en: 'Altair' },
  { id: 102098, name: '데네브', en: 'Deneb' },
  { id: 80763, name: '안타레스', en: 'Antares' },
  { id: 21421, name: '알데바란', en: 'Aldebaran' },
  { id: 65474, name: '스피카', en: 'Spica' },
  { id: 49669, name: '레굴루스', en: 'Regulus' },
  { id: 30438, name: '카노푸스', en: 'Canopus' },
  { id: 113368, name: '포말하우트', en: 'Fomalhaut' },
  { id: 37826, name: '폴룩스', en: 'Pollux' },
  { id: 36850, name: '카스토르', en: 'Castor' },
];

export function prepareStars(stars, lineFeatures) {
  const vertices = new Set(lineFeatures.flatMap(f =>
    f.geometry.coordinates.flat().map(p => p.join(','))));
  const names = new Map(NAMED_STARS.map(s => [s.id, s]));
  return stars.map(s => ({
    ...s,
    component: vertices.has(s.geometry.coordinates.join(',')),
    named: names.get(s.id) || null,
  }));
}

export function prepareConstellations(labels, lineFeatures) {
  const zodiac = new Set('Ari Tau Gem Cnc Leo Vir Lib Sco Sgr Cap Aqr Psc'.split(' '));
  const constellations = [...new Map(labels.map(c => [c.id, {
    id: c.id, name: c.properties.ko || c.properties.en, en: c.properties.en,
    ra: c.geometry.coordinates[0], dec: c.geometry.coordinates[1],
    lines: lineFeatures.filter(l => l.id === c.id).flatMap(l => l.geometry.coordinates),
  }])).values()];
  const others = constellations.filter(c => !zodiac.has(c.id)).sort((a, b) => b.dec - a.dec);
  for (const c of constellations) {
    const i = others.indexOf(c);
    c.group = zodiac.has(c.id) ? '황도 12궁' : i < 24 ? '북극형' : i >= 46 ? '남극형' : '계절형';
  }
  return constellations.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

export function shouldDisplayStar(star, mobile, faint) {
  // Preserve the constellation outlines even when background stars are sparse.
  if (star.component || star.named) return true;
  const limit = mobile ? (faint ? 4.5 : 2.8) : (faint ? 6 : 4.5);
  return star.properties.mag <= limit;
}

export function collectionProgress(constellations, photos, category) {
  const selected = constellations.filter(c => category === '전체보기' || c.group === category);
  const collected = new Set(photos.map(p => p.id));
  return { selected, total: selected.length, count: selected.filter(c => collected.has(c.id)).length };
}

export function closestTarget(targets, width, height, radius = AIM_RADIUS) {
  let best = null, distance = radius;
  for (const target of targets) {
    const d = Math.hypot(target.x - width / 2, target.y - height / 2);
    if (d < distance) { best = target; distance = d; }
  }
  return best;
}
