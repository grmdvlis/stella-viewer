import {DEFAULT_NICKNAME} from './constellation-guide.js?v=0.7.3';
import {community} from './community.js?v=0.7.3';
const SAMPLES = {
  Cas:[{id:'cas-1',author:'새벽별',text:'좋아하는 일을 오래, 내 속도로 할 수 있기를.',count:0},{id:'cas-2',author:'하늘산책',text:'오랜만에 만나는 친구와 저녁 산책을 할 수 있기를.',count:0}],
  Ori:[{id:'ori-1',author:'겨울빛',text:'내일의 나에게 오늘보다 조금 더 다정할 수 있기를.',count:0}],
};
const escape = s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function mountWishes(root,stars,popup,close,figure,previewAd,getRank) {
  const garland=root.querySelector('.wish-garland');
  const board=root.querySelector('.wish-board-content');
  const storageKey='bamgyeol-wishes';
  function loadState(fallback={posts:{},voted:{}}){
    try{return JSON.parse(localStorage.getItem(storageKey)||'null')||fallback}catch{return fallback}
  }
  let state=loadState();
  const feeds=new Map();
  const cursors=new Map();
  let publishing,changingVote=false;
  let selected=Math.max(0,stars.findIndex(c=>c.id==='Cas')),post=0,gesture=null;
  const wrap=(n,size)=>(n%size+size)%size;
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state));return true}catch{return false}};
  function entriesFor(id){
    const local=state.posts[id]||[], remote=feeds.get(id)||[];
    const present=new Set(remote.map(item=>item.localKey).filter(Boolean));
    return [
      ...local.filter(item=>!present.has(item.id)),
      ...remote.map(item=>({...item,remote:true,avatar:local.find(post=>post.id===item.localKey)?.avatar})),
      ...(SAMPLES[id]||[]),
    ];
  }
  async function refreshFeed(id=stars[selected].id,after){
    try{
      const {posts,next}=await community('list',{group:id,after});
      const previous=feeds.get(id)||[];
      if(after){
        if(cursors.get(id)!==after)return;
        const known=new Set(previous.map(item=>item.id));
        feeds.set(id,[...previous,...posts.filter(item=>!known.has(item.id))]);
        cursors.set(id,next);
      }else{
        const incoming=new Set(posts.map(item=>item.id));
        const retained=next?previous.filter(item=>!incoming.has(item.id)):[];
        feeds.set(id,[...posts,...retained]);
        if(!retained.length)cursors.set(id,next);
      }
      if(stars[selected].id!==id||gesture?.dragging||sliding)return;
      const current=entriesFor(id);
      post=Math.min(post,Math.max(0,current.length-1));
      const focused=document.activeElement;
      const focusSelector=!root.contains(focused)?'':
        focused?.closest('.wish-garland')?'.wish-garland [aria-pressed="true"]':
        focused?.dataset.action?`[data-action="${focused.dataset.action}"]`:
        focused?.matches('h2')?'.wish-card h2':'';
      draw();
      if(focusSelector)root.querySelector(focusSelector)?.focus({preventScroll:true});
    }catch{}
  }
  function flushPending(){
    if(publishing)return publishing;
    publishing=(async()=>{
      const pending=Object.entries(loadState(state).posts).flatMap(([group,items])=>
        items.filter(item=>item.pendingShare).map(item=>({group,item})));
      for(const {group,item} of pending){
        try{
          const {id}=await community('publish',{group,localKey:item.id,author:item.author,rank:item.rank,text:item.text});
          state=loadState(state);
          const stored=state.posts[group]?.find(post=>post.id===item.id);
          if(stored){stored.sharedId=id;delete stored.pendingShare;save()}
          await refreshFeed(group);
        }catch{break}
      }
    })().finally(()=>{publishing=null});
    return publishing;
  }
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
    refreshFeed();
  }
  const draw=()=>{
    const c=stars[selected], entries=entriesFor(c.id), wish=entries[post];
    const isLocal=wish?.id.startsWith('local-');
    const voted=wish?.remote?wish.voted:!!state.voted[wish?.id];
    garland.innerHTML=Array.from({length:11},(_,i)=>{
        const offset=i-5, s=stars[wrap(selected+offset,stars.length)];
        return `<button data-offset="${offset}" ${Math.abs(offset)>4?'tabindex="-1" aria-hidden="true"':''} aria-label="${escape(s.name)}" aria-pressed="${offset===0}" style="--step:${Math.abs(offset)}"><span>✦</span></button>`;
      }).join('');
    board.innerHTML=`<article class="wish-card" aria-label="${escape(c.name)} 소원"><div class="wish-card-heading"><div><small>${selected+1} / ${stars.length}</small><h2 tabindex="-1">${escape(c.name)}</h2></div><small>${entries.length?'소원 '+entries.length+'개':'첫 소원을 기다려요'}</small><button data-action="new">+ 소원 남기기</button></div>
      ${figure(c)}
      <div class="wish-content" aria-live="polite">${wish?`<div class="wish-profile"><span class="wish-avatar">${wish.avatar?'<img alt="" src="'+escape(wish.avatar)+'">':'✦'}</span><strong>${escape(wish.author)}</strong>${wish.rank?`<small class="wish-rank">${escape(wish.rank)}</small>`:''}${!wish.remote&&!isLocal?'<small>예시 소원</small>':''}</div><p>${escape(wish.text)}</p>${isLocal&&!wish.sharedId?(wish.pendingShare?'<small>공개 대기 중 · 이 기기에 저장했어요.</small>':'<button type="button" data-action="share">이 소원 공개하기</button>'):''}`:'<p>이 별자리에 첫 소원을 남겨보세요.</p>'}</div>
      <footer><button data-action="prev" aria-label="이전 소원" ${entries.length<2?'disabled':''}>◀</button>
      <button data-action="vote" aria-pressed="${voted}" ${wish?'':'disabled'}><small>이 소원 함께 빌기</small><strong>${wish?wish.count+Number(!wish.remote&&voted):0}</strong></button>
      <button data-action="next" aria-label="다음 소원" ${entries.length<2?'disabled':''}>▶</button></footer></article>
      ${cursors.get(c.id)?'<button type="button" class="wish-older" data-action="older">이전 공개 소원 더 보기</button>':''}
      <p class="wish-note" role="status"></p>`;
    paintWheel(0);
  };
  root.onclick=async e=>{
    if(e.detail && performance.now()<(root.ignoreClickUntil||0))return;
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.offset!==undefined){shift(Number(b.dataset.offset));root.querySelector('.wish-garland [aria-pressed="true"]').focus();return}
    const c=stars[selected], entries=entriesFor(c.id);
    const action=b.dataset.action;
    if(action==='older'){
      b.disabled=true;
      await refreshFeed(c.id,cursors.get(c.id));
      b.disabled=false;
      return;
    }
    if(action==='prev'||action==='next'){post=wrap(post+(action==='prev'?-1:1),entries.length);draw();root.querySelector('[data-action="'+action+'"]').focus()}
    if(action==='vote'&&entries[post]){
      const wish=entries[post];
      if(wish.remote){
        if(changingVote)return;
        changingVote=true;
        try{
          const updated=await community('vote',{id:wish.id,active:!wish.voted});
          const item=feeds.get(c.id)?.find(it=>it.id===wish.id);
          if(item)Object.assign(item,updated);
          if(stars[selected].id===c.id){draw();root.querySelector('[data-action="vote"]').focus()}
        }catch{root.querySelector('.wish-note').textContent='지금은 함께 빌기를 저장하지 못했어요.'}
        finally{changingVote=false}
        return;
      }
      const id=entries[post].id;
      state=loadState(state);
      state.voted[id]=!state.voted[id];
      const saved=save();draw();root.querySelector('[data-action="vote"]').focus();
      if(!saved)root.querySelector('.wish-note').textContent='저장할 수 없어 새로고침하면 변경이 사라져요.';
    }
    if(action==='share'){
      const id=entries[post].id;
      popup('<h2>이 소원을 공개할까요?</h2><p>이전에 이 기기에만 저장했던 소원이에요. 공개하면 다른 기기에서도 작성자 닉네임과 글을 볼 수 있어요.</p><button type="button" class="primary" id="publish-old-wish">공개하기</button>');
      document.querySelector('#publish-old-wish').onclick=async()=>{
        state=loadState(state);
        const item=state.posts[c.id]?.find(w=>w.id===id);
        if(!item)return;
        item.pendingShare=true;
        if(!save()){delete item.pendingShare;return}
        close();draw();
        await flushPending();
        draw();
      };
    }
    if(action==='new')composeWish(c);
  };
  function composeWish(c,draft='',error=''){
    popup(`<h2>${escape(c.name)}에 소원 남기기</h2><form id="wish-form"><label>소원<textarea rows="4" maxlength="240" required></textarea></label><small>5초 광고 미리보기 후 닉네임과 소원이 공개돼요. 연결이 끊겨 있으면 기기에 먼저 저장해요.</small><button class="primary">소원 남기기</button><small role="status"></small></form>`);
    const form=document.querySelector('#wish-form');
    form.querySelector('textarea').value=draft;
    form.querySelector('[role=status]').textContent=error;
    form.onsubmit=async event=>{
      event.preventDefault();
      const text=form.querySelector('textarea').value.trim();
      if(!text||!form.isConnected)return;
      await previewAd('별자리로 소원 보내는 중…');
      let author=DEFAULT_NICKNAME,avatar='';
      try{author=localStorage.getItem('nickname')?.trim()||author;avatar=localStorage.getItem('avatar')||''}catch{}
      if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))avatar='';
      const rank=await getRank();
      state=loadState(state);
      const entries=state.posts[c.id] ||= [];
      entries.unshift({id:'local-'+crypto.randomUUID(),author,avatar,rank,text,count:0,pendingShare:true});
      if(!save()){entries.shift();composeWish(c,text,'저장 공간을 확인해주세요.');return}
      selected=stars.indexOf(c);
      post=0;close();draw();root.querySelector('[data-action="new"]').focus();
      await flushPending();
      if(stars[selected].id===c.id)draw();
    };
  }
  // Keep the track mounted while the pointer is captured. Recycle stars off-screen.
  function paintWheel(travel){
    const middle=Math.round(travel), fraction=travel-middle;
    garland.querySelectorAll('button').forEach((b,i)=>{
      const slot=i-5, position=slot-fraction, offset=middle+slot;
      const x=position/4.8;
      b.dataset.offset=offset;
      b.setAttribute('aria-label',stars[wrap(selected+offset,stars.length)].name);
      b.setAttribute('aria-pressed',slot===0);
      b.style.left=(50+46*x)+'%';
      b.style.top=(46+43*Math.sqrt(Math.max(0,1-x*x)))+'%';
      b.style.visibility=Math.abs(position)<=4.65?'visible':'hidden';
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
  addEventListener('online',()=>{flushPending();refreshFeed()});
  draw();
  let lastRefresh=-Infinity;
  return ()=>{
    draw();
    if(performance.now()-lastRefresh<2500)return;
    lastRefresh=performance.now();
    flushPending();
    refreshFeed();
  };
}
