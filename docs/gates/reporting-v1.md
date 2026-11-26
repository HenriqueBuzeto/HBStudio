# Central de relatórios — HB Studio
Read-only reporting catalog (45 reports, 9 domains). Existing transactional tables are canonical. No migrations or seed data. Report catalog and SQL are server-only; authorized report metadata exposed by GET /api/reports. Permission intersection for sensitive reports, tenant/branch scope from authenticated session, company-wide reports explicitly labeled. Bound local-calendar dates (America/Sao_Paulo, inclusive start/end), search, page size 100, CSV requery up to 5,000 rows with formula injection prevention, browser-native page print.
## Measurement and limitations
- Current positions ignore date filter; historical cohort reports show current statuses where noted. No training ledger included in sales.
- Sales current-confirmed/fulfilled totals use line discounts plus header discounts/charges once. Returned/cancelled events separate. No fabricated commissions or net profit.
- Physical stock turnover: gross sale issues divided by weighted daily average of recorded quantity, provided aggregate SKU quantity reconciles against current stock. Not accounting turnover; no reconstructed historical monetary valuation.
- Cash movements, settlements, bank entries and journal entries can represent the same business event; never total across these sources as independent income.
- Partner capital, loans, amortized principal, paid profit distributions and compensation are distinct. The ratio of paid net profits to paid-in capital is not ROI/payback. No capital restitution or asset ROI without canonical data.
- Result report uses actual posted journal revenue/expense accounts, not a certified DRE, balance sheet, DFC or tax calculation.
- Industrial costs and approved price, project contracts and collected revenue must remain separate. Cost reports require explicit permissions. No report creates a transaction or bypasses commercial/fiscal gates.
## References
Microsoft Dynamics 365 Business Central available reports: https://learn.microsoft.com/en-gb/dynamics365/business-central/reports-available-reports
Oracle NetSuite inventory turnover: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N2356560.html
Odoo manufacturing order costs: https://www.odoo.com/documentation/18.0/applications/inventory_and_mrp/manufacturing/basic_setup/mo_costs.html
Odoo accounting reporting: https://www.odoo.com/documentation/18.0/applications/finance/accounting/reporting.html
SAP Business One inventory movement report views: https://help.sap.com/docs/SAP_BUSINESS_ONE_WEB_CLIENT/2554bf7e9aa347729b0547a737e123ac/5a3a4c241a2c465e9aacf21c81a33e29.html
