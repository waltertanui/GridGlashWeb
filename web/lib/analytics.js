import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash,timingSafeEqual} from 'node:crypto';

const PREFIX='gridclash:{analytics:v1}:';
const RETENTION=90*86400;
export const dayAt=now=>new Date(Number(now)+3*3600000).toISOString().slice(0,10);
const fields=['pageViews','visits','gamesStarted','gamesCompleted','aiGames','localGames'];
const zeros=()=>Object.fromEntries(fields.map(f=>[f,0]));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validEvent(e){
  return e&&['page_view','game_started','game_completed'].includes(e.type)&&
    uuid.test(e.id)&&uuid.test(e.visitorId)&&uuid.test(e.sessionId)&&
    (e.type==='page_view'||['ai','local'].includes(e.mode));
}
export function authorized(header,password){
  if(!password||password.length<20||typeof header!=='string')return false;
  const hash=v=>createHash('sha256').update(v).digest();
  return timingSafeEqual(hash(header),hash(`Bearer ${password}`));
}

// Atomic deduplication and aggregation: retried events cannot double count.
const RECORD=`
local total,daily,eventKey,sessionKey,gameKey,visitorsKey,dailyVisitorsKey=unpack(KEYS)
local kind,visitor,mode,ttl=unpack(ARGV)
local function inc(field)
  redis.call('HINCRBY',total,field,1)
  redis.call('HINCRBY',daily,field,1)
end
if kind=='game_completed' and redis.call('GET',gameKey)~=mode then return 0 end
if not redis.call('SET',eventKey,'1','NX','EX',ttl) then return 0 end
if kind=='page_view' then
  inc('pageViews')
  if redis.call('SET',sessionKey,'1','NX','EX',ttl) then inc('visits') end
  redis.call('PFADD',visitorsKey,visitor)
  redis.call('PFADD',dailyVisitorsKey,visitor)
  redis.call('EXPIRE',dailyVisitorsKey,ttl)
elseif kind=='game_started' then
  redis.call('SET',gameKey,mode,'EX',ttl)
  inc('gamesStarted')
  if mode=='ai' then inc('aiGames') else inc('localGames') end
else inc('gamesCompleted') end
redis.call('EXPIRE',daily,ttl)
return 1
`;

export function createRedisStore({url,token,fetchImpl=fetch}){
  const request=async(commands,pipeline=false)=>{
    const response=await fetchImpl(url.replace(/\/$/,'')+(pipeline?'/pipeline':''),{
      method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify(commands),signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)throw Error('Analytics storage unavailable');
    const result=await response.json();
    if((pipeline?result:[result]).some(r=>r.error))throw Error('Analytics storage command failed');
    return pipeline?result.map(r=>r.result):result.result;
  };
  const decode=values=>{const result=zeros();for(let i=0;i<(values?.length||0);i+=2)if(fields.includes(values[i]))result[values[i]]=Number(values[i+1]);return result;};
  return {
    async allow(key){
      const script="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n";
      return await request(['EVAL',script,1,PREFIX+'rate:'+key])<=120;
    },
    record(e,now=Date.now()){
      const day=dayAt(now);
      const keys=[PREFIX+'total',PREFIX+'day:'+day,PREFIX+'event:'+e.type+':'+e.id,PREFIX+'session:'+e.sessionId,PREFIX+'game:'+e.id,PREFIX+'visitors',PREFIX+'visitors:'+day];
      return request(['EVAL',RECORD,keys.length,...keys,e.type,e.visitorId,e.mode||'',String(RETENTION)]);
    },
    async stats(now=Date.now()){
      const days=Array.from({length:30},(_,i)=>dayAt(now-(29-i)*86400000));
      const commands=[['HGETALL',PREFIX+'total'],['PFCOUNT',PREFIX+'visitors']];
      for(const day of days)commands.push(['HGETALL',PREFIX+'day:'+day],['PFCOUNT',PREFIX+'visitors:'+day]);
      const result=await request(commands,true);
      return {storage:'upstash',timezone:'Africa/Nairobi',totals:{...decode(result[0]),visitors:Number(result[1])},daily:days.map((day,i)=>({day,...decode(result[2+i*2]),visitors:Number(result[3+i*2])}))};
    }
  };
}

// Local development only. Never use instance-local files for Vercel counters.
export function createLocalStore(file){
  let queue=Promise.resolve();const rate=new Map();
  const empty=()=>({totals:zeros(),visitors:{},sessions:{},events:{},games:{},daily:{}});
  const read=async()=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return empty();throw e;}};
  const serial=fn=>{const work=queue.then(fn);queue=work.catch(()=>{});return work;};
  return {
    async allow(key){const now=Date.now();for(const [k,v] of rate)if(v.until<now)rate.delete(k);const r=rate.get(key)||{n:0,until:now+60000};rate.set(key,r);return ++r.n<=120;},
    record(e,now=Date.now()){return serial(async()=>{
      const state=await read(),day=dayAt(now),cutoff=now-RETENTION*1000,key=e.type+':'+e.id;
      for(const group of [state.events,state.sessions,state.games])for(const [k,v] of Object.entries(group))if(v.at<cutoff)delete group[k];
      for(const d of Object.keys(state.daily))if(d<dayAt(cutoff))delete state.daily[d];
      if(state.events[key]||e.type==='game_completed'&&state.games[e.id]?.mode!==e.mode)return 0;
      state.events[key]={at:now};const daily=state.daily[day]||={...zeros(),visitors:{}};
      const inc=f=>{state.totals[f]++;daily[f]++;};
      if(e.type==='page_view'){
        inc('pageViews');if(!state.sessions[e.sessionId]){inc('visits');state.sessions[e.sessionId]={at:now};}
        state.visitors[e.visitorId]=true;daily.visitors[e.visitorId]=true;
      }else if(e.type==='game_started'){
        state.games[e.id]={at:now,mode:e.mode};inc('gamesStarted');inc(e.mode==='ai'?'aiGames':'localGames');
      }else inc('gamesCompleted');
      await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',JSON.stringify(state));await rename(file+'.tmp',file);return 1;
    });},
    stats(now=Date.now()){return serial(async()=>{
      const state=await read();return {storage:'local',timezone:'Africa/Nairobi',totals:{...state.totals,visitors:Object.keys(state.visitors).length},daily:Array.from({length:30},(_,i)=>{
        const day=dayAt(now-(29-i)*86400000),row=state.daily[day];return {day,...zeros(),...row,visitors:Object.keys(row?.visitors||{}).length};
      })};
    });}
  };
}

let defaultStore;
export function getStore(){
  if(defaultStore)return defaultStore;
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(url&&token){if(!url.startsWith('https://'))throw Error('Redis REST URL must use HTTPS');return defaultStore=createRedisStore({url,token});}
  if(process.env.VERCEL||process.env.NODE_ENV==='production')throw Error('Configure analytics storage');
  return defaultStore=createLocalStore(path.resolve(import.meta.dirname,'../.data/analytics.json'));
}

export function reply(res,status,body){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.end(JSON.stringify(body));}
export async function readBody(req){
  if(req.body!==undefined){const value=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(value)>2048)throw Error('Bad body');return JSON.parse(value);}
  let body='';for await(const part of req){body+=part;if(Buffer.byteLength(body)>2048)throw Error('Bad body');}return JSON.parse(body);
}
export function rateKey(req){return createHash('sha256').update((process.env.ANALYTICS_ADMIN_PASSWORD||'local')+':'+String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0]).digest('hex');}
