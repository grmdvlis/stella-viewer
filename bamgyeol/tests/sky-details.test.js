import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEEP_SKY,eclipticPoint,outlineStars} from '../sky-details.js';
import {createSkyRenderer} from '../sky-renderer.js';
import {horizontal} from '../astro.js';
import {planetPositions} from '../planets.js';
import {prepareStars,prepareConstellations} from '../sky-model.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/'+name+'.json',import.meta.url),'utf8'));

test('ecliptic crosses the equator and reaches Earth axial tilt',()=>{
  assert.deepEqual(eclipticPoint(0),[0,0]);
  assert.ok(Math.abs(eclipticPoint(90)[1]-23.4393)<1e-6);
  assert.ok(Math.abs(eclipticPoint(270)[1]+23.4393)<1e-6);
});
test('every outline vertex appears once in its details list',()=>{
  const lines=read('constellations.lines').features;
  const stars=prepareStars(read('stars.6').features,lines);
  const shapes=prepareConstellations(read('constellations').features,lines);
  const names=read('outline-star-names');
  for(const c of shapes){
    const members=outlineStars(c,stars,names);
    assert.equal(members.length,new Set(c.lines.flat().map(p=>p.join(','))).size);
    assert.ok(members.every(o=>o.name && Number.isFinite(o.ra)&&Number.isFinite(o.dec)));
  }
  assert.ok(outlineStars(shapes.find(c=>c.id==='Ori'),stars,names).some(o=>o.name==='베텔게우스'));
});
test('all curated deep sky objects can be targeted at their projected position',()=>{
  globalThis.Image=class{};
  const ctx=new Proxy({createRadialGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]??(()=>{})});
  const draw=createSkyRenderer(ctx),time=new Date('2026-11-09T12:00Z'),lat=37.5,lon=127;
  for(const o of DEEP_SKY){
    const {az,alt}=horizontal(o.ra,o.dec,lat,lon,time);
    const view=draw({width:390,height:800,az,alt,lat,lon,time,stars:[],constellations:[],mobile:true});
    assert.equal(view.target?.name,o.name);
  }
  assert.ok(planetPositions(time,lat,lon).every(o=>o.au>0 && Number.isFinite(o.mag)));
});
