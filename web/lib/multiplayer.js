import {randomBytes,createHash} from 'node:crypto';
import {createDiamondBoard,drawLine,isGameOver} from '../dist/gameLogic.js';

export const ROOM_TTL=86400;
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const name=value=>String(value||'Player').trim().slice(0,16)||'Player';
const roomPattern=/^[a-f0-9]{16}$/;
const tokenPattern=/^[a-f0-9]{64}$/;
export function createRoomService(store,{random=Math.random}={}){
  const view=(room,seat)=>({id:room.id,version:room.version,seat,board:room.board,turn:room.turn,starter:room.starter,names:room.players.map(p=>p?.name||'Waiting for friend'),ready:!!room.players[1],moves:room.moves,round:room.round,rematch:room.rematch});
  return {async act(input){
    if(!input||!['create','join','state','move','rematch'].includes(input.action))fail(400,'Unknown room action');
    if(input.action==='create'){
      const id=randomBytes(8).toString('hex'),token=randomBytes(32).toString('hex'),starter=random()<0.5?0:1;
      const room={id,version:0,board:createDiamondBoard(),turn:starter,starter,players:[{name:name(input.name),key:hash(token)},null],moves:[],round:1,rematch:[]};
      if(!await store.cas(id,null,room))fail(503,'Please create a room again');
      return {...view(room,0),token};
    }
    if(!roomPattern.test(input.room||''))fail(400,'Enter a valid room code');
    for(let attempt=0;attempt<8;attempt++){
      const room=await store.get(input.room);
      if(!room)fail(404,'Room expired or not found. Create a new room.');
      let seat=tokenPattern.test(input.token||'')?room.players.findIndex(p=>p?.key===hash(input.token)):-1;
      if(input.action==='join'){
        if(seat>=0)return view(room,seat);
        if(room.players[1])fail(409,'This room already has two players');
        // The joining browser generates its own credential, making retries safe.
        if(!tokenPattern.test(input.token||''))fail(400,'Missing player credential');
        room.players[1]={name:name(input.name),key:hash(input.token)};seat=1;
      }else{
        if(seat<0)fail(403,'Rejoin using the browser that joined this room');
        if(input.action==='state')return view(room,seat);
        if(!room.players[1])fail(409,'Wait for your friend to join');
        if(input.action==='move'){
          if(room.moves.some(m=>m.id===input.moveId&&m.player===seat))return view(room,seat);
          if(!/^[a-f0-9-]{36}$/.test(input.moveId||''))fail(400,'Invalid move identifier');
          if(input.version!==room.version)fail(409,'Board changed. Try your move again.');
          if(room.turn!==seat)fail(409,'It is your friend’s turn');
          const pos=input.pos;
          if(!pos||!['h','v'].includes(pos.type)||!Number.isInteger(pos.row)||!Number.isInteger(pos.col)||pos.row<0||pos.col<0||pos.row>=room.board.rows+(pos.type==='h'?1:0)||pos.col>=room.board.cols+(pos.type==='v'?1:0))fail(400,'Invalid line');
          const result=drawLine(room.board,pos,seat);
          if(result.newBoard===room.board)fail(409,'That line is unavailable');
          room.board=result.newBoard;room.turn=1-seat;
          room.moves.push({...pos,player:seat,captured:result.claimedBoxes,id:input.moveId});
        }else{
          if(!isGameOver(room.board))fail(409,'Finish this game before requesting a rematch');
          if(!room.rematch.includes(seat))room.rematch.push(seat);
          else return view(room,seat);
          if(room.rematch.length===2){room.board=createDiamondBoard();room.moves=[];room.rematch=[];room.round++;room.starter=random()<0.5?0:1;room.turn=room.starter;}
        }
      }
      const version=room.version;room.version++;
      if(await store.cas(room.id,version,room))return view(room,seat);
    }
    fail(409,'Room is updating. Please try again.');
  }};
}

export function createMemoryRoomStore(){
  const rooms=new Map(),rates=new Map();
  return {async get(id){const item=rooms.get(id);if(!item||item.expires<Date.now()){rooms.delete(id);return null;}return structuredClone(item.room);},async cas(id,version,room){const old=rooms.get(id);if(version===null?!!old:old?.room.version!==version)return false;rooms.set(id,{room:structuredClone(room),expires:Date.now()+ROOM_TTL*1000});return true;},async allow(key){const now=Date.now();for(const [k,v] of rates)if(v.until<now)rates.delete(k);const r=rates.get(key)||{n:0,until:now+60000};rates.set(key,r);return ++r.n<=100;}};
}
export function createRedisRoomStore({url,token,fetchImpl=fetch}){
  const request=async command=>{
    const response=await fetchImpl(url.replace(/\/$/,''),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Room storage unavailable');const result=await response.json();if(result.error)throw Error('Room storage failed');return result.result;
  };
  const key=id=>'gridclash:room:v1:'+id;
  const script="local old=redis.call('GET',KEYS[1]); if ARGV[1]=='new' then if old then return 0 end else if not old or cjson.decode(old).version~=tonumber(ARGV[1]) then return 0 end end; redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3]); return 1";
  return {async get(id){const result=await request(['GET',key(id)]);return result?JSON.parse(result):null;},async cas(id,version,room){return await request(['EVAL',script,1,key(id),version===null?'new':String(version),JSON.stringify(room),String(ROOM_TTL)])===1;},async allow(id){return await request(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",1,'gridclash:room:rate:'+id])<=100;}};
}
let defaultStore;
export function getRoomStore(){
  if(defaultStore)return defaultStore;
  const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(url&&token){if(!url.startsWith('https://'))throw Error('Invalid Redis URL');return defaultStore=createRedisRoomStore({url,token});}
  if(process.env.VERCEL||process.env.NODE_ENV==='production')throw Error('Configure multiplayer storage');
  return defaultStore=createMemoryRoomStore();
}
