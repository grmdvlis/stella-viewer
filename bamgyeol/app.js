import {mountConstellationSearch,clampZoom,zoomFov} from './viewer-navigation.js?v=0.7.4';
import {constellationDiagram} from './constellation-art.js?v=0.7.4';
import {openDialogWithoutInputFocus} from './modal-focus.js?v=0.7.4';
import {horizontal,cameraPose,manualAngles,wrap} from './astro.js?v=0.7.4';
import {prepareStars,prepareConstellations,collectionProgress,shouldDisplayStar} from './sky-model.js?v=0.7.4';
import {createSkyRenderer} from './sky-renderer.js?v=0.7.4';
import {OrientationFilter,ViewHint,quaternion} from './orientation.js?v=0.7.4';
import {formatViewTime,currentCity} from './viewer-ui.js?v=0.7.4';
import {objectInfo,constellationInfo,constellationEmoji} from './details-ui.js?v=0.7.4';
import {mountWishes} from './wishes.js?v=0.7.4';
import {mountWishEntrance} from './wish-entrance.js?v=0.7.4';
import {outlineStars} from './sky-details.js?v=0.7.4';
import {DEFAULT_NICKNAME,stories,viewingGuide} from './constellation-guide.js?v=0.7.4';
import {stampAchievements,observationDays} from './achievements.js?v=0.7.4';
import {stampDirectionIssue,stampImageIssues} from './stamp-validation.js?v=0.7.4';
import {localObservationDate,observationZone,timeInputValue} from './observation-time.js?v=0.7.4';
import {mountViewerTutorial} from './viewer-tutorial.js?v=0.7.4';
import {community,identifyBrowser} from './community.js?v=0.7.4';
import {mountMore,readPreference,storePreference} from './more.js?v=0.7.4';
let redrawWishes, gpsPosition;
const brightest=new Map();
let currentTarget=null, outlineNames={}, artCatalog={};
const filter=new OrientationFilter(),viewHint=new ViewHint();
let locationCity='서울',locationSource='preview',absoluteSeen=-Infinity;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const icons=['<circle cx="12" cy="12" r="7"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>','<path d="M7 3h10v5l-2 3v4h4v5H5v-5h4v-4L7 8z"/>','<path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>','<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'];
const tabs=['viewer','stamps','wishes','more'],labels=['뷰어','도장','소원','더보기'];
$('#dock').innerHTML=tabs.map((t,i)=>`<button data-tab="${t}" aria-label="${labels[i]}"><svg viewBox="0 0 24 24">${icons[i]}</svg><span>${labels[i]}</span></button>`).join('');
let tab='viewer',mode='live',lat=37.5665,lon=126.978,az=0,alt=35,customDate=null,active=null,stars=[],constellations=[],lines=[],category='전체보기',sensor=false,stream=null,press=null,calibration=0,cameraBasis=null;
let zoomLevel=0,searchTarget=null;
let stampSession=null,customZone='Asia/Seoul';
mountConstellationSearch($('#viewer-search'),()=>constellations,c=>{searchTarget=c;hideConstellationMenu()});
const startTutorial=mountViewerTutorial($('#app'),()=>mode);
function changeZoom(step){zoomLevel=clampZoom(zoomLevel+step);$('#zoom-in').disabled=zoomLevel===2;$('#zoom-out').disabled=zoomLevel===-2;$('#zoom-level').textContent=(1.4**zoomLevel).toFixed(2).replace(/0+$/,'').replace(/\.$/,'')+'×'}
$('#zoom-in').onclick=()=>changeZoom(1);$('#zoom-out').onclick=()=>changeZoom(-1);
const canvas=$('#sky'),ctx=canvas.getContext('2d');
const drawSky=createSkyRenderer(ctx);
const mobileView=matchMedia('(max-width: 650px), (pointer: coarse)');
let W=innerWidth,H=innerHeight;
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4000)}
const wishEntrance=mountWishEntrance($('#wishes'));
function go(t){
  hideConstellationMenu();
  hideLocationDetails();
  const previous=tab;
  if(t==='viewer'&&previous!==t)viewHint.reset(performance.now());
  if(previous==='wishes'&&t!==previous)wishEntrance.close();
  tab=t;
  tabs.forEach(x=>$('#'+x).classList.toggle('hidden',x!==t));
  $$('#dock button').forEach(b=>{
    b.classList.toggle('active',b.dataset.tab===t);
    b.setAttribute('aria-current',b.dataset.tab===t?'page':'false');
  });
  document.body.classList.toggle('viewing',t==='viewer');
  if(t==='stamps')gallery();
  if(t==='wishes'){
    if(previous!==t)wishEntrance.open();
    redrawWishes?.();
  }
  if(t==='more')refreshAchievements();
}
$('#dock').onclick=e=>{const b=e.target.closest('button');if(b)go(b.dataset.tab)};go(tab);
startTutorial();
function resize(){hideConstellationMenu();W=innerWidth;H=innerHeight;canvas.width=W*devicePixelRatio;canvas.height=H*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}addEventListener('resize',resize);resize();
const groups=['전체보기','황도 12궁','계절형','북극형','남극형'];
let land=null;fetch('data/land.json').then(r=>r.json()).then(d=>{land=d;if($('#map'))drawMap()}).catch(()=>{});
let db;async function database(){if(db)return db;db=await new Promise((resolve,reject)=>{const r=indexedDB.open('bamgyeol',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return db}
async function allPhotos(){const d=await database();return new Promise((res,rej)=>{const r=d.transaction('photos').objectStore('photos').getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function savePhoto(id,blob,date,position){
  const photo={id,blob,date:date.toISOString(),backup:true,lat:position.latitude,lon:position.longitude};
  const d=await database();
  const previous=await new Promise((resolve,reject)=>{
    const tx=d.transaction('photos','readwrite');
    const photos=tx.objectStore('photos');
    const keys=photos.getAllKeys();
    photos.put(photo,id);
    tx.oncomplete=()=>resolve(keys.result.map(id=>({id})));
    tx.onabort=()=>reject(tx.error);
  });
  const before=stampAchievements(constellations,previous);
  const after=stampAchievements(constellations,[...previous,photo]);
  syncProfile();
  if(tab==='stamps')gallery();
  return [
    ...(after.rank&&after.rank!==before.rank?[after.rank]:[]),
    ...after.conquests.filter(badge=>!before.conquests.includes(badge)),
  ];
}

function badgeList(badges){
  return '<ul class="achievement-list">'+badges.map(badge=>`<li>${badge}</li>`).join('')+'</ul>';
}

async function refreshAchievements(now=new Date()){
  let photos=[];
  try{photos=await allPhotos()}catch{}
  $('#backup-legacy').hidden=!photos.some(photo=>!photo.backup)||readPreference('bamgyeol-backup-legacy','')==='yes';
  const {ranks,conquests}=stampAchievements(constellations,photos);
  const badges=[...ranks,...conquests];
  $('#achievement-badges').innerHTML=badges.length?badgeList(badges):'<p>첫 도장을 등록하면 뱃지를 받아요.</p>';
  let storage;
  try{storage=localStorage}catch{}
  $('#observation-days').textContent=`별자리 관측한 지 ${observationDays(storage,photos,now)}일째`;
}

function previewAd(title){
  popup(`<h2>${title}</h2><div class="ad-placeholder">광고 자리 (미리보기)</div><progress id="ad-progress" aria-label="광고 미리보기 진행률" max="5000" value="0"></progress>`,false);
  const progress=$('#ad-progress');
  const start=performance.now();
  return new Promise(resolve=>{
    function update(now){
      progress.value=Math.min(progress.max,Math.max(0,now-start));
      if(progress.value===progress.max)resolve();
      else requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  });
}
const imageURLs=[];async function gallery(){try{const requestedCategory=category;const photos=await allPhotos();if(requestedCategory!==category)return;const progress=collectionProgress(constellations,photos,category);$('#progress').textContent=`${progress.count} / ${progress.total}`;imageURLs.forEach(URL.revokeObjectURL);imageURLs.length=0;$('#gallery').innerHTML=progress.selected.map(c=>{const p=photos.find(p=>p.id===c.id);let img;if(p){img=URL.createObjectURL(p.blob);imageURLs.push(img)}return `<button class="card" data-id="${c.id}">${p?`<img src="${img}" alt="${c.name} 촬영 사진">`:thumbnail(c)}<div class="stamp-card-title"><h3>${c.name}</h3>${p?'<span class="badge">✓ 수집 완료</span>':''}</div><small>${c.id}</small></button>`}).join('')}catch(e){toast('사진 저장소를 열 수 없어요. 일반 브라우저 모드를 사용해주세요.')}}
function thumbnail(c){return constellationDiagram(c,artCatalog)}
$('#categories').innerHTML=groups.map(g=>`<button data-category="${g}" class="${g===category?'chosen':''}">${g}</button>`).join('')+'<button id="info" aria-label="별자리 분류 안내">ⓘ 분류 안내</button>';
$('#categories').onclick=e=>{if(e.target.id==='info'){popup('<h2>88개의 별, 네 개의 서랍</h2><p>IAU는 하늘을 88개 별자리 영역으로 나눕니다. 다음은 밤결에서 탐색하기 편하게 만든 서로 겹치지 않는 분류이며, IAU 공식 분류가 아닙니다.</p><p>황도 12궁 · 12개<br>전통적인 황도 열두 별자리입니다. 태양의 실제 경로에는 뱀주인자리도 걸쳐 있지만 여기서는 계절형에 포함합니다.</p><p>북극형 · 24개 / 남극형 · 30개<br>12궁을 제외한 별자리의 대표 중심 적위를 기준으로 북쪽 24개, 남쪽 30개를 배치했습니다. 모든 위치에서 항상 보이는 주극 별자리라는 뜻은 아닙니다.</p><p>계절형 · 22개<br>나머지 22개로, 위치와 관측 계절에 따라 찾기 좋은 별자리입니다. 실제 관측 가능성은 위도·시각에 따라 달라집니다.</p>');return}const g=e.target.dataset.category;if(g){category=g;$$('#categories button').forEach(b=>b.classList.toggle('chosen',b.dataset.category===g));gallery()}};
function popup(html,closable=true,topClose=false){$('#modal').classList.remove('wide-details');html=html.replace('<h2>','<h2 tabindex="-1" autofocus>');$('#modal-content').innerHTML=(topClose?'<div class="detail-close-row"><button id="close-modal" aria-label="닫기">×</button></div>':'')+html+(closable&&!topClose?'<button id="close-modal" style="margin-top:16px;width:100%">닫기</button>':'');if($('#modal').open){$('#modal-content h2')?.focus({preventScroll:true});$('#modal').scrollTop=0}else openDialogWithoutInputFocus($('#modal'),$('#modal-content'));if(closable)$('#close-modal').onclick=close}function stopCamera(){stampSession=null;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
function close(){stopCamera();$('#modal').close()}$('#modal').addEventListener('cancel',e=>{if($('#location-form')||$('#ad-progress'))e.preventDefault();else close()});
function locationPopup(){popup(`<h2>어디의 밤하늘을 볼까요?</h2><p>지도에서 위치를 고르거나 좌표를 직접 입력하세요.</p><canvas class="map" id="map" width="720" height="360" aria-label="세계 좌표 지도"></canvas><p class="map-note" id="map-note">지도: 경도 −180°~180°, 위도 −90°~90° · 클릭 또는 터치로 선택</p><form id="location-form"><div class="row coordinate-row"><label>위도<input id="lat" type="number" inputmode="decimal" step="any" min="-90" max="90" value="${lat}" required></label><label>경도<input id="lon" type="number" inputmode="decimal" step="any" min="-180" max="180" value="${lon}" required></label></div><div class="row location-presets"><button type="button" id="seoul">서울</button><button type="button" id="jeju">제주</button><button type="button" id="sydney">시드니</button></div><button class="primary">이 위치의 하늘 보기</button></form>`,false);drawMap();$('#map').onclick=e=>{const r=e.target.getBoundingClientRect();$('#lon').value=((e.clientX-r.left)/r.width*360-180).toFixed(4);$('#lat').value=(90-(e.clientY-r.top)/r.height*180).toFixed(4);drawMap()};['lat','lon'].forEach(x=>$('#'+x).oninput=drawMap);[['seoul',37.5665,126.978],['jeju',33.4996,126.5312],['sydney',-33.8688,151.2093]].forEach(([id,a,b])=>$('#'+id).onclick=()=>{$('#lat').value=a;$('#lon').value=b;drawMap()});$('#location-form').onsubmit=e=>{e.preventDefault();lat=Number($('#lat').value);lon=Number($('#lon').value);customZone=observationZone(lat,lon);mode='custom';sensor=false;cameraBasis=null;locationSource='custom';locationCity=knownCity(lat,lon);const a=lat,b=lon;currentCity(a,b).then(city=>{if(locationSource==='custom'&&lat===a&&lon===b&&city!=='도시명 확인 불가'){locationCity=city;document.querySelector('#location-city').textContent=city}});$('#location').textContent='지정 위치';hideLocationDetails();updateMode();close()}}
function drawMap(){const c=$('#map'),g=c.getContext('2d');g.clearRect(0,0,720,360);g.fillStyle='#132539';g.fillRect(0,0,720,360);g.strokeStyle='#ffffff18';for(let x=0;x<=720;x+=60){g.beginPath();g.moveTo(x,0);g.lineTo(x,360);g.stroke()}for(let y=0;y<=360;y+=60){g.beginPath();g.moveTo(0,y);g.lineTo(720,y);g.stroke()}g.fillStyle='#294454';if(land){for(const feature of land.features){const polys=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;for(const poly of polys){g.beginPath();for(const ring of poly){ring.forEach((p,i)=>{const x=(p[0]+180)*2,y=(90-p[1])*2;i?g.lineTo(x,y):g.moveTo(x,y)});g.closePath()}g.fill('evenodd')}}}g.fillStyle='#5e8490';g.font='16px sans-serif';g.fillText('NORTH AMERICA',65,95);g.fillText('SOUTH AMERICA',175,235);g.fillText('EUROPE',360,80);g.fillText('AFRICA',355,190);g.fillText('ASIA',510,100);g.fillText('AUSTRALIA',595,260);g.fillStyle='#c6efd9';g.beginPath();g.arc((Number($('#lon').value)+180)*2,(90-Number($('#lat').value))*2,6,0,Math.PI*2);g.fill()}
function updateMode(){$$('#mode button').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));$('#time').style.visibility=mode==='custom'?'visible':'hidden';$('#sensors').hidden=mode==='custom';$('#sensors').classList.toggle('hidden',mode==='custom');$('#time').hidden=mode!=='custom';$('.viewer-bottom').classList.toggle('custom-controls',mode==='custom');refreshLocationStatus()}$('#mode').onclick=e=>{if(e.target.dataset.mode==='custom')locationPopup();if(e.target.dataset.mode==='live'){mode='live';customDate=null;lat=37.5665;lon=126.978;locationSource='preview';locationCity='서울';refreshLocationStatus();hideLocationDetails();updateMode();enableSensors()}};updateMode();
$('#time').onclick=()=>{
  const zone=customZone;
  const local=timeInputValue(customDate||new Date(),zone);
  popup(`<h2>시간을 따라 별을 만나요</h2><p>지정 위치의 현지 시각을 입력하세요. 시간대는 ${zone}입니다.</p><form id="time-form"><label>현지 관측 날짜와 시각<input id="datetime" type="datetime-local" value="${local}" required></label><p id="time-error" role="status"></p><button class="primary">이 시각으로 이동</button><button type="button" id="now">현재 시각으로 돌아가기</button></form>`);
  $('#time-form').onsubmit=e=>{
    e.preventDefault();
    const date=localObservationDate($('#datetime').value,zone);
    if(!date){
      $('#time-error').textContent='이 시간대에 존재하지 않는 시각이에요. 다른 시간을 입력해 주세요.';
      return;
    }
    customDate=date;
    close();
  };
  $('#now').onclick=()=>{customDate=null;close()};
};
async function requestMotionPermission(){
  if(!window.DeviceOrientationEvent)throw Error('이 기기에서 동작 센서를 사용할 수 없어요.');
  if(typeof DeviceOrientationEvent.requestPermission==='function'){
    const permission=await DeviceOrientationEvent.requestPermission(true);
    if(permission!=='granted')throw Error('동작 센서 권한을 허용해 주세요.');
  }
}
async function enableSensors(){if(mode!=='live'){toast('센서 사용은 기본 모드에서 켤 수 있어요');return}try{await requestMotionPermission();if(mode!=='live')return;filter.reset();cameraBasis=null;absoluteSeen=-Infinity;lastSensor=0;sensor=true;setTimeout(()=>{if(!lastSensor&&sensor)toast('방위 센서 신호가 없어요. 화면을 드래그해 탐색하세요')},4000)}catch(e){sensor=false;toast(e.message)}if(navigator.geolocation)navigator.geolocation.getCurrentPosition(p=>{if(mode!=='live')return;lat=p.coords.latitude;lon=p.coords.longitude;locationSource='gps';gpsPosition=[lat,lon];if(tab==='wishes')redrawWishes?.();locationCity='도시명 확인 중';refreshLocationStatus();hideLocationDetails();const a=lat,b=lon;currentCity(a,b).then(city=>{if(locationSource==='gps'&&lat===a&&lon===b){locationCity=city;$('#location-city').textContent=city}})},()=>{if(mode!=='live')return;lat=37.5665;lon=126.978;locationSource='preview';locationCity='서울';refreshLocationStatus();hideLocationDetails();toast('현위치를 읽지 못해 서울 밤하늘을 보여드립니다')},{enableHighAccuracy:true,timeout:12000})}
let lastSensor=0;
function orientation(e){
  const now=performance.now();
  const absolute=e.absolute||e.type==='deviceorientationabsolute';
  const sample={alpha:e.alpha,beta:e.beta,gamma:e.gamma,absolute,heading:e.webkitCompassHeading,screenAngle:screen.orientation?.angle??window.orientation??0,calibration};
  if(stampSession){
    if(e.type==='deviceorientationabsolute')stampSession.absoluteSeen=now;
    else if(now-stampSession.absoluteSeen<1000)return;
    stampSession.filter.ingest(sample,now);
    return;
  }
  if(!sensor||mode!=='live'||$('#modal').open)return;
  if(e.type==='deviceorientationabsolute')absoluteSeen=now;
  else if(now-absoluteSeen<1000)return;
  if(filter.ingest(sample,now)){
    if(!lastSensor)toast('동작 센서 연결됨');
    lastSensor=Date.now();
  }
}
addEventListener('deviceorientationabsolute',orientation);addEventListener('deviceorientation',orientation);
$('#sensors').onclick=()=>enableSensors();
function knownCity(a,b){return [[37.5665,126.978,'서울'],[33.4996,126.5312,'제주'],[-33.8688,151.2093,'시드니']].find(([x,y])=>Math.abs(a-x)<.0001&&Math.abs(b-y)<.0001)?.[2]||'도시명 확인 불가'}
function refreshLocationStatus(){const preview=mode==='live'&&locationSource!=='gps';$('.location').classList.toggle('preview-location',preview);$('#location').textContent=preview?'미리보기 - 서울':mode==='custom'?'지정 위치':'현위치'}
function hideLocationDetails(){const box=$('#location-details');if(box)box.hidden=true;$('#location-trigger')?.setAttribute('aria-expanded','false')}
$('#location-trigger').onclick=()=>{
  const box=$('#location-details');if(!box.hidden){hideLocationDetails();return}
  $('#location-lat').textContent=`위도: ${lat.toFixed(3)}˚`;
  $('#location-lon').textContent=`경도: ${lon.toFixed(3)}˚`;
  $('#location-city').textContent=locationCity;
  $('#location-note').textContent=locationSource==='preview'?'현위치를 불러오려면 위치 권한을 켜주세요. 미리보기 화면은 서울 밤하늘을 보여줍니다.':'';
  box.hidden=false;$('#location-trigger').setAttribute('aria-expanded','true');
};
$('#location-details').onclick=hideLocationDetails;
addEventListener('keydown',e=>{if(e.key==='Escape')hideLocationDetails()});
let drag=null;canvas.onpointerdown=e=>{if(tab!=='viewer'||$('#modal').open)return;canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,az,alt,moved:false};if(active){const selected=active;press=setTimeout(()=>{if(drag&&!drag.moved){const {x,y}=drag;drag=null;constellationActions(selected,x,y)}},650)}};canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>8){drag.moved=true;clearTimeout(press);sensor=false;cameraBasis=null}az=wrap(drag.az-dx*.13);alt=drag.alt+dy*.13};canvas.onpointerup=canvas.onpointercancel=()=>{clearTimeout(press);drag=null};addEventListener('keydown',e=>{if(tab!=='viewer'||$('#modal').open||e.target.matches('input'))return;if(e.key.startsWith('Arrow')){e.preventDefault();sensor=false;cameraBasis=null;az=wrap(az+({'ArrowLeft':-4,'ArrowRight':4}[e.key]||0));alt+=({'ArrowUp':4,'ArrowDown':-4}[e.key]||0)}});
$('#gallery').onclick=e=>{const card=e.target.closest('[data-id]');if(card)capture(constellations.find(c=>c.id===card.dataset.id))};
let menuConstellation;
function hideConstellationMenu(){
  $('#constellation-menu').hidden=true;
  $('#constellation-actions').setAttribute('aria-expanded','false');
}
function constellationActions(c,x=W/2,y=H/2){
  if(!c)return;
  menuConstellation=c;
  const menu=$('#constellation-menu');
  menu.querySelector('strong').textContent=c.name;
  menu.hidden=false;
  menu.style.left=Math.max(8,Math.min(W-menu.offsetWidth-8,x+12))+'px';
  menu.style.top=Math.max(72,Math.min(H-menu.offsetHeight-12,y-menu.offsetHeight-12))+'px';
  $('#constellation-actions').setAttribute('aria-expanded','true');
}
$('#constellation-actions').setAttribute('aria-controls','constellation-menu');
$('#constellation-actions').onclick=()=>{if(!$('#constellation-menu').hidden)hideConstellationMenu();else constellationActions(active)};
$('#constellation-more').onclick=()=>{hideConstellationMenu();popup(constellationInfo(menuConstellation,stars,thumbnail(menuConstellation),outlineNames,artCatalog[menuConstellation.id]),true,true);$('#modal').classList.add('wide-details')};
$('#constellation-stamp').onclick=()=>{hideConstellationMenu();capture(menuConstellation)};
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#constellation-menu,#constellation-actions'))hideConstellationMenu()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')hideConstellationMenu()});
$('#modal').addEventListener('click',e=>{
  if(e.target!==$('#modal')||!$('#modal').classList.contains('wide-details'))return;
  const r=$('#modal').getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();
});
$('#object-info').onpointerdown=()=>{$('#object-info').targetSnapshot=currentTarget};
$('#object-info').onclick=e=>{const target=(e.detail?$('#object-info').targetSnapshot:null)||currentTarget;if(target)popup(objectInfo(target))};
function capture(c){
  if(!c)return;
  popup(`<h2>${c.name} 도장깨기</h2><p>휴대폰을 세운 상태에서 카메라를 켠 뒤, 목표 별자리의 밤하늘을 직접 촬영해 주세요. 위치·동작·카메라 권한이 필요해요. 등록한 사진은 이 기기와 개발자만 확인할 수 있는 백업에 저장돼요.</p><video id="video" autoplay playsinline muted hidden></video><button class="primary" id="camera">카메라 켜기</button><button class="primary" id="shutter" hidden>사진 촬영 · 도장 등록</button><p role="status" id="photo-status"></p>`);
  const camera=$('#camera'), shutter=$('#shutter'), video=$('#video'), status=$('#photo-status');
  const stillOpen=()=>$('#modal').open&&video.isConnected;

  function rejectPhoto(issues){
    stopCamera();
    popup('<h2>사진을 등록할 수 없어요</h2><ul class="stamp-issues">'+issues.map(issue=>`<li>${issue}</li>`).join('')+'</ul><button class="primary" id="retry-photo">다시 촬영하기</button>');
    $('#retry-photo').onclick=()=>capture(c);
  }

  camera.onclick=async()=>{
    camera.disabled=true;
    status.textContent='촬영에 필요한 권한과 현재 위치를 확인하고 있어요.';
    try {
      await requestMotionPermission();
      if(!stillOpen())return;
      stampSession={filter:new OrientationFilter(),absoluteSeen:-Infinity,position:null};
      let position;
      try {
        position=await new Promise((resolve,reject)=>{
          if(!navigator.geolocation){reject();return}
          navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),reject,{enableHighAccuracy:true,maximumAge:0,timeout:12000});
        });
      } catch {
        throw Error('현재 위치를 확인하지 못했어요. 위치 권한을 허용한 뒤 다시 시도해 주세요.');
      }
      if(!stillOpen())return;
      stampSession.position=position;
      if(!navigator.mediaDevices?.getUserMedia)throw Error('이 브라우저에서 카메라를 시작할 수 없어요.');
      let cameraStream;
      try {
        cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      } catch {
        throw Error('카메라가 연결되지 않았어요. 카메라 권한을 확인해 주세요.');
      }
      if(!stillOpen()){cameraStream.getTracks().forEach(track=>track.stop());return}
      stream=cameraStream;
      if(stream.getVideoTracks()[0]?.getSettings().facingMode==='user')throw Error('후면 카메라로 촬영해 주세요.');
      video.srcObject=stream;
      video.hidden=false;
      shutter.hidden=false;
      camera.hidden=true;
      const target=horizontal(c.ra,c.dec,position.latitude,position.longitude,new Date());
      status.textContent=`별자리 중심 방향 · 방위 ${Math.round(target.az)%360}° / 고도 ${Math.round(target.alt)}°`;
    } catch (error) {
      if(stillOpen())rejectPhoto([error.message || '촬영 권한을 확인해 주세요.']);
    }
  };

  shutter.onclick=async()=>{
    if(!video.videoWidth||video.readyState<2){
      status.textContent='카메라가 준비되면 다시 눌러 주세요.';
      return;
    }
    shutter.disabled=true;
    const date=new Date();
    const position=stampSession.position;
    const pose=stampSession.filter.latest(performance.now());
    const directionIssue=stampDirectionIssue(c,pose,position,date);
    const frame=document.createElement('canvas');
    const scale=Math.min(1,1400/Math.max(video.videoWidth,video.videoHeight));
    frame.width=Math.max(1,Math.round(video.videoWidth*scale));
    frame.height=Math.max(1,Math.round(video.videoHeight*scale));
    frame.getContext('2d').drawImage(video,0,0,frame.width,frame.height);
    const sample=document.createElement('canvas');
    sample.width=128;sample.height=128;
    const ctx=sample.getContext('2d');
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(frame,0,0,sample.width,sample.height);
    const issues=stampImageIssues(ctx.getImageData(0,0,sample.width,sample.height));
    if(directionIssue)issues.unshift(directionIssue);
    if(issues.length){rejectPhoto(issues);return}
    const blob=await new Promise(resolve=>frame.toBlob(resolve,'image/jpeg',.85));
    if(!stillOpen())return;
    if(!blob){rejectPhoto(['사진을 처리하지 못했어요. 다시 촬영해 주세요.']);return}
    stopCamera();
    await previewAd('도장 사진 저장 중…');
    try {
      const earned=await savePhoto(c.id,blob,date,position);
      if(earned.length){
        await previewAd('뱃지 제작 중…');
        popup('<h2>새 뱃지를 얻었어요!</h2>'+badgeList(earned));
      }else close();
      toast('이 별과의 만남을 도장으로 남겼어요');
    } catch {
      close();
      toast('사진을 저장하지 못했어요. 저장 공간을 확인하세요');
    }
  };
}
async function compress(blob){const bitmap=await createImageBitmap(blob),scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height));const c=document.createElement('canvas');c.width=bitmap.width*scale;c.height=bitmap.height*scale;c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);bitmap.close();return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(Error('이미지 변환 실패')),'image/jpeg',.85))}

const avatar=readPreference('avatar','');
if(avatar){$('#remove-avatar').hidden=false;const img=document.createElement('img');img.src=avatar;$('.profile-photo').prepend(img)}
$('#avatar').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const blob=await compress(file),reader=new FileReader();reader.onload=()=>{try{localStorage.setItem('avatar',reader.result);$('#remove-avatar').hidden=false;$('.profile-photo img')?.remove();const img=document.createElement('img');img.src=reader.result;$('.profile-photo').prepend(img)}catch{toast('프로필 사진 저장 공간이 부족해요')}};reader.readAsDataURL(blob)}catch{toast('이미지 파일을 확인해주세요')}};$('#export').onclick=async()=>{try{const ps=await allPhotos();if(!ps.length){toast('아직 수집한 도장이 없어요');return}popup('<h2>도장 사진 보관하기</h2><p>각 사진을 눌러 내려받으세요.</p><div id="downloads"></div>');for(const p of ps){const a=document.createElement('a'),url=URL.createObjectURL(p.blob);imageURLs.push(url);a.href=url;a.download=`${p.id}-${p.date.slice(0,10)}.jpg`;a.textContent=(constellations.find(c=>c.id===p.id)?.name||p.id)+' ↓';a.style.cssText='display:block;padding:12px;color:#b4e8d1';$('#downloads').append(a)}}catch{toast('저장소를 읽지 못했어요')}};
$('#remove-avatar').onclick=()=>{
  try{
    localStorage.removeItem('avatar');
    $('.profile-photo img')?.remove();
    $('#avatar').value='';
    $('#remove-avatar').hidden=true;
    toast('프로필 사진을 삭제했어요');
  }catch{toast('프로필 사진을 삭제하지 못했어요')}
};
$('#calibration-info').onclick=()=>popup('<h2>센서 방위 보정</h2><p>기본 모드에서 센서를 사용할 때, 휴대폰이 향한다고 계산한 수평 방향을 조정해요.</p><p>+는 북→동 방향으로 방위각을 더하고, −는 북→서 방향으로 방위각을 빼요. 예를 들어 센서가 북쪽(0°)을 가리킬 때 +10°는 10°, −10°는 350°로 봐요.</p>');
async function getProfile(photos){
  photos??=await allPhotos().catch(()=>[]);
  const {ranks,conquests}=stampAchievements(constellations,photos);
  return {
    nickname:readPreference('nickname','')||DEFAULT_NICKNAME,
    settings:{faint:$('#faint').checked,artwork:$('#constellation-art').checked,deepSky:$('#deep-sky').checked,calibration},
    stamps:photos.map(photo=>photo.id),badges:[...ranks,...conquests],
  };
}
let syncing=false,syncQueued=false;
async function syncProfile(){
  syncQueued=true;
  if(syncing)return;
  syncing=true;
  try{
    while(syncQueued){
      syncQueued=false;
      await identifyBrowser();
      const photos=await allPhotos().catch(()=>[]);
      await community('account',{profile:await getProfile(photos)});
      await backupPhotos(photos);
    }
  }catch{}finally{syncing=false}
}
async function backupPhotos(photos){
  let uploaded={};
  try{uploaded=JSON.parse(readPreference('bamgyeol-backed-stamps','{}'))||{}}catch{}
  const allowOld=readPreference('bamgyeol-backup-legacy','')==='yes';
  for(const photo of photos){
    if((!photo.backup&&!allowOld)||uploaded[photo.id]===photo.date)continue;
    let blob=photo.blob;
    if(blob.size>1_045_000){
      const bitmap=await createImageBitmap(blob);
      const scale=Math.min(1,800/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(bitmap.width*scale);
      canvas.height=Math.round(bitmap.height*scale);
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
      bitmap.close();
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.7));
    }
    if(!blob||blob.size>1_045_000)continue;
    const url=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=reject;
      reader.readAsDataURL(blob);
    });
    await community('uploadPhoto',{stamp:photo.id,date:photo.date,jpeg:url.split(',')[1]});
    uploaded[photo.id]=photo.date;
    storePreference('bamgyeol-backed-stamps',JSON.stringify(uploaded));
  }
}
mountMore({
  toast,getProfile,getPhotos:allPhotos,syncProfile,
  constellationName:id=>constellations.find(item=>item.id===id)?.name||id,
});
function loadViewSettings(){
  $('#faint').checked=readPreference('bamgyeol-faint','off')==='on';
  $('#deep-sky').checked=readPreference('bamgyeol-deep-sky','on')==='on';
  $('#constellation-art').checked=readPreference('bamgyeol-constellation-art','on')==='on';
  calibration=Math.max(-180,Math.min(180,Number(readPreference('bamgyeol-calibration','0'))||0));
  $('#calibration').value=String(calibration);
}
loadViewSettings();
addEventListener('bamgyeol-profile-recovered',()=>{
  loadViewSettings();
  if(document.activeElement!==$('#nickname'))$('#nickname').value=readPreference('nickname',DEFAULT_NICKNAME);
  updateStarCount();
});
$('#calibration').onchange=()=>{
  calibration=Math.max(-180,Math.min(180,Number($('#calibration').value)||0));
  $('#calibration').value=String(calibration);
  storePreference('bamgyeol-calibration',String(calibration));
  syncProfile();
};
for(const id of ['faint','deep-sky','constellation-art']){
  $('#'+id).onchange=event=>{
    storePreference('bamgyeol-'+id,event.target.checked?'on':'off');
    syncProfile();
  };
}
$('#backup-legacy').onclick=()=>{
  popup('<h2>기존 도장 사진을 백업할까요?</h2><p>백업한 사진은 개발자 인증을 거쳐서만 확인할 수 있어요. 촬영 좌표는 이 기기에 남아요.</p><button id="confirm-stamp-backup" type="button" class="primary">백업하기</button>');
  $('#confirm-stamp-backup').onclick=()=>{
    if(!storePreference('bamgyeol-backup-legacy','yes'))return;
    close();
    refreshAchievements();
    syncProfile();
    toast('기존 도장 사진의 백업을 시작했어요');
  };
};
addEventListener('online',syncProfile);
function updateStarCount(){
  const mobile=mobileView.matches,faint=$('#faint').checked;
  const count=stars.filter(s=>shouldDisplayStar(s,mobile,faint)).length;
  $('#star-count').textContent='(현재 '+count.toLocaleString('ko-KR')+'개)';
}
$('#faint').addEventListener('change',updateStarCount);
mobileView.addEventListener('change',updateStarCount);
let lastFrame=0;
function render(t){
  requestAnimationFrame(render);
  if(t-lastFrame<16)return;
  lastFrame=t;
  const time=customDate||new Date();
  $('#date').textContent=formatViewTime(time,!!customDate,mode==='custom'?customZone:undefined);
  if(sensor&&mode==='live'&&!$('#modal').open){const pose=filter.tick(t);if(pose){cameraBasis=pose.basis;az=pose.az;alt=pose.alt}}
  const angles=manualAngles(az,alt);$('#angles').textContent=`AZ ${angles.az.toFixed(0)}°  /  ALT ${angles.alt.toFixed(0)}°`;
  $('#fov').textContent=zoomFov(mobileView.matches?60:70,zoomLevel).toFixed(0)+'°';
  if($('#modal').open||tab!=='viewer')return;
  const state=viewHint.observe(quaternion(cameraBasis||cameraPose(-az,alt+90,0).basis),t);
  $('.hint').classList.toggle('hint-hidden',state.hidden);
  $('.hint').classList.toggle('hint-instant',state.instant);
  const view=drawSky({width:W,height:H,az,alt,lat,lon,time,stars,constellations,mobile:mobileView.matches,faint:$('#faint').checked,deepSky:$('#deep-sky').checked,artwork:$('#constellation-art').checked,artCatalog,cameraBasis,zoomLevel,searchTarget});
  active=view.active;
  $('#identified').classList.toggle('hidden',!active);
  $('#name').textContent=active?.name||'';
  $('#latin').textContent=active?.en||'';
  const target=view.target;
  currentTarget=target;
  $('#object-label').classList.toggle('hidden',!target);
  if(target){
    $('#object-name').textContent=target.name;
    $('#object-english').textContent=target.en;
    $('#object-horizon').hidden=!(target.alt<0);
    // The label follows the actual body instead of crowding the title.
    $('#object-label').style.left=Math.max(8,Math.min(W-$('#object-label').offsetWidth-8,target.x+32))+'px';
    $('#object-label').style.top=Math.min(H-140,Math.max(100,target.y+44))+'px';
  }
}
function wishConstellation(c){
  if(!brightest.has(c.id)){
    const mags=outlineStars(c,stars,outlineNames).map(s=>s.mag).filter(Number.isFinite);
    brightest.set(c.id,mags.length?Math.min(...mags).toFixed(2):null);
  }
  const position=gpsPosition||[37.5665,126.978],mag=brightest.get(c.id);
  return `<div class="wish-constellation"><div class="wish-diagram" role="img" aria-label="${c.name} 연결선">${thumbnail(c)||'연결선 없음'}</div><div class="wish-guide"><strong>${viewingGuide(c,...position)}</strong><small>${gpsPosition?'현위치':'서울'} 기준 · ${mag===null?'밝기 자료 없음':'가장 밝은 연결별 '+mag+'등급'}</small><p>${stories[c.id]}</p></div><span class="wish-emoji" aria-hidden="true">${constellationEmoji(c)}</span></div>`;
}
try {
  const files=['stars.6','constellations','constellations.lines','outline-star-names','constellation-art'];
  const data=await Promise.all(files.map(async name=>{
    const response=await fetch(`data/${name}.json?v=0.7.4`);
    if(!response.ok)throw Error('별 데이터 로딩 실패');
    return response.json();
  }));
  outlineNames=data[3];
  artCatalog=data[4];
  lines=data[2].features;
  stars=prepareStars(data[0].features,lines);
  updateStarCount();
  constellations=prepareConstellations(data[1].features,lines);
  redrawWishes=mountWishes($('#wish-board'),constellations,popup,close,wishConstellation,previewAd,async()=>{
    try{return stampAchievements(constellations,await allPhotos()).rank}catch{return ''}
  });
  if(tab==='stamps')gallery();
  const target=constellations.find(c=>c.id==='Cas');
  const h=horizontal(target.ra,target.dec,lat,lon,new Date());
  az=h.az;
  alt=h.alt;
  requestAnimationFrame(render);
} catch {
  toast('하늘 데이터를 불러오지 못했어요. 서버 연결을 확인하고 새로고침하세요');
  $('#identified').classList.remove('hidden');
  $('#name').textContent='하늘 연결을 기다리고 있어요';
}
refreshAchievements();
syncProfile();
