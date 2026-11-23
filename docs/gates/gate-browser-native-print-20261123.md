# HB Studio — impressão gratuita via Chrome/Edge e driver do Windows

**Implementação:** `feat/browser-native-auto-print-20261123`. Dependência: PR #16 (`feat/internal-receipts-print-hub-20261123`).

## Escolha técnica
Usar `window.print()` + driver instalado no computador do caixa. **Zero mensalidade** e nenhuma necessidade de QZ Tray no uso normal. Impressão silenciosa é configuração **do navegador/Windows**, não permissão que o site consiga impor. Chrome/Edge podem bloquear popup e/ou mostrar a interface de impressão. O aplicativo não consegue enumerar impressoras instaladas, decidir o destino, saber se papel saiu, cortar bobina por ESC/POS ou controlar gaveta.

Documentação oficial Edge:
- https://learn.microsoft.com/deployedge/microsoft-edge-browser-policies/silentprintingenabled
- https://learn.microsoft.com/deployedge/microsoft-edge-configure-kiosk-mode
Políticas Chrome:
- https://support.google.com/chrome/a/answer/2657289?hl=en
Mídia impressa web:
- https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Printing

## Configuração por terminal
1. Instalar driver oficial da térmica USB/Ethernet e testar a impressora no Windows.
2. Configurar largura da mídia **58 mm** ou **80 mm** no driver; margens e escala conforme hardware.
3. Abrir `/documents/printers` no HB Studio; selecionar papel e ativar preferências desejadas.
4. Imprimir teste e confirmar no papel: margens laterais, R$, acentos e corte. Para PDF/A4, preferir outra sessão/perfil de navegador.
5. Para impressão com diálogo, usar Chrome/Edge normalmente. Para impressão sem diálogo, em **terminal dedicado** iniciar Chrome por atalho com `--kiosk-printing`, **ou** configurar política de Edge `SilentPrintingEnabled` sob gerenciamento administrativo. Verificar na versão instalada; a aplicação web não verifica a presença real desse modo nem a impressora padrão.
6. Se usar `--kiosk-printing`, o navegador pode enviar **qualquer impressão** para o dispositivo padrão. Usar **perfil separado e dedicado ao PDV**, não o navegador pessoal que salva PDFs.

Exemplo de destino do atalho Windows, caso Chrome esteja instalado na pasta típica:
`"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%LOCALAPPDATA%\HBStudioCashChrome" --kiosk-printing "https://hbstudio.vercel.app/sales"`
Verificar caminho de instalação, políticas do equipamento e perfil antes de executar. No Edge corporativo, preferir a política oficial `SilentPrintingEnabled` e `PrintPreviewUseSystemDefaultPrinter` com perfil/gestão dedicados.

## Comportamento implementado
- Preferências por perfil do navegador: papel 58/80/A4, impressão automática de orçamento/OS e reserva de preferência futura de venda. Padrão **desligado**. Armazenamento versionado em localStorage; não se aplica a outros computadores.
- **Orçamento**: depois do POST com resposta válida e confirmação de ID, abrir documento da operação gravada no Neon. A janela é reservada no clique para reduzir bloqueio do navegador; falha de popup oferece link para imprimir manualmente. Sem lançamento financeiro.
- **Ordem de serviço**: depois do POST atômico e retorno de ID, abrir documento original, preservando a mesma regra de fallback.
- **Documento**: só tenta imprimir ao consultar e autorizar dados persistidos; `?auto=1` mais preferência local habilitada; tentativa única por documento/tab com sessionStorage; refresh não reimprime automaticamente. `window.print()` é uma *solicitação*, não confirmação do papel, e a reimpressão é manual.
- **Vendas**: configuração futura presente na tela, mas **não ativada**. `POST /api/sales` continua com `CHECKOUT_NOT_HOMOLOGATED`. Não imprimir recibo de venda paga sem confirmação financeira e elegibilidade fiscal.
- Manter PDF pelo destino do diálogo, WhatsApp via resumo e impressora A4 por escolha manual. Sem anexos automatizados.

## Critérios para QA físico e aprovação
- Windows 10/11, Chrome e Edge suportados pelo cliente, conta com impressora padrão correta.
- Modelos térmicos 58 e 80 mm, 1/10/100 itens, caracteres especiais, quebra de página, cortes/margens, escala.
- Sem impressora, impressora desconectada e popup bloqueado: não duplicar POST nem mostrar "impresso" sem evidência.
- Auto impressão desligada por padrão, sessão bloqueada/expirada, 401/403/404, empresa/filial, download PDF e reimpressão.
- React StrictMode / refresh / back não devem reenviar impressão automática.
- Browser em modo kiosk: testar impressora padrão de forma controlada; evitar mandar A4/PDF para bobina de caixa.
- Contratos e outros documentos não têm autoimpressão para evitar envio inadvertido.
- Venda interna válida exige motor transacional de pagamento/estoque/financeiro e análise legal da dispensa fiscal; dinheiro por si só **não** dispensa documento.

**Estado:** código de preparação, CI ainda precisa confirmar commit final. Sem deploy e sem testes com impressora física nesta conversa.
