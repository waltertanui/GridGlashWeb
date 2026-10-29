import {getStore,validEvent,readBody,reply,rateKey} from '../lib/analytics.js';

export function createEventsHandler(storeProvider=getStore){return async(req,res)=>{
  if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{error:'Method not allowed'});}
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return reply(res,415,{error:'Use JSON'});
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'Origin not allowed'});}catch{return reply(res,403,{error:'Origin not allowed'});}}
  let e;try{e=await readBody(req);}catch{return reply(res,400,{error:'Invalid event'});}
  if(!validEvent(e))return reply(res,400,{error:'Invalid event'});
  try{
    const store=storeProvider();if(!await store.allow(rateKey(req)))return reply(res,429,{error:'Please try later'});
    await store.record({type:e.type,id:e.id,visitorId:e.visitorId,sessionId:e.sessionId,mode:e.mode});
    return reply(res,200,{ok:true});
  }catch{return reply(res,503,{error:'Analytics unavailable'});}
};}
export default createEventsHandler();
