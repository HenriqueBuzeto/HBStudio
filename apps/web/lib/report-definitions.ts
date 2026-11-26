export type ReportColumn={key:string;label:string;format:string};
export type ReportSpec={id:string;group:string;title:string;permissions:string[];mode:string;note:string;columns:ReportColumn[];order:string;sql:string;totals:string[]};
export const REPORTS:ReportSpec[]=[
  {
    "id": "sales",
    "group": "Comercial",
    "title": "Vendas confirmadas",
    "permissions": [
      "sales.pos.use"
    ],
    "mode": "period",
    "note": "Vendas atualmente confirmadas ou entregues por data de confirmação. Ajustes de cabeçalho aplicados uma vez por venda. Devoluções e cancelamentos em relatórios próprios.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "number",
        "label": "Venda",
        "format": "text"
      },
      {
        "key": "seller",
        "label": "Vendedor",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Situação",
        "format": "text"
      },
      {
        "key": "items",
        "label": "Itens",
        "format": "qty"
      },
      {
        "key": "gross",
        "label": "Valor bruto",
        "format": "money"
      },
      {
        "key": "discount",
        "label": "Desconto itens",
        "format": "money"
      },
      {
        "key": "net",
        "label": "Total itens",
        "format": "money"
      },
      {
        "key": "header_discount",
        "label": "Desconto da venda",
        "format": "money"
      },
      {
        "key": "charges",
        "label": "Acréscimos",
        "format": "money"
      },
      {
        "key": "final",
        "label": "Total da venda",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC, number",
    "sql": "SELECT a.\"ConfirmedAtUtc\" AS \"day\",a.\"SaleNumber\" number,coalesce(u.\"FullName\",'Não identificado') seller,CASE a.\"Status\" WHEN 1 THEN 'Rascunho' WHEN 2 THEN 'Reservada' WHEN 3 THEN 'Aguardando pagamento' WHEN 4 THEN 'Confirmada' WHEN 5 THEN 'Entregue' WHEN 6 THEN 'Cancelada' WHEN 7 THEN 'Devolvida parcialmente' WHEN 8 THEN 'Devolvida' ELSE 'Desconhecido' END status,count(i.\"Id\") items,coalesce(sum(i.\"Quantity\"*i.\"UnitPrice\"),0) gross,coalesce(sum(i.\"Discount\"),0) discount,coalesce(sum(i.\"Quantity\"*i.\"UnitPrice\"-i.\"Discount\"),0) net,a.\"DiscountTotal\" header_discount,a.\"ChargesTotal\" charges,greatest(0,round(coalesce(sum(i.\"Quantity\"*i.\"UnitPrice\"-i.\"Discount\"),0)-a.\"DiscountTotal\"+a.\"ChargesTotal\",2)) final FROM sales a LEFT JOIN sale_items i ON i.\"SaleId\"=a.\"Id\" AND i.\"TenantId\"=a.\"TenantId\" LEFT JOIN users u ON u.\"Id\"=a.\"SellerUserId\" AND u.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\" IN(4,5) AND a.\"ConfirmedAtUtc\">=s.start_at AND a.\"ConfirmedAtUtc\"<s.end_at GROUP BY a.\"Id\",u.\"FullName\"",
    "totals": [
      "gross",
      "discount",
      "net",
      "header_discount",
      "charges",
      "final"
    ]
  },
  {
    "id": "products",
    "group": "Comercial",
    "title": "Ranking de produtos vendidos",
    "permissions": [
      "sales.pos.use"
    ],
    "mode": "period",
    "note": "Ranking por quantidade vendida; receita dos itens após desconto de linha. Não equivale a giro contábil (CMV / estoque médio). Vendas confirmadas e entregues; devoluções separadas.",
    "columns": [
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Produto",
        "format": "text"
      },
      {
        "key": "qty",
        "label": "Quantidade vendida",
        "format": "qty"
      },
      {
        "key": "revenue",
        "label": "Receita dos itens",
        "format": "money"
      }
    ],
    "order": "qty DESC, sku, name",
    "sql": "SELECT i.\"HistoricalSkuCode\" sku,i.\"HistoricalDescription\" name,sum(i.\"Quantity\") qty,sum(i.\"Quantity\"*i.\"UnitPrice\"-i.\"Discount\") revenue FROM sales a JOIN sale_items i ON i.\"SaleId\"=a.\"Id\" AND i.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\" IN(4,5) AND a.\"ConfirmedAtUtc\">=s.start_at AND a.\"ConfirmedAtUtc\"<s.end_at GROUP BY 1,2",
    "totals": [
      "revenue"
    ]
  },
  {
    "id": "product-margin",
    "group": "Comercial",
    "title": "Margem bruta por produto",
    "permissions": [
      "sales.pos.use",
      "sales.cost.view"
    ],
    "mode": "period",
    "note": "Margem dos itens com custo histórico registrado. Não inclui despesas, taxas ou ajustes de cabeçalho; custo ausente não é tratado como zero.",
    "columns": [
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Produto",
        "format": "text"
      },
      {
        "key": "revenue",
        "label": "Receita itens",
        "format": "money"
      },
      {
        "key": "cost",
        "label": "CMV registrado",
        "format": "money"
      },
      {
        "key": "profit",
        "label": "Margem bruta",
        "format": "money"
      },
      {
        "key": "missing",
        "label": "Linhas sem custo",
        "format": "qty"
      }
    ],
    "order": "profit DESC NULLS LAST,sku,name",
    "sql": "SELECT i.\"HistoricalSkuCode\" sku,i.\"HistoricalDescription\" name,sum(i.\"Quantity\"*i.\"UnitPrice\"-i.\"Discount\") revenue,CASE WHEN count(*) FILTER(WHERE i.\"HistoricalUnitCost\" IS NULL)=0 THEN sum(i.\"Quantity\"*i.\"HistoricalUnitCost\") END cost,CASE WHEN count(*) FILTER(WHERE i.\"HistoricalUnitCost\" IS NULL)=0 THEN sum(i.\"Quantity\"*i.\"UnitPrice\"-i.\"Discount\"-i.\"Quantity\"*i.\"HistoricalUnitCost\") END profit,count(*) FILTER(WHERE i.\"HistoricalUnitCost\" IS NULL) missing FROM sales a JOIN sale_items i ON i.\"SaleId\"=a.\"Id\" AND i.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\" IN(4,5) AND a.\"ConfirmedAtUtc\">=s.start_at AND a.\"ConfirmedAtUtc\"<s.end_at GROUP BY 1,2",
    "totals": [
      "revenue",
      "missing"
    ]
  },
  {
    "id": "returns",
    "group": "Comercial",
    "title": "Devoluções e cancelamentos",
    "permissions": [
      "sales.pos.use"
    ],
    "mode": "period",
    "note": "Eventos de cancelamento por data e devoluções registradas por criação. Valor devolvido apenas para devolução inspecionada e registrada.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "number",
        "label": "Documento",
        "format": "text"
      },
      {
        "key": "kind",
        "label": "Evento",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Situação",
        "format": "text"
      },
      {
        "key": "amount",
        "label": "Valor devolvido",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,number,kind",
    "sql": "SELECT a.\"CancelledAtUtc\" AS \"day\",a.\"SaleNumber\" number,'Cancelamento' kind,'Cancelada' status,NULL::numeric amount FROM sales a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\"=6 AND a.\"CancelledAtUtc\">=s.start_at AND a.\"CancelledAtUtc\"<s.end_at UNION ALL SELECT r.\"CreatedAtUtc\",r.\"ReturnNumber\",'Devolução',CASE r.\"Status\" WHEN 1 THEN 'Solicitada' WHEN 2 THEN 'Inspecionada e registrada' WHEN 3 THEN 'Rejeitada' WHEN 4 THEN 'Cancelada' ELSE 'Desconhecida' END,CASE WHEN r.\"Status\"=2 THEN sum(i.\"RefundAmount\") END FROM sale_returns r LEFT JOIN sale_return_items i ON i.\"SaleReturnId\"=r.\"Id\" AND i.\"TenantId\"=r.\"TenantId\" CROSS JOIN scope s WHERE r.\"TenantId\"=s.t AND r.\"BranchId\"=s.b AND r.\"CreatedAtUtc\">=s.start_at AND r.\"CreatedAtUtc\"<s.end_at GROUP BY r.\"Id\"",
    "totals": []
  },
  {
    "id": "sales-daily",
    "group": "Comercial",
    "title": "Vendas por dia e ticket médio",
    "permissions": [
      "sales.pos.use"
    ],
    "mode": "period",
    "note": "Agrupa vendas atualmente confirmadas/entregues por data local da confirmação. Ticket médio = valor das vendas / quantidade de vendas. Não é fluxo financeiro.",
    "columns": [
      {
        "key": "day",
        "label": "Dia",
        "format": "day"
      },
      {
        "key": "count",
        "label": "Vendas",
        "format": "qty"
      },
      {
        "key": "total",
        "label": "Total",
        "format": "money"
      },
      {
        "key": "ticket",
        "label": "Ticket médio",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC",
    "sql": "WITH v AS (SELECT a.\"Id\" id,a.\"ConfirmedAtUtc\" confirmed,a.\"SellerUserId\" seller_id,greatest(0,round(coalesce(sum(i.\"Quantity\"*i.\"UnitPrice\"-i.\"Discount\"),0)-a.\"DiscountTotal\"+a.\"ChargesTotal\",2)) total FROM sales a LEFT JOIN sale_items i ON i.\"SaleId\"=a.\"Id\" AND i.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\" IN(4,5) AND a.\"ConfirmedAtUtc\">=s.start_at AND a.\"ConfirmedAtUtc\"<s.end_at GROUP BY a.\"Id\") SELECT (confirmed AT TIME ZONE 'America/Sao_Paulo')::date::text AS \"day\",count(*) count,sum(total) total,round(avg(total),2) ticket FROM v GROUP BY 1",
    "totals": [
      "count",
      "total"
    ]
  },
  {
    "id": "sellers",
    "group": "Comercial",
    "title": "Desempenho por vendedor",
    "permissions": [
      "sales.pos.use"
    ],
    "mode": "period",
    "note": "Vendas atualmente confirmadas/entregues. Não calcula comissão nem receita líquida contábil.",
    "columns": [
      {
        "key": "name",
        "label": "Vendedor",
        "format": "text"
      },
      {
        "key": "count",
        "label": "Vendas",
        "format": "qty"
      },
      {
        "key": "total",
        "label": "Total",
        "format": "money"
      },
      {
        "key": "ticket",
        "label": "Ticket médio",
        "format": "money"
      }
    ],
    "order": "total DESC,name,id",
    "sql": "WITH v AS (SELECT a.\"Id\" id,a.\"ConfirmedAtUtc\" confirmed,a.\"SellerUserId\" seller_id,greatest(0,round(coalesce(sum(i.\"Quantity\"*i.\"UnitPrice\"-i.\"Discount\"),0)-a.\"DiscountTotal\"+a.\"ChargesTotal\",2)) total FROM sales a LEFT JOIN sale_items i ON i.\"SaleId\"=a.\"Id\" AND i.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\" IN(4,5) AND a.\"ConfirmedAtUtc\">=s.start_at AND a.\"ConfirmedAtUtc\"<s.end_at GROUP BY a.\"Id\") SELECT v.seller_id id,coalesce(u.\"FullName\",'Não identificado') name,count(*) count,sum(v.total) total,round(avg(v.total),2) ticket FROM v CROSS JOIN scope s LEFT JOIN users u ON u.\"Id\"=v.seller_id AND u.\"TenantId\"=s.t GROUP BY v.seller_id,u.\"FullName\"",
    "totals": [
      "count",
      "total"
    ]
  },
  {
    "id": "payments",
    "group": "Comercial",
    "title": "Pagamentos confirmados por meio",
    "permissions": [
      "sales.pos.use"
    ],
    "mode": "period",
    "note": "Confirmações de pagamento atualmente válidas, pela data de confirmação. Não representa repasse bancário; não inclui intenções pendentes ou estornadas.",
    "columns": [
      {
        "key": "method",
        "label": "Meio de pagamento",
        "format": "text"
      },
      {
        "key": "count",
        "label": "Pagamentos",
        "format": "qty"
      },
      {
        "key": "amount",
        "label": "Valor confirmado",
        "format": "money"
      }
    ],
    "order": "amount DESC,method",
    "sql": "SELECT CASE i.\"Method\" WHEN 1 THEN 'Dinheiro' WHEN 2 THEN 'Pix' WHEN 3 THEN 'Crédito' WHEN 4 THEN 'Débito' WHEN 5 THEN 'Crédito de recompra' ELSE 'Outro' END method,count(*) count,sum(i.\"Amount\") amount FROM sale_payment_intents i JOIN sales a ON a.\"Id\"=i.\"SaleId\" AND a.\"TenantId\"=i.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND i.\"Status\"=2 AND a.\"Status\" IN(4,5) AND i.\"ConfirmedAtUtc\">=s.start_at AND i.\"ConfirmedAtUtc\"<s.end_at GROUP BY 1",
    "totals": [
      "count",
      "amount"
    ]
  },
  {
    "id": "abc",
    "group": "Comercial",
    "title": "Curva ABC por receita de itens",
    "permissions": [
      "sales.pos.use"
    ],
    "mode": "period",
    "note": "Participação no total dos itens com receita positiva (antes de ajustes de cabeçalho). A: primeiros 80%; B: até 95%; C: restante. Classificação pela participação acumulada anterior ao SKU/descrição; devoluções separadas.",
    "columns": [
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Produto",
        "format": "text"
      },
      {
        "key": "revenue",
        "label": "Receita",
        "format": "money"
      },
      {
        "key": "share",
        "label": "Participação (%)",
        "format": "qty"
      },
      {
        "key": "cumulative",
        "label": "Acumulado (%)",
        "format": "qty"
      },
      {
        "key": "class",
        "label": "Classe ABC",
        "format": "text"
      }
    ],
    "order": "revenue DESC,sku,name",
    "sql": "WITH v AS (SELECT i.\"HistoricalSkuCode\" sku,i.\"HistoricalDescription\" name,sum(i.\"Quantity\") qty,sum(i.\"Quantity\"*i.\"UnitPrice\"-i.\"Discount\") revenue FROM sales a JOIN sale_items i ON i.\"SaleId\"=a.\"Id\" AND i.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\" IN(4,5) AND a.\"ConfirmedAtUtc\">=s.start_at AND a.\"ConfirmedAtUtc\"<s.end_at GROUP BY 1,2), w AS (SELECT *,sum(revenue) OVER() total,sum(revenue) OVER(ORDER BY revenue DESC,sku,name ROWS UNBOUNDED PRECEDING) cumulative FROM v WHERE revenue>0) SELECT sku,name,revenue,round(100*revenue/nullif(total,0),2) share,round(100*cumulative/nullif(total,0),2) cumulative,CASE WHEN (cumulative-revenue)/nullif(total,0)<0.80 THEN 'A' WHEN (cumulative-revenue)/nullif(total,0)<0.95 THEN 'B' ELSE 'C' END class FROM w",
    "totals": [
      "revenue"
    ]
  },
  {
    "id": "cash",
    "group": "Caixa",
    "title": "Extrato de caixa: entradas e saídas",
    "permissions": [
      "cash.shift.view",
      "cash.movement.view"
    ],
    "mode": "period",
    "note": "Fundo inicial, suprimentos e sangrias não são faturamento. Valores por direção do movimento, incluindo reversões.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "register",
        "label": "Caixa",
        "format": "text"
      },
      {
        "key": "kind",
        "label": "Movimento",
        "format": "text"
      },
      {
        "key": "reference",
        "label": "Documento",
        "format": "text"
      },
      {
        "key": "incoming",
        "label": "Entrada",
        "format": "money"
      },
      {
        "key": "outgoing",
        "label": "Saída",
        "format": "money"
      },
      {
        "key": "net",
        "label": "Variação",
        "format": "money"
      },
      {
        "key": "reason",
        "label": "Motivo",
        "format": "text"
      }
    ],
    "order": "\"day\" DESC,id",
    "sql": "SELECT m.\"Id\" id,m.\"CreatedAtUtc\" AS \"day\",r.\"Code\" register,CASE m.\"MovementType\" WHEN 1 THEN 'Fundo inicial' WHEN 2 THEN 'Recebimento de venda' WHEN 3 THEN 'Estorno' WHEN 4 THEN 'Suprimento' WHEN 5 THEN 'Sangria' WHEN 6 THEN 'Transferência' WHEN 7 THEN 'Ajuste' WHEN 8 THEN 'Reversão' ELSE 'Não classificado' END kind,m.\"DocumentReference\" reference,CASE WHEN m.\"Direction\"=1 THEN m.\"Amount\" ELSE 0 END incoming,CASE WHEN m.\"Direction\"=2 THEN m.\"Amount\" ELSE 0 END outgoing,CASE WHEN m.\"Direction\"=1 THEN m.\"Amount\" WHEN m.\"Direction\"=2 THEN -m.\"Amount\" END net,m.\"Reason\" reason FROM cash_movements m JOIN cash_registers r ON r.\"Id\"=m.\"CashRegisterId\" AND r.\"TenantId\"=m.\"TenantId\" AND r.\"BranchId\"=m.\"BranchId\" CROSS JOIN scope s WHERE m.\"TenantId\"=s.t AND m.\"BranchId\"=s.b AND m.\"CreatedAtUtc\">=s.start_at AND m.\"CreatedAtUtc\"<s.end_at",
    "totals": [
      "incoming",
      "outgoing",
      "net"
    ]
  },
  {
    "id": "cash-types",
    "group": "Caixa",
    "title": "Resumo por tipo de movimento",
    "permissions": [
      "cash.shift.view",
      "cash.movement.view"
    ],
    "mode": "period",
    "note": "Classificação operacional; não é demonstração de fluxo de caixa contábil.",
    "columns": [
      {
        "key": "kind",
        "label": "Tipo",
        "format": "text"
      },
      {
        "key": "events",
        "label": "Movimentos",
        "format": "qty"
      },
      {
        "key": "incoming",
        "label": "Entradas",
        "format": "money"
      },
      {
        "key": "outgoing",
        "label": "Saídas",
        "format": "money"
      },
      {
        "key": "net",
        "label": "Variação",
        "format": "money"
      }
    ],
    "order": "kind",
    "sql": "SELECT CASE m.\"MovementType\" WHEN 1 THEN 'Fundo inicial' WHEN 2 THEN 'Recebimento de venda' WHEN 3 THEN 'Estorno' WHEN 4 THEN 'Suprimento' WHEN 5 THEN 'Sangria' WHEN 6 THEN 'Transferência' WHEN 7 THEN 'Ajuste' WHEN 8 THEN 'Reversão' ELSE 'Não classificado' END kind,count(*) events,sum(CASE WHEN m.\"Direction\"=1 THEN m.\"Amount\" ELSE 0 END) incoming,sum(CASE WHEN m.\"Direction\"=2 THEN m.\"Amount\" ELSE 0 END) outgoing,sum(CASE WHEN m.\"Direction\"=1 THEN m.\"Amount\" WHEN m.\"Direction\"=2 THEN -m.\"Amount\" END) net FROM cash_movements m CROSS JOIN scope s WHERE m.\"TenantId\"=s.t AND m.\"BranchId\"=s.b AND m.\"CreatedAtUtc\">=s.start_at AND m.\"CreatedAtUtc\"<s.end_at GROUP BY 1",
    "totals": [
      "events",
      "incoming",
      "outgoing",
      "net"
    ]
  },
  {
    "id": "shifts",
    "group": "Caixa",
    "title": "Turnos e conferência",
    "permissions": [
      "cash.shift.view"
    ],
    "mode": "period",
    "note": "Turnos abertos no período, com situação atual. Saldo registrado não substitui dinheiro conferido.",
    "columns": [
      {
        "key": "opened",
        "label": "Abertura",
        "format": "date"
      },
      {
        "key": "closed",
        "label": "Fechamento",
        "format": "date"
      },
      {
        "key": "register",
        "label": "Caixa",
        "format": "text"
      },
      {
        "key": "operator",
        "label": "Operador",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Situação",
        "format": "text"
      },
      {
        "key": "opening",
        "label": "Fundo inicial",
        "format": "money"
      },
      {
        "key": "balance",
        "label": "Saldo registrado",
        "format": "money"
      },
      {
        "key": "counted",
        "label": "Contado",
        "format": "money"
      },
      {
        "key": "difference",
        "label": "Diferença",
        "format": "money"
      }
    ],
    "order": "opened DESC,id",
    "sql": "SELECT a.\"Id\" id,a.\"OpenedAtUtc\" opened,a.\"ClosedAtUtc\" closed,r.\"Code\" register,u.\"FullName\" operator,CASE a.\"Status\" WHEN 1 THEN 'Aberto' WHEN 2 THEN 'Em fechamento' WHEN 3 THEN 'Contagem enviada' WHEN 4 THEN 'Aprovado' WHEN 5 THEN 'Fechado' END status,a.\"OpeningFloat\" opening,a.\"CurrentBalance\" balance,a.\"CountedCashBalance\" counted,a.\"DiscrepancyAmount\" difference FROM cash_shifts a JOIN cash_registers r ON r.\"Id\"=a.\"CashRegisterId\" AND r.\"TenantId\"=a.\"TenantId\" AND r.\"BranchId\"=a.\"BranchId\" LEFT JOIN users u ON u.\"Id\"=a.\"OperatorUserId\" AND u.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"OpenedAtUtc\">=s.start_at AND a.\"OpenedAtUtc\"<s.end_at",
    "totals": []
  },
  {
    "id": "stock",
    "group": "Estoque",
    "title": "Posição física por SKU e depósito",
    "permissions": [
      "inventory.view"
    ],
    "mode": "current",
    "note": "Posição atual, não retroativa. Filamentos em gramas segundo a configuração do saldo; demais itens em unidades. Não soma medidas incompatíveis.",
    "columns": [
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Produto",
        "format": "text"
      },
      {
        "key": "warehouse",
        "label": "Depósito",
        "format": "text"
      },
      {
        "key": "unit",
        "label": "Medida",
        "format": "text"
      },
      {
        "key": "physical",
        "label": "Físico",
        "format": "qty"
      },
      {
        "key": "reserved",
        "label": "Reservado",
        "format": "qty"
      },
      {
        "key": "blocked",
        "label": "Bloqueado",
        "format": "qty"
      },
      {
        "key": "available",
        "label": "Disponível",
        "format": "qty"
      }
    ],
    "order": "sku,warehouse,id",
    "sql": "SELECT a.\"Id\" id,k.\"SkuCode\" sku,m.\"Name\"||' · '||k.\"VariantName\" name,w.\"Name\" warehouse,CASE WHEN c.kind='FILAMENT' THEN 'g' ELSE 'un' END unit,a.\"OnHandQuantity\"*(CASE WHEN c.kind='FILAMENT' THEN c.units_per_stock_unit ELSE 1 END) physical,a.\"ReservedQuantity\"*(CASE WHEN c.kind='FILAMENT' THEN c.units_per_stock_unit ELSE 1 END) reserved,a.\"BlockedQuantity\"*(CASE WHEN c.kind='FILAMENT' THEN c.units_per_stock_unit ELSE 1 END) blocked,(a.\"OnHandQuantity\"-a.\"ReservedQuantity\"-a.\"BlockedQuantity\")*(CASE WHEN c.kind='FILAMENT' THEN c.units_per_stock_unit ELSE 1 END) available FROM stock_balances a JOIN product_skus k ON k.\"Id\"=a.\"ProductSkuId\" AND k.\"TenantId\"=a.\"TenantId\" JOIN product_models m ON m.\"Id\"=k.\"ProductModelId\" AND m.\"TenantId\"=a.\"TenantId\" JOIN warehouses w ON w.\"Id\"=a.\"WarehouseId\" AND w.\"TenantId\"=a.\"TenantId\" AND w.\"BranchId\"=a.\"BranchId\" LEFT JOIN manufacturing_material_balance_configs c ON c.balance_id=a.\"Id\" AND c.tenant_id=a.\"TenantId\" AND c.branch_id=a.\"BranchId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b",
    "totals": []
  },
  {
    "id": "stock-value",
    "group": "Estoque",
    "title": "Valoração do estoque",
    "permissions": [
      "inventory.view",
      "inventory.cost.view"
    ],
    "mode": "current",
    "note": "Posição atual ao custo médio registrado. Não representa preço de venda.",
    "columns": [
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "warehouse",
        "label": "Depósito",
        "format": "text"
      },
      {
        "key": "unit",
        "label": "Medida",
        "format": "text"
      },
      {
        "key": "quantity",
        "label": "Quantidade",
        "format": "qty"
      },
      {
        "key": "value",
        "label": "Valor em estoque",
        "format": "money"
      }
    ],
    "order": "value DESC,sku,id",
    "sql": "SELECT a.\"Id\" id,k.\"SkuCode\" sku,w.\"Name\" warehouse,CASE WHEN c.kind='FILAMENT' THEN 'g' ELSE 'un' END unit,a.\"OnHandQuantity\"*(CASE WHEN c.kind='FILAMENT' THEN c.units_per_stock_unit ELSE 1 END) quantity,round(a.\"OnHandQuantity\"*a.\"AverageCost\",2) value FROM stock_balances a JOIN product_skus k ON k.\"Id\"=a.\"ProductSkuId\" AND k.\"TenantId\"=a.\"TenantId\" JOIN product_models m ON m.\"Id\"=k.\"ProductModelId\" AND m.\"TenantId\"=a.\"TenantId\" JOIN warehouses w ON w.\"Id\"=a.\"WarehouseId\" AND w.\"TenantId\"=a.\"TenantId\" AND w.\"BranchId\"=a.\"BranchId\" LEFT JOIN manufacturing_material_balance_configs c ON c.balance_id=a.\"Id\" AND c.tenant_id=a.\"TenantId\" AND c.branch_id=a.\"BranchId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b",
    "totals": [
      "value"
    ]
  },
  {
    "id": "kardex",
    "group": "Estoque",
    "title": "Kardex: entradas, saídas e produção",
    "permissions": [
      "inventory.view"
    ],
    "mode": "period",
    "note": "Quantidade assinada e saldo posterior do registro oficial. Unidade inferida da configuração atual do mesmo SKU/depósito/local; ambiguidades ficam sem conversão.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "warehouse",
        "label": "Depósito",
        "format": "text"
      },
      {
        "key": "kind",
        "label": "Movimento",
        "format": "text"
      },
      {
        "key": "unit",
        "label": "Medida",
        "format": "text"
      },
      {
        "key": "qty",
        "label": "Quantidade",
        "format": "qty"
      },
      {
        "key": "balance",
        "label": "Saldo posterior",
        "format": "qty"
      },
      {
        "key": "reference",
        "label": "Documento",
        "format": "text"
      }
    ],
    "order": "\"day\" DESC,id",
    "sql": "SELECT a.\"Id\" id,a.\"CreatedAtUtc\" AS \"day\",k.\"SkuCode\" sku,w.\"Name\" warehouse,CASE a.\"MovementType\" WHEN 1 THEN 'Saldo inicial' WHEN 2 THEN 'Compra' WHEN 3 THEN 'Recompra' WHEN 4 THEN 'Venda' WHEN 5 THEN 'Transferência saída' WHEN 6 THEN 'Transferência entrada' WHEN 7 THEN 'Ajuste positivo' WHEN 8 THEN 'Ajuste negativo' WHEN 9 THEN 'Consumo técnico' WHEN 10 THEN 'Consumo 3D' WHEN 11 THEN 'Produto fabricado' ELSE 'Outro' END kind,CASE WHEN z.factor IS NULL THEN 'Não identificada' WHEN z.factor=0 THEN 'un' ELSE 'g' END unit,a.\"Quantity\"*nullif(CASE WHEN z.factor=0 THEN 1 ELSE z.factor END,0) qty,a.\"BalanceAfterQuantity\"*nullif(CASE WHEN z.factor=0 THEN 1 ELSE z.factor END,0) balance,a.\"DocumentReference\" reference FROM stock_movements a JOIN product_skus k ON k.\"Id\"=a.\"ProductSkuId\" AND k.\"TenantId\"=a.\"TenantId\" JOIN warehouses w ON w.\"Id\"=a.\"WarehouseId\" AND w.\"TenantId\"=a.\"TenantId\" AND w.\"BranchId\"=a.\"BranchId\" LEFT JOIN LATERAL(SELECT CASE WHEN count(DISTINCT coalesce(CASE WHEN c.kind='FILAMENT' THEN c.units_per_stock_unit END,0))=1 THEN max(coalesce(CASE WHEN c.kind='FILAMENT' THEN c.units_per_stock_unit END,0)) END factor FROM stock_balances b LEFT JOIN manufacturing_material_balance_configs c ON c.balance_id=b.\"Id\" AND c.tenant_id=b.\"TenantId\" AND c.branch_id=b.\"BranchId\" WHERE b.\"TenantId\"=a.\"TenantId\" AND b.\"BranchId\"=a.\"BranchId\" AND b.\"WarehouseId\"=a.\"WarehouseId\" AND b.\"ProductSkuId\"=a.\"ProductSkuId\" AND b.\"WarehouseLocationId\" IS NOT DISTINCT FROM a.\"WarehouseLocationId\") z ON true CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": []
  },
  {
    "id": "slow-stock",
    "group": "Estoque",
    "title": "Estoque sem venda no período",
    "permissions": [
      "inventory.view",
      "sales.pos.use"
    ],
    "mode": "period",
    "note": "Posição física atual de mercadorias e peças não serializadas ou serializadas, com nenhuma venda confirmada no período. Não é idade do lote.",
    "columns": [
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Produto",
        "format": "text"
      },
      {
        "key": "warehouse",
        "label": "Depósito",
        "format": "text"
      },
      {
        "key": "available",
        "label": "Disponível",
        "format": "qty"
      },
      {
        "key": "last",
        "label": "Última movimentação",
        "format": "date"
      }
    ],
    "order": "sku,warehouse,id",
    "sql": "SELECT a.\"Id\" id,k.\"SkuCode\" sku,m.\"Name\" name,w.\"Name\" warehouse,a.\"OnHandQuantity\"-a.\"ReservedQuantity\"-a.\"BlockedQuantity\" available,a.\"LastMovementAtUtc\" last FROM stock_balances a JOIN product_skus k ON k.\"Id\"=a.\"ProductSkuId\" AND k.\"TenantId\"=a.\"TenantId\" JOIN product_models m ON m.\"Id\"=k.\"ProductModelId\" AND m.\"TenantId\"=a.\"TenantId\" JOIN warehouses w ON w.\"Id\"=a.\"WarehouseId\" AND w.\"TenantId\"=a.\"TenantId\" AND w.\"BranchId\"=a.\"BranchId\" LEFT JOIN manufacturing_material_balance_configs c ON c.balance_id=a.\"Id\" AND c.tenant_id=a.\"TenantId\" AND c.branch_id=a.\"BranchId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND m.\"Kind\" IN(1,3,5) AND c.balance_id IS NULL AND a.\"OnHandQuantity\">0 AND NOT EXISTS(SELECT 1 FROM sale_items i JOIN sales v ON v.\"Id\"=i.\"SaleId\" AND v.\"TenantId\"=i.\"TenantId\" WHERE i.\"TenantId\"=a.\"TenantId\" AND i.\"ProductSkuId\"=a.\"ProductSkuId\" AND v.\"BranchId\"=a.\"BranchId\" AND v.\"Status\" IN(4,5) AND v.\"ConfirmedAtUtc\">=s.start_at AND v.\"ConfirmedAtUtc\"<s.end_at)",
    "totals": []
  },
  {
    "id": "turnover",
    "group": "Estoque",
    "title": "Giro físico por SKU",
    "permissions": [
      "inventory.view"
    ],
    "mode": "period",
    "note": "Saídas brutas de venda do Kardex ÷ estoque médio diário de fechamento reconstruído pela quantidade assinada. Apenas mercadorias, peças e acabados em unidades. O giro é calculado quando o saldo agregado atual por SKU reconcilia com o histórico de movimentos registrado e o período não é futuro. Não é giro contábil CMV/valor médio; dias sem registros são tratados conforme o histórico disponível.",
    "columns": [
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Produto",
        "format": "text"
      },
      {
        "key": "outgoing",
        "label": "Saídas de venda (un)",
        "format": "qty"
      },
      {
        "key": "average",
        "label": "Estoque médio (un)",
        "format": "qty"
      },
      {
        "key": "turns",
        "label": "Giros físicos",
        "format": "qty"
      },
      {
        "key": "coverage",
        "label": "Conferência",
        "format": "text"
      }
    ],
    "order": "turns DESC NULLS LAST,sku,id",
    "sql": "WITH candidates AS (\n SELECT k.\"Id\" id,k.\"SkuCode\" sku,m.\"Name\" name FROM product_skus k JOIN product_models m ON m.\"Id\"=k.\"ProductModelId\" AND m.\"TenantId\"=k.\"TenantId\" CROSS JOIN scope s WHERE k.\"TenantId\"=s.t AND m.\"Kind\" IN(1,3,5) AND NOT EXISTS(SELECT 1 FROM stock_balances b JOIN manufacturing_material_balance_configs c ON c.balance_id=b.\"Id\" AND c.tenant_id=b.\"TenantId\" AND c.branch_id=b.\"BranchId\" WHERE b.\"TenantId\"=s.t AND b.\"BranchId\"=s.b AND b.\"ProductSkuId\"=k.\"Id\")\n ), current_bal AS(SELECT b.\"ProductSkuId\" id,sum(b.\"OnHandQuantity\") balance FROM stock_balances b CROSS JOIN scope s WHERE b.\"TenantId\"=s.t AND b.\"BranchId\"=s.b GROUP BY 1),\n ledger AS(SELECT m.\"ProductSkuId\" id,sum(m.\"Quantity\") all_qty,coalesce(sum(m.\"Quantity\") FILTER(WHERE m.\"CreatedAtUtc\"<s.start_at),0) opening,coalesce(sum(m.\"Quantity\"*((s.end_at AT TIME ZONE 'America/Sao_Paulo')::date-(m.\"CreatedAtUtc\" AT TIME ZONE 'America/Sao_Paulo')::date)) FILTER(WHERE m.\"CreatedAtUtc\">=s.start_at AND m.\"CreatedAtUtc\"<s.end_at),0) weighted,coalesce(sum(-m.\"Quantity\") FILTER(WHERE m.\"CreatedAtUtc\">=s.start_at AND m.\"CreatedAtUtc\"<s.end_at AND m.\"MovementType\"=4 AND m.\"Quantity\"<0),0) outgoing FROM stock_movements m CROSS JOIN scope s WHERE m.\"TenantId\"=s.t AND m.\"BranchId\"=s.b GROUP BY 1),\n combined AS(SELECT k.*,coalesce(l.outgoing,0) outgoing,CASE WHEN coalesce(c.balance,0)=coalesce(l.all_qty,0) AND l.id IS NOT NULL AND s.end_at<=(date_trunc('day',now() AT TIME ZONE 'America/Sao_Paulo')+interval '1 day') AT TIME ZONE 'America/Sao_Paulo' THEN l.opening+l.weighted/nullif((s.end_at AT TIME ZONE 'America/Sao_Paulo')::date-(s.start_at AT TIME ZONE 'America/Sao_Paulo')::date,0) END avg_qty FROM candidates k LEFT JOIN current_bal c USING(id) LEFT JOIN ledger l USING(id) CROSS JOIN scope s WHERE c.id IS NOT NULL OR l.id IS NOT NULL)\n SELECT id,sku,name,outgoing,round(avg_qty,4) average,CASE WHEN avg_qty>0 THEN round(outgoing/avg_qty,4) END turns,CASE WHEN avg_qty IS NULL THEN 'Histórico não reconciliado ou período futuro' WHEN avg_qty<=0 THEN 'Sem base média positiva' ELSE 'Quantidade reconciliada' END coverage FROM combined",
    "totals": []
  },
  {
    "id": "purchases",
    "group": "Compras",
    "title": "Pedidos e recebimentos",
    "permissions": [
      "purchases.view"
    ],
    "mode": "period",
    "note": "Pedidos criados no período; quantidade pedida e recebida por item. Não soma medidas distintas.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "number",
        "label": "Pedido",
        "format": "text"
      },
      {
        "key": "supplier",
        "label": "Fornecedor",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Situação",
        "format": "text"
      },
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "ordered",
        "label": "Qtd. pedida",
        "format": "qty"
      },
      {
        "key": "received",
        "label": "Qtd. recebida",
        "format": "qty"
      }
    ],
    "order": "\"day\" DESC,number,id",
    "sql": "SELECT i.\"Id\" id,a.\"CreatedAtUtc\" AS \"day\",a.\"OrderNumber\" number,p.\"Name\" supplier,CASE a.\"Status\" WHEN 1 THEN 'Rascunho' WHEN 2 THEN 'Enviado' WHEN 3 THEN 'Aprovado' WHEN 4 THEN 'Pedido' WHEN 5 THEN 'Parcial' WHEN 6 THEN 'Recebido' WHEN 7 THEN 'Fechado' WHEN 8 THEN 'Cancelado' WHEN 9 THEN 'Rejeitado' END status,i.\"HistoricalSkuCode\" sku,i.\"QuantityOrdered\" ordered,i.\"QuantityReceived\" received FROM purchase_orders a JOIN purchase_order_items i ON i.\"PurchaseOrderId\"=a.\"Id\" AND i.\"TenantId\"=a.\"TenantId\" LEFT JOIN parties p ON p.\"Id\"=a.\"SupplierPartyId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": []
  },
  {
    "id": "receipt-cost",
    "group": "Compras",
    "title": "Recebimentos aprovados e custos",
    "permissions": [
      "purchases.view",
      "purchases.cost.view"
    ],
    "mode": "period",
    "note": "Itens de recebimentos aprovados e lançados. Data de criação do recebimento, não data de pagamento.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "number",
        "label": "Recebimento",
        "format": "text"
      },
      {
        "key": "supplier",
        "label": "Fornecedor",
        "format": "text"
      },
      {
        "key": "sku",
        "label": "SKU",
        "format": "text"
      },
      {
        "key": "quantity",
        "label": "Qtd. registrada",
        "format": "qty"
      },
      {
        "key": "cost",
        "label": "Custo total",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,number,id",
    "sql": "SELECT i.\"Id\" id,a.\"CreatedAtUtc\" AS \"day\",a.\"ReceiptNumber\" number,p.\"Name\" supplier,k.\"SkuCode\" sku,i.\"QuantityReceived\" quantity,round(i.\"QuantityReceived\"*i.\"RealUnitCost\",2) cost FROM goods_receipts a JOIN goods_receipt_items i ON i.\"GoodsReceiptId\"=a.\"Id\" AND i.\"TenantId\"=a.\"TenantId\" JOIN product_skus k ON k.\"Id\"=i.\"ProductSkuId\" AND k.\"TenantId\"=a.\"TenantId\" LEFT JOIN parties p ON p.\"Id\"=a.\"SupplierPartyId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\"=2 AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": [
      "cost"
    ]
  },
  {
    "id": "payables",
    "group": "Financeiro",
    "title": "Contas a pagar",
    "permissions": [
      "finance.reports.view",
      "finance.payables.view"
    ],
    "mode": "current",
    "note": "Títulos abertos ou parcialmente liquidados na posição atual. Vencidos conforme data local. Não representa fluxo realizado.",
    "columns": [
      {
        "key": "number",
        "label": "Título",
        "format": "text"
      },
      {
        "key": "party",
        "label": "Contraparte",
        "format": "text"
      },
      {
        "key": "due",
        "label": "Vencimento",
        "format": "date"
      },
      {
        "key": "original",
        "label": "Original",
        "format": "money"
      },
      {
        "key": "settled",
        "label": "Liquidado",
        "format": "money"
      },
      {
        "key": "balance",
        "label": "Saldo",
        "format": "money"
      },
      {
        "key": "aging",
        "label": "Situação",
        "format": "text"
      }
    ],
    "order": "due,number,id",
    "sql": "SELECT a.\"Id\" id,a.\"TitleNumber\" number,p.\"Name\" party,a.\"DueDateUtc\" due,a.\"OriginalAmount\" original,a.\"PaidAmount\" settled,greatest(0,a.\"OriginalAmount\"-a.\"PaidAmount\") balance,CASE WHEN (a.\"DueDateUtc\" AT TIME ZONE 'America/Sao_Paulo')::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'Vencido' ELSE 'A vencer' END aging FROM accounts_payable a LEFT JOIN parties p ON p.\"Id\"=a.\"SupplierPartyId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\" IN(2,3)",
    "totals": [
      "original",
      "settled",
      "balance"
    ]
  },
  {
    "id": "receivables",
    "group": "Financeiro",
    "title": "Contas a receber",
    "permissions": [
      "finance.reports.view",
      "finance.receivables.view"
    ],
    "mode": "current",
    "note": "Títulos abertos ou parcialmente liquidados na posição atual. Vencidos conforme data local. Não representa fluxo realizado.",
    "columns": [
      {
        "key": "number",
        "label": "Título",
        "format": "text"
      },
      {
        "key": "party",
        "label": "Contraparte",
        "format": "text"
      },
      {
        "key": "due",
        "label": "Vencimento",
        "format": "date"
      },
      {
        "key": "original",
        "label": "Original",
        "format": "money"
      },
      {
        "key": "settled",
        "label": "Liquidado",
        "format": "money"
      },
      {
        "key": "balance",
        "label": "Saldo",
        "format": "money"
      },
      {
        "key": "aging",
        "label": "Situação",
        "format": "text"
      }
    ],
    "order": "due,number,id",
    "sql": "SELECT a.\"Id\" id,a.\"TitleNumber\" number,p.\"Name\" party,a.\"DueDateUtc\" due,a.\"OriginalAmount\" original,a.\"ReceivedAmount\" settled,greatest(0,a.\"OriginalAmount\"-a.\"ReceivedAmount\") balance,CASE WHEN (a.\"DueDateUtc\" AT TIME ZONE 'America/Sao_Paulo')::date < (now() AT TIME ZONE 'America/Sao_Paulo')::date THEN 'Vencido' ELSE 'A vencer' END aging FROM accounts_receivable a LEFT JOIN parties p ON p.\"Id\"=a.\"CustomerPartyId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"Status\" IN(2,3)",
    "totals": [
      "original",
      "settled",
      "balance"
    ]
  },
  {
    "id": "settlements",
    "group": "Financeiro",
    "title": "Liquidações realizadas",
    "permissions": [
      "finance.reports.view",
      "finance.payables.view",
      "finance.receivables.view"
    ],
    "mode": "period",
    "note": "Liquidações financeiras registradas. Não somar ao caixa ou ao extrato bancário: podem representar o mesmo evento.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "reference",
        "label": "Referência",
        "format": "text"
      },
      {
        "key": "kind",
        "label": "Tipo",
        "format": "text"
      },
      {
        "key": "amount",
        "label": "Valor",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,id",
    "sql": "SELECT a.\"Id\" id,a.\"SettlementDateUtc\" AS \"day\",a.\"ReferenceNumber\" reference,CASE a.\"Type\" WHEN 1 THEN 'Pagamento' WHEN 2 THEN 'Recebimento' ELSE 'Outro' END kind,a.\"Amount\" amount FROM financial_settlements a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"SettlementDateUtc\">=s.start_at AND a.\"SettlementDateUtc\"<s.end_at",
    "totals": []
  },
  {
    "id": "ledger",
    "group": "Financeiro",
    "title": "Razão contábil e conferência",
    "permissions": [
      "finance.reports.view",
      "finance.journal.view"
    ],
    "mode": "period",
    "note": "Débitos e créditos de todos os lançamentos registrados no período por competência, incluindo reversões. Não é DRE homologada.",
    "columns": [
      {
        "key": "day",
        "label": "Competência",
        "format": "date"
      },
      {
        "key": "number",
        "label": "Documento",
        "format": "text"
      },
      {
        "key": "source",
        "label": "Origem",
        "format": "text"
      },
      {
        "key": "description",
        "label": "Descrição",
        "format": "text"
      },
      {
        "key": "debit",
        "label": "Débitos",
        "format": "money"
      },
      {
        "key": "credit",
        "label": "Créditos",
        "format": "money"
      },
      {
        "key": "difference",
        "label": "Diferença",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,number,id",
    "sql": "SELECT a.\"Id\" id,a.\"CompetenceDateUtc\" AS \"day\",a.\"DocumentNumber\" number,a.\"SourceType\" source,a.\"Description\" description,coalesce(sum(l.\"Amount\") FILTER(WHERE l.\"Direction\"=1),0) debit,coalesce(sum(l.\"Amount\") FILTER(WHERE l.\"Direction\"=2),0) credit,coalesce(sum(CASE WHEN l.\"Direction\"=1 THEN l.\"Amount\" WHEN l.\"Direction\"=2 THEN -l.\"Amount\" END),0) difference FROM financial_journal_entries a LEFT JOIN financial_journal_lines l ON l.\"FinancialJournalEntryId\"=a.\"Id\" AND l.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CompetenceDateUtc\">=s.start_at AND a.\"CompetenceDateUtc\"<s.end_at GROUP BY a.\"Id\"",
    "totals": [
      "debit",
      "credit",
      "difference"
    ]
  },
  {
    "id": "result",
    "group": "Financeiro",
    "title": "Resultado por contas registradas",
    "permissions": [
      "finance.reports.view",
      "finance.journal.view"
    ],
    "mode": "period",
    "note": "Demonstrativo gerencial provisório por competência. Apenas contas de receita/despesa com lançamentos; não certifica DRE completa, impostos ou fechamento.",
    "columns": [
      {
        "key": "code",
        "label": "Conta",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Descrição",
        "format": "text"
      },
      {
        "key": "kind",
        "label": "Grupo",
        "format": "text"
      },
      {
        "key": "revenue",
        "label": "Receita líquida registrada",
        "format": "money"
      },
      {
        "key": "expense",
        "label": "Despesa líquida registrada",
        "format": "money"
      },
      {
        "key": "result",
        "label": "Resultado registrado",
        "format": "money"
      }
    ],
    "order": "code",
    "sql": "SELECT f.\"Code\" code,f.\"Name\" name,CASE f.\"Type\" WHEN 4 THEN 'Receita' ELSE 'Despesa/custo' END kind,sum(CASE WHEN f.\"Type\"=4 THEN CASE l.\"Direction\" WHEN 2 THEN l.\"Amount\" ELSE -l.\"Amount\" END ELSE 0 END) revenue,sum(CASE WHEN f.\"Type\"=5 THEN CASE l.\"Direction\" WHEN 1 THEN l.\"Amount\" ELSE -l.\"Amount\" END ELSE 0 END) expense,sum(CASE l.\"Direction\" WHEN 2 THEN l.\"Amount\" ELSE -l.\"Amount\" END) result FROM financial_journal_entries a JOIN financial_journal_lines l ON l.\"FinancialJournalEntryId\"=a.\"Id\" AND l.\"TenantId\"=a.\"TenantId\" JOIN financial_accounts f ON f.\"Id\"=l.\"FinancialAccountId\" AND f.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CompetenceDateUtc\">=s.start_at AND a.\"CompetenceDateUtc\"<s.end_at AND f.\"Type\" IN(4,5) GROUP BY f.\"Id\"",
    "totals": [
      "revenue",
      "expense",
      "result"
    ]
  },
  {
    "id": "banks",
    "group": "Financeiro",
    "title": "Extrato bancário registrado",
    "permissions": [
      "finance.reports.view",
      "finance.banks.manage"
    ],
    "mode": "period",
    "note": "Movimentos bancários registrados, inclusive não conciliados. Não equivale a conciliação concluída ou saldo de caixa físico.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "bank",
        "label": "Banco",
        "format": "text"
      },
      {
        "key": "memo",
        "label": "Descrição",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Conciliação",
        "format": "text"
      },
      {
        "key": "amount",
        "label": "Valor",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,id",
    "sql": "SELECT a.\"Id\" id,a.\"TransactionDateUtc\" AS \"day\",b.\"BankName\" bank,a.\"Memo\" memo,CASE a.\"Status\" WHEN 1 THEN 'Pendente' WHEN 2 THEN 'Conciliado' WHEN 3 THEN 'Divergência' END status,a.\"Amount\" amount FROM bank_transactions a JOIN bank_accounts b ON b.\"Id\"=a.\"BankAccountId\" AND b.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND b.\"BranchId\"=s.b AND a.\"TransactionDateUtc\">=s.start_at AND a.\"TransactionDateUtc\"<s.end_at",
    "totals": [
      "amount"
    ]
  },
  {
    "id": "acquirers",
    "group": "Financeiro",
    "title": "Taxas e repasses de adquirentes",
    "permissions": [
      "finance.reports.view",
      "finance.banks.manage"
    ],
    "mode": "period",
    "note": "Snapshots criados no período. Líquido esperado não é recebido; repasse apenas quando SETTLED.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "status",
        "label": "Situação",
        "format": "text"
      },
      {
        "key": "gross",
        "label": "Bruto",
        "format": "money"
      },
      {
        "key": "fees",
        "label": "Taxas previstas",
        "format": "money"
      },
      {
        "key": "expected",
        "label": "Líquido previsto",
        "format": "money"
      },
      {
        "key": "received",
        "label": "Líquido conciliado",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,id",
    "sql": "SELECT a.\"Id\" id,a.\"CreatedAtUtc\" AS \"day\",a.\"Status\" status,a.\"GrossCents\"/100.0 gross,(a.\"MdrFeeCents\"+a.\"AnticipationFeeCents\"+a.\"FixedFeeCents\")/100.0 fees,a.\"NetExpectedCents\"/100.0 expected,CASE WHEN a.\"Status\"='SETTLED' THEN a.\"NetSettledCents\"/100.0 END received FROM payment_acquirer_fee_snapshots a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": [
      "gross",
      "fees",
      "expected"
    ]
  },
  {
    "id": "bank-balances",
    "group": "Financeiro",
    "title": "Saldos bancários registrados",
    "permissions": [
      "finance.reports.view",
      "finance.banks.manage"
    ],
    "mode": "current",
    "note": "Posição atual registrada por conta, com diferença entre saldo e saldo conciliado. Não inclui numerário de turnos.",
    "columns": [
      {
        "key": "bank",
        "label": "Banco",
        "format": "text"
      },
      {
        "key": "account",
        "label": "Conta (final)",
        "format": "text"
      },
      {
        "key": "current",
        "label": "Saldo registrado",
        "format": "money"
      },
      {
        "key": "reconciled",
        "label": "Saldo conciliado",
        "format": "money"
      },
      {
        "key": "difference",
        "label": "Diferença",
        "format": "money"
      }
    ],
    "order": "bank,id",
    "sql": "SELECT a.\"Id\" id,a.\"BankName\" bank,right(a.\"AccountNumber\",4) account,a.\"CurrentBalance\" AS current,a.\"ReconciledBalance\" reconciled,a.\"CurrentBalance\"-a.\"ReconciledBalance\" difference FROM bank_accounts a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"IsActive\"",
    "totals": [
      "current",
      "reconciled",
      "difference"
    ]
  },
  {
    "id": "cost-centers",
    "group": "Financeiro",
    "title": "Receitas e despesas por centro de custo",
    "permissions": [
      "finance.reports.view",
      "finance.journal.view"
    ],
    "mode": "period",
    "note": "Lançamentos por competência classificados em receita ou despesa; sem centro de custo permanece visível. Não é DRE fechada.",
    "columns": [
      {
        "key": "name",
        "label": "Centro de custo",
        "format": "text"
      },
      {
        "key": "revenue",
        "label": "Receitas registradas",
        "format": "money"
      },
      {
        "key": "expense",
        "label": "Despesas registradas",
        "format": "money"
      },
      {
        "key": "result",
        "label": "Resultado registrado",
        "format": "money"
      }
    ],
    "order": "name,id",
    "sql": "SELECT l.\"FinancialCostCenterId\" id,coalesce(c.\"Name\",'Sem centro de custo') name,sum(CASE WHEN f.\"Type\"=4 THEN CASE l.\"Direction\" WHEN 2 THEN l.\"Amount\" ELSE -l.\"Amount\" END ELSE 0 END) revenue,sum(CASE WHEN f.\"Type\"=5 THEN CASE l.\"Direction\" WHEN 1 THEN l.\"Amount\" ELSE -l.\"Amount\" END ELSE 0 END) expense,sum(CASE l.\"Direction\" WHEN 2 THEN l.\"Amount\" ELSE -l.\"Amount\" END) result FROM financial_journal_entries a JOIN financial_journal_lines l ON l.\"FinancialJournalEntryId\"=a.\"Id\" AND l.\"TenantId\"=a.\"TenantId\" JOIN financial_accounts f ON f.\"Id\"=l.\"FinancialAccountId\" AND f.\"TenantId\"=a.\"TenantId\" LEFT JOIN financial_cost_centers c ON c.\"Id\"=l.\"FinancialCostCenterId\" AND c.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CompetenceDateUtc\">=s.start_at AND a.\"CompetenceDateUtc\"<s.end_at AND f.\"Type\" IN(4,5) GROUP BY l.\"FinancialCostCenterId\",c.\"Name\"",
    "totals": [
      "revenue",
      "expense",
      "result"
    ]
  },
  {
    "id": "partners",
    "group": "Sócios",
    "title": "Capital, investimento e retorno por sócio",
    "permissions": [
      "partners.view",
      "finance.reports.view"
    ],
    "mode": "company",
    "note": "Visão acumulada da empresa, não da filial. Aportes integralizados incluem bens; distribuição líquida paga não é restituição do capital. Amortização de mútuo e pró-labore são separados. Não há cálculo de payback ou ROI realizado sem fluxo completo. O percentual é uma razão histórica entre lucros líquidos pagos e capital integralizado registrado, não uma taxa de retorno anual nem restituição de quotas.",
    "columns": [
      {
        "key": "name",
        "label": "Sócio",
        "format": "text"
      },
      {
        "key": "subscribed",
        "label": "Capital subscrito pendente",
        "format": "money"
      },
      {
        "key": "invested",
        "label": "Capital integralizado",
        "format": "money"
      },
      {
        "key": "cash",
        "label": "Integralização em dinheiro",
        "format": "money"
      },
      {
        "key": "loans",
        "label": "Mútuos concedidos à empresa",
        "format": "money"
      },
      {
        "key": "amortized",
        "label": "Principal amortizado",
        "format": "money"
      },
      {
        "key": "loanbalance",
        "label": "Mútuos a devolver",
        "format": "money"
      },
      {
        "key": "profit",
        "label": "Lucros líquidos pagos",
        "format": "money"
      },
      {
        "key": "comp",
        "label": "Pró-labore líquido pago",
        "format": "money"
      },
      {
        "key": "ratio",
        "label": "Lucros pagos / capital (%)",
        "format": "qty"
      }
    ],
    "order": "name,id",
    "sql": "SELECT p.\"Id\" id,p.\"Name\" name,coalesce(c.subscribed,0) subscribed,coalesce(c.invested,0) invested,coalesce(c.cash,0) cash,coalesce(l.loans,0) loans,coalesce(l.amortized,0) amortized,coalesce(l.loans,0)-coalesce(l.amortized,0) loanbalance,coalesce(d.profit,0) profit,coalesce(h.comp,0) comp,round(100*coalesce(d.profit,0)/nullif(c.invested,0),2) ratio FROM partners p CROSS JOIN scope s LEFT JOIN LATERAL(SELECT sum(\"Amount\") FILTER(WHERE \"Status\"=1) subscribed,sum(\"Amount\") FILTER(WHERE \"Status\"=2 AND \"PaidInDate\" IS NOT NULL) invested,sum(\"Amount\") FILTER(WHERE \"Status\"=2 AND \"PaidInDate\" IS NOT NULL AND \"Type\"=1) cash FROM capital_contributions x WHERE x.\"TenantId\"=p.\"TenantId\" AND x.\"PartnerId\"=p.\"Id\") c ON true LEFT JOIN LATERAL(SELECT sum(\"PrincipalAmount\") loans,sum(\"AmortizedAmount\") amortized FROM partner_loans x WHERE x.\"TenantId\"=p.\"TenantId\" AND x.\"PartnerId\"=p.\"Id\" AND x.\"Direction\"=1 AND x.\"Status\" IN(1,2,3)) l ON true LEFT JOIN LATERAL(SELECT sum(x.\"GrossAmount\"-x.\"TaxWithheld\") profit FROM profit_distribution_items x JOIN profit_distribution_proposals y ON y.\"Id\"=x.\"ProposalId\" AND y.\"TenantId\"=x.\"TenantId\" WHERE x.\"TenantId\"=p.\"TenantId\" AND x.\"PartnerId\"=p.\"Id\" AND x.\"IsPaid\" AND x.\"PaidDate\" IS NOT NULL AND y.\"Status\" IN(3,5,6)) d ON true LEFT JOIN LATERAL(SELECT sum(\"GrossAmount\"-\"InssWithholding\"-\"IrrfWithholding\") comp FROM partner_compensations x WHERE x.\"TenantId\"=p.\"TenantId\" AND x.\"PartnerId\"=p.\"Id\" AND x.\"Status\"=3 AND x.\"PaidDate\" IS NOT NULL) h ON true WHERE p.\"TenantId\"=s.t",
    "totals": [
      "subscribed",
      "invested",
      "cash",
      "loans",
      "amortized",
      "loanbalance",
      "profit",
      "comp"
    ]
  },
  {
    "id": "capital",
    "group": "Sócios",
    "title": "Extrato de aportes e distribuições",
    "permissions": [
      "partners.view",
      "finance.reports.view"
    ],
    "mode": "company-period",
    "note": "Empresa inteira. Aportes pela data de integralização (ou subscrição), lucros pagos e pró-labore pela data de pagamento. Não soma categorias; mútuos no relatório próprio.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "name",
        "label": "Sócio",
        "format": "text"
      },
      {
        "key": "kind",
        "label": "Natureza",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Situação",
        "format": "text"
      },
      {
        "key": "amount",
        "label": "Valor",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,id,kind",
    "sql": "SELECT a.\"Id\" id,coalesce(a.\"PaidInDate\",a.\"SubscriptionDate\") AS \"day\",p.\"Name\" name,CASE a.\"Type\" WHEN 1 THEN 'Aporte em dinheiro' WHEN 2 THEN 'Aporte em bens' ELSE 'Aporte intangível' END kind,CASE a.\"Status\" WHEN 1 THEN 'Subscrito' WHEN 2 THEN 'Integralizado' WHEN 3 THEN 'Cancelado' END status,a.\"Amount\" amount FROM capital_contributions a JOIN partners p ON p.\"Id\"=a.\"PartnerId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND coalesce(a.\"PaidInDate\",a.\"SubscriptionDate\")>=s.start_at AND coalesce(a.\"PaidInDate\",a.\"SubscriptionDate\")<s.end_at UNION ALL SELECT a.\"Id\",a.\"PaidDate\",p.\"Name\",'Distribuição líquida de lucro','Pago',a.\"GrossAmount\"-a.\"TaxWithheld\" FROM profit_distribution_items a JOIN profit_distribution_proposals y ON y.\"Id\"=a.\"ProposalId\" AND y.\"TenantId\"=a.\"TenantId\" JOIN partners p ON p.\"Id\"=a.\"PartnerId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"IsPaid\" AND y.\"Status\" IN(3,5,6) AND a.\"PaidDate\">=s.start_at AND a.\"PaidDate\"<s.end_at UNION ALL SELECT a.\"Id\",a.\"PaidDate\",p.\"Name\",'Pró-labore líquido','Pago',a.\"GrossAmount\"-a.\"InssWithholding\"-a.\"IrrfWithholding\" FROM partner_compensations a JOIN partners p ON p.\"Id\"=a.\"PartnerId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"Status\"=3 AND a.\"PaidDate\">=s.start_at AND a.\"PaidDate\"<s.end_at",
    "totals": []
  },
  {
    "id": "loans",
    "group": "Sócios",
    "title": "Mútuos e amortizações",
    "permissions": [
      "partners.view",
      "finance.reports.view"
    ],
    "mode": "company",
    "note": "Posição atual de contratos não cancelados. Valores de principal; juros não são estimados.",
    "columns": [
      {
        "key": "name",
        "label": "Sócio",
        "format": "text"
      },
      {
        "key": "contract",
        "label": "Contrato",
        "format": "text"
      },
      {
        "key": "direction",
        "label": "Direção",
        "format": "text"
      },
      {
        "key": "issued",
        "label": "Emissão",
        "format": "date"
      },
      {
        "key": "due",
        "label": "Vencimento",
        "format": "date"
      },
      {
        "key": "principal",
        "label": "Principal",
        "format": "money"
      },
      {
        "key": "paid",
        "label": "Amortizado",
        "format": "money"
      },
      {
        "key": "balance",
        "label": "Saldo principal",
        "format": "money"
      }
    ],
    "order": "issued DESC,id",
    "sql": "SELECT a.\"Id\" id,p.\"Name\" name,a.\"ContractNumber\" contract,CASE a.\"Direction\" WHEN 1 THEN 'Sócio → empresa' WHEN 2 THEN 'Empresa → sócio' END direction,a.\"IssueDate\" issued,a.\"DueDate\" due,a.\"PrincipalAmount\" principal,a.\"AmortizedAmount\" paid,a.\"PrincipalAmount\"-a.\"AmortizedAmount\" balance FROM partner_loans a JOIN partners p ON p.\"Id\"=a.\"PartnerId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"Status\" IN(1,2,3)",
    "totals": []
  },
  {
    "id": "equity",
    "group": "Sócios",
    "title": "Participação societária e quotas",
    "permissions": [
      "partners.view",
      "finance.reports.view"
    ],
    "mode": "company",
    "note": "Participações vigentes registradas, não confundir valor nominal subscrito com dinheiro efetivamente integralizado.",
    "columns": [
      {
        "key": "name",
        "label": "Sócio",
        "format": "text"
      },
      {
        "key": "quotas",
        "label": "Quotas",
        "format": "qty"
      },
      {
        "key": "share",
        "label": "Participação (%)",
        "format": "qty"
      },
      {
        "key": "nominal",
        "label": "Capital nominal",
        "format": "money"
      },
      {
        "key": "since",
        "label": "Vigência",
        "format": "date"
      }
    ],
    "order": "name,id",
    "sql": "SELECT a.\"Id\" id,p.\"Name\" name,a.\"Quotas\" quotas,a.\"Percentage\" share,a.\"Quotas\"*a.\"NominalValuePerQuota\" nominal,a.\"EffectiveDate\" since FROM equity_participations a JOIN partners p ON p.\"Id\"=a.\"PartnerId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"IsCurrent\"",
    "totals": [
      "quotas",
      "share",
      "nominal"
    ]
  },
  {
    "id": "factory",
    "group": "Operacional",
    "title": "Ordens da Fábrica 3D",
    "permissions": [
      "manufacturing.view"
    ],
    "mode": "period",
    "note": "Ordens criadas no período, situação atual. Produção concluída não representa receita recebida.",
    "columns": [
      {
        "key": "day",
        "label": "Criação",
        "format": "date"
      },
      {
        "key": "number",
        "label": "OS",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Produto",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Etapa (código)",
        "format": "text"
      },
      {
        "key": "planned",
        "label": "Planejado",
        "format": "qty"
      },
      {
        "key": "approved",
        "label": "Aprovado",
        "format": "qty"
      },
      {
        "key": "rejected",
        "label": "Rejeitado",
        "format": "qty"
      }
    ],
    "order": "\"day\" DESC,number,id",
    "sql": "SELECT a.\"Id\" id,a.\"CreatedAtUtc\" AS \"day\",a.\"OrderNumber\" number,d.title name,CASE a.\"Status\" WHEN 7 THEN 'Fila' WHEN 8 THEN 'Iniciado' WHEN 10 THEN 'Qualidade/montagem' WHEN 12 THEN 'Pronto' WHEN 13 THEN 'Cancelado' WHEN 14 THEN 'Falhou' ELSE 'Etapa '||a.\"Status\" END status,a.\"PlannedQuantity\" planned,a.\"ApprovedQuantity\" approved,a.\"RejectedQuantity\" rejected FROM manufacturing_orders a JOIN manufacturing_factory_order_details d ON d.order_id=a.\"Id\" AND d.tenant_id=a.\"TenantId\" AND d.branch_id=a.\"BranchId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": [
      "planned",
      "approved",
      "rejected"
    ]
  },
  {
    "id": "factory-cost",
    "group": "Operacional",
    "title": "Custos industriais: previsto × realizado",
    "permissions": [
      "manufacturing.view",
      "manufacturing.costs.view"
    ],
    "mode": "period",
    "note": "Ordens criadas no período. Custo realizado acumulado da OS, incluindo desperdício registrado. Não é CMV contábil.",
    "columns": [
      {
        "key": "number",
        "label": "OS",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Produto",
        "format": "text"
      },
      {
        "key": "estimated",
        "label": "Previsto",
        "format": "money"
      },
      {
        "key": "material",
        "label": "Material",
        "format": "money"
      },
      {
        "key": "energy",
        "label": "Energia",
        "format": "money"
      },
      {
        "key": "machine",
        "label": "Máquina",
        "format": "money"
      },
      {
        "key": "labor",
        "label": "Mão de obra",
        "format": "money"
      },
      {
        "key": "waste",
        "label": "Refugo",
        "format": "money"
      },
      {
        "key": "actual",
        "label": "Realizado",
        "format": "money"
      },
      {
        "key": "variance",
        "label": "Desvio",
        "format": "money"
      }
    ],
    "order": "number,id",
    "sql": "SELECT a.\"Id\" id,a.\"OrderNumber\" number,d.title name,a.\"TotalEstimatedCost\" estimated,a.\"ActualMaterialCost\" material,a.\"ActualEnergyCost\" energy,a.\"ActualMachineCost\" machine,a.\"ActualLaborCost\" labor,a.\"ActualWasteCost\" waste,a.\"ActualMaterialCost\"+a.\"ActualEnergyCost\"+a.\"ActualMachineCost\"+a.\"ActualLaborCost\"+a.\"ActualWasteCost\" actual,a.\"ActualMaterialCost\"+a.\"ActualEnergyCost\"+a.\"ActualMachineCost\"+a.\"ActualLaborCost\"+a.\"ActualWasteCost\"-a.\"TotalEstimatedCost\" variance FROM manufacturing_orders a JOIN manufacturing_factory_order_details d ON d.order_id=a.\"Id\" AND d.tenant_id=a.\"TenantId\" AND d.branch_id=a.\"BranchId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": [
      "estimated",
      "actual",
      "variance"
    ]
  },
  {
    "id": "repairs",
    "group": "Operacional",
    "title": "Assistência técnica e prazos",
    "permissions": [
      "repairs.view"
    ],
    "mode": "period",
    "note": "OS recebidas no período, situação atual. Valores de orçamento não significam recebimento.",
    "columns": [
      {
        "key": "day",
        "label": "Recebida",
        "format": "date"
      },
      {
        "key": "number",
        "label": "OS",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Etapa",
        "format": "text"
      },
      {
        "key": "due",
        "label": "Prazo",
        "format": "date"
      },
      {
        "key": "delivered",
        "label": "Entrega",
        "format": "date"
      },
      {
        "key": "labor",
        "label": "Serviços",
        "format": "money"
      },
      {
        "key": "parts",
        "label": "Peças",
        "format": "money"
      },
      {
        "key": "total",
        "label": "Valor previsto",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,number,id",
    "sql": "SELECT a.\"Id\" id,a.\"ReceivedAtUtc\" AS \"day\",a.\"OrderNumber\" number,CASE a.\"Status\" WHEN 1 THEN 'Recebida' WHEN 2 THEN 'Aguardando diagnóstico' WHEN 3 THEN 'Diagnóstico' WHEN 4 THEN 'Aguardando aprovação' WHEN 5 THEN 'Aprovada' WHEN 6 THEN 'Rejeitada' WHEN 7 THEN 'Aguardando peças' WHEN 8 THEN 'Em reparo' WHEN 9 THEN 'Terceirizada' WHEN 10 THEN 'Qualidade' WHEN 11 THEN 'Pronta' WHEN 12 THEN 'Entregue' WHEN 13 THEN 'Cancelada' WHEN 14 THEN 'Garantia' WHEN 15 THEN 'Irreparável' ELSE 'Desconhecida' END status,a.\"EstimatedCompletionUtc\" due,a.\"DeliveredAtUtc\" delivered,a.\"TotalLaborPrice\" labor,a.\"TotalPartsPrice\" parts,a.\"FinalPrice\" total FROM repair_orders a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"ReceivedAtUtc\">=s.start_at AND a.\"ReceivedAtUtc\"<s.end_at",
    "totals": []
  },
  {
    "id": "projects",
    "group": "Operacional",
    "title": "Projetos digitais e faturamento registrado",
    "permissions": [
      "projects.view"
    ],
    "mode": "period",
    "note": "Projetos criados no período. Valor contratado, faturado e pago são distintos.",
    "columns": [
      {
        "key": "day",
        "label": "Criação",
        "format": "date"
      },
      {
        "key": "number",
        "label": "Projeto",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Nome",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Etapa (código)",
        "format": "text"
      },
      {
        "key": "contract",
        "label": "Contratado",
        "format": "money"
      },
      {
        "key": "invoiced",
        "label": "Faturado",
        "format": "money"
      },
      {
        "key": "paid",
        "label": "Pago registrado",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,number,id",
    "sql": "SELECT a.\"Id\" id,a.\"CreatedAtUtc\" AS \"day\",a.\"ProjectCode\" number,a.\"Name\" name,a.\"Status\" status,a.\"ContractedPrice\" contract,a.\"InvoicedAmount\" invoiced,a.\"PaidAmount\" paid FROM digital_projects a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": []
  },
  {
    "id": "fleet",
    "group": "Operacional",
    "title": "Frota: viagens e custos",
    "permissions": [
      "fleet.view",
      "fleet.reports.view",
      "fleet.cost.view"
    ],
    "mode": "period",
    "note": "Viagens iniciadas no período, custos registrados. Não adicionar novamente ao financeiro.",
    "columns": [
      {
        "key": "day",
        "label": "Início",
        "format": "date"
      },
      {
        "key": "number",
        "label": "Viagem",
        "format": "text"
      },
      {
        "key": "origin",
        "label": "Origem",
        "format": "text"
      },
      {
        "key": "destination",
        "label": "Destino",
        "format": "text"
      },
      {
        "key": "km",
        "label": "Km",
        "format": "qty"
      },
      {
        "key": "fuel",
        "label": "Combustível",
        "format": "money"
      },
      {
        "key": "other",
        "label": "Outros",
        "format": "money"
      },
      {
        "key": "allocated",
        "label": "Rateado",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,number,id",
    "sql": "SELECT a.\"Id\" id,a.\"StartTimeUtc\" AS \"day\",a.\"TripNumber\" number,a.\"OriginCity\" origin,a.\"DestinationCity\" destination,a.\"DistanceKm\" km,a.\"TotalFuelExpenses\" fuel,a.\"TotalOtherExpenses\" other,a.\"TotalAllocatedCost\" allocated FROM fleet_trips a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"StartTimeUtc\">=s.start_at AND a.\"StartTimeUtc\"<s.end_at",
    "totals": [
      "km",
      "fuel",
      "other"
    ]
  },
  {
    "id": "factory-spools",
    "group": "Operacional",
    "title": "Rolos de filamento: consumo e saldo",
    "permissions": [
      "manufacturing.view"
    ],
    "mode": "current",
    "note": "Posição atual de cada rolo. A reserva não é consumo efetivo; consumo acumulado = peso inicial menos saldo atual.",
    "columns": [
      {
        "key": "material",
        "label": "Material",
        "format": "text"
      },
      {
        "key": "color",
        "label": "Cor",
        "format": "text"
      },
      {
        "key": "code",
        "label": "Rolo",
        "format": "text"
      },
      {
        "key": "initial",
        "label": "Peso inicial (g)",
        "format": "qty"
      },
      {
        "key": "used",
        "label": "Consumido (g)",
        "format": "qty"
      },
      {
        "key": "remaining",
        "label": "Restante (g)",
        "format": "qty"
      },
      {
        "key": "reserved",
        "label": "Reservado (g)",
        "format": "qty"
      },
      {
        "key": "available",
        "label": "Disponível (g)",
        "format": "qty"
      },
      {
        "key": "active",
        "label": "Situação",
        "format": "text"
      }
    ],
    "order": "material,color,code,id",
    "sql": "SELECT a.\"Id\" id,a.\"MaterialType\" material,a.\"Color\" color,a.\"SpoolCode\" code,a.\"InitialNetWeightGrams\" initial,a.\"InitialNetWeightGrams\"-a.\"RemainingWeightGrams\" used,a.\"RemainingWeightGrams\" remaining,coalesce(r.reserved,0) reserved,a.\"RemainingWeightGrams\"-coalesce(r.reserved,0) available,CASE WHEN a.\"IsActive\" THEN 'Ativo' ELSE 'Inativo' END active FROM manufacturing_spools a JOIN manufacturing_spool_details d ON d.spool_id=a.\"Id\" AND d.tenant_id=a.\"TenantId\" AND d.branch_id=a.\"BranchId\" LEFT JOIN LATERAL(SELECT sum(x.planned_quantity) reserved FROM manufacturing_material_allocations x WHERE x.tenant_id=a.\"TenantId\" AND x.branch_id=a.\"BranchId\" AND x.spool_id=a.\"Id\" AND x.state='RESERVED') r ON true CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b",
    "totals": [
      "initial",
      "used",
      "remaining",
      "reserved",
      "available"
    ]
  },
  {
    "id": "factory-materials",
    "group": "Operacional",
    "title": "Consumo e refugo por material",
    "permissions": [
      "manufacturing.view"
    ],
    "mode": "period",
    "note": "Consumo efetivamente registrado pela data de baixa. Filamentos em gramas e insumos em unidades; totais por material, não somados entre medidas.",
    "columns": [
      {
        "key": "material",
        "label": "Material",
        "format": "text"
      },
      {
        "key": "color",
        "label": "Cor",
        "format": "text"
      },
      {
        "key": "unit",
        "label": "Medida",
        "format": "text"
      },
      {
        "key": "used",
        "label": "Consumido",
        "format": "qty"
      },
      {
        "key": "waste",
        "label": "Refugo",
        "format": "qty"
      }
    ],
    "order": "material,color,unit",
    "sql": "SELECT c.material_type material,c.color color,CASE WHEN c.kind='FILAMENT' THEN 'g' ELSE 'un' END unit,sum(a.actual_quantity) used,coalesce(sum(a.actual_quantity) FILTER(WHERE a.waste),0) waste FROM manufacturing_material_allocations a JOIN manufacturing_material_balance_configs c ON c.tenant_id=a.tenant_id AND c.branch_id=a.branch_id AND c.balance_id=a.balance_id CROSS JOIN scope s WHERE a.tenant_id=s.t AND a.branch_id=s.b AND a.state='CONSUMED' AND a.settled_at>=s.start_at AND a.settled_at<s.end_at GROUP BY 1,2,3",
    "totals": []
  },
  {
    "id": "factory-printers",
    "group": "Operacional",
    "title": "Utilização de impressoras",
    "permissions": [
      "manufacturing.view"
    ],
    "mode": "period",
    "note": "Tentativas encerradas no período. Horas reais registradas, contagem de sucesso e falha; não mede OEE sem tempo disponível planejado.",
    "columns": [
      {
        "key": "printer",
        "label": "Impressora",
        "format": "text"
      },
      {
        "key": "attempts",
        "label": "Tentativas",
        "format": "qty"
      },
      {
        "key": "success",
        "label": "Concluídas",
        "format": "qty"
      },
      {
        "key": "failed",
        "label": "Falhas/abortos",
        "format": "qty"
      },
      {
        "key": "hours",
        "label": "Horas reais",
        "format": "qty"
      }
    ],
    "order": "hours DESC,printer,id",
    "sql": "SELECT p.\"Id\" id,p.\"Name\" printer,count(*) attempts,count(*) FILTER(WHERE a.\"Status\"=5) success,count(*) FILTER(WHERE a.\"Status\" IN(6,7)) failed,round(sum(d.actual_seconds)/3600.0,4) hours FROM manufacturing_factory_attempt_details d JOIN manufacturing_print_attempts a ON a.\"Id\"=d.attempt_id AND a.\"TenantId\"=d.tenant_id JOIN manufacturing_printers p ON p.\"Id\"=a.\"PrinterId\" AND p.\"TenantId\"=d.tenant_id AND p.\"BranchId\"=d.branch_id CROSS JOIN scope s WHERE d.tenant_id=s.t AND d.branch_id=s.b AND d.closed_at>=s.start_at AND d.closed_at<s.end_at GROUP BY p.\"Id\"",
    "totals": [
      "attempts",
      "success",
      "failed",
      "hours"
    ]
  },
  {
    "id": "crm",
    "group": "Relacionamento",
    "title": "Funil comercial",
    "permissions": [
      "crm.view"
    ],
    "mode": "period",
    "note": "Oportunidades criadas no período por etapa atual. Valor estimado não é venda confirmada.",
    "columns": [
      {
        "key": "stage",
        "label": "Etapa",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Situação (código)",
        "format": "text"
      },
      {
        "key": "count",
        "label": "Oportunidades",
        "format": "qty"
      },
      {
        "key": "estimated",
        "label": "Valor estimado",
        "format": "money"
      }
    ],
    "order": "stage,status",
    "sql": "SELECT coalesce(g.\"Name\",'Sem etapa') stage,a.\"Status\" status,count(*) count,sum(a.\"EstimatedValue\") estimated FROM crm_opportunities a LEFT JOIN crm_pipeline_stages g ON g.\"Id\"=a.\"StageId\" AND g.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at GROUP BY 1,2",
    "totals": [
      "count",
      "estimated"
    ]
  },
  {
    "id": "messages",
    "group": "Relacionamento",
    "title": "Mensageria: volume e entregas",
    "permissions": [
      "messaging.view"
    ],
    "mode": "period",
    "note": "Solicitações criadas no período; estado atual. Não expõe conteúdo ou destinatários.",
    "columns": [
      {
        "key": "channel",
        "label": "Canal (código)",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Estado (código)",
        "format": "text"
      },
      {
        "key": "count",
        "label": "Solicitações",
        "format": "qty"
      },
      {
        "key": "delivered",
        "label": "Entregues",
        "format": "qty"
      },
      {
        "key": "read",
        "label": "Leituras",
        "format": "qty"
      }
    ],
    "order": "channel,status",
    "sql": "SELECT a.\"Channel\" channel,a.\"Status\" status,count(*) count,count(*) FILTER(WHERE a.\"DeliveredAtUtc\" IS NOT NULL) delivered,count(*) FILTER(WHERE a.\"ReadAtUtc\" IS NOT NULL) read FROM \"MessageRequests\" a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at GROUP BY 1,2",
    "totals": [
      "count",
      "delivered",
      "read"
    ]
  },
  {
    "id": "customers",
    "group": "Relacionamento",
    "title": "Clientes e fornecedores cadastrados",
    "permissions": [
      "customers.view",
      "suppliers.view"
    ],
    "mode": "company",
    "note": "Cadastros corporativos atuais; não expõe CPF, e-mail ou dados sensíveis.",
    "columns": [
      {
        "key": "name",
        "label": "Nome",
        "format": "text"
      },
      {
        "key": "kind",
        "label": "Tipo de relação",
        "format": "text"
      },
      {
        "key": "active",
        "label": "Situação",
        "format": "text"
      },
      {
        "key": "created",
        "label": "Cadastro",
        "format": "date"
      }
    ],
    "order": "name,id,kind",
    "sql": "SELECT p.\"Id\" id,p.\"Name\" name,'Cliente' kind,CASE WHEN p.\"IsActive\" THEN 'Ativo' ELSE 'Inativo' END active,p.\"CreatedAtUtc\" created FROM parties p JOIN customer_profiles a ON a.\"PartyId\"=p.\"Id\" AND a.\"TenantId\"=p.\"TenantId\" CROSS JOIN scope s WHERE p.\"TenantId\"=s.t UNION ALL SELECT p.\"Id\",p.\"Name\",'Fornecedor',CASE WHEN p.\"IsActive\" THEN 'Ativo' ELSE 'Inativo' END,p.\"CreatedAtUtc\" FROM parties p JOIN supplier_profiles a ON a.\"PartyId\"=p.\"Id\" AND a.\"TenantId\"=p.\"TenantId\" CROSS JOIN scope s WHERE p.\"TenantId\"=s.t",
    "totals": []
  },
  {
    "id": "loyalty",
    "group": "Relacionamento",
    "title": "Fidelidade: saldo de pontos",
    "permissions": [
      "loyalty.view"
    ],
    "mode": "company",
    "note": "Saldo e acumulados dos pontos no programa da empresa inteira. Pontos não são valores em reais.",
    "columns": [
      {
        "key": "name",
        "label": "Cliente",
        "format": "text"
      },
      {
        "key": "balance",
        "label": "Saldo de pontos",
        "format": "qty"
      },
      {
        "key": "earned",
        "label": "Acumulados",
        "format": "qty"
      },
      {
        "key": "redeemed",
        "label": "Resgatados",
        "format": "qty"
      }
    ],
    "order": "balance DESC,name,id",
    "sql": "SELECT a.\"PartyId\" id,p.\"Name\" name,a.\"PointsBalance\" balance,a.\"LifetimeEarned\" earned,a.\"LifetimeRedeemed\" redeemed FROM loyalty_accounts a JOIN parties p ON p.\"Id\"=a.\"PartyId\" AND p.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t",
    "totals": [
      "balance",
      "earned",
      "redeemed"
    ]
  },
  {
    "id": "fiscal",
    "group": "Fiscal e auditoria",
    "title": "Documentos fiscais por ambiente",
    "permissions": [
      "fiscal.documents.view"
    ],
    "mode": "period",
    "note": "Documentos criados no período. Homologação identificada separadamente; valores não representam faturamento.",
    "columns": [
      {
        "key": "day",
        "label": "Criação",
        "format": "date"
      },
      {
        "key": "series",
        "label": "Série",
        "format": "text"
      },
      {
        "key": "number",
        "label": "Número",
        "format": "text"
      },
      {
        "key": "environment",
        "label": "Ambiente",
        "format": "text"
      },
      {
        "key": "status",
        "label": "Situação",
        "format": "text"
      },
      {
        "key": "total",
        "label": "Valor documento",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,id",
    "sql": "SELECT a.\"Id\" id,a.\"CreatedAtUtc\" AS \"day\",a.\"Series\" series,a.\"Number\" number,CASE a.\"Environment\" WHEN 1 THEN 'Homologação' WHEN 2 THEN 'Produção' ELSE 'Desconhecido' END environment,CASE a.\"Status\" WHEN 4 THEN 'Autorizado' WHEN 8 THEN 'Cancelado' WHEN 5 THEN 'Rejeitado' ELSE 'Estado '||a.\"Status\" END status,a.\"TotalAmount\" total FROM fiscal_documents a JOIN fiscal_establishments f ON f.\"Id\"=a.\"EstablishmentId\" AND f.\"TenantId\"=a.\"TenantId\" CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND f.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": []
  },
  {
    "id": "audit",
    "group": "Fiscal e auditoria",
    "title": "Auditoria operacional",
    "permissions": [
      "audit.view"
    ],
    "mode": "period",
    "note": "Eventos da filial, sem conteúdo sensível dos snapshots. Não inclui auditoria corporativa sem filial.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "date"
      },
      {
        "key": "entity",
        "label": "Entidade",
        "format": "text"
      },
      {
        "key": "action",
        "label": "Ação",
        "format": "text"
      },
      {
        "key": "reference",
        "label": "Identificador",
        "format": "text"
      },
      {
        "key": "correlation",
        "label": "Correlação",
        "format": "text"
      }
    ],
    "order": "\"day\" DESC,id",
    "sql": "SELECT a.\"Id\" id,a.\"CreatedAtUtc\" AS \"day\",a.\"EntityType\" entity,a.\"Action\" action,a.\"EntityId\" reference,a.\"CorrelationId\" correlation FROM audit_events a CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CreatedAtUtc\">=s.start_at AND a.\"CreatedAtUtc\"<s.end_at",
    "totals": []
  },
  {
    "id": "investment-position",
    "group": "Sócios",
    "title": "Investimentos gerenciais: posição consolidada",
    "permissions": [
      "partners.view",
      "finance.reports.view"
    ],
    "mode": "company",
    "note": "Responsabilidades gerenciais por investimento, separadas de capital social, quotas e mútuos formais. Valores amortizados líquidos de reversões.",
    "columns": [
      {
        "key": "name",
        "label": "Investimento",
        "format": "text"
      },
      {
        "key": "category",
        "label": "Categoria",
        "format": "text"
      },
      {
        "key": "invested",
        "label": "Valor inicial",
        "format": "money"
      },
      {
        "key": "paid",
        "label": "Amortizado líquido",
        "format": "money"
      },
      {
        "key": "balance",
        "label": "Saldo",
        "format": "money"
      },
      {
        "key": "participants",
        "label": "Participantes",
        "format": "qty"
      },
      {
        "key": "reference",
        "label": "Referência",
        "format": "text"
      }
    ],
    "order": "name,id",
    "sql": "SELECT i.id,i.name,CASE i.category WHEN 'WORKS' THEN 'Obra' WHEN 'STOCK' THEN 'Estoque' WHEN 'CASH' THEN 'Capital de giro' WHEN 'EQUIPMENT' THEN 'Equipamentos' ELSE 'Outros' END category,i.amount_cents/100.0 invested,coalesce(sum(v.paid_cents),0)/100.0 paid,coalesce(sum(v.balance_cents),0)/100.0 balance,count(v.partner_id) participants,i.reference FROM partner_investments_v10 i LEFT JOIN partner_investment_balances_v10 v ON v.tenant_id=i.tenant_id AND v.investment_id=i.id CROSS JOIN scope s WHERE i.tenant_id=s.t GROUP BY i.tenant_id,i.id",
    "totals": [
      "invested",
      "paid",
      "balance"
    ]
  },
  {
    "id": "investment-shares",
    "group": "Sócios",
    "title": "Investimentos: saldo individual por sócio",
    "permissions": [
      "partners.view",
      "finance.reports.view"
    ],
    "mode": "company",
    "note": "Responsabilidade histórica de cada participante, sem transferência automática de dívida a outros sócios.",
    "columns": [
      {
        "key": "partner",
        "label": "Sócio",
        "format": "text"
      },
      {
        "key": "name",
        "label": "Investimento",
        "format": "text"
      },
      {
        "key": "principal",
        "label": "Responsabilidade",
        "format": "money"
      },
      {
        "key": "paid",
        "label": "Amortizado líquido",
        "format": "money"
      },
      {
        "key": "balance",
        "label": "Saldo",
        "format": "money"
      }
    ],
    "order": "partner,name,investment_id,partner_id",
    "sql": "SELECT v.investment_id,v.partner_id,p.\"Name\" partner,i.name,v.principal_cents/100.0 principal,v.paid_cents/100.0 paid,v.balance_cents/100.0 balance FROM partner_investment_balances_v10 v JOIN partners p ON p.\"TenantId\"=v.tenant_id AND p.\"Id\"=v.partner_id JOIN partner_investments_v10 i ON i.tenant_id=v.tenant_id AND i.id=v.investment_id CROSS JOIN scope s WHERE v.tenant_id=s.t",
    "totals": [
      "principal",
      "paid",
      "balance"
    ]
  },
  {
    "id": "investment-payments",
    "group": "Sócios",
    "title": "Amortizações: extrato individual",
    "permissions": [
      "partners.view",
      "finance.reports.view"
    ],
    "mode": "company-period",
    "note": "Alocações registradas com comprovante externo ou liquidação associada; reversões negativas. Não representa saída adicional no caixa.",
    "columns": [
      {
        "key": "day",
        "label": "Data",
        "format": "day"
      },
      {
        "key": "partner",
        "label": "Sócio",
        "format": "text"
      },
      {
        "key": "investment",
        "label": "Investimento",
        "format": "text"
      },
      {
        "key": "mode",
        "label": "Tipo",
        "format": "text"
      },
      {
        "key": "source",
        "label": "Origem",
        "format": "text"
      },
      {
        "key": "reference",
        "label": "Comprovante",
        "format": "text"
      },
      {
        "key": "amount",
        "label": "Amortização líquida",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,payment_id,investment_id,partner_id",
    "sql": "SELECT a.paid_on::text AS \"day\",l.payment_id,l.investment_id,l.partner_id,p.\"Name\" partner,i.name investment,CASE a.mode WHEN 'PERSONAL' THEN 'Individual' WHEN 'COLLECTIVE' THEN 'Coletiva' ELSE 'Reversão' END mode,CASE a.source WHEN 'EXTERNAL' THEN 'Comprovante externo' WHEN 'SETTLEMENT' THEN 'Liquidação' ELSE 'Reversão' END source,a.reference,l.amount_cents/100.0 amount FROM partner_investment_payment_lines_v10 l JOIN partner_investment_payments_v10 a ON a.tenant_id=l.tenant_id AND a.id=l.payment_id JOIN partner_investments_v10 i ON i.tenant_id=l.tenant_id AND i.id=l.investment_id JOIN partners p ON p.\"TenantId\"=l.tenant_id AND p.\"Id\"=l.partner_id CROSS JOIN scope s WHERE l.tenant_id=s.t AND a.paid_on>=(s.start_at AT TIME ZONE 'America/Sao_Paulo')::date AND a.paid_on<(s.end_at AT TIME ZONE 'America/Sao_Paulo')::date",
    "totals": [
      "amount"
    ]
  },
  {
    "id": "investment-plans",
    "group": "Sócios",
    "title": "Planejamentos mensais aprovados",
    "permissions": [
      "partners.view",
      "finance.reports.view",
      "partners.compensation.manage",
      "finance.journal.view",
      "finance.payables.view",
      "finance.banks.manage"
    ],
    "mode": "company-period",
    "note": "Snapshots de planejamento, não pagamentos. Disponibilidade calculada com posição bancária conciliada na data da aprovação, não saldo histórico de fechamento.",
    "columns": [
      {
        "key": "day",
        "label": "Competência",
        "format": "day"
      },
      {
        "key": "name",
        "label": "Sócio",
        "format": "text"
      },
      {
        "key": "base",
        "label": "Base planejada",
        "format": "money"
      },
      {
        "key": "monthly",
        "label": "Parcela prevista",
        "format": "money"
      },
      {
        "key": "amortization",
        "label": "Amortização planejada",
        "format": "money"
      },
      {
        "key": "released",
        "label": "Parcela liberada",
        "format": "money"
      },
      {
        "key": "potential",
        "label": "Valor potencial",
        "format": "money"
      }
    ],
    "order": "\"day\" DESC,name,id,partner_id",
    "sql": "SELECT c.id,l->>'partnerId' partner_id,c.month::text AS \"day\",l->>'name' name,(l->>'baseCents')::numeric/100 base,(l->>'monthlyCents')::numeric/100 monthly,(l->>'amortizeCents')::numeric/100 amortization,(l->>'releaseCents')::numeric/100 released,(l->>'potentialCents')::numeric/100 potential FROM partner_monthly_closings_v10 c CROSS JOIN LATERAL jsonb_array_elements(c.snapshot->'lines') l CROSS JOIN scope s WHERE c.tenant_id=s.t AND c.month>=(s.start_at AT TIME ZONE 'America/Sao_Paulo')::date AND c.month<(s.end_at AT TIME ZONE 'America/Sao_Paulo')::date",
    "totals": []
  },
  {
  "id": "sector-results",
  "group": "Financeiro",
  "title": "Resultado por setor e responsável",
  "permissions": [
    "finance.reports.view",
    "finance.journal.view",
    "finance.costcenters.manage"
  ],
  "mode": "period",
  "note": "Resultado contábil por centro de custo e responsável vigente na data de competência. Receitas e despesas sem classificação permanecem não atribuídas. Não representa lucro pessoal, nem salários previstos. Somente lançamentos da filial atual.",
  "columns": [
    {
      "key": "sector",
      "label": "Setor / centro de custo",
      "format": "text"
    },
    {
      "key": "responsible",
      "label": "Responsável no período",
      "format": "text"
    },
    {
      "key": "revenue",
      "label": "Receitas",
      "format": "money"
    },
    {
      "key": "expense",
      "label": "Despesas",
      "format": "money"
    },
    {
      "key": "result",
      "label": "Resultado",
      "format": "money"
    }
  ],
  "order": "result DESC,sector,responsible",
  "sql": "SELECT coalesce(c.\"Name\",'Sem centro de custo') sector,coalesce(u.\"FullName\",'Sem responsável no período') responsible,sum(CASE WHEN f.\"Type\"=4 THEN CASE l.\"Direction\" WHEN 2 THEN l.\"Amount\" ELSE -l.\"Amount\" END ELSE 0 END) revenue,sum(CASE WHEN f.\"Type\"=5 THEN CASE l.\"Direction\" WHEN 1 THEN l.\"Amount\" ELSE -l.\"Amount\" END ELSE 0 END) expense,sum(CASE l.\"Direction\" WHEN 2 THEN l.\"Amount\" ELSE -l.\"Amount\" END) result FROM financial_journal_entries a JOIN financial_journal_lines l ON l.\"FinancialJournalEntryId\"=a.\"Id\" AND l.\"TenantId\"=a.\"TenantId\" JOIN financial_accounts f ON f.\"Id\"=l.\"FinancialAccountId\" AND f.\"TenantId\"=a.\"TenantId\" LEFT JOIN financial_cost_centers c ON c.\"Id\"=l.\"FinancialCostCenterId\" AND c.\"TenantId\"=a.\"TenantId\" LEFT JOIN LATERAL(SELECT x.user_id FROM sector_responsibilities_v11 x WHERE x.tenant_id=a.\"TenantId\" AND x.center_id=c.\"Id\" AND x.valid_from<=a.\"CompetenceDateUtc\" AND (x.valid_to IS NULL OR a.\"CompetenceDateUtc\"<x.valid_to) ORDER BY x.valid_from DESC LIMIT 1) sr ON true LEFT JOIN users u ON u.\"TenantId\"=a.\"TenantId\" AND u.\"Id\"=sr.user_id CROSS JOIN scope s WHERE a.\"TenantId\"=s.t AND a.\"BranchId\"=s.b AND a.\"CompetenceDateUtc\">=s.start_at AND a.\"CompetenceDateUtc\"<s.end_at AND f.\"Type\" IN(4,5) GROUP BY c.\"Id\",c.\"Name\",u.\"Id\",u.\"FullName\"",
  "totals": [
    "revenue",
    "expense",
    "result"
  ]
}
];
export const REPORT_PERMISSIONS=[...new Set(REPORTS.flatMap(r=>r.permissions))];
export const SCOPE_SQL=`scope AS (SELECT $1::uuid t,$2::uuid b,($3::date::timestamp AT TIME ZONE 'America/Sao_Paulo') start_at,(($4::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo') end_at)`;

export function canReadReport(report:ReportSpec,permissions:ReadonlySet<string>):boolean{
 return report.permissions.every(p=>permissions.has(p));
}
export function buildReportSql(r:ReportSpec):string{
 const metrics=r.totals.length?"jsonb_build_object("+r.totals.map(k=>"'"+k+"',sum(\""+k+"\")::text").join(",")+")":"'{}'::jsonb";
 const projection="jsonb_build_object("+r.columns.map(c=>"'"+c.key+"',"+(c.format==="date"?'to_jsonb(p."'+c.key+'")':'p."'+c.key+'"::text')).join(",")+")";
 return "WITH "+SCOPE_SQL+", data AS ("+r.sql+"), filtered AS (SELECT d.* FROM data d WHERE $5::text='' OR strpos(lower(to_jsonb(d)::text),lower($5::text))>0), totals AS (SELECT count(*)::int count,"+metrics+" metrics FROM filtered), page_rows AS (SELECT * FROM filtered ORDER BY "+r.order+" LIMIT $6::int OFFSET $7::int) SELECT totals.count,totals.metrics,coalesce((SELECT jsonb_agg("+projection+" ORDER BY "+r.order+") FROM page_rows p),'[]'::jsonb) rows FROM totals";
}
export function validReportRange(from:string|null,to:string|null):boolean{
 const parse=(s:string|null)=>{if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<"1900-01-01"||s>"9998-12-31")return NaN;const d=new Date(s+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?d.getTime():NaN;};
 const a=parse(from),b=parse(to);return Number.isFinite(a)&&Number.isFinite(b)&&b>=a&&b-a<=365*86400000;
}
