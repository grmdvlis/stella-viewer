export function validNickname(value){
  return typeof value==='string'&&value.trim().length<=24&&/\p{L}/u.test(value);
}
