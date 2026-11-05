export class OnlineMatch {
  constructor({onChange=()=>{},onMessage=()=>{},fetchImpl=(...args)=>fetch(...args),storage=sessionStorage}={}){Object.assign(this,{onChange,onMessage,fetchImpl,storage});this.generation=0;this.timer=null;this.busy=false;this.state=null;}
  cancel(){this.generation++;clearTimeout(this.timer);this.timer=null;this.busy=false;}
  isComputerTurn(){return false;}
  remember(room,token){try{this.storage.setItem('gridclash-room-'+room,token);}catch{}}
  credential(room){try{return this.storage.getItem('gridclash-room-'+room);}catch{return null;}}
  async request(data){
    const response=await this.fetchImpl('/api/room',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(10000)});
    const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Connection interrupted'),{status:response.status});return result;
  }
  apply(state){
    if(this.state&&state.id===this.state.id&&state.version<this.state.version)return;
    this.state=state;this.board=state.board;this.turn=state.turn;this.starter=state.starter;this.moves=state.moves;this.history=[];
    this.config={mode:'online',size:'diamond',names:state.names,first:'random',level:null};this.onChange(this);
  }
  async connect(action,{room,name}){
    this.cancel();this.state=null;const generation=this.generation;this.busy=true;
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const token=this.credential(room)||[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    // Save before joining: a lost response must not lose the second seat.
    if(action==='join')this.remember(room,token);
    try{
      const state=await this.request({action,room,name,token});if(generation!==this.generation)return;
      this.token=state.token||token;this.remember(state.id,this.token);this.busy=false;this.apply(state);this.onMessage('');this.poll(generation);
    }catch(error){if(generation===this.generation){this.busy=false;this.onMessage(error.message);throw error;}}
  }
  poll(generation){
    clearTimeout(this.timer);this.timer=setTimeout(async()=>{
      if(generation!==this.generation||!this.state)return;
      if(!this.busy)try{const state=await this.request({action:'state',room:this.state.id,token:this.token});if(generation!==this.generation)return;this.apply(state);this.onMessage('');}catch(error){if(generation!==this.generation)return;this.onMessage(error.message+' Reconnecting…');}
      if(generation===this.generation)this.poll(generation);
    },3000);
  }
  async play(pos){
    if(!this.state?.ready||this.busy||this.turn!==this.state.seat)return;
    await this.send({action:'move',pos,version:this.state.version,moveId:crypto.randomUUID()});
  }
  async rematch(){if(this.state&&!this.busy)await this.send({action:'rematch'});}
  async send(data){
    const generation=this.generation;this.busy=true;this.onChange(this);
    try{const state=await this.request({...data,room:this.state.id,token:this.token});if(generation!==this.generation)return;this.busy=false;this.apply(state);this.onMessage('');}
    catch(error){if(generation!==this.generation)return;this.busy=false;this.onChange(this);this.onMessage(error.message+' Your board will refresh automatically.');}
  }
}
