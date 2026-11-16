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
  FolderOpen,
  Sparkles,
  Truck,
  CheckCircle2
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
  condition: number;
  cosmeticGrade: number;
  batteryHealthPercentage?: number;
  acquisitionCost: number;
  allocatedFreightCost?: number;
  totalInventoryCost?: number;
  retailPrice: number;
  suggestedPrice?: number;
  operationalStatus: number;
  operationalStatusName: string;
}

export default function CatalogPage() {
  const [models, setModels] = useState<ProductModel[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([
    {
      id: "u-iphone14-1",
      skuCode: "IPH14P-128-ROX",
      modelName: "iPhone 14 Pro 128GB Roxo Profundo",
      serialNumberOrImei: "354891828374651",
      condition: 2,
      cosmeticGrade: 1,
      batteryHealthPercentage: 89,
      acquisitionCost: 3200.00,
      allocatedFreightCost: 42.00,
      totalInventoryCost: 3242.00,
      retailPrice: 4499.90,
      suggestedPrice: 4499.90,
      operationalStatus: 3,
      operationalStatusName: "Aprovado para Venda"
    }
  ]);
  const [activeTab, setActiveTab] = useState<"models" | "units">("models");
  const [search, setSearch] = useState("");
  const [showCost, setShowCost] = useState(false);
  const [isCreateModelOpen, setIsCreateModelOpen] = useState(false);
  const [isRegisterUnitOpen, setIsRegisterUnitOpen] = useState(false);

  // Form Novo Modelo
  const [brand, setBrand] = useState("Apple");
  const [modelName, setModelName] = useState("");
  const [category, setCategory] = useState("Smartphones");
  const [policy, setPolicy] = useState(1);
  const [skuCode, setSkuCode] = useState("");
  const [skuName, setSkuName] = useState("");
  const [price, setPrice] = useState("");

  const handleCreateModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName || !skuCode) return;

    const newModel: ProductModel = {
      id: `m-${Date.now()}`,
      brand,
      name: modelName,
      category,
      serializationPolicy: policy,
      isActive: true,
      skus: [
        {
          id: `s-${Date.now()}`,
          skuCode: skuCode.toUpperCase(),
          variantName: skuName || modelName,
          defaultPrice: parseFloat(price) || 0,
          availableQuantity: 0,
          isActive: true
        }
      ]
    };

    setModels([newModel, ...models]);
    setIsCreateModelOpen(false);
    setModelName("");
    setSkuCode("");
    setSkuName("");
    setPrice("");
  };

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
                            <span className="inline-flex items-center gap-1 font-bold text-slate-500">
                              <span className="w-2 h-2 rounded-full bg-slate-300"></span>
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

            {models.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-16 text-center text-slate-400 shadow-xs">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">Nenhum modelo cadastrado no catálogo</p>
                <p className="text-xs text-slate-400 mt-1">Cadastre novos modelos de smartphones, acessórios ou peças de reposição.</p>
                <button
                  onClick={() => setIsCreateModelOpen(true)}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                >
                  Cadastrar Primeiro Modelo
                </button>
              </div>
            )}
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
                  {showCost && (
                    <>
                      <th className="py-3 px-4">Custo Compra</th>
                      <th className="py-3 px-4">Frete Rateado</th>
                      <th className="py-3 px-4">Custo Estoque</th>
                    </>
                  )}
                  <th className="py-3 px-4">Preço Sugerido</th>
                  <th className="py-3 px-4">Preço Aprovado</th>
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
                      <>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.acquisitionCost)}
                        </td>
                        <td className="py-3 px-4 font-mono text-cyan-600">
                          {unit.allocatedFreightCost ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.allocatedFreightCost) : "R$ 0,00"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.totalInventoryCost ?? (unit.acquisitionCost + (unit.allocatedFreightCost ?? 0)))}
                        </td>
                      </>
                    )}
                    <td className="py-3 px-4 font-mono font-semibold text-purple-700">
                      {unit.suggestedPrice ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.suggestedPrice) : "—"}
                    </td>
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
                {units.length === 0 && (
                  <tr>
                    <td colSpan={showCost ? 7 : 6} className="py-16 text-center text-slate-400">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">Nenhum aparelho serializado cadastrado</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Os aparelhos entram automaticamente através do recebimento de compras ou cadastro de seminovos.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de Criação de Modelo */}
        {isCreateModelOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Cadastrar Novo Modelo</h3>
                <button
                  onClick={() => setIsCreateModelOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateModel} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Marca</label>
                    <input
                      type="text"
                      required
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="Ex: Apple, Samsung, Xiaomi"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Categoria</label>
                    <input
                      type="text"
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Ex: Smartphones, Peças, Acessórios"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome do Modelo *</label>
                  <input
                    type="text"
                    required
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="Ex: iPhone 15 Pro, Tela OLED Galaxy S23"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Código SKU *</label>
                    <input
                      type="text"
                      required
                      value={skuCode}
                      onChange={(e) => setSkuCode(e.target.value)}
                      placeholder="IPH15P-128-NAT"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Variação / Cor</label>
                    <input
                      type="text"
                      value={skuName}
                      onChange={(e) => setSkuName(e.target.value)}
                      placeholder="128GB Titânio"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Preço Venda (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="5800.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none text-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={policy === 1}
                      onChange={(e) => setPolicy(e.target.checked ? 1 : 2)}
                      className="rounded text-purple-600 focus:ring-purple-500"
                    />
                    Exigir Rastreamento Obrigatório por IMEI (Aparelhos)
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModelOpen(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    Salvar Modelo
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
