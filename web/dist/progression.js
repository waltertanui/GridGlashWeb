export const levels = [
  {name:'First steps',difficulty:'easy',mistakes:0},
  {name:'Find your edge',difficulty:'medium',mistakes:0.6},
  {name:'Read the board',difficulty:'medium',mistakes:0.3},
  {name:'Clever rival',difficulty:'medium',mistakes:0},
  {name:'Think ahead',difficulty:'hard',mistakes:0.15},
  {name:'Diamond master',difficulty:'hard',mistakes:0},
];
export function loadProgress(storage){
 try { const value=JSON.parse(storage.getItem('gridclash-progress-v1'));return {completed:Math.max(0,Math.min(levels.length,Number.isInteger(value?.completed)?value.completed:0))}; } catch {return {completed:0};}
}
export function completeLevel(progress,index,winner){
 return winner===0 && index===progress.completed && index<levels.length ? {completed:index+1} : progress;
}
export function saveProgress(storage,progress){try{storage.setItem('gridclash-progress-v1',JSON.stringify(progress));}catch{}}
