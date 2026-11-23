const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const vm=require("node:vm");
const filename=path.join(__dirname,"../lib/acquirer-fees.ts");
const transpiled=ts.transpileModule(fs.readFileSync(filename,"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 reportDiagnostics:true
});
const moduleForTest={exports:{}};
vm.runInNewContext(transpiled.outputText,{module:moduleForTest,exports:moduleForTest.exports},
 {filename:"acquirer-fees.test.js"});
const {calculateAcquirerFee,percentToBps,currencyToCentsStrict}=moduleForTest.exports;
const rate={method:"CREDIT",installments:18,mdrBps:450,anticipationBps:50,
 fixedFeeCents:0,settlementDays:30,settlementMode:"MONTHLY",enabled:true};
const result=calculateAcquirerFee(649900,rate);
assert.equal(result.grossCents,649900);
assert.equal(result.mdrFeeCents,29246);
assert.equal(result.anticipationFeeCents,3103);
assert.equal(result.netExpectedCents,617551);
assert.equal(result.feeTotalCents,32349);
assert.equal(result.customerInstallmentsCents.length,18);
assert.equal(result.merchantExpectedInstallmentsCents.length,18);
assert.equal(result.customerInstallmentsCents.reduce((a,b)=>a+b,0),649900);
assert.equal(result.merchantExpectedInstallmentsCents.reduce((a,b)=>a+b,0),617551);
assert.equal(calculateAcquirerFee(10000,{...rate,method:"PIX",installments:1,mdrBps:99,
 anticipationBps:0,fixedFeeCents:100,settlementDays:1,settlementMode:"SINGLE"}).netExpectedCents,9801);
assert.equal(calculateAcquirerFee(10000,{...rate,method:"DEBIT",installments:1,mdrBps:0,
 anticipationBps:0,fixedFeeCents:0,settlementMode:"SINGLE"}).netExpectedCents,10000);
assert.equal(percentToBps("5,25","MDR"),525);
assert.equal(percentToBps("0.00","MDR"),0);
assert.equal(currencyToCentsStrict("12,34","Fixo"),1234);
assert.throws(()=>percentToBps("1.234","MDR"));
assert.throws(()=>currencyToCentsStrict("-1","Fixo"));
assert.throws(()=>calculateAcquirerFee(10000,{...rate,installments:19}));
assert.throws(()=>calculateAcquirerFee(10000,{...rate,enabled:false}));
assert.throws(()=>calculateAcquirerFee(10000,{...rate,method:"PIX",installments:2}));
assert.throws(()=>calculateAcquirerFee(100,{...rate,fixedFeeCents:101}));
const sameGross=calculateAcquirerFee(111,{...rate,installments:3,mdrBps:0,
 anticipationBps:0,fixedFeeCents:0});
assert.deepEqual([...sameGross.customerInstallmentsCents],[37,37,37]);
assert.equal(sameGross.netExpectedCents,111);
console.log("Acquirer fee arithmetic: PASS (integer cents, MDR, anticipation, 1-18 installments, no buyer interest, validation)");
