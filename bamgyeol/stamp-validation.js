import {horizontal,rad} from './astro.js?v=0.7.0';

const directionTolerance = 22;

export function stampDirectionIssue(constellation, pose, position, date) {
  if (!pose || !position) return '방위·고도 확인에 위치와 동작 권한, 절대방위 신호가 필요해요.';
  const {latitude, longitude} = position;
  const points = [[constellation.ra, constellation.dec], ...constellation.lines.flat()];
  const visible = points.map(([ra, dec]) => horizontal(ra, dec, latitude, longitude, date))
    .filter(point => point.alt >= 0);
  if (!visible.length) return '지금 위치에서는 이 별자리가 지평선 아래에 있어요.';
  const alt = pose.alt * rad;
  const inRange = visible.some(point => {
    const targetAlt = point.alt * rad;
    const cosine = Math.sin(alt) * Math.sin(targetAlt) +
      Math.cos(alt) * Math.cos(targetAlt) * Math.cos((point.az - pose.az) * rad);
    return cosine >= Math.cos(directionTolerance * rad);
  });
  return pose.alt < 0 || !inRange ? '카메라 방위·고도가 이 별자리 방향과 맞지 않아요.' : '';
}

export function stampImageIssues({data, width, height}) {
  const luma = new Float32Array(width * height);
  let sum = 0, bright = 0, dark = 0, colorful = 0;
  for (let i = 0; i < luma.length; i++) {
    const offset = i * 4;
    const r = data[offset], g = data[offset + 1], b = data[offset + 2];
    const value = luma[i] = .213 * r + .715 * g + .072 * b;
    sum += value;
    if (value >= 145) bright++;
    if (value <= 90) dark++;
    if (value >= 38 && Math.max(r,g,b) - Math.min(r,g,b) >= 40) colorful++;
  }
  let edges = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const neighbors = [luma[i-1], luma[i+1], luma[i-width], luma[i+width]];
      if (Math.max(...neighbors) - Math.min(...neighbors) > 27) edges++;
    }
  }
  const pixels = luma.length;
  const issues = [];
  if (sum / pixels > 91 || bright / pixels > .22) {
    issues.push('사진이 밤하늘로 보기에는 너무 밝아요.');
  }
  if (dark / pixels < .56 || edges / pixels > .14 || colorful / pixels > .28) {
    issues.push('사진에서 사물이나 풍경이 화면의 큰 부분을 차지하는 것으로 보여요.');
  } else if (!issues.length && !hasLightPoints(luma,width,height)) {
    issues.push('사진에서 별처럼 작은 빛을 충분히 확인하기 어려워요.');
  }
  return issues;
}

function hasLightPoints(luma,width,height){
  const points=[];
  for(let y=2;y<height-2;y++){
    for(let x=2;x<width-2;x++){
      const i=y*width+x;
      if(luma[i]<=12)continue;
      const outside=Math.max(
        luma[i-2],luma[i+2],luma[i-2*width],luma[i+2*width],
        luma[i-2*width-2],luma[i-2*width+2],luma[i+2*width-2],luma[i+2*width+2],
      );
      if(luma[i]-outside<7||points.some(([px,py])=>Math.abs(px-x)<=3&&Math.abs(py-y)<=3))continue;
      points.push([x,y]);
      if(points.length===3)return true;
    }
  }
  return false;
}
