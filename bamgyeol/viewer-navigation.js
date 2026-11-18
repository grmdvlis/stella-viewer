const rad=Math.PI/180;
export const clampZoom=n=>Math.max(-2,Math.min(2,n));
export const zoomFov=(base,level)=>2*Math.atan(Math.tan(base*rad/2)/1.4**clampZoom(level))/rad;
export function searchConstellations(items,query){
 const key=query.trim().normalize('NFC').toLocaleLowerCase();
 return key?items.filter(c=>c.name.normalize('NFC').toLocaleLowerCase().includes(key)):[];
}
export function constellationCenter(c){
 const pts=[...new Map(c.lines.flat().map(p=>[p.join(','),p])).values()];
 const v=pts.reduce((sum,[a,d])=>sum.map((x,i)=>x+[Math.cos(d*rad)*Math.cos(a*rad),Math.cos(d*rad)*Math.sin(a*rad),Math.sin(d*rad)][i]),[0,0,0]);
 return {ra:Math.atan2(v[1],v[0])/rad,dec:Math.atan2(v[2],Math.hypot(v[0],v[1]))/rad};
}
// Use the camera's actual screen basis, including sensor roll and zenith crossing.
export function guideDirection(target,az,alt,basis=null){
 const a=az*rad,e=alt*rad,t=target.az*rad,d=target.alt*rad;
 const v=[Math.cos(d)*Math.sin(t),Math.cos(d)*Math.cos(t),Math.sin(d)];
 const right=basis?.right||[Math.cos(a),-Math.sin(a),0],up=basis?.up||[-Math.sin(e)*Math.sin(a),-Math.sin(e)*Math.cos(a),Math.cos(e)];
 const forward=basis?.forward||[Math.cos(e)*Math.sin(a),Math.cos(e)*Math.cos(a),Math.sin(e)];
 const dot=q=>q.reduce((s,x,i)=>s+x*v[i],0);
 let x=dot(right),y=-dot(up);const z=dot(forward);
 if(Math.hypot(x,y)<1e-8){x=z<0?1:0;y=0;}
 return {x,y,z};
}
export function guideEndpoint(direction,width,height){
 const {x,y}=direction;if(Math.hypot(x,y)<1e-8)return {x:width/2,y:height/2};
 const scale=Math.min((width/2-35)/(Math.abs(x)||1e-10),Math.max(40,height/2-150)/(Math.abs(y)||1e-10));
 return {x:width/2+x*scale,y:height/2+y*scale};
}
const glass='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
const compass='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m19 5-5 14-3-6-6-3Z"/></svg>';
export function mountConstellationSearch(root,getItems,onSelect){
 root.innerHTML=`<div class="search-pill"><input id="constellation-query" role="combobox" aria-label="별자리 이름 검색" aria-autocomplete="list" aria-expanded="false" aria-controls="constellation-results" placeholder="별자리 이름 검색" autocomplete="off" hidden><button type="button" class="search-trigger" aria-label="별자리 검색" aria-expanded="false">${glass}</button></div><button type="button" class="search-cancel round" aria-label="별자리 검색 취소" hidden>×</button><ul id="constellation-results" role="listbox" aria-label="추천 별자리" hidden></ul>`;
 const field=root.querySelector('input'),trigger=root.querySelector('.search-trigger'),cancel=root.querySelector('.search-cancel'),list=root.querySelector('ul');
 let selected=null,matches=[],cursor=-1;
 function hideList(){list.hidden=true;field.setAttribute('aria-expanded','false');field.removeAttribute('aria-activedescendant');}
 function choose(c){selected=c;field.value=c.name;field.readOnly=true;hideList();root.classList.add('selected');trigger.innerHTML=compass;trigger.setAttribute('aria-label','다른 별자리 검색');field.blur();onSelect(c);}
 function results(){
  matches=searchConstellations(getItems(),field.value);cursor=-1;list.replaceChildren();
  for(const c of matches){const li=document.createElement('li'),button=document.createElement('button');button.type='button';button.id='search-option-'+c.id;button.setAttribute('role','option');button.setAttribute('aria-selected','false');button.textContent=c.name;button.onclick=()=>choose(c);li.append(button);list.append(li);}
  if(field.value.trim()&&!matches.length){const li=document.createElement('li');li.className='search-empty';li.textContent='일치하는 별자리가 없어요.';list.append(li);}
  list.hidden=!field.value.trim();field.setAttribute('aria-expanded',String(!list.hidden));
 }
 trigger.onclick=()=>{
  root.classList.add('expanded');field.hidden=false;cancel.hidden=false;trigger.setAttribute('aria-expanded','true');
  if(selected){selected=null;field.readOnly=false;field.value='';root.classList.remove('selected');trigger.innerHTML=glass;trigger.setAttribute('aria-label','별자리 검색');onSelect(null);}
  field.focus();results();
 };
 function reset(){selected=null;field.value='';field.readOnly=false;field.hidden=true;hideList();root.classList.remove('expanded','selected');cancel.hidden=true;trigger.innerHTML=glass;trigger.setAttribute('aria-label','별자리 검색');trigger.setAttribute('aria-expanded','false');onSelect(null);trigger.focus();}
 cancel.onclick=reset;field.oninput=results;field.onfocus=()=>{if(!selected)results();};
 field.onkeydown=e=>{
  if(e.isComposing)return;
  if(e.key==='Escape'){e.preventDefault();reset();return;}
  if(['ArrowDown','ArrowUp'].includes(e.key)&&matches.length&&!selected){
   e.preventDefault();cursor=(cursor+(e.key==='ArrowDown'?1:-1)+matches.length)%matches.length;
   const options=list.querySelectorAll('[role=option]');options.forEach((b,i)=>b.setAttribute('aria-selected',String(i===cursor)));field.setAttribute('aria-activedescendant',options[cursor].id);options[cursor].scrollIntoView({block:'nearest'});
  }
  if(e.key==='Enter'&&!selected&&matches.length){e.preventDefault();choose(matches[Math.max(cursor,0)]);}
 };
 document.addEventListener('pointerdown',e=>{if(!root.contains(e.target))hideList();});
}
