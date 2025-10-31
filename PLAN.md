# Plano: Interface Telegram para Jules usando Grammy e Cloudflare Workers

## 1. Configuração Inicial do Projeto
- Criar novo projeto Cloudflare Worker usando wrangler CLI
- Instalar Grammy framework como dependência
- Configurar estrutura básica do projeto com TypeScript
- Configurar wrangler.toml para ambientes de desenvolvimento e produção
- Definir interface Env com bindings necessários (KV, variáveis de ambiente)

**Documentação:**
- https://grammy.dev
- https://grammy.dev/hosting/cloudflare-workers-nodejs
- https://developers.cloudflare.com/workers/wrangler/environments/

## 2. Configuração do Bot no Worker
- Criar instância do bot Grammy usando token de variável de ambiente BOT_TOKEN
- Implementar webhookCallback para receber atualizações do Telegram via webhook
- Configurar handler básico de fetch do Worker
- Implementar handler scheduled para cron triggers (sincronização e polling)
- Otimizar com botInfo pré-configurado para evitar chamadas desnecessárias ao getMe

**Documentação:**
- https://grammy.dev/hosting/cloudflare-workers-nodejs
- https://grammy.dev/ref/core/webhookcallback
- https://developers.cloudflare.com/workers/configuration/cron-triggers/

## 3. Configuração do KV Namespace para Multi-Tenant
- Criar KV namespace via wrangler ou dashboard
- Configurar binding do KV no wrangler.toml
- Estrutura de chaves com isolamento por grupo:
  - `group:{group_id}:jules_token`
  - `group:{group_id}:topic:{topic_id}:session`
  - `group:{group_id}:source`
  - `group:{group_id}:automation_mode`
  - `group:{group_id}:require_approval`
  - `group:{group_id}:default_branch`
  - `group:{group_id}:sessions_index`
  - `group:{group_id}:topic:{topic_id}:last_activity_id`
  - `group:{group_id}:topic:{topic_id}:pending_plan`
  - `group:{group_id}:topic:{topic_id}:ready_for_review`
- Implementar helpers para leitura/escrita no KV com group_id como prefixo

**Documentação:**
- https://developers.cloudflare.com/kv/

## 4. Sistema de Autenticação e Controle Admin por Grupo
- Implementar comando /set_jules_token (verifica admin com getChatAdministrators)
- Armazenar token no KV com chave `group:{group_id}:jules_token`
- Validar token via GET /v1alpha/sessions antes de armazenar
- Comando /status para verificar configuração do grupo
- Garantir isolamento total entre grupos

**Documentação:**
- https://developers.google.com/jules/api
- https://core.telegram.org/bots/api

## 5. Sistema de Gerenciamento 1:1 Tópico-Session
- Detectar message_thread_id para identificar tópicos
- Mapeamento 1:1: cada tópico = 1 session do Jules
- Armazenar session completa no KV com status e outputs
- Atualizar título do tópico: "user/repo session_id" usando editForumTopicName
- Verificar permissão "Manage Topics" do bot

**Documentação:**
- https://core.telegram.org/bots/api
- https://developers.google.com/jules/api/reference/rest

## 6. Integração com Jules API - Sources por Grupo
- Comando /list_sources usando GET /v1alpha/sources
- Cada grupo vê apenas seus próprios sources
- Comando /set_source para definir source padrão
- Comando /get_source para ver source configurado
- Armazenar: `group:{group_id}:source`

**Documentação:**
- https://developers.google.com/jules/api/reference/rest/v1alpha/sources

## 7. Integração com Jules API - Criação de Sessions
- POST /v1alpha/sessions com {prompt, source, automationMode, requirePlanApproval, startingBranch}
- Extrair session_id e armazenar no KV
- Atualizar título do tópico automaticamente
- Adicionar ao sessions_index
- Iniciar polling de activities

**Documentação:**
- https://developers.google.com/jules/api

## 8. Indicador de Status "Digitando..."
- Função showTypingIndicator usando sendChatAction "typing"
- Loop repetindo a cada 4-5s (ação dura apenas 5s)
- Usar entre enviar prompt e receber activity
- Parar quando nova activity chega

**Documentação:**
- https://core.telegram.org/bots/api
- https://grammy.dev/ref/core/api

## 9. Sistema Inteligente de Notificações
**COM SOM (disable_notification=false):**
- planGenerated (ATENÇÃO MÁXIMA - ver seção 11)
- sessionCompleted
- "Ready for review"
- progressUpdated com exitCode !== 0
- progressUpdated com artifacts.media
- Primeira activity
- Mensagens com perguntas

**SILENCIOSO (disable_notification=true):**
- progressUpdated normal
- bashOutput com exitCode === 0
- changeSet intermediário
- planApproved
- Mensagens informativas

**Documentação:**
- https://core.telegram.org/bots/api

## 10. Polling de Activities via Cron Trigger (AUTOMÁTICO)
- Cron a cada 1-2 minutos
- Para cada session ativa de cada grupo:
  - GET /v1alpha/sessions/{session_id}/activities
  - Filtrar activities novas (createTime > last_activity_id)
  - **Processar e ENVIAR AUTOMATICAMENTE cada activity para o tópico correto**
  - Atualizar last_activity_id no KV
  - Buscar session atualizada para pegar outputs (PRs, branches)
- Implementar rate limiting
- **O usuário não precisa fazer nada, as activities chegam automaticamente!**

**Documentação:**
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.google.com/jules/api/reference/rest/v1alpha/sessions.activities/list

## 11. Processamento de Activities por Tipo com Atenção Especial
**planGenerated (MÁXIMA ATENÇÃO - IMPOSSÍVEL DE IGNORAR):**
- **Emoji chamativo: 🎯**
- **Título em NEGRITO: "🎯 PLANO CRIADO"**
- Se requirePlanApproval=true: adicionar **"- APROVAÇÃO NECESSÁRIA"** em negrito
- Listar steps usando **blockquote expandível**:
  - Título visível: "🎯 **PLANO CRIADO** - X steps"
  - Expandível: `<blockquote expandable>` com lista completa de steps numerados
- Botão inline destacado: "✅ Aprovar Plano" se requirePlanApproval=true
- Se requirePlanApproval=false: informar "Plano será aprovado automaticamente"
- **COM NOTIFICAÇÃO SONORA OBRIGATÓRIA**
- Usar parse_mode: "HTML" para formatar

**planApproved:**
- Mensagem breve: "✅ Plano aprovado! Jules começará a trabalhar."
- SILENCIOSO

**"Ready for review 🎉":**
- Detectar "Ready for review" em title/description
- Formatar: "🎉 **Ready for review!**\n\nJules finalizou as mudanças."
- Buscar session atualizada para outputs
- Botões inline: "📦 Publish branch" e "🔀 Publish PR"
- Armazenar flag ready_for_review no KV
- COM NOTIFICAÇÃO SONORA

**progressUpdated:**
- Se bashOutput longo: usar blockquote expandível
  - Título: "🔧 Comando executado: `comando`"
  - Expandível: `<blockquote expandable>` com output completo
- Se changeSet grande: usar blockquote expandível
  - Título: "📁 Arquivos modificados (X arquivos)"
  - Expandível: lista completa de arquivos
- Se artifacts.media: baixar e enviar como foto
- exitCode !== 0: emoji ⚠️ + COM NOTIFICAÇÃO
- exitCode === 0: emoji 🔧 + SILENCIOSO

**sessionCompleted:**
- Emoji ✅ + título: "**Session concluída!**"
- Buscar outputs finais
- Extrair e mostrar links do GitHub (PR, branch, commits) com emojis
- Links clicáveis em Markdown: `[Ver Pull Request #123](URL)`
- Se muitos detalhes: usar blockquote expandível
- COM NOTIFICAÇÃO SONORA

**Outras activities:**
- Se longas: usar blockquote expandível
- Decidir notificação baseado em conteúdo

**Documentação:**
- https://developers.google.com/jules/api/reference/rest/v1alpha/sessions.activities
- https://core.telegram.org/bots/api

## 12. Handlers para Botões de Publicação
**callback_query "publish_branch:{session_id}":**
- Validar grupo
- Chamar API Jules para publicar branch
- Atualizar mensagem (remover botão "Publish branch")
- Mostrar link do branch: "✅ Branch publicado! 🌿 [Ver no GitHub](URL)"

**callback_query "publish_pr:{session_id}":**
- Validar grupo
- Chamar API Jules para criar PR
- Atualizar mensagem (remover botões)
- Mostrar link do PR: "✅ Pull Request criado! 🔀 [Ver no GitHub](URL)"

**Documentação:**
- https://grammy.dev/plugins/keyboard

## 13. Suporte para Receber Imagens do Usuário
- Handler bot.on("message:photo")
- Extrair foto de maior resolução: `ctx.message.photo[ctx.message.photo.length - 1]`
- Usar ctx.getFile() para obter file_path
- Baixar: `https://api.telegram.org/file/bot<TOKEN>/<file_path>`
- Converter para base64
- Extrair caption (ou usar "Analisar esta imagem")
- POST sendMessage: `{prompt, media: {data: base64, mediaType: "image/jpeg"}}`
- Iniciar indicador "digitando..."

**Documentação:**
- https://grammy.dev/guide/files
- https://core.telegram.org/bots/api

## 14. Conversão de Imagem para Base64
- Função downloadAndConvertImageToBase64(file_path, bot_token)
- Fetch da imagem
- Converter para ArrayBuffer → Buffer
- Converter para base64
- Retornar base64 + mediaType
- Retry logic com backoff exponencial
- Timeout 30s

**Documentação:**
- https://grammy.dev/guide/files

## 15. Sincronização de Sessions via Cron
- Cron a cada 15-30 minutos
- GET /v1alpha/sessions para cada grupo
- Comparar com sessions_index no KV
- Detectar sessions deletadas
- Remover do KV e notificar silenciosamente
- Atualizar status e outputs

**Documentação:**
- https://developers.google.com/jules/api/reference/rest

## 16. Comando de Sincronização Manual
- /sync (apenas admin)
- Sincronizar apenas grupo atual
- GET /v1alpha/sessions
- Comparar com KV
- Se muitas sessions: usar blockquote expandível
- Relatório: "X sincronizadas, Y removidas"
- Atualizar títulos e mostrar links GitHub

**Documentação:**
- https://grammy.dev/guide/commands

## 17. Comando para Deletar Session
- /delete_session (apenas admin)
- Verificar admin
- Botão confirmação: "⚠️ Confirmar Exclusão"
- Remover do KV e sessions_index
- Notificar: "Session removida localmente. Para deletar permanentemente, acesse jules.google"

**Documentação:**
- https://grammy.dev/plugins/keyboard

## 18. Aprovação de Plano
- /approve_plan no tópico com plano pendente
- Verificar pending_plan no KV
- POST /v1alpha/sessions/{session_id}:approvePlan
- Remover pending_plan do KV
- Confirmação: "✅ Plano aprovado! Jules começará a trabalhar."
- Callback_query handler para botão inline

**Documentação:**
- https://developers.google.com/jules/api/reference/rest

## 19. Conversação Contínua (Texto e Imagens)
**Texto em tópico com session:**
- POST sendMessage com {prompt}
- Iniciar "digitando..."

**Imagem em tópico com session:**
- Baixar, converter base64
- POST sendMessage com {prompt, media}
- Iniciar "digitando..."

**Sem session:**
- Criar nova session (texto ou imagem)

**Chat geral:**
- Orientar usar tópicos

**Documentação:**
- https://developers.google.com/jules/api

## 20. Formatação de Artifacts com Blockquote Expandível
**bashOutput:**
- Se curto: code block normal
- Se longo: usar blockquote expandível
  - Título: "🔧 Comando: `comando`"
  - Expandível: `<blockquote expandable>output completo</blockquote>`
- Mostrar exitCode
- Emoji ⚠️ se erro

**changeSet:**
- Se poucos arquivos: listar normalmente
- Se muitos: usar blockquote expandível
  - Título: "📁 Arquivos modificados (X arquivos)"
  - Expandível: `<blockquote expandable>lista completa</blockquote>`
- Parsear gitPatch.unidiffPatch
- Mostrar linhas +/-

**media:**
- Decodificar base64
- sendPhoto com InputFile
- Caption com title e description

**Documentação:**
- https://core.telegram.org/bots/api#sendphoto

## 21. Extração de Links do GitHub
- Função extractGitHubLinks(session.outputs)
- Regex para PR, branch, commit URLs:
  - PR: `https://github.com/[^/]+/[^/]+/pull/\d+`
  - Branch: `https://github.com/[^/]+/[^/]+/tree/[^/\s]+`
  - Commit: `https://github.com/[^/]+/[^/]+/commit/[a-f0-9]+`
- Formatar como Markdown clicável
- Emojis: 🔀 PR, 🌿 branch, 📝 commit
- Exemplos:
  - `🔀 [Ver Pull Request #123](URL)`
  - `🌿 [Ver Branch feature-xyz](URL)`
  - `📝 [Ver Commit abc123](URL)`

**Documentação:**
- https://core.telegram.org/bots/api#formatting-options

## 22. Comando para Abrir Configurações do Jules
**Implementar /open_jules_settings:**
- Verificar se grupo tem source configurado no KV
- Se não tiver source: responder "Configure um source primeiro usando /set_source"
- Se tiver source:
  - Extrair user/repo do source (formato: "sources/github/user/repo")
  - Construir URL do Jules: `https://jules.google/github/{user}/{repo}`
  - Enviar mensagem com botão inline:
    - Texto: "⚙️ **Configurações Avançadas do Jules**\n\nPara configurar Setup Script, Environment Variables e Memories, acesse as configurações do repositório no site do Jules."
    - Botão: "🔗 Abrir Configurações" (url: link direto)
- Adicionar nota: "Essas configurações são feitas por repositório e afetam todas as sessions futuras."
- Funciona em qualquer contexto (chat geral ou tópico)

**Implementação técnica:**
- Helper function: `parseSourceToGitHubUrl(source: string): string`
  - Input: "sources/github/verseles/dartian"
  - Output: "https://jules.google/github/verseles/dartian"
- Usar InlineKeyboard do Grammy para criar botão com URL
- Parse mode: "HTML" ou "MarkdownV2" para formatação

**Documentação:**
- https://grammy.dev/plugins/keyboard
- https://core.telegram.org/bots/api#inlinekeyboardmarkup

## 23. Sistema de Comandos (com underscore)
**Básicos:**
- /start - Boas-vindas com explicação de tópicos, imagens, configuração
- /help - Lista completa com exemplos

**Configuração (admin):**
- /set_jules_token <token>
- /set_source <source_name>
- /set_branch <branch_name>
- /set_auto_pr <on|off>
- /require_approval <on|off>

**Informação:**
- /status
- /get_source
- /list_sources
- /list_sessions (usar blockquote se muitas)
- /session_info (usar blockquote para detalhes)
- /list_activities (usar blockquote expandível)
- /show_plan (usar blockquote expandível)
- /show_outputs
- **/open_jules_settings** - Abrir configurações do repositório no site do Jules

**Ação:**
- /new_session <prompt>
- /approve_plan
- /delete_session
- /sync

**Documentação:**
- https://grammy.dev/guide/commands

## 24. Handlers de Mensagens com Suporte a Imagens
- Extrair group_id
- Verificar token configurado
- Detectar tipo (texto, foto)

**Tópico + texto:**
- Se tem session: POST sendMessage
- Se não: criar nova session

**Tópico + foto:**
- Baixar, converter base64
- POST sendMessage com media
- Criar session se necessário

**Chat geral:**
- Orientar usar tópicos

**Documentação:**
- https://grammy.dev/guide/files

## 25. Camada de Isolamento Multi-Tenant
- Helper functions sempre com group_id
- getJulesToken(group_id)
- getSession(group_id, topic_id)
- getActiveSessions(group_id)
- getSource(group_id)
- parseSourceToGitHubUrl(source) - nova função
- Validar todas operações KV incluem group_id
- Logging de tentativas de acesso entre grupos
- Validar callback_query data

**Documentação:**
- https://developers.cloudflare.com/kv/

## 26. Sistema de Notificações e Feedback
- Usar lógica de notificação inteligente
- Enviar ao tópico correto com message_thread_id
- Botões inline:
  - "✅ Aprovar Plano"
  - "📦 Publish branch"
  - "🔀 Publish PR"
  - "⚠️ Deletar Session"
  - "🔄 Ver Detalhes"
  - "🔗 Abrir Configurações" (para /open_jules_settings)
  - "❌ Cancelar"
- Callback_query handlers
- Atualizar mensagens após ação (editMessageText, editMessageReplyMarkup)

**Documentação:**
- https://grammy.dev/plugins/keyboard

## 27. Tratamento de Erros e Logs
- Try-catch em todas chamadas Jules API
- Logar com group_id, session_id, activity_id, user_id
- Mensagens de erro amigáveis COM notificação
- Rate limiting por grupo
- Retry logic (3 tentativas, backoff exponencial)
- Tratar 404 (session deletada - remover do KV)
- Tratar 401/403 (token inválido - notificar admin)
- Erros de download de imagem (tamanho, formato)
- Timeout para imagens (30s)
- Erro ao parsear source: notificar e pedir /set_source novamente

**Documentação:**
- https://developers.cloudflare.com/workers/observability/logging/

## 28. Testes com Vitest
- Configurar Vitest com @cloudflare/vitest-pool-workers
- Criar vitest.config.ts usando defineWorkersConfig
- Unit tests:
  - helpers
  - formatadores
  - parsers
  - extractGitHubLinks
  - parseSourceToGitHubUrl
- Integration tests: handlers, processamento activities, blockquote formatting
- Mock tests: Jules API e Telegram API
- KV tests: operações read/write (miniflare já incluído)
- Usar wrangler dev para desenvolvimento local
- **Nota: Miniflare vem integrado no Wrangler 2.0+, não precisa instalar separadamente**

**Documentação:**
- https://developers.cloudflare.com/workers/testing/vitest-integration/
- https://developers.cloudflare.com/workers/testing/miniflare/
- https://vitest.dev

## 29. Deploy e Configuração de Produção
- Variáveis de ambiente com wrangler secret (BOT_TOKEN)
- Cron triggers no wrangler.toml:
  - `*/1 * * * *` (polling activities - a cada 1 minuto)
  - `*/15 * * * *` (sincronização sessions - a cada 15 minutos)
- wrangler deploy
- Configurar webhook Telegram: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<WORKER>.workers.dev/`
- Testar fluxo completo em múltiplos grupos:
  - Criar session (texto e imagem)
  - Receber activities automaticamente via cron
  - Aprovar plano
  - Ready for review + botões
  - Publish branch/PR + links GitHub
  - /open_jules_settings
  - Blockquote expandível em mensagens longas
  - Deletar session
- Testar isolamento, notificações, indicador "digitando..."
- Monitorar logs no dashboard

**Documentação:**
- https://developers.cloudflare.com/workers/wrangler/commands/#deploy
- https://grammy.dev/hosting/cloudflare-workers-nodejs

## 30. Otimizações
- Cache de tokens por grupo (em memória)
- Cache de sources
- Cache de URLs do Jules geradas
- Cache de imagens temporariamente
- Processar apenas sessions ativas
- Retry logic exponencial
- Considerar Durable Objects para "digitando..." contínuo (loop 5s)
- Considerar Durable Objects para polling real-time
- Workers Analytics
- Limpeza automática sessions antigas (30 dias)
- Debounce para activities repetidas
- Compressão de mensagens longas ou usar blockquote
- Streams para imagens grandes
- Pool de conexões para downloads paralelos

**Documentação:**
- https://developers.cloudflare.com/workers/runtime-apis/durable-objects/

## 31. Limitações Conhecidas da API do Jules
**Funcionalidades disponíveis APENAS na interface web:**

1. **Setup Script:**
   - Não há endpoint na API para configurar/editar setup script
   - Deve ser configurado pela interface web em Environment → Setup script
   - Afeta todas as sessions futuras do repositório

2. **Environment Variables por Source:**
   - Não há endpoint para configurar env vars no nível do repositório
   - Deve ser configurado pela interface web em Environment → Environment variables
   - Afeta todas as sessions futuras do repositório

3. **Memories/Knowledge:**
   - Não há endpoint para adicionar/gerenciar memories manualmente
   - Memories são geradas automaticamente durante sessions
   - Memories manuais devem ser adicionadas pela interface web em Knowledge → Add Memory

**Solução no bot:**
- Comando /open_jules_settings direciona usuário para interface web
- Documentar claramente no README essas limitações
- Adicionar nota nos comandos relevantes orientando usar interface web

**Documentação:**
- https://developers.google.com/jules/api
- https://jules.google (interface web)

## 32. README Completo (Inglês, AGPLv3)
**Estrutura do README.md:**
- **Title + Badges**: license (AGPLv3), build status, version
- **Description**: O que o bot faz (2-3 parágrafos)
- **Features**: Lista com emojis (multi-tenant, tópicos=sessions, imagens, links GitHub, etc)
- **Prerequisites**: Node.js 20+, Cloudflare account, Telegram Bot Token (via @BotFather), Jules API key
- **Installation**:
  - Clone repo
  - `npm install`
  - Configurar wrangler.toml
  - Criar KV namespace
- **Configuration**:
  - Environment variables (BOT_TOKEN via wrangler secret)
  - KV binding setup
  - Cron triggers configuration
- **Bot Setup** (apenas no README):
  - Como criar bot no @BotFather
  - Como obter bot token
  - Como adicionar bot em grupo
  - Como dar permissão "Manage Topics"
  - Como obter Jules API key em jules.google
- **Usage**:
  - Adicionar bot em grupo Telegram
  - Usar /set_jules_token para configurar
  - Criar tópicos para organizar sessions
  - Enviar mensagens de texto ou imagens
  - Sistema funciona automaticamente (cron envia activities)
  - Usar /open_jules_settings para configurações avançadas
- **Commands Reference**: Tabela completa com todos os comandos e descrições
- **Image Support**:
  - Como enviar imagens ao Jules
  - Formatos suportados (jpg, png, webp)
  - Limite de tamanho (20MB)
  - Exemplos de prompts com imagens
- **Advanced Configuration**:
  - Setup Script, Environment Variables e Memories devem ser configurados via interface web
  - Usar /open_jules_settings para acesso rápido
  - Link direto: https://jules.google/github/{user}/{repo}
- **Architecture**:
  - Diagrama de fluxo (Telegram → Worker → Jules API → Activities → Telegram)
  - Multi-tenant com isolamento por grupo
  - Cron para polling automático de activities
- **Development**:
  - `wrangler dev` para local development
  - `npm test` para rodar testes com Vitest
  - **Nota: Não usar Docker** (Workers usa V8 Isolates, não containers)
- **Testing**:
  - Como rodar testes: `npm test`
  - Vitest com @cloudflare/vitest-pool-workers
  - Miniflare já incluído no Wrangler 2.0+
- **Deployment**:
  - `wrangler deploy`
  - Configurar webhook do Telegram
  - Monitorar logs
- **API Limitations**:
  - Setup Script: web only
  - Environment Variables (per source): web only
  - Manual Memories: web only
  - Use /open_jules_settings to access web interface
- **Troubleshooting**:
  - Permissões necessárias (admin + "Manage Topics")
  - Token inválido/expirado
  - Session deletada no jules.google
  - Rate limiting
  - Imagens muito grandes
  - Formatos não suportados
  - Source não configurado (necessário para /open_jules_settings)
- **Contributing**:
  - Code style: TypeScript, código em inglês, comentários explicativos
  - PR process
  - Testes obrigatórios
- **License**: AGPLv3 com link para LICENSE file
- **Credits**: Grammy, Jules API, Cloudflare Workers, TypeScript

**Documentação:**
- https://grammy.dev
- https://developers.cloudflare.com/workers/
- https://jules.google

---

## Regras básicas de trabalho:
- Sempre que ficar preso em um erro, busque na internet pela solução, somente depois de esgotado as possibilidades, chame o usuário.
- Sempre busque um contexto mais profundo dentro do código atual para entender erros, ou antes de chamar o usuário.
- Com frequência, repita para você mesmo o pedido original, o que foi feito, o que falta fazer e suas diretrizes de proteção contra alucinação.
- Mesmo para o plano inicial, faça uma varredura nos arquivos para entender melhor todo o contexto antes de fazer perguntas a fim de evitar perguntas vazias ou fora do contexto.
- **O código, variáveis e comentários devem ser totalmente em inglês.**
- **O código deve ter comentários sobre motivos de decisões importantes, por todo o código e sempre atualizados.**
- **Comentários de código devem sempre ser atualizados para refletir a realidade mais recente.**
- **Ter comentários no código é crucial para manter o código extremamente claro.**
