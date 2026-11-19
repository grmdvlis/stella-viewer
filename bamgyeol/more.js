import {community,getDeviceId} from './community.js?v=0.7.4';
import {validNickname} from './community-rules.js?v=0.7.4';
import {DEFAULT_NICKNAME} from './constellation-guide.js?v=0.7.4';

export function readPreference(key,fallback){
  try{return localStorage.getItem(key)??fallback}catch{return fallback}
}
export function storePreference(key,value){
  try{localStorage.setItem(key,value);return true}catch{return false}
}

export function mountMore({toast,getProfile,getPhotos,syncProfile,constellationName}){
  const $=selector=>document.querySelector(selector);
  const home=$('#more-home'),about=$('#more-about'),admin=$('#more-admin');
  const nickname=$('#nickname');
  const adminForm=$('#owner-form'),adminPassword=$('#owner-secret'),status=$('#owner-status');
  const report=$('#owner-report'),next=$('#owner-next');
  let press,ownerSecret='',offset=0,request=0,photoUrls=[];
  let accountTable,publicTable;
  const displayedAccounts=new Set(),displayedPosts=new Set();
  const timeFormat=new Intl.DateTimeFormat('ko-KR',{
    timeZone:'Asia/Seoul',dateStyle:'short',timeStyle:'short',
  });
  function show(page,focus){
    for(const section of [home,about,admin])section.hidden=section!==page;
    $('#more').scrollTop=0;
    focus.focus({preventScroll:true});
  }
  function clearAdmin(){
    request++;
    ownerSecret='';
    adminPassword.value='';
    status.textContent='';
    report.replaceChildren();
    displayedAccounts.clear();
    displayedPosts.clear();
    next.hidden=true;
    adminForm.hidden=false;
    photoUrls.forEach(URL.revokeObjectURL);
    photoUrls=[];
  }
  function openAdmin(){
    clearAdmin();
    show(admin,$('#owner-back'));
  }
  $('#developer').onclick=()=>show(about,$('#about-back'));
  $('#about-back').onclick=()=>show(home,$('#developer'));
  $('#owner-back').onclick=()=>{
    clearAdmin();
    show(about,$('#about-back'));
  };

  const name=$('#developer-name');
  const cancelPress=()=>clearTimeout(press);
  name.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    cancelPress();
    press=setTimeout(openAdmin,1100);
  });
  for(const event of ['pointerup','pointerleave','pointercancel'])name.addEventListener(event,cancelPress);
  addEventListener('keydown',event=>{
    if(!$('#more').classList.contains('hidden')&&!about.hidden&&event.altKey&&event.shiftKey&&event.code==='KeyD'){
      event.preventDefault();
      openAdmin();
    }
  });
  $('#dock').addEventListener('click',event=>{
    if(!admin.hidden&&event.target.closest('[data-tab]')){
      clearAdmin();
      show(home,$('#developer'));
    }
  });
  nickname.value=readPreference('nickname','')?.trim()||DEFAULT_NICKNAME;
  $('#nickname-form').onsubmit=event=>{
    event.preventDefault();
    const value=nickname.value.trim();
    if(!validNickname(value)){toast('닉네임에 문자를 한 글자 이상 넣어 주세요.');return}
    if(!storePreference('nickname',value)){toast('닉네임을 저장하지 못했어요.');return}
    nickname.value=value;
    toast('닉네임을 저장했어요');
    syncProfile();
  };

  function heading(text,parent){
    const node=document.createElement('h3');
    node.textContent=text;
    parent.append(node);
  }
  function table(parent,label,columns){
    const scroll=document.createElement('div');
    scroll.className='owner-table-scroll';
    scroll.tabIndex=0;
    scroll.setAttribute('role','region');
    scroll.setAttribute('aria-label',label);
    const element=document.createElement('table');
    element.className='owner-table';
    element.createCaption().textContent=label;
    const header=element.createTHead().insertRow();
    for(const column of columns){
      const th=document.createElement('th');
      th.scope='col';
      th.textContent=column;
      header.append(th);
    }
    const body=element.createTBody();
    scroll.append(element);
    parent.append(scroll);
    return body;
  }
  function row(body,values){
    const item=body.insertRow();
    for(const value of values){
      const cell=item.insertCell();
      if(value instanceof Node)cell.append(value);
      else cell.textContent=value??'—';
    }
    return item;
  }
  function expandable(label){
    const details=document.createElement('details');
    const title=document.createElement('summary');
    title.textContent=label;
    details.append(title);
    return details;
  }
  function time(value){
    const date=new Date(value);
    return value&&Number.isFinite(date.getTime())?timeFormat.format(date):'—';
  }
  function identifier(id){
    if(!id)return '—';
    const details=expandable(id.slice(0,10)+'…');
    const code=document.createElement('code');
    code.textContent=id;
    details.append(code);
    return details;
  }
  function settings(profile){
    const details=expandable('설정 보기');
    const grid=table(details,'뷰어 설정',['항목','값']);
    const settings=profile.settings;
    for(const [label,value] of [
      ['희미한 별',settings.faint],['별자리 배경 그림',settings.artwork],['심원 천체',settings.deepSky],
    ])row(grid,[label,value?'켜짐':'꺼짐']);
    row(grid,['센서 방위 보정',settings.calibration+'°']);
    return details;
  }
  function badges(names){
    if(!names.length)return '0개';
    const details=expandable(names.length+'개');
    const list=document.createElement('ul');
    for(const name of names){
      const item=document.createElement('li');
      item.textContent=name;
      list.append(item);
    }
    details.append(list);
    return details;
  }
  function stampPhotos(account){
    if(!account.stamps.length)return '0개';
    const details=expandable(account.stamps.length+'개 · 사진');
    for(const stamp of account.stamps){
      const button=document.createElement('button');
      button.type='button';
      button.textContent=constellationName(stamp);
      button.onclick=async()=>{
        button.disabled=true;
        try{
          const {jpeg,date}=await community('adminPhoto',{secret:ownerSecret,id:account.id,stamp});
          if(!button.isConnected)return;
          const image=document.createElement('img');
          image.src='data:image/jpeg;base64,'+jpeg;
          image.alt=constellationName(stamp)+' · '+time(date);
          button.replaceWith(image);
        }catch(error){
          if(!button.isConnected)return;
          button.textContent=constellationName(stamp)+(error.message==='missing'?' · 백업 없음':' · 다시 시도');
          button.disabled=error.message==='missing';
        }
      };
      details.append(button);
    }
    return details;
  }
  function showWishes(posts,body,seen){
    for(const post of posts){
      if(seen.has(post.id))continue;
      seen.add(post.id);
      row(body,[constellationName(post.group),post.author,post.text,time(post.createdAt),post.count]);
    }
  }
  const wishColumns=['별자리','작성자','소원','작성 시각 (한국)','함께 빌기'];
  function wishList(account){
    if(!account.wishCount)return '0개';
    const details=expandable(account.wishCount+'개 · 소원 보기');
    const body=table(details,'이 계정의 공개 소원',wishColumns);
    const seen=new Set();
    const more=document.createElement('button');
    more.type='button';
    more.textContent='소원 불러오기';
    details.append(more);
    let start=0;
    more.onclick=async()=>{
      more.disabled=true;
      try{
        const page=await community('adminWishes',{secret:ownerSecret,id:account.id,offset:start});
        if(!more.isConnected)return;
        showWishes(page.posts,body,seen);
        start=page.next;
        more.hidden=start===null;
        more.textContent='다음 공개 소원';
      }catch{more.textContent='다시 시도'}
      finally{more.disabled=false}
    };
    details.addEventListener('toggle',()=>{
      if(details.open&&!seen.size&&!more.hidden&&!more.disabled)more.click();
    });
    return details;
  }
  function showAccounts(accounts){
    for(const account of accounts){
      if(displayedAccounts.has(account.id))continue;
      displayedAccounts.add(account.id);
      const name=document.createElement('span');
      name.textContent=account.nickname;
      if(account.nickname!==DEFAULT_NICKNAME&&account.number){
        const original=document.createElement('small');
        original.textContent=DEFAULT_NICKNAME+' #'+account.number;
        name.append(original);
      }
      row(accountTable,[
        account.number?'#'+account.number:'—',name,identifier(account.id),time(account.updatedAt),
        wishList(account),stampPhotos(account),badges(account.badges),settings(account),
      ]);
    }
  }
  async function readReport(start){
    const id=++request;
    status.textContent='데이터 확인 중…';
    next.disabled=true;
    try{
      const {accounts,posts,accountTotal,next:nextOffset}=await community('admin',{secret:ownerSecret,offset:start});
      if(id!==request)return;
      if(!start){
        const [profile,photos,localId]=await Promise.all([getProfile(),getPhotos().catch(()=>[]),getDeviceId().catch(()=>null)]);
        if(id!==request)return;
        adminForm.hidden=true;
        heading('이 브라우저의 데이터',report);
        const browser=table(report,'브라우저 프로필',['닉네임','식별 ID','도장 수','뱃지','설정']);
        row(browser,[profile.nickname,identifier(localId),profile.stamps.length,badges(profile.badges),settings(profile)]);
        const files=photos.length?table(report,'이 브라우저의 도장 사진',['별자리','촬영 시각 (한국)','파일']):null;
        for(const photo of photos){
          const link=document.createElement('a');
          link.href=URL.createObjectURL(photo.blob);
          photoUrls.push(link.href);
          link.download=photo.id+'.jpg';
          link.textContent='내려받기';
          row(files,[constellationName(photo.id),time(photo.date),link]);
        }
        heading('공용 저장소',report);
        accountTable=table(report,'전체 기기 계정 · '+accountTotal+'개',[
          '계정 번호','닉네임','식별 ID','마지막 동기화 (한국)','공개 소원','도장','뱃지','설정',
        ]);
        publicTable=table(report,'공개 소원',wishColumns);
        if(!accounts.length)row(accountTable,['등록된 계정이 없어요.']);
        if(!posts.length)row(publicTable,['공개 소원이 없어요.']);
      }
      showAccounts(accounts);
      showWishes(posts,publicTable,displayedPosts);
      offset=nextOffset;
      next.hidden=offset===null;
      status.textContent='';
    }catch(error){
      if(id!==request)return;
      status.textContent=error.message==='forbidden'?'개발자 키를 확인해 주세요.':'서버 데이터를 불러오지 못했어요.';
      if(!start)ownerSecret='';
    }finally{if(id===request)next.disabled=false}
  }
  adminForm.onsubmit=event=>{
    event.preventDefault();
    ownerSecret=adminPassword.value;
    adminPassword.value='';
    readReport(0);
  };
  next.onclick=()=>readReport(offset);
}
