// Temporarily exclude editable controls from native dialog initial focus.
// Restoring them immediately keeps manual entry and keyboard navigation intact.
export function openDialogWithoutInputFocus(dialog,content){
  const controls=[...content.querySelectorAll('input,select,textarea')].map(element=>({element,disabled:element.disabled}));
  try{
    controls.forEach(({element})=>{element.disabled=true});
    dialog.showModal();
    content.querySelector('h2')?.focus({preventScroll:true});
  }finally{controls.forEach(({element,disabled})=>{element.disabled=disabled})}
}
