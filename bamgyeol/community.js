const key='bamgyeol-device-key';
const validDevice=value=>typeof value==='string'&&/^[a-f\d]{64}$/.test(value);
let identity;

function readDevice(){
  try{
    const value=localStorage.getItem(key);
    return validDevice(value)?value:null;
  }catch{return null}
}

async function request(action,fields){
  const response=await fetch(action==='uploadPhoto'?'/api/community?image=1':'/api/community',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action,...fields}),
    signal:AbortSignal.timeout(8500),
  });
  if(!response.ok)throw Error(response.status===403?'forbidden':response.status===404?'missing':'unavailable');
  return response.json();
}

async function identify(){
  const stored=readDevice();
  if(stored)return stored;
  const {device,profile}=await request('identify',{});
  if(!validDevice(device))throw Error('unavailable');
  const fromAnotherTab=readDevice();
  if(fromAnotherTab)return fromAnotherTab;
  try {
    localStorage.setItem(key,device);
    if(profile){
      const {settings}=profile;
      const values={
        nickname:profile.nickname,
        'bamgyeol-faint':settings.faint?'on':'off',
        'bamgyeol-deep-sky':settings.deepSky?'on':'off',
        'bamgyeol-constellation-art':settings.artwork?'on':'off',
        'bamgyeol-calibration':String(settings.calibration),
      };
      for(const [name,value] of Object.entries(values)){
        if(localStorage.getItem(name)===null)localStorage.setItem(name,value);
      }
      dispatchEvent(new Event('bamgyeol-profile-recovered'));
    }
  }catch{}
  return device;
}

export function identifyBrowser(){
  identity??=(navigator.locks?navigator.locks.request(key,identify):identify()).catch(error=>{
    identity=null;
    throw error;
  });
  return identity;
}

export async function getDeviceId(){
  const device=await identifyBrowser();
  const hashed=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(device));
  return Array.from(new Uint8Array(hashed),b=>b.toString(16).padStart(2,'0')).join('');
}

export async function community(action,fields={}){
  return action.startsWith('admin')?request(action,fields):request(action,{...fields,device:await identifyBrowser()});
}
