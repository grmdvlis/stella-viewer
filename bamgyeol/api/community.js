import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {validNickname} from '../community-rules.js';

const catalog=new Set(JSON.parse(readFileSync(new URL('../data/constellations.json',import.meta.url),'utf8')).features.map(item=>item.id));
const prefix='bamgyeol:community:';
const users=prefix+'users',userIndex=prefix+'user-index',wishes=prefix+'wishes',wishIndex=prefix+'wish-index';
const numbers=prefix+'account-numbers',numberCounter=prefix+'account-counter',authorWishes=prefix+'author-wishes';
const browserCookie='bamgyeol_device';
const digest=value=>createHash('sha256').update(value).digest('hex');
const recordId=/^[a-f\d]{64}$/;
const localId=/^local-[a-f\d-]{36}$/i;
const rankNames=['별지기 입문자','별지기 초보자','일개 별지기','멋진 별지기','숙련 별지기','고수 별지기','전문 별지기','별지기 마스터'];
const maxBody=8*1024;

async function readBody(request,limit){
  if(!request.body)return null;
  const reader=request.body.getReader();
  const decoder=new TextDecoder();
  let size=0,text='';
  try{
    for(;;){
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>limit){await reader.cancel();return null}
      text+=decoder.decode(value,{stream:true});
    }
    return JSON.parse(text+decoder.decode());
  }catch{return null}
}
const reply=(payload,status=200,headers={})=>Response.json(payload,{status,headers:{'Cache-Control':'no-store',...headers}});

function browserIdentity(request){
  const cookie=request.headers.get('cookie')?.split(';').map(value=>value.trim()).find(value=>value.startsWith(browserCookie+'='));
  const device=cookie?.slice(browserCookie.length+1);
  return typeof device==='string'&&recordId.test(device)?device:null;
}
function deviceCookie(request,device){
  const secure=new URL(request.url).protocol==='https:'?'; Secure':'';
  return {'Set-Cookie':`${browserCookie}=${device}; Path=/api/community; Max-Age=31536000; HttpOnly; SameSite=Strict${secure}`};
}

function redisClient(env,fetcher){
  const endpoint=env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/,'');
  const token=env.UPSTASH_REDIS_REST_TOKEN;
  if(!endpoint||!token)return null;
  return async(command,pipeline=false)=>{
    const response=await fetcher(endpoint+(pipeline?'/pipeline':''),{
      method:'POST',
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify(command),
      signal:AbortSignal.timeout(6500),
    });
    if(!response.ok)throw Error('Store unavailable');
    const result=await response.json();
    if(pipeline){
      if(result.some(row=>row.error))throw Error('Store error');
      return result.map(row=>row.result);
    }
    if(result.error)throw Error('Store error');
    return result.result;
  };
}

const recordWish=`
  if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then return 1 end
  local count = redis.call('INCR', KEYS[4])
  if count == 1 then redis.call('EXPIRE', KEYS[4], 60) end
  if count > 8 then return 0 end
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
  redis.call('ZADD', KEYS[2], ARGV[3], ARGV[1])
  redis.call('ZADD', KEYS[3], ARGV[3], ARGV[1])
  redis.call('ZADD', KEYS[5], 0, ARGV[4])
  return 1`;

const setVote=`
  if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 0 then return -1 end
  if ARGV[3] == '1' then redis.call('SADD', KEYS[2], ARGV[2])
  else redis.call('SREM', KEYS[2], ARGV[2]) end
  return redis.call('SCARD', KEYS[2])`;
const recordPhoto=`
  local old = redis.call('HGET', KEYS[1], 'date')
  if not old or old <= ARGV[1] then
    redis.call('HSET', KEYS[1], 'date', ARGV[1], 'jpeg', ARGV[2])
  end
  return 1`;

// Older accounts only have a last-sync timestamp. Index those once before assigning new numbers.
const prepareIndexes=`
  if redis.call('EXISTS', KEYS[1]) == 1 then return 1 end
  for _, id in ipairs(redis.call('ZRANGE', KEYS[2], 0, -1)) do
    if redis.call('HEXISTS', KEYS[3], id) == 0 then
      redis.call('HSET', KEYS[3], id, redis.call('INCR', KEYS[4]))
    end
  end
  for _, id in ipairs(redis.call('ZRANGE', KEYS[5], 0, -1)) do
    local row = redis.call('HGET', KEYS[6], id)
    if row then
      local ok, item = pcall(cjson.decode, row)
      if ok and type(item) == 'table' and type(item.authorId) == 'string' and type(item.createdAt) == 'string' then
        redis.call('ZADD', KEYS[7], 0, item.authorId .. ':' .. item.createdAt .. ':' .. id)
      end
    end
  end
  redis.call('SET', KEYS[1], '1')
  return 1`;

const recordAccount=`
  local number = redis.call('HGET', KEYS[3], ARGV[1])
  if not number then
    number = redis.call('INCR', KEYS[4])
    redis.call('HSET', KEYS[3], ARGV[1], number)
  end
  local previous = redis.call('HGET', KEYS[1], ARGV[1])
  local row = ARGV[2]
  if previous then
    local old, current = cjson.decode(previous), cjson.decode(row)
    for _, field in ipairs({'stamps','badges'}) do
      if old[field] and #old[field] > 0 then
        local seen = {}
        for _, value in ipairs(current[field]) do seen[value] = true end
        for _, value in ipairs(old[field]) do
          if not seen[value] then table.insert(current[field], value) end
        end
      end
    end
    row = cjson.encode(current)
  end
  redis.call('HSET', KEYS[1], ARGV[1], row)
  redis.call('ZADD', KEYS[2], ARGV[3], ARGV[1])
  return tonumber(number)`;

async function listWishes(redis,id,group,after){
  const groupKey=prefix+'group:'+group;
  const rank=after?await redis(['ZREVRANK',groupKey,after]):null;
  const start=rank===null?0:Number(rank)+1;
  const ids=await redis(['ZREVRANGE',groupKey,start,start+60]);
  const next=ids.length>60?ids[59]:null;
  if(next)ids.length=60;
  if(!ids.length)return {posts:[],next:null};
  const [rows,...votes]=await redis([
    ['HMGET',wishes,...ids],
    ...ids.flatMap(key=>[['SCARD',prefix+'votes:'+key],['SISMEMBER',prefix+'votes:'+key,id]]),
  ],true);
  const posts=rows.map((row,index)=>{
    if(!row)return null;
    const {authorId,localKey,author,text,rank}=JSON.parse(row);
    return {
      id:ids[index],author,text,rank,count:Number(votes[index*2]),voted:!!votes[index*2+1],
      ...(authorId===id?{localKey}:{}),
    };
  }).filter(Boolean);
  return {posts,next};
}

function safeProfile(profile={}){
  const value=profile&&typeof profile==='object'?profile:{};
  return {
    nickname:validNickname(value.nickname)?value.nickname.trim():'지나가던별지기',
    settings:{
      faint:value.settings?.faint===true,
      artwork:value.settings?.artwork!==false,
      deepSky:value.settings?.deepSky!==false,
      calibration:Math.max(-180,Math.min(180,Number(value.settings?.calibration)||0)),
    },
    stamps:Array.isArray(value.stamps)?[...new Set(value.stamps.filter(id=>catalog.has(id)))]:[],
    badges:Array.isArray(value.badges)?value.badges.filter(badge=>rankNames.includes(badge)||['황도 정복가','사계절 정복가','북반구 정복가','남반구 정복가'].includes(badge)).slice(0,12):[],
  };
}

function authorBounds(id){
  return ['['+id+':','('+id+';'];
}
async function adminPosts(redis,ids){
  if(!ids.length)return [];
  const [rows,...counts]=await redis([['HMGET',wishes,...ids],...ids.map(id=>['SCARD',prefix+'votes:'+id])],true);
  return rows.flatMap((row,index)=>row?[{...JSON.parse(row),count:Number(counts[index])}]:[]);
}

async function adminRead(redis,secret,input,ensureIndexes){
  if(!secret||secret.length<24||typeof input.secret!=='string'||
     !timingSafeEqual(Buffer.from(digest(secret),'hex'),Buffer.from(digest(input.secret),'hex'))){
    return reply({error:'forbidden'},403);
  }
  if(input.action==='adminPhoto'){
    if(typeof input.id!=='string'||!recordId.test(input.id)||!catalog.has(input.stamp))return reply({error:'invalid'},400);
    const [date,jpeg]=await redis(['HMGET',prefix+'photo:'+input.id+':'+input.stamp,'date','jpeg']);
    return jpeg?reply({date,jpeg}):reply({error:'missing'},404);
  }
  await ensureIndexes(redis);
  const offset=Number.isSafeInteger(input.offset)&&input.offset>=0?input.offset:0;
  if(input.action==='adminWishes'){
    if(typeof input.id!=='string'||!recordId.test(input.id))return reply({error:'invalid'},400);
    const [min,max]=authorBounds(input.id);
    const records=await redis(['ZREVRANGEBYLEX',authorWishes,max,min,'LIMIT',offset,41]);
    const posts=await adminPosts(redis,records.slice(0,40).map(member=>member.slice(-64)));
    return reply({posts,next:records.length>40?offset+40:null});
  }
  const [userIds,wishIds,accountTotal]=await redis([
    ['ZREVRANGE',userIndex,offset,offset+39],
    ['ZREVRANGE',wishIndex,offset,offset+39],
    ['ZCARD',userIndex],
  ],true);
  const accountRows=userIds.length?redis([
    ['HMGET',users,...userIds],['HMGET',numbers,...userIds],
    ...userIds.map(id=>['ZLEXCOUNT',authorWishes,...authorBounds(id)]),
  ],true):Promise.resolve([[],[]]);
  const [[rows,accountNumbers,...counts],posts]=await Promise.all([accountRows,adminPosts(redis,wishIds)]);
  const accounts=rows.flatMap((row,index)=>{
    if(!row)return [];
    const account=JSON.parse(row);
    return [{...account,...safeProfile(account),number:Number(accountNumbers[index]),wishCount:Number(counts[index])}];
  });
  return reply({accounts,posts,accountTotal:Number(accountTotal),next:userIds.length===40||wishIds.length===40?offset+40:null});
}

export function createCommunityHandler(env=process.env,fetcher=fetch){
  let index;
  function ensureIndexes(redis){
    index??=redis(['EVAL',prepareIndexes,7,prefix+'owner-index-v1',userIndex,numbers,numberCounter,wishIndex,wishes,authorWishes])
      .catch(error=>{index=null;throw error});
    return index;
  }
  return async request=>{
    if(request.method!=='POST')return reply({error:'method'},405);
    if(request.headers.get('sec-fetch-site')==='cross-site'||
       !request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'invalid'},400);
    const imageRequest=new URL(request.url).searchParams.has('image');
    const input=await readBody(request,imageRequest?1_500_000:maxBody);
    if(!input||typeof input!=='object')return reply({error:'invalid'},400);
    if(imageRequest!==(input.action==='uploadPhoto'))return reply({error:'invalid'},400);
    if(input.action==='identify'){
      const existing=browserIdentity(request);
      const device=existing||randomBytes(32).toString('hex');
      let profile;
      if(existing){
        const redis=redisClient(env,fetcher);
        if(redis){
          try {
            const stored=await redis(['HGET',users,digest(device)]);
            if(stored)profile=safeProfile(JSON.parse(stored));
          }catch{return reply({error:'unavailable'},503)}
        }
      }
      return reply({device,profile},200,deviceCookie(request,device));
    }
    const redis=redisClient(env,fetcher);
    if(!redis)return reply({error:'unavailable'},503);
    try{
      if(['admin','adminPhoto','adminWishes'].includes(input.action))return await adminRead(redis,env.BAMGYEOL_ADMIN_SECRET,input,ensureIndexes);
      if(typeof input.device!=='string'||!recordId.test(input.device))return reply({error:'identity'},400);
      const id=digest(input.device);
      if(input.action==='uploadPhoto'){
        if(!catalog.has(input.stamp)||typeof input.date!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(input.date)||
          typeof input.jpeg!=='string'||input.jpeg.length>1_400_000||!/^\/9j\/[A-Za-z0-9+/]+={0,2}$/.test(input.jpeg))return reply({error:'invalid'},400);
        await redis(['EVAL',recordPhoto,1,prefix+'photo:'+id+':'+input.stamp,input.date,input.jpeg]);
        return reply({stored:true});
      }
      if(input.action==='account'){
        await ensureIndexes(redis);
        const updatedAt=new Date().toISOString();
        const account={id,...safeProfile(input.profile),updatedAt};
        const number=await redis(['EVAL',recordAccount,4,users,userIndex,numbers,numberCounter,id,JSON.stringify(account),Date.parse(updatedAt)]);
        return reply({id,number},200,deviceCookie(request,input.device));
      }
      if(input.action==='vote'){
        if(typeof input.id!=='string'||!recordId.test(input.id)||typeof input.active!=='boolean')return reply({error:'invalid'},400);
        const count=await redis(['EVAL',setVote,2,wishes,prefix+'votes:'+input.id,input.id,id,input.active?'1':'0']);
        return Number(count)<0?reply({error:'missing'},404):reply({count:Number(count),voted:input.active});
      }
      if(!catalog.has(input.group))return reply({error:'invalid'},400);
      if(input.action==='list'){
        if(input.after!=null&&(typeof input.after!=='string'||!recordId.test(input.after)))return reply({error:'invalid'},400);
        return reply(await listWishes(redis,id,input.group,input.after));
      }
      if(input.action==='publish'){
        if(input.private===true||typeof input.localKey!=='string'||!localId.test(input.localKey)||typeof input.text!=='string'||
          !input.text.trim()||input.text.length>240)return reply({error:'invalid'},400);
        const key=digest(id+':'+input.localKey),createdAt=new Date().toISOString();
        const post={id:key,authorId:id,localKey:input.localKey,group:input.group,createdAt,
          author:validNickname(input.author)?input.author.trim():'지나가던별지기',
          rank:rankNames.includes(input.rank)?input.rank:'',text:input.text.trim()};
        const stored=await redis(['EVAL',recordWish,5,wishes,prefix+'group:'+input.group,wishIndex,
          prefix+'publish-limit:'+id,authorWishes,key,JSON.stringify(post),Date.parse(createdAt),id+':'+createdAt+':'+key]);
        return Number(stored)?reply({id:key}):reply({error:'rate'},429);
      }
      return reply({error:'invalid'},400);
    }catch{return reply({error:'unavailable'},503)}
  };
}

export default {fetch:createCommunityHandler()};
