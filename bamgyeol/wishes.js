import {DEFAULT_NICKNAME} from './constellation-guide.js?v=0.6.4';
const SAMPLES = {
  Cas:[{id:'cas-1',author:'새벽별',text:'좋아하는 일을 오래, 내 속도로 할 수 있기를.',count:0},{id:'cas-2',author:'하늘산책',text:'오랜만에 만나는 친구와 저녁 산책을 할 수 있기를.',count:0}],
  Ori:[{id:'ori-1',author:'겨울빛',text:'내일의 나에게 오늘보다 조금 더 다정할 수 있기를.',count:0}],
};
const escape = s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function mountWishes(root,stars,popup,close,figure) {
  let state={posts:{},voted:{}};
  try{state=JSON.parse(localStorage.getItem('bamgyeol-wishes')||'null')||state}catch{}
  let selected=Math.max(0,stars.findIndex(c=>c.id==='Cas')),post=0,gesture=null;
  const wrap=(n,size)=>(n%size+size)%size;
  const save=()=>{try{localStorage.setItem('bamgyeol-wishes',JSON.stringify(state));return true}catch{return false}};
  let pending=0, sliding=false;
  async function shift(offset){
    if(!offset)return;
    pending=Math.max(-stars.length,Math.min(stars.length,pending+offset));
    if(sliding)return;
    sliding=true;
    try{
      while(pending){
        const card=root.querySelector('.wish-card');
        const focusWheel=root.querySelector('.wish-garland')?.contains(document.activeElement);
        const step=Math.sign(pending);
        if(matchMedia('(prefers-reduced-motion: reduce)').matches||!card?.animate||!card.getClientRects().length){
          selected=wrap(selected+pending,stars.length);pending=0;post=0;draw();
        }else{
          const duration=Math.abs(pending)>3?65:125;
          pending-=step;
          await card.animate([{transform:'translateX(0)',opacity:1},{transform:'translateX('+(-step*42)+'%)',opacity:.1}],{duration,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{});
          selected=wrap(selected+step,stars.length);post=0;draw();
          await root.querySelector('.wish-card').animate([{transform:'translateX('+(step*42)+'%)',opacity:.1},{transform:'translateX(0)',opacity:1}],{duration,easing:'ease-out'}).finished.catch(()=>{});
        }
        if(focusWheel && document.activeElement===document.body)
          root.querySelector('.wish-garland [aria-pressed="true"]')?.focus({preventScroll:true});
      }
    }finally{sliding=false}
  }
  const draw=()=>{
    const c=stars[selected], entries=[...(state.posts[c.id]||[]),...(SAMPLES[c.id]||[])], wish=entries[post];
    const voted=!!state.voted[wish?.id];
    root.innerHTML=`<div class="wish-garland" role="group" aria-label="별자리 선택">${Array.from({length:11},(_,i)=>{
        const offset=i-5, s=stars[wrap(selected+offset,stars.length)];
        return `<button data-offset="${offset}" ${Math.abs(offset)>4?'tabindex="-1" aria-hidden="true"':''} aria-label="${escape(s.name)}" aria-pressed="${offset===0}" style="--step:${Math.abs(offset)}"><span>✦</span></button>`;
      }).join('')}</div>
      <article class="wish-card" aria-label="${escape(c.name)} 소원"><div class="wish-card-heading"><div><small>${selected+1} / ${stars.length}</small><h2>${escape(c.name)}</h2></div><small>${entries.length?'소원 '+entries.length+'개':'첫 소원을 기다려요'}</small><button data-action="new">+ 소원 남기기</button></div>
      ${figure(c)}
      <div class="wish-content" aria-live="polite">${wish?`<div class="wish-profile"><span class="wish-avatar">${wish.avatar?'<img alt="" src="'+escape(wish.avatar)+'">':'✦'}</span><strong>${escape(wish.author)}</strong>${wish.id.includes('-')&&!wish.id.startsWith('local-')?'<small>예시 소원</small>':''}</div><p>${escape(wish.text)}</p>`:'<p>이 별자리에 첫 소원을 남겨보세요.</p>'}</div>
      <footer><button data-action="prev" aria-label="이전 소원" ${entries.length<2?'disabled':''}>◀</button>
      <button data-action="vote" aria-pressed="${voted}" ${wish?'':'disabled'}><small>이 소원 함께 빌기</small><strong>${wish?wish.count+Number(voted):0}</strong></button>
      <button data-action="next" aria-label="다음 소원" ${entries.length<2?'disabled':''}>▶</button></footer></article>
      <p class="wish-note" role="status"></p>`;
    paintWheel(0);
  };
  root.onclick=e=>{
    if(e.detail && performance.now()<(root.ignoreClickUntil||0))return;
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.offset!==undefined){shift(Number(b.dataset.offset));root.querySelector('.wish-garland [aria-pressed="true"]').focus();return}
    const c=stars[selected], entries=[...(state.posts[c.id]||[]),...(SAMPLES[c.id]||[])];
    const action=b.dataset.action;
    if(action==='prev'||action==='next'){post=wrap(post+(action==='prev'?-1:1),entries.length);draw();root.querySelector('[data-action="'+action+'"]').focus()}
    if(action==='vote'&&entries[post]){
      const id=entries[post].id; state.voted[id]=!state.voted[id];
      const saved=save();draw();root.querySelector('[data-action="vote"]').focus();
      if(!saved)root.querySelector('.wish-note').textContent='저장할 수 없어 새로고침하면 변경이 사라져요.';
    }
    if(action==='new'){
      popup(`<h2>${escape(c.name)}에 소원 남기기</h2><form id="wish-form"><label>소원<textarea rows="4" maxlength="240" required></textarea></label><small>이 브라우저에만 저장됩니다.</small><button class="primary">소원 남기기</button><small role="status"></small></form>`);
      document.querySelector('#wish-form').onsubmit=event=>{
        event.preventDefault();
        const text=event.currentTarget.querySelector('textarea').value.trim();if(!text)return;
        let author=DEFAULT_NICKNAME,avatar='';
        try{author=localStorage.getItem('nickname')?.trim()||author;avatar=localStorage.getItem('avatar')||''}catch{}
        if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))avatar='';
        const entries=state.posts[c.id] ||= [];
        entries.unshift({id:'local-'+crypto.randomUUID(),author,avatar,text,count:0});
        if(!save()){entries.shift();event.currentTarget.querySelector('[role=status]').textContent='저장 공간을 확인해주세요.';return}
        post=0;close();draw();root.querySelector('[data-action="new"]').focus();
      };
    }
  };
  // Keep the track mounted while the pointer is captured. Recycle stars off-screen.
  function paintWheel(travel){
    const middle=Math.round(travel), fraction=travel-middle;
    root.querySelectorAll('.wish-garland button').forEach((b,i)=>{
      const slot=i-5, position=slot-fraction, offset=middle+slot;
      b.dataset.offset=offset;
      b.setAttribute('aria-label',stars[wrap(selected+offset,stars.length)].name);
      b.setAttribute('aria-pressed',slot===0);
      b.style.left=(50+position*100/9)+'%';
      b.style.setProperty('--step',Math.min(5,Math.abs(position)));
    });
  }
  root.onpointerdown=e=>{
    if(e.button!==0 || gesture || sliding)return;
    const wheel=e.target.closest('.wish-garland');
    if(!wheel && (!e.target.closest('.wish-card')||e.target.closest('button')))return;
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,wheel,step:wheel?wheel.clientWidth/9:1,travel:0,dragging:false};
  };
  root.onpointermove=e=>{
    if(gesture?.id!==e.pointerId||!gesture.wheel)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if(!gesture.dragging){
      if(Math.abs(dx)<5||Math.abs(dx)<Math.abs(dy))return;
      gesture.dragging=true;
      gesture.wheel.setPointerCapture(e.pointerId);
    }
    gesture.travel=-dx/Math.max(1,gesture.step);
    paintWheel(gesture.travel);
  };
  root.onpointerup=e=>{
    if(gesture?.id!==e.pointerId)return;
    const g=gesture;gesture=null;
    const dx=e.clientX-g.x,dy=e.clientY-g.y;
    if(g.dragging||(!g.wheel&&Math.abs(dx)>32&&Math.abs(dx)>Math.abs(dy)*1.3)){
      root.ignoreClickUntil=performance.now()+400;
      shift(g.wheel?Math.round(g.travel):(dx<0?1:-1));
    }
  };
  root.onpointercancel=e=>{if(gesture?.id===e.pointerId){gesture=null;paintWheel(0)}};
  let wheelDelta=0,wheelAt=0;
  root.addEventListener('wheel',e=>{
    if(!e.target.closest('.wish-garland')||e.ctrlKey||gesture)return;
    e.preventDefault();
    if(performance.now()-wheelAt>220)wheelDelta=0;
    wheelAt=performance.now();
    const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
    wheelDelta+=delta*(e.deltaMode===1?16:e.deltaMode===2?100:1);
    const steps=Math.trunc(wheelDelta/55);
    if(steps){wheelDelta-=steps*55;shift(steps)}
  },{passive:false});
  root.onkeydown=e=>{if(e.target.closest('.wish-garland')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();shift(e.key==='ArrowLeft'?-1:1);root.querySelector('.wish-garland [aria-pressed="true"]').focus()}};
  draw();
  return draw;
}
