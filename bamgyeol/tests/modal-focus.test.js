import test from 'node:test';
import assert from 'node:assert/strict';
import {openDialogWithoutInputFocus} from '../modal-focus.js';
test('modal opens with editable controls excluded from initial focus, then restores them',()=>{
  const controls=[{disabled:false},{disabled:true}],events=[];
  const heading={focus(options){assert.equal(options.preventScroll,true);events.push('heading')}};
  const content={querySelectorAll(){return controls},querySelector(){return heading}};
  const dialog={showModal(){assert.ok(controls.every(c=>c.disabled));events.push('open')}};
  openDialogWithoutInputFocus(dialog,content);
  assert.deepEqual(events,['open','heading']);assert.deepEqual(controls.map(c=>c.disabled),[false,true]);
});
test('input enabled state is restored if modal opening fails',()=>{
  const control={disabled:false};
  assert.throws(()=>openDialogWithoutInputFocus({showModal(){throw Error('failed')}},{querySelectorAll(){return [control]}}));
  assert.equal(control.disabled,false);
});
