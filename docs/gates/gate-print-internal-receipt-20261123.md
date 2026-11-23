# Gate de impressão e comprovantes internos — 23/11/2026

## Funcionalidades implementadas no PR #16
- Endpoint permissionado de consulta de documentos persistidos no Neon: orçamentos, ordens de serviço e minutas de contrato, sempre com escopo por tenant e filial.
- Formatação de impressão para bobinas 58 mm, 80 mm e A4 usando o diálogo do navegador e os drivers locais.
- Opção de salvar como PDF no diálogo do navegador. Não é download direto do arquivo PDF.
- Opção de compartilhar resumo via WhatsApp com abertura voluntária do aplicativo e escolha do destinatário. Não há envio automático de PDF nem integração de mídia ao WhatsApp Business Cloud API.
- Página de configuração local de papel e impressão de teste para computador.
- Ações de impressão adicionadas às telas existentes de orçamento e assistência técnica.
- Bloqueio de recibo de venda ainda não liquidada: não imprimir pagamento ou autorização SEFAZ fictícios.

## Padrão de qualidade para impressora
A versão atual usa impressão nativa de Chrome/Edge. É preciso instalar o driver compatível no Windows/macOS, configurar a bobina correta e validar modelos reais. Larguras úteis aproximadas: 48 mm na bobina 58 e 72 mm na bobina 80; variam por fabricante. Cabeçalho/rodapé do navegador precisam estar desativados.

Para impressão sem janela, a etapa futura é integrar conector local como QZ Tray com assinatura de chamadas, controle da impressora e comandos ESC/POS. Referências: https://qz.io/docs/getting-started e https://qz.io/docs/faq .

Para gerar o PDF automaticamente como arquivo no servidor, é necessário backend de geração, fontes em pt-BR, armazenamento privado e controle de acesso. Para WhatsApp com PDF em anexo, é necessária a API oficial Meta Business, upload privado, consentimento, templates aprovados, webhooks, fila e idempotência.

## Regra financeira/fiscal
Modo de treinamento: operação em QA isolada, sem contaminar banco, estoque, receita, caixa ou contabilidade de produção, e recibo sempre identificado como SIMULAÇÃO.

Venda interna real: continua uma venda e deve atualizar faturamento, estoque, caixa, financeiro e histórico; a dispensa da nota fiscal exige análise legal, elegibilidade por estabelecimento/cliente/operação e revalidação na transação. Pagamento em dinheiro NÃO dispensa nota por si só.

Modo fiscal: transmissão e autorização devem utilizar o provedor oficial da SEFAZ/NFS-e aplicável. Contingência não é um bypass fiscal.

Legislação e documentação técnica: https://portal.fazenda.sp.gov.br/servicos/nfce/ ; https://legislacao.fazenda.sp.gov.br/Paginas/RC29208_2024.aspx ; https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing .

## Gates pendentes
1. Homologação de checkout real: pagamento, estoque, caixa, razão, estornos e fidelidade.
2. Impressão física 58/80 mm e A4 com 1, 10 e 100 itens, caracteres acentuados, cortes e margins.
3. Teste E2E autorizado de acesso 401/403/404, tenant/filial, consentimento WhatsApp.
4. Recibo de venda só após liquidação e verificação fiscal ou dispensa aprovada.
5. Modelo de contrato revisado por jurídico e aceite; atualmente é minuta não assinada.
6. PDF automático e anexos WhatsApp exigem integrações adicionais.

## Status
Implementação inicial disponível na branch feat/internal-receipts-print-hub-20261123, PR #16 draft, sem merge na master ou alterações no Neon de produção. Não afirmar que o ERP, a impressão silenciosa ou o checkout estejam integralmente homologados.
