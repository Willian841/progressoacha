"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase-browser";
import {
  ArrowUpRight, BarChart3, CalendarDays, Check, ChevronRight, CircleDollarSign,
  Globe2, LayoutDashboard, Menu, MessageCircle, Search, Settings, Sparkles,
  Target, TrendingUp, Users, X, Zap, LogOut, Save, LockKeyhole
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
const stageToDb: Record<string,string> = { Selecionado:"selected", Contatado:"contacted", Respondeu:"replied", "Reunião":"meeting", Proposta:"proposal", Venda:"sale", Descartado:"discarded" };
const dbToStage: Record<string,string> = Object.fromEntries(Object.entries(stageToDb).map(([ui,db]) => [db,ui]));
type LeadRow = { id:string; name:string; segment:string; location:string; country:string; state:string; city:string; area:string; hasSite:boolean; score:number; phone:string };

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
        setUserEmail(data.user.email || "");
        const { data: profile } = await supabase.from("profiles").select("plan_code").eq("id", data.user.id).maybeSingle();
        const currentPlan = profile?.plan_code || "free";
        setPlanCode(currentPlan);
        const { data: limits } = await supabase.rpc("plan_limits", { p_plan: currentPlan });
        const limitRow = limits?.[0];
        const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
        const { count: totalSearches } = await supabase.from("searches").select("id", { count:"exact", head:true });
        const { data: usageRow } = await supabase.from("usage_monthly").select("search_count,ai_count").eq("user_id", data.user.id).eq("month_start", monthStart.toISOString().slice(0,10)).maybeSingle();
        setSearchUsage({used: currentPlan === "free" ? (totalSearches || 0) : (usageRow?.search_count || 0), limit: limitRow?.search_limit ?? null});
        setAiUsage({used: usageRow?.ai_count || 0, limit: limitRow?.ai_limit ?? null});
        let result = await supabase.from("leads").select("id,name,segment,country,state,city,area,website_status,opportunity_score,phone").order("opportunity_score",{ascending:false}).limit(50);
        if (!result.data?.length) {
          const seed = leads.map(l => ({user_id:data.user.id,name:l[0],segment:l[1],city:l[2].split(", ")[0] || null,state:l[2].split(", ")[1] || null,country:"Brasil",phone:l[5],website_status:l[3] ? "found" : "not_found",opportunity_score:l[4],source:"demo"}));
          await supabase.from("leads").insert(seed);
          result = await supabase.from("leads").select("id,name,segment,city,state,website_status,opportunity_score,phone").order("opportunity_score",{ascending:false}).limit(50);
        }
        if (result.data?.length) {
          setDbLeads(result.data.map(r => ({id:r.id,name:r.name,segment:r.segment || "Outros",location:[r.city,r.state].filter(Boolean).join(", "),country:r.country || "Brasil",state:r.state || "",city:r.city || "",area:r.area || "",hasSite:r.website_status === "found",score:r.opportunity_score,phone:r.phone || ""})));
          const { data:pipelineRows } = await supabase.from("pipeline_items").select("lead_id,stage");
          const saved:Record<string,string> = {};
          pipelineRows?.forEach(row => { saved[row.lead_id] = dbToStage[row.stage] || "Selecionado"; });
          setPipeline(saved);
          const { data:salesRows } = await supabase.from("sales").select("amount").eq("status","won");
          setRevenue((salesRows || []).reduce((total,row) => total + Number(row.amount || 0), 0));
        }
      } catch (error) { console.error(error); }
      finally { if (mounted) setAuthReady(true); }
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
      <div className="sidebottom"><div className="mini-plan"><small>PLANO ATUAL</small><b>{planCode === "infinity" ? "Infinity" : planCode === "basic" ? "Básico" : planCode === "pro" ? "Pro" : "Gratuito"}</b><button onClick={()=>setActive("Planos")}>Upgrade <ArrowUpRight size={12}/></button></div><button className="nav"><Settings size={17}/><span>Preferências</span></button><button className="nav danger" onClick={logout}><LogOut size={17}/><span>Sair</span></button></div>
    </aside>

    <main className="main">
      <header><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div className="crumb">Workspace <ChevronRight size={13}/> <b>{active}</b></div><div className="actions"><button><Globe2 size={17}/></button><button className="notify"><MessageCircle size={17}/><i/></button><div className="avatar">{userName.slice(0,2).toUpperCase()}</div></div></header>
      <div className="content">
        {active==="Dashboard" && <Dashboard userName={userName} leads={dbLeads} pipeline={pipeline} revenue={revenue} onSearch={()=>setActive("Buscar Leads")} notify={notify}/>}
        {active==="Buscar Leads" && <Leads leads={dbLeads} query={query} setQuery={setQuery} notify={notify} searchUsage={searchUsage} setSearchUsage={setSearchUsage} planCode={planCode}/>}
        {active==="Minha Prospecção" && <Pipeline stage={stage} setStage={setStage} pipeline={pipeline} setPipeline={setPipeline} leads={dbLeads} notify={notify}/>}
        {active==="Planos" && <Plans notify={notify}/>}
        {active==="Agenda" && <Agenda leads={dbLeads} notify={notify}/>}
        {active==="Resultados" && <Results leads={dbLeads} pipeline={pipeline}/>}
        {active==="Receita" && <Revenue revenue={revenue} notify={notify}/>}
        {active==="Configurações" && <SettingsPage userName={userName} setUserName={setUserName} userEmail={userEmail} planCode={planCode} notify={notify}/>}  
      </div>
    </main>
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
  </div>
}

function Header({eyebrow,title,text,action}:{eyebrow:string,title:string,text:string,action?:React.ReactNode}) {
  return <div className="heading"><div><div className="eyebrow"><span className="pulse"/> {eyebrow}</div><h1>{title}</h1><p>{text}</p></div>{action}</div>
}

function Dashboard({userName,leads,pipeline,revenue,onSearch,notify}:{userName:string,leads:LeadRow[],pipeline:Record<string,string>,revenue:number,onSearch:()=>void,notify:(s:string)=>void}) {
  return <><Header eyebrow="VISÃO GERAL" title={`Bom dia, ${userName} ✦`} text="Transforme oportunidades em conversas e conversas em vendas." action={<button className="primary" onClick={onSearch}><Search size={16}/> Buscar novos leads</button>}/>
    <div className="stats">
    <Stat icon={Users} label="Leads encontrados" value={leads.length.toLocaleString("pt-BR")} note="No seu workspace"/>
    <Stat icon={Target} label="Em prospecção" value={Object.keys(pipeline).length.toLocaleString("pt-BR")} note="Com estágio salvo"/>
    <Stat icon={TrendingUp} label="Taxa de resposta" value={`${leads.length ? Math.round((Object.values(pipeline).filter(s=>["Respondeu","Reunião","Proposta","Venda"].includes(s)).length / leads.length) * 100) : 0}%`} note="Baseada no CRM"/>
    <Stat icon={CircleDollarSign} label="Receita gerada" value={revenue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} note="Vendas marcadas como ganhas"/>
  </div>
    <div className="dashboard-grid"><section className="panel"><div className="panelhead"><div><h2>Atividade comercial</h2><p>Performance dos últimos 30 dias</p></div><button className="select">Últimos 30 dias <ChevronRight size={13}/></button></div><div className="chart"><div className="y"><span>12k</span><span>9k</span><span>6k</span><span>3k</span><span>0</span></div><div className="plot"><div/><div/><div/><div/><svg viewBox="0 0 700 230" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#00f2fe" stopOpacity=".22"/><stop offset="1" stopColor="#00f2fe" stopOpacity="0"/></linearGradient></defs><path d="M0 190 C55 175 65 183 105 155 S160 170 205 135 S260 150 305 112 S365 130 410 95 S470 105 510 70 S580 80 630 45 S675 48 700 25 V230 H0Z" fill="url(#g)"/><path d="M0 190 C55 175 65 183 105 155 S160 170 205 135 S260 150 305 112 S365 130 410 95 S470 105 510 70 S580 80 630 45 S675 48 700 25" fill="none" stroke="#00f2fe" strokeWidth="3"/></svg></div></div><div className="months"><span>01</span><span>05</span><span>10</span><span>15</span><span>20</span><span>25</span><span>30</span></div></section>
    <section className="panel"><div className="panelhead"><div><h2>Oportunidades quentes</h2><p>Maior potencial de conversão</p></div><button className="link" onClick={onSearch}>Ver todos <ArrowUpRight size={13}/></button></div>{leads.slice(0,3).map(l=><div className="opportunity" key={l.id}><div className="company">{l.name[0]}</div><div className="company-info"><b>{l.name}</b><span>{l.segment} · {l.location}</span></div><strong>{l.score}<small>score</small></strong></div>)}</section></div>
    <div className="next"><Sparkles size={19}/><div><b>Seu próximo passo</b><span>Você tem {leads.filter(l=>!l.hasSite).length} leads sem site prontos para uma abordagem comercial.</span></div><button onClick={()=>notify(`${leads.filter(l=>!l.hasSite).length} oportunidades encontradas.`)}>Encontrar oportunidades <ArrowUpRight size={14}/></button></div>
  </>
}

function Stat({icon:Icon,label,value,note}:{icon:any,label:string,value:string,note:string}){return <div className="stat"><div className="stat-icon"><Icon size={18}/></div><div><span>{label}</span><b>{value}</b><small>{note}</small></div></div>}

function Leads({leads,query,setQuery,notify,searchUsage,setSearchUsage,planCode}:{leads:LeadRow[],query:string,setQuery:(v:string)=>void,notify:(s:string)=>void,searchUsage:{used:number;limit:number|null},setSearchUsage:React.Dispatch<React.SetStateAction<{used:number;limit:number|null}>>,planCode:string}) {
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
   const supabase=createClient();
   const {data,error}=await supabase.rpc("consume_search",{p_segment:segmentFilter||null,p_country:"Brasil",p_state:stateFilter||null,p_city:cityFilter||null,p_area:null,p_filters:{query,site:siteFilter,min_score:Number(scoreFilter)},p_result_count:filtered.length});
   if(error||!data?.[0]){notify("Não foi possível validar o uso da busca.");return;}
   const result=data[0];
   if(!result.allowed){notify(`Limite do plano ${result.plan_code} atingido. Consulte Planos para continuar.`);return;}
   setSearchUsage({used:result.used,limit:result.usage_limit});
   notify(`Busca realizada. Uso: ${result.used}/${result.usage_limit===null?"∞":result.usage_limit}.`);
 };
 return <><Header eyebrow="PROSPECÇÃO INTELIGENTE" title="Buscar Leads" text="Encontre empresas, identifique oportunidades e comece a conversa." action={<div className="usage"><span>Buscas</span><b>{searchUsage.used} / {searchUsage.limit === null ? "∞" : searchUsage.limit}</b><div><i style={{width:`${searchUsage.limit===null?100:Math.min(100,(searchUsage.used/Math.max(searchUsage.limit,1))*100)}%`}}/></div></div>}/>
 <div className="searchbar"><div><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Ex.: restaurantes em Salvador..."/><kbd>⌘ K</kbd></div><button className={advanced?"secondary active-filter":"secondary"} onClick={()=>setAdvanced(v=>!v)}><Settings size={16}/> Filtros avançados</button><button className="primary" onClick={runSearch}>Buscar</button></div>
 {advanced && <div className="advanced-filters"><input value={segmentFilter} onChange={e=>setSegmentFilter(e.target.value)} placeholder="Segmento"/><input value={stateFilter} onChange={e=>setStateFilter(e.target.value.toUpperCase())} placeholder="UF"/><input value={cityFilter} onChange={e=>setCityFilter(e.target.value)} placeholder="Cidade"/><select value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}><option value="all">Qualquer site</option><option value="without">Sem site</option><option value="with">Com site</option></select><select value={scoreFilter} onChange={e=>setScoreFilter(e.target.value)}><option value="0">Qualquer score</option><option value="80">Score 80+</option><option value="90">Score 90+</option></select></div>}
 <div className="metrics"><div><b>{filtered.length}</b><span>Empresas encontradas</span></div><div><b className="green">{filtered.filter(l=>!l.hasSite).length}</b><span>Sem site</span></div><div><b>{filtered.filter(l=>l.hasSite).length}</b><span>Com site</span></div><div><b className="cyan">{filtered.filter(l=>l.score>=80).length}</b><span>Oportunidades altas</span></div></div>
 <section className="panel"><div className="panelhead"><div><h2>Resultados da busca</h2><p>{filtered.length} empresas nesta visualização</p></div><span className="muted">Base inteligente · {planCode}</span></div>{filtered.map(l=><div className="lead" key={l.id}><button className="icon-action" onClick={async()=>{const supabase=createClient();const {data:userData}=await supabase.auth.getUser();if(!userData.user)return;const {error}=await supabase.from("pipeline_items").upsert({user_id:userData.user.id,lead_id:l.id,stage:"selected"},{onConflict:"user_id,lead_id"});notify(error?"Não foi possível adicionar ao CRM.":"Lead adicionado à prospecção.");}} aria-label={`Adicionar ${l.name} ao CRM`}><Target size={15}/></button><div className="company small">{l.name[0]}</div><div className="leadinfo"><b>{l.name}</b><span>{l.segment} · {l.location}</span></div><div className="site">{l.hasSite?<><i className="dot ok"/>Site encontrado</>:<><i className="dot warn"/>Site não identificado</>}</div><strong className="potential">{l.score}</strong><a className="icon-action" href={whatsappUrl(l.phone,commercialMessage(l.name))} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp para ${l.name}`}><MessageCircle size={15}/></a></div>)}</section></>;
}
function Pipeline({stage,setStage,pipeline,setPipeline,leads,notify}:{stage:string,setStage:(s:string)=>void,pipeline:Record<string,string>,setPipeline:React.Dispatch<React.SetStateAction<Record<string,string>>>,leads:LeadRow[],notify:(s:string)=>void}) {
 const data=leads.map(lead=>({lead,currentStage:pipeline[lead.id] || "Selecionado"}));
 const visible=data.filter(item=>stage==="Tudo" || item.currentStage===stage);
 const changeStage=async (leadId:string,nextStage:string) => {
   const supabase=createClient();
   const {data:userData}=await supabase.auth.getUser();
   if (!userData.user) return;
   const {error}=await supabase.from("pipeline_items").upsert({user_id:userData.user.id,lead_id:leadId,stage:stageToDb[nextStage] || "selected"},{onConflict:"user_id,lead_id"});
   if (error) { notify("Não foi possível salvar o estágio."); return; }
   setPipeline(prev=>({...prev,[leadId]:nextStage}));
   notify("Estágio salvo no CRM.");
 };
 return <><Header eyebrow="CRM COMERCIAL" title="Minha Prospecção" text="Acompanhe cada oportunidade até o fechamento." action={<button className="primary" onClick={()=>notify("Selecione um lead nos resultados para adicioná-lo à prospecção.")}><Users size={16}/> Adicionar lead</button>}/>
 <div className="tabs">{stages.map(s=><button className={stage===s?"selected":""} onClick={()=>setStage(s)} key={s}>{s}</button>)}</div>
 <div className="kanban">{visible.map(({lead,currentStage})=><div className="deal" key={lead.id}><div className="deal-head"><span>{currentStage}</span><b>{lead.score}</b></div><strong>{lead.name}</strong><small>Próxima ação: acompanhar a oportunidade</small><select className="select" value={currentStage} onChange={e=>changeStage(lead.id,e.target.value)}>{stages.slice(1).map(s=><option key={s}>{s}</option>)}</select><div><a className="deal-whatsapp" href={whatsappUrl(lead.phone, commercialMessage(lead.name))} target="_blank" rel="noopener noreferrer"><MessageCircle size={13}/> WhatsApp</a><button onClick={async()=>{const supabase=createClient(); const {data,error}=await supabase.rpc("consume_ai"); if(error||!data?.[0]){notify("Não foi possível validar o uso da IA.");return;} const result=data[0]; if(!result.allowed){notify(`Limite de IA do plano ${result.plan_code} atingido. Consulte Planos.`);return;} const content=commercialMessage(lead.name); const {error:activityError}=await supabase.from("activities").insert({user_id:(await supabase.auth.getUser()).data.user?.id,lead_id:lead.id,type:"ai_approach",content}); if(activityError){notify("Cota consumida, mas não foi possível salvar a abordagem.");return;} notify(`Abordagem IA salva. Uso: ${result.used}/${result.usage_limit===null?"∞":result.usage_limit}.`);}}><Sparkles size={13}/></button></div></div>)}</div></>
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
    const supabase=createClient();
    const {data}=await supabase.from("activities").select("id,content,scheduled_at,completed_at,type,lead_id").order("scheduled_at",{ascending:true}).limit(50);
    setItems(data||[]);
  };
  useEffect(()=>{ load(); },[]);

  const createActivity=async()=>{
    if(!content.trim()){notify("Descreva a atividade antes de salvar.");return;}
    setSaving(true);
    try{
      const supabase=createClient();
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
    const supabase=createClient(); const completedAt=new Date().toISOString();
    const {error}=await supabase.from("activities").update({completed_at:completedAt}).eq("id",id);
    if(!error){setItems(prev=>prev.map(i=>i.id===id?{...i,completed_at:completedAt}:i));notify("Atividade concluída.");}
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
  const counts=stages.slice(1).map(s=>({stage:s,count:leads.filter(l=>(pipeline[l.id]||"Selecionado")===s).length}));
  return <><Header eyebrow="INTELIGÊNCIA COMERCIAL" title="Resultados" text="Veja como seus leads estão avançando pelo funil."/><div className="metrics">{counts.map(x=><div key={x.stage}><b>{x.count}</b><span>{x.stage}</span></div>)}</div><section className="panel"><div className="panelhead"><div><h2>Conversão do funil</h2><p>Distribuição atual dos leads por estágio.</p></div></div>{counts.map(x=><div className="lead" key={x.stage}><div className="leadinfo"><b>{x.stage}</b><span>{leads.length?Math.round(x.count/leads.length*100):0}% da base</span></div><strong className="potential">{x.count}</strong></div>)}</section></>;
}

function Revenue({revenue,notify}:{revenue:number;notify:(s:string)=>void}) {
  const [sales,setSales]=useState<{id:string;amount:number;status:string;sold_at:string;lead_id:string|null}[]>([]);
  const [open,setOpen]=useState(false);
  const [leadId,setLeadId]=useState("");
  const [amount,setAmount]=useState("");
  const [status,setStatus]=useState("won");
  const [soldAt,setSoldAt]=useState("");
  const [saving,setSaving]=useState(false);

  const load=async()=>{
    const supabase=createClient();
    const {data}=await supabase.from("sales").select("id,amount,status,sold_at,lead_id").order("sold_at",{ascending:false}).limit(50);
    setSales(data||[]);
  };
  useEffect(()=>{load();},[]);

  const registerSale=async()=>{
    const numeric=Number(amount.replace(",",".")); if(!Number.isFinite(numeric)||numeric<0){notify("Informe um valor de venda válido.");return;}
    setSaving(true);
    try{
      const supabase=createClient(); const {data:userData}=await supabase.auth.getUser();
      if(!userData.user){return;}
      const {error}=await supabase.from("sales").insert({user_id:userData.user.id,lead_id:leadId||null,amount:numeric,status,sold_at:soldAt?new Date(soldAt).toISOString():new Date().toISOString()});
      if(error){notify("Não foi possível registrar a venda.");return;}
      if(status==="won"&&leadId){
        await supabase.from("pipeline_items").upsert({user_id:userData.user.id,lead_id:leadId,stage:"sale"},{onConflict:"user_id,lead_id"});
      }
      setAmount("");setLeadId("");setStatus("won");setSoldAt("");setOpen(false);await load();
      notify("Venda registrada com sucesso.");
      window.location.reload();
    }finally{setSaving(false);}
  };

  return <><Header eyebrow="FINANCEIRO" title="Receita" text="Acompanhe vendas e faturamento gerado pela prospecção." action={<button className="primary" onClick={()=>setOpen(v=>!v)}><CircleDollarSign size={16}/> Registrar venda</button>}/>
  {open&&<section className="panel activity-form"><div className="panelhead"><div><h2>Registrar venda</h2><p>O lançamento fica salvo no histórico financeiro.</p></div></div><div className="form-grid"><input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Valor da venda · R$" inputMode="decimal"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="won">Ganha</option><option value="pending">Pendente</option><option value="cancelled">Cancelada</option></select><input value={soldAt} onChange={e=>setSoldAt(e.target.value)} type="datetime-local"/></div><div className="form-actions"><button className="secondary" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary" disabled={saving} onClick={registerSale}><Save size={14}/> {saving?"Salvando...":"Salvar venda"}</button></div></section>}
  <div className="stats"><Stat icon={CircleDollarSign} label="Receita ganha" value={revenue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} note="Status ganho"/><Stat icon={TrendingUp} label="Vendas registradas" value={sales.filter(s=>s.status==="won").length.toString()} note="No histórico"/></div><section className="panel"><div className="panelhead"><div><h2>Histórico de vendas</h2><p>Últimos lançamentos do workspace.</p></div></div>{sales.length?sales.map(s=><div className="lead" key={s.id}><div className="leadinfo"><b>{Number(s.amount).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</b><span>{new Date(s.sold_at).toLocaleDateString("pt-BR")}</span></div><span className="muted">{s.status}</span></div>):<div className="coming"><div><CircleDollarSign size={23}/></div><h2>Nenhuma venda registrada</h2><p>As vendas adicionadas ao CRM aparecerão aqui.</p></div>}</section></>;
}

function Plans({notify}:{notify:(s:string)=>void}) {
 const plans=[["Gratuito","R$ 0","3 buscas no total","20 empresas por busca","5 abordagens IA / mês"],["Básico","R$ 24,90","60 buscas / mês","30 empresas por busca","20 abordagens IA / mês"],["Pro","R$ 49,90","300 buscas / mês","40 empresas por busca","200 abordagens IA / mês"],["Infinity","R$ 59,90","Buscas ilimitadas*","40 empresas por busca","1.000 abordagens IA / mês"]];
 return <><Header eyebrow="PLANOS E ASSINATURAS" title="Escolha o ritmo do seu crescimento." text="Mais leads, mais conversas e mais oportunidades em um só lugar."/><div className="plans">{plans.map((p,i)=><div className={i===2?"plan featured":"plan"} key={p[0]}>{i===2&&<label>Mais escolhido</label>}{i===3&&<label className="gold">Desconto especial</label>}<span>{p[0]}</span><strong>{p[1]}<small>{i?"/mês":""}</small></strong><p>Para {i===0?"começar":i===1?"profissionais":"quem quer escalar"} sua prospecção.</p>{p.slice(2).map(f=><div className="feature" key={f}><Check size={14}/>{f}</div>)}<div className="feature"><Check size={14}/>Filtros avançados</div><div className="feature"><Check size={14}/>Minha Prospecção e Agenda</div><button className={i===2?"primary":"secondary"} onClick={()=>notify(i===2?"Plano Pro selecionado.":"Fluxo de assinatura preparado.")}>{i===0?"Plano atual":i===2?"Continuar com Pro":"Escolher plano"}</button></div>)}</div></>
}

function SettingsPage({userName,setUserName,userEmail,planCode,notify}:{userName:string;setUserName:(v:string)=>void;userEmail:string;planCode:string;notify:(s:string)=>void}) {
  const [name,setName]=useState(userName);
  const [password,setPassword]=useState("");
  const [saving,setSaving]=useState(false);
  useEffect(()=>setName(userName),[userName]);
  const saveProfile=async()=>{
    if(!name.trim()){notify("Informe seu nome.");return;}
    setSaving(true);
    try{
      const supabase=createClient(); const {data:userData}=await supabase.auth.getUser();
      if(!userData.user){return;}
      const {error}=await supabase.from("profiles").update({full_name:name.trim()}).eq("id",userData.user.id);
      if(error){notify("Não foi possível salvar o perfil.");return;}
      await supabase.auth.updateUser({data:{full_name:name.trim()}});
      setUserName(name.trim());notify("Perfil atualizado.");
    }finally{setSaving(false);}
  };
  const changePassword=async()=>{
    if(password.length<6){notify("A senha precisa ter pelo menos 6 caracteres.");return;}
    setSaving(true);
    try{const {error}=await createClient().auth.updateUser({password});if(error){notify("Não foi possível atualizar a senha.");return;}setPassword("");notify("Senha atualizada com segurança.");}finally{setSaving(false);}
  };
  return <><Header eyebrow="SISTEMA" title="Configurações" text="Gerencie seu perfil e os dados de acesso do workspace."/><div className="settings-grid"><section className="panel settings-card"><div className="panelhead"><div><h2>Perfil</h2><p>Informações exibidas no workspace.</p></div></div><label className="field-label">Nome<input value={name} onChange={e=>setName(e.target.value)} /></label><label className="field-label">E-mail<input value={userEmail} readOnly /></label><label className="field-label">Plano<input value={planCode==="infinity"?"Infinity":planCode==="pro"?"Pro":planCode==="basic"?"Básico":"Gratuito"} readOnly /></label><button className="primary" disabled={saving} onClick={saveProfile}><Save size={14}/> Salvar perfil</button></section><section className="panel settings-card"><div className="panelhead"><div><h2>Segurança</h2><p>Troque sua senha sem sair do workspace.</p></div></div><label className="field-label">Nova senha<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Mínimo de 6 caracteres"/></label><button className="secondary" disabled={saving} onClick={changePassword}><LockKeyhole size={14}/> Atualizar senha</button></section></div></>;
}

function Coming({title}:{title:string}){return <div className="coming"><div><Sparkles size={23}/></div><div className="eyebrow">MÓDULO PROGRESSO ACHA</div><h1>{title}</h1><p>A estrutura está conectada à plataforma. A próxima camada integra os dados persistentes, autenticação e serviços externos sem comprometer o design.</p></div>}
