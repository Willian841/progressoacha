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
const stageToDb: Record<string,string> = { "Selecionado":"selected", "Contatado":"contacted", "Respondeu":"replied", "Reunião":"meeting", "Proposta":"proposal", "Venda":"sale", "Descartado":"discarded" };
const dbToStage: Record<string,string> = Object.fromEntries(Object.entries(stageToDb).map(([ui,db]) => [db,ui]));
type LeadRow = { id:string; name:string; segment:string; location:string; hasSite:boolean; score:number; phone:string };

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

        let leadRows = await supabase.from("leads")
          .select("id,name,segment,city,state,website_status,opportunity_score,phone")
          .order("opportunity_score",{ascending:false}).limit(50);

        if (!leadRows.data?.length) {
          const seed = leads.map(l => ({
            user_id: data.user.id, name:l[0], segment:l[1],
            city:l[2].split(", ")[0] || null, state:l[2].split(", ")[1] || null,
            country:"Brasil", phone:l[5], website_status:l[3] ? "found" : "not_found",
            opportunity_score:l[4], source:"demo"
          }));
          await supabase.from("leads").insert(seed);
          leadRows = await supabase.from("leads")
            .select("id,name,segment,city,state,website_status,opportunity_score,phone")
            .order("opportunity_score",{ascending:false}).limit(50);
        }

        if (leadRows.data?.length) {
          setDbLeads(leadRows.data.map(r => ({
            id:r.id, name:r.name, segment:r.segment || "Outros",
            location:[r.city,r.state].filter(Boolean).join(", "),
            hasSite:r.website_status === "found", score:r.opportunity_score, phone:r.phone || ""
          })));
          const { data: pipelineRows } = await supabase
            .from("pipeline_items").select("lead_id,stage");
          if (pipelineRows?.length) {
            const next:Record<string,string> = {};
            pipelineRows.forEach(row => { next[row.lead_id] = dbToStage[row.stage] || "Selecionado"; });
            setPipeline(next);
          }
        }
      } catch (error) {
        console.error(error);
      } finally { if (mounted) setAuthReady(true); }
    })();
    return () => { mounted = false; };
  }, []);function Pipeline({stage,setStage,pipeline,setPipeline,leads,notify}:{stage:string,setStage:(s:string)=>void,pipeline:Record<string,string>,setPipeline:React.Dispatch<React.SetStateAction<Record<string,string>>>,leads:LeadRow[],notify:(s:string)=>void}) {
 const data=leads.map(l => ({ lead:l, currentStage:pipeline[l.id] || "Selecionado" }));
 const visible=data.filter(x=>stage==="Tudo" || x.currentStage===stage);
 const changeStage=async (leadId:string,nextStage:string) => {
   const supabase=createClient();
   const {data:userData}=await supabase.auth.getUser();
   if (!userData.user) return;
   const dbStage=stageToDb[nextStage] || "selected";
   const {error}=await supabase.from("pipeline_items").upsert(
     {user_id:userData.user.id,lead_id:leadId,stage:dbStage},
     {onConflict:"user_id,lead_id"}
   );
   if (error) { notify("Não foi possível salvar o estágio."); return; }
   setPipeline(prev=>({...prev,[leadId]:nextStage}));
   notify("Estágio salvo no CRM.");
 };
 return <><Header eyebrow="CRM COMERCIAL" title="Minha Prospecção" text="Acompanhe cada oportunidade até o fechamento." action={<button className="primary" onClick={()=>notify("Selecione um lead nos resultados para adicioná-lo à prospecção.")}><Users size={16}/> Adicionar lead</button>}/>
 <div className="tabs">{stages.map(s=><button className={stage===s?"selected":""} onClick={()=>setStage(s)} key={s}>{s}</button>)}</div>
 <div className="kanban">{visible.map(({lead,currentStage})=><div className="deal" key={lead.id || lead.name}>
   <div className="deal-head"><span>{currentStage}</span><b>{lead.score}</b></div>
   <strong>{lead.name}</strong><small>Próxima ação: acompanhar a oportunidade</small>
   <select className="select" value={currentStage} onChange={e=>changeStage(lead.id,e.target.value)}>
     {stages.slice(1).map(s=><option key={s}>{s}</option>)}
   </select>
   <div><a className="deal-whatsapp" href={whatsappUrl(lead.phone, commercialMessage(lead.name))} target="_blank" rel="noopener noreferrer"><MessageCircle size={13}/> WhatsApp</a><button onClick={()=>notify("Abordagem IA gerada.")}><Sparkles size={13}/></button></div>
 </div>)}</div></>;
}
