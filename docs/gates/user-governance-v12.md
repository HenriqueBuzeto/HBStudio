# Governance v12
- Apply v11 then v12; import existing JobTitle values by normalized tenant/name, preserve roles and credentials. No invented titles or sector assignments.
- Canonical position required. Legacy writes synchronize through SQL trigger. Position renaming propagates, inactivation blocked when linked. Optional role suggestion is never a grant.
- Compensation updates use partner command's tenant lock, compare previous compensation snapshot and update only explicit fields; cap-only edits do not create a financial profile. No journal entry or payment.
- QA database contains a previously existing test account; do not promote or copy test rows. Login remains partner-only.
- Sector report depends on financial journal classification. No automatic cost attribution implemented in this migration.
- QA checks executed with rollback: migrated CEO link, duplicate rejection, rename propagation, inactivation blocked, cap-only update, stale compensation rejection, legacy JobTitle synchronization. Build/authenticated regression required before release.
