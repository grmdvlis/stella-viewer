const textureUrl=new URL('./assets/wishes/earth-night.webp?v=0.7.3',import.meta.url);
const rotationPeriod=80000;

export function mountWishEntrance(section){
  const entrance=section.querySelector('#wish-entrance');
  const entranceGlobe=section.querySelector('#wish-entry-globe');
  const room=section.querySelector('#wish-board');
  const roomGlobe=section.querySelector('#wish-room-globe');
  const enter=section.querySelector('#enter-wishes');
  const canvas=document.createElement('canvas');
  canvas.className='wish-globe';
  canvas.tabIndex=0;
  canvas.setAttribute('aria-label','회전하는 지구. 드래그하거나 좌우 방향키로 돌릴 수 있어요.');
  const ctx=canvas.getContext('2d');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let texture,loading,frame=0,visible=false,drag=null,dirty=true;
  let longitude=85/360,lastTick=0,lastPaint=-Infinity,projection;

  function schedule(){
    if(visible&&!frame)frame=requestAnimationFrame(paint);
  }
  function invalidate(){
    dirty=true;
    schedule();
  }
  function rotate(amount){
    longitude=((longitude+amount)%1+1)%1;
    invalidate();
  }
  function paint(now){
    frame=0;
    if(!visible)return;
    const spinning=!motion.matches&&!drag;
    if(spinning&&lastTick)longitude=(longitude+Math.min(now-lastTick,100)/rotationPeriod)%1;
    lastTick=now;
    const size=Math.min(420,Math.round(canvas.clientWidth*Math.min(devicePixelRatio||1,1.5)));
    if(texture&&size>0&&(dirty||size!==projection?.size||(spinning&&now-lastPaint>=32))){
      if(size!==projection?.size){
        canvas.width=canvas.height=size;
        projection=projectGlobe(ctx,size,texture);
      }
      renderGlobe(ctx,projection,texture,longitude);
      lastPaint=now;
      dirty=false;
    }
    if(texture&&spinning)schedule();
  }
  async function loadTexture(){
    const image=new Image();
    image.src=textureUrl;
    await image.decode();
    const surface=document.createElement('canvas');
    surface.width=Math.min(image.naturalWidth,1600);
    surface.height=Math.round(image.naturalHeight*surface.width/image.naturalWidth);
    const src=surface.getContext('2d',{willReadFrequently:true});
    src.drawImage(image,0,0,surface.width,surface.height);
    texture=src.getImageData(0,0,surface.width,surface.height);
    invalidate();
  }

  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;
    drag={id:event.pointerId,x:event.clientX};
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add('dragging');
  });
  canvas.addEventListener('pointermove',event=>{
    if(drag?.id!==event.pointerId)return;
    rotate((drag.x-event.clientX)/Math.max(canvas.clientWidth,1)*.58);
    drag.x=event.clientX;
  });
  canvas.addEventListener('lostpointercapture',event=>{
    if(drag?.id!==event.pointerId)return;
    drag=null;
    canvas.classList.remove('dragging');
    invalidate();
  });
  canvas.addEventListener('keydown',event=>{
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
    event.preventDefault();
    rotate(event.key==='ArrowLeft'?-.04:.04);
  });
  motion.addEventListener('change',invalidate);
  addEventListener('resize',invalidate);

  enter.onclick=()=>{
    roomGlobe.append(canvas);
    entrance.hidden=true;
    room.hidden=false;
    section.classList.remove('wish-entry-open');
    section.scrollTop=0;
    const focus=room.querySelector('.wish-card h2')||room;
    focus.focus({preventScroll:true});
    invalidate();
  };
  return {
    open(){
      entranceGlobe.append(canvas);
      room.hidden=true;
      entrance.hidden=false;
      section.classList.add('wish-entry-open');
      visible=true;
      lastTick=0;
      loading??=loadTexture().catch(()=>{loading=null});
      invalidate();
    },
    close(){
      visible=false;
      cancelAnimationFrame(frame);
      frame=0;
    },
  };
}

// Inverse orthographic projection into the texture's longitude and latitude.
// Pixel coordinates and lighting stay fixed, so each frame only shifts longitude.
function projectGlobe(ctx,size,{width,height}){
  const image=ctx.createImageData(size,size);
  const longitude=new Float32Array(size*size);
  const rows=new Int32Array(size*size);
  const light=new Float32Array(size*size);
  const rim=new Float32Array(size*size);
  const tilt=-.18,latitude=.24;
  const cosTilt=Math.cos(tilt),sinTilt=Math.sin(tilt);
  const cosLat=Math.cos(latitude),sinLat=Math.sin(latitude);
  for(let i=0;i<rows.length;i++){
    const x=(i%size+.5)*2/size-1,y=1-(Math.floor(i/size)+.5)*2/size;
    const length=x*x+y*y;
    if(length>=1)continue;
    const z=Math.sqrt(1-length);
    const east=x*cosTilt+y*sinTilt,north=y*cosTilt-x*sinTilt;
    const latitudeY=north*cosLat+z*sinLat;
    const meridian=z*cosLat-north*sinLat;
    longitude[i]=(Math.atan2(east,meridian)/(2*Math.PI)+.5)*width;
    const v=.5-Math.asin(Math.max(-1,Math.min(1,latitudeY)))/Math.PI;
    rows[i]=Math.round(v*(height-1))*width;
    light[i]=.54+.66*Math.max(0,z*.68-x*.37+y*.44);
    rim[i]=Math.pow(1-z,5)*(.38+.62*Math.max(0,y*.65+x*.4+.2));
    image.data[4*i+3]=Math.min(255,(1-Math.sqrt(length))*size*160);
  }
  return {size,image,longitude,rows,light,rim};
}

function renderGlobe(ctx,{image,longitude,rows,light,rim},{width,data},turn){
  const shift=turn*width,output=image.data;
  for(let i=0;i<rows.length;i++){
    const target=i*4;
    if(!output[target+3])continue;
    const u=(longitude[i]+shift)%width;
    const x=Math.floor(u),fraction=u-x;
    const a=(rows[i]+x)*4,b=(rows[i]+(x+1)%width)*4;
    output[target]=(data[a]+(data[b]-data[a])*fraction)*light[i]+36*rim[i];
    output[target+1]=(data[a+1]+(data[b+1]-data[a+1])*fraction)*light[i]+97*rim[i];
    output[target+2]=(data[a+2]+(data[b+2]-data[a+2])*fraction)*light[i]+166*rim[i];
  }
  ctx.putImageData(image,0,0);
}
