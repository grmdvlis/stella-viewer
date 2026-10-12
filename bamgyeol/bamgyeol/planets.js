import { Equator, Horizon, Observer } from './vendor/astronomy.js?v=0.5.1';

export const PLANETS = [
  { body: 'Mercury', name: '수성', en: 'Mercury', color: '#aaa9a5' },
  { body: 'Venus', name: '금성', en: 'Venus', color: '#edd6a6' },
  { body: 'Mars', name: '화성', en: 'Mars', color: '#dc896a' },
  { body: 'Jupiter', name: '목성', en: 'Jupiter', color: '#d9b99c' },
  { body: 'Saturn', name: '토성', en: 'Saturn', color: '#d3c6a1' },
  { body: 'Uranus', name: '천왕성', en: 'Uranus', color: '#99dce1' },
  { body: 'Neptune', name: '해왕성', en: 'Neptune', color: '#688ad9' },
];

export const SOLAR_SYSTEM = [
  { body:'Sun', name:'태양', en:'Sun', color:'#ffcf62' },
  { body:'Moon', name:'달', en:'Moon', color:'#d7e0e7' },
  ...PLANETS,
];

// Equator(ofdate=true) and Horizon use the same equatorial reference frame.
// Positions include observer parallax, light travel time, and aberration.
export function planetPositions(date, latitude, longitude) {
  const observer = new Observer(latitude, longitude, 0);
  return SOLAR_SYSTEM.map(planet => {
    const equ = Equator(planet.body, date, observer, true, true);
    const hor = Horizon(date, observer, equ.ra, equ.dec);
    return { ...planet, az: hor.azimuth, alt: hor.altitude };
  });
}

export function planetDisplaySize(focused) { return focused ? 72 : 40; }

// Cached by minute as well as location: moving the phone needs only projection,
// and changing the custom date/location invalidates the ephemeris immediately.
export function createPlanetCache() {
  let key = '', positions = [];
  return (date, latitude, longitude) => {
    const next = `${Math.floor(date.getTime() / 60000)}:${latitude}:${longitude}`;
    if (next !== key) {
      positions = planetPositions(date, latitude, longitude);
      key = next;
    }
    return positions;
  };
}
