# QA Enterprise — Máscaras brasileiras e normalização de campos | 23/11/2026

## Objetivo
Corrigir os números exibidos sem pontuação na interface do HB Studio: CPF (000.000.000-00), CNPJ (00.000.000/0000-00), telefones com DDD ((00) 00000-0000 ou (00) 0000-0000), WhatsApp, CEP (00000-000) e datas YYYY-MM-DD no formato DD/MM/YYYY. O tratamento é feito exclusivamente nos campos semanticamente adequados, não por substituição textual global.

## Implementado
- `apps/web/lib/br-format.ts`: formatadores reutilizáveis e normalizadores para CPF, CNPJ, telefone brasileiro com suporte a +55, CEP e datas. Tratamento de números parciais e dados antigos gravados sem máscara; sem alterar banco para exibição.
- `/parties`: CPF/CNPJ, telefone/WhatsApp e CEP em listagem, ficha e novo cadastro; nascimento na ficha; busca com dígitos ou máscaras; troca PF/PJ ajusta apresentação. Payload normalizado.
- `POST /api/parties`: normaliza CPF/CNPJ, telefone e CEP do lado do servidor, valida telefone com DDD e CEP com oito dígitos antes de gravar. Registros anteriores permanecem intactos.
- `/fiscal`: CNPJ/CEP formatados na leitura e edição; enviados somente com dígitos; validação oficial do módulo preservada.
- `/sales`: campo informativo de CPF/CNPJ aceita formato brasileiro.
- `/crm`: lead apresenta telefone formatado, aceita entrada com máscara e envia número normalizado.
- `/users`: CPF de vínculo societário com máscara visual e payload numérico.
- `/procurement`: CPF/CNPJ do fornecedor exibido com máscara nas opções.
- `/partners`: CPF exibido e inserido com máscara; o módulo ainda não possui integração real de cadastro (alerta existente mantido).
- `/messaging`: telefones da lista formatados; campo demonstrativo com máscara, serviço de envio Meta permanece bloqueado.
- `/documents/print`: CNPJ formatado no documento impresso / PDF via navegador.
- Testes automatizados em `apps/web/scripts/test-br-format.cjs`: dígitos, formatos parcial/completo, CEP, telefone fixo/celular/DDI, datas e normalização.
- CI dedicado no GitHub com unit tests, `tsc --noEmit` e `next build`.

## Regras de segurança e preservação de dados
- Documento exibido mascarado não significa validação do CPF/CNPJ. A validação de CPF/CNPJ no backend existente não foi reescrita. Alguns dados legados podem não ter dígitos verificadores válidos.
- Não aplicar máscara de CPF a IMEI (15 dígitos), SKU, código de barras, protocolo, referência bancária, IDs de mensagem/Meta, certificado, CSC, número de OS, inscrição estadual ou inscrição municipal.
- Não alterar RG, IE de outros estados, alfanuméricos, unidades, taxas, percentuais e dados monetários com máscaras genéricas: cada domínio possui validações próprias.
- O telefone de 10/11 dígitos é formato BR. Prefixo +55 é mantido na visualização de registros internacionais BR; números de outros países devem ser preservados até existir suporte internacional. O cadastro de contato brasileiro normaliza para o número local com DDD.
- Dinheiro continua em número decimal no backend e formatação local `pt-BR` na interface; não mudar os cálculos em centavos ou os totais financeiros.
- Não executar UPDATE massivo em dados existentes para inserir pontuação; buscar, comparar e exportar devem usar valores canônicos.
- Respeitar permissão `customers.sensitive.view` vigente nas APIs — o formato não deve contornar ocultação de dados.

## Homologação exigida
1. Listagem com dados reais e mascarados por permissão: CPF, CNPJ, telefone celular/fixo, CEP. Comparar com Neon sem mudar o valor canônico.
2. Inclusão de cliente PF e fornecedor PJ, CPF/CNPJ com e sem pontuação, telefone/CEP ao colar, salvar e recarregar.
3. Validar CPF/CNPJ inválidos conforme regras do backend sem inventar valores; entradas parciais não devem ser persistidas.
4. Conferir CRM, usuários, compras, documentos A4/58/80mm, campo fiscal e mensageria, inclusive foco/teclado móvel.
5. Confirmar que SKU, IMEI, CSC, IDs, valores e números fiscais não foram transformados.
6. Verificar endpoints de edição delegados para backend C# e demais módulos legados em regressão ponta a ponta. Este PR não substitui uma auditoria automatizada de todos os campos de formulários mantidos pelo backend legado.

**Estado:** PR de correção visual e de normalização do cadastro; sem migration necessária nem deploy no Neon; não mesclar na master sem CI e E2E. A branch geral da integração deve receber este pacote após validação.
