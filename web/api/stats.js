import {getStore,authorized,reply} from '../lib/analytics.js';

export function createStatsHandler({storeProvider=getStore,password=()=>process.env.ANALYTICS_ADMIN_PASSWORD}={}){return async(req,res)=>{
  if(req.method!=='GET'){res.setHeader('Allow','GET');return reply(res,405,{error:'Method not allowed'});}
  if(!password()||password().length<20)return reply(res,503,{error:'Set ANALYTICS_ADMIN_PASSWORD to at least 20 characters on the server.'});
  if(!authorized(req.headers.authorization,password()))return reply(res,401,{error:'Incorrect dashboard password.'});
  try{return reply(res,200,await storeProvider().stats());}catch{return reply(res,503,{error:'Connect your Upstash Redis database to enable the dashboard.'});}
};}
export default createStatsHandler();
