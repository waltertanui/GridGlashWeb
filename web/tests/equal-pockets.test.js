import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDiamondBoard,drawLine,getScores,isGameOver,createBoardWithBorder} from '../dist/gameLogic.js';

// Reproduce the 2–3 position before the reported red horizontal line.
// The green upper/right pocket and the lower/left remainder each have ten
// unclaimed cells. They must not both be given to the closing player.
function reportedPosition(){
  const board=createDiamondBoard();
  const green=[[1,2],[1,3],[1,4],[2,3],[2,4],[2,5],[3,5],[4,4],[4,5],[5,4]];
  const missing={type:'h',row:2,col:2};
  const owned=[[[0,3],[3,6]],[[3,0],[3,1],[6,3]]];
  const wall=(type,r,c,owner=1)=>{
    board[type==='h'?'hLines':'vLines'][r][c]=true;
    board[type==='h'?'hLineOwner':'vLineOwner'][r][c]=owner;
  };
  for(let owner=0;owner<2;owner++)for(const [r,c] of owned[owner]){
    board.boxes[r][c]=owner;wall('h',r,c,owner);wall('h',r+1,c,owner);wall('v',r,c,owner);wall('v',r,c+1,owner);
  }
  const inside=new Set(green.map(p=>p.join(',')));
  for(const [r,c] of green)for(const [nr,nc,type,row,col] of [[r-1,c,'h',r,c],[r+1,c,'h',r+1,c],[r,c-1,'v',r,c],[r,c+1,'v',r,c+1]]){
    if(inside.has(nr+','+nc)||type===missing.type&&row===missing.row&&col===missing.col)continue;
    if(!board[type==='h'?'hLines':'vLines'][row][col])wall(type,row,col);
  }
  return {board,green,missing};
}
test('Red closing line awards the green ten-box pocket, not all twenty remaining boxes',()=>{
  const {board,green,missing}=reportedPosition();assert.deepEqual(getScores(board),[2,3]);
  const result=drawLine(board,missing,1);
  assert.equal(result.claimedBoxes,10);assert.deepEqual(getScores(result.newBoard),[2,13]);
  for(const [r,c] of green)assert.equal(result.newBoard.boxes[r][c],1);
  let remaining=0;for(let r=0;r<7;r++)for(let c=0;c<7;c++)if(board.shapeMask[r][c]&&result.newBoard.boxes[r][c]===null)remaining++;
  assert.equal(remaining,10);assert.equal(isGameOver(result.newBoard),false);assert.deepEqual(getScores(board),[2,3]);
});
test('Closing equal two-box areas awards one side, not all four boxes',()=>{
  const board=createBoardWithBorder(2,2);board.hLines[1][0]=true;board.hLineOwner[1][0]=0;
  const result=drawLine(board,{type:'h',row:1,col:1},1);
  assert.equal(result.claimedBoxes,2);assert.deepEqual(getScores(result.newBoard),[0,2]);assert.equal(isGameOver(result.newBoard),false);
});
test('A line completing two individual boxes still awards both once',()=>{
  const board=createBoardWithBorder(2,2);board.hLines[1][0]=board.hLines[1][1]=true;
  const result=drawLine(board,{type:'v',row:0,col:1},0);
  assert.equal(result.claimedBoxes,2);assert.deepEqual(getScores(result.newBoard),[2,0]);
});
