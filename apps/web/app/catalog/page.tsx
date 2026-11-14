"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  Boxes, 
  Plus, 
  Search, 
  ShieldCheck, 
  Smartphone, 
  Tag, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  RefreshCw,
  Cpu,
  BadgePercent,
  Check
} from "lucide-react";

export type ProductKind = "Standard" | "RawMaterial" | "SparePart" | "Service" | "Manufactured3D";
export type SerializationPolicy = "None" | "Optional" | "StrictSerialized";
export type ItemCondition = "BrandNew" | "PreOwned" | "Refurbished" | "OpenBox";
export type CosmeticGrade = "GradeA" | "GradeB" | "GradeC" | "None";
export type UnitOperationalStatus = "AcquiredPendingInspection" | "InInspection" | "ApprovedForSale" | "Quarantined" | "Sold";

export interface ProductSku {
  id: string;
  productModelId: string;
  skuCode: string;
  variantName: string;
  barcodeEan?: string;
  defaultPrice: number;
  technicalSpecsJson?: string;
  isActive: boolean;
  version: number;
  availableUnitsCount: number;
}

export interface ProductModel {
  id: string;
  name: string;
  description?: string;
  kind: ProductKind;
  serializationPolicy: SerializationPolicy;
  brandId: string;
  brandName?: string;
  categoryId: string;
  categoryName?: string;
  isActive: boolean;
  skus: ProductSku[];
  createdAtUtc: string;
  version: number;
}

export interface InventoryUnit {
  id: string;
  productSkuId: string;
  skuCode?: string;
  modelName?: string;
  serialNumber?: string | null;
  imei1?: string | null;
  imei2?: string | null;
  condition: ItemCondition;
  grade: CosmeticGrade;
  batteryHealthPercentage?: number | null;
  acquisitionCost?: number | null; // Protegido por catalog.cost.view
  supplierPartyId?: string | null;
  operationalStatus: UnitOperationalStatus;
  inspectionNotes?: string | null;
  acquisitionDateUtc: string;
  version: number;
}

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<"models" | "units">("models");
  const [searchTerm, setSearchTerm] = useState("");
  const [showCost, setShowCost] = useState(false);

  // Estados dos Modais
  const [isCreateModelOpen, setIsCreateModelOpen] = useState(false);
  const [isRegisterUnitOpen, setIsRegisterUnitOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ProductModel | null>(null);

  // Mock dados locais integrados que espelham a API /api/catalog
  const [models, setModels] = useState<ProductModel[]>([
    {
      id: "mod-1",
      name: "iPhone 14 Pro Max",
      description: "Smartphone Apple com Dynamic Island e câmera tripla 48MP",
      kind: "Standard",
      serializationPolicy: "StrictSerialized",
      brandId: "b-1",
      brandName: "Apple",
      categoryId: "c-1",
      categoryName: "Smartphones",
      isActive: true,
      createdAtUtc: "2026-11-14T00:00:00.000Z",
      version: 1,
      skus: [
        {
          id: "sku-1",
          productModelId: "mod-1",
          skuCode: "IPH14PM-128-PURPLE",
          variantName: "128GB Roxo Profundo",
          defaultPrice: 5899.00,
          isActive: true,
          version: 1,
          availableUnitsCount: 2
        },
        {
          id: "sku-2",
          productModelId: "mod-1",
          skuCode: "IPH14PM-256-GOLD",
          variantName: "256GB Dourado",
          defaultPrice: 6499.00,
          isActive: true,
          version: 1,
          availableUnitsCount: 1
        }
      ]
    },
    {
      id: "mod-2",
      name: "Filamento PLA Premium 1.75mm",
      description: "Carretel 1kg para impressoras 3D Bambu Lab e Creality",
      kind: "RawMaterial",
      serializationPolicy: "None",
      brandId: "b-2",
      brandName: "HB 3D",
      categoryId: "c-2",
      categoryName: "Insumos 3D",
      isActive: true,
      createdAtUtc: "2026-11-14T00:00:00.000Z",
      version: 1,
      skus: [
        {
          id: "sku-3",
          productModelId: "mod-2",
          skuCode: "FIL-PLA-PREM-BLK",
          variantName: "Preto Fosco 1kg",
          defaultPrice: 119.90,
          isActive: true,
          version: 1,
          availableUnitsCount: 15
        }
      ]
    }
  ]);

  const [units, setUnits] = useState<InventoryUnit[]>([
    {
      id: "u-1",
      productSkuId: "sku-1",
      skuCode: "IPH14PM-128-PURPLE",
      modelName: "iPhone 14 Pro Max",
      serialNumber: "F2LZQ0XXXXX",
      imei1: "354890123456789",
      imei2: "354890123456780",
      condition: "PreOwned",
      grade: "GradeA",
      batteryHealthPercentage: 88,
      acquisitionCost: 3500.00,
      operationalStatus: "ApprovedForSale",
      inspectionNotes: "Bateria original 88%, tela impecável, carcaça sem marcas",
      acquisitionDateUtc: "2026-11-14T00:00:00.000Z",
      version: 1
    },
    {
      id: "u-2",
      productSkuId: "sku-1",
      skuCode: "IPH14PM-128-PURPLE",
      modelName: "iPhone 14 Pro Max",
      serialNumber: "F2LZQ9YYYYY",
      imei1: "354890123456799",
      imei2: null,
      condition: "PreOwned",
      grade: "GradeB",
      batteryHealthPercentage: 83,
      acquisitionCost: 3100.00,
      operationalStatus: "InInspection",
      inspectionNotes: "Micro-riscos laterais leves; testes de FaceID e câmeras OK",
      acquisitionDateUtc: "2026-11-14T00:00:00.000Z",
      version: 1
    }
  ]);

  // Form states para criação de Modelo
  const [newModelName, setNewModelName] = useState("");
  const [newModelBrand, setNewModelBrand] = useState("Apple");
  const [newModelCategory, setNewModelCategory] = useState("Smartphones");
  const [newModelKind, setNewModelKind] = useState<ProductKind>("Standard");
  const [newModelSerialization, setNewModelSerialization] = useState<SerializationPolicy>("StrictSerialized");
  const [newModelDescription, setNewModelDescription] = useState("");

  // Form states para registro de Unidade Serializada
  const [targetSkuId, setTargetSkuId] = useState("sku-1");
  const [newUnitCondition, setNewUnitCondition] = useState<ItemCondition>("PreOwned");
  const [newUnitGrade, setNewUnitGrade] = useState<CosmeticGrade>("GradeA");
  const [newUnitBattery, setNewUnitBattery] = useState("90");
  const [newUnitCost, setNewUnitCost] = useState("3200");
  const [newUnitImei1, setNewUnitImei1] = useState("");
  const [newUnitImei2, setNewUnitImei2] = useState("");
  const [newUnitSerial, setNewUnitSerial] = useState("");
  const [newUnitNotes, setNewUnitNotes] = useState("");

  const handleCreateModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;

    const created: ProductModel = {
      id: `mod-${Date.now()}`,
      name: newModelName.trim(),
      description: newModelDescription.trim() || undefined,
      brandId: "b-custom",
      brandName: newModelBrand,
      categoryId: "c-custom",
      categoryName: newModelCategory,
      kind: newModelKind,
      serializationPolicy: newModelSerialization,
      isActive: true,
      createdAtUtc: "2026-11-14T00:00:00.000Z",
      version: 1,
      skus: [
        {
          id: `sku-${Date.now()}`,
          productModelId: `mod-${Date.now()}`,
          skuCode: `${newModelName.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
          variantName: "Padrão",
          defaultPrice: 99.00,
          isActive: true,
          version: 1,
          availableUnitsCount: 0
        }
      ]
    };

    setModels([created, ...models]);
    setIsCreateModelOpen(false);
    setNewModelName("");
    setNewModelDescription("");
  };

  const handleRegisterUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const sku = models.flatMap(m => m.skus).find(s => s.id === targetSkuId);
    const parentModel = models.find(m => m.skus.some(s => s.id === targetSkuId));

    const unit: InventoryUnit = {
      id: `u-${Date.now()}`,
      productSkuId: targetSkuId,
      skuCode: sku?.skuCode,
      modelName: parentModel?.name,
      serialNumber: newUnitSerial.trim() || undefined,
      imei1: newUnitImei1.trim() || undefined,
      imei2: newUnitImei2.trim() || undefined,
      condition: newUnitCondition,
      grade: newUnitGrade,
      batteryHealthPercentage: newUnitBattery ? parseInt(newUnitBattery, 10) : undefined,
      acquisitionCost: parseFloat(newUnitCost) || 0,
      operationalStatus: "InInspection",
      inspectionNotes: newUnitNotes.trim() || undefined,
      acquisitionDateUtc: "2026-11-14T00:00:00.000Z",
      version: 1
    };

    setUnits([unit, ...units]);
    setIsRegisterUnitOpen(false);
    setNewUnitImei1("");
    setNewUnitImei2("");
    setNewUnitSerial("");
    setNewUnitNotes("");
  };

  const handleApproveUnit = (unitId: string) => {
    setUnits(units.map(u => u.id === unitId ? { ...u, operationalStatus: "ApprovedForSale" as UnitOperationalStatus } : u));
  };

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.brandName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.skus.some(s => s.skuCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredUnits = units.filter(u => 
    (u.modelName && u.modelName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.imei1 && u.imei1.includes(searchTerm)) ||
    (u.serialNumber && u.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <RootShellLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Boxes className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              Catálogo Inteligente & Gestão de SKUs / Usados
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Catálogo unificado para eletrônicos novos e seminovos, insumos 3D e peças com controle de IMEI e custo individual.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowCost(!showCost)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
              title="Exige permissão catalog.cost.view"
            >
              {showCost ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4 text-slate-500" />}
              {showCost ? "Ocultar Custos (Sigilo)" : "Visualizar Custos Reais"}
            </button>

            <button
              onClick={() => setIsCreateModelOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Novo Modelo
            </button>

            <button
              onClick={() => setIsRegisterUnitOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
            >
              <Smartphone className="w-4 h-4" />
              Cadastrar Aparelho / Usado (IMEI)
            </button>
          </div>
        </div>

        {/* Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("models")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "models"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Modelos & Famílias de Produtos ({models.length})
            </button>
            <button
              onClick={() => setActiveTab("units")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "units"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Aparelhos Usados & Serializados ({units.length})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "models" ? "Buscar modelo, SKU..." : "Buscar IMEI, Serial, Modelo..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Tab 1: Modelos e SKUs */}
        {activeTab === "models" && (
          <div className="grid grid-cols-1 gap-4">
            {filteredModels.map((model) => (
              <div
                key={model.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-slate-900 dark:text-slate-100">{model.name}</span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        {model.brandName}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {model.categoryName}
                      </span>
                    </div>
                    {model.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{model.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Rastreio: <strong>{model.serializationPolicy === "StrictSerialized" ? "IMEI / Serial Obrigatório" : "Livre / Sem Serial"}</strong>
                    </span>
                  </div>
                </div>

                {/* Lista de Variações / SKUs */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Variações & SKUs Comerciais ({model.skus.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border border-slate-100 dark:border-slate-800/80 rounded-lg">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2">Código SKU</th>
                          <th className="px-3 py-2">Variante</th>
                          <th className="px-3 py-2">Preço Padrão</th>
                          <th className="px-3 py-2">Unidades Disponíveis</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                        {model.skus.map((sku) => (
                          <tr key={sku.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-3 py-2 font-mono font-medium text-xs text-indigo-600 dark:text-indigo-400">
                              {sku.skuCode}
                            </td>
                            <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{sku.variantName}</td>
                            <td className="px-3 py-2 font-semibold text-emerald-600 dark:text-emerald-400">
                              R$ {sku.defaultPrice.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                sku.availableUnitsCount > 0 
                                  ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                  : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                              }`}>
                                {sku.availableUnitsCount} un pronta(s)
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Ativo</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Aparelhos Usados & Serializados */}
        {activeTab === "units" && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Modelo / SKU</th>
                    <th className="px-4 py-3">IMEI 1 / Serial</th>
                    <th className="px-4 py-3">Condição & Grau</th>
                    <th className="px-4 py-3">Bateria</th>
                    {showCost && <th className="px-4 py-3 text-amber-600 dark:text-amber-400">Custo Aquisição</th>}
                    <th className="px-4 py-3">Status Operacional</th>
                    <th className="px-4 py-3">Laudo / Checklist</th>
                    <th className="px-4 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUnits.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{unit.modelName}</div>
                        <div className="text-xs font-mono text-slate-500">{unit.skuCode}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {unit.imei1 || unit.serialNumber || "-"}
                        </div>
                        {unit.imei2 && (
                          <div className="font-mono text-xs text-slate-400">SIM 2: {unit.imei2}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {unit.condition === "PreOwned" ? "Usado" : unit.condition}
                          </span>
                          {unit.grade !== "None" && (
                            <span className="px-1.5 py-0.5 text-xs font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {unit.grade === "GradeA" ? "Grau A" : unit.grade === "GradeB" ? "Grau B" : "Grau C"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {unit.batteryHealthPercentage ? (
                          <span className={`text-xs font-semibold ${
                            unit.batteryHealthPercentage >= 85 ? "text-emerald-600" : "text-amber-600"
                          }`}>
                            {unit.batteryHealthPercentage}%
                          </span>
                        ) : "-"}
                      </td>
                      {showCost && (
                        <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400 font-mono text-xs">
                          {unit.acquisitionCost !== null && unit.acquisitionCost !== undefined 
                            ? `R$ ${unit.acquisitionCost.toFixed(2)}` 
                            : "(Sigiloso)"}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          unit.operationalStatus === "ApprovedForSale"
                            ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                            : unit.operationalStatus === "InInspection"
                            ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                            : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                        }`}>
                          {unit.operationalStatus === "ApprovedForSale" ? "Liberado para Venda" :
                           unit.operationalStatus === "InInspection" ? "Em Bancada / Testes" : "Pendente Inspeção"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={unit.inspectionNotes ?? undefined}>
                        {unit.inspectionNotes || "Sem observações"}
                      </td>
                      <td className="px-4 py-3">
                        {unit.operationalStatus !== "ApprovedForSale" && (
                          <button
                            onClick={() => handleApproveUnit(unit.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Aprovar p/ Venda
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Modal: Cadastro de Novo Modelo */}
        {isCreateModelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Criar Novo Modelo de Produto</h3>
              <form onSubmit={handleCreateModel} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Nome do Modelo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: PlayStation 5 Slim 1TB"
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Marca</label>
                    <input
                      type="text"
                      value={newModelBrand}
                      onChange={(e) => setNewModelBrand(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Categoria</label>
                    <input
                      type="text"
                      value={newModelCategory}
                      onChange={(e) => setNewModelCategory(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Tipo de Produto</label>
                    <select
                      value={newModelKind}
                      onChange={(e) => setNewModelKind(e.target.value as ProductKind)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    >
                      <option value="Standard">Mercadoria Padrão</option>
                      <option value="RawMaterial">Insumo (3D / Matéria)</option>
                      <option value="SparePart">Peça de Reposição</option>
                      <option value="Manufactured3D">Peça Impressa 3D</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Rastreabilidade</label>
                    <select
                      value={newModelSerialization}
                      onChange={(e) => setNewModelSerialization(e.target.value as SerializationPolicy)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    >
                      <option value="StrictSerialized">IMEI / Serial Obrigatório</option>
                      <option value="Optional">Serial Opcional</option>
                      <option value="None">Sem Controle Serial</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Descrição Comercial</label>
                  <textarea
                    rows={2}
                    value={newModelDescription}
                    onChange={(e) => setNewModelDescription(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateModelOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
                  >
                    Salvar Modelo
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Registro de Aparelho Usado com IMEI */}
        {isRegisterUnitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-600" />
                Registrar Aparelho Usado / Seminovos
              </h3>
              <form onSubmit={handleRegisterUnit} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">SKU / Modelo Alvo</label>
                  <select
                    value={targetSkuId}
                    onChange={(e) => setTargetSkuId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                  >
                    {models.flatMap(m => m.skus).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.skuCode} - {s.variantName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">IMEI 1 (Principal)</label>
                    <input
                      type="text"
                      placeholder="354890123456789"
                      value={newUnitImei1}
                      onChange={(e) => setNewUnitImei1(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">IMEI 2 (Secundário)</label>
                    <input
                      type="text"
                      placeholder="354890123456780"
                      value={newUnitImei2}
                      onChange={(e) => setNewUnitImei2(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Condição</label>
                    <select
                      value={newUnitCondition}
                      onChange={(e) => setNewUnitCondition(e.target.value as ItemCondition)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    >
                      <option value="PreOwned">Usado</option>
                      <option value="Refurbished">Recondicionado</option>
                      <option value="OpenBox">Mostruário</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Grau Estético</label>
                    <select
                      value={newUnitGrade}
                      onChange={(e) => setNewUnitGrade(e.target.value as CosmeticGrade)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
                    >
                      <option value="GradeA">Grau A (Impecável)</option>
                      <option value="GradeB">Grau B (Leves marcas)</option>
                      <option value="GradeC">Grau C (Marcas visíveis)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Bateria %</label>
                    <input
                      type="number"
                      min="50"
                      max="100"
                      value={newUnitBattery}
                      onChange={(e) => setNewUnitBattery(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Custo de Compra (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newUnitCost}
                      onChange={(e) => setNewUnitCost(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Serial Apple / Fabricante</label>
                    <input
                      type="text"
                      placeholder="F2LZQ0XXXXX"
                      value={newUnitSerial}
                      onChange={(e) => setNewUnitSerial(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Laudo Técnico / Observações</label>
                  <textarea
                    rows={2}
                    placeholder="Checklist de entrada: tela, câmeras, touch, alto-falante, Wi-Fi..."
                    value={newUnitNotes}
                    onChange={(e) => setNewUnitNotes(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-transparent"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterUnitOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  >
                    Cadastrar Unidade
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
