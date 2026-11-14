const rad=Math.PI/180;
export function artPoint([ra,dec],p){
 let x,y;
 if(p.kind==='tangent'){
  const d=dec*rad,a=ra*rad-p.ra,z=Math.sin(p.dec)*Math.sin(d)+Math.cos(p.dec)*Math.cos(d)*Math.cos(a);
  x=Math.cos(d)*Math.sin(a)/z;y=(Math.cos(p.dec)*Math.sin(d)-Math.sin(p.dec)*Math.cos(d)*Math.cos(a))/z;
 }else{x=((ra-p.origin+540)%360-180)*Math.cos(dec*rad);y=-dec;}
 return [x*p.axes[0][0]+p.axes[0][1],y*p.axes[1][0]+p.axes[1][1]];
}
export function skyPoint(u,v,p){
 const x=(u-p.axes[0][1])/p.axes[0][0],y=(v-p.axes[1][1])/p.axes[1][0];
 if(p.kind==='legacy'){
  const dec=-y;if(Math.abs(dec)>=89.95)return null;
  return [p.origin+x/Math.cos(dec*rad),dec];
 }
 const rho=Math.hypot(x,y),c=Math.atan(rho);
 if(rho<1e-12)return [p.ra/rad,p.dec/rad];
 const dec=Math.asin(Math.cos(c)*Math.sin(p.dec)+y*Math.sin(c)*Math.cos(p.dec)/rho);
 const ra=p.ra+Math.atan2(x*Math.sin(c),rho*Math.cos(p.dec)*Math.cos(c)-y*Math.sin(p.dec)*Math.sin(c));
 return [ra/rad,dec/rad];
}
export function constellationDiagram(c,catalog){
 const art=catalog[c.id];if(!art)return '';
 const point=p=>artPoint(p,art.projection).map(v=>(v*100).toFixed(4)).join(',');
 const vertices=[...new Map(c.lines.flat().map(p=>[p.join(','),p])).values()];
 return `<svg viewBox="0 0 100 100" role="img" aria-label="${c.name} 연결선">${c.lines.map(l=>`<polyline fill="none" points="${l.map(point).join(' ')}"/>`).join('')}${vertices.map(p=>{const [x,y]=artPoint(p,art.projection);return `<circle cx="${x*100}" cy="${y*100}" r=".65"/>`;}).join('')}</svg>`;
}
export const artURL=art=>art.src+'?v='+art.revision;

// Lazy-load only the targeted picture. Mesh vertices are sky coordinates,
// so rotation, mirroring and perspective follow the same camera as the stars.
export function createArtLayer(){
 const cache=new Map();
 function texture(art){
  const key=artURL(art);
  if(cache.has(key)){const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
  const entry={ready:false},image=new Image();cache.set(key,entry);
  image.onload=()=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=768;
   const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,768,768);
   // Feather the square's edge, preserving the accepted artwork itself.
   ctx.globalCompositeOperation='destination-in';
   const fade=ctx.createRadialGradient(384,384,300,384,384,480);
   fade.addColorStop(0,'#fff');fade.addColorStop(1,'#fff0');ctx.fillStyle=fade;ctx.fillRect(0,0,768,768);
   entry.canvas=canvas;entry.ready=true;
  };
  image.src=key;
  if(cache.size>6)cache.delete(cache.keys().next().value);
  return entry;
 }
 return (ctx,art,pos)=>{
  if(!art)return;const entry=texture(art);if(!entry.ready)return;
  const n=10,grid=[];
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
   const sky=skyPoint(i/n,j/n,art.projection);
   grid.push({source:[i/n*768,j/n*768],screen:sky&&pos(sky)});
  }
  ctx.save();ctx.globalAlpha=.30;ctx.globalCompositeOperation='screen';
  function triangle(a,b,c){
   const [p,q,r]=[a.screen,b.screen,c.screen];if(!p||!q||!r)return;
   const [s,t,u]=[a.source,b.source,c.source];
   const x1=t[0]-s[0],y1=t[1]-s[1],x2=u[0]-s[0],y2=u[1]-s[1],det=x1*y2-x2*y1;
   const A=((q.x-p.x)*y2-(r.x-p.x)*y1)/det,B=((q.y-p.y)*y2-(r.y-p.y)*y1)/det;
   const C=((r.x-p.x)*x1-(q.x-p.x)*x2)/det,D=((r.y-p.y)*x1-(q.y-p.y)*x2)/det;
   ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();
   ctx.transform(A,B,C,D,p.x-A*s[0]-C*s[1],p.y-B*s[0]-D*s[1]);ctx.drawImage(entry.canvas,0,0);ctx.restore();
  }
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
   const a=grid[j*(n+1)+i],b=grid[j*(n+1)+i+1],c=grid[(j+1)*(n+1)+i],d=grid[(j+1)*(n+1)+i+1];triangle(a,b,d);triangle(a,d,c);
  }
  ctx.restore();
 };
}
