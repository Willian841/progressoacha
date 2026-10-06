"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-browser";
import {
  ArrowUpRight, BarChart3, CalendarDays, Check, ChevronRight, CircleDollarSign,
  Globe2, LayoutDashboard, Menu, MessageCircle, Search, Settings, Sparkles,
  Target, TrendingUp, Users, X, Zap, LogOut, Save, LockKeyhole
} from "lucide-react";

function whatsappUrl(phone:string, message:string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function commercialMessage(name:string) {
  return `Olá! Tudo bem? Aqui é da Progresso Acha. Encontrei a ${name} e queria apresentar uma oportunidade para ajudar sua empresa a gerar mais clientes pela internet. Podemos conversar?`;
}

const stages = ["Tudo","Selecionado","Contatado","Respondeu","Reunião","Proposta","Venda","Descartado"];
const stageToDb: Record<string,string> = { Selecionado:"selected", Contatado:"contacted", Respondeu:"replied", "Reunião":"meeting", Proposta:"proposal", Venda:"sale", Descartado:"discarded" };
const dbToStage: Record<string,string> = Object.fromEntries(Object.entries(stageToDb).map(([ui,db]) => [db,ui]));
type LeadRow = { id:string; name:string; segment:string; location:string; country:string; state:string; city:string; area:string; hasSite:boolean; score:number; phone:string; address?:string; latitude?:number|null; longitude?:number|null };

export default function Home() {
  const [active,setActive] = useState("Dashboard");
  const [mobile,setMobile] = useState(false);
  const [query,setQuery] = useState("");
  const [toast,setToast] = useState("");
  const [stage,setStage] = useState("Tudo");
  const [authReady,setAuthReady] = useState(false);
  const [userName,setUserName] = useState("Willian");
  const [userEmail,setUserEmail] = useState("");
  const [dbLeads,setDbLeads] = useState<LeadRow[]>([]);
  const [planCode,setPlanCode] = useState("free");
  const [searchUsage,setSearchUsage] = useState<{used:number;limit:number|null}>({used:0,limit:3});
  const [aiUsage,setAiUsage] = useState<{used:number;limit:number|null}>({used:0,limit:5});
  const [pipeline,setPipeline] = useState<Record<string,string>>({});
  const [revenue,setRevenue] = useState(0);
  const [theme,setTheme] = useState<"dark"|"light">("dark");
  const [language,setLanguage] = useState("pt-BR");
  const [isAdmin,setIsAdmin] = useState(false);
  const notify = (message:string) => { setToast(message); window.setTimeout(() => setToast(""),2600); };
  useEffect(() => {
    const savedTheme = window.localStorage.getItem("progressoacha-theme");
    const savedLanguage = window.localStorage.getItem("progressoacha-language");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
    if (savedLanguage) setLanguage(savedLanguage);
    let mounted = true;
    (async () => {
      try {
        const supabase = createClient() as any;
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!data.user) { setAuthReady(true); return; }
        setUserName(data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Usuário");
        setUserEmail(data.user.email || "");
        const { data: profile } = await supabase.from("profiles").select("plan_code").eq("id", data.user.id).maybeSingle();
        const { data: adminRows } = await (supabase as any).rpc("is_admin");
        // A role administrativo deve ser a fonte de verdade; não dependa de e-mail hardcoded.
        setIsAdmin(adminRows === true);
        const currentPlan = profile?.plan_code || "free";
        setPlanCode(currentPlan);
        const { data: limits } = await supabase.rpc("plan_limits", { p_plan: currentPlan });
        const limitRow = limits?.[0];
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
        const { data: usageRow } = await supabase.from("usage_monthly").select("search_count,ai_count").eq("user_id", data.user.id).eq("month_start", monthStart.toISOString().slice(0,10)).maybeSingle();
        setSearchUsage({used: usageRow?.search_count || 0, limit: limitRow?.search_limit ?? null});
        setAiUsage({used: usageRow?.ai_count || 0, limit: limitRow?.ai_limit ?? null});
        const { data:pipelineRows } = await supabase.from("pipeline_items").select("lead_id,stage");
        const saved:Record<string,string> = {};
        pipelineRows?.forEach((row:any) => { saved[row.lead_id] = dbToStage[row.stage] || "Selecionado"; });
        setPipeline(saved);

        const baseLeadQuery = "id,name,segment,country,state,city,area,address,website_status,opportunity_score,phone,latitude,longitude";
        const { data:topLeadRows } = await supabase.from("leads").select(baseLeadQuery).order("opportunity_score",{ascending:false}).limit(50);
        let leadRows:any[] = topLeadRows || [];
        const pipelineLeadIds = Object.keys(saved);
        const missingPipelineIds = pipelineLeadIds.filter(id => !leadRows.some(row => row.id === id));
        if (missingPipelineIds.length) {
          const { data:pipelineLeadRows } = await supabase.from("leads").select(baseLeadQuery).in("id",missingPipelineIds);
          leadRows = [...leadRows,...(pipelineLeadRows || [])];
        }
        setDbLeads(leadRows.map((r:any) => ({id:r.id,name:r.name,segment:r.segment || "Outros",location:[r.city,r.state].filter(Boolean).join(", "),country:r.country || "Brasil",state:r.state || "",city:r.city || "",area:r.area || "",hasSite:r.website_status === "found",score:r.opportunity_score,phone:r.phone || "",address:r.address || "",latitude:r.latitude ?? null,longitude:r.longitude ?? null})));
        const { data:salesRows } = await supabase.from("sales").select("amount").eq("status","won");
        setRevenue((salesRows || []).reduce((total:number,row:any) => total + Number(row.amount || 0), 0));
      } catch (error) { console.error(error); }
      finally { if (mounted) setAuthReady(true); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") !== "return") return;
    const plan = params.get("plan");
    const label = plan === "infinity" ? "Infinity" : plan === "pro" ? "Pro" : plan === "basic" ? "Básico" : "seu plano";
    notify(`Retorno do Mercado Pago recebido. Aguardando confirmação da assinatura ${label}.`);
    window.history.replaceState({}, document.title, window.location.pathname);
    setActive("Planos");
  }, [authReady]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("progressoacha-theme", theme);
  }, [theme]);
  useEffect(() => {
    window.localStorage.setItem("progressoacha-language", language);
  }, [language]);

  const logout = async () => {
    try { await createClient().auth.signOut(); } finally { window.location.href = "/login"; }
  };
  const nav = [
    ["Visão Geral",[["Dashboard",LayoutDashboard],["Agenda",CalendarDays]]],
    ["Prospecção",[["Buscar Leads",Search],["Minha Prospecção",Target],["Resultados",BarChart3]]],
    ["Financeiro",[["Receita",CircleDollarSign],["Planos",Zap]]],
    ["Sistema",[["Configurações",Settings], ...(isAdmin ? [["Admin",LockKeyhole] as const] : [])]]
  ] as const;

  if (!authReady) return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div></div><div className="auth-copy"><div className="eyebrow"><span className="pulse"/> CARREGANDO OPERAÇÃO</div><h1>Preparando seu workspace.</h1><p>Conectando seus dados com segurança.</p></div></section></main>;
  if (!userEmail) return <LandingPage/>;

  return <div className="shell">
    <aside className={mobile ? "sidebar open" : "sidebar"}>
      <div className="brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div><button className="close" onClick={()=>setMobile(false)}><X/></button></div>
      <div className="workspace"><small>WORKSPACE</small><button>Meu negócio <ChevronRight size={14}/></button></div>
      <nav>{nav.map(([group,items])=><div className="navgroup" key={group}><label>{group}</label>{items.map(([label,Icon])=><button key={label} className={active===label?"nav active":"nav"} onClick={()=>{setActive(label);setMobile(false)}}><Icon size={17}/><span>{label}</span>{label==="Buscar Leads"&&<em>{dbLeads.filter(l=>!l.hasSite).length}</em>}</button>)}</div>)}</nav>
      <div className="sidebottom"><div className="mini-plan"><small>PLANO ATUAL</small><b>{planCode === "infinity" ? "Infinity" : planCode === "basic" ? "Básico" : planCode === "pro" ? "Pro" : "Gratuito"}</b><button onClick={()=>setActive("Planos")}>Upgrade <ArrowUpRight size={12}/></button></div><button className="nav"><Settings size={17}/><span>Preferências</span></button><button className="nav danger" onClick={logout}><LogOut size={17}/><span>Sair</span></button></div>
    </aside>

    <main className="main">
      <header><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">Workspace <ChevronRight size={13}/> <b>{active}</b></div><div className="actions"><button><Globe2 size={17}/></button><button className="notify"><MessageCircle size={17}/><i/></button><div className="avatar">{userName.slice(0,2).toUpperCase()}</div></div></header>
      <div className="content">
        {active==="Dashboard" && <Dashboard userName={userName} leads={dbLeads} pipeline={pipeline} revenue={revenue} onSearch={()=>setActive("Buscar Leads")} onPipeline={()=>setActive("Minha Prospecção")} onAgenda={()=>setActive("Agenda")} notify={notify}/>}
        {active==="Buscar Leads" && <Leads leads={dbLeads} setLeads={setDbLeads} query={query} setQuery={setQuery} notify={notify} searchUsage={searchUsage} setSearchUsage={setSearchUsage} planCode={planCode} setPipeline={setPipeline} />}
        {active==="Minha Prospecção" && <Pipeline stage={stage} setStage={setStage} pipeline={pipeline} setPipeline={setPipeline} leads={dbLeads} notify={notify}/>}
        {active==="Planos" && <Plans notify={notify} currentPlan={planCode}/>}
        {active==="Agenda" && <Agenda leads={dbLeads} notify={notify}/>}
        {active==="Resultados" && <Results leads={dbLeads} pipeline={pipeline}/>}
        {active==="Receita" && <Revenue leads={dbLeads} revenue={revenue} notify={notify}/>}        {active==="Configurações" && <SettingsPage userName={userName} setUserName={setUserName} userEmail={userEmail} planCode={planCode} theme={theme} setTheme={setTheme} language={language} setLanguage={setLanguage} notify={notify}/>}
        {active==="Admin" && isAdmin && <AdminPage notify={notify}/>}  
      </div>
    </main>
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function LandingPage() {
  const go = (path:string) => { window.location.href = path; };
  return <main className="landing-page">
    <div className="landing-glow landing-glow-one"/><div className="landing-glow landing-glow-two"/>
    <header className="landing-header">
      <button className="landing-brand" onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}>
        <span className="landing-logo"><Sparkles size={18}/></span><span><b>PROGRESSO</b> <em>ACHA</em></span>
      </button>
      <nav className="landing-nav"><a href="#inicio">Início</a><a href="#como-funciona">Como funciona</a><a href="#recursos">O que você encontra</a><a href="#planos">Planos</a><a href="#faq">FAQ</a></nav>
      <div className="landing-actions"><button className="landing-login" onClick={()=>go("/login")}>Entrar</button><button className="landing-cta" onClick={()=>go("/cadastro")}>Começar grátis <ArrowUpRight size={15}/></button></div>
      <details className="landing-mobile-nav"><summary><Menu size={18}/></summary><div><a onClick={e=>{(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}} href="#inicio">Início</a><a onClick={e=>{(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}} href="#como-funciona">Como funciona</a><a onClick={e=>{(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}} href="#recursos">Recursos</a><a onClick={e=>{(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}} href="#planos">Planos</a><a onClick={e=>{(e.currentTarget.closest("details") as HTMLDetailsElement).open=false}} href="#faq">FAQ</a><button onClick={()=>go("/login")}>Entrar</button><button onClick={()=>go("/cadastro")}>Começar grátis <ArrowUpRight size={13}/></button></div></details>
    </header>

    <section id="inicio" className="landing-hero">
      <div className="landing-copy">
        <span className="landing-badge"><Target size={14}/> PLATAFORMA DE PROSPECÇÃO</span>
        <div className="landing-kicker">PROGRESSO <b>ACHA</b></div>
        <h1>Encontre clientes.<br/>Saiba o que falar.<br/><span>Venda mais.</span></h1>
        <p>Encontre empresas, organize sua prospecção e transforme oportunidades em conversas comerciais — tudo em um só lugar.</p>
        <div className="landing-buttons"><button className="landing-primary" onClick={()=>go("/cadastro")}>Começar agora <ArrowUpRight size={17}/></button><a className="landing-secondary" href="#como-funciona">Ver como funciona <ChevronRight size={16}/></a></div>
        <div className="landing-benefits"><div><Target size={19}/><span>Prospecção<br/><b>inteligente</b></span></div><div><BarChart3 size={19}/><span>Pipeline<br/><b>organizado</b></span></div><div><Zap size={19}/><span>Mais clientes,<br/><b>mais vendas</b></span></div></div>
      </div>

      <div className="landing-product-wrap">
        <div className="landing-orbit landing-orbit-a"/><div className="landing-orbit landing-orbit-b"/>
        <div className="landing-product-label"><span className="pulse"/> INTERFACE REAL DO PROGRESSO ACHA</div>
        <div className="product-window product-window-real">
          <div className="window-top"><span className="window-dot dot-red"/><span className="window-dot dot-yellow"/><span className="window-dot dot-green"/><span className="window-url">PROGRESSO ACHA · Dashboard</span></div>
          <div className="product-body">
            <aside className="product-sidebar">
              <div className="product-brand"><span><Sparkles size={13}/></span><b>Progresso <em>ACHA</em></b></div>
              <div className="product-workspace"><small>WORKSPACE</small><b>Meu negócio <ChevronRight size={10}/></b></div>
              <div className="product-nav">
                <label>VISÃO GERAL</label><i className="active"><LayoutDashboard size={11}/> <b>Dashboard</b></i><i><CalendarDays size={11}/> <b>Agenda</b></i>
                <label>PROSPECÇÃO</label><i><Search size={11}/> <b>Buscar Leads</b><em>10</em></i><i><Target size={11}/> <b>Minha Prospecção</b></i><i><BarChart3 size={11}/> <b>Resultados</b></i>
                <label>FINANCEIRO</label><i><CircleDollarSign size={11}/> <b>Receita</b></i><i><Zap size={11}/> <b>Planos</b></i>
              </div>
            </aside>
            <div className="product-main">
              <div className="product-heading"><div><small>VISÃO GERAL</small><h3>Olá, Willian!</h3><p>Aqui está um resumo do seu progresso hoje.</p></div><span className="product-avatar">WI</span></div>
              <div className="product-stats">
                <div><Search size={14}/><b>10</b><span>Leads encontrados</span><small>+12% este mês</small></div>
                <div><Target size={14}/><b>3</b><span>Leads em prospecção</span><small>Em andamento</small></div>
                <div><CalendarDays size={14}/><b>2</b><span>Follow-ups</span><small>Próximos</small></div>
                <div><TrendingUp size={14}/><b>R$ 4.850</b><span>Receita gerada</span><small>+18% este mês</small></div>
              </div>
              <div className="product-dashboard-grid">
                <div className="product-panel"><div className="product-panel-head"><b>Próximos follow-ups</b><span>Ver agenda</span></div>
                  <div className="product-task"><span className="task-time">09:30</span><div><b>Retornar contato</b><small>Clínica Sorriso Vivo</small></div><strong>Hoje</strong></div>
                  <div className="product-task"><span className="task-time">14:00</span><div><b>Enviar proposta</b><small>Odonto Center Paulista</small></div><strong>Amanhã</strong></div>
                  <div className="product-task"><span className="task-time">16:30</span><div><b>Fazer primeiro contato</b><small>Dental Prime SP</small></div><strong>Quinta</strong></div>
                </div>
                <div className="product-panel"><div className="product-panel-head"><b>Leads quentes</b><span>Minha prospecção</span></div>
                  <div className="product-hot"><span className="hot-avatar">CS</span><div><b>Clínica Sorriso Vivo</b><small>Reunião · Score 92</small></div><strong>92</strong></div>
                  <div className="product-hot"><span className="hot-avatar">OP</span><div><b>Odonto Center</b><small>Proposta · Score 87</small></div><strong>87</strong></div>
                  <div className="product-hot"><span className="hot-avatar">DP</span><div><b>Dental Prime</b><small>Respondeu · Score 81</small></div><strong>81</strong></div>
                </div>
              </div>
              <div className="product-next"><Sparkles size={14}/><div><b>Seu próximo passo</b><span>Você tem leads quentes esperando uma ação.</span></div><button>Ver prospecção <ArrowUpRight size={11}/></button></div>
              <div className="product-bottom"><div><span className="product-bottom-icon"><Target size={10}/></span><div><b>Prospecção ativa</b><small>3 oportunidades em andamento</small></div></div><div><span className="product-bottom-icon"><CalendarDays size={10}/></span><div><b>Agenda em dia</b><small>2 follow-ups próximos</small></div></div><div><span className="product-bottom-icon"><CircleDollarSign size={10}/></span><div><b>Receita</b><small>R$ 4.850 gerados</small></div></div></div>
            </div>
          </div>
        </div>
        <div className="product-caption"><span><i/> Mesmo Dashboard</span><span><i/> Mesmo CRM</span><span><i/> Mesmos recursos</span></div>
      </div>
    </section>

    <section id="como-funciona" className="landing-strip"><div><span>01</span><b>Encontre</b><p>Pesquise empresas por cidade, segmento e oportunidade.</p></div><div><span>02</span><b>Organize</b><p>Salve os melhores leads e acompanhe cada etapa no CRM.</p></div><div><span>03</span><b>Converta</b><p>Tenha contexto para abordar melhor e acelerar suas vendas.</p></div></section>
    <section id="recursos" className="landing-lower"><span className="landing-badge">FEITO PARA VENDER</span><h2>Da primeira busca ao próximo cliente.</h2><p>O PROGRESSO ACHA foi pensado para tirar a prospecção do improviso e colocar sua operação em movimento.</p><div className="landing-feature-grid"><article><Search size={21}/><b>Encontre oportunidades</b><span>Descubra empresas e filtre o que realmente faz sentido para seu negócio.</span></article><article><Target size={21}/><b>Tenha um CRM simples</b><span>Organize contatos, estágios e próximos passos sem perder o timing.</span></article><article><Sparkles size={21}/><b>Aborde com inteligência</b><span>Use o contexto do lead para criar conversas comerciais mais relevantes.</span></article></div></section>
    <section id="planos" className="landing-plans"><span className="landing-badge">COMECE SEM COMPLICAÇÃO</span><h2>Escolha o ritmo da sua prospecção.</h2><p>Comece grátis e evolua conforme sua operação comercial cresce.</p><div className="landing-plan-grid"><article><small>PARA COMEÇAR</small><h3>Grátis</h3><strong>R$ 0</strong><span>para começar a prospectar</span><ul><li><Check size={12}/> 3 buscas por mês</li><li><Check size={12}/> Até 20 empresas por busca</li><li><Check size={12}/> CRM, agenda e follow-ups</li></ul><button onClick={()=>go("/cadastro")}>Começar grátis <ArrowUpRight size={14}/></button></article><article><small>PARA PROFISSIONAIS</small><h3>Básico</h3><strong>R$ 24,90 <small>/mês</small></strong><span>para uma rotina comercial consistente</span><ul><li><Check size={12}/> Até 60 buscas por mês</li><li><Check size={12}/> Até 30 empresas por busca</li><li><Check size={12}/> Até 20 abordagens com IA</li></ul><button onClick={()=>go("/cadastro")}>Começar com Básico <ArrowUpRight size={14}/></button></article><article className="landing-plan-featured"><div className="plan-popular">MAIS ESCOLHIDO</div><small>PARA VENDER MAIS</small><h3>Pro</h3><strong>R$ 49,90 <small>/mês</small></strong><span>para acelerar sua operação</span><ul><li><Check size={12}/> Até 300 buscas por mês</li><li><Check size={12}/> Até 40 empresas por busca</li><li><Check size={12}/> Até 200 abordagens com IA</li></ul><button onClick={()=>go("/cadastro")}>Começar com Pro <ArrowUpRight size={14}/></button></article><article><small>PARA ESCALAR</small><h3>Infinity</h3><strong>R$ 59,90 <small>/mês</small></strong><span>para operações de alto volume</span><ul><li><Check size={12}/> Buscas ilimitadas</li><li><Check size={12}/> Até 40 empresas por busca</li><li><Check size={12}/> Até 1.000 abordagens com IA</li></ul><button onClick={()=>go("/cadastro")}>Conhecer Infinity <ArrowUpRight size={14}/></button></article></div></section>
    <section className="landing-final-cta"><div className="final-cta-glow"/><span className="landing-badge">PRONTO PARA AVANÇAR?</span><h2>Chega de prospectar no escuro.</h2><p>Encontre empresas, organize seus leads e transforme sua prospecção em uma rotina comercial de verdade.</p><button onClick={()=>go("/cadastro")}>Começar grátis agora <ArrowUpRight size={16}/></button><small>Sem complicação. Comece pelo navegador.</small></section>
    <section id="faq" className="landing-faq"><span className="landing-badge">DÚVIDAS</span><h2>Perguntas frequentes.</h2><div className="faq-grid"><details open><summary>Preciso instalar alguma coisa?</summary><p>Não. O PROGRESSO ACHA funciona direto no navegador e você pode começar pelo cadastro.</p></details><details><summary>O sistema ajuda a organizar meus leads?</summary><p>Sim. Você pode encontrar empresas, acompanhar a prospecção, definir próximos passos e visualizar sua operação no CRM.</p></details><details><summary>Posso começar gratuitamente?</summary><p>Sim. O cadastro inicial é gratuito para você conhecer a plataforma e começar sua prospecção.</p></details><details><summary>O PROGRESSO ACHA é só uma lista de empresas?</summary><p>Não. A proposta é levar você da descoberta do lead até o acompanhamento comercial e a conversão.</p></details></div></section>
    <footer className="landing-footer"><div><b><span>✦</span> PROGRESSO ACHA</b><p>Prospecção mais organizada. Mais oportunidades. Mais progresso.</p></div><div className="landing-footer-links"><a href="#inicio">Início</a><a href="#recursos">Recursos</a><a href="#planos">Planos</a><a href="#faq">FAQ</a><button onClick={()=>go("/login")}>Entrar</button></div><small>© 2026 PROGRESSO ACHA. Todos os direitos reservados.</small></footer>
  </main>;
}

function Header({eyebrow,title,text,action}:{eyebrow:string,title:string,text:string,action?:React.ReactNode}) {
  return <div className="heading"><div><div className="eyebrow"><span className="pulse"/> {eyebrow}</div><h1>{title}</h1><p>{text}</p></div>{action}</div>
}

function Dashboard({userName,leads,pipeline,revenue,onSearch,onPipeline,onAgenda,notify}:{userName:string,leads:LeadRow[],pipeline:Record<string,string>,revenue:number,onSearch:()=>void,onPipeline:()=>void,onAgenda:()=>void,notify:(s:string)=>void}) {
  const [pendingFollowUps,setPendingFollowUps]=useState<{id:string;content:string;scheduled_at:string|null;lead_id:string|null}[]>([]);
  const [overdueFollowUps,setOverdueFollowUps]=useState(0);
  const [pendingFollowUpCount,setPendingFollowUpCount]=useState(0);
  useEffect(()=>{
    const loadFollowUps=async()=>{
      const supabase=createClient() as any;
      const [{data},{count:pendingCount},{count:overdueCount}] = await Promise.all([
        supabase.from("activities").select("id,content,scheduled_at,lead_id").eq("type","task").is("completed_at",null).not("scheduled_at","is",null).order("scheduled_at",{ascending:true,nullsFirst:false}).limit(8),
        supabase.from("activities").select("id",{count:"exact",head:true}).eq("type","task").is("completed_at",null).not("scheduled_at","is",null),
        supabase.from("activities").select("id",{count:"exact",head:true}).eq("type","task").is("completed_at",null).not("scheduled_at","is",null).lt("scheduled_at",new Date().toISOString())
      ]);
      setPendingFollowUps(data||[]);
      setPendingFollowUpCount(pendingCount||0);
      setOverdueFollowUps(overdueCount||0);
    };
    loadFollowUps();
  },[]);
  const hotLeads=leads.filter(l=>pipeline[l.id] && ["Respondeu","Reunião","Proposta"].includes(pipeline[l.id])).sort((a,b)=>b.score-a.score).slice(0,3);
  const wonCount=Object.values(pipeline).filter(s=>s==="Venda").length;
  const proposalCount=Object.values(pipeline).filter(s=>s==="Proposta").length;
  const conversionRate=Object.keys(pipeline).length?Math.round(wonCount/Object.keys(pipeline).length*100):0;
  const hour=new Date().getHours();
  const greeting=hour<12?"Bom dia":hour<18?"Boa tarde":"Boa noite";
  return <><Header eyebrow="VISÃO GERAL" title={`${greeting}, ${userName} ✦`} text="Transforme oportunidades em conversas e conversas em vendas." action={<button className="primary" onClick={onSearch}><Search size={16}/> Buscar novos leads</button>}/>
    <div className="stats">
    <Stat icon={Users} label="Leads encontrados" value={leads.length.toLocaleString("pt-BR")} note="Carregados nesta sessão"/>
    <Stat icon={Target} label="Em prospecção" value={Object.keys(pipeline).length.toLocaleString("pt-BR")} note="Com estágio salvo"/>
    <Stat icon={TrendingUp} label="Conversão em venda" value={`${conversionRate}%`} note={`${wonCount} vendas de ${Object.keys(pipeline).length} oportunidades`}/>
    <Stat icon={CircleDollarSign} label="Receita gerada" value={revenue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} note="Vendas marcadas como ganhas"/>
  </div>
    <div className="dashboard-grid"><section className="panel"><div className="panelhead"><div><h2>Funil comercial</h2><p>Distribuição real dos leads salvos no CRM.</p></div><button className="link" onClick={onPipeline}>Abrir CRM <ArrowUpRight size={13}/></button></div><div className="funnel">{stages.slice(1).map(s=>{const count=Object.values(pipeline).filter(v=>v===s).length;const pct=Object.keys(pipeline).length?Math.round(count/Object.keys(pipeline).length*100):0;return <div className="funnel-row" key={s}><div><span>{s}</span><b>{count}</b></div><div className="funnel-track"><i style={{width:(Math.max(pct,count?6:0)+"%")}}/></div></div>})}</div></section>
    <section className="panel"><div className="panelhead"><div><h2>Oportunidades quentes</h2><p>Maior potencial de conversão</p></div><button className="link" onClick={onSearch}>Ver todos <ArrowUpRight size={13}/></button></div>{hotLeads.map(l=><div className="opportunity" key={l.id}><div className="company">{l.name[0]}</div><div className="company-info"><b>{l.name}</b><span>{l.segment} · {l.location}</span></div><strong>{l.score}<small>{pipeline[l.id] || "lead"}</small></strong></div>)}</section></div>
    <section className="panel"><div className="panelhead"><div><h2>Próximos follow-ups</h2><p>{pendingFollowUpCount} tarefas comerciais pendentes{overdueFollowUps ? ` · ${overdueFollowUps} atrasadas` : ""}</p></div><button className="link" onClick={onAgenda}>Abrir Agenda <ArrowUpRight size={13}/></button></div>{pendingFollowUps.length ? pendingFollowUps.slice(0,5).map(item=><div className="opportunity" key={item.id}><div className="company"><CalendarDays size={16}/></div><div className="company-info"><b>{item.content || "Follow-up comercial"}</b><span>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : "Sem horário"}</span></div></div>) : <div className="empty">Nenhum follow-up agendado.</div>}</section>
    <div className="next"><Sparkles size={19}/><div><b>Seu próximo passo</b><span>Você tem {leads.filter(l=>!l.hasSite).length} leads sem site prontos para uma abordagem comercial.</span></div><button onClick={()=>notify(`${leads.filter(l=>!l.hasSite).length} oportunidades encontradas.`)}>Encontrar oportunidades <ArrowUpRight size={14}/></button></div>
  </>
}

function Stat({icon:Icon,label,value,note}:{icon:any,label:string,value:string,note:string}){return <div className="stat"><div className="stat-icon"><Icon size={18}/></div><div><span>{label}</span><b>{value}</b><small>{note}</small></div></div>}

function Leads({leads,setLeads,query,setQuery,notify,searchUsage,setSearchUsage,planCode,setPipeline}:{leads:LeadRow[],setLeads:React.Dispatch<React.SetStateAction<LeadRow[]>>,query:string,setQuery:(v:string)=>void,notify:(s:string)=>void,searchUsage:{used:number;limit:number|null},setSearchUsage:React.Dispatch<React.SetStateAction<{used:number;limit:number|null}>>,planCode:string,setPipeline:React.Dispatch<React.SetStateAction<Record<string,string>>>}) {
 const [advanced,setAdvanced]=useState(false);
 const [segmentFilter,setSegmentFilter]=useState("");
 const [stateFilter,setStateFilter]=useState("");
 const [cityFilter,setCityFilter]=useState("");
 const [siteFilter,setSiteFilter]=useState("all");
 const [scoreFilter,setScoreFilter]=useState("0");
 const filtered=leads.filter(l=>{
   const text=(l.name+" "+l.segment+" "+l.location+" "+l.area).toLowerCase();
   return text.includes(query.toLowerCase())
     && (!segmentFilter || l.segment.toLowerCase().includes(segmentFilter.toLowerCase()))
     && (!stateFilter || l.state.toLowerCase()===stateFilter.toLowerCase())
     && (!cityFilter || l.city.toLowerCase().includes(cityFilter.toLowerCase()))
     && (siteFilter==="all" || (siteFilter==="without" ? !l.hasSite : l.hasSite))
     && l.score >= Number(scoreFilter);
 });
 const runSearch=async()=>{
   const cleanQuery=query.trim();
   if(!cleanQuery && !segmentFilter.trim() && !cityFilter.trim() && !stateFilter.trim()){
     notify("Informe o que você quer buscar antes de continuar.");
     return;
   }
   try{
     const response = await fetch("/api/leads/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({query:cleanQuery,segment:segmentFilter.trim(),city:cityFilter.trim(),state:stateFilter.trim()})});
     const payload = await response.json();
     if(!response.ok){notify(payload.error || "Não foi possível realizar a busca.");return;}
     const rows:LeadRow[] = (payload.leads || []).map((r:any)=>({id:r.id || `osm-${r.source_id}`,name:r.name,segment:r.segment || segmentFilter || "Outros",location:[r.city,r.state].filter(Boolean).join(", "),country:r.country || "Brasil",state:r.state || "",city:r.city || "",area:r.area || "",hasSite:r.website_status === "found",score:Number(r.opportunity_score || 0),phone:r.phone || "",address:r.address || "",latitude:r.latitude ?? null,longitude:r.longitude ?? null}));
     setLeads(rows.sort((a,b)=>b.score-a.score));
     const usage=payload.usage;
     if(usage) setSearchUsage({used:usage.used,limit:usage.usage_limit});
     notify(`Busca real concluída: ${rows.length} empresas encontradas.`);
   }catch(error){console.error(error);notify("Não foi possível realizar a busca agora.");}
 };
 return <><Header eyebrow="PROSPECÇÃO INTELIGENTE" title="Buscar Leads" text="Encontre empresas, identifique oportunidades e comece a conversa." action={<div className="usage"><span>Buscas</span><b>{searchUsage.used} / {searchUsage.limit === null ? "∞" : searchUsage.limit}</b><div><i style={{width:`${searchUsage.limit===null?100:Math.min(100,(searchUsage.used/Math.max(searchUsage.limit,1))*100)}%`}}/></div></div>}/>
 <div className="searchbar"><div><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: restaurantes em Salvador..."/><kbd>⌘ K</kbd></div><button className={advanced?"secondary active-filter":"secondary"} onClick={()=>setAdvanced(v=>!v)}><Settings size={16}/> Filtros avançados</button><button className="primary" onClick={runSearch}>Buscar</button></div>
 {advanced && <div className="advanced-filters"><input value={segmentFilter} onChange={e=>setSegmentFilter(e.target.value)} placeholder="Segmento"/><input value={stateFilter} onChange={e=>setStateFilter(e.target.value.toUpperCase())} placeholder="UF"/><input value={cityFilter} onChange={e=>setCityFilter(e.target.value)} placeholder="Cidade"/><select value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}><option value="all">Qualquer site</option><option value="without">Sem site</option><option value="with">Com site</option></select><select value={scoreFilter} onChange={e=>setScoreFilter(e.target.value)}><option value="0">Qualquer score</option><option value="80">Score 80+</option><option value="90">Score 90+</option></select></div>}
 <div className="metrics"><div><b>{filtered.length}</b><span>Empresas encontradas</span></div><div><b className="green">{filtered.filter(l=>!l.hasSite).length}</b><span>Sem site</span></div><div><b>{filtered.filter(l=>l.hasSite).length}</b><span>Com site</span></div><div><b className="cyan">{filtered.filter(l=>l.score>=80).length}</b><span>Oportunidades altas</span></div></div>
 <LeadMap leads={filtered} notify={notify}/>
 <section className="panel"><div className="panelhead"><div><h2>Resultados da busca</h2><p>{filtered.length} empresas nesta visualização</p></div><div className="panelhead-meta"><span className="muted">Base inteligente · {planCode}</span><small className="muted">Dados de OpenStreetMap · © contribuidores OSM</small></div></div>{filtered.map(l=><div className="lead" key={l.id}><button className="icon-action" onClick={async()=>{const supabase=createClient() as any;const {data:userData}=await supabase.auth.getUser();if(!userData.user)return;const {error}=await supabase.from("pipeline_items").upsert({user_id:userData.user.id,lead_id:l.id,stage:"selected"},{onConflict:"user_id,lead_id"});if(error){notify("Não foi possível adicionar ao CRM.");return;}setPipeline(prev=>({...prev,[l.id]:"Selecionado"}));notify("Lead adicionado à prospecção.");}} aria-label={`Adicionar ${l.name} ao CRM`}><Target size={15}/></button><div className="company small">{l.name[0]}</div><div className="leadinfo"><b>{l.name}</b><span>{l.segment} · {l.location}</span></div><div className="site">{l.hasSite?<><i className="dot ok"/>Site encontrado</>:<><i className="dot warn"/>Site não identificado</>}</div><strong className="potential">{l.score}</strong>{l.phone ? <a className="icon-action" href={whatsappUrl(l.phone,commercialMessage(l.name))} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp para ${l.name}`}><MessageCircle size={15}/></a> : <button className="icon-action" disabled aria-label={`WhatsApp indisponível para ${l.name}`}><MessageCircle size={15}/></button>}</div>)}</section></>;
}
function LeadMap({leads,notify}:{leads:LeadRow[];notify:(s:string)=>void}) {
 const points=leads.filter(l=>typeof l.latitude==="number"&&typeof l.longitude==="number");
 const [selected,setSelected]=useState<LeadRow|null>(null);
 if(!points.length) return <section className="panel lead-map-empty"><div><Target size={20}/></div><h2>Mapa de prospecção</h2><p>Faça uma busca com empresas que tenham coordenadas para visualizar a distribuição dos leads.</p></section>;
 const lats=points.map(l=>l.latitude as number),lons=points.map(l=>l.longitude as number);
 const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);
 const latPad=Math.max((maxLat-minLat)*.12,.002),lonPad=Math.max((maxLon-minLon)*.12,.002);
 const south=minLat-latPad,north=maxLat+latPad,west=minLon-lonPad,east=maxLon+lonPad;
 const bbox=encodeURIComponent(`${west},${south},${east},${north}`);
 const project=(lat:number,lon:number)=>({left:`${((lon-west)/(east-west))*100}%`,top:`${((north-lat)/(north-south))*100}%`});
 return <section className="panel lead-map-panel"><div className="panelhead"><div><h2>Mapa de prospecção</h2><p>{points.length} leads com localização · clique em um ponto.</p></div><a className="link" href={`https://www.openstreetmap.org/?bbox=${bbox}`} target="_blank" rel="noopener noreferrer">Abrir mapa <ArrowUpRight size={13}/></a></div><div className="lead-map"><iframe title="Mapa dos leads" src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`} loading="lazy"/><div className="lead-map-pins">{points.map((lead,index)=>{const pos=project(lead.latitude as number,lead.longitude as number);return <button key={lead.id} className={`lead-pin ${selected?.id===lead.id?"selected":""}`} style={pos} title={lead.name} onClick={()=>{setSelected(lead);notify(`${lead.name} · score ${lead.score}`)}}>{index+1}</button>})}</div></div>{selected&&<div className="lead-map-detail"><div className="lead-map-detail-avatar">{selected.name.slice(0,1).toUpperCase()}</div><div className="lead-map-detail-main"><div><b>{selected.name}</b><span>{selected.segment} · {selected.city || selected.state || "Localização não informada"}</span></div><strong>{selected.score}<small>score</small></strong></div><div className="lead-map-detail-meta"><span>{selected.address || "Endereço não informado"}</span>{selected.phone&&<span>{selected.phone}</span>}</div><div className="lead-map-detail-actions"><button className="icon-action" onClick={async()=>{const supabase=createClient() as any;const {data:userData}=await supabase.auth.getUser();if(!userData.user){notify("Faça login para salvar o lead.");return;}const {error}=await supabase.from("pipeline_items").upsert({user_id:userData.user.id,lead_id:selected.id,stage:"selected"},{onConflict:"user_id,lead_id"});if(error){notify("Não foi possível adicionar ao CRM.");return;}notify(`${selected.name} adicionado à prospecção.`)}}><Target size={14}/> CRM</button>{selected.phone&&<a className="icon-action" href={whatsappUrl(selected.phone,commercialMessage(selected.name))} target="_blank" rel="noopener noreferrer"><MessageCircle size={14}/> WhatsApp</a>}<button className="icon-action" onClick={()=>setSelected(null)}><X size={14}/> Fechar</button></div></div>}<div className="lead-map-legend"><span><i/> {points.length} localizados</span><small>Mapa © OpenStreetMap contributors</small></div></section>;
}

function Pipeline({stage,setStage,pipeline,setPipeline,leads,notify}:{stage:string,setStage:(s:string)=>void,pipeline:Record<string,string>,setPipeline:React.Dispatch<React.SetStateAction<Record<string,string>>>,leads:LeadRow[],notify:(s:string)=>void}) {
 const data=leads.filter(lead => pipeline[lead.id]).map(lead=>({lead,currentStage:pipeline[lead.id] || "Selecionado"}));
 const visible=data.filter(item=>stage==="Tudo" || item.currentStage===stage);
 const [saleLead,setSaleLead]=useState<LeadRow|null>(null);
 const [saleAmount,setSaleAmount]=useState("");
 const [saleSaving,setSaleSaving]=useState(false);
 const [followLead,setFollowLead]=useState<LeadRow|null>(null);
 const [followAction,setFollowAction]=useState("Fazer follow-up comercial");
 const [followDate,setFollowDate]=useState("");
 const [followSaving,setFollowSaving]=useState(false);
 const registerSale=async()=>{
   if(!saleLead)return;
   const amount=Number(saleAmount.replace(",","."));
   if(!Number.isFinite(amount)||amount<=0){notify("Informe um valor de venda válido.");return;}
   setSaleSaving(true);
   try{
     const supabase=createClient() as any; const {data:userData}=await supabase.auth.getUser();
     if(!userData.user)return;
     const {error}=await supabase.from("sales").insert({user_id:userData.user.id,lead_id:saleLead.id,amount,status:"won",sold_at:new Date().toISOString()});
     if(error){notify("Não foi possível registrar a venda.");return;}
     const {error:pipelineError}=await supabase.from("pipeline_items").upsert({user_id:userData.user.id,lead_id:saleLead.id,stage:"sale"},{onConflict:"user_id,lead_id"});
     if(pipelineError){notify("Venda salva, mas o estágio não foi atualizado.");return;}
     setPipeline(prev=>({...prev,[saleLead.id]:"Venda"}));
     setSaleLead(null);setSaleAmount("");notify("Venda registrada e lead movido para Venda.");
   }finally{setSaleSaving(false);}
 };
 const saveFollowUp=async()=>{
   if(!followLead || !followAction.trim() || !followDate){notify("Informe a ação e a data do follow-up.");return;}
   setFollowSaving(true);
   try{
     const supabase=createClient() as any;
     const {data:userData}=await supabase.auth.getUser();
     if(!userData.user)return;
     const {error}=await supabase.from("activities").insert({
       user_id:userData.user.id, lead_id:followLead.id, type:"task",
       content:followAction.trim(), scheduled_at:new Date(followDate).toISOString()
     });
     if(error){notify("Não foi possível agendar o follow-up.");return;}
     setFollowLead(null); setFollowAction("Fazer follow-up comercial"); setFollowDate("");
     notify("Follow-up agendado na Agenda.");
   }finally{setFollowSaving(false);}
 };
 const changeStage=async (leadId:string,nextStage:string) => {
   const supabase=createClient() as any;
   const {data:userData}=await supabase.auth.getUser();
   if (!userData.user) return;
   const {error}=await supabase.from("pipeline_items").upsert({user_id:userData.user.id,lead_id:leadId,stage:stageToDb[nextStage] || "selected"},{onConflict:"user_id,lead_id"});
   if (error) { notify("Não foi possível salvar o estágio."); return; }
   const nextAction:Record<string,string> = {
     Selecionado:"Preparar primeira abordagem comercial",
     Contatado:"Aguardar resposta e fazer follow-up",
     Respondeu:"Qualificar necessidade e próximo passo",
     "Reunião":"Realizar reunião e registrar oportunidade",
     Proposta:"Acompanhar proposta enviada",
     Venda:"Registrar detalhes da venda e pós-venda",
     Descartado:"Registrar motivo do descarte"
   };
   const {error:activityError}=await supabase.from("activities").insert({
     user_id:userData.user.id,
     lead_id:leadId,
     type:"note",
     content:`Estágio alterado para ${nextStage}. Próxima ação: ${nextAction[nextStage] || "Acompanhar oportunidade"}.`
   });
   if (activityError) { notify("Estágio salvo, mas não foi possível registrar o histórico."); }
   setPipeline(prev=>({...prev,[leadId]:nextStage}));
   notify(activityError ? "Estágio salvo no CRM." : "Estágio salvo + histórico registrado.");
 };
 return <><Header eyebrow="CRM COMERCIAL" title="Minha Prospecção" text="Acompanhe cada oportunidade até o fechamento." action={<button className="primary" onClick={()=>notify("Selecione um lead nos resultados para adicioná-lo à prospecção.")}><Users size={16}/> Adicionar lead</button>}/>
 <div className="tabs">{stages.map(s=><button className={stage===s?"selected":""} onClick={()=>setStage(s)} key={s}>{s}</button>)}</div>
 <div className="kanban">{visible.map(({lead,currentStage})=><div className="deal" key={lead.id}><div className="deal-head"><span>{currentStage}</span><b>{lead.score}</b></div><strong>{lead.name}</strong><small>Próxima ação: acompanhar a oportunidade</small><button className="secondary" onClick={()=>{setFollowLead(lead);setFollowAction("Fazer follow-up comercial");setFollowDate("");}}><CalendarDays size={13}/> Agendar follow-up</button><select className="select" value={currentStage} onChange={e=>changeStage(lead.id,e.target.value)}>{stages.slice(1).map(s=><option key={s}>{s}</option>)}</select><div>{lead.phone ? <a className="deal-whatsapp" href={whatsappUrl(lead.phone, commercialMessage(lead.name))} target="_blank" rel="noopener noreferrer"><MessageCircle size={13}/> WhatsApp</a> : <button className="deal-whatsapp" disabled aria-label={`WhatsApp indisponível para ${lead.name}`}><MessageCircle size={13}/> WhatsApp</button>}<button onClick={()=>{setSaleLead(lead);setSaleAmount("");}} aria-label={`Registrar venda de ${lead.name}`}><CircleDollarSign size={13}/></button><button onClick={async()=>{const supabase=createClient() as any; const {data,error}=await supabase.rpc("consume_ai"); if(error||!data?.[0]){notify("Não foi possível validar o uso da IA.");return;} const result=data[0]; if(!result.allowed){notify(`Limite de IA do plano ${result.plan_code} atingido. Consulte Planos.`);return;} const content=commercialMessage(lead.name); const {error:activityError}=await supabase.from("activities").insert({user_id:(await supabase.auth.getUser()).data.user?.id,lead_id:lead.id,type:"ai_approach",content}); if(activityError){notify("Cota consumida, mas não foi possível salvar a abordagem.");return;} notify(`Abordagem IA salva. Uso: ${result.used}/${result.usage_limit===null?"∞":result.usage_limit}.`);}}><Sparkles size={13}/></button></div></div>)}</div>{followLead&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!followSaving)setFollowLead(null)}}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="follow-title"><div className="modal-head"><div><span className="eyebrow">FOLLOW-UP</span><h2 id="follow-title">Agendar próxima ação</h2><p>{followLead.name}</p></div><button className="modal-close" onClick={()=>setFollowLead(null)} disabled={followSaving}>×</button></div><label className="field-label">Próxima ação<input autoFocus value={followAction} onChange={e=>setFollowAction(e.target.value)} placeholder="Ex.: Ligar para apresentar a proposta" /></label><label className="field-label">Data e hora<input type="datetime-local" value={followDate} onChange={e=>setFollowDate(e.target.value)} /></label><div className="form-actions"><button className="secondary" onClick={()=>setFollowLead(null)} disabled={followSaving}>Cancelar</button><button className="primary" onClick={saveFollowUp} disabled={followSaving}><CalendarDays size={14}/>{followSaving?"Agendando...":"Agendar follow-up"}</button></div></section></div>}{saleLead&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saleSaving)setSaleLead(null)}}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="sale-title"><div className="modal-head"><div><span className="eyebrow">FECHAMENTO</span><h2 id="sale-title">Registrar venda</h2><p>{saleLead.name}</p></div><button className="modal-close" onClick={()=>setSaleLead(null)} disabled={saleSaving}>×</button></div><label className="field-label">Valor da venda<input autoFocus inputMode="decimal" value={saleAmount} onChange={e=>setSaleAmount(e.target.value)} placeholder="Ex.: 2490,00" onKeyDown={e=>{if(e.key==="Enter")registerSale()}} /></label><div className="modal-summary"><span>Estágio após salvar</span><strong>Venda</strong></div><div className="form-actions"><button className="secondary" onClick={()=>setSaleLead(null)} disabled={saleSaving}>Cancelar</button><button className="primary" onClick={registerSale} disabled={saleSaving}><CircleDollarSign size={14}/>{saleSaving?"Registrando...":"Registrar venda"}</button></div></section></div>}</>
}

function Agenda({leads,notify}:{leads:LeadRow[];notify:(s:string)=>void}) {
  const [items,setItems]=useState<{id:string;content:string;scheduled_at:string|null;completed_at:string|null;type:string;lead_id:string|null}[]>([]);
  const [open,setOpen]=useState(false);
  const [leadId,setLeadId]=useState("");
  const [type,setType]=useState("task");
  const [content,setContent]=useState("");
  const [scheduledAt,setScheduledAt]=useState("");
  const [saving,setSaving]=useState(false);

  const load=async()=>{
    const supabase=createClient() as any;
    const {data,error}=await supabase.from("activities").select("id,content,scheduled_at,completed_at,type,lead_id").order("scheduled_at",{ascending:true,nullsFirst:false}).limit(100);
    if(error){notify("Não foi possível carregar a agenda.");return;}
    setItems(data||[]);
  };
  useEffect(()=>{ load(); },[]);

  const createActivity=async()=>{
    if(!content.trim()){notify("Descreva a atividade antes de salvar.");return;}
    setSaving(true);
    try{
      const supabase=createClient() as any;
      const {data:userData}=await supabase.auth.getUser();
      if(!userData.user){return;}
      const {error}=await supabase.from("activities").insert({
        user_id:userData.user.id, lead_id:leadId||null, type, content:content.trim(),
        scheduled_at:scheduledAt?new Date(scheduledAt).toISOString():null
      });
      if(error){notify("Não foi possível criar a atividade.");return;}
      setContent(""); setScheduledAt(""); setLeadId(""); setType("task"); setOpen(false);
      await load(); notify("Atividade criada na agenda.");
    }finally{setSaving(false);}
  };
  const complete=async(id:string)=>{
    const supabase=createClient() as any; const completedAt=new Date().toISOString();
    const {error}=await supabase.from("activities").update({completed_at:completedAt}).eq("id",id);
    if(error){notify("Não foi possível concluir a atividade.");return;}
    setItems(prev=>prev.map(i=>i.id===id?{...i,completed_at:completedAt}:i));
    notify("Atividade concluída.");
  };

  return <><Header eyebrow="ORGANIZAÇÃO COMERCIAL" title="Agenda" text="Acompanhe os próximos contatos e compromissos." action={<button className="primary" onClick={()=>setOpen(v=>!v)}><CalendarDays size={16}/> Nova atividade</button>}/>
  {open && <section className="panel activity-form">
    <div className="panelhead"><div><h2>Nova atividade</h2><p>Registre o próximo passo comercial.</p></div></div>
    <div className="form-grid">
      <select value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Sem lead vinculado</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
      <select value={type} onChange={e=>setType(e.target.value)}><option value="task">Tarefa</option><option value="call">Ligação</option><option value="whatsapp">WhatsApp</option><option value="meeting">Reunião</option><option value="note">Nota</option></select>
      <input value={scheduledAt} onChange={e=>setScheduledAt(e.target.value)} type="datetime-local"/>
      <input value={content} onChange={e=>setContent(e.target.value)} placeholder="Ex.: Fazer follow-up com o decisor"/>
    </div>
    <div className="form-actions"><button className="secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" disabled={saving} onClick={createActivity}><Save size={14}/> {saving?"Salvando...":"Salvar atividade"}</button></div>
  </section>}
  <section className="panel">{items.length?items.map(i=><div className="lead" key={i.id}><div className="leadinfo"><b>{i.content||"Atividade comercial"}</b><span>{i.scheduled_at?new Date(i.scheduled_at).toLocaleString("pt-BR"):"Sem horário definido"} · {i.type}</span></div>{i.completed_at?<span className="muted">Concluída</span>:<button className="secondary" onClick={()=>complete(i.id)}><Check size={14}/> Concluir</button>}</div>):<div className="coming"><div><CalendarDays size={23}/></div><h2>Nenhuma atividade agendada</h2><p>Crie seus próximos contatos para acompanhar a operação comercial.</p></div>}</section></>;
}
function Results({leads,pipeline}:{leads:LeadRow[];pipeline:Record<string,string>}) {
  const pipelineTotal=Object.keys(pipeline).length;
  const counts=stages.slice(1).map(s=>({stage:s,count:Object.values(pipeline).filter(value=>value===s).length}));
  return <><Header eyebrow="INTELIGÊNCIA COMERCIAL" title="Resultados" text="Veja como seus leads estão avançando pelo funil."/><div className="metrics">{counts.map(x=><div key={x.stage}><b>{x.count}</b><span>{x.stage}</span></div>)}</div><section className="panel"><div className="panelhead"><div><h2>Conversão do funil</h2><p>Distribuição atual dos leads com estágio salvo no CRM.</p></div></div>{counts.map(x=><div className="lead" key={x.stage}><div className="leadinfo"><b>{x.stage}</b><span>{pipelineTotal?Math.round(x.count/pipelineTotal*100):0}% da base</span></div><strong className="potential">{x.count}</strong></div>)}</section></>;
}

function Revenue({leads,revenue,notify}:{leads:LeadRow[];revenue:number;notify:(s:string)=>void}) {
  const [sales,setSales]=useState<{id:string;amount:number;status:string;sold_at:string;lead_id:string|null}[]>([]);
  const [open,setOpen]=useState(false);
  const [leadId,setLeadId]=useState("");
  const [amount,setAmount]=useState("");
  const [status,setStatus]=useState("won");
  const [soldAt,setSoldAt]=useState("");
  const [saving,setSaving]=useState(false);

  const load=async()=>{
    const supabase=createClient() as any;
    const {data}=await supabase.from("sales").select("id,amount,status,sold_at,lead_id").order("sold_at",{ascending:false}).limit(50);
    setSales(data||[]);
  };
  useEffect(()=>{load();},[]);

  const registerSale=async()=>{
    const numeric=Number(amount.replace(",",".")); if(!Number.isFinite(numeric)||numeric<0){notify("Informe um valor de venda válido.");return;}
    setSaving(true);
    try{
      const supabase=createClient() as any; const {data:userData}=await supabase.auth.getUser();
      if(!userData.user){return;}
      const {error}=await supabase.from("sales").insert({user_id:userData.user.id,lead_id:leadId||null,amount:numeric,status,sold_at:soldAt?new Date(soldAt).toISOString():new Date().toISOString()});
      if(error){notify("Não foi possível registrar a venda.");return;}
      if(status==="won"&&leadId){
        const {error:pipelineError}=await supabase.from("pipeline_items").upsert({user_id:userData.user.id,lead_id:leadId,stage:"sale"},{onConflict:"user_id,lead_id"});
        if(pipelineError){
          setAmount("");setLeadId("");setStatus("won");setSoldAt("");setOpen(false);await load();
          notify("Venda registrada, mas o estágio do CRM não foi atualizado.");
          return;
        }
      }
      setAmount("");setLeadId("");setStatus("won");setSoldAt("");setOpen(false);await load();
      notify("Venda registrada com sucesso.");
    }finally{setSaving(false);}
  };

  return <><Header eyebrow="FINANCEIRO" title="Receita" text="Acompanhe vendas e faturamento gerado pela prospecção." action={<button className="primary" onClick={()=>setOpen(v=>!v)}><CircleDollarSign size={16}/> Registrar venda</button>}/>
  {open&&<section className="panel activity-form"><div className="panelhead"><div><h2>Registrar venda</h2><p>O lançamento fica salvo no histórico financeiro.</p></div></div><div className="form-grid"><select value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Sem lead vinculado</option>{leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select><input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Valor da venda · R$" inputMode="decimal"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="won">Ganha</option><option value="pending">Pendente</option><option value="cancelled">Cancelada</option></select><input value={soldAt} onChange={e=>setSoldAt(e.target.value)} type="datetime-local"/></div><div className="form-actions"><button className="secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" disabled={saving} onClick={registerSale}><Save size={14}/> {saving?"Salvando...":"Salvar venda"}</button></div></section>}
  <div className="stats"><Stat icon={CircleDollarSign} label="Receita ganha" value={revenue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} note="Status ganho"/><Stat icon={TrendingUp} label="Vendas registradas" value={sales.filter(s=>s.status==="won").length.toString()} note="No histórico"/></div><section className="panel"><div className="panelhead"><div><h2>Histórico de vendas</h2><p>Últimos lançamentos do workspace.</p></div></div>{sales.length?sales.map(s=><div className="lead" key={s.id}><div className="leadinfo"><b>{Number(s.amount).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b><span>{new Date(s.sold_at).toLocaleDateString("pt-BR")}</span></div><span className="muted">{s.status}</span></div>):<div className="coming"><div><CircleDollarSign size={23}/></div><h2>Nenhuma venda registrada</h2><p>As vendas adicionadas ao CRM aparecerão aqui.</p></div>}</section></>;
}

function Plans({notify,currentPlan}:{notify:(s:string)=>void;currentPlan:string}) {
 const [plans,setPlans]=useState<Array<{plan_code:string;name:string;price:number;search_limit:number|null;companies_per_search:number;ai_limit:number|null}>>([]);
 const [checkoutPlan,setCheckoutPlan]=useState<string | null>(null);
 const [loadingPlans,setLoadingPlans]=useState(true);
 useEffect(()=>{let mounted=true;(async()=>{try{const {data,error}=await (createClient() as any).from("plan_settings").select("plan_code,name,price,search_limit,companies_per_search,ai_limit").order("price",{ascending:true});if(!mounted)return;if(error){notify("Não foi possível carregar os planos agora.");return;}setPlans(data||[]);}finally{if(mounted)setLoadingPlans(false);}})();return()=>{mounted=false;};},[notify]);
 return <><Header eyebrow="PLANOS E ASSINATURAS" title="Escolha o ritmo do seu crescimento." text="Mais leads, mais conversas e mais oportunidades em um só lugar."/>{loadingPlans?<div className="panel" style={{padding:"24px"}}>Carregando planos...</div>:plans.length===0?<div className="panel" style={{padding:"24px"}}>Os planos não estão disponíveis no momento.</div>:<div className="plans">{plans.map((p,i)=><div className={`${p.plan_code==="pro"?"plan featured":"plan"} ${p.plan_code===currentPlan?"current-plan":""}`} key={p.plan_code}>{p.plan_code==="pro"&&<label>Mais escolhido</label>}{p.plan_code==="infinity"&&<label className="gold">Desconto especial</label>}{p.plan_code===currentPlan&&<label className="current">Seu plano</label>}<span>{p.name}</span><strong>{Number(p.price).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}<small>{p.plan_code!=="free"?"/mês":""}</small></strong><p>Para {p.plan_code==="free"?"começar":p.plan_code==="basic"?"profissionais":"quem quer escalar"} sua prospecção.</p><div className="feature"><Check size={14}/>{p.search_limit===null?"Buscas ilimitadas":`${p.search_limit} buscas / mês`}</div><div className="feature"><Check size={14}/>{p.companies_per_search} empresas por busca</div><div className="feature"><Check size={14}/>{p.ai_limit===null?"IA ilimitada":`${p.ai_limit} abordagens IA / mês`}</div><div className="feature"><Check size={14}/>Filtros avançados</div><div className="feature"><Check size={14}/>Minha Prospecção e Agenda</div><button className={p.plan_code===currentPlan?"secondary":"primary"} disabled={p.plan_code===currentPlan} onClick={async()=>{if(p.plan_code==="free"){notify("Plano gratuito disponível.");return;} if(checkoutPlan){return;} const confirmed=window.confirm(`Você será redirecionado ao Mercado Pago para contratar o plano ${p.name} por ${Number(p.price).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}/mês.\n\nAbrir o checkout não cobra nada. A cobrança só acontece se você concluir o pagamento no Mercado Pago.\n\nDeseja continuar?`); if(!confirmed){return;} setCheckoutPlan(p.plan_code); try { const supabase=createClient() as any; const {data,error}=await supabase.functions.invoke("mercado-pago-checkout",{body:{plan_code:p.plan_code}}); if(error||data?.error){const msg=data?.error==="mercado_pago_not_configured"?"Mercado Pago ainda não está configurado no servidor.":data?.error==="already_active"?"Você já está neste plano.":data?.error==="active_subscription_exists"?`Você já possui uma assinatura ativa no plano ${data?.plan_code || "atual"}.`:data?.error==="checkout_in_progress"?"Já existe um checkout em andamento para sua conta. Aguarde alguns minutos antes de tentar novamente.":data?.error==="admin_has_unlimited_access"?"A conta administradora não precisa assinar um plano.":"Não foi possível iniciar o checkout do Mercado Pago.";notify(msg);return;} if(data?.status==="already_active"){notify("Você já está neste plano.");return;} if(data?.checkout_url){window.location.assign(data.checkout_url);return;} notify("O Mercado Pago não retornou o link de checkout."); } finally { setCheckoutPlan(null); }}}>{p.plan_code===currentPlan?"Plano atual":checkoutPlan===p.plan_code?"Abrindo Mercado Pago...":p.plan_code==="pro"?"Continuar com Pro":"Escolher plano"}</button></div>)}</div>}</>
}
function SettingsPage({userName,setUserName,userEmail,planCode,theme,setTheme,language,setLanguage,notify}:{userName:string;setUserName:(v:string)=>void;userEmail:string;planCode:string;theme:"dark"|"light";setTheme:(v:"dark"|"light")=>void;language:string;setLanguage:(v:string)=>void;notify:(s:string)=>void}) {
  const [name,setName]=useState(userName);
  const [password,setPassword]=useState("");
  const [saving,setSaving]=useState(false);
  useEffect(()=>setName(userName),[userName]);
  const saveProfile=async()=>{
    if(!name.trim()){notify("Informe seu nome.");return;}
    setSaving(true);
    try{
      const supabase=createClient() as any; const {data:userData}=await supabase.auth.getUser();
      if(!userData.user){return;}
      const {error}=await supabase.from("profiles").update({full_name:name.trim()}).eq("id",userData.user.id);
      if(error){notify("Não foi possível salvar o perfil.");return;}
      await supabase.auth.updateUser({data:{full_name:name.trim()}});
      setUserName(name.trim());notify("Perfil atualizado.");
    }finally{setSaving(false);}
  };
  const changePassword=async()=>{
    if(password.length<6){notify("A senha precisa ter pelo menos 6 caracteres.");return;}
    if(password.length>128){notify("A senha deve ter no máximo 128 caracteres.");return;}
    setSaving(true);
    try{const {error}=await createClient().auth.updateUser({password});if(error){notify("Não foi possível atualizar a senha.");return;}setPassword("");notify("Senha atualizada com segurança.");}finally{setSaving(false);}
  };
  return <><Header eyebrow="SISTEMA" title="Configurações" text="Gerencie seu perfil e os dados de acesso do workspace."/><div className="settings-grid"><section className="panel settings-card"><div className="panelhead"><div><h2>Perfil</h2><p>Informações exibidas no workspace.</p></div></div><label className="field-label">Nome<input value={name} onChange={e=>setName(e.target.value)} /></label><label className="field-label">E-mail<input value={userEmail} readOnly /></label><label className="field-label">Plano<input value={planCode==="infinity"?"Infinity":planCode==="pro"?"Pro":planCode==="basic"?"Básico":"Gratuito"} readOnly /></label><button className="primary" disabled={saving} onClick={saveProfile}><Save size={14}/> Salvar perfil</button></section><section className="panel settings-card"><div className="panelhead"><div><h2>Preferências</h2><p>Personalize a experiência do workspace. O idioma completo será liberado em uma próxima versão.</p></div></div><div className="preference-row"><span>Idioma</span><select value={language} onChange={e=>{const value=e.target.value;if(value!=="pt-BR"){notify("English e Español estarão disponíveis em uma próxima versão.");return;}setLanguage(value)}}><option value="pt-BR">Português (Brasil)</option><option value="en-US" disabled>English — em breve</option><option value="es" disabled>Español — em breve</option></select></div><div className="preference-row"><span>Aparência</span><div className="segmented"><button className={theme==="dark"?"selected":""} onClick={()=>setTheme("dark")}>Escuro</button><button className={theme==="light"?"selected":""} onClick={()=>setTheme("light")}>Claro</button></div></div><div className="settings-note">As preferências são salvas neste dispositivo.</div></section><section className="panel settings-card"><div className="panelhead"><div><h2>Segurança</h2><p>Troque sua senha sem sair do workspace.</p></div></div><label className="field-label">Nova senha<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="6 a 128 caracteres" maxLength={128}/></label><button className="secondary" disabled={saving} onClick={changePassword}><LockKeyhole size={14}/> Atualizar senha</button></section></div></>;
}

function AdminPage({notify}:{notify:(s:string)=>void}) {
  const [plans,setPlans]=useState<{plan_code:string;name:string;price:number;search_limit:number|null;companies_per_search:number;ai_limit:number|null}[]>([]);
  const [gateway,setGateway]=useState({provider:"none",mode:"test",public_key:"",webhook_url:"",enabled:false});
  const [users,setUsers]=useState<{id:string;email:string|null;full_name:string|null;role:string;plan_code:string;subscription_status:string|null;provider:string|null;current_period_end:string|null;created_at:string}[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState("");
  const [saving,setSaving]=useState("");
  const load=async()=>{
    setLoading(true);
    setLoadError("");
    const supabase=createClient() as any;
    const [p,g,u]=await Promise.all([
      supabase.from("plan_settings").select("plan_code,name,price,search_limit,companies_per_search,ai_limit").order("price",{ascending:true}),
      supabase.from("gateway_settings").select("provider,mode,public_key,webhook_url,enabled").eq("id",true).maybeSingle(),
      supabase.rpc("admin_user_overview")
    ]);
    const firstError=p.error||g.error||u.error;
    if(firstError){
      setLoadError(firstError.message||"Não foi possível carregar os dados administrativos.");
      setLoading(false);
      return;
    }
    setPlans((p.data||[]) as typeof plans);
    if(g.data) setGateway(g.data as typeof gateway);
    setUsers((u.data||[]) as typeof users);
    setLoading(false);
  };
  useEffect(()=>{load();},[]);
  const updatePlan=(code:string,key:string,value:string)=>{
    setPlans(prev=>prev.map(p=>p.plan_code===code?{...p,[key]:key==="price"?Number(value.replace(",",".")):value===""?null:Number(value)}:p));
  };
  const savePlan=async(plan:typeof plans[number])=>{
    if(!Number.isFinite(plan.price)||plan.price<0||!Number.isFinite(plan.companies_per_search)||plan.companies_per_search<1||((plan.search_limit??0)<0)||((plan.ai_limit??0)<0)){
      notify("Revise os valores do plano antes de salvar.");
      return;
    }
    setSaving(plan.plan_code);
    const supabase=createClient() as any; const {data:userData}=await supabase.auth.getUser();
    const {error}=await supabase.from("plan_settings").update({price:plan.price,search_limit:plan.search_limit,companies_per_search:plan.companies_per_search,ai_limit:plan.ai_limit,updated_at:new Date().toISOString()}).eq("plan_code",plan.plan_code);
    if(!error&&userData.user) await supabase.from("admin_audit_log").insert({admin_user_id:userData.user.id,action:"update_plan",target_type:"plan",target_id:plan.plan_code,details:{price:plan.price,search_limit:plan.search_limit,companies_per_search:plan.companies_per_search,ai_limit:plan.ai_limit}});
    setSaving("");
    notify(error?"Não foi possível salvar o plano.":"Plano atualizado com sucesso.");
  };
  const saveGateway=async()=>{
    if(gateway.provider==="mercado_pago" && gateway.enabled && !gateway.webhook_url.trim()){
      notify("Informe a URL do webhook antes de ativar o Mercado Pago.");
      return;
    }
    if(gateway.mode!=="test" && gateway.mode!=="live"){
      notify("Selecione um modo válido para a gateway.");
      return;
    }
    setSaving("gateway");
    const supabase=createClient() as any; const {data:userData}=await supabase.auth.getUser();
    const {error}=await supabase.from("gateway_settings").update({...gateway,updated_at:new Date().toISOString()}).eq("id",true);
    if(!error&&userData.user) await supabase.from("admin_audit_log").insert({admin_user_id:userData.user.id,action:"update_gateway",target_type:"gateway",target_id:"default",details:{provider:gateway.provider,mode:gateway.mode,enabled:gateway.enabled}});
    setSaving("");
    notify(error?"Não foi possível salvar a configuração da gateway.":"Configuração da gateway salva com sucesso.");
  };
  if(loading) return <div className="coming"><div><LockKeyhole size={23}/></div><h2>Carregando administração</h2><p>Validando configurações do workspace.</p></div>;
  if(loadError) return <div className="coming"><div><LockKeyhole size={23}/></div><h2>Não foi possível carregar a administração</h2><p>{loadError}</p><button className="primary" onClick={load}>Tentar novamente</button></div>;
  return <><Header eyebrow="ADMINISTRAÇÃO" title="Painel administrativo" text="Controle planos, usuários e a infraestrutura de pagamentos do workspace."/>
    <section className="panel admin-users"><div className="panelhead"><div><h2>Operação de usuários</h2><p>Usuários, planos e assinaturas em uma visão administrativa.</p></div><button className="secondary" onClick={()=>document.getElementById("admin-user-list")?.scrollIntoView({behavior:"smooth",block:"start"})}><Users size={14}/>Gerenciar usuários</button></div><div className="admin-stat-grid"><div><span>Usuários</span><strong>{users.length}</strong><small>Até 50 mais recentes</small></div><div><span>Assinaturas ativas</span><strong>{users.filter(u=>u.subscription_status==="active").length}</strong><small>Status persistido</small></div><div><span>Plano Infinity</span><strong>{users.filter(u=>u.plan_code==="infinity").length}</strong><small>Inclui administração</small></div></div><div id="admin-user-list" className="admin-user-list">{users.length===0?<p className="settings-note">Nenhum usuário disponível para consulta.</p>:users.map(u=><AdminUserRow key={u.id} user={u} saving={saving} onSave={async(id,plan,status)=>{setSaving(`user:${id}`);const supabase=createClient() as any;const {error}=await supabase.rpc("admin_update_user",{p_user_id:id,p_plan_code:plan,p_status:status});setSaving("");if(error){notify("Não foi possível atualizar o usuário.");return;}notify("Usuário atualizado com sucesso.");await load();}} />)}</div></section><section className="panel admin-banner"><div><span className="eyebrow">ACESSO ADMINISTRATIVO</span><h2>Controle central do Progresso Acha</h2><p>Alterações aqui afetam a configuração comercial dos planos.</p></div><span className="admin-badge">ADMIN</span></section>
    <div className="plans admin-plans">{plans.map(p=><section className="panel admin-plan" key={p.plan_code}><div className="panelhead"><div><h2>{p.name}</h2><p>{p.plan_code}</p></div><span className="admin-badge">{p.plan_code==="free"?"GRÁTIS":"EDITÁVEL"}</span></div><div className="form-grid admin-grid"><label className="field-label">Preço<input inputMode="decimal" value={p.price} onChange={e=>updatePlan(p.plan_code,"price",e.target.value)}/></label><label className="field-label">Buscas<input inputMode="numeric" value={p.search_limit ?? ""} placeholder="∞" onChange={e=>updatePlan(p.plan_code,"search_limit",e.target.value)}/></label><label className="field-label">Empresas / busca<input inputMode="numeric" value={p.companies_per_search} onChange={e=>updatePlan(p.plan_code,"companies_per_search",e.target.value)}/></label><label className="field-label">IA / mês<input inputMode="numeric" value={p.ai_limit ?? ""} placeholder="∞" onChange={e=>updatePlan(p.plan_code,"ai_limit",e.target.value)}/></label></div><button className="primary" disabled={saving===p.plan_code} onClick={()=>savePlan(p)}><Save size={14}/>{saving===p.plan_code?"Salvando...":"Salvar plano"}</button></section>)}</div>
    <section className="panel admin-roadmap"><div className="panelhead"><div><h2>Infraestrutura de pagamentos</h2><p>A base técnica já está conectada; a ativação comercial depende das credenciais e da configuração do provedor.</p></div></div><div className="roadmap-grid"><div><b>01</b><strong>Checkout</strong><span>Edge Function do checkout já disponível para os planos pagos.</span></div><div><b>02</b><strong>Webhooks</strong><span>Endpoint de webhook já preparado para receber atualizações do provedor.</span></div><div><b>03</b><strong>Billing</strong><span>Assinaturas e status ficam preparados para sincronização automática.</span></div><div><b>04</b><strong>Auditoria</strong><span>Alterações administrativas importantes ficam registradas.</span></div></div></section><section className="panel gateway-panel"><div className="panelhead"><div><h2>Gateway de pagamento</h2><p>Configure aqui o provedor comercial. O checkout e o webhook do Mercado Pago já estão estruturados no backend.</p></div><span className="gateway-status">{gateway.enabled?"ATIVA":"NÃO CONFIGURADA"}</span></div><div className="form-grid"><label className="field-label">Provedor<select value={gateway.provider} onChange={e=>setGateway({...gateway,provider:e.target.value})}><option value="none">Nenhum</option><option value="stripe">Stripe</option><option value="mercado_pago">Mercado Pago</option><option value="other">Outro</option></select></label><label className="field-label">Modo<select value={gateway.mode} onChange={e=>setGateway({...gateway,mode:e.target.value})}><option value="test">Teste</option><option value="live">Produção</option></select></label><label className="field-label">Chave pública<input value={gateway.public_key||""} onChange={e=>setGateway({...gateway,public_key:e.target.value})} placeholder="Será configurada depois"/></label><label className="field-label">Webhook<input value={gateway.webhook_url||""} onChange={e=>setGateway({...gateway,webhook_url:e.target.value})} placeholder="https://..."/></label></div><label className="preference-row"><span>Gateway habilitada</span><input type="checkbox" checked={gateway.enabled} onChange={e=>setGateway({...gateway,enabled:e.target.checked})}/></label><p className="settings-note">Chaves secretas não serão armazenadas no navegador. Quando a gateway for criada, a integração deve usar servidor/Edge Function e secrets protegidos.</p><button className="primary" disabled={saving==="gateway"} onClick={saveGateway}><Save size={14}/>{saving==="gateway"?"Salvando...":"Salvar configuração"}</button></section>
  </>;
}

function AdminUserRow({user,saving,onSave}:{user:{id:string;email:string|null;full_name:string|null;role:string;plan_code:string;subscription_status:string|null;provider:string|null;current_period_end:string|null;created_at:string};saving:string;onSave:(id:string,plan:string,status:string)=>Promise<void>}){
  const [plan,setPlan]=useState(user.plan_code);
  const [status,setStatus]=useState(user.subscription_status||"active");
  useEffect(()=>{setPlan(user.plan_code);setStatus(user.subscription_status||"active")},[user.plan_code,user.subscription_status]);
  return <div className="admin-user-row"><div><strong>{user.full_name||"Sem nome"}</strong><span>{user.email||"Sem e-mail"}</span></div><div className="admin-user-controls"><select value={plan} onChange={e=>setPlan(e.target.value)} disabled={user.role==="admin"}><option value="free">free</option><option value="basic">basic</option><option value="pro">pro</option><option value="infinity">infinity</option></select><select value={status} onChange={e=>setStatus(e.target.value)} disabled={user.role==="admin"}><option value="active">active</option><option value="paused">paused</option><option value="past_due">past_due</option><option value="canceled">canceled</option></select><button className="secondary" disabled={user.role==="admin"||saving===`user:${user.id}`} onClick={()=>onSave(user.id,plan,status)}>{saving===`user:${user.id}`?"Salvando...":"Aplicar"}</button><small>{user.role==="admin"?"Administrador • protegido":"Usuário"}</small></div></div>}

function Coming({title}:{title:string}){return <div className="coming"><div><Sparkles size={23}/></div><div className="eyebrow">MÓDULO PROGRESSO ACHA</div><h1>{title}</h1><p>A estrutura está conectada à plataforma. A próxima camada integra os dados persistentes, autenticação e serviços externos sem comprometer o design.</p></div>}