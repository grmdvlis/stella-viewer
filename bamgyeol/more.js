import {community,deviceId} from './community.js?v=0.7.3';
import {validNickname} from './community-rules.js?v=0.7.3';
import {DEFAULT_NICKNAME} from './constellation-guide.js?v=0.7.3';

export function readPreference(key,fallback){
  try{return localStorage.getItem(key)??fallback}catch{return fallback}
}
export function storePreference(key,value){
  try{localStorage.setItem(key,value);return true}catch{return false}
}

export function mountMore({toast,getProfile,getPhotos,syncProfile}){
  const $=selector=>document.querySelector(selector);
  const home=$('#more-home'),about=$('#more-about'),admin=$('#more-admin');
  const nickname=$('#nickname');
  const adminForm=$('#owner-form'),adminPassword=$('#owner-secret'),status=$('#owner-status');
  const report=$('#owner-report'),next=$('#owner-next');
  let press,ownerSecret='',offset=0,request=0,photoUrls=[];
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
  function details(text,data,parent){
    const node=document.createElement('details');
    const summary=document.createElement('summary');
    summary.textContent=text;
    const pre=document.createElement('pre');
    pre.textContent=JSON.stringify(data,null,2);
    node.append(summary,pre);
    parent.append(node);
    return node;
  }
  function showAccounts(accounts){
    const group=details('기기 계정 '+accounts.length+'개',accounts,report);
    for(const account of accounts){
      if(!account.stamps.length)continue;
      const list=document.createElement('fieldset');
      const label=document.createElement('legend');
      label.textContent=account.nickname+' · '+account.id;
      list.append(label);
      for(const stamp of account.stamps){
        const button=document.createElement('button');
        button.type='button';
        button.textContent=stamp+' 사진';
        button.onclick=async()=>{
          const current=request;
          button.disabled=true;
          try{
            const {jpeg,date}=await community('adminPhoto',{secret:ownerSecret,id:account.id,stamp});
            if(current!==request||!button.isConnected)return;
            const image=document.createElement('img');
            image.src='data:image/jpeg;base64,'+jpeg;
            image.alt=stamp+' 도장 · '+date;
            button.replaceWith(image);
          }catch(error){
            if(!button.isConnected)return;
            button.textContent=error.message==='missing'?stamp+' · 백업 없음':stamp+' · 다시 시도';
            button.disabled=error.message==='missing';
          }
        };
        list.append(button);
      }
      group.append(list);
    }
  }
  async function readReport(start){
    const id=++request;
    status.textContent='데이터 확인 중…';
    next.disabled=true;
    try{
      const {accounts,posts,next:nextOffset}=await community('admin',{secret:ownerSecret,offset:start});
      if(id!==request)return;
      if(!start){
        const [profile,photos,localId]=await Promise.all([getProfile(),getPhotos().catch(()=>[]),deviceId]);
        if(id!==request)return;
        adminForm.hidden=true;
        heading('이 브라우저의 데이터',report);
        details('기기 식별 ID · 설정 · 도장 · 뱃지',{id:localId,...profile},report);
        let local={};
        try{local=JSON.parse(readPreference('bamgyeol-wishes','{}'),(key,value)=>key==='avatar'?undefined:value)}catch{}
        details('이 기기에 저장된 소원과 함께 빌기',local,report);
        const files=document.createElement('ul');
        for(const photo of photos){
          const item=document.createElement('li'),link=document.createElement('a');
          link.href=URL.createObjectURL(photo.blob);
          photoUrls.push(link.href);
          link.download=photo.id+'.jpg';
          link.textContent=photo.id+' · '+photo.date;
          item.append(link);
          files.append(item);
        }
        report.append(files);
        heading('공용 저장소',report);
      }
      showAccounts(accounts);
      details('공개 소원 '+posts.length+'개',posts,report);
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
