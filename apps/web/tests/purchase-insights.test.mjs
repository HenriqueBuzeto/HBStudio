import test from "node:test";import assert from "node:assert/strict";import {analyze,defaultPolicy,validPolicy} from "../lib/purchase-insights.ts";
const base={id:"test",sku:"T",name:"Teste",kind:1,serialized:false,physical:0,available:0,incoming:0,pending:0,q7:3,q30:6,q90:9,salesCount:6,conditions:1,lastSale:null,revenue:1200,profit:300,capital:0,samples:0,avgDays:null,fastest:null,entered:null,sold:null,days:null,saleNumber:null,condition:null};
test("eligible replenishment nets approved inbound",()=>{assert.equal(analyze(base,defaultPolicy).quantity,5);assert.equal(analyze({...base,incoming:5},defaultPolicy).quantity,0);});
test("no duplicate draft",()=>assert.equal(analyze({...base,pending:1},defaultPolicy).quantity,null));
test("no fabricated history or balance",()=>{assert.equal(analyze({...base,q30:0,salesCount:0},defaultPolicy).quantity,null);assert.equal(analyze({...base,available:null},defaultPolicy).quantity,null);});
test("serialized rapid sale is a review signal not a forecast",()=>{const r=analyze({...base,serialized:true,samples:1,fastest:4,avgDays:4},defaultPolicy);assert.equal(r.fast,true);assert.equal(r.state,"review");assert.equal(r.quantity,null);});
test("negative profit blocks automatic quantity",()=>assert.equal(analyze({...base,profit:-1},defaultPolicy).quantity,null));
test("invalid policy and inaccessible costs",()=>{assert.equal(validPolicy({...defaultPolicy,lead:0}),false);const r=analyze({...base,profit:null},defaultPolicy);assert.equal(r.margin,null);assert.equal(r.quantity,null);assert.equal(r.state,"review");});
