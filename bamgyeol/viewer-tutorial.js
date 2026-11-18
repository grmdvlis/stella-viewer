const guides = {
  live: [
    ['[data-mode=live]', '기본 모드에서는 내가 있는 곳의 밤하늘을 관측해요.'],
    ['#sensors', '{sensor} 현위치의 실제 밤하늘을 보기 위해서 꼭 위치 권한과 동작 권한을 허용해 주세요. 화면을 손으로 직접 움직이거나 앱 사용이 누적되면, 기기 방향과 실제 밤하늘 방향이 달라질 수 있어요. {sensor}을 다시 누르면 새로고침돼요.'],
    ['#location-trigger', '(현위치) 현위치가 확인되면 녹색불로 표시돼요. 탭하면 지금 있는 곳 위경도 좌표를 알 수 있어요.'],
    ['.search-trigger', '{search} 원하는 별자리가 어디에 있는지 알 수 있어요.'],
    ['.viewer-zoom', '(+, − 아이콘) 별자리가 너무 크거나 작을 때, 시야각(FOV)을 확대/축소할 수 있어요.'],
    ['#angles', '(방위각/고도) 현재 바라보는 방향을 Azimuth(방위각)과 Altitude(고도)로 나타내요. 방위각은 북쪽(0˚)부터 시계방향으로 360˚까지, 고도는 지평선(0˚)을 기준으로 −90˚부터 90˚까지예요.'],
  ],
  custom: [
    ['[data-mode=custom]', '지정 모드에서는 내가 있는 곳이 아닌, 임의의 지구상 어딘가의 밤하늘을 관측해요.'],
    ['[data-mode=custom]', '밤하늘이 궁금한 위치를 세계지도 위에 찍거나, 위경도 좌표를 직접 입력하세요. ‘지정 모드’를 누르면 위치를 새로 지정할 수 있어요. 국가나 도시명을 입력하는 기능도 준비 중이에요.'],
    ['.aim', '지정 모드에서는 내 기기의 동작 센서를 이용할 수 없어요. 화면을 손으로 직접 움직이면서 가상의 밤하늘을 상상해보세요.'],
    ['#time', '{time} 원하는 시간대의 밤하늘을 볼 수 있어요.'],
  ],
};

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
      <button type="button" data-action="close" aria-label="튜토리얼 닫기">X</button>
    </div>`;
  app.append(cover);

  const spotlight=cover.querySelector('.tutorial-spotlight');
  const copy=cover.querySelector('.tutorial-copy');
  const controls=cover.querySelector('.tutorial-actions');
  const previous=cover.querySelector('[data-action=previous]');
  const viewer=app.querySelector('#viewer');
  const header=help.closest('header');
  const dock=app.querySelector('#dock');
  let steps,step=0;

  function layout(){
    if(cover.hidden)return;
    const root=app.getBoundingClientRect();
    const height=dock.getBoundingClientRect().top-root.top-3;
    cover.style.height=height+'px';
    const box=app.querySelector(steps[step][0]).getBoundingClientRect();
    const top=box.top-root.top;
    Object.assign(spotlight.style,{
      left:Math.max(0,box.left-root.left-4)+'px',top:Math.max(0,top-4)+'px',
      width:box.width+8+'px',height:box.height+8+'px',
    });
    const description=copy.offsetHeight;
    const bottomLimit=height-controls.offsetHeight-14;
    const above=top-description-15;
    const below=top+box.height+16;
    const ideal=top>height/2&&above>=12?above:below+description<=bottomLimit?below:above;
    copy.style.top=Math.max(12,Math.min(ideal,bottomLimit-description))+'px';
  }
  function render(){
    const icon=selector=>app.querySelector(selector)?.outerHTML??'';
    copy.querySelector('p').innerHTML=steps[step][1]
      .replaceAll('{sensor}',icon('#sensors svg')).replaceAll('{search}',icon('.search-trigger svg')).replaceAll('{time}',icon('#time svg'));
    previous.disabled=step===0;
    layout();
  }
  function open(){
    steps=guides[getMode()];
    step=0;
    app.classList.add('tutorial-open');
    cover.hidden=false;
    viewer.inert=header.inert=true;
    help.setAttribute('aria-expanded','true');
    render();
    copy.focus({preventScroll:true});
  }
  function close(returnFocus=true){
    if(cover.hidden)return;
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
    if(step+1===steps.length)close();
    else {step++;render()}
  }
  help.onclick=open;
  cover.onclick=event=>{
    const action=event.target.closest('button')?.dataset.action;
    if(action==='previous')back();
    else if(action==='close')close();
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
}
