import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraPose,project,manualAngles} from '../astro.js';

const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
test('센서 카메라는 화면 회전과 방위 보정을 적용해도 정규직교 기저를 유지한다',()=>{
  for(const beta of [-179,-90,0,90,179,180,181,270]){
    const {basis}=cameraPose(33,beta,17,42,90);
    for(const v of Object.values(basis))assert.ok(Math.abs(dot(v,v)-1)<1e-12);
    assert.ok(Math.abs(dot(basis.forward,basis.up))<1e-12);
    assert.ok(Math.abs(dot(basis.forward,basis.right))<1e-12);
    assert.ok(Math.abs(dot(basis.up,basis.right))<1e-12);
  }
});
test('휴대폰 후면 카메라가 천정·천저를 통과해도 별의 화면 위치가 연속적이다',()=>{
  for(const [betas,starAlt] of [[[179,180,181],80],[[-1,0,1],-80]]){
    const points=betas.map(beta=>{
      const pose=cameraPose(0,beta,0);
      return project(20,starAlt,pose.az,pose.alt,393,852,60,'long',pose.basis);
    });
    for(let i=1;i<points.length;i++){
      assert.ok(points[i]&&points[i-1]);
      assert.ok(Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y)<20);
    }
  }
});
test('수동 시선은 ±90도에서 멈추지 않고 반대쪽 하늘로 넘어간다',()=>{
  for(const sign of [-1,1]){
    const before=project(20,sign*80,0,sign*89,393,852,60,'long');
    const after=project(20,sign*80,0,sign*91,393,852,60,'long');
    assert.ok(Math.hypot(before.x-after.x,before.y-after.y)<40);
    const angles=manualAngles(0,sign*100);
    assert.ok(Math.abs(angles.az-180)<1e-8);
    assert.ok(Math.abs(angles.alt-sign*80)<1e-8);
  }
});
