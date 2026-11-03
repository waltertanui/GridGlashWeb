import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBoardWithBorder,drawLine,getScores} from '../dist/gameLogic.js';
import {Match} from '../dist/match.js';

for(const [smaller,larger] of [[2,3],[3,4]])for(const axis of ['h','v'])test(`${smaller} vs ${larger}, ${axis}: only the ${larger}-point side is awarded`,()=>{
  const size=smaller+larger;
  const board=axis==='v'?createBoardWithBorder(1,size):createBoardWithBorder(size,1);
  const pos=axis==='v'?{type:'v',row:0,col:smaller}:{type:'h',row:smaller,col:0};
  const result=drawLine(board,pos,0);
  assert.equal(result.claimedBoxes,larger);assert.deepEqual(getScores(result.newBoard),[larger,0]);
  for(let i=0;i<size;i++)assert.equal(axis==='v'?result.newBoard.boxes[0][i]:result.newBoard.boxes[i][0],i<smaller?null:0);
  assert.deepEqual(getScores(board),[0,0]);
});
test('Choose points available, not total geometric size or previously claimed cells',()=>{
  const board=createBoardWithBorder(1,7);board.boxes[0][5]=1;board.boxes[0][6]=1;
  const result=drawLine(board,{type:'v',row:0,col:3},0);
  assert.equal(result.claimedBoxes,3);assert.deepEqual(getScores(result.newBoard),[3,2]);
  assert.equal(result.newBoard.boxes[0][3],null);assert.equal(result.newBoard.boxes[0][4],null);
  assert.equal(result.newBoard.boxes[0][5],1);assert.equal(result.newBoard.boxes[0][6],1);
});
test('Highest-side capture passes the turn; undo restores both sides',()=>{
  const match=new Match();match.start({mode:'local',first:0});const board=createBoardWithBorder(1,7);match.board=board;
  match.play({type:'v',row:0,col:3});assert.equal(match.turn,1);assert.equal(match.moves.at(-1).captured,4);
  match.undo();assert.equal(match.board,board);assert.equal(match.turn,0);assert.deepEqual(getScores(match.board),[0,0]);
});
