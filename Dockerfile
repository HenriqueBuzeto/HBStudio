# ==============================================================================
# Multi-stage Dockerfile para HB Studio ERP API (.NET 10)
# Contexto de Build: Raiz do repositório (monorepo)
# Compatível com Railway, Render, Docker e Kubernetes
# ==============================================================================

# Estágio 1: Build & Publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copiar arquivos de projeto (.csproj) para restore otimizado com cache de camadas
COPY ["apps/api/api.csproj", "apps/api/"]
COPY ["src/BuildingBlocks/BuildingBlocks.Domain/BuildingBlocks.Domain.csproj", "src/BuildingBlocks/BuildingBlocks.Domain/"]
COPY ["src/BuildingBlocks/BuildingBlocks.Application/BuildingBlocks.Application.csproj", "src/BuildingBlocks/BuildingBlocks.Application/"]
COPY ["src/BuildingBlocks/BuildingBlocks.Infrastructure/BuildingBlocks.Infrastructure.csproj", "src/BuildingBlocks/BuildingBlocks.Infrastructure/"]
COPY ["src/BuildingBlocks/BuildingBlocks.Security/BuildingBlocks.Security.csproj", "src/BuildingBlocks/BuildingBlocks.Security/"]

COPY ["src/Modules/IdentityAccess/IdentityAccess.Domain/IdentityAccess.Domain.csproj", "src/Modules/IdentityAccess/IdentityAccess.Domain/"]
COPY ["src/Modules/IdentityAccess/IdentityAccess.Application/IdentityAccess.Application.csproj", "src/Modules/IdentityAccess/IdentityAccess.Application/"]
COPY ["src/Modules/IdentityAccess/IdentityAccess.Infrastructure/IdentityAccess.Infrastructure.csproj", "src/Modules/IdentityAccess/IdentityAccess.Infrastructure/"]

COPY ["src/Modules/Parties/Parties.Domain/Parties.Domain.csproj", "src/Modules/Parties/Parties.Domain/"]
COPY ["src/Modules/Parties/Parties.Application/Parties.Application.csproj", "src/Modules/Parties/Parties.Application/"]
COPY ["src/Modules/Parties/Parties.Infrastructure/Parties.Infrastructure.csproj", "src/Modules/Parties/Parties.Infrastructure/"]

COPY ["src/Modules/Catalog/Catalog.Domain/Catalog.Domain.csproj", "src/Modules/Catalog/Catalog.Domain/"]
COPY ["src/Modules/Catalog/Catalog.Application/Catalog.Application.csproj", "src/Modules/Catalog/Catalog.Application/"]
COPY ["src/Modules/Catalog/Catalog.Infrastructure/Catalog.Infrastructure.csproj", "src/Modules/Catalog/Catalog.Infrastructure/"]

COPY ["src/Modules/Inventory/Inventory.Domain/Inventory.Domain.csproj", "src/Modules/Inventory/Inventory.Domain/"]
COPY ["src/Modules/Inventory/Inventory.Application/Inventory.Application.csproj", "src/Modules/Inventory/Inventory.Application/"]
COPY ["src/Modules/Inventory/Inventory.Infrastructure/Inventory.Infrastructure.csproj", "src/Modules/Inventory/Inventory.Infrastructure/"]

COPY ["src/Modules/Procurement/Procurement.Domain/Procurement.Domain.csproj", "src/Modules/Procurement/Procurement.Domain/"]
COPY ["src/Modules/Procurement/Procurement.Application/Procurement.Application.csproj", "src/Modules/Procurement/Procurement.Application/"]
COPY ["src/Modules/Procurement/Procurement.Infrastructure/Procurement.Infrastructure.csproj", "src/Modules/Procurement/Procurement.Infrastructure/"]

COPY ["src/Modules/Sales/Sales.Domain/Sales.Domain.csproj", "src/Modules/Sales/Sales.Domain/"]
COPY ["src/Modules/Sales/Sales.Application/Sales.Application.csproj", "src/Modules/Sales/Sales.Application/"]
COPY ["src/Modules/Sales/Sales.Infrastructure/Sales.Infrastructure.csproj", "src/Modules/Sales/Sales.Infrastructure/"]

COPY ["src/Modules/CashManagement/CashManagement.Domain/CashManagement.Domain.csproj", "src/Modules/CashManagement/CashManagement.Domain/"]
COPY ["src/Modules/CashManagement/CashManagement.Application/CashManagement.Application.csproj", "src/Modules/CashManagement/CashManagement.Application/"]
COPY ["src/Modules/CashManagement/CashManagement.Infrastructure/CashManagement.Infrastructure.csproj", "src/Modules/CashManagement/CashManagement.Infrastructure/"]

COPY ["src/Modules/Financial/Financial.Domain/Financial.Domain.csproj", "src/Modules/Financial/Financial.Domain/"]
COPY ["src/Modules/Financial/Financial.Application/Financial.Application.csproj", "src/Modules/Financial/Financial.Application/"]
COPY ["src/Modules/Financial/Financial.Infrastructure/Financial.Infrastructure.csproj", "src/Modules/Financial/Financial.Infrastructure/"]

COPY ["src/Modules/PartnersCapital/PartnersCapital.Domain/PartnersCapital.Domain.csproj", "src/Modules/PartnersCapital/PartnersCapital.Domain/"]
COPY ["src/Modules/PartnersCapital/PartnersCapital.Application/PartnersCapital.Application.csproj", "src/Modules/PartnersCapital/PartnersCapital.Application/"]
COPY ["src/Modules/PartnersCapital/PartnersCapital.Infrastructure/PartnersCapital.Infrastructure.csproj", "src/Modules/PartnersCapital/PartnersCapital.Infrastructure/"]

COPY ["src/Modules/RepairService/RepairService.Domain/RepairService.Domain.csproj", "src/Modules/RepairService/RepairService.Domain/"]
COPY ["src/Modules/RepairService/RepairService.Application/RepairService.Application.csproj", "src/Modules/RepairService/RepairService.Application/"]
COPY ["src/Modules/RepairService/RepairService.Infrastructure/RepairService.Infrastructure.csproj", "src/Modules/RepairService/RepairService.Infrastructure/"]

COPY ["src/Modules/CRM/CRM.Domain/CRM.Domain.csproj", "src/Modules/CRM/CRM.Domain/"]
COPY ["src/Modules/CRM/CRM.Application/CRM.Application.csproj", "src/Modules/CRM/CRM.Application/"]
COPY ["src/Modules/CRM/CRM.Infrastructure/CRM.Infrastructure.csproj", "src/Modules/CRM/CRM.Infrastructure/"]

COPY ["src/Modules/Messaging/Messaging.Domain/Messaging.Domain.csproj", "src/Modules/Messaging/Messaging.Domain/"]
COPY ["src/Modules/Messaging/Messaging.Application/Messaging.Application.csproj", "src/Modules/Messaging/Messaging.Application/"]
COPY ["src/Modules/Messaging/Messaging.Infrastructure/Messaging.Infrastructure.csproj", "src/Modules/Messaging/Messaging.Infrastructure/"]

COPY ["src/Modules/Manufacturing3D/Manufacturing3D.Domain/Manufacturing3D.Domain.csproj", "src/Modules/Manufacturing3D/Manufacturing3D.Domain/"]
COPY ["src/Modules/Manufacturing3D/Manufacturing3D.Application/Manufacturing3D.Application.csproj", "src/Modules/Manufacturing3D/Manufacturing3D.Application/"]
COPY ["src/Modules/Manufacturing3D/Manufacturing3D.Infrastructure/Manufacturing3D.Infrastructure.csproj", "src/Modules/Manufacturing3D/Manufacturing3D.Infrastructure/"]

COPY ["src/Modules/DigitalProjects/DigitalProjects.Domain/DigitalProjects.Domain.csproj", "src/Modules/DigitalProjects/DigitalProjects.Domain/"]
COPY ["src/Modules/DigitalProjects/DigitalProjects.Application/DigitalProjects.Application.csproj", "src/Modules/DigitalProjects/DigitalProjects.Application/"]
COPY ["src/Modules/DigitalProjects/DigitalProjects.Infrastructure/DigitalProjects.Infrastructure.csproj", "src/Modules/DigitalProjects/DigitalProjects.Infrastructure/"]

COPY ["src/Modules/FleetLogistics/FleetLogistics.Domain/FleetLogistics.Domain.csproj", "src/Modules/FleetLogistics/FleetLogistics.Domain/"]
COPY ["src/Modules/FleetLogistics/FleetLogistics.Application/FleetLogistics.Application.csproj", "src/Modules/FleetLogistics/FleetLogistics.Application/"]
COPY ["src/Modules/FleetLogistics/FleetLogistics.Infrastructure/FleetLogistics.Infrastructure.csproj", "src/Modules/FleetLogistics/FleetLogistics.Infrastructure/"]

COPY ["src/Modules/Fiscal/Fiscal.Domain/Fiscal.Domain.csproj", "src/Modules/Fiscal/Fiscal.Domain/"]
COPY ["src/Modules/Fiscal/Fiscal.Application/Fiscal.Application.csproj", "src/Modules/Fiscal/Fiscal.Application/"]
COPY ["src/Modules/Fiscal/Fiscal.Infrastructure/Fiscal.Infrastructure.csproj", "src/Modules/Fiscal/Fiscal.Infrastructure/"]

# Restaurar dependências
RUN dotnet restore "apps/api/api.csproj"

# Copiar todo o código-fonte
COPY src/ src/
COPY apps/api/ apps/api/

# Compilar e publicar binários otimizados de produção
WORKDIR "/src/apps/api"
RUN dotnet publish "api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Estágio 2: Imagem Final de Execução (Runtime leve e seguro)
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Variáveis de ambiente padrão
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
ENV PORT=8080
ENV ASPNETCORE_URLS=http://0.0.0.0:8080

# Copiar build gerado
COPY --from=build /app/publish .

# Usuário não-root para segurança corporativa
USER $APP_UID

EXPOSE 8080

ENTRYPOINT ["dotnet", "api.dll"]
