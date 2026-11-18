const guides = {
  live: [
    ['[data-mode=live]', '기본 모드에서는 내가 있는 곳의 밤하늘을 관측해요.'],
    ['#sensors', '{sensor} 현위치의 실제 밤하늘을 보기 위해서 꼭 위치 권한과 동작 권한을 허용해 주세요. 화면을 손으로 직접 움직이거나 앱 사용이 누적되면, 기기 방향과 실제 밤하늘 방향이 달라질 수 있어요. {sensor}을 다시 누르면 새로고침돼요.'],
    ['#location-trigger', '{location} 녹색불이 켜지면 위치가 확인된 상태예요. 이 표시를 탭하면 지금 있는 곳의 위경도 좌표를 알 수 있어요.'],
    ['.search-trigger', '{search} 원하는 별자리가 어디에 있는지 알 수 있어요.'],
    ['.viewer-zoom', '{zoom} 별자리가 너무 크거나 작을 때, 두 버튼으로 시야각(FOV)을 조절할 수 있어요.'],
    ['#angles', '{angles} 현재 바라보는 방향을 Azimuth(방위각)와 Altitude(고도)로 나타내요. 방위각은 북쪽(0°)부터 시계 방향으로 360°까지, 고도는 지평선(0°)을 기준으로 −90°부터 90°까지예요.'],
  ],
  custom: [
    ['[data-mode=custom]', '지정 모드에서는 내가 있는 곳이 아닌, 임의의 지구상 어딘가의 밤하늘을 관측해요.'],
    ['[data-mode=custom]', '밤하늘이 궁금한 위치를 세계지도 위에 찍거나, 위경도 좌표를 직접 입력하세요. ‘지정 모드’를 누르면 위치를 새로 지정할 수 있어요. 국가나 도시명을 입력하는 기능도 준비 중이에요.'],
    ['.aim', '지정 모드에서는 내 기기의 동작 센서를 이용할 수 없어요. 화면을 손으로 직접 움직이면서 가상의 밤하늘을 상상해보세요.'],
    ['#time', '{time} 원하는 시간대의 밤하늘을 볼 수 있어요.'],
  ],
};
const intro=[
  ['', '안녕? 나는 왹져 개구리... 같이 별들을 구경해볼까?'],
  ['viewer','뷰어 탭은 별자리를 찾는 걸 도와줘. 별이 보이는 곳으로 스마트폰을 움직여서 찾아도 되고, 찾고 싶은 별자리를 검색해서 방향을 알 수도 있다. <strong>동작 감지 권한은 꼭 허용</strong>! 자세한 건 오른쪽 위 {help}을 눌러봐.'],
  ['stamps','도장 탭은 별자리 사진을 찍어서 저장하고 도장깨기하는 곳! 뷰어 화면에서 별자리를 꾹 눌러도 바로 사진 찍을 수 있어. 도장 깨다 보면 기념 뱃지도 줄게. 대신 이상한 사진 찍으면 안 받아준다.'],
  ['wishes','소원 탭은 다같이 별자리마다 소원 빌어두는 곳. 마음에 드는 소원은 같이 빌어줄 수도 있다. 너도 좋아하는 별자리에 소원 빌어 봐. 이 왹져 개구리가 들어줄 수도.'],
  ['more','더보기에서는 계정 관리하거나 이것저것 설정할 수 있다. 네가 모은 뱃지도 구경할 수 있어.'],
];
const introKey='bamgyeol-intro-dismissed';

export function mountViewerTutorial(app,getMode){
  const help=app.querySelector('#tutorial-help');
  const cover=document.createElement('section');
  cover.id='viewer-tutorial';
  cover.className='tutorial-cover';
  cover.setAttribute('role','region');
  cover.setAttribute('aria-label','뷰어 사용법');
  cover.hidden=true;
  cover.innerHTML=`<div class="tutorial-spotlight" aria-hidden="true"></div>
    <div class="tutorial-copy" tabindex="-1" aria-live="polite"><p></p></div>
    <div class="tutorial-actions">
      <div><button type="button" data-action="previous">◀이전</button><button type="button" data-action="next">다음▶</button></div>
      <div><button type="button" data-action="dismiss" hidden>다시 보지 않기</button><button type="button" data-action="close" aria-label="안내 닫기">X</button></div>
    </div>`;
  app.append(cover);

  const spotlight=cover.querySelector('.tutorial-spotlight');
  const copy=cover.querySelector('.tutorial-copy');
  const controls=cover.querySelector('.tutorial-actions');
  const previous=cover.querySelector('[data-action=previous]');
  const viewer=app.querySelector('#viewer');
  const header=help.closest('header');
  const dock=app.querySelector('#dock');
  const telemetry=app.querySelector('.telemetry');
  const dismiss=cover.querySelector('[data-action=dismiss]');
  let steps,step=0,frog,highlighted;

  function layout(){
    if(cover.hidden)return;
    const root=app.getBoundingClientRect();
    const height=dock.getBoundingClientRect().top-root.top-3;
    cover.style.height=height+'px';
    controls.style.bottom=Math.max(20,root.top+height-telemetry.getBoundingClientRect().top+12)+'px';
    const description=copy.offsetHeight;
    const bottomLimit=controls.offsetTop-10;
    if(steps===intro){
      const frogHeight=frog.offsetHeight;
      const frogTop=Math.max(2,Math.min((root.height-frogHeight)/2,bottomLimit-description-12-frogHeight));
      frog.style.top=frogTop+'px';
      copy.style.top=frogTop+frogHeight+12+'px';
      return;
    }
    const target=steps[step][0];
    const box=app.querySelector(target).getBoundingClientRect();
    const top=box.top-root.top;
    Object.assign(spotlight.style,{
      left:Math.max(0,box.left-root.left-4)+'px',top:Math.max(0,top-4)+'px',
      width:box.width+8+'px',height:box.height+8+'px',
    });
    const above=top-description-15;
    const below=top+box.height+16;
    const ideal=top>height/2&&above>=12?above:below+description<=bottomLimit?below:above;
    copy.style.top=Math.max(12,Math.min(ideal,bottomLimit-description))+'px';
  }
  function render(){
    const icon=selector=>app.querySelector(selector)?.outerHTML??'';
    const zoomIcons=['#zoom-in','#zoom-out'].map(selector=>
      `<span class="tutorial-zoom-icon">${app.querySelector(selector).textContent}</span>`
    ).join('');
    copy.querySelector('p').innerHTML=steps[step][1]
      .replaceAll('{sensor}',icon('#sensors svg')).replaceAll('{search}',icon('.search-trigger svg')).replaceAll('{time}',icon('#time svg'))
      .replace('{location}','<span class="tutorial-location"><span class="dot" aria-hidden="true"></span>현위치</span>')
      .replace('{zoom}',`<span class="tutorial-zoom-icons">${zoomIcons}</span>`)
      .replace('{angles}','<span class="tutorial-angles">AZ / ALT</span>')
      .replace('{help}',`<span class="tutorial-help-icon">${help.textContent}</span>`);
    highlighted?.classList.remove('intro-tab');
    if(steps===intro&&steps[step][0]){
      highlighted=dock.querySelector(`[data-tab="${steps[step][0]}"]`);
      highlighted?.classList.add('intro-tab');
    }
    previous.disabled=step===0;
    layout();
  }
  function open(firstRun){
    steps=firstRun?intro:guides[getMode()];
    step=0;
    if(firstRun&&!frog){
      frog=document.createElement('img');
      frog.className='tutorial-frog';
      frog.alt='검은 선글라스를 쓴 왹져 개구리';
      frog.src='assets/tutorial-frog.webp?v=0.7.3';
      frog.addEventListener('load',layout);
      cover.prepend(frog);
    }
    if(frog)frog.hidden=!firstRun;
    spotlight.hidden=firstRun;
    dismiss.hidden=!firstRun;
    cover.classList.toggle('tutorial-intro',firstRun);
    cover.setAttribute('aria-label',firstRun?'밤결 첫 튜토리얼':'뷰어 도움말');
    app.classList.add('tutorial-open');
    cover.hidden=false;
    viewer.inert=header.inert=true;
    help.setAttribute('aria-expanded','true');
    render();
    copy.focus({preventScroll:true});
  }
  function close(returnFocus=true){
    if(cover.hidden)return;
    highlighted?.classList.remove('intro-tab');
    cover.hidden=true;
    app.classList.remove('tutorial-open');
    viewer.inert=header.inert=false;
    help.setAttribute('aria-expanded','false');
    if(returnFocus)help.focus({preventScroll:true});
  }
  function back(){
    if(step>0){step--;render()}
  }
  function next(){
    if(step+1===steps.length){
      if(steps===intro)rememberIntro();
      close();
    }
    else {step++;render()}
  }
  function rememberIntro(){try{localStorage.setItem(introKey,'yes')}catch{}}
  help.onclick=()=>open(false);
  cover.onclick=event=>{
    const action=event.target.closest('button')?.dataset.action;
    if(action==='previous')back();
    else if(action==='close')close();
    else if(action==='dismiss'){rememberIntro();close()}
    else next();
  };
  cover.addEventListener('keydown',event=>{
    if(!['Escape','ArrowLeft','ArrowRight'].includes(event.key))return;
    event.preventDefault();
    event.stopPropagation();
    if(event.key==='Escape')close();
    else if(event.key==='ArrowLeft')back();
    else next();
  });
  dock.addEventListener('click',event=>{
    if(event.target.closest('button'))close(false);
  });
  addEventListener('resize',layout);
  return ()=>{
    try{if(localStorage.getItem(introKey)==='yes')return}catch{}
    open(true);
  };
}
