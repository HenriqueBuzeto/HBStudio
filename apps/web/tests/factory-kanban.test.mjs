import test from "node:test";
import assert from "node:assert/strict";
import {factoryTransitions,canMoveFactoryOrder} from "../lib/factory-kanban.ts";
const all={execute:true,quality:true};
test("only legal stage destinations are exposed",()=>{for(const [from,allowed] of [[7,[8]],[8,[10,7]],[10,[12,7]],[12,[]],[13,[]]]){assert.deepEqual(factoryTransitions(from,all).map(x=>x.target),allowed);for(const to of [7,8,10,12,13])assert.equal(canMoveFactoryOrder(from,to,all),allowed.includes(to));}});
test("permissions fail closed",()=>{assert.deepEqual(factoryTransitions(7,{execute:false,quality:true}),[]);assert.deepEqual(factoryTransitions(8,{execute:false,quality:true}),[]);assert.deepEqual(factoryTransitions(10,{execute:true,quality:false}),[]);});
test("retry and rejection require explicit operations",()=>{assert.match(factoryTransitions(8,all)[1].label,/falha/);assert.match(factoryTransitions(10,all)[1].label,/rejeição/);});
