"use client";

import React, { useState } from "react";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  Boxes, 
  Smartphone, 
  Search, 
  Plus, 
  Eye, 
  EyeOff, 
  Package, 
  Layers, 
  Tag, 
  CheckCircle2, 
  ShieldCheck,
  ChevronRight,
  Filter
} from "lucide-react";

export interface SkuVariant {
  id: string;
  skuCode: string;
  variantName: string;
  color?: string;
  storage?: string;
  defaultPrice: number;
  availableQuantity: number;
  isActive: boolean;
}

export interface ProductModel {
  id: string;
  brand: string;
  name: string;
  category: string;
  serializationPolicy: number; // 1 = StrictSerialized (IMEI obrigatório), 2 = StandardBatch (livre)
  isActive: boolean;
  skus: SkuVariant[];
}

export interface InventoryUnit {
  id: string;
  skuCode: string;
  modelName: string;
  serialNumberOrImei: string;
  imei2?: string;
  condition: number; // 1 = New, 2 = UsedPreOwned, 3 = Refurbished, 4 = ScrapParts
  cosmeticGrade: number; // 1 = GradeA_Plus, 2 = GradeA, 3 = GradeB, 4 = GradeC
  batteryHealthPercentage?: number;
  acquisitionCost: number;
  retailPrice: number;
  operationalStatus: number; // 1 = IntakeInspecting, 2 = InLabRefurbish, 3 = ApprovedForSale, 4 = Reserved, 5 = Sold, 6 = ReturnRMA, 7 = Scrapped
  operationalStatusName: string;
}

const initialModels: ProductModel[] = [
  {
    id: "m-01",
    brand: "Apple",
    name: "iPhone 14 Pro Max",
    category: "Smartphones",
    serializationPolicy: 1,
    isActive: true,
    skus: [
      { id: "s-01", skuCode: "IPH14PM-128-PURPLE", variantName: "128GB Roxo Profundo", color: "Roxo Profundo", storage: "128GB", defaultPrice: 5899.00, availableQuantity: 2, isActive: true },
      { id: "s-02", skuCode: "IPH14PM-256-GOLD", variantName: "256GB Dourado", color: "Dourado", storage: "256GB", defaultPrice: 6499.00, availableQuantity: 1, isActive: true }
    ]
  },
  {
    id: "m-02",
    brand: "HB 3D",
    name: "Filamento PLA Premium 1.75mm",
    category: "Insumos 3D",
    serializationPolicy: 2,
    isActive: true,
    skus: [
      { id: "s-03", skuCode: "FIL-PLA-PREM-BLK", variantName: "Preto Fosco 1kg", color: "Preto", defaultPrice: 119.90, availableQuantity: 15, isActive: true }
    ]
  }
];

const initialUnits: InventoryUnit[] = [
  {
    id: "u-01",
    skuCode: "IPH14PM-128-PURPLE",
    modelName: "iPhone 14 Pro Max",
    serialNumberOrImei: "354891029384756",
    imei2: "354891029384757",
    condition: 2,
    cosmeticGrade: 1,
    batteryHealthPercentage: 92,
    acquisitionCost: 3850.00,
    retailPrice: 5899.00,
    operationalStatus: 3,
    operationalStatusName: "Aprovado para Venda"
  },
  {
    id: "u-02",
    skuCode: "IPH14PM-128-PURPLE",
    modelName: "iPhone 14 Pro Max",
    serialNumberOrImei: "354891029384758",
    condition: 2,
    cosmeticGrade: 2,
    batteryHealthPercentage: 88,
    acquisitionCost: 3600.00,
    retailPrice: 5499.00,
    operationalStatus: 3,
    operationalStatusName: "Aprovado para Venda"
  }
];

export default function CatalogPage() {
  const [models, setModels] = useState<ProductModel[]>(initialModels);
  const [units, setUnits] = useState<InventoryUnit[]>(initialUnits);
  const [activeTab, setActiveTab] = useState<"models" | "units">("models");
  const [search, setSearch] = useState("");
  const [showCost, setShowCost] = useState(false);
  const [isCreateModelOpen, setIsCreateModelOpen] = useState(false);
  const [isRegisterUnitOpen, setIsRegisterUnitOpen] = useState(false);

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Produtos & Aparelhos
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Catálogo de Modelos & Unidades Serializadas
            </h1>
            <p className="text-xs text-slate-500">
              Gestão de aparelhos novos, seminovos Apple com laudo de bateria/grau estético, peças e insumos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCost(!showCost)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
            >
              {showCost ? <EyeOff className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
              <span>{showCost ? "Ocultar Custo" : "Ver Custo Real"}</span>
            </button>
            <button
              onClick={() => setIsCreateModelOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Modelo
            </button>
          </div>
        </div>

        {/* Abas e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200/80 shadow-xs">
            <button
              onClick={() => setActiveTab("models")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "models"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Modelos & SKUs ({models.length})
            </button>
            <button
              onClick={() => setActiveTab("units")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "units"
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Aparelhos Serializados ({units.length})
            </button>
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por modelo, SKU ou IMEI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800 transition-all shadow-xs"
            />
          </div>
        </div>

        {/* Tab 1: Modelos */}
        {activeTab === "models" && (
          <div className="space-y-4">
            {models.map((model) => (
              <div key={model.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {model.brand}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {model.category}
                        </span>
                        {model.serializationPolicy === 1 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                            Rastreamento IMEI Obrigatório
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 mt-1">{model.name}</h3>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
                    Ativo no Catálogo
                  </span>
                </div>

                {/* SKUs Variants Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Código SKU</th>
                        <th className="py-2.5 px-3">Variação / Especificação</th>
                        <th className="py-2.5 px-3">Preço Sugerido</th>
                        <th className="py-2.5 px-3">Disponível em Estoque</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {model.skus.map((sku) => (
                        <tr key={sku.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{sku.skuCode}</td>
                          <td className="py-2.5 px-3 text-slate-600">{sku.variantName}</td>
                          <td className="py-2.5 px-3 font-extrabold text-slate-900">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(sku.defaultPrice)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              {sku.availableQuantity} un pronta(s)
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Ativo
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Unidades Serializadas (IMEI) */}
        {activeTab === "units" && (
          <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                <tr>
                  <th className="py-3 px-4">Modelo / SKU</th>
                  <th className="py-3 px-4">IMEI / Número de Série</th>
                  <th className="py-3 px-4">Condição & Grau</th>
                  <th className="py-3 px-4">Bateria</th>
                  {showCost && <th className="py-3 px-4">Custo Real</th>}
                  <th className="py-3 px-4">Preço Venda</th>
                  <th className="py-3 px-4">Status Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-extrabold text-slate-900">{unit.modelName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{unit.skuCode}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-purple-700">
                      {unit.serialNumberOrImei}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">Seminovo</div>
                      <div className="text-[10px] text-slate-500">Grau A / Impecável</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-emerald-600">{unit.batteryHealthPercentage}%</span>
                    </td>
                    {showCost && (
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.acquisitionCost)}
                      </td>
                    )}
                    <td className="py-3 px-4 font-extrabold text-slate-900">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.retailPrice)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {unit.operationalStatusName}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RootShellLayout>
  );
}
