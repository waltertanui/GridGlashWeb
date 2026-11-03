import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDiamondBoard,drawLine,getScores,getAIMove,isGameOver,getAllAvailableLines,createBoardWithBorder} from '../dist/gameLogic.js';
import {Match} from '../dist/match.js';

function rectangle(r,c,height,width){
  const edges=[];
  for(let x=c;x<c+width;x++)edges.push({type:'h',row:r,col:x},{type:'h',row:r+height,col:x});
  for(let y=r;y<r+height;y++)edges.push({type:'v',row:y,col:c},{type:'v',row:y,col:c+width});
  return edges;
}
function prepare(edges,missing=edges.at(-1)){
  const board=createDiamondBoard();
  for(const [i,p] of edges.entries()){
    if(p.type===missing.type&&p.row===missing.row&&p.col===missing.col)continue;
    board[p.type==='h'?'hLines':'vLines'][p.row][p.col]=true;
    board[p.type==='h'?'hLineOwner':'vLineOwner'][p.row][p.col]=i%2;
  }
  return {board,missing};
}
test('Closing a four-box loop awards all four without drawing internal lines',()=>{
  const {board,missing}=prepare(rectangle(2,2,2,2));
  const result=drawLine(board,missing,0);
  assert.equal(result.claimedBoxes,4);assert.deepEqual(getScores(result.newBoard),[4,0]);
  assert.equal(result.newBoard.hLines[3][2],false);assert.equal(result.newBoard.vLines[2][3],false);
  assert.deepEqual(getScores(board),[0,0]);assert.equal(board.vLines[missing.row][missing.col],false);
});
test('An open loop and the neutral starting border do not award the whole board',()=>{
  const edges=rectangle(2,2,2,2),{board,missing}=prepare(edges);
  board.hLines[2][2]=false;board.hLineOwner[2][2]=null;
  assert.equal(drawLine(board,missing,0).claimedBoxes,0);
  const fresh=drawLine(createDiamondBoard(),{type:'h',row:3,col:3},0);
  assert.equal(fresh.claimedBoxes,0);
});
test('Closed six-cell loop awards five new points and leaves the main field unclaimed',()=>{
  const {board,missing}=prepare(rectangle(2,2,3,2));board.boxes[3][3]=1;
  const result=drawLine(board,missing,0);
  assert.equal(result.claimedBoxes,5);assert.deepEqual(getScores(result.newBoard),[5,1]);
  assert.equal(result.newBoard.boxes[3][3],1);
});
test('The fourth side of a single box is counted once, including inside a loop',()=>{
  const {board,missing}=prepare(rectangle(2,2,1,1));const result=drawLine(board,missing,1);
  assert.equal(result.claimedBoxes,1);assert.deepEqual(getScores(result.newBoard),[0,1]);
});
test('Computer chooses the three-point area instead of a single corner',()=>{
  for(const level of ['medium','hard']){
    const board=createBoardWithBorder(1,5);const move=getAIMove(board,level);
    assert.equal(drawLine(board,move,1).claimedBoxes,3);
  }
});
test('Enclosure ends the game when all boxes are owned, despite undrawn interior lines',()=>{
  const {board,missing}=prepare(rectangle(2,2,2,2));
  for(let r=0;r<7;r++)for(let c=0;c<7;c++)if(board.shapeMask[r][c]&&!(r>=2&&r<4&&c>=2&&c<4))board.boxes[r][c]=1;
  const result=drawLine(board,missing,0);assert.equal(result.claimedBoxes,4);
  assert.ok(isGameOver(result.newBoard));assert.deepEqual(getScores(result.newBoard),[4,21]);
  assert.equal(getAllAvailableLines(result.newBoard).length,0);
});
test('Enclosure switches turns; undo restores the entire captured area',()=>{
  const match=new Match();match.start({mode:'local',first:0});const {board,missing}=prepare(rectangle(2,2,2,2));match.board=board;
  assert.ok(match.play(missing));assert.equal(match.turn,1);assert.equal(match.moves.at(-1).captured,4);
  match.undo();assert.equal(match.turn,0);assert.equal(match.board,board);assert.deepEqual(getScores(match.board),[0,0]);
});

// The reported green closing line seals the three upper shoulder boxes and
// the box just below their left end. Much of the perimeter is pre-drawn.
function screenshotPocket(){
  const board=createDiamondBoard(),pocket=[[1,2],[1,3],[1,4],[2,2]],missing={type:'h',row:2,col:4};
  const owned=[[[0,3],[3,6]],[[2,1],[2,3],[3,0],[3,1],[3,2],[3,3],[4,1],[4,3],[6,3]]];
  function wall(type,row,col,owner){board[type==='h'?'hLines':'vLines'][row][col]=true;if(board[type==='h'?'hLineOwner':'vLineOwner'][row][col]===null)board[type==='h'?'hLineOwner':'vLineOwner'][row][col]=owner;}
  for(let owner=0;owner<2;owner++)for(const [r,c] of owned[owner]){
    board.boxes[r][c]=owner;wall('h',r,c,owner);wall('h',r+1,c,owner);wall('v',r,c,owner);wall('v',r,c+1,owner);
  }
  const inside=new Set(pocket.map(p=>p.join(',')));
  for(const [r,c] of pocket)for(const [nr,nc,type,row,col] of [[r-1,c,'h',r,c],[r+1,c,'h',r+1,c],[r,c-1,'v',r,c],[r,c+1,'v',r,c+1]]){
    if(inside.has(nr+','+nc)||type===missing.type&&row===missing.row&&col===missing.col)continue;
    const lines=board[type==='h'?'hLines':'vLines'];if(!lines[row][col])wall(type,row,col,1);
  }
  return {board,pocket,missing};
}
test('Highest-side policy chooses ten points over the opposite four-point pocket',()=>{
  const {board,pocket,missing}=screenshotPocket();assert.deepEqual(getScores(board),[2,9]);
  const result=drawLine(board,missing,0);assert.equal(result.claimedBoxes,10);assert.deepEqual(getScores(result.newBoard),[12,9]);
  for(const [r,c] of pocket)assert.equal(result.newBoard.boxes[r][c],null);
  assert.equal(result.newBoard.hLines[2][2],false);assert.deepEqual(getScores(board),[2,9]);
  const computer=drawLine(result.newBoard,{type:'h',row:2,col:2},1);
  assert.equal(computer.claimedBoxes,1);assert.deepEqual(getScores(computer.newBoard),[12,10]);
});
test('An open border-connected pocket awards nothing before the closing green line',()=>{
  const {board,pocket}=screenshotPocket();
  // Leave a second route open through the lower area.
  board.hLines[3][2]=false;board.hLineOwner[3][2]=null;
  board.hLines[4][2]=false;board.hLineOwner[4][2]=null;
  const result=drawLine(board,{type:'h',row:2,col:4},0);
  assert.equal(result.claimedBoxes,0);for(const [r,c] of pocket)assert.equal(result.newBoard.boxes[r][c],null);
});
test('Border enclosure preserves boxes already owned by the other player',()=>{
  const {board,missing}=screenshotPocket();board.boxes[2][2]=1;
  const result=drawLine(board,missing,0);assert.equal(result.claimedBoxes,10);assert.equal(result.newBoard.boxes[2][2],1);
  assert.deepEqual(getScores(result.newBoard),[12,10]);
});
test('The first corner capture gives one point, not the entire pre-bordered board',()=>{
  const result=drawLine(createDiamondBoard(),{type:'h',row:1,col:3},0);
  assert.equal(result.claimedBoxes,1);assert.deepEqual(getScores(result.newBoard),[1,0]);
});
