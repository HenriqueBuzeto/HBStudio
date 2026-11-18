"use client";

import React, { useState, useEffect, useCallback } from "react";
import {useAuth} from "@/lib/auth";
import RootShellLayout from "@/components/RootShellLayout";
import { 
  Boxes, 
  Smartphone, 
  Search, 
  Plus, 
  Eye, 
  EyeOff, 
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Tag,
  ShieldCheck,
  RefreshCw,
  AlertTriangle
} from "lucide-react";

export interface SkuVariant {
  id: string;
  skuCode: string;
  variantName: string;
  barcodeEan?: string;
  defaultPrice: number;
  availableUnitsCount?: number;
  isActive: boolean;
  version: number;
}

export interface ProductModel {
  id: string;
  brandName?: string;
  name: string;
  categoryName?: string;
  brandId: string;
  categoryId: string;
  serializationPolicy: number; // 0 = None, 1 = Optional, 2 = StrictSerialized
  kind: number;
  isActive: boolean;
  skus: SkuVariant[];
  version: number;
}

export interface InventoryUnit {
  id: string;
  productSkuId: string;
  skuCode?: string;
  modelName?: string;
  serialNumber?: string;
  imei1?: string;
  imei2?: string;
  condition: number;
  grade: number;
  batteryHealthPercentage?: number;
  acquisitionCost?: number;
  supplierPartyId?: string;
  operationalStatus: number;
  inspectionNotes?: string;
  acquisitionDateUtc: string;
  version: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface Brand {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export default function CatalogPage() {
  const {hasPermission,isLoading:authLoading}=useAuth();
  const canManage=hasPermission("catalog.products.manage");
  const canViewCost=hasPermission("catalog.cost.view");
  const [models, setModels] = useState<ProductModel[]>([]);
  const [units, setUnits] = useState<InventoryUnit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadFailures,setLoadFailures]=useState<string[]>([]);
  const [lastLoadedAt,setLastLoadedAt]=useState<Date|null>(null);
  const [isCategoryOpen,setIsCategoryOpen]=useState(false);
  const [isBrandOpen,setIsBrandOpen]=useState(false);
  const [categoryName,setCategoryName]=useState("");
  const [categorySlug,setCategorySlug]=useState("");
  const [brandName,setBrandName]=useState("");
  const [brandDescription,setBrandDescription]=useState("");

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"models" | "units">("models");
  const [search, setSearch] = useState("");
  const [showCost, setShowCost] = useState(false);

  // Modais
  const [isCreateModelOpen, setIsCreateModelOpen] = useState(false);
  const [isCreateSkuOpen, setIsCreateSkuOpen] = useState(false);
  const [isUpdatePriceOpen, setIsUpdatePriceOpen] = useState(false);
  const [isRegisterUnitOpen, setIsRegisterUnitOpen] = useState(false);
  const [isApproveUnitOpen, setIsApproveUnitOpen] = useState(false);

  // Estado de Formulário de Modelo
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelKind,setModelKind]=useState(1);
  const [policy, setPolicy] = useState(2); // StrictSerialized por padrão para eletrônicos/smartphones
  const [modelDescription, setModelDescription] = useState("");
  const [initialSkuCode, setInitialSkuCode] = useState("");
  const [initialVariantName, setInitialVariantName] = useState("");
  const [initialPrice, setInitialPrice] = useState("");

  // Estado para Adicionar SKU
  const [targetModelId, setTargetModelId] = useState<string | null>(null);
  const [newSkuCode, setNewSkuCode] = useState("");
  const [newSkuVariantName, setNewSkuVariantName] = useState("");
  const [newSkuPrice, setNewSkuPrice] = useState("");
  const [newSkuBarcode, setNewSkuBarcode] = useState("");

  // Estado para Atualizar Preço
  const [targetSku, setTargetSku] = useState<SkuVariant | null>(null);
  const [updatePriceValue, setUpdatePriceValue] = useState("");

  // Estado para Registrar Unidade
  const [unitSkuId, setUnitSkuId] = useState("");
  const [unitCondition, setUnitCondition] = useState(2); // PreOwned
  const [unitCost, setUnitCost] = useState("");
  const [unitImei1, setUnitImei1] = useState("");
  const [unitImei2, setUnitImei2] = useState("");
  const [unitSerial, setUnitSerial] = useState("");
  const [unitGrade, setUnitGrade] = useState(1); // Grade A
  const [unitBattery, setUnitBattery] = useState("");
  const [unitNotes, setUnitNotes] = useState("");

  // Estado para Aprovar Unidade
  const [targetUnit, setTargetUnit] = useState<InventoryUnit | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  // Loads are independent; a failed route must never look like an empty table.
  const loadCatalogData=useCallback(async()=>{
    setIsLoading(true);
    setErrorMsg(null);
    const endpoints=[
      ["Categorias","/api/catalog/categories"],
      ["Marcas","/api/catalog/brands"],
      ["Modelos","/api/catalog/models"],
      ["Unidades","/api/catalog/units"]
    ] as const;
    const results=await Promise.allSettled(endpoints.map(async([name,url])=>{
      const res=await fetch(url,{cache:"no-store",credentials:"same-origin"});
      if(!res.ok){
        const body=await res.json().catch(()=>null);
        throw new Error(name+": "+(body?.error||"HTTP "+res.status));
      }
      const value:unknown=await res.json();
      if(!Array.isArray(value))throw new Error(name+": contrato de resposta inválido.");
      return value;
    }));
    const failures:string[]=[];
    const details:string[]=[];
    results.forEach((outcome,i)=>{
      const name=endpoints[i][0];
      if(outcome.status==="rejected"){
        failures.push(name);
        details.push(outcome.reason instanceof Error?outcome.reason.message:name+" indisponível");
        return;
      }
      switch(name){
        case "Categorias":setCategories(outcome.value as Category[]);break;
        case "Marcas":setBrands(outcome.value as Brand[]);break;
        case "Modelos":setModels(outcome.value as ProductModel[]);break;
        case "Unidades":setUnits(outcome.value as InventoryUnit[]);break;
      }
    });
    setLoadFailures(failures);
    setLastLoadedAt(new Date());
    if(details.length)setErrorMsg("Falha parcial de consulta ao Neon: "+details.join(" • ")+". Os registros já carregados não foram apagados.");
    setIsLoading(false);
  },[]);

  useEffect(()=>{
    if(!authLoading)void loadCatalogData();
  },[authLoading,loadCatalogData]);

  const createCategory=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!canManage){setErrorMsg("Permissão catalog.products.manage necessária.");return;}
    try{
      const res=await fetch("/api/catalog/categories",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:categoryName,slug:categorySlug,parentCategoryId:null})});
      const json=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(json.error||"Categoria não cadastrada.");
      setSelectedCategoryId(json.id);
      setIsCategoryOpen(false);setCategoryName("");setCategorySlug("");
      await loadCatalogData();
      setSuccessMsg("Categoria cadastrada no Neon.");
    }catch(err){setErrorMsg(err instanceof Error?err.message:"Erro ao salvar categoria.");}
  };
  const createBrand=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(!canManage){setErrorMsg("Permissão catalog.products.manage necessária.");return;}
    try{
      const res=await fetch("/api/catalog/brands",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:brandName,description:brandDescription})});
      const json=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(json.error||"Marca não cadastrada.");
      setSelectedBrandId(json.id);
      setIsBrandOpen(false);setBrandName("");setBrandDescription("");
      await loadCatalogData();
      setSuccessMsg("Marca cadastrada no Neon.");
    }catch(err){setErrorMsg(err instanceof Error?err.message:"Erro ao salvar marca.");}
  };

  // Handler: Criar Modelo com SKU inicial em Transação Atômica no Backend
  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim() || !selectedBrandId || !selectedCategoryId || !initialSkuCode.trim() || !initialPrice.trim()) {
      setErrorMsg("Preencha todos os campos obrigatórios do modelo e SKU.");
      return;
    }

    try {
      const payload = {
        name: modelName.trim(),
        kind: modelKind,
        serializationPolicy: policy,
        brandId: selectedBrandId,
        categoryId: selectedCategoryId,
        description: modelDescription.trim() || null,
        initialSku: {
          skuCode: initialSkuCode.trim().toUpperCase(),
          variantName: initialVariantName.trim() || modelName.trim(),
          defaultPrice: Number(initialPrice),
          barcodeEan: null,
          technicalSpecsJson: null
        }
      };

      const res = await fetch("/api/catalog/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Erro ao criar modelo e SKU atômicos no catálogo.");
        return;
      }

      setSuccessMsg(`Modelo "${modelName}" e SKU inicial persistidos em transação atômica única!`);
      setTimeout(() => setSuccessMsg(null), 4000);

      setIsCreateModelOpen(false);
      setModelName("");
      setModelDescription("");
      setInitialSkuCode("");
      setInitialVariantName("");
      setInitialPrice("");
      await loadCatalogData();
    } catch {
      setErrorMsg("Erro de rede ao salvar modelo.");
    }
  };

  // Handler: Adicionar SKU a modelo existente
  const handleAddSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModelId || !newSkuCode.trim() || !newSkuPrice.trim()) {setErrorMsg("Informe o SKU e preço de venda real.");return;}

    try {
      const payload = {
        skuCode: newSkuCode.trim().toUpperCase(),
        variantName: newSkuVariantName.trim() || newSkuCode.trim().toUpperCase(),
        defaultPrice: Number(newSkuPrice),
        barcodeEan: newSkuBarcode.trim() || null,
        technicalSpecsJson: null
      };

      const res = await fetch(`/api/catalog/models/${targetModelId}/skus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Falha ao registrar novo SKU.");
        return;
      }

      setSuccessMsg(`Novo SKU "${payload.skuCode}" registrado com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsCreateSkuOpen(false);
      setNewSkuCode("");
      setNewSkuVariantName("");
      setNewSkuPrice("");
      setNewSkuBarcode("");
      await loadCatalogData();
    } catch {
      setErrorMsg("Erro de comunicação ao criar SKU.");
    }
  };

  // Handler: Atualizar Preço do SKU
  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSku || !updatePriceValue) return;

    try {
      const payload = {
        newPrice: parseFloat(updatePriceValue),
        expectedVersion: targetSku.version
      };

      const res = await fetch(`/api/catalog/skus/${targetSku.id}/price`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Erro ao atualizar preço.");
        return;
      }

      setSuccessMsg(`Preço do SKU "${targetSku.skuCode}" atualizado com sucesso!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsUpdatePriceOpen(false);
      setTargetSku(null);
      setUpdatePriceValue("");
      await loadCatalogData();
    } catch {
      setErrorMsg("Erro de rede ao atualizar preço do SKU.");
    }
  };

  // Handler: Registrar Unidade Física (IMEI/Serial)
  const handleRegisterUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitSkuId || !unitCost) {
      setErrorMsg("Selecione o SKU e informe o custo de aquisição.");
      return;
    }

    try {
      const payload = {
        productSkuId: unitSkuId,
        condition: unitCondition,
        acquisitionCost: Number(unitCost),
        serialNumber: unitSerial.trim() || null,
        imei1: unitImei1.trim() || null,
        imei2: unitImei2.trim() || null,
        grade: unitGrade,
        batteryHealthPercentage: unitBattery ? parseInt(unitBattery) : null,
        supplierPartyId: null,
        inspectionNotes: unitNotes.trim() || null
      };

      const res = await fetch("/api/catalog/units", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Erro ao registrar unidade física.");
        return;
      }

      setSuccessMsg("Unidade física cadastrada com sucesso!");
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsRegisterUnitOpen(false);
      setUnitCost("");
      setUnitImei1("");
      setUnitImei2("");
      setUnitSerial("");
      setUnitNotes("");
      await loadCatalogData();
    } catch {
      setErrorMsg("Erro de rede ao registrar unidade.");
    }
  };

  // Handler: Aprovar Unidade para Venda
  const handleApproveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUnit) return;

    try {
      const payload = {
        approvalNotes: approvalNotes.trim() || null,
        expectedVersion: targetUnit.version
      };

      const res = await fetch(`/api/catalog/units/${targetUnit.id}/approve`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Falha ao aprovar unidade.");
        return;
      }

      setSuccessMsg("Unidade aprovada para venda com sucesso!");
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsApproveUnitOpen(false);
      setTargetUnit(null);
      setApprovalNotes("");
      await loadCatalogData();
    } catch {
      setErrorMsg("Erro de comunicação ao aprovar unidade.");
    }
  };

  // Filtragem de busca
  const filteredModels = models.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const matchName = m.name.toLowerCase().includes(term);
    const matchBrand = m.brandName?.toLowerCase().includes(term);
    const matchSku = m.skus.some(s => s.skuCode.toLowerCase().includes(term) || s.variantName.toLowerCase().includes(term));
    return matchName || matchBrand || matchSku;
  });

  const filteredUnits = units.filter((u) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const matchImei = u.imei1?.toLowerCase().includes(term) || u.imei2?.toLowerCase().includes(term);
    const matchSerial = u.serialNumber?.toLowerCase().includes(term);
    const matchModel = u.modelName?.toLowerCase().includes(term);
    const matchSku = u.skuCode?.toLowerCase().includes(term);
    return matchImei || matchSerial || matchModel || matchSku;
  });

  const getStatusName = (status: number) => {
    switch (status) {
      case 1: return "Pendente Inspeção";
      case 2: return "Em Bancada";
      case 3: return "Aprovado p/ Venda";
      case 4: return "Quarentena";
      case 5: return "Vendido";
      default: return "Desconhecido";
    }
  };

  return (
    <RootShellLayout>
      <div className="space-y-6">
        {/* Notificações */}
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">✕</button>
          </div>
        )}

        {/* Header estilo HBVisionX */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                Produtos & Aparelhos
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                {isLoading ? "Consultando Neon..." : loadFailures.length ? "Sincronização parcial • atualizar" : "Neon conectado"}
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 mt-1">
              Catálogo de Modelos & Unidades Serializadas
            </h1>
            <p className="text-xs text-slate-500">
              Gestão corporativa de aparelhos novos, seminovos com laudo de bateria/grau estético, peças e insumos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void loadCatalogData()} disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold disabled:opacity-40">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
            {canManage && <button type="button" onClick={()=>setIsCategoryOpen(true)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold hover:bg-purple-50">+ Categoria</button>}
            {canManage && <button type="button" onClick={()=>setIsBrandOpen(true)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold hover:bg-purple-50">+ Marca</button>}
            <button
              onClick={() => setShowCost(!showCost)}
              disabled={!canViewCost}
              title={!canViewCost?"Permissão catalog.cost.view necessária":"Ver ou ocultar custos"}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-colors shadow-xs"
            >
              {showCost ? <EyeOff className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
              <span>{showCost ? "Ocultar Custos" : "Ver Custos Oficiais"}</span>
            </button>
            <button
              onClick={() => setIsRegisterUnitOpen(true)}
              disabled={!canManage}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Registrar Unidade (IMEI)
            </button>
            <button
              onClick={() => setIsCreateModelOpen(true)}
              disabled={!canManage}
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
            {lastLoadedAt && <span className="absolute -top-4 right-0 text-[9px] text-slate-400">Última consulta: {lastLoadedAt.toLocaleTimeString("pt-BR")}</span>}
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
            {isLoading ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400">
                Carregando catálogo do PostgreSQL...
              </div>
            ) : loadFailures.includes("Modelos") && filteredModels.length===0 ? (
              <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-12 text-center text-xs text-amber-800">
                <AlertTriangle className="mx-auto mb-2 h-6 w-6"/>
                Não foi possível consultar modelos. Isso não significa que o banco está vazio.
                <button type="button" onClick={()=>void loadCatalogData()} className="ml-2 font-bold underline">Tentar novamente</button>
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/90 p-16 text-center text-slate-400 shadow-xs">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">{search.trim() ? "Nenhum modelo encontrado na busca" : "Nenhum modelo cadastrado no catálogo"}</p>
                <p className="text-xs text-slate-400 mt-1">{search.trim()?"Experimente outro nome ou SKU.":"Cadastre novos modelos de smartphones, acessórios ou peças de reposição."}</p>
                <button
                  onClick={() => setIsCreateModelOpen(true)}
                  className="mt-4 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                >
                  Cadastrar Primeiro Modelo
                </button>
              </div>
            ) : (
              filteredModels.map((model) => (
                <div key={model.id} className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-50 text-purple-700">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {model.brandName || "Marca"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {model.categoryName || "Categoria"}
                          </span>
                          {model.serializationPolicy === 2 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                              Rastreamento IMEI Obrigatório
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 mt-1">{model.name}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        disabled={!canManage || !model.isActive}
                        onClick={() => {
                          setTargetModelId(model.id);
                          setIsCreateSkuOpen(true);
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                      >
                        + Novo SKU
                      </button>
                      <span className={"px-2 py-0.5 rounded-full text-[10px] font-bold border "+(model.isActive?"bg-emerald-50 text-emerald-700 border-emerald-200":"bg-slate-100 text-slate-500 border-slate-200")}>
                        {model.isActive?"Ativo":"Inativo"}
                      </span>
                    </div>
                  </div>

                  {/* SKUs Variants Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Código SKU</th>
                          <th className="py-2.5 px-3">Variação / Especificação</th>
                          <th className="py-2.5 px-3">Preço Atual</th>
                          <th className="py-2.5 px-3">Unidades em Estoque</th>
                          <th className="py-2.5 px-3 text-right">Ação</th>
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
                                {sku.availableUnitsCount ?? 0} un aprovada(s)
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                disabled={!canManage || !sku.isActive}
                                onClick={() => {
                                  setTargetSku(sku);
                                  setUpdatePriceValue(sku.defaultPrice.toString());
                                  setIsUpdatePriceOpen(true);
                                }}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-bold"
                              >
                                Alterar Preço
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
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
                  <th className="py-3 px-4">Saúde Bateria</th>
                  {showCost && canViewCost && <th className="py-3 px-4 font-mono text-rose-700">Custo de Aquisição</th>}
                  <th className="py-3 px-4">Status Operacional</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={showCost ? 7 : 6} className="py-12 text-center text-slate-400">
                      Carregando unidades serializadas do banco...
                    </td>
                  </tr>
                ) : loadFailures.includes("Unidades") && filteredUnits.length===0 ? (
                  <tr><td colSpan={showCost?7:6} className="bg-amber-50 py-12 text-center text-amber-800">
                    Unidades indisponíveis no momento. Isso não indica ausência de estoque. Clique em Atualizar.
                  </td></tr>
                ) : filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={showCost ? 7 : 6} className="py-16 text-center text-slate-400">
                      <FolderOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      <p className="font-bold text-slate-700">{search.trim() ? "Nenhuma unidade encontrada na busca" : "Nenhum aparelho serializado cadastrado"}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Clique em "Registrar Unidade (IMEI)" para cadastrar aparelhos novos ou seminovos.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900">{unit.modelName || "Modelo"}</div>
                        <div className="text-[10px] font-mono text-slate-400">{unit.skuCode || "SKU"}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-purple-700">
                        {unit.imei1 || unit.serialNumber || "Sem identificador"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">
                          {unit.condition === 1 ? "Novo Lacrado" : unit.condition === 2 ? "Seminovo / Usado" : unit.condition === 3 ? "Recondicionado" : "Caixa aberta"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {unit.grade === 0 ? "Não aplicável" : unit.grade === 1 ? "Grau A / Impecável" : unit.grade === 2 ? "Grau B / Leve Uso" : "Grau C"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {unit.batteryHealthPercentage !== null && unit.batteryHealthPercentage !== undefined ? (
                          <span className="font-bold text-emerald-600">{unit.batteryHealthPercentage}%</span>
                        ) : (
                          <span className="text-slate-400">N/A</span>
                        )}
                      </td>
                      {showCost && canViewCost && (
                        <td className="py-3 px-4 font-mono text-rose-700 font-bold">
                          {unit.acquisitionCost !== null && unit.acquisitionCost !== undefined
                            ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.acquisitionCost)
                            : "Sigiloso"}
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          unit.operationalStatus === 3
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : unit.operationalStatus === 4
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}>
                          {getStatusName(unit.operationalStatus)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (unit.operationalStatus === 1 || unit.operationalStatus === 2) && (
                          <button
                            onClick={() => {
                              setTargetUnit(unit);
                              setIsApproveUnitOpen(true);
                            }}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs"
                          >
                            Aprovar Venda
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Cadastro real de categoria */}
        {isCategoryOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div role="dialog" aria-label="Nova Categoria" aria-modal="true" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between"><h3 className="font-extrabold text-slate-900">Nova categoria</h3>
                <button type="button" onClick={()=>setIsCategoryOpen(false)} aria-label="Fechar">✕</button></div>
              <form onSubmit={createCategory} className="space-y-3">
                <label className="block text-xs font-bold text-slate-600">Nome da categoria *
                  <input required maxLength={100} className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                    value={categoryName} onChange={e=>{
                      setCategoryName(e.target.value);
                      setCategorySlug(e.target.value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""));
                    }} placeholder="Ex.: Smartphones" /></label>
                <label className="block text-xs font-bold text-slate-600">Slug / identificador *
                  <input required maxLength={100} className="mt-1 w-full rounded-xl border border-slate-200 p-3 font-mono"
                    value={categorySlug} onChange={e=>setCategorySlug(e.target.value.toLowerCase())} placeholder="smartphones" /></label>
                <p className="text-[11px] text-slate-500">Identificador único no cadastro da sua empresa.</p>
                <div className="flex justify-end gap-2"><button type="button" onClick={()=>setIsCategoryOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button>
                  <button type="submit" className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white">Salvar categoria</button></div>
              </form>
            </div>
          </div>
        )}
        {/* Cadastro real de marca */}
        {isBrandOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
            <div role="dialog" aria-modal="true" aria-label="Nova Marca" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between"><h3 className="font-extrabold text-slate-900">Nova marca</h3>
                <button type="button" onClick={()=>setIsBrandOpen(false)} aria-label="Fechar">✕</button></div>
              <form onSubmit={createBrand} className="space-y-3">
                <label className="block text-xs font-bold text-slate-600">Nome da marca *
                  <input required maxLength={100} className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                    value={brandName} onChange={e=>setBrandName(e.target.value)} placeholder="Ex.: Apple" /></label>
                <label className="block text-xs font-bold text-slate-600">Descrição (opcional)
                  <textarea maxLength={500} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 p-3"
                    value={brandDescription} onChange={e=>setBrandDescription(e.target.value)} /></label>
                <div className="flex justify-end gap-2"><button type="button" onClick={()=>setIsBrandOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold">Cancelar</button>
                  <button type="submit" className="rounded-xl bg-purple-700 px-4 py-2 text-xs font-bold text-white">Salvar marca</button></div>
              </form>
            </div>
          </div>
        )}
        {/* Modal: Novo Modelo */}
        {isCreateModelOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Cadastrar Novo Modelo no Catálogo</h3>
                <button onClick={() => setIsCreateModelOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleCreateModel} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="font-bold text-slate-700">Marca *</label>
                      <button type="button" onClick={()=>setIsBrandOpen(true)} className="text-[11px] font-bold text-purple-700">+ Cadastrar</button>
                    </div>
                    <select
                      required
                      value={selectedBrandId}
                      onChange={(e) => setSelectedBrandId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 text-slate-800"
                    >
                      <option value="">Selecione...</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="font-bold text-slate-700">Categoria *</label>
                      <button type="button" onClick={()=>setIsCategoryOpen(true)} className="text-[11px] font-bold text-purple-700">+ Cadastrar</button>
                    </div>
                    <select
                      required
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 text-slate-800"
                    >
                      <option value="">Selecione...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tipo do produto *</label>
                  <select value={modelKind} onChange={e=>{
                      const value=Number(e.target.value);setModelKind(value);
                      if(value!==1)setPolicy(0);
                    }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800">
                    <option value={1}>Produto para revenda (ex.: smartphone, computador)</option>
                    <option value={2}>Insumo / Matéria-prima (ex.: filamento)</option>
                    <option value={3}>Peça de reposição</option>
                    <option value={4}>Serviço técnico</option>
                    <option value={5}>Produto fabricado em 3D</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome do Modelo *</label>
                  <input
                    type="text"
                    required
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="Ex: iPhone 15 Pro Max"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 text-slate-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Descrição</label>
                  <input
                    type="text"
                    value={modelDescription}
                    onChange={(e) => setModelDescription(e.target.value)}
                    placeholder="Descrição comercial e detalhes técnicos"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-purple-600 text-slate-800"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-extrabold text-purple-700 uppercase tracking-wider block mb-2">
                    Variante / SKU Inicial
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Código SKU *</label>
                      <input
                        type="text"
                        required
                        value={initialSkuCode}
                        onChange={(e) => setInitialSkuCode(e.target.value)}
                        placeholder="IPH15PM-256"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Variante / Cor</label>
                      <input
                        type="text"
                        value={initialVariantName}
                        onChange={(e) => setInitialVariantName(e.target.value)}
                        placeholder="256GB Titânio Azul"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">Preço Venda (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={initialPrice}
                        onChange={(e) => setInitialPrice(e.target.value)}
                        placeholder="6500.00"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={policy === 2}
                      onChange={(e) => setPolicy(e.target.checked ? 2 : 0)}
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
                    disabled={!canManage}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20"
                  >
                    Salvar no PostgreSQL
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Adicionar SKU */}
        {isCreateSkuOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Adicionar Novo SKU ao Modelo</h3>
                <button onClick={() => setIsCreateSkuOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleAddSku} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Código SKU *</label>
                  <input
                    type="text"
                    required
                    value={newSkuCode}
                    onChange={(e) => setNewSkuCode(e.target.value)}
                    placeholder="Ex: IPH15PM-512-NAT"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nome da Variante *</label>
                  <input
                    type="text"
                    required
                    value={newSkuVariantName}
                    onChange={(e) => setNewSkuVariantName(e.target.value)}
                    placeholder="Ex: 512GB Titânio Natural"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Preço Padrão (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newSkuPrice}
                    onChange={(e) => setNewSkuPrice(e.target.value)}
                    placeholder="7500.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Código de Barras EAN</label>
                  <input
                    type="text"
                    value={newSkuBarcode}
                    onChange={(e) => setNewSkuBarcode(e.target.value)}
                    placeholder="789..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateSkuOpen(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!canManage}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Criar SKU
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Atualizar Preço do SKU */}
        {isUpdatePriceOpen && targetSku && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Atualizar Preço do SKU</h3>
                <button onClick={() => setIsUpdatePriceOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleUpdatePrice} className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-mono font-bold text-slate-800 block">{targetSku.skuCode}</span>
                  <span className="text-slate-500 text-[11px]">{targetSku.variantName}</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Novo Preço de Venda (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={updatePriceValue}
                    onChange={(e) => setUpdatePriceValue(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsUpdatePriceOpen(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Salvar Preço
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Registrar Unidade (IMEI) */}
        {isRegisterUnitOpen && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Registrar Aparelho / Unidade Serializada</h3>
                <button onClick={() => setIsRegisterUnitOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleRegisterUnit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SKU Vinculado *</label>
                  <select
                    required
                    value={unitSkuId}
                    onChange={(e) => setUnitSkuId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  >
                    <option value="">Selecione o SKU...</option>
                    {models.flatMap(m => m.skus).map((s) => (
                      <option key={s.id} value={s.id}>{s.skuCode} - {s.variantName}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">IMEI 1 (Principal)</label>
                    <input
                      type="text"
                      value={unitImei1}
                      onChange={(e) => setUnitImei1(e.target.value)}
                      placeholder="354891828374651"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">IMEI 2 (Opcional)</label>
                    <input
                      type="text"
                      value={unitImei2}
                      onChange={(e) => setUnitImei2(e.target.value)}
                      placeholder="354891828374652"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Condição</label>
                    <select
                      value={unitCondition}
                      onChange={(e) => setUnitCondition(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                    >
                      <option value={1}>Novo Lacrado</option>
                      <option value={2}>Seminovo / Usado</option>
                      <option value={3}>Recondicionado</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Grau Estético</label>
                    <select
                      value={unitGrade}
                      onChange={(e) => setUnitGrade(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                    >
                      <option value={1}>Grau A / Impecável</option>
                      <option value={2}>Grau B / Leves Marcas</option>
                      <option value={3}>Grau C / Marcas Visíveis</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Saúde Bateria (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={unitBattery}
                      onChange={(e) => setUnitBattery(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Custo de Aquisição (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={unitCost}
                    onChange={(e) => setUnitCost(e.target.value)}
                    placeholder="3500.00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-rose-700"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Laudo de Inspeção / Observações</label>
                  <input
                    type="text"
                    value={unitNotes}
                    onChange={(e) => setUnitNotes(e.target.value)}
                    placeholder="Aparelho aprovado em checklist de áudio, display e Face ID"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsRegisterUnitOpen(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Registrar no Estoque
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Aprovar Unidade para Venda */}
        {isApproveUnitOpen && targetUnit && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-900">Aprovar Unidade para Venda</h3>
                <button onClick={() => setIsApproveUnitOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleApproveUnit} className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="font-mono font-bold text-purple-700 block">
                    {targetUnit.imei1 || targetUnit.serialNumber}
                  </span>
                  <span className="text-slate-500 text-[11px]">{targetUnit.modelName}</span>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Notas de Aprovação Comercial</label>
                  <input
                    type="text"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Checklist de bancada 100% OK, liberado p/ vitrine"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsApproveUnitOpen(false)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                  >
                    Confirmar Aprovação
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
