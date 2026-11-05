import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRoomService,createMemoryRoomStore,createRedisRoomStore} from '../lib/multiplayer.js';
import {getAllAvailableLines,getScores,isGameOver} from '../dist/gameLogic.js';
import {createRoomHandler} from '../api/room.js';
const token=()=>randomBytes(32).toString('hex');
async function pair(){const store=createMemoryRoomStore(),service=createRoomService(store,{random:()=>0.1}),host=await service.act({action:'create',name:'Host'}),guestToken=token(),guest=await service.act({action:'join',room:host.id,token:guestToken,name:'Friend'});return {store,service,host,guest,keys:[host.token,guestToken]};}
test('Private rooms hide credentials, reject outsiders and reserve exactly two seats',async()=>{
 const {service,host,guest,keys}=await pair();assert.equal(guest.ready,true);assert.equal(guest.seat,1);assert.equal(guest.token,undefined);assert.equal(guest.players,undefined);assert.ok(!JSON.stringify(guest).includes(keys[0]));
 await assert.rejects(service.act({action:'state',room:host.id,token:token()}),{status:403});
 await assert.rejects(service.act({action:'join',room:host.id,token:token()}),{status:409});
 const rejoined=await service.act({action:'join',room:host.id,token:keys[0]});assert.equal(rejoined.seat,0);
 await assert.rejects(service.act({action:'state',room:'0000000000000000',token:keys[0]}),{status:404});
});
test('Waiting room cannot move, guest join retries are safe, and simultaneous joins get one seat',async()=>{
 const service=createRoomService(createMemoryRoomStore());const host=await service.act({action:'create'});
 await assert.rejects(service.act({action:'move',room:host.id,token:host.token}),{status:409});
 const a=token(),b=token();const joined=await Promise.allSettled([a,b].map(t=>service.act({action:'join',room:host.id,token:t})));
 assert.equal(joined.filter(r=>r.status==='fulfilled').length,1);
 const winner=joined[0].status==='fulfilled'?a:b;assert.equal((await service.act({action:'join',room:host.id,token:winner})).seat,1);
});
test('Server enforces turn, legal lines, version and duplicate-move safety',async()=>{
 const {service,host,guest,keys}=await pair();const pos=getAllAvailableLines(guest.board)[0];
 const move={action:'move',room:host.id,token:keys[0],version:guest.version,pos,moveId:randomUUID()};
 await assert.rejects(service.act({...move,token:keys[1]}),{status:409});
 await assert.rejects(service.act({...move,pos:{type:'h',row:-1,col:3}}),{status:400});
 await assert.rejects(service.act({...move,pos:{type:'h',row:0,col:0}}),{status:409});
 const results=await Promise.all([service.act(move),service.act(move)]);assert.equal(results[0].moves.length,1);assert.equal(results[1].moves.length,1);
 const state=await service.act({action:'state',room:host.id,token:keys[1]});assert.equal(state.turn,1);assert.deepEqual(state.board,results[0].board);
 await assert.rejects(service.act({...move,token:keys[1],moveId:randomUUID()}),{status:409});
});
test('Three complete online games preserve alternating turns and require both rematch votes',async()=>{
 const {service,host,keys}=await pair();let state=await service.act({action:'state',room:host.id,token:keys[0]});
 for(let round=1;round<=3;round++){
  let n=0;while(!isGameOver(state.board)){
   const player=state.turn;state=await service.act({action:'move',room:host.id,token:keys[player],version:state.version,pos:getAllAvailableLines(state.board)[0],moveId:randomUUID()});assert.equal(state.turn,1-player);assert.ok(++n<=36);
  }
  assert.equal(getScores(state.board).reduce((a,b)=>a+b),25);assert.equal(state.round,round);
  const first=await service.act({action:'rematch',room:host.id,token:keys[0]});assert.equal(first.round,round);assert.ok(isGameOver(first.board));
  state=await service.act({action:'rematch',room:host.id,token:keys[1]});assert.equal(state.round,round+1);assert.equal(state.moves.length,0);assert.deepEqual(getScores(state.board),[0,0]);
 }
});
test('Redis storage uses atomic version checks, expiry and server-only credentials',async()=>{
 const commands=[];const store=createRedisRoomStore({url:'https://redis.example',token:'secret',fetchImpl:async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer secret');commands.push(JSON.parse(options.body));return {ok:true,json:async()=>({result:1})};}});
 assert.equal(await store.cas('room',4,{version:5}),true);const cmd=commands[0];assert.equal(cmd[0],'EVAL');assert.ok(cmd[1].includes('cjson.decode'));assert.equal(cmd.at(-1),'86400');
});
test('Room API rejects bad JSON, cross-origin requests and methods',async()=>{
 const handler=createRoomHandler(()=>createMemoryRoomStore());
 async function request(method,body,origin){const req={method,body,headers:{host:'game.test','content-type':'application/json',...(origin?{origin}:{})}};const res={setHeader(){},end(value){this.body=JSON.parse(value);}};await handler(req,res);return res;}
 assert.equal((await request('GET',{})).statusCode,405);assert.equal((await request('POST','bad')).statusCode,400);assert.equal((await request('POST',{action:'create'},'https://other.test')).statusCode,403);
 assert.equal((await request('POST',{action:'create'},'https://game.test')).statusCode,200);
});
