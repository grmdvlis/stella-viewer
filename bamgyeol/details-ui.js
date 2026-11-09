import {KIND,raLabel,distanceLabel,outlineStars} from './sky-details.js?v=0.6.4';

export function objectInfo(o){
  const angle=n=>Number.isFinite(n)?n.toFixed(2)+'°':'자료 없음';
  const row=(label,value)=>`<div><dt>${label}</dt><dd>${value}</dd></div>`;
  return `<h2>${o.name} <small>${o.en||''}</small></h2><p>${KIND[o.kind]}${o.kind==='planet'?' · 관측 시각 기준':' · 카탈로그 좌표 (J2000)'}</p>
    <dl class="sky-facts">${row('적경',raLabel(o.ra))}${row('적위',angle(o.dec))}${row('방위각',angle(o.az))}${row('고도',angle(o.alt))}${row('거리',distanceLabel(o))}${row('겉보기 밝기',Number.isFinite(o.mag)?o.mag.toFixed(2)+' 등급':'가시광 등급 미제공')}</dl>
    <p>적경과 적위는 하늘의 경도와 위도에 해당해요. 밝기 등급은 숫자가 작을수록 밝아요.${o.kind==='blackHole'?' 기호는 블랙홀의 위치를 나타내며, 눈으로 볼 수 있다는 뜻은 아니에요.':''}</p>`;
}

// Symbolic illustrations sit behind the catalog line drawing, without moving its stars.
const groups={
 '👸':'And Cas Com Vir', '🤴':'Cep Per Her Boo Aur Oph Ori Ser Sgr Gem', '🐻':'UMa UMi', '🦁':'Leo LMi', '🐂':'Tau', '🐏':'Ari', '🐟':'Psc PsA Dor Vol', '🐐':'Cap', '🦂':'Sco', '🦀':'Cnc', '⚖':'Lib', '🏺':'Aqr Crt', '🦅':'Aql Gru Phe Pav Cyg Col Crv Tuc Aps', '🐎':'Peg Equ Cen Mon', '🐬':'Del Cet', '🐺':'Lup', '🐕':'CMa CMi CVn', '🦊':'Vul', '🐇':'Lep', '🦎':'Lac Cha', '🐱':'Lyn', '⛵':'Car Pup Vel Pyx', '👑':'CrB CrA', '△':'Tri TrA', '✚':'Cru', '🎵':'Lyr', '🛡':'Sct', '➶':'Sge', '🔥':'Ara For', '⏳':'Hor', '🔬':'Mic', '🔭':'Tel', '🧭':'Cir Oct', '⚙':'Ant Ret Nor', '🎨':'Pic Scl Cae Men', '🪰':'Mus', '🦚':'Pav', '🦢':'Cyg', '🕊':'Col', '🐦':'Crv Tuc Aps', '🪶':'Phe Gru', '🦄':'Mon', '🌊':'Eri', '🗻':'Men', '📐':'Nor', '🕸':'Ret', '✂':'Cae', '🪵':'Scl', '🧵':'Com', '🐍':'Ser', '🐠':'Vol', '🐋':'Cet', '🏹':'Sgr', '🧑‍🤝‍🧑':'Gem', '🐉':'Dra Hya Hyi', '🦌':'Cam', '💧':'Sex', '⚒':'Ant', '🦖':'Ind', '🪁':'Peg',
};
const artwork=new Map(Object.entries(groups).flatMap(([mark,ids])=>ids.split(' ').map(id=>[id,mark])));
export const constellationEmoji=c=>artwork.get(c.id)||'✦';
export function constellationFigure(c,diagram){
  return `<div class="constellation-figure"><span aria-hidden="true">${artwork.get(c.id)||'✦'}</span>${diagram}</div>`;
}
export function constellationInfo(c, stars, diagram, names){
  const members=outlineStars(c,stars,names);
  return `<h2>${c.name} <small>${c.en}</small></h2>
    ${constellationFigure(c,diagram)}
    <p>별을 이은 선과 이름에서 따온 상징 그림이에요. 연결선은 별자리를 그리는 여러 방식 중 하나예요.</p>
    <h3>연결선에 있는 별 · ${members.length}개</h3>
    <div class="constellation-members">${members.map(o=>`<article><strong>${o.name}${o.en?' · '+o.en:''}</strong><small>적경 ${raLabel(o.ra)} · 적위 ${o.dec.toFixed(2)}°</small><small>거리 ${distanceLabel(o)} · 밝기 ${Number.isFinite(o.mag)?o.mag.toFixed(2)+' 등급':'자료 없음'}</small></article>`).join('')}</div>`;
}
