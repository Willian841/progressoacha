import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../lib/supabase-server";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function escapeRegex(value:string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function tagFilter(segment:string) {
  const s = segment.toLowerCase().trim();
  const map:Record<string,string> = {
    restaurante:'["amenity"="restaurant"]', restaurantes:'["amenity"="restaurant"]', pizzaria:'["amenity"="restaurant"]',
    academia:'["leisure"="fitness_centre"]', advogado:'["office"="lawyer"]', advocacia:'["office"="lawyer"]',
    dentista:'["amenity"="dentist"]', clínica:'["amenity"="clinic"]', clinica:'["amenity"="clinic"]',
    hotel:'["tourism"="hotel"]', hotéis:'["tourism"="hotel"]', hotelaria:'["tourism"="hotel"]',
    loja:'["shop"]', comércio:'["shop"]', comercio:'["shop"]', mercado:'["shop"="supermarket"]',
    farmácia:'["amenity"="pharmacy"]', farmacia:'["amenity"="pharmacy"]', salão:'["shop"="hairdresser"]', salao:'["shop"="hairdresser"]'
  };
  return map[s] || "";
}

export async function POST(request:Request) {
  try {
    const body = await request.json();
    const segment = String(body.segment || "").trim();
    const city = String(body.city || "").trim();
    const state = String(body.state || "").trim().toUpperCase();
    const query = String(body.query || "").trim();
    if (!city && !query) return NextResponse.json({error:"Informe uma cidade ou termo de busca."},{status:400});
    const supabase = await createServerSupabaseClient();
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error:"Não autenticado."},{status:401});
    const {data:profile} = await supabase.from("profiles").select("plan_code").eq("id",user.id).maybeSingle();
    const plan = profile?.plan_code || "free";
    const {data:limits} = await supabase.rpc("plan_limits",{p_plan:plan});
    const limit = limits?.[0]?.search_limit ?? 3;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const {data:usage} = await supabase.from("usage_monthly").select("search_count").eq("user_id",user.id).eq("month_start",monthStart.toISOString().slice(0,10)).maybeSingle();
    const used = usage?.search_count || 0;
    if (limit !== null && used >= limit) return NextResponse.json({error:"Limite do plano atingido.",plan_code:plan,used,limit},{status:402});
    const cityName = city || query;
    const areaRegex = escapeRegex(cityName);
    const filter = tagFilter(segment);
    const q = `[out:json][timeout:25]; area["name"~"^${areaRegex}$",i]["boundary"="administrative"]->.searchArea; nwr(area.searchArea)${filter}; out center tags;`;
    const response = await fetch(OVERPASS_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"ProgressoAcha/0.1 (lead prospecting app)"},body:new URLSearchParams({data:q}),cache:"no-store"});
    if(!response.ok) return NextResponse.json({error:"A fonte de dados está temporariamente indisponível."},{status:503});
    const json = await response.json();
    const elements = Array.isArray(json.elements) ? json.elements : [];
    const rows = elements.map((e:any)=>{
      const t=e.tags||{}; const lat=e.lat ?? e.center?.lat ?? null; const lon=e.lon ?? e.center?.lon ?? null;
      const address=[t["addr:street"],t["addr:housenumber"],t["addr:suburb"]].filter(Boolean).join(", ");
      const phone=t.phone || t["contact:phone"] || ""; const website=t.website || t["contact:website"] || "";
      const category=segment || t.amenity || t.shop || t.office || t.tourism || "Outros";
      return {user_id:user.id,name:t.name || "Empresa sem nome",segment:category,country:"Brasil",state:state || t["addr:state"] || "",city:city || t["addr:city"] || cityName,area:t["addr:suburb"] || "",address,phone,website,website_status:website ? "found" : "not_found",opportunity_score:website ? 72 : 88,source:"openstreetmap",source_id:String(e.id),latitude:lat,longitude:lon};
    }).filter((r:any)=>r.name && r.name !== "Empresa sem nome").slice(0,100);
    if(rows.length) await supabase.from("leads").upsert(rows,{onConflict:"user_id,source,source_id"});
    const {data:usageResult,error:usageError} = await supabase.rpc("consume_search",{p_segment:segment||null,p_country:"Brasil",p_state:state||null,p_city:city||cityName,p_area:null,p_filters:{query,source:"openstreetmap"},p_result_count:rows.length});
    if(usageError || !usageResult?.[0]?.allowed) return NextResponse.json({error:"Não foi possível registrar o uso da busca."},{status:400});
    return NextResponse.json({leads:rows,usage:usageResult[0]});
  } catch(error) { console.error(error); return NextResponse.json({error:"Erro ao realizar a busca."},{status:500}); }
}