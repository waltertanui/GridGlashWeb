import {analytics} from './analytics.js';
import {getAllAvailableLines,getScores,isGameOver,getWinner} from './gameLogic.js';
import {Match} from './match.js?v=alternating-turns-5';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
let board,turn=0,config,gameAnalytics;
const match=new Match({onChange:state=>{board=state.board;turn=state.turn;config=state.config;render();gameAnalytics?.observe({hasMoves:state.moves.length>0,finished:isGameOver(state.board),mode:state.config.mode});}});
const colors=['#b9ef81','#f5b398'];
function svg(tag,attrs,parent=$('board')){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
function start(){gameAnalytics=analytics.newGame();match.start({size:'diamond',mode:$('mode').value,difficulty:$('difficulty').value,first:Number($('first').value),names:[$('p1').value.trim()||'Player 1',$('mode').value==='ai'?'Computer':$('p2').value.trim()||'Player 2']});}
function play(pos){match.play(pos);}
function render(){const root=$('board');root.replaceChildren();const n=board.rows,step=400/n,off=50;const scores=getScores(board),total=board.shapeMask?25:n*n,done=isGameOver(board);$('board-label').textContent=config.size==='diamond'?'DIAMOND BOARD':`${n} × ${n} BOARD`;
for(let i=0;i<2;i++){$('name'+i).textContent=config.names[i];$('score'+i).textContent=scores[i];$('player'+i).classList.toggle('active',turn===i&&!done);$('player'+i).querySelector('.turn-marker').textContent=i===1&&config.mode==='ai'?'THINKING…':'YOUR TURN';}
for(let r=0;r<n;r++)for(let c=0;c<n;c++){const owner=board.boxes[r][c];if(owner!==null){svg('rect',{x:off+c*step+6,y:off+r*step+6,width:step-12,height:step-12,rx:8,fill:colors[owner],opacity:'.16'});const text=svg('text',{x:off+(c+.5)*step,y:off+(r+.5)*step+5,'text-anchor':'middle',fill:colors[owner],'font-size':15,'font-family':'sans-serif'});text.textContent=owner===0?'01':'02';}}
const available=new Set(getAllAvailableLines(board).map(p=>`${p.type}-${p.row}-${p.col}`)),dots=new Set();
for(const type of ['h','v'])for(let r=0;r<(type==='h'?n+1:n);r++)for(let c=0;c<(type==='h'?n:n+1);c++){const adj=type==='h'?[[r-1,c],[r,c]]:[[r,c-1],[r,c]];if(!adj.some(([a,b])=>a>=0&&b>=0&&a<n&&b<n&&(!board.shapeMask||board.shapeMask[a][b])))continue;const x1=off+c*step,y1=off+r*step,x2=x1+(type==='h'?step:0),y2=y1+(type==='v'?step:0),attrs={x1,y1,x2,y2};dots.add(`${x1},${y1}`);dots.add(`${x2},${y2}`);const drawn=type==='h'?board.hLines[r][c]:board.vLines[r][c],owner=type==='h'?board.hLineOwner[r][c]:board.vLineOwner[r][c];if(drawn)svg('line',{...attrs,class:owner===null?'fixed':'played',stroke:owner===null?'#657a67':colors[owner]});else if(available.has(`${type}-${r}-${c}`)){const enabled=!done&&!(config.mode==='ai'&&turn===1),g=svg('g',{class:'edge',role:'button',tabindex:enabled?'0':'-1','aria-label':`${type==='h'?'Horizontal':'Vertical'} line, row ${r+1}, column ${c+1}`,'aria-disabled':String(!enabled)});svg('line',{...attrs,class:'rail'},g);svg('line',{...attrs,class:'hit'},g);g.addEventListener('click',()=>play({type,row:r,col:c}));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();play({type,row:r,col:c});}});}}
for(const dot of dots){const [cx,cy]=dot.split(',');svg('circle',{cx,cy,r:4.7,fill:'#dbe5d8','pointer-events':'none'});}
const count=scores[0]+scores[1];$('claimed').textContent=`${count} of ${total} boxes claimed`;$('progress').style.width=`${count/total*100}%`;$('undo').disabled=config.mode==='ai'?!match.history.some(h=>h.turn===0):!match.history.length;
const last=match.moves.at(-1),computerMoves=match.moves.filter(m=>m.player===1),lastComputer=computerMoves.at(-1);
$('computer-activity').hidden=config.mode!=='ai';
$('computer-activity').textContent=lastComputer?`Computer played ${computerMoves.length} ${computerMoves.length===1?'line':'lines'}. Latest: ${lastComputer.type==='h'?'horizontal':'vertical'}, row ${lastComputer.row+1}, column ${lastComputer.col+1}${lastComputer.captured?` · captured ${lastComputer.captured} ${lastComputer.captured===1?'box':'boxes'}`:''}.`:'Computer will draw peach lines automatically on its turn.';
for(const line of root.querySelectorAll('.played')){if(line.getAttribute('stroke')===colors[1])line.classList.add('computer-line');}
if(last){const x=50+last.col*step,y=50+last.row*step;svg('circle',{cx:x+(last.type==='h'?step/2:0),cy:y+(last.type==='v'?step/2:0),r:5,fill:colors[last.player],class:'latest-move','pointer-events':'none'});}
if(done){const winner=getWinner(board);$('status').textContent=winner==='tie'?`A perfect tie! ${scores[0]} – ${scores[1]}. Start fresh for a rematch.`:`${config.names[winner]} wins ${scores[winner]} – ${scores[1-winner]}! Ready for a rematch?`;}
else $('status').textContent=match.isComputerTurn()?'Computer is choosing a line…':last?.captured?`${config.names[last.player]} captured ${last.captured===2?'two boxes':'a box'} — ${config.names[turn]==='You'?'your':config.names[turn]+"'s"} turn.`:`${config.names[turn]==='You'?'Your':config.names[turn]+"'s"} move. Pick a line between two dots.`;
}

$('mode').addEventListener('change',()=>{const ai=$('mode').value==='ai';$('difficulty').disabled=!ai;$('p2').disabled=ai;$('p2').value=ai?'Computer':'Player 2';$('first').options[1].textContent=ai?'Computer starts':'Player 2 starts';start();});$('new').onclick=start;$('difficulty').addEventListener('change',()=>{config.difficulty=$('difficulty').value;});
$('undo').onclick=()=>match.undo();
$('first').addEventListener('change',start);
$('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();start();

analytics.visit();
