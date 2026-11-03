import {test} from 'node:test';
import assert from 'node:assert/strict';
import {levels,loadProgress,completeLevel,saveProgress} from '../dist/progression.js';
test('Journey unlocks only the next level after a win',()=>{
 const p={completed:0};assert.equal(completeLevel(p,0,1),p);assert.equal(completeLevel(p,0,'tie'),p);assert.equal(completeLevel(p,2,0),p);
 const next=completeLevel(p,0,0);assert.equal(next.completed,1);assert.equal(completeLevel(next,0,0),next);
 let progress=p;for(let i=0;i<levels.length;i++)progress=completeLevel(progress,i,0);assert.equal(progress.completed,6);
});
test('Progress survives reload and handles corrupt or unavailable storage',()=>{
 let data;const storage={getItem:()=>data,setItem:(k,v)=>data=v};saveProgress(storage,{completed:3});assert.equal(loadProgress(storage).completed,3);
 data='bad';assert.equal(loadProgress(storage).completed,0);data='{"completed":999}';assert.equal(loadProgress(storage).completed,6);
 assert.doesNotThrow(()=>saveProgress({setItem:()=>{throw Error();}},{completed:1}));
});
