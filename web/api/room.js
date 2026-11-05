import {getRoomStore,createRoomService} from '../lib/multiplayer.js';
import {readBody,reply,rateKey} from '../lib/analytics.js';
export function createRoomHandler(provider=getRoomStore){return async(req,res)=>{
  if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(res,405,{error:'Use POST'});}
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return reply(res,415,{error:'Use JSON'});
  if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'Origin not allowed'});}catch{return reply(res,403,{error:'Origin not allowed'});}}
  let input;try{input=await readBody(req);}catch{return reply(res,400,{error:'Invalid request'});}
  try{
    const store=provider();
    if(!await store.allow(rateKey(req)))return reply(res,429,{error:'Too many requests. Please wait a minute.'});
    const room=await createRoomService(store).act(input);return reply(res,200,room);
  }catch(error){return reply(res,error.status||503,{error:error.status?error.message:'Online rooms are unavailable. Please try again shortly.'});}
};}
export default createRoomHandler();
