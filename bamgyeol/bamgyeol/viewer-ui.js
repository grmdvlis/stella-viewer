export function formatViewTime(date,custom=false){
  const parts=new Intl.DateTimeFormat('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true}).formatToParts(date);
  const p=type=>parts.find(x=>x.type===type)?.value;
  return `${p('month')}. ${p('day')}. ${p('dayPeriod')} ${p('hour')}:${p('minute')}`;
}
export function cityName(data){return (data.city||'도시명 확인 불가').replace(/(특별자치시|특별시|광역시|시|군)$/,'')}
function insideRing(x,y,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [xi,yi]=ring[i],[xj,yj]=ring[j];
    if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  return inside;
}
export function lookupCity(latitude,longitude,data){
  for(const feature of data.features){
    const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
    if(!polygons.some(rings=>insideRing(longitude,latitude,rings[0])&&!rings.slice(1).some(ring=>insideRing(longitude,latitude,ring))))continue;
    const {code,name}=feature.properties;
    const metro={'11':'서울','21':'부산','22':'대구','23':'인천','24':'광주','25':'대전','26':'울산','29':'세종'}[String(code).slice(0,2)];
    return metro||cityName({city:name.replace(/시.*구$/,'시')});
  }
  return '도시명 확인 불가';
}
let cityData;
export async function currentCity(latitude,longitude){
  try{
    cityData??=fetch('data/korea-cities.json').then(r=>{if(!r.ok)throw Error('map unavailable');return r.json()});
    return lookupCity(latitude,longitude,await cityData);
  }catch{cityData=null;return '도시명 확인 불가'}
}
