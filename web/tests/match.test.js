import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../dist/match.js';
import {getAllAvailableLines,getScores,isGameOver,createBoardWithBorder,drawLine} from '../dist/gameLogic.js';

function setup(config={}){
  const pending=new Map();let id=0;
  const match=new Match({setTimer:fn=>{pending.set(++id,fn);return id;},clearTimer:key=>pending.delete(key)});
  const tick=()=>{assert.equal(pending.size,1);const [key,fn]=pending.entries().next().value;pending.delete(key);fn();};
  match.start({mode:'ai',difficulty:'medium',first:0,...config});return {match,pending,tick};
}
test('Human non-capture automatically schedules computer; human cannot play its turn',()=>{
  const {match,pending,tick}=setup();
  assert.ok(match.play({type:'h',row:3,col:3}));assert.equal(match.turn,1);assert.equal(pending.size,1);
  assert.equal(match.play(getAllAvailableLines(match.board)[0]),false);
  tick();assert.equal(match.moves[1].player,1);assert.equal(match.moves[1].captured,1);
  assert.equal(match.turn,0);assert.equal(pending.size,0);
  while(match.isComputerTurn())tick();assert.equal(match.turn,0);assert.equal(pending.size,0);
});
for(const difficulty of ['easy','medium','hard'])for(const first of [0,1])test(`Full automatic opponent match: ${difficulty}, starts ${first}`,()=>{
  const {match,pending,tick}=setup({difficulty,first});let steps=0;
  while(!isGameOver(match.board)){
    assert.ok(++steps<=36);
    if(match.isComputerTurn())tick();else assert.ok(match.play(getAllAvailableLines(match.board)[0]));
  }
  assert.equal(getScores(match.board).reduce((a,b)=>a+b),25);
  assert.ok(match.moves.some(m=>m.player===1));assert.equal(pending.size,0);
  for(let i=1;i<match.moves.length;i++)assert.notEqual(match.moves[i].player,match.moves[i-1].player);
});
test('Restart invalidates an old computer callback, including switching to local',()=>{
  const {match,pending}=setup();match.play({type:'h',row:3,col:3});
  const stale=[...pending.values()][0];match.start({mode:'local',first:0});const board=match.board;stale();
  assert.equal(match.board,board);assert.equal(match.moves.length,0);assert.equal(pending.size,0);
});
test('Undo during thinking cancels computer and restores human move',()=>{
  const {match,pending}=setup();const board=match.board;match.play({type:'h',row:3,col:3});match.undo();
  assert.equal(match.board,board);assert.equal(match.turn,0);assert.equal(match.moves.length,0);assert.equal(pending.size,0);
});
test('Undo after computer captures restores human decision, not computer turn',()=>{
  const {match,tick,pending}=setup();const board=match.board;match.play({type:'h',row:3,col:3});
  while(match.isComputerTurn())tick();assert.ok(getScores(match.board)[1]>0);match.undo();
  assert.equal(match.board,board);assert.equal(match.turn,0);assert.equal(pending.size,0);assert.equal(match.moves.length,0);
});
test('Human capture passes to computer, whose capture passes back',()=>{
  const {match,pending,tick}=setup();
  assert.ok(match.play({type:'h',row:1,col:3}));assert.equal(match.moves[0].captured,1);
  assert.deepEqual(getScores(match.board),[1,0]);assert.equal(match.turn,1);assert.equal(pending.size,1);
  tick();assert.equal(match.moves[1].captured,1);assert.equal(match.turn,0);assert.equal(pending.size,0);
});
test('Local capture passes to the other player without scheduling AI',()=>{
  const {match,pending}=setup({mode:'local'});
  match.play({type:'h',row:1,col:3});assert.equal(match.turn,1);assert.equal(pending.size,0);
  match.play({type:'v',row:3,col:1});assert.equal(match.turn,0);assert.equal(pending.size,0);
  assert.deepEqual(getScores(match.board),[1,1]);
});
test('Capturing two boxes still passes the turn',()=>{
  const {match,pending}=setup();let b=createBoardWithBorder(2,2);
  b=drawLine(b,{type:'h',row:1,col:0},0).newBoard;b=drawLine(b,{type:'h',row:1,col:1},1).newBoard;
  match.board=b;match.play({type:'v',row:0,col:1});assert.equal(match.moves[0].captured,2);
  assert.deepEqual(getScores(match.board),[2,0]);assert.equal(match.turn,1);assert.equal(pending.size,1);
});
