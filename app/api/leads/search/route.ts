import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

function escapeRegex(value:string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function inferSegment(query:string) {
  const q = query.toLowerCase();
  if (/(restaurante|restaurantes|pizzaria)/.test(q)) return "restaurante";
  if (/(lanchonete|fast[ -]?food)/.test(q)) return "lanchonete";
  if (/\bbar\b/.test(q)) return "bar";
  if (/(academia|fitness)/.test(q)) return "academia";
  if (/(advogado|advocacia)/.test(q)) return "advocacia";
  if (/dentista/.test(q)) return "dentista";
  if (/(cl[ií]nica|clinica)/.test(q)) return "clinica";
  if (/(hotel|hot[eé]is)/.test(q)) return "hotel";
  if (/(farm[aá]cia|farmacia)/.test(q)) return "farmacia";
  if (/(sal[aã]o|salao|cabeleireiro)/.test(q)) return "salao";
  if (/(mercado|supermercado)/.test(q)) return "mercado";
  if (/(loja|com[eé]rcio|comercio)/.test(q)) return "loja";
  return "";
}

function inferCity(query:string) {
  const match = query.match(/(?:\bem\s+|\bna\s+|\bno\s+)([^,]+?)(?:\s*,\s*[A-Za-z]{2})?$/i);
  return match?.[1]?.trim() || "";
}

function tagFilter(segment:string, searchTerm="") {
  const s = segment.toLowerCase().trim();
  const map:Record<string,string> = {
    restaurante:'["amenity"~"restaurant|fast_food"]', restaurantes:'["amenity"~"restaurant|fast_food"]', pizzaria:'["amenity"="restaurant"]', lanchonete:'["amenity"="fast_food"]', bar:'["amenity"="bar"]',
    academia:'["leisure"="fitness_centre"]', advogado:'["office"="lawyer"]', advocacia:'["office"="lawyer"]',
    dentista:'["amenity"="dentist"]', clínica:'["amenity"="clinic"]', clinica:'["amenity"="clinic"]',
    hotel:'["tourism"="hotel"]', hotéis:'["tourism"="hotel"]', hotelaria:'["tourism"="hotel"]',
    loja:'["shop"]', comércio:'["shop"]', comercio:'["shop"]', mercado:'["shop"="supermarket"]',
    farmácia:'["amenity"="pharmacy"]', farmacia:'["amenity"="pharmacy"]', salão:'["shop"="hairdresser"]', salao:'["shop"="hairdresser"]'
  };
  if (map[s]) return map[s];
  return searchTerm ? `["name"~"${escapeRegex(searchTerm)}",i]` : '["name"]';
}

const STATE_ISO:Record<string,string> = {
  AC:"BR-AC", AL:"BR-AL", AP:"BR-AP", AM:"BR-AM", BA:"BR-BA", CE:"BR-CE", DF:"BR-DF", ES:"BR-ES",
  GO:"BR-GO", MA:"BR-MA", MT:"BR-MT", MS:"BR-MS", MG:"BR-MG", PA:"BR-PA", PB:"BR-PB", PR:"BR-PR",
  PE:"BR-PE", PI:"BR-PI", RJ:"BR-RJ", RN:"BR-RN", RS:"BR-RS", RO:"BR-RO", RR:"BR-RR", SC:"BR-SC",
  SP:"BR-SP", SE:"BR-SE", TO:"BR-TO"
};

export async function POST(request:Request) {
  try {
    const body = await request.json();
    const query = String(body.query || "").trim();
    const segment = String(body.segment || "").trim() || inferSegment(query);
    const city = String(body.city || "").trim() || inferCity(query);
    const state = String(body.state || "").trim().toUpperCase();
    if (!city && !query) return NextResponse.json({error:"Informe uma cidade ou termo de busca."},{status:400});
    const supabase = await createServerSupabaseClient();
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error:"Não autenticado."},{status:401});

    const cityName = city || query;
    const areaRegex = escapeRegex(cityName);
    const inferredTerm = !segment ? (query.match(/^(.*?)\s+(?:em|na|no)\s+/i)?.[1]?.trim() || "") : "";
    const genericTerms = new Set(["empresa","empresas","negócio","negocios","negócios","comércio","comercio","lojas"]);
    const searchTerm = genericTerms.has(inferredTerm.toLowerCase()) ? "" : inferredTerm;
    const filter = tagFilter(segment, searchTerm);
    const stateIso = STATE_ISO[state];
    const stateScope = stateIso ? 'area["ISO3166-2"="' + stateIso + '"]->.stateArea;' : 'area["ISO3166-1"="BR"]->.countryArea;';
    const cityScope = stateIso
      ? 'area["name"~"^' + areaRegex + '$",i]["boundary"="administrative"]["admin_level"~"6|7|8"](area.stateArea)->.searchArea;'
      : 'area["name"~"^' + areaRegex + '$",i]["boundary"="administrative"]["admin_level"~"6|7|8"](area.countryArea)->.searchArea;';
    const q = "[out:json][timeout:25];" + stateScope + cityScope + "nwr(area.searchArea)" + filter + ";out center tags;";

    const response = await fetch(OVERPASS_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"ProgressoAcha/0.1 (lead prospecting app)"},body:new URLSearchParams({data:q}),cache:"no-store"});
    if(!response.ok) return NextResponse.json({error:"A fonte de dados está temporariamente indisponível."},{status:503});
    const json = await response.json();
    const elements = Array.isArray(json.elements) ? json.elements : [];
    const rows = elements.map((e:any)=>{
      const t=e.tags||{}; const lat=e.lat ?? e.center?.lat ?? null; const lon=e.lon ?? e.center?.lon ?? null;
      const address=[t["addr:street"],t["addr:housenumber"],t["addr:suburb"]].filter(Boolean).join(", ");
      const phone=t.phone || t["contact:phone"] || ""; const website=t.website || t["contact:website"] || "";
      const category=segment || t.amenity || t.shop || t.office || t.tourism || "Outros";
      const hasPhone = Boolean(phone);
      const hasAddress = Boolean(address);
      const hasArea = Boolean(t["addr:suburb"]);
      const score = Math.min(100, 45 + (website ? 0 : 25) + (hasPhone ? 10 : 0) + (hasAddress ? 8 : 0) + (hasArea ? 4 : 0));
      return {user_id:user.id,name:t.name || "Empresa sem nome",segment:category,country:"Brasil",state:state || t["addr:state"] || "",city:city || t["addr:city"] || cityName,area:t["addr:suburb"] || "",address,phone,website,website_status:website ? "found" : "not_found",opportunity_score:score,source:"openstreetmap",source_id:String(e.id),latitude:lat,longitude:lon};
    }).filter((r:any)=>r.name && r.name !== "Empresa sem nome").slice(0,100);

    const {data:usageResult,error:usageError} = await supabase.rpc("consume_search",{p_segment:segment||undefined,p_country:"Brasil",p_state:state||undefined,p_city:city||cityName,p_area:undefined,p_filters:{query,source:"openstreetmap"},p_result_count:rows.length});
    if(usageError || !usageResult?.[0]?.allowed) return NextResponse.json({error:"Limite do plano atingido ou não foi possível registrar o uso."},{status:402});
    let savedRows=rows;
    if(rows.length) {
      const {data:upsertedRows,error:upsertError} = await supabase.from("leads").upsert(rows,{onConflict:"user_id,source,source_id"}).select("*");
      if(upsertError) return NextResponse.json({error:"A busca foi registrada, mas não foi possível salvar os leads."},{status:500});
      savedRows=upsertedRows || [];
    }
    return NextResponse.json({leads:savedRows,usage:usageResult[0]});
  } catch(error) { console.error(error); return NextResponse.json({error:"Erro ao realizar a busca."},{status:500}); }
}