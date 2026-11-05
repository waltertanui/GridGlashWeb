import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {OnlineMatch} from '../dist/online.js';
import {createRoomService,createMemoryRoomStore} from '../lib/multiplayer.js';
import {getAllAvailableLines} from '../dist/gameLogic.js';
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};};
test('Two clients reconnect with saved seats and cannot double-submit while a move is pending',async()=>{
 const service=createRoomService(createMemoryRoomStore(),{random:()=>0});let release,hold=false;
 const fetchImpl=async(url,{body})=>{const input=JSON.parse(body);if(hold&&input.action==='move')await new Promise(resolve=>release=resolve);try{return {ok:true,json:async()=>await service.act(input)};}catch(e){return {ok:false,status:e.status,json:async()=>({error:e.message})};}};
 const storage=memory(),host=new OnlineMatch({fetchImpl,storage}),guest=new OnlineMatch({fetchImpl,storage:memory()});host.poll=guest.poll=()=>{};
 await host.connect('create',{name:'Host'});await guest.connect('join',{room:host.state.id,name:'Friend'});
 host.apply(await service.act({action:'state',room:host.state.id,token:host.token}));
 hold=true;const pending=host.play(getAllAvailableLines(host.board)[0]);await host.play(getAllAvailableLines(host.board)[1]);assert.equal(host.busy,true);release();await pending;hold=false;
 assert.equal(host.moves.length,1);assert.equal(host.turn,1);
 const restored=new OnlineMatch({fetchImpl,storage});restored.poll=()=>{};await restored.connect('join',{room:host.state.id,name:'Unused'});
 assert.equal(restored.state.seat,0);assert.deepEqual(restored.board,host.board);assert.equal(restored.moves.length,1);
 host.cancel();guest.cancel();restored.cancel();
});
test('Late room response after leaving never restores the room',async()=>{
 let release;const service=createRoomService(createMemoryRoomStore());
 const online=new OnlineMatch({storage:memory(),fetchImpl:async(url,{body})=>{const state=await service.act(JSON.parse(body));await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>state};}});online.poll=()=>{};
 const pending=online.connect('create',{name:'Host'});while(!release)await new Promise(resolve=>setImmediate(resolve));online.cancel();release();await pending;assert.equal(online.state,null);
});
