"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-browser";
import {
  ArrowUpRight, BarChart3, CalendarDays, Check, ChevronRight, CircleDollarSign,
  Globe2, LayoutDashboard, Menu, MessageCircle, Search, Settings, Sparkles,
  Target, TrendingUp, Users, X, Zap, LogOut
} from "lucide-react";

const leads = [
  ["Pizzaria La Bella","Restaurante","Salvador, BA",false,96,"5571999991001"],
  ["Studio Araujo Advocacia","Advocacia","Salvador, BA",true,91,"5571999991002"],
  ["Casa Norte Móveis","Móveis","Feira de Santana, BA",false,88,"5575999991003"],
  ["Clínica Vitta","Saúde","Lauro de Freitas, BA",true,84,"5571999991004"],
  ["Bahia Fit Academia","Academia","Salvador, BA",false,82,"5571999991005"],
  ["Ateliê Casa Azul","Decoração","Camaçari, BA",false,79,"5571999991006"]
] as const;

function whatsappUrl(phone:string, message:string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function commercialMessage(name:string) {
  return `Olá! Tudo bem? Aqui é da Progresso Acha. Encontrei a ${name} e queria apresentar uma oportunidade para ajudar sua empresa a gerar mais clientes pela internet. Podemos conversar?`;
}

const stages = ["Tudo","Selecionado","Contatado","Respondeu","Reunião","Proposta","Venda","Descartado"];

export default function Home() {
  const [active,setActive] = useState("Dashboard");
  const [mobile,setMobile] = useState(false);
  const [query,setQuery] = useState("");
  const [toast,setToast] = useState("");
  const [stage,setStage] = useState("Tudo");
  const [authReady,setAuthReady] = useState(false);
  const [userName,setUserName] = useState("Willian");
  const [dbLeads,setDbLeads] = useState<typeof leads>(leads);

  const notify = (message:string) => { setToast(message); window.setTimeout(() => setToast(""),2600); };
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!data.user) { window.location.href = "/login"; return; }
        setUserName(data.user.user_metadata?.full_name || data.user.email?.split("@")[0] || "Usuário");
        const { data: rows } = await supabase.from("leads").select("name,segment,city,state,website_status,opportunity_score,phone").order("opportunity_score",{ascending:false}).limit(50);
        if (rows?.length) {
          setDbLeads(rows.map(r => [r.name, r.segment || "Outros", [r.city,r.state].filter(Boolean).join(", "), r.website_status === "found", r.opportunity_score, r.phone || ""] as const));
        }
      } catch (error) {
        console.error(error);
      } finally { if (mounted) setAuthReady(true); }
    })();
    return () => { mounted = false; };
  }, []);

  const logout = async () => {
    try { await createClient().auth.signOut(); } finally { window.location.href = "/login"; }
  };
  const nav = [
    ["Visão Geral",[["Dashboard",LayoutDashboard],["Agenda",CalendarDays]]],
    ["Prospecção",[["Buscar Leads",Search],["Minha Prospecção",Target],["Resultados",BarChart3]]],
    ["Financeiro",[["Receita",CircleDollarSign],["Planos",Zap]]],
    ["Sistema",[["Configurações",Settings]]]
  ] as const;

  if (!authReady) return <main className="auth-shell"><section className="auth-card"><div className="auth-brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div></div><div className="auth-copy"><div className="eyebrow"><span className="pulse"/> CARREGANDO OPERAÇÃO</div><h1>Preparando seu workspace.</h1><p>Conectando seus dados com segurança.</p></div></section></main>;

  return <div className="shell">
    <aside className={mobile ? "sidebar open" : "sidebar"}>
      <div className="brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div><button className="close" onClick={()=>setMobile(false)}><X/></button></div>
      <div className="workspace"><small>WORKSPACE</small><button>Meu negócio <ChevronRight size={14}/></button></div>
      <nav>{nav.map(([group,items])=><div className="navgroup" key={group}><label>{group}</label>{items.map(([label,Icon])=><button key={label} className={active===label?"nav active":"nav"} onClick={()=>{setActive(label);setMobile(false)}}><Icon size={17}/><span>{label}</span>{label==="Buscar Leads"&&<em>12</em>}</button>)}</div>)}</nav>
      <div className="sidebottom"><div className="mini-plan"><small>PLANO ATUAL</small><b>Pro</b><button onClick={()=>setActive("Planos")}>Upgrade <ArrowUpRight size={12}/></button></div><button className="nav"><Settings size={17}/><span>Preferências</span></button><button className="nav danger" onClick={logout}><LogOut size={17}/><span>Sair</span></button></div>
    </aside>

    <main className="main">
      <header><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">Workspace <ChevronRight size={13}/> <b>{active}</b></div><div className="actions"><button><Globe2 size={17}/></button><button className="notify"><MessageCircle size={17}/><i/></button><div className="avatar">{userName.slice(0,2).toUpperCase()}</div></div></header>
      <div className="content">
        {active==="Dashboard" && <Dashboard onSearch={()=>setActive("Buscar Leads")} notify={notify}/>}
        {active==="Buscar Leads" && <Leads query={query} setQuery={setQuery} notify={notify}/>}
        {active==="Minha Prospecção" && <Pipeline stage={stage} setStage={setStage} notify={notify}/>}
        {active==="Planos" && <Plans notify={notify}/>}
        {["Agenda","Resultados","Receita","Configurações"].includes(active) && <Coming title={active}/>}
      </div>
    </main>
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function Header({eyebrow,title,text,action}:{eyebrow:string,title:string,text:string,action?:React.ReactNode}) {
  return <div className="heading"><div><div className="eyebrow"><span className="pulse"/> {eyebrow}</div><h1>{title}</h1><p>{text}</p></div>{action}</div>
}

function Dashboard({onSearch,notify}:{onSearch:()=>void,notify:(s:string)=>void}) {
  return <><Header eyebrow="VISÃO GERAL" title={`Bom dia, ${userName} ✦`} text="Transforme oportunidades em conversas e conversas em vendas." action={<button className="primary" onClick={onSearch}><Search size={16}/> Buscar novos leads</button>}/>
    <div className="stats"><Stat icon={Users} label="Leads encontrados" value="1.248" note="+18,4% este mês"/><Stat icon={Target} label="Em prospecção" value="186" note="+32 esta semana"/><Stat icon={TrendingUp} label="Taxa de resposta" value="24,8%" note="+4,2% vs. anterior"/><Stat icon={CircleDollarSign} label="Receita gerada" value="R$ 8.450" note="+21,6% este mês"/></div>
    <div className="dashboard-grid"><section className="panel"><div className="panelhead"><div><h2>Atividade comercial</h2><p>Performance dos últimos 30 dias</p></div><button className="select">Últimos 30 dias <ChevronRight size={13}/></button></div><div className="chart"><div className="y"><span>12k</span><span>9k</span><span>6k</span><span>3k</span><span>0</span></div><div className="plot"><div/><div/><div/><div/><svg viewBox="0 0 700 230" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#00f2fe" stopOpacity=".22"/><stop offset="1" stopColor="#00f2fe" stopOpacity="0"/></linearGradient></defs><path d="M0 190 C55 175 65 183 105 155 S160 170 205 135 S260 150 305 112 S365 130 410 95 S470 105 510 70 S580 80 630 45 S675 48 700 25 V230 H0Z" fill="url(#g)"/><path d="M0 190 C55 175 65 183 105 155 S160 170 205 135 S260 150 305 112 S365 130 410 95 S470 105 510 70 S580 80 630 45 S675 48 700 25" fill="none" stroke="#00f2fe" strokeWidth="3"/></svg></div></div><div className="months"><span>01</span><span>05</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span></div></section>
    <section className="panel"><div className="panelhead"><div><h2>Oportunidades quentes</h2><p>Maior potencial de conversão</p></div><button className="link" onClick={onSearch}>Ver todos <ArrowUpRight size={13}/></button></div>{leads.slice(0,3).map(l=><div className="opportunity" key={l[0]}><div className="company">{l[0][0]}</div><div className="company-info"><b>{l[0]}</b><span>{l[1]} · {l[2]}</span></div><strong>{l[4]}<small>score</small></strong></div>)}</section></div>
    <div className="next"><Sparkles size={19}/><div><b>Seu próximo passo</b><span>Você tem 23 leads sem site prontos para uma abordagem comercial.</span></div><button onClick={()=>notify("23 oportunidades encontradas.")}>Encontrar oportunidades <ArrowUpRight size={14}/></button></div>
  </>
}

function Stat({icon:Icon,label,value,note}:{icon:any,label:string,value:string,note:string}){return <div className="stat"><div className="stat-icon"><Icon size={18}/></div><div><span>{label}</span><b>{value}</b><small>{note}</small></div></div>}

function Leads({query,setQuery,notify}:{query:string,setQuery:(v:string)=>void,notify:(s:string)=>void}) {
 const filtered=dbLeads.filter(l=>(l[0]+" "+l[1]+" "+l[2]).toLowerCase().includes(query.toLowerCase()));
 return <><Header eyebrow="PROSPECÇÃO INTELIGENTE" title="Buscar Leads" text="Encontre empresas, identifique oportunidades e comece a conversa." action={<div className="usage"><span>Buscas</span><b>42 / 300</b><div><i/></div></div>}/>
 <div className="searchbar"><div><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: restaurantes em Salvador..."/><kbd>⌘ K</kbd></div><button className="secondary"><Settings size={16}/> Filtros avançados</button><button className="primary" onClick={()=>notify("Busca realizada com sucesso.")}>Buscar</button></div>
 <div className="metrics"><div><b>248</b><span>Empresas encontradas</span></div><div><b className="green">74</b><span>Sem site</span></div><div><b>174</b><span>Com site</span></div><div><b className="cyan">31</b><span>Oportunidades altas</span></div></div>
 <section className="panel"><div className="panelhead"><div><h2>Resultados da busca</h2><p>{filtered.length} empresas nesta visualização</p></div><span className="muted">Base inteligente</span></div>{filtered.map(l=><div className="lead" key={l[0]}><input type="checkbox"/><div className="company small">{l[0][0]}</div><div className="leadinfo"><b>{l[0]}</b><span>{l[1]} · {l[2]}</span></div><div className="site">{l[3]?<><i className="dot ok"/>Site encontrado</>:<><i className="dot warn"/>Site não identificado</>}</div><strong className="potential">{l[4]}</strong><a className="icon-action" href={whatsappUrl(l[5], commercialMessage(l[0]))} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp para ${l[0]}`}><MessageCircle size={15}/></a></div>)}</section></>
}

function Pipeline({stage,setStage,notify}:{stage:string,setStage:(s:string)=>void,notify:(s:string)=>void}) {
 const data=[["Selecionado","Pizzaria La Bella",96],["Contatado","Casa Norte Móveis",88],["Respondeu","Clínica Vitta",84],["Reunião","Bahia Fit Academia",82],["Proposta","Studio Araujo Advocacia",91],["Venda","Ateliê Casa Azul",79]] as const;
 return <><Header eyebrow="CRM COMERCIAL" title="Minha Prospecção" text="Acompanhe cada oportunidade até o fechamento." action={<button className="primary" onClick={()=>notify("Lead adicionado à prospecção.")}><Users size={16}/> Adicionar lead</button>}/><div className="tabs">{stages.map(s=><button className={stage===s?"selected":""} onClick={()=>setStage(s)} key={s}>{s}</button>)}</div><div className="kanban">{data.filter(x=>stage==="Tudo"||x[0]===stage).map(x=><div className="deal" key={x[1]}><div className="deal-head"><span>{x[0]}</span><b>{x[2]}</b></div><strong>{x[1]}</strong><small>Próxima ação: entrar em contato</small><div><a className="deal-whatsapp" href={whatsappUrl(dbLeads.find(l=>l[0]===x[1])?.[5] ?? "", commercialMessage(x[1]))} target="_blank" rel="noopener noreferrer"><MessageCircle size={13}/> WhatsApp</a><button onClick={()=>notify("Abordagem IA gerada.")}><Sparkles size={13}/></button></div></div>)}</div></>
}

function Plans({notify}:{notify:(s:string)=>void}) {
 const plans=[["Gratuito","R$ 0","3 buscas no total","20 empresas por busca","5 abordagens IA / mês"],["Básico","R$ 24,90","60 buscas / mês","30 empresas por busca","20 abordagens IA / mês"],["Pro","R$ 49,90","300 buscas / mês","40 empresas por busca","200 abordagens IA / mês"],["Infinity","R$ 59,90","Buscas ilimitadas*","40 empresas por busca","1.000 abordagens IA / mês"]];
 return <><Header eyebrow="PLANOS E ASSINATURAS" title="Escolha o ritmo do seu crescimento." text="Mais leads, mais conversas e mais oportunidades em um só lugar."/><div className="plans">{plans.map((p,i)=><div className={i===2?"plan featured":"plan"} key={p[0]}>{i===2&&<label>Mais escolhido</label>}{i===3&&<label className="gold">Desconto especial</label>}<span>{p[0]}</span><strong>{p[1]}<small>{i?"/mês":""}</small></strong><p>Para {i===0?"começar":i===1?"profissionais":"quem quer escalar"} sua prospecção.</p>{p.slice(2).map(f=><div className="feature" key={f}><Check size={14}/>{f}</div>)}<div className="feature"><Check size={14}/>Filtros avançados</div><div className="feature"><Check size={14}/>Minha Prospecção e Agenda</div><button className={i===2?"primary":"secondary"} onClick={()=>notify(i===2?"Plano Pro selecionado.":"Fluxo de assinatura preparado.")}>{i===0?"Plano atual":i===2?"Continuar com Pro":"Escolher plano"}</button></div>)}</div></>
}

function Coming({title}:{title:string}){return <div className="coming"><div><Sparkles size={23}/></div><div className="eyebrow">MÓDULO PROGRESSO ACHA</div><h1>{title}</h1><p>A estrutura está conectada à plataforma. A próxima camada integra os dados persistentes, autenticação e serviços externos sem comprometer o design.</p></div>}
