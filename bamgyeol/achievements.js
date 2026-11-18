import {collectionProgress} from './sky-model.js?v=0.7.0';

const ranks = [
  [1, '별지기 입문자'],
  [3, '별지기 초보자'],
  [7, '일개 별지기'],
  [10, '멋진 별지기'],
  [15, '숙련 별지기'],
  [20, '고수 별지기'],
  [30, '전문 별지기'],
  [50, '별지기 마스터'],
];

const conquests = [
  ['황도 12궁', '황도 정복가'],
  ['계절형', '사계절 정복가'],
  ['북극형', '북반구 정복가'],
  ['남극형', '남반구 정복가'],
];

export function stampAchievements(constellations, photos) {
  const {count} = collectionProgress(constellations, photos, '전체보기');
  const earnedRanks = ranks.filter(([threshold]) => count >= threshold).map(([, name]) => name);
  const earned = conquests.filter(([group]) => {
    const progress = collectionProgress(constellations, photos, group);
    return progress.total > 0 && progress.count === progress.total;
  }).map(([, name]) => name);
  return {rank: earnedRanks.at(-1) ?? '', ranks: earnedRanks, conquests: earned};
}

const startKey = 'bamgyeol-observation-start';
const dayMs = 86_400_000;
const localDay = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

export function observationDays(storage, photos = [], now = new Date()) {
  let start = now.getTime();
  try {
    const stored = Number(storage.getItem(startKey));
    if (stored > 0 && stored <= start) start = stored;
  } catch {}
  for (const photo of photos) {
    const date = Date.parse(photo.date);
    if (Number.isFinite(date) && date < start) start = date;
  }
  try { storage.setItem(startKey, String(start)); } catch {}
  return 1 + (localDay(now) - localDay(new Date(start))) / dayMs;
}
