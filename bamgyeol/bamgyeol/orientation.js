import {cameraPose,directionAngles} from './astro.js?v=0.5.1';

// Quaternions preserve the complete camera frame across zenith, nadir and
// equivalent Euler representations. [right, up, -forward] is a proper rotation.
export function quaternion(basis){
  const r=basis.right,u=basis.up,f=basis.forward;
  const m=[r[0],u[0],-f[0],r[1],u[1],-f[1],r[2],u[2],-f[2]];
  const trace=m[0]+m[4]+m[8];let q;
  if(trace>0){const s=Math.sqrt(trace+1)*2;q=[(m[7]-m[5])/s,(m[2]-m[6])/s,(m[3]-m[1])/s,s/4]}
  else if(m[0]>m[4]&&m[0]>m[8]){const s=Math.sqrt(1+m[0]-m[4]-m[8])*2;q=[s/4,(m[1]+m[3])/s,(m[2]+m[6])/s,(m[7]-m[5])/s]}
  else if(m[4]>m[8]){const s=Math.sqrt(1+m[4]-m[0]-m[8])*2;q=[(m[1]+m[3])/s,s/4,(m[5]+m[7])/s,(m[2]-m[6])/s]}
  else{const s=Math.sqrt(1+m[8]-m[0]-m[4])*2;q=[(m[2]+m[6])/s,(m[5]+m[7])/s,s/4,(m[3]-m[1])/s]}
  return q.map(v=>v/Math.hypot(...q));
}
export function basisFromQuaternion([x,y,z,w]){
  return {right:[1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w)],up:[2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)],forward:[-2*(x*z+y*w),-2*(y*z-x*w),-(1-2*(x*x+y*y))]};
}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const rotationDistance=(a,b)=>2*Math.acos(Math.min(1,Math.abs(dot(a,b))))*180/Math.PI;
function interpolate(a,b,t){
  let d=dot(a,b);if(d<0){b=b.map(v=>-v);d=-d}
  if(d>.9995){const q=a.map((v,i)=>v+(b[i]-v)*t);return q.map(v=>v/Math.hypot(...q))}
  const angle=Math.acos(Math.min(1,d)),s=Math.sin(angle);
  return a.map((v,i)=>(v*Math.sin((1-t)*angle)+b[i]*Math.sin(t*angle))/s);
}
export class OrientationFilter{
  reset(){this.offset=null;this.target=null;this.shown=null;this.lastTick=null;this.lastSample=null;this.pending=null}
  constructor(){this.reset()}
  ingest(sample,now){
    const {alpha,beta,gamma,heading,absolute,screenAngle=0,calibration=0}=sample;
    if(![alpha,beta,gamma].every(Number.isFinite))return false;
    if(!absolute&&!Number.isFinite(heading))return false;
    // Safari's compass heading can change hemisphere as the phone tilts.
    // Establish its north reference once; never inject that changing value
    // into every frame. Android absolute events already have a north reference.
    if(this.offset===null)this.offset=absolute?0:heading+alpha;
    const q=quaternion(cameraPose(alpha,beta,gamma,this.offset+calibration,screenAngle).basis);
    if(this.target&&rotationDistance(this.target,q)>65&&now-this.lastSample<100){
      const p=this.pending;
      this.pending=p&&rotationDistance(p.q,q)<15?{q,count:p.count+1}:{q,count:1};
      if(this.pending.count<3)return false;
    }
    this.pending=null;this.lastSample=now;
    if(!this.target||rotationDistance(this.target,q)>.15)this.target=q;
    if(!this.shown){this.shown=q;this.lastTick=now}
    return true;
  }
  tick(now){
    if(!this.shown)return null;
    const dt=Math.max(0,Math.min(100,now-this.lastTick));this.lastTick=now;
    const error=rotationDistance(this.shown,this.target);
    const altitude=directionAngles(basisFromQuaternion(this.shown).forward).alt;
    const slow=Math.abs(altitude)<=30?240:180;
    const tau=slow+(65-slow)*Math.min(1,error/12);
    this.shown=interpolate(this.shown,this.target,1-Math.exp(-dt/tau));
    const basis=basisFromQuaternion(this.shown);
    return {...directionAngles(basis.forward),basis,q:this.shown};
  }
}
export class ViewHint{
  constructor(){this.reset()}
  reset(){this.anchor=null;this.started=null;this.samples=[];this.hidden=true;this.instant=false}
  observe(q,now){
    if(!this.anchor){this.anchor=q;this.started=now}
    const delta=rotationDistance(this.anchor,q);
    // Ignore sub-0.15 degree noise, but retain the anchor so slow intentional
    // movement still accumulates and back-and-forth motion counts as travel.
    if(delta>=.15){this.samples.push({time:now,degrees:Math.round(delta*1e6)/1e6});this.anchor=q}
    this.samples=this.samples.filter(s=>s.time>now-3000);
    const travel=this.samples.reduce((sum,s)=>sum+s.degrees,0);
    if(travel>=10)this.hidden=true;
    else if(now-this.started>=3000&&travel<2)this.hidden=false;
    return {hidden:this.hidden,instant:this.instant};
  }
}
