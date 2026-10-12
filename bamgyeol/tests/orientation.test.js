import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPose} from '../astro.js';
import {OrientationFilter,ViewHint,quaternion,basisFromQuaternion,rotationDistance} from '../orientation.js';
import {formatViewTime,cityName,lookupCity} from '../viewer-ui.js';
import fs from 'node:fs';
const sample=(beta,heading=90,alpha=0)=>({alpha,beta,gamma:0,heading});
test('quaternion round-trip retains the camera frame across both poles',()=>{
  for(const beta of [-180,-1,0,1,45,90,135,179,180,181]){
    const basis=cameraPose(33,beta,17,42,90).basis;
    const result=basisFromQuaternion(quaternion(basis));
    for(const key of Object.keys(basis))basis[key].forEach((v,i)=>assert.ok(Math.abs(v-result[key][i])<1e-10));
  }
});
test('iOS heading flip above 45 degrees does not flip camera bearing',()=>{
  const f=new OrientationFilter();f.ingest(sample(90),0);
  for(let t=16;t<=1600;t+=16){f.ingest(sample(90+Math.min(50,t/16),t>720?270:90),t);const pose=f.tick(t);assert.ok(Math.abs(pose.az-90)<1e-6)}
  assert.ok(f.tick(1616).alt>45);
});
test('horizon jitter is reduced while deliberate movement converges',()=>{
  const f=new OrientationFilter();f.ingest(sample(90),0);let peak=0;
  for(let t=16;t<2000;t+=16){f.ingest(sample(90,90,t%32?1.5:-1.5),t);const p=f.tick(t);if(t>500)peak=Math.max(peak,Math.abs(p.az-90))}
  assert.ok(peak<.3,`filtered peak ${peak}`);
  for(let t=2000;t<4000;t+=16){f.ingest(sample(90,90,-60),t);f.tick(t)}
  assert.ok(Math.abs(f.tick(4000).az-150)<.1);
});
test('single-frame large orientation spike is ignored; sustained movement passes',()=>{
  const f=new OrientationFilter();f.ingest(sample(90),0);f.tick(0);
  assert.equal(f.ingest(sample(90,90,180),16),false);assert.ok(Math.abs(f.tick(16).az-90)<.01);
  f.ingest(sample(90),32);f.ingest(sample(90,90,180),48);f.ingest(sample(90,90,180),64);assert.equal(f.ingest(sample(90,90,180),80),true);
});
test('hint appears after 3 seconds below 2 degrees and fades at 10 degrees',()=>{
  const hint=new ViewHint(),q=a=>quaternion(cameraPose(a,90,0).basis);
  assert.equal(hint.observe(q(0),0).hidden,true);
  assert.equal(hint.observe(q(0),2999).hidden,true);
  assert.equal(hint.observe(q(0),3000).hidden,false);
  assert.equal(hint.observe(q(9),3010).hidden,false);
  assert.equal(hint.observe(q(11),3020).hidden,true);
  assert.equal(hint.observe(q(11),6019).hidden,true);
  assert.equal(hint.observe(q(11),6020).hidden,false);
  hint.reset();assert.deepEqual(hint.observe(q(100),7000),{hidden:true,instant:false});
});
test('hint counts back-and-forth travel instead of endpoint displacement',()=>{
  const hint=new ViewHint(),q=a=>quaternion(cameraPose(a,90,0).basis);
  hint.observe(q(0),0);hint.observe(q(0),3000);
  assert.equal(hint.observe(q(6),3010).hidden,false);
  assert.equal(hint.observe(q(0),3020).hidden,true);
});
test('compact Korean timestamp and city names',()=>{
  const date=new Date(2026,9,12,13,5);assert.equal(formatViewTime(date),'10. 12. 오후 01:05');assert.equal(formatViewTime(date,true),'10. 12. 오후 01:05');
  assert.equal(cityName({city:'서울특별시'}),'서울');assert.equal(cityName({city:'광명시'}),'광명');assert.equal(cityName({city:'가평군'}),'가평');
});
test('offline city boundaries distinguish Seoul, Gwangmyeong and Gapyeong',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../data/korea-cities.json',import.meta.url)));
  for(const [lat,lon,expected] of [[37.5665,126.978,'서울'],[37.4785,126.8643,'광명'],[37.8315,127.5095,'가평'],[33.4996,126.5312,'제주'],[0,0,'도시명 확인 불가']])assert.equal(lookupCity(lat,lon,data),expected);
});
