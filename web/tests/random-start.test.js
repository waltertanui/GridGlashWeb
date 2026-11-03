import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Match} from '../dist/match.js';
test('Random starter is chosen anew for each match and schedules only computer starts',()=>{
 let value=0.2,scheduled=0;
 const m=new Match({random:()=>value,setTimer:()=>++scheduled,clearTimer:()=>{}});
 const config={mode:'ai',first:'random',difficulty:'easy'};
 m.start(config);assert.equal(m.turn,0);assert.equal(m.starter,0);assert.equal(scheduled,0);
 value=0.8;m.start(config);assert.equal(m.turn,1);assert.equal(m.starter,1);assert.equal(scheduled,1);
 value=0.1;m.start(config);assert.equal(m.turn,0);assert.equal(m.starter,0);
});
test('Local random start and explicit choices are respected',()=>{
 const m=new Match({random:()=>0.9,setTimer:()=>{throw Error('No AI timer in local mode');}});
 m.start({mode:'local',first:'random'});assert.equal(m.turn,1);
 m.start({mode:'local',first:0});assert.equal(m.turn,0);
 m.start({mode:'local',first:1});assert.equal(m.turn,1);
});
