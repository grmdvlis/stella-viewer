const key='bamgyeol-device-key';
function deviceKey(){
  try {
    const stored=localStorage.getItem(key);
    if(/^[a-f\d]{64}$/.test(stored||''))return stored;
  }catch{}
  const value=Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('');
  try{localStorage.setItem(key,value)}catch{}
  return value;
}
const device=deviceKey();
export const deviceId=crypto.subtle.digest('SHA-256',new TextEncoder().encode(device)).then(value=>
  Array.from(new Uint8Array(value),b=>b.toString(16).padStart(2,'0')).join(''));

export async function community(action,fields={}){
  const response=await fetch(action==='uploadPhoto'?'/api/community?image=1':'/api/community',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(action.startsWith('admin')?{action,...fields}:{action,device,...fields}),
    signal:AbortSignal.timeout(8500),
  });
  if(!response.ok)throw Error(response.status===403?'forbidden':response.status===404?'missing':'unavailable');
  return response.json();
}
