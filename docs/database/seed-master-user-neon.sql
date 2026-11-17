-- =============================================================================
-- SCRIPT DE INICIALIZACAO ENTERPRISE - ADMINISTRADOR MASTER COM ACESSO TOTAL
-- HB Studio ERP - Compativel com PostgreSQL 16/17/18 (Neon Serverless)
-- Email: henriquebuzeto@hbstudio.com
-- Permissoes: Todas as 133 chaves canonicas do PermissionCatalog
-- =============================================================================

START TRANSACTION;

-- 1. Tenant Principal
INSERT INTO tenants ("Id", "Name", "Code", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('a0000000-0000-0000-0000-000000000001', 'HB Studio Tecnologia', 'HBSTUDIO', true, NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "IsActive" = true;

-- 2. Filial Matriz
INSERT INTO branches ("Id", "TenantId", "Name", "Code", "IsHeadquarters", "IsActive", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'HB Studio - Matriz SP', 'MATRIZ', true, true, NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "IsActive" = true;

-- 3. Perfil de Acesso Master (Super Administrador)
INSERT INTO roles ("Id", "TenantId", "Name", "Description", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Administrador Master', 'Acesso Irrestrito Full a Todos os Modulos, Operacoes e Relatorios', NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "Name" = EXCLUDED."Name", "Description" = EXCLUDED."Description";

-- 4. Insercao de Todas as Permissoes da Role Master (133 chaves com Version = 1)
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'access.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'audit.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'automation.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.approve_difference', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.audit.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.close', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.discrepancy.resolve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.discrepancy.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.movement.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.open', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.reconcile', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.register.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.register.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.count', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.supply', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.withdraw', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.products.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.products.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.campaign.send', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.interest.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.message.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.edit', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.export', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.sensitive.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.banks.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.costcenters.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.journal.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.pay', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.payables.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.period.close', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.receivables.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.reconcile', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.reports.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.settle', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.cancel', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.documents.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.issue', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.settings.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.allocations.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.expenses.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.expenses.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.fueling.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.fueling.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.complete', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.odometer.correct', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.reimbursement.request', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.reports.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.settings.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.close', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.vehicles.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.adjust', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.move', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.serials.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.costs.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.execute', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.orders.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.printers.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quality.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quote', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quotes.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.schedule', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.channels.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.conversations.reply', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.conversations.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.notifications.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.send', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.templates.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.capital.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.compensation.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.pay', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.propose', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.settle', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.loan.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.minimum.override', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.override', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.policies.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.simulate', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.suggestions.generate', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.suggestions.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.billing.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.manage', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.receive', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.approve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.assign', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.deliver', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.diagnose', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.execute', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.parts.consume', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.parts.reserve', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.quality', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.quote', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.warranty', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.cancel', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.cost.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.discount.override', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.pos.use', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.create', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.edit', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "Version", "CreatedAtUtc", "UpdatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.view', 1, NOW(), NOW())
ON CONFLICT ("TenantId", "RoleId", "PermissionKey") DO NOTHING;

-- 5. Usuario Master (Henrique Buzeto)
INSERT INTO users ("Id", "TenantId", "DefaultBranchId", "FullName", "Email", "JobTitle", "PasswordHash", "IsActive", "SecurityStamp", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Henrique Buzeto', 'henriquebuzeto@hbstudio.com', 'CEO', 'v1.600000.VsMWxYC6v53uqrSGoacdeA==.afg6R+UlwTENn3DyUFZmAuX9cPEQEIn2pfkfhmTYoEw=', true, 1, NOW(), NOW())
ON CONFLICT ("TenantId", "Email") DO UPDATE SET "PasswordHash" = EXCLUDED."PasswordHash", "JobTitle" = 'CEO', "IsActive" = true, "SecurityStamp" = users."SecurityStamp" + 1;

-- 6. Vinculo do Usuario ao Perfil Master
INSERT INTO user_roles ("UserId", "RoleId", "TenantId")
VALUES ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT ("UserId", "RoleId") DO NOTHING;

-- 7. Vinculo Societario Oficial no Modulo PartnersCapital (Socio-Administrador / ManagingPartner)
INSERT INTO partners ("Id", "TenantId", "PartyId", "Name", "DocumentNumber", "Email", "Type", "Status", "AdmissionDate", "MonthlyCompensationCap", "IsErpAccessEnabled", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Henrique Buzeto', '000.000.000-00', 'henriquebuzeto@hbstudio.com', 1, 1, NOW(), 50000.00, true, NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "IsErpAccessEnabled" = true, "Status" = 1;

COMMIT;

