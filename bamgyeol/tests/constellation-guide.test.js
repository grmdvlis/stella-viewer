import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stories,viewingGuide} from '../constellation-guide.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../data/constellations.json',import.meta.url)));
const get=id=>{const [ra,dec]=catalog.features.find(f=>f.id===id).geometry.coordinates;return {ra,dec}};
test('all official constellations have a short story',()=>{
  assert.equal(Object.keys(stories).length,88);
  for(const {id} of catalog.features)assert.ok(stories[id]);
});
test('the observing guide changes with latitude and hemisphere',()=>{
  assert.match(viewingGuide(get('Ori'),37.5665,126.978),/겨울.*남(동|서)?쪽/);
  assert.match(viewingGuide(get('Ori'),-33.9,151.2),/여름.*북(동|서)?쪽/);
  assert.match(viewingGuide(get('UMi'),37.5665,126.978),/일 년 내내.*북쪽/);
  assert.match(viewingGuide(get('Oct'),37.5665,126.978),/뜨지 않아요/);
});

