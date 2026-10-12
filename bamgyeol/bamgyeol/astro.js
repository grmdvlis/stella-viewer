export const rad=Math.PI/180;
export const wrap=x=>(x%360+360)%360;
export function horizontal(ra,dec,lat,lon,date){const jd=date.getTime()/86400000+2440587.5;const h=wrap(280.46061837+360.98564736629*(jd-2451545)+lon-ra)*rad;const d=dec*rad,l=lat*rad;return {alt:Math.asin(Math.sin(d)*Math.sin(l)+Math.cos(d)*Math.cos(l)*Math.cos(h))/rad,az:wrap(Math.atan2(-Math.sin(h)*Math.cos(d),Math.sin(d)*Math.cos(l)-Math.cos(d)*Math.sin(l)*Math.cos(h))/rad)};}
// The optional longest-axis fit prevents a tall phone screen from exposing a
// much wider vertical sky than its stated FOV. Desktop retains its original fit.
export function project(az,alt,bearing,elevation,width,height,fov=70,fit='short',basis=null){const a=az*rad,t=alt*rad,b=bearing*rad,e=elevation*rad;const v=[Math.cos(t)*Math.sin(a),Math.cos(t)*Math.cos(a),Math.sin(t)],f=[Math.cos(e)*Math.sin(b),Math.cos(e)*Math.cos(b),Math.sin(e)],r=[Math.cos(b),-Math.sin(b),0],u=[-Math.sin(e)*Math.sin(b),-Math.sin(e)*Math.cos(b),Math.cos(e)];const forward=basis?.forward||f,right=basis?.right||r,up=basis?.up||u;const dot=q=>q.reduce((s,x,i)=>s+x*v[i],0),z=dot(forward);if(z<.05)return null;const span=fit==='long'?Math.max(width,height):Math.min(width,height);const scale=span/(2*Math.tan(fov*rad/2));return {x:width/2+scale*dot(right)/z,y:height/2-scale*dot(up)/z};}
// Use the complete screen basis rather than reconstructing 'up' from altitude.
// This remains continuous when the rear camera crosses zenith or nadir.
export function cameraPose(alpha,beta,gamma,headingOffset=0,screenAngle=0){
  const a=alpha*rad,b=beta*rad,g=gamma*rad;
  const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
  const deviceRight=[ca*cg-sa*sb*sg,sa*cg+ca*sb*sg,-cb*sg];
  const deviceUp=[-sa*cb,ca*cb,sb];
  const forward=[-ca*sg-sa*sb*cg,-sa*sg+ca*sb*cg,-cb*cg];
  const t=screenAngle*rad;
  const right=deviceRight.map((x,i)=>x*Math.cos(t)-deviceUp[i]*Math.sin(t));
  const up=deviceRight.map((x,i)=>x*Math.sin(t)+deviceUp[i]*Math.cos(t));
  const rotate=v=>{const h=headingOffset*rad;return [v[0]*Math.cos(h)+v[1]*Math.sin(h),v[1]*Math.cos(h)-v[0]*Math.sin(h),v[2]]};
  const basis={forward:rotate(forward),right:rotate(right),up:rotate(up)};
  return {...directionAngles(basis.forward),basis};
}
export function directionAngles(forward){return {az:wrap(Math.atan2(forward[0],forward[1])/rad),alt:Math.asin(Math.max(-1,Math.min(1,forward[2])))/rad};}
export function cameraDirection(alpha,beta,gamma){const {az,alt}=cameraPose(alpha,beta,gamma);return {az,alt};}
export function manualAngles(az,alt){return directionAngles([Math.cos(alt*rad)*Math.sin(az*rad),Math.cos(alt*rad)*Math.cos(az*rad),Math.sin(alt*rad)]);}
