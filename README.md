# Progresso Acha

SaaS de prospecção comercial, CRM e vendas com foco em identificação de oportunidades, especialmente empresas sem site.

## Estado atual

A aplicação já está conectada a um projeto Supabase e possui autenticação, persistência de CRM, agenda, resultados, receita, controle de uso por plano e proteção de sessão.

### Incluído

- Dashboard premium responsivo em Dark Mode + preferência de tema
- Login, cadastro, recuperação e redefinição de senha
- Sessão Supabase com proteção por Proxy
- Buscar Leads com filtros de segmento, UF, cidade, site e score
- Controle server-side de limite de buscas por plano
- Minha Prospecção com estágios persistentes
- WhatsApp com mensagem comercial
- Abordagens comerciais registradas na Agenda
- Controle server-side de uso de IA
- Agenda com atividades, vínculo a lead e conclusão
- Resultados do funil comercial
- Receita com histórico de vendas
- Perfil e alteração de senha
- Preferência de idioma/aparência salva no dispositivo
- RLS e políticas de propriedade no Supabase
- Índices para consultas por usuário, agenda, CRM e vendas
- Planos Gratuito, Básico, Pro e Infinity

## Configuração

Crie as variáveis de ambiente:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

A chave publishable é a preferida. A chave anon permanece como compatibilidade.

Antes do deploy, confirme as variáveis no provedor de hospedagem e valide o fluxo completo de autenticação.

## Regras comerciais

Os limites são aplicados no banco por RPCs transacionais, não somente pela interface.

| Plano | Buscas | Empresas/busca | IA/mês |
|---|---:|---:|---:|
| Gratuito | 3 total | 20 | 5 |
| Básico | 60/mês | 30 | 20 |
| Pro | 300/mês | 40 | 200 |
| Infinity | ilimitadas | 40 | 1000 |

## Próximos aprimoramentos

1. Ativar o Mercado Pago em produção após configurar credenciais, URL pública e webhook.
2. Conectar um provedor real de leads (Google Maps/API ou fonte licenciada).
3. Conectar um provedor de IA real para diagnóstico e abordagens personalizadas.
4. Evoluir analytics históricos e notificações.
5. Fazer QA contínuo dos fluxos comerciais com as configurações de produção.

As integrações externas não devem usar chaves secretas no cliente. Segredos de pagamento, IA e provedores de leads devem ficar no servidor/Edge Functions.

## Checklist de deploy

- Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no ambiente de produção.
- Mantenha `NEXT_PUBLIC_SUPABASE_ANON_KEY` apenas como compatibilidade quando necessário.
- Execute `npm run typecheck` antes do deploy.
- Execute `npm run build` e valide o fluxo Login → Dashboard → CRM → Logout.
- Configure as URLs de redirecionamento e recuperação de senha no Supabase Auth.
- Nunca coloque chaves secretas de pagamento, IA ou provedores de leads em variáveis `NEXT_PUBLIC_*`.
- Só habilite a gateway depois que o provedor e os webhooks reais estiverem configurados.

