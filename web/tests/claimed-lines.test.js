import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBoardWithBorder,isLineAvailable,getAllAvailableLines,getAIMove,drawLine} from '../dist/gameLogic.js';
for(const type of ['h','v']) test(`Block ${type} moves between awarded boxes`,()=>{
 const b=createBoardWithBorder(2,2);b.boxes[0][0]=0;
 if(type==='h')b.boxes[1][0]=1;else b.boxes[0][1]=1;
 const p={type,row:type==='h'?1:0,col:type==='h'?0:1};
 assert.equal(isLineAvailable(b,p),false);
 assert.ok(!getAllAvailableLines(b).some(m=>m.type===p.type&&m.row===p.row&&m.col===p.col));
 assert.equal(drawLine(b,p,1).newBoard,b);
 for(const d of ['easy','medium','hard'])for(let i=0;i<10;i++){
  const m=getAIMove(b,d);assert.ok(m);assert.ok(isLineAvailable(b,m));assert.notDeepEqual(m,p);
 }
});
test('Keep lines bordering unclaimed boxes playable',()=>{
 const b=createBoardWithBorder(2,2);b.boxes[0][0]=0;
 assert.ok(isLineAvailable(b,{type:'h',row:1,col:0}));
 assert.ok(isLineAvailable(b,{type:'v',row:0,col:1}));
});
