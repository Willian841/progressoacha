import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];
const MAX_QUERY_LENGTH = 120;
const MAX_SEGMENT_LENGTH = 60;
const MAX_CITY_LENGTH = 80;
const MAX_STATE_LENGTH = 2;

const STATE_NAMES: Record<string, string> = {
  acre:"AC", alagoas:"AL", amapá:"AP", amapa:"AP", amazonas:"AM", bahia:"BA",
  ceará:"CE", ceara:"CE", "distrito federal":"DF", "espírito santo":"ES", "espirito santo":"ES",
  goiás:"GO", goias:"GO", maranhão:"MA", maranhao:"MA", "mato grosso":"MT",
  "mato grosso do sul":"MS", "minas gerais":"MG", pará:"PA", para:"PA", paraíba:"PB",
  paraiba:"PB", paraná:"PR", parana:"PR", pernambuco:"PE", piauí:"PI", piaui:"PI",
  "rio de janeiro":"RJ", "rio grande do norte":"RN", "rio grande do sul":"RS",
  rondônia:"RO", rondonia:"RO", roraima:"RR", "santa catarina":"SC",
  "são paulo":"SP", "sao paulo":"SP", sergipe:"SE", tocantins:"TO"
};

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

function inferState(query:string) {
  const normalized = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    const n = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (new RegExp("(?:\\bem|\\bna|\\bno|\\bdo|\\bda|\\bde)\\s+" + escapeRegex(n) + "\\b", "i").test(normalized)) return code;
  }
  return "";
}
function inferCity(query:string) {
  const match = query.match(/(?:\bem\s+|\bna\s+|\bno\s+)([^,]+?)(?:\s*,\s*[A-Za-z]{2})?$/i);
  return match?.[1]?.trim() || "";
}

function normalizeText(value:string) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
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
    const query = String(body.query || "").trim().slice(0,MAX_QUERY_LENGTH);
    const segment = (String(body.segment || "").trim() || inferSegment(query)).slice(0,MAX_SEGMENT_LENGTH);
    const inferredState = (String(body.state || "").trim().toUpperCase() || inferState(query)).slice(0,MAX_STATE_LENGTH);
    const inferredCity = String(body.city || "").trim() || inferCity(query);
    const city = (inferredState && Object.entries(STATE_NAMES).some(([name, code]) => code === inferredState && normalizeText(name) === normalizeText(inferredCity)) ? "" : inferredCity).slice(0,MAX_CITY_LENGTH);
    const state = inferredState;
    if (!city && !query) return NextResponse.json({error:"Informe uma cidade ou termo de busca."},{status:400});
    const supabase = await createServerSupabaseClient();
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error:"Não autenticado."},{status:401});

    const {data:profile,error:profileError} = await supabase.from("profiles").select("plan_code").eq("id",user.id).maybeSingle();
    if(profileError) return NextResponse.json({error:"Não foi possível validar o plano."},{status:500});
    const {data:limits,error:limitsError} = await supabase.rpc("plan_limits",{p_plan:profile?.plan_code || "free"});
    if(limitsError || !limits?.[0]) return NextResponse.json({error:"Não foi possível validar os limites do plano."},{status:500});
    const companiesPerSearch = Number(limits[0].companies_per_search);
    const searchLimit = limits[0].search_limit == null ? null : Number(limits[0].search_limit);
    if(!Number.isFinite(companiesPerSearch) || companiesPerSearch < 1) return NextResponse.json({error:"Limite de empresas por busca inválido."},{status:500});
    if(searchLimit !== null) {
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0,0,0,0);
      const {data:usageRow,error:usageReadError} = await supabase.from("usage_monthly").select("search_count").eq("user_id",user.id).eq("month_start",monthStart.toISOString().slice(0,10)).maybeSingle();
      if(usageReadError) return NextResponse.json({error:"Não foi possível verificar o uso do plano."},{status:500});
      if(Number(usageRow?.search_count || 0) >= searchLimit) return NextResponse.json({error:`Seu plano atingiu o limite de ${searchLimit} buscas neste período. Faça upgrade para continuar.`},{status:402});
    }

    const cityName = city;
    const inferredTerm = !segment ? (query.match(/^(.*?)\s+(?:em|na|no)\s+/i)?.[1]?.trim() || (cityName ? query : "")) : "";
    const genericTerms = new Set(["empresa","empresas","negócio","negocios","negócios","comércio","comercio","lojas"]);
    const searchTerm = genericTerms.has(inferredTerm.toLowerCase()) ? "" : inferredTerm;
    const filter = tagFilter(segment, searchTerm);
    const stateIso = STATE_ISO[state];
    const stateName = Object.entries(STATE_NAMES).find(([,code]) => code === state)?.[0] || "";
    const stateScope = stateIso
      ? 'area["ISO3166-2"="' + stateIso + '"]["boundary"="administrative"]["admin_level"="4"]->.stateArea;'
      : 'area["ISO3166-1"="BR"]->.countryArea;';
    const searchScope = cityName
      ? (stateIso
          ? 'rel(area.stateArea)["boundary"="administrative"]["admin_level"~"6|7|8"]["name"~"^' + escapeRegex(cityName) + '$",i]->.cityRel;.cityRel map_to_area -> .searchArea;'
          : 'area["name"~"^' + escapeRegex(cityName) + '$",i]["boundary"="administrative"]["admin_level"~"6|7|8"]->.searchArea;')
      : (stateIso ? 'area.stateArea->.searchArea;' : 'area.countryArea->.searchArea;');
    const q = "[out:json][timeout:20];" + stateScope + searchScope + "nwr(area.searchArea)" + filter + ";out center tags;";

    let json:any = null;
    let lastStatus = 503;
    for (const endpoint of OVERPASS_URLS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 23000);
        const response = await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"ProgressoAcha/1.0"},body:new URLSearchParams({data:q}),cache:"no-store",signal:controller.signal});
        clearTimeout(timeout);
        lastStatus = response.status;
        if (response.ok) {
          json = await response.json();
          break;
        }
        if (![429,503,504].includes(response.status)) break;
      } catch (e) {
        console.error("Overpass endpoint failed", endpoint, e);
      }
    }
    if (!json) return NextResponse.json({error:"A fonte de dados está temporariamente indisponível. Tente novamente em alguns segundos."},{status:lastStatus >= 500 ? 503 : 503});
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
      return {user_id:user.id,name:t.name || "Empresa sem nome",segment:category,country:"Brasil",state:state || t["addr:state"] || "",city:city || t["addr:city"] || "",area:t["addr:suburb"] || "",address,phone,website,website_status:website ? "found" : "not_found",opportunity_score:score,source:"openstreetmap",source_id:String(e.id),latitude:lat,longitude:lon};
    }).filter((r:any)=>r.name && r.name !== "Empresa sem nome").slice(0,companiesPerSearch);

    const {data:usageResult,error:usageError} = await supabase.rpc("consume_search",{p_segment:segment||undefined,p_country:"Brasil",p_state:state||undefined,p_city:city||cityName,p_area:undefined,p_filters:{query,source:"openstreetmap"},p_result_count:rows.length});
    if(usageError) {
      console.error("consume_search failed", usageError);
      return NextResponse.json({error:"Não foi possível registrar o uso da busca. Tente novamente."},{status:500});
    }
    if(!usageResult?.[0]?.allowed) {
      const limit = usageResult?.[0]?.usage_limit == null ? null : Number(usageResult[0].usage_limit);
      return NextResponse.json({error:limit == null ? "A busca não foi autorizada pelo plano atual." : `Seu plano atingiu o limite de ${limit} buscas neste período. Faça upgrade para continuar.`},{status:402});
    }
    let savedRows=rows;
    if(rows.length) {
      const {data:upsertedRows,error:upsertError} = await supabase.from("leads").upsert(rows,{onConflict:"user_id,source,source_id"}).select("*");
      if(upsertError) return NextResponse.json({error:"A busca foi registrada, mas não foi possível salvar os leads."},{status:500});
      savedRows=upsertedRows || [];
    }
    return NextResponse.json({leads:savedRows,usage:usageResult[0]});
  } catch(error) { console.error(error); return NextResponse.json({error:"Erro ao realizar a busca."},{status:500}); }
}