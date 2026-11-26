import test from "node:test";import assert from "node:assert/strict";import {fleetSource,validFleetOverview,MAIN_NEON_BRANCH} from "../lib/fleet-source.ts";
test("production rejects isolated branch",()=>assert.equal(fleetSource("br-empty-dew-b63jpig9","production","Matriz"),null));
test("main production is writable",()=>assert.equal(fleetSource(MAIN_NEON_BRANCH,"production","Matriz").writable,true));
test("preview main is explicitly read only",()=>assert.deepEqual(fleetSource(MAIN_NEON_BRANCH,"preview","Matriz"),{environment:"preview",database:"main",branchName:"Matriz",writable:false}));
test("isolated preview remains writable",()=>assert.equal(fleetSource("br-empty-dew-b63jpig9","preview","Matriz").database,"isolated"));
test("unknown identity fails closed",()=>{assert.equal(fleetSource(null,"preview","Matriz"),null);assert.equal(fleetSource(MAIN_NEON_BRANCH,"production",""),null);});
test("empty arrays only accepted with verified source",()=>{const v={vehicles:[],trips:[],maintenance:[],fuelings:[],partners:[]};assert.equal(validFleetOverview(v),false);assert.equal(validFleetOverview({...v,source:fleetSource(MAIN_NEON_BRANCH,"production","Matriz")}),true);assert.equal(validFleetOverview({...v,source:{environment:"preview",database:"main",branchName:"Matriz",writable:true}}),false);});
