import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createLocalStore,createRedisStore,dayAt,getStore} from '../lib/analytics.js';
import {createTracker} from '../dist/analytics.js';
import {createEventsHandler} from '../api/events.js';
import {createStatsHandler} from '../api/stats.js';
import {Match} from '../dist/match.js';
import {getAllAvailableLines,isGameOver} from '../dist/gameLogic.js';

const fakeStorage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const event=(type='page_view',extra={})=>({type,id:randomUUID(),visitorId:randomUUID(),sessionId:randomUUID(),...extra});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=JSON.parse(body);}});
async function temporary(fn){const folder=await mkdtemp(path.join(os.tmpdir(),'gridclash-analytics-'));try{return await fn(path.join(folder,'analytics.json'));}finally{await rm(folder,{recursive:true,force:true});}}

test('Visit refreshes, duplicate events, real starts and completions are counted separately',()=>temporary(async file=>{
  const store=createLocalStore(file),visit=event(),game=event('game_started',{visitorId:visit.visitorId,sessionId:visit.sessionId,mode:'ai'});
  await Promise.all([store.record(visit),store.record(visit)]);
  await store.record({...visit,id:randomUUID()});
  await store.record({...game,type:'game_completed'}); // No start yet: cannot invent a completion.
  await store.record(game);await store.record(game);await store.record({...game,type:'game_completed'});await store.record({...game,type:'game_completed'});
  const stats=await createLocalStore(file).stats();
  assert.deepEqual(stats.totals,{pageViews:2,visits:1,gamesStarted:1,gamesCompleted:1,aiGames:1,localGames:0,visitors:1});
  assert.equal(stats.daily.length,30);assert.equal(stats.daily.at(-1).gamesCompleted,1);
}));
test('Parallel local visitors persist without lost updates; public stats contain no identifiers',()=>temporary(async file=>{
  const store=createLocalStore(file);const visits=Array.from({length:20},()=>event());await Promise.all(visits.map(e=>store.record(e)));
  const stats=await store.stats();assert.equal(stats.totals.pageViews,20);assert.equal(stats.totals.visitors,20);
  assert.ok(!JSON.stringify(stats).includes(visits[0].visitorId));assert.equal(typeof stats.daily.at(-1).visitors,'number');
}));
test('Daily activity switches at midnight Nairobi time',()=>temporary(async file=>{
  const store=createLocalStore(file),before=Date.parse('2026-10-29T20:59:00Z'),after=before+120000;
  assert.equal(dayAt(before),'2026-10-29');assert.equal(dayAt(after),'2026-10-30');
  await store.record(event(),before);await store.record(event(),after);const stats=await store.stats(after);
  assert.equal(stats.daily.at(-2).pageViews,1);assert.equal(stats.daily.at(-1).pageViews,1);
}));
test('Client tracks first move, completed game and replay once; sends no names',async()=>{
  const sent=[],tracker=createTracker({local:fakeStorage(),session:fakeStorage(),fetchImpl:async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true};}});
  await tracker.visit();const game=tracker.newGame();game.observe({hasMoves:false,finished:false,mode:'ai'});
  assert.equal(sent.length,1);game.observe({hasMoves:true,finished:false,mode:'ai'});game.observe({hasMoves:true,finished:true,mode:'ai'});
  game.observe({hasMoves:true,finished:false,mode:'ai'});game.observe({hasMoves:true,finished:true,mode:'ai'});await tracker.flush();
  assert.deepEqual(sent.map(e=>e.type),['page_view','game_started','game_completed']);assert.equal(sent[1].id,sent[2].id);
  assert.deepEqual(Object.keys(sent[1]).sort(),['id','mode','sessionId','type','visitorId']);
});
test('A complete real match produces exactly one analytics start and completion',async()=>{
  const sent=[],tracker=createTracker({local:fakeStorage(),session:fakeStorage(),fetchImpl:async(_,options)=>{sent.push(JSON.parse(options.body));return {ok:true};}});
  const game=tracker.newGame();const match=new Match({onChange:m=>game.observe({hasMoves:m.moves.length>0,finished:isGameOver(m.board),mode:m.config.mode})});
  match.start({mode:'local',first:0});assert.equal(sent.length,0);
  while(!isGameOver(match.board))match.play(getAllAvailableLines(match.board)[0]);
  match.undo();match.play(getAllAvailableLines(match.board)[0]);await tracker.flush();
  assert.deepEqual(sent.map(e=>e.type),['game_started','game_completed']);
});
test('Visitor opt-out stops all requests; analytics failures do not break matches',async()=>{
  const local=fakeStorage();local.setItem('gridclash-analytics-disabled','1');let calls=0;
  const tracker=createTracker({local,session:fakeStorage(),fetchImpl:async()=>{calls++;throw Error('offline');}});
  await tracker.visit();assert.equal(calls,0);tracker.enable();await tracker.visit();assert.equal(calls,2);
  tracker.disable();await tracker.visit();assert.equal(calls,2);assert.equal(local.getItem('gridclash-visitor'),null);
});
test('Retry sends the same event ID; refreshed tabs keep their browser and session IDs',async()=>{
  const sent=[],local=fakeStorage(),session=fakeStorage();let attempt=0;
  const fetchImpl=async(_,options)=>{sent.push(JSON.parse(options.body));return {ok:++attempt!==1,status:attempt===1?503:200};};
  await createTracker({local,session,fetchImpl}).visit();await createTracker({local,session,fetchImpl}).visit();
  assert.equal(sent[0].id,sent[1].id);assert.notEqual(sent[1].id,sent[2].id);assert.equal(sent[0].visitorId,sent[2].visitorId);assert.equal(sent[0].sessionId,sent[2].sessionId);
});
test('Statistics require the secret on every request and are not cached',async()=>{
  const password='a-test-only-secret-longer-than-20';let reads=0;
  const handler=createStatsHandler({password:()=>password,storeProvider:()=>({stats:async()=>{reads++;return {totals:{visits:3}};}})});
  for(const authorization of [undefined,'Bearer wrong']){const res=response();await handler({method:'GET',headers:{authorization}},res);assert.equal(res.statusCode,401);}
  assert.equal(reads,0);const res=response();await handler({method:'GET',headers:{authorization:'Bearer '+password}},res);
  assert.equal(res.statusCode,200);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(reads,1);assert.ok(!JSON.stringify(res).includes(password));
});
test('Events reject invalid IDs, cross-origin submissions, unsupported methods and rate limits',async()=>{
  let recorded=0,allowed=true;const handler=createEventsHandler(()=>({allow:async()=>allowed,record:async()=>{recorded++;}}));
  const request=(body=event())=>({method:'POST',headers:{host:'game.test','content-type':'application/json',origin:'https://game.test'},body});
  let res=response();await handler(request({...event(),id:'invalid'}),res);assert.equal(res.statusCode,400);
  res=response();const cross=request();cross.headers.origin='https://unrelated.test';await handler(cross,res);assert.equal(res.statusCode,403);
  res=response();await handler({...request(),method:'GET'},res);assert.equal(res.statusCode,405);
  res=response();allowed=false;await handler(request(),res);assert.equal(res.statusCode,429);assert.equal(recorded,0);
  res=response();allowed=true;await handler(request(),res);assert.equal(res.statusCode,200);assert.equal(recorded,1);
});
test('Vercel without Redis never falls back to temporary local storage',()=>{
  const saved={VERCEL:process.env.VERCEL,UPSTASH_REDIS_REST_URL:process.env.UPSTASH_REDIS_REST_URL,UPSTASH_REDIS_REST_TOKEN:process.env.UPSTASH_REDIS_REST_TOKEN};
  try{process.env.VERCEL='1';delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;assert.throws(()=>getStore(),/Configure analytics storage/);}
  finally{for(const [key,value] of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
test('Redis transport keeps credentials in headers and surfaces storage failures',async()=>{
  let captured;
  const store=createRedisStore({url:'https://redis.test',token:'test-only-token',fetchImpl:async(url,options)=>{captured={url,options};return {ok:true,json:async()=>({result:1})};}});
  await store.record(event());assert.equal(captured.url,'https://redis.test');assert.equal(captured.options.headers.Authorization,'Bearer test-only-token');
  assert.equal(JSON.parse(captured.options.body)[0],'EVAL');assert.ok(!captured.options.body.includes('test-only-token'));
  const failed=createRedisStore({url:'https://redis.test',token:'test',fetchImpl:async()=>({ok:false})});await assert.rejects(()=>failed.record(event()),/unavailable/);
});
