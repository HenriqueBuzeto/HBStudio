# Walkthrough de Homologação — MOD-10: Manufatura 3D & Custos Reais

**Módulo**: MOD-10 — Manufacturing3D (Indústria 4.0, Impressão 3D e Custos Decompostos)  
**Status**: `READY_VERIFIED`  
**Testes de Integração**: 71/71 Aprovados (100% da suíte global verde)  
**Banco de Dados**: PostgreSQL 18.3 (`manufacturing_printers`, `manufacturing_spools`, `manufacturing_orders`, `manufacturing_print_attempts`, etc.)  
**Stack**: .NET 10 (C# 13), EF Core 10, Next.js 16 (Turbopack)

---

## 1. Visão Geral da Arquitetura

O **MOD-10 (Manufacturing3D)** implementa um Bounded Context completo para operação de manufatura aditiva (FDM/FFF) e apuração contábil exata de custos reais:

1. **Gestão do Parque de Máquinas (`ManufacturingPrinter`)**:
   - Cadastro e telemetria operacional (status: Disponível, Imprimindo, Manutenção, Fora de Serviço).
   - Taxa horária de máquina para cobertura de amortização e manutenção preventiva.
   - Potência elétrica nominal para cálculo de consumo de kWh.

2. **Rastreamento de Matéria-Prima & Carretéis (`ManufacturingSpool`)**:
   - Registro de material (PLA, PETG, ABS, TPU, Resina), fabricante, lote, cor e diâmetro.
   - Integração com o `Inventory` oficial: a matéria-prima é reservada e consumida formalmente, sem criar Kardex paralelo.

3. **Biblioteca 3D & Versionamento (`ManufacturingDesignAsset`, `ManufacturingDesignVersion`)**:
   - Arquivos STL/3MF, perfis de fatiamento (.3mf/.gcode), densidade de preenchimento, altura de camada e hash SHA-256 de integridade.

4. **Motor de Cálculo de Orçamentos 3D Decomposto (`ManufacturingQuote`)**:
   - Custo de Material: $\text{Massa (kg)} \times \text{Custo Unitário (R\$/kg)}$.
   - Custo de Energia Elétrica: $(\text{Potência Média (kW)} \times \text{Horas}) \times \text{Tarifa (R\$/kWh)}$.
   - Custo de Hora-Máquina: $\text{Horas} \times \text{Taxa de Máquina (R\$/h)}$.
   - Custo de Mão de Obra: $\text{Tempo de Preparação} \times \text{Taxa Operacional}$.
   - Provisão de Refugo Planejado (%).
   - Margem/Markup sobre o custo direto com precificação de venda calculada.

5. **Ordens de Produção (OP) & Tentativas de Impressão (`ManufacturingOrder`, `ManufacturingPrintAttempt`)**:
   - Ciclo de vida estrito: `Planned` $\rightarrow$ `Ready` $\rightarrow$ `InProduction` $\rightarrow$ `QualityInspection` $\rightarrow$ `Completed`.
   - **Registro Formal de Falhas/Refugos**: quando ocorre falha mecânica, descolamento ou entupimento, **os custos incorridos NÃO são descartados** — são contabilizados como `WasteCost` acumulado na OP.
   - **Inspeção de Qualidade & Entrada no Estoque**: peças aprovadas recebem entrada no estoque como produto acabado via `InventoryService` com rateio do custo total (incluindo refugos).

---

## 2. Evidências de Testes Automatizados

Comando executado:
```powershell
dotnet test tests/BuildingBlocks.UnitTests/BuildingBlocks.UnitTests.csproj
```

**Resultado Oficial**:
```text
Iniciando execução de teste, espere...
1 arquivos de teste no total corresponderam ao padrão especificado.

Aprovado!  – Com falha:     0, Aprovado:    71, Ignorado:     0, Total:    71, Duração: 8 s - BuildingBlocks.UnitTests.dll (net10.0)
```

### Casos de Teste do MOD-10 Validados:
1. `Manufacturing_Quotes_CalculateAccurately_AndRespectPermissions`:
   - Valida a fórmula contábil decomposta e restrição de acesso por permissões `manufacturing.quotes.create`.
2. `Manufacturing_PermissionCheck_WithoutExecutePermission_ReturnsForbidden`:
   - Valida o isolamento de segurança `Fail-Closed`: operadores sem permissão de chão de fábrica recebem `403 Forbidden`.
3. `Manufacturing_OrderFlow_ReserveFilament_RegisterFailureAndWaste_CompletesQuality_AndEntersInventory`:
   - Cria OP, reserva filamento via `InventoryService`, inicia tentativa 1 na impressora Bambu Lab.
   - Aponta falha de descolamento com perda de material e tempo; valida acúmulo contábil do custo de refugo.
   - Inicia tentativa 2 com sucesso, conclui impressão, aprova inspeção de qualidade dimensional e dá entrada oficial no estoque com rateio integral de custos.

---

## 3. Frontend Next.js 16 (`/manufacturing`)

- **Interface no Padrão Visual HBVisionX**:
  - Light mode refinado com grid quadriculado sutil de baixa opacidade.
  - Sidebar escura com ícone 3D e item de menu em `OPERAÇÃO & PRODUTOS`.
  - Abas operacionais:
    - **Fila de OPs**: Acompanhamento de status, tempos e acúmulo de refugos.
    - **Parque de Impressoras**: Grid de máquinas com telemetria operacional.
    - **Calculadora de Orçamentos 3D**: Simulador com decomposição detalhada em tempo real.
    - **Biblioteca STL/3MF**: Catálogo de modelos digitais e versões técnicas.
  - Modais dedicados: Nova OP e Apontamento Técnico de Refugo.
- **Build de Produção**:
  - Compilado com sucesso pelo Turbopack (`16/16` rotas estáticas geradas sem erros).
