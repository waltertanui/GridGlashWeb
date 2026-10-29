import {createDiamondBoard,drawLine,getAIMove,getAllAvailableLines,isGameOver} from './gameLogic.js';

// One owner for turn changes, computer scheduling, restart and undo.
export class Match {
  constructor({onChange=()=>{},delay=650,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}) {
    Object.assign(this,{onChange,delay,setTimer,clearTimer});
    this.generation=0;
    this.timer=null;
  }
  cancel(){this.generation++;if(this.timer!==null)this.clearTimer(this.timer);this.timer=null;}
  start(config){
    this.cancel();this.config={...config};this.board=createDiamondBoard();
    this.turn=config.first===1?1:0;this.history=[];this.moves=[];
    this.schedule();this.onChange(this);
  }
  isComputerTurn(){return this.config.mode==='ai'&&this.turn===1&&!isGameOver(this.board);}
  play(pos,computer=false){
    if(isGameOver(this.board)||this.isComputerTurn()!==computer)return false;
    const player=this.turn,result=drawLine(this.board,pos,player);
    if(result.newBoard===this.board)return false;
    this.history.push({board:this.board,turn:this.turn,moves:this.moves.slice()});
    this.board=result.newBoard;
    this.moves.push({...pos,player,captured:result.claimedBoxes});
    this.turn=1-player;
    this.schedule();this.onChange(this);return true;
  }
  schedule(){
    this.cancel();if(!this.isComputerTurn())return;
    const generation=this.generation;
    this.timer=this.setTimer(()=>{
      if(generation!==this.generation||!this.isComputerTurn())return;
      this.timer=null;
      const legal=getAllAvailableLines(this.board);
      let move;
      try{move=getAIMove(this.board,this.config.difficulty);}catch{move=null;}
      // A legal fallback keeps a failed strategy from stalling the match.
      if(!move||!legal.some(p=>p.type===move.type&&p.row===move.row&&p.col===move.col))move=legal[0];
      if(move)this.play(move,true);
    },this.delay);
  }
  undo(){
    const index=this.config.mode==='ai'?this.history.findLastIndex(h=>h.turn===0):this.history.length-1;
    if(index<0)return;
    this.cancel();const previous=this.history[index];this.history.length=index;
    Object.assign(this,previous);this.schedule();this.onChange(this);
  }
}
