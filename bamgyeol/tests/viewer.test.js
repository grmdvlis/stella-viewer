import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { project } from '../astro.js';
import { MOBILE_FOV, prepareStars, prepareConstellations, shouldDisplayStar, collectionProgress, closestTarget } from '../sky-model.js';
import { planetPositions, createPlanetCache, planetDisplaySize } from '../planets.js';

const read = n => JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`, import.meta.url))).features;
const lines = read('constellations.lines');
const stars = prepareStars(read('stars.6'), lines);
const constellations = prepareConstellations(read('constellations'), lines);

test('세로/가로 모바일 모두 긴 화면 축 전체가 정확히 60도이다', () => {
  const portrait = project(0, MOBILE_FOV / 2, 0, 0, 393, 852, MOBILE_FOV, 'long');
  assert.ok(Math.abs(portrait.y) < 1e-8);
  const landscape = project(MOBILE_FOV / 2, 0, 0, 0, 852, 393, MOBILE_FOV, 'long');
  assert.ok(Math.abs(landscape.x - 852) < 1e-8);
  const old = project(0, MOBILE_FOV / 2, 0, 0, 393, 852);
  assert.ok(old.y > 250, '이전에는 긴 축의 훨씬 넓은 범위가 보였다');
});

test('모바일 별 밀도는 줄이되 실제 별자리 구성별과 유명한 별은 보존', () => {
  const mobile = stars.filter(s => shouldDisplayStar(s, true, false));
  const desktop = stars.filter(s => shouldDisplayStar(s, false, false));
  assert.ok(mobile.length < desktop.length);
  assert.ok(desktop.length < stars.length / 2);
  assert.equal(stars.filter(s => s.component).length, 754);
  assert.ok(stars.filter(s => s.component || s.named).every(s => mobile.includes(s)));
  assert.equal(mobile.filter(s => s.named).length, 18);
  assert.equal(stars.filter(s => shouldDisplayStar(s, false, true)).length, 5044);
  assert.ok(stars.filter(s => shouldDisplayStar(s, true, true)).length > mobile.length);
});

test('분류별 분모와 분자는 실제 선택 항목만 세고 뱀자리를 중복 계산하지 않는다', () => {
  const photos = [{id: 'Ori'}, {id: 'Tau'}, {id: 'Tau'}, {id: 'Cas'}, {id: 'invalid'}];
  const groups = {'전체보기':88, '황도 12궁':12, '계절형':22, '북극형':24, '남극형':30};
  for (const [category, expected] of Object.entries(groups)) {
    const p = collectionProgress(constellations, photos, category);
    assert.equal(p.total, expected);
    assert.equal(p.count, p.selected.filter(c => ['Ori','Tau','Cas'].includes(c.id)).length);
  }
  assert.equal(collectionProgress(constellations, photos, '전체보기').count, 3);
  assert.equal(collectionProgress(constellations, photos, '황도 12궁').count, 1);
});

test('별·행성 중 조준 원에 가장 가까운 천체 하나만 선택하고 벗어나면 해제', () => {
  const star = {kind:'star', name:'시리우스', x:205, y:400};
  const planet = {kind:'planet', name:'목성', x:220, y:400};
  assert.equal(closestTarget([planet,star],400,800), star);
  assert.equal(closestTarget([{...planet,x:244}],400,800), null);
  assert.equal(planetDisplaySize(true),72);
  assert.equal(planetDisplaySize(false),40);
});

test('태양·달·7개 행성의 위치는 날짜·관측 위치에 따라 바뀌고 좌표는 유효하다', () => {
  const a = planetPositions(new Date('2026-10-08T12:00:00Z'),37.5665,126.978);
  const b = planetPositions(new Date('2027-01-08T12:00:00Z'),37.5665,126.978);
  const c = planetPositions(new Date('2026-10-08T12:00:00Z'),-33.8688,151.2093);
  assert.equal(a.length,9);
  for (const p of [...a,...b,...c]) {
    assert.ok(Number.isFinite(p.az) && p.az >= 0 && p.az < 360);
    assert.ok(Number.isFinite(p.alt) && p.alt >= -90 && p.alt <= 90);
  }
  assert.ok(a.every((p,i) => Math.abs(p.az-b[i].az)+Math.abs(p.alt-b[i].alt)>1));
  assert.ok(a.every((p,i) => Math.abs(p.alt-c[i].alt)>1));
});

test('행성 캐시는 시각·위치 변경 시 갱신하고 폰 방향 변경에는 재계산하지 않는다', () => {
  const get = createPlanetCache(), date = new Date('2026-10-08T12:00:00Z');
  const a = get(date,37,127);
  assert.equal(get(new Date('2026-10-08T12:00:30Z'),37,127),a);
  assert.notEqual(get(date,38,127),a);
  assert.notEqual(get(new Date('2026-10-08T12:01:00Z'),37,127),a);
});
