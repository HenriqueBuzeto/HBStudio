import test from "node:test";
import assert from "node:assert/strict";
import {parsePartnerCents,splitPartnerPayment,releaseMonthly,scopedPaymentShares,partnerPaymentBalance,paymentCanConfirm} from "../lib/partner-calculations.ts";
test("money parser uses integer cents and rejects excess precision",()=>{
 assert.equal(parsePartnerCents("90000"),9000000);
 assert.equal(parsePartnerCents("16,87"),1687);
 assert.equal(parsePartnerCents("0.01"),1);
 for(const v of ["-1","1.001","1e3","NaN",""])assert.throws(()=>parsePartnerCents(v));
});
test("collective 90k / 3, 3k collective and 20k individual",()=>{
 const opening=["a","b","c"].map(id=>({id,name:id,balance:3000000}));
 const collective=splitPartnerPayment(300000,opening);assert.deepEqual(collective.map(x=>x.allocation),[100000,100000,100000]);
 const remaining=collective.map(x=>({...x,balance:x.balance-x.allocation}));
 const extra=splitPartnerPayment(2000000,[remaining[2]])[0];remaining[2].balance-=extra.allocation;
 assert.deepEqual(remaining.map(x=>x.balance),[2900000,2900000,900000]);
 assert.equal(remaining.reduce((s,x)=>s+x.balance,0),6700000);
});
test("equal split is deterministic and paid-off shares are not reallocated",()=>{
 assert.deepEqual(splitPartnerPayment(100,[{id:"c",name:"c",balance:100},{id:"a",name:"a",balance:100},{id:"b",name:"b",balance:100}]).map(x=>x.allocation),[34,33,33]);
 assert.deepEqual(splitPartnerPayment(300,[{id:"a",name:"a",balance:1000},{id:"b",name:"b",balance:1000},{id:"c",name:"c",balance:0}]).map(x=>x.allocation),[100,100,0]);
 assert.equal(releaseMonthly(100000,0),100000);assert.equal(releaseMonthly(100000,40000),60000);assert.equal(releaseMonthly(100000,200000),0);
});

test("registered partner without shares has zero payable balance",()=>{
 const scope={source:"EXTERNAL",date:"2026-11-26",investmentId:"",settlementId:"",mode:"PERSONAL",partnerId:"a"};
 assert.deepEqual(scopedPaymentShares([],[],scope),[]);
 assert.equal(partnerPaymentBalance([],"a"),0);
 assert.equal(paymentCanConfirm(100,0,"PERSONAL","EXTERNAL",false),false);
});
test("payment scope matches participant, date, investment and source",()=>{
 const investments=[{id:"open",date:"2026-11-01",payableId:null},{id:"linked",date:"2026-11-01",payableId:"title"},{id:"future",date:"2026-12-01",payableId:null}];
 const shares=[{investmentId:"open",partnerId:"a",name:"A",balanceCents:"1000"},{investmentId:"open",partnerId:"b",name:"B",balanceCents:0},{investmentId:"linked",partnerId:"a",name:"A",balanceCents:500},{investmentId:"future",partnerId:"a",name:"A",balanceCents:700}];
 const scope={source:"EXTERNAL",date:"2026-11-26",investmentId:"",settlementId:"",mode:"COLLECTIVE",partnerId:""};
 assert.deepEqual(scopedPaymentShares(shares,investments,scope),shares.slice(0,2));
 assert.equal(partnerPaymentBalance(scopedPaymentShares(shares,investments,scope),"a"),1000);
 assert.deepEqual(scopedPaymentShares(shares,investments,{...scope,mode:"PERSONAL",partnerId:"b"}),[shares[1]]);
 assert.deepEqual(scopedPaymentShares(shares,investments,{...scope,source:"SETTLEMENT"}),[]);
 assert.deepEqual(scopedPaymentShares(shares,investments,{...scope,source:"SETTLEMENT",settlementId:"settled",investmentId:"linked"}),[shares[2]]);
 assert.deepEqual(scopedPaymentShares(shares,investments,{...scope,investmentId:"missing"}),[]);
});
test("confirm blocks personal excess and partial financial settlements",()=>{
 assert.equal(paymentCanConfirm(100,50,"PERSONAL","EXTERNAL",true),false);
 assert.equal(paymentCanConfirm(100,50,"COLLECTIVE","SETTLEMENT",true),false);
 assert.equal(paymentCanConfirm(100,50,"COLLECTIVE","EXTERNAL",false),false);
 assert.equal(paymentCanConfirm(100,50,"COLLECTIVE","EXTERNAL",true),true);
 assert.equal(paymentCanConfirm(100,100,"PERSONAL","EXTERNAL",false),true);
});
