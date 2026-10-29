const storage=(name)=>{try{return globalThis[name];}catch{return null;}};
const remember=(store,key,make)=>{try{const existing=store?.getItem(key);if(existing)return existing;const value=make();store?.setItem(key,value);return value;}catch{return make();}};
export function createTracker({fetchImpl=(...args)=>fetch(...args),local=storage('localStorage'),session=storage('sessionStorage'),uuid=()=>crypto.randomUUID()}={}){
  let queue=Promise.resolve();
  const visitorId=remember(local,'gridclash-visitor',uuid),sessionId=remember(session,'gridclash-session',uuid);
  const enabled=()=>{try{return local?.getItem('gridclash-analytics-disabled')!=='1';}catch{return true;}};
  const send=(type,id,mode)=>{
    const body=JSON.stringify({type,id,visitorId,sessionId,...(mode?{mode}:{})});
    queue=queue.then(async()=>{
      if(!enabled())return;
      for(let attempt=0;attempt<2;attempt++)try{
        const response=await fetchImpl('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,signal:AbortSignal.timeout(5000)});
        if(response.ok||response.status<500)return;
      }catch{}
    }).catch(()=>{});
    return queue;
  };
  return {
    visit:()=>send('page_view',uuid()),
    newGame(){const id=uuid();let started=false,completed=false;return {observe({hasMoves,finished,mode}){
      if(hasMoves&&!started){started=true;send('game_started',id,mode);}
      if(hasMoves&&finished&&!completed){completed=true;send('game_completed',id,mode);}
    }};},
    flush:()=>queue,
    enabled,
    disable(){try{local?.setItem('gridclash-analytics-disabled','1');local?.removeItem('gridclash-visitor');session?.removeItem('gridclash-session');}catch{}},
    enable(){try{local?.removeItem('gridclash-analytics-disabled');}catch{}}
  };
}
export const analytics=createTracker();
