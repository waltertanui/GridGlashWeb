import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDiamondBoard,drawLine,getScores,isGameOver,createBoardWithBorder} from '../dist/gameLogic.js';

function fieldAndPocket(){
  const board=createDiamondBoard();
  const wall=(type,r,c,owner=1)=>{board[type==='h'?'hLines':'vLines'][r][c]=true;board[type==='h'?'hLineOwner':'vLineOwner'][r][c]=owner;};
  const owned=[[[0,3],[3,6]],[[3,0],[3,1],[6,3]]];
  for(let owner=0;owner<2;owner++)for(const [r,c] of owned[owner]){
    board.boxes[r][c]=owner;wall('h',r,c,owner);wall('h',r+1,c,owner);wall('v',r,c,owner);wall('v',r,c+1,owner);
  }
  // The two lower-right boxes are closed by h(5,4); the field above them
  // contains an unfinished divider and several open three/four-way junctions.
  wall('h',4,4);wall('h',4,5);wall('v',4,4);wall('h',2,3,0);
  return {board,closing:{type:'h',row:5,col:4}};
}
test('Reported lower-right closure awards two boxes, never the open eighteen-box field',()=>{
  const {board,closing}=fieldAndPocket();assert.deepEqual(getScores(board),[2,3]);
  const result=drawLine(board,closing,1);
  assert.equal(result.claimedBoxes,2);assert.deepEqual(getScores(result.newBoard),[2,5]);
  assert.equal(result.newBoard.boxes[4][4],1);assert.equal(result.newBoard.boxes[4][5],1);
  assert.equal(result.newBoard.boxes[2][3],null);assert.equal(isGameOver(result.newBoard),false);
  assert.deepEqual(getScores(board),[2,3]);
});
test('Closing a corner beside a branching open field still scores one box',()=>{
  const board=createDiamondBoard();const result=drawLine(board,{type:'h',row:1,col:3},0);
  assert.equal(result.claimedBoxes,1);assert.deepEqual(getScores(result.newBoard),[1,0]);
});
test('Main field spanning untouched tips is excluded even without internal divider branches',()=>{
  const board=createDiamondBoard();board.boxes[0][3]=0;board.hLines[1][3]=true;board.hLineOwner[1][3]=0;
  for(const [type,r,c] of [['v',1,4],['h',2,2]]){
    board[type==='h'?'hLines':'vLines'][r][c]=true;board[type==='h'?'hLineOwner':'vLineOwner'][r][c]=1;
  }
  const result=drawLine(board,{type:'h',row:2,col:3},1);
  assert.equal(result.claimedBoxes,2);assert.deepEqual(getScores(result.newBoard),[1,2]);
  assert.equal(result.newBoard.boxes[3][3],null);assert.equal(isGameOver(result.newBoard),false);
});
test('A fully played closed loop still captures nine boxes despite a partial internal divider',()=>{
  const board=createBoardWithBorder(5,5),missing={type:'v',row:3,col:4};
  for(let c=1;c<4;c++)for(const r of [1,4]){board.hLines[r][c]=true;board.hLineOwner[r][c]=0;}
  for(let r=1;r<4;r++)for(const c of [1,4]){if(r===missing.row&&c===missing.col)continue;board.vLines[r][c]=true;board.vLineOwner[r][c]=1;}
  board.hLines[2][2]=true;board.hLineOwner[2][2]=0;
  const result=drawLine(board,missing,1);assert.equal(result.claimedBoxes,9);assert.deepEqual(getScores(result.newBoard),[0,9]);
  assert.equal(result.newBoard.boxes[0][0],null);assert.equal(isGameOver(result.newBoard),false);
});
