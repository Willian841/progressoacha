# Progresso Acha

SaaS de prospecção comercial, CRM e vendas com foco em identificação de oportunidades, especialmente empresas sem site.

## Estado atual

A primeira fundação visual e de navegação já está publicada na branch main.

### Incluído
- Dashboard premium em Dark Mode
- Sidebar responsiva
- Buscar Leads com busca local, métricas e status de site
- Minha Prospecção com estágios de funil
- Planos Gratuito, Básico, Pro e Infinity
- Feedback visual para ações
- Design responsivo
- Login, cadastro, recuperação e redefinição de senha preparados para Supabase
- Logout conectado ao Supabase
- Base de componentes preparada para integração com dados persistentes

### Próximas camadas
1. Conectar um projeto Supabase e configurar variáveis de ambiente
2. Aplicar `supabase/schema.sql` no projeto Supabase
3. API de leads e filtros avançados
4. Persistência do CRM e agenda
5. IA para abordagens
6. WhatsApp
7. Pagamentos Pix/cartão e webhooks
8. Receita, resultados e diagnóstico comercial
9. Integração com provedores externos

## Regras comerciais

Os limites dos planos devem ser aplicados no servidor, nunca somente na interface.

| Plano | Buscas | Empresas/busca | IA/mês |
|---|---:|---:|---:|
| Gratuito | 3 total | 20 | 5 |
| Básico | 60/mês | 30 | 20 |
| Pro | 300/mês | 40 | 200 |
| Infinity | ilimitadas | 40 | 1000 |
