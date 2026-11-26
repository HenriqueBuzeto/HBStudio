import test from "node:test";
import assert from "node:assert/strict";
import {formatStockQuantity,formatStockCost,summarizeStock} from "../lib/inventory-units.ts";
const filament={gramsPerStockUnit:1000},piece={gramsPerStockUnit:null};
test("filament canonical kg displays grams with Brazilian decimals",()=>{
 assert.equal(formatStockQuantity(1,filament),"1.000 g");
 assert.equal(formatStockQuantity(.01687,filament),"16,87 g");
 assert.equal(formatStockQuantity(.98313,filament),"983,13 g");
 assert.equal(formatStockQuantity(-.01687,filament),"-16,87 g");
 assert.equal(formatStockQuantity(.01687,filament,true),"+16,87 g");
});
test("unit stock and arbitrary configured spool conversion",()=>{
 assert.equal(formatStockQuantity(100,piece),"100 un");
 assert.equal(formatStockQuantity(2,{gramsPerStockUnit:750}),"1.500 g");
 assert.match(formatStockCost(60,{gramsPerStockUnit:750}),/80,00\s*\/ kg$/);
 assert.match(formatStockCost(.2,piece),/0,20\s*\/ un$/);
});
test("summary never adds mass to pieces",()=>{
 assert.deepEqual(summarizeStock([{...filament,q:1},{...filament,q:.98313},{...piece,q:10}],r=>r.q),[{unit:"un",text:"10 un"},{unit:"g",text:"1.983,13 g"}]);
 assert.deepEqual(summarizeStock([{...filament,q:0}],r=>r.q),[{unit:"g",text:"0 g"}]);
});
test("missing or ambiguous units are not guessed",()=>{
 assert.equal(formatStockQuantity(1,{}),"—");
 assert.equal(formatStockQuantity(1,{gramsPerStockUnit:-1}),"—");
 assert.equal(formatStockCost(null,filament),"—");
 assert.deepEqual(summarizeStock([{q:1}],r=>r.q),[{unit:"unknown",text:"Unidade não identificada"}]);
});
