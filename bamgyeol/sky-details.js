export const DEEP_SKY = [
  {name:'안드로메다 은하', en:'M31', kind:'galaxy', ra:10.6847, dec:41.269, lightYears:2500000, mag:3.4},
  {name:'삼각형자리 은하', en:'M33', kind:'galaxy', ra:23.462, dec:30.660, lightYears:2700000, mag:5.7},
  {name:'소용돌이 은하', en:'M51', kind:'galaxy', ra:202.47, dec:47.195, lightYears:31000000, mag:8.4},
  {name:'플레이아데스 성단', en:'M45', kind:'cluster', ra:56.75, dec:24.117, lightYears:445, mag:1.6},
  {name:'헤르쿨레스 구상성단', en:'M13', kind:'cluster', ra:250.423, dec:36.461, lightYears:25000, mag:5.8},
  {name:'오메가 센타우리', en:'NGC 5139', kind:'cluster', ra:201.697, dec:-47.480, lightYears:17000, mag:3.7},
  {name:'오리온 대성운', en:'M42', kind:'nebula', ra:83.822, dec:-5.391, lightYears:1500, mag:4},
  {name:'게 성운', en:'M1', kind:'nebula', ra:83.633, dec:22.014, lightYears:6500, mag:8.4},
  {name:'궁수자리 A*', en:'Sagittarius A*', kind:'blackHole', ra:266.417, dec:-29.008, lightYears:26000},
  {name:'M87 중심 블랙홀', en:'M87*', kind:'blackHole', ra:187.706, dec:12.391, lightYears:55000000},
];
export const KIND = {star:'항성',planet:'태양계 천체',galaxy:'은하',cluster:'성단',nebula:'성운',blackHole:'블랙홀'};
const distances = {11767:447,32349:8.6,91262:25,69673:36.7,27989:550,24436:860,24608:42.9,37279:11.5,97649:16.7,102098:2600,80763:550,21421:65,65474:250,49669:79,30438:310,113368:25,37826:34,36850:51};
export function starDetails(s) {
  const [ra,dec]=s.geometry.coordinates;
  return {...s.named, name:s.named?.name||'HIP '+s.id, kind:'star', ra,dec, mag:s.properties.mag,lightYears:distances[s.id]};
}
export function outlineStars(c, stars, names={}) {
  const lookup=new Map(stars.map(s=>[s.geometry.coordinates.join(','),s]));
  return [...new Map(c.lines.flat().map(p=>[p.join(','),p])).values()].map(p=>{
    const s=lookup.get(p.join(','));
    return s?{...starDetails(s),...(s.named?{}:{name:names[s.id]?.name||"HIP "+s.id,en:names[s.id]?.en})}:{name:'카탈로그 이름 없음',ra:p[0],dec:p[1]};
  });
}
export const raLabel=ra=>{
  const m=Math.round(((ra%360+360)%360)*4)%1440;
  return Math.floor(m/60)+'h '+String(m%60).padStart(2,'0')+'m';
};
export function eclipticPoint(longitude, obliquity=23.4393) {
  const r=Math.PI/180, l=longitude*r, e=obliquity*r;
  return [Math.atan2(Math.sin(l)*Math.cos(e),Math.cos(l))/r,Math.asin(Math.sin(l)*Math.sin(e))/r];
}
export function distanceLabel(o) {
  if(Number.isFinite(o.au))return '약 '+(o.au<.01?Math.round(o.au*149597870).toLocaleString('ko-KR')+' km':o.au.toFixed(3)+' AU');
  return Number.isFinite(o.lightYears)?'약 '+o.lightYears.toLocaleString('ko-KR')+' 광년':'자료 없음';
}
