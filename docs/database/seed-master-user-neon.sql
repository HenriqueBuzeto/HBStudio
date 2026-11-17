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

-- 4. Insercao de Todas as Permissoes da Role Master (133 chaves canonicas)
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'access.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'audit.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'automation.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.approve_difference', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.audit.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.close', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.discrepancy.resolve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.discrepancy.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.movement.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.open', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.reconcile', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.register.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.register.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.approve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.count', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.shift.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.supply', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'cash.withdraw', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.products.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'catalog.products.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.campaign.send', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.interest.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.message.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'crm.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.create', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.edit', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.export', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.sensitive.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'customers.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.banks.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.costcenters.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.journal.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.pay', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.payables.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.period.close', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.receivables.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.reconcile', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.reports.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'finance.settle', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.cancel', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.documents.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.issue', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fiscal.settings.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.allocations.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.expenses.approve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.expenses.create', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.fueling.create', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.fueling.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.complete', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.maintenance.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.odometer.correct', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.reimbursement.request', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.reports.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.settings.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.close', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.create', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.trips.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.vehicles.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'fleet.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.adjust', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.move', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.serials.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inventory.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.costs.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.execute', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.orders.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.printers.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quality.approve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quote', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.quotes.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.schedule', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'manufacturing.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.channels.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.conversations.reply', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.conversations.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.notifications.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.send', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.templates.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'messaging.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.capital.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.compensation.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.approve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.pay', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.propose', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.distribution.settle', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.loan.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'partners.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.approve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.minimum.override', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.override', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.policies.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.simulate', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.suggestions.generate', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.suggestions.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'pricing.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.billing.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.manage', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'projects.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.approve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.create', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.receive', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'purchases.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.approve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.assign', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.create', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.deliver', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.diagnose', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.execute', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.parts.consume', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.parts.reserve', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.quality', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.quote', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'repairs.warranty', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.cancel', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.cost.view', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.create', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.discount.override', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'sales.pos.use', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.create', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.edit', NOW())
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions ("Id", "TenantId", "RoleId", "PermissionKey", "CreatedAtUtc")
VALUES (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'suppliers.view', NOW())
ON CONFLICT DO NOTHING;

-- 5. Usuario Master (Henrique Buzeto)
INSERT INTO users ("Id", "TenantId", "DefaultBranchId", "FullName", "Email", "JobTitle", "PasswordHash", "IsActive", "SecurityStamp", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Henrique Buzeto', 'henriquebuzeto@hbstudio.com', 'CEO', 'v1.600000.VsMWxYC6v53uqrSGoacdeA==.afg6R+UlwTENn3DyUFZmAuX9cPEQEIn2pfkfhmTYoEw=', true, 1, NOW(), NOW())
ON CONFLICT ("TenantId", "Email") DO UPDATE SET "PasswordHash" = EXCLUDED."PasswordHash", "JobTitle" = 'CEO', "IsActive" = true, "SecurityStamp" = users."SecurityStamp" + 1;

-- 6. Vinculo do Usuario ao Perfil Master
INSERT INTO user_roles ("UserId", "RoleId", "TenantId")
VALUES ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001')
ON CONFLICT ("UserId", "RoleId") DO NOTHING;

-- 7. Vinculo Societario Oficial no Modulo PartnersCapital (Socio-Administrador / ManagingPartner)
INSERT INTO partners ("Id", "TenantId", "UserId", "Name", "Cpf", "Email", "Type", "Status", "JoinedAtUtc", "TotalCapitalContributed", "CurrentCapitalBalance", "IsErpAccessEnabled", "CreatedAtUtc", "UpdatedAtUtc")
VALUES ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Henrique Buzeto', '000.000.000-00', 'henriquebuzeto@hbstudio.com', 1, 1, NOW(), 50000.00, 50000.00, true, NOW(), NOW())
ON CONFLICT ("Id") DO UPDATE SET "IsErpAccessEnabled" = true, "Status" = 1;

COMMIT;

