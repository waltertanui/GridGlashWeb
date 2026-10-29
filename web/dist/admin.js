const $=id=>document.getElementById(id);
let password='',requestId=0;
const number=n=>Number(n||0).toLocaleString();
function cell(tag,text,parent){const element=document.createElement(tag);element.textContent=text;parent.append(element);return element;}
function render(data){
  $('dashboard').hidden=false;$('login').hidden=true;$('message').textContent='';$('local-note').hidden=data.storage!=='local';
  $('updated').textContent='Updated '+new Date().toLocaleTimeString();$('cards').replaceChildren();
  const t=data.totals;
  for(const [label,value,detail] of [
    ['Unique visitors',t.visitors,'Estimated unique browsers'],['Visits',t.visits,number(t.pageViews)+' page views'],
    ['Games started',t.gamesStarted,number(t.aiGames)+' vs computer · '+number(t.localGames)+' two-player'],
    ['Games completed',t.gamesCompleted,(t.gamesStarted?Math.round(t.gamesCompleted/t.gamesStarted*100):0)+'% completion rate']
  ]){const card=cell('article','',$('cards'));card.className='card';cell('span',label,card);cell('strong',number(value),card);cell('small',detail,card);}
  $('chart').replaceChildren();const max=Math.max(1,...data.daily.map(d=>d.visitors));
  for(const d of data.daily){const text=d.day+': '+number(d.visitors)+' visitors';const bar=cell('button','',$('chart'));bar.className='bar';bar.type='button';bar.style.height=Math.max(2,d.visitors/max*100)+'%';bar.setAttribute('aria-label',text);cell('span',text,bar).className='bar-info';}
  $('daily').replaceChildren();for(const d of [...data.daily].reverse()){const row=cell('tr','',$('daily'));for(const value of [d.day,d.visitors,d.visits,d.pageViews,d.gamesStarted,d.gamesCompleted])cell('td',typeof value==='number'?number(value):value,row);}
}
async function load(){
  const currentRequest=++requestId;
  $('message').textContent='Loading statistics…';$('refresh').disabled=true;
  try{
    const response=await fetch('/api/stats',{headers:{Authorization:`Bearer ${password}`},cache:'no-store'});
    const data=await response.json();if(currentRequest!==requestId)return;if(!response.ok)throw Error(data.error||'Statistics are unavailable.');render(data);
  }catch(e){if(currentRequest===requestId)$('message').textContent=e instanceof SyntaxError?'The analytics API is unavailable. Deploy the entire web folder to Vercel, including api and lib.':e.message;}
  finally{if(currentRequest===requestId)$('refresh').disabled=false;}
}
$('login').addEventListener('submit',e=>{e.preventDefault();password=$('password').value;$('password').value='';load();});
$('refresh').onclick=load;
$('logout').onclick=()=>{requestId++;password='';$('refresh').disabled=false;$('dashboard').hidden=true;$('login').hidden=false;$('cards').replaceChildren();$('daily').replaceChildren();$('chart').replaceChildren();$('message').textContent='Dashboard locked.';};
