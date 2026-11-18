-- HB Studio ERP — Auditoria de dados operacionais (READ ONLY)
-- NÃO EXCLUI, ALTERA OU REDEFINE REGISTROS DO NEON.
-- Execute no SQL Editor apenas da branch Neon escolhida para auditoria.
-- Antes de qualquer limpeza: faça snapshot/branch de backup e confirme a restauração.

-- 1. Verificar contexto de banco e usuário SQL (não mostra segredos).
SELECT current_database() AS database_name, current_user AS database_role,
       current_schema() AS default_schema, now() AS audited_at_utc;

-- 2. Validar conta que precisa permanecer. Não atualizar senha nem ID.
SELECT "Id", "TenantId", "DefaultBranchId", "FullName", "Email", "IsActive",
       "JobTitle", "SecurityStamp"
  FROM users
 WHERE lower("Email") = lower('henriquebuzeto@hbstudio.com');

-- 3. Conferir vínculos administrativos; proteger também os registros estruturais
--    de tenants, branches, roles, role_permissions e user_roles.
SELECT u."Id" AS user_id, u."TenantId", r."Id" AS role_id, r."Name" AS role_name,
       count(DISTINCT rp."PermissionKey") AS permission_count
  FROM users u
  JOIN user_roles ur ON ur."UserId" = u."Id" AND ur."TenantId" = u."TenantId"
  JOIN roles r ON r."Id" = ur."RoleId" AND r."TenantId" = ur."TenantId"
  LEFT JOIN role_permissions rp ON rp."RoleId" = r."Id" AND rp."TenantId" = r."TenantId"
 WHERE lower(u."Email") = lower('henriquebuzeto@hbstudio.com')
 GROUP BY u."Id", u."TenantId", r."Id", r."Name"
 ORDER BY role_name;

-- 4. Conferir vínculo societário que habilita autenticação serverless.
SELECT p."Id", p."TenantId", p."Name", p."Email", p."Type",
       p."Status", p."IsErpAccessEnabled", p."PartyId"
  FROM partners p
 WHERE lower(p."Email") = lower('henriquebuzeto@hbstudio.com');

-- 5. Listar quantidade estimada de linhas de todas as tabelas do projeto.
--    Os números do pg_stat_user_tables podem estar defasados; não use
--    estimativas para autorizar exclusões.
SELECT schemaname, relname AS table_name,
       n_live_tup::bigint AS estimated_rows,
       pg_size_pretty(pg_total_relation_size(relid)) AS storage
  FROM pg_stat_user_tables
 WHERE schemaname = 'public'
 ORDER BY estimated_rows DESC, table_name;

-- 6. Contagens exatas (só leitura) nas principais tabelas operacionais.
SELECT 'users' AS entity, count(*) AS rows FROM users
UNION ALL SELECT 'partners', count(*) FROM partners
UNION ALL SELECT 'parties', count(*) FROM parties
UNION ALL SELECT 'product_models', count(*) FROM product_models
UNION ALL SELECT 'product_skus', count(*) FROM product_skus
UNION ALL SELECT 'inventory_units', count(*) FROM inventory_units
UNION ALL SELECT 'stock_balances', count(*) FROM stock_balances
UNION ALL SELECT 'stock_movements', count(*) FROM stock_movements
UNION ALL SELECT 'purchase_orders', count(*) FROM purchase_orders
UNION ALL SELECT 'sales', count(*) FROM sales
UNION ALL SELECT 'cash_shifts', count(*) FROM cash_shifts
UNION ALL SELECT 'repair_orders', count(*) FROM repair_orders
UNION ALL SELECT 'crm_leads', count(*) FROM crm_leads
UNION ALL SELECT 'fleet_vehicles', count(*) FROM fleet_vehicles
UNION ALL SELECT 'fleet_trips', count(*) FROM fleet_trips
UNION ALL SELECT 'manufacturing_orders', count(*) FROM manufacturing_orders
UNION ALL SELECT 'digital_projects', count(*) FROM digital_projects
UNION ALL SELECT 'fiscal_documents', count(*) FROM fiscal_documents
UNION ALL SELECT 'audit_events', count(*) FROM audit_events
ORDER BY entity;

-- 7. Outros usuários (somente contagem, sem dados pessoais):
SELECT count(*) AS other_users_count
  FROM users
 WHERE lower("Email") <> lower('henriquebuzeto@hbstudio.com');

-- NÃO executar TRUNCATE ... CASCADE nem resetar migrations.
-- Não apagar identidade raiz, sócio, relações de papéis, tenants/branches,
-- certificados fiscais reais, livros fiscais, auditoria ou histórico legal
-- sem plano e autorização específica.
