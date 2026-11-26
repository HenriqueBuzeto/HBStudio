import test from "node:test";
import assert from "node:assert/strict";
import {REPORTS,canReadReport,buildReportSql,validReportRange} from "../lib/report-definitions.ts";
import {csvEscape} from "../lib/report-export.ts";
test("catalog has 49 unique reports and every total references a displayed numeric column",()=>{
 assert.equal(REPORTS.length,49);assert.equal(new Set(REPORTS.map(r=>r.id)).size,49);
 for(const r of REPORTS){assert.ok(r.permissions.length);assert.ok(r.columns.length);assert.equal(new Set(r.columns.map(c=>c.key)).size,r.columns.length);for(const c of r.columns)assert.match(c.key,/^[a-z_]+$/);for(const k of r.totals)assert.ok(r.columns.some(c=>c.key===k&&["qty","money"].includes(c.format)));assert.ok(r.note.length>20);}
});
test("report authorization is intersection, not role bypass",()=>{
 const r=REPORTS.find(r=>r.id==="stock-value");
 assert.equal(canReadReport(r,new Set(["inventory.view"])),false);
 assert.equal(canReadReport(r,new Set(["inventory.cost.view"])),false);
 assert.equal(canReadReport(r,new Set(r.permissions)),true);
 const p=REPORTS.find(r=>r.id==="partners");assert.equal(canReadReport(p,new Set(["finance.reports.view"])),false);
});
test("SQL has bound scope, date, search and page parameters; projection and totals are server-owned",()=>{
 for(const r of REPORTS){const q=buildReportSql(r);for(let i=1;i<=7;i++)assert.ok(q.includes("$"+i));assert.match(q,/LIMIT \$6::int OFFSET \$7::int/);assert.ok(q.includes("FROM filtered"));assert.ok(!q.includes("pos_training_checkout_records"));if(!r.mode.startsWith("company"))assert.match(r.sql,/s\.b/);}
});
test("date ranges include leap day and reject invalid, reversed and overlong periods",()=>{
 assert.ok(validReportRange("2024-02-29","2024-03-01"));assert.ok(validReportRange("2024-01-01","2024-12-31"));
 for(const [a,b] of [["2026-02-29","2026-03-01"],["2026-01-01","2027-01-02"],["2026-11-27","2026-11-26"],["2026-11-1","2026-11-26"],[null,"2026-11-26"]])assert.equal(validReportRange(a,b),false);
});
test("CSV preserves decimal values and protects spreadsheet formula injection",()=>{
 assert.equal(csvEscape("120.50","money"),'"120,50"');
 assert.equal(csvEscape("-16.87","qty"),'"-16,87"');
 assert.equal(csvEscape("=1+1","text"),'"\'=1+1"');
 assert.equal(csvEscape("  @SUM(A1)","text"),'"\'  @SUM(A1)"');
 assert.equal(csvEscape('a"b',"text"),'"a""b"');
 assert.equal(csvEscape("=1+1","money"),'""');
});
test("stock and material report totals never add incompatible units",()=>{
 for(const id of ["stock","kardex","factory-materials","purchases"])assert.deepEqual(REPORTS.find(r=>r.id===id).totals,[]);
});

test("investment reports preserve company scope and separate real payments from planning",()=>{
 for(const id of ["investment-position","investment-shares","investment-payments","investment-plans"]){const r=REPORTS.find(x=>x.id===id);assert.ok(r.mode.startsWith("company"));assert.equal(canReadReport(r,new Set(["partners.view"])),false);assert.ok(r.sql.includes("s.t"));}
 assert.deepEqual(REPORTS.find(x=>x.id==="investment-plans").totals,[]);
});
