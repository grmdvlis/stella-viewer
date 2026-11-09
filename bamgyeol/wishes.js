const SAMPLES = {
  Cas:[{id:'cas-1',author:'새벽별',text:'좋아하는 일을 오래, 내 속도로 할 수 있기를.',count:0},{id:'cas-2',author:'하늘산책',text:'오랜만에 만나는 친구와 저녁 산책을 할 수 있기를.',count:0}],
  Ori:[{id:'ori-1',author:'겨울빛',text:'내일의 나에게 오늘보다 조금 더 다정할 수 있기를.',count:0}],
};
const escape = s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
export function mountWishes(root,stars,popup,close) {
  let state={posts:{},voted:{}};
  try{state=JSON.parse(localStorage.getItem('bamgyeol-wishes')||'null')||state}catch{}
  let selected=Math.max(0,stars.findIndex(c=>c.id==='Cas')),post=0,gesture=null;
  const wrap=(n,size)=>(n%size+size)%size;
  const save=()=>{try{localStorage.setItem('bamgyeol-wishes',JSON.stringify(state));return true}catch{return false}};
  const shift=offset=>{selected=wrap(selected+offset,stars.length);post=0;draw()};
  const draw=()=>{
    const c=stars[selected], entries=[...(state.posts[c.id]||[]),...(SAMPLES[c.id]||[])], wish=entries[post];
    const voted=!!state.voted[wish?.id];
    root.innerHTML=`<header class="wish-heading"><div><small>WISH UPON A STAR</small><h1>별에게 건네는 소원</h1></div><button data-action="new">+ 소원 남기기</button></header>
      <div class="wish-garland" role="group" aria-label="별자리 선택">${Array.from({length:9},(_,i)=>{
        const offset=i-4, s=stars[wrap(selected+offset,stars.length)];
        return `<button data-offset="${offset}" aria-label="${escape(s.name)}" aria-pressed="${offset===0}" style="--step:${Math.abs(offset)}"><span>✦</span></button>`;
      }).join('')}</div>
      <article class="wish-card" aria-label="${escape(c.name)} 소원"><header><div><small>${selected+1} / ${stars.length}</small><h2>${escape(c.name)}</h2></div><small>${entries.length?'소원 '+(post+1)+' / '+entries.length:'첫 소원을 기다려요'}</small></header>
      <div class="wish-content" aria-live="polite">${wish?`<div class="wish-profile"><span class="wish-avatar">${wish.avatar?'<img alt="" src="'+escape(wish.avatar)+'">':'✦'}</span><strong>${escape(wish.author)}</strong>${wish.id.includes('-')&&!wish.id.startsWith('local-')?'<small>예시 소원</small>':''}</div><p>${escape(wish.text)}</p>`:'<p>이 별자리에 첫 소원을 남겨보세요.</p>'}</div>
      <footer><button data-action="prev" aria-label="이전 소원" ${entries.length<2?'disabled':''}>◁</button>
      <button data-action="vote" aria-pressed="${voted}" ${wish?'':'disabled'}><small>이 소원 함께 빌기</small><strong>${wish?wish.count+Number(voted):0}</strong></button>
      <button data-action="next" aria-label="다음 소원" ${entries.length<2?'disabled':''}>▷</button></footer></article>
      <p class="wish-note" role="status">소원과 함께 빌기는 이 브라우저에 저장돼요.</p>`;
  };
  root.onclick=e=>{
    if(e.detail && performance.now()<(root.ignoreClickUntil||0))return;
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.offset!==undefined){shift(Number(b.dataset.offset));root.querySelector('[aria-pressed="true"]').focus();return}
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
        let author='익명의 별',avatar='';
        try{author=localStorage.getItem('nickname')?.trim()||author;avatar=localStorage.getItem('avatar')||''}catch{}
        if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar))avatar='';
        const entries=state.posts[c.id] ||= [];
        entries.unshift({id:'local-'+crypto.randomUUID(),author,avatar,text,count:0});
        if(!save()){entries.shift();event.currentTarget.querySelector('[role=status]').textContent='저장 공간을 확인해주세요.';return}
        post=0;close();draw();root.querySelector('[data-action="new"]').focus();
      };
    }
  };
  root.onpointerdown=e=>{if(e.button===0&&!e.target.closest('.wish-card button')&&e.target.closest('.wish-card,.wish-garland'))gesture={id:e.pointerId,x:e.clientX,y:e.clientY}};
  root.onpointerup=e=>{
    if(gesture?.id!==e.pointerId)return;
    const dx=e.clientX-gesture.x, dy=e.clientY-gesture.y;gesture=null;
    if(Math.abs(dx)>32&&Math.abs(dx)>Math.abs(dy)*1.3){root.ignoreClickUntil=performance.now()+400;shift(dx<0?1:-1)}
  };
  root.onpointercancel=()=>{gesture=null};
  root.onkeydown=e=>{if(e.target.closest('.wish-garland')&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();shift(e.key==='ArrowLeft'?-1:1);root.querySelector('.wish-garland [aria-pressed="true"]').focus()}};
  draw();
}
