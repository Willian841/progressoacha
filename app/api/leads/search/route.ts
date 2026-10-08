import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];
const MAX_QUERY_LENGTH = 120;
const MAX_SEGMENT_LENGTH = 60;
const MAX_CITY_LENGTH = 80;
const MAX_STATE_LENGTH = 2;
const CITY_BBOX_CACHE = new Map<string,string>();
const CITY_DISCOVERY_CACHE = new Map<string,string[]>();

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
  const ufMatch = normalized.match(/(?:,\s*|\s+)(ac|al|ap|am|ba|ce|df|es|go|ma|mt|ms|mg|pa|pb|pr|pe|pi|rj|rn|rs|ro|rr|sc|sp|se|to)\s*$/i);
  if (ufMatch) return ufMatch[1].toUpperCase();
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

function stateNameForCode(code:string) {
  const entry = Object.entries(STATE_NAMES).find(([, value]) => value === code);
  return entry?.[0] || "";
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
    const normalizedInferredCity = normalizeText(inferredCity);
    // Alguns nomes são simultaneamente estado e cidade. Em uma busca
    // natural como "restaurantes em São Paulo" ou "hotéis no Rio de Janeiro",
    // priorizamos a cidade; o usuário pode pedir o estado explicitamente
    // usando "estado de ...".
    const ambiguousStateCities = new Set(["sao paulo", "rio de janeiro"]);
    const cityLooksLikeState = inferredState &&
      Object.entries(STATE_NAMES).some(([name, code]) => code === inferredState && normalizeText(name) === normalizedInferredCity);
    const explicitStateRequest = /\bestado\s+(?:de|do|da)\s+/i.test(query);
    const city = ((cityLooksLikeState && !ambiguousStateCities.has(normalizedInferredCity) && !explicitStateRequest) ? "" : inferredCity).slice(0,MAX_CITY_LENGTH);
    const state = inferredState;
    if (!city && !query) return NextResponse.json({error:"Informe uma cidade ou termo de busca."},{status:400});
    const supabase = await createServerSupabaseClient();
    const {data:{user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error:"Não autenticado."},{status:401});

    // A lista de cidades é apenas descoberta de disponibilidade: não consome busca do plano.
    // Ela retorna somente municípios onde o OpenStreetMap possui estabelecimentos do segmento.
    if (String(body.mode || "") === "cities") {
      const cityState = String(body.state || "").trim().toUpperCase();
      const citySegment = String(body.segment || "").trim();
      const stateIsoForCities = STATE_ISO[cityState];
      if (!stateIsoForCities) return NextResponse.json({cities:[]});
      const cityFilter = tagFilter(citySegment);
      const cityCacheKey = `${cityState}:${normalizeText(citySegment)}`;
      const cachedCities = CITY_DISCOVERY_CACHE.get(cityCacheKey);
      if (cachedCities) return NextResponse.json({cities:cachedCities});
      const stateQuery =
        '[out:json][timeout:20];' +
        'area["ISO3166-2"="' + stateIsoForCities + '"]["boundary"="administrative"]["admin_level"="4"]->.stateArea;' +
        'nwr(area.stateArea)' + cityFilter + ';out center tags;';
      let cityJson:any = null;
      for (const endpoint of OVERPASS_URLS) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 16000);
          const response = await fetch(endpoint,{
            method:"POST",
            headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"ProgressoAcha/1.0"},
            body:new URLSearchParams({data:stateQuery}),
            cache:"no-store",
            signal:controller.signal
          });
          clearTimeout(timeout);
          if(response.ok){ cityJson=await response.json(); break; }
        } catch(error) {
          console.error("City discovery endpoint failed", endpoint, error);
        }
      }
      if(!cityJson) return NextResponse.json({cities:[],warning:"Não foi possível carregar as cidades agora."});
      const names = new Set<string>();
      for(const element of (Array.isArray(cityJson.elements) ? cityJson.elements : [])){
        const tags=element?.tags || {};
        const city=String(
          tags["addr:city"] ||
          tags["addr:municipality"] ||
          tags["addr:town"] ||
          tags["addr:village"] ||
          tags["addr:place"] ||
          tags["is_in:city"] ||
          tags["is_in:town"] ||
          tags["is_in:municipality"] ||
          ""
        ).trim();
        if(city) names.add(city);
      }
      const cities = Array.from(names).sort((a,b)=>a.localeCompare(b,"pt-BR"));
      CITY_DISCOVERY_CACHE.set(cityCacheKey,cities);
      return NextResponse.json({cities});
    }

    const {data:profile,error:profileError} = await supabase.from("profiles").select("plan_code").eq("id",user.id).maybeSingle();
    if(profileError) return NextResponse.json({error:"Não foi possível validar o plano."},{status:500});
    const {data:limits,error:limitsError} = await supabase.rpc("plan_limits",{p_plan:profile?.plan_code || "free"});
    if(limitsError || !limits?.[0]) return NextResponse.json({error:"Não foi possível validar os limites do plano."},{status:500});
    const companiesPerSearch = Number(limits[0].companies_per_search);
    const searchLimit = limits[0].search_limit == null ? null : Number(limits[0].search_limit);
    if(!Number.isFinite(companiesPerSearch) || companiesPerSearch < 1) return NextResponse.json({error:"Limite de empresas por busca inválido."},{status:500});
    const cityName = city;
    // Quando a cidade foi escolhida pela interface, ela tem prioridade absoluta.
    // Nunca reutilizamos resultados antigos de outro município.
    const requestedCity = normalizeText(cityName);

    // Para buscas por cidade, resolve primeiro a cidade para um bounding box
    // via Nominatim. Isso evita depender da combinação de relações/áreas
    // administrativas do Overpass, que varia entre municípios.
    let cityBbox: string | null = null;
    if (cityName) {
      const cityCacheKey = `${state}:${normalizeText(cityName)}`;
      cityBbox = CITY_BBOX_CACHE.get(cityCacheKey) || null;
      try {
        const geoParams = new URLSearchParams({
          city: cityName,
          state: stateNameForCode(state),
          country: "Brasil",
          format: "jsonv2",
          addressdetails: "1",
          limit: "5",
          countrycodes: "br"
        });
        const geoResponse = await fetch(
          "https://nominatim.openstreetmap.org/search?" + geoParams.toString(),
          {
            headers: { "User-Agent": "ProgressoAcha/1.0 (lead-search)" },
            cache: "no-store",
            signal: AbortSignal.timeout(6000)
          }
        );
        if (geoResponse.ok) {
          const geo = await geoResponse.json();
          const cityKey = normalizeText(cityName);
          const expectedState = normalizeText(stateNameForCode(state));
          const match = Array.isArray(geo) ? geo.find((item:any) => {
            const address = item?.address || {};
            const resolvedCity = normalizeText(address.city || address.town || address.municipality || item?.name || "");
            const resolvedState = normalizeText(address.state || "");
            const cityMatches = resolvedCity === cityKey || resolvedCity.includes(cityKey) || cityKey.includes(resolvedCity);
            const stateMatches = !expectedState || resolvedState === expectedState || resolvedState.includes(expectedState) || expectedState.includes(resolvedState);
            return cityMatches && stateMatches;
          }) : null;
          const box = match?.boundingbox;
          if (Array.isArray(box) && box.length === 4) {
            cityBbox = [box[0], box[2], box[1], box[3]].join(",");
            CITY_BBOX_CACHE.set(cityCacheKey, cityBbox);
          }
        }
      } catch (error) {
        console.error("Nominatim city lookup failed", error);
      }
    }
    // Busca por cidade é fail-closed: sem uma cidade validada pelo Nominatim,
    // nunca fazemos fallback para o estado/país, pois isso pode misturar municípios.
    if (cityName && !cityBbox) {
      return NextResponse.json(
        {error:"Não foi possível validar a cidade informada. A busca foi bloqueada para evitar resultados de outra cidade."},
        {status:422}
      );
    }

    const inferredTerm = !segment ? (query.match(/^(.*?)\s+(?:em|na|no|de)\s+/i)?.[1]?.trim() || (cityName ? query : "")) : "";
    const genericTerms = new Set(["empresa","empresas","negócio","negocios","negócios","comércio","comercio","lojas"]);
    const searchTerm = genericTerms.has(inferredTerm.toLowerCase()) ? "" : inferredTerm;
    const filter = tagFilter(segment, searchTerm);
    const stateIso = STATE_ISO[state];
    const stateName = Object.entries(STATE_NAMES).find(([,code]) => code === state)?.[0] || "";
    const stateScope = cityBbox
      ? ""
      : stateIso
        ? 'area["ISO3166-2"="' + stateIso + '"]["boundary"="administrative"]["admin_level"="4"]->.stateArea;'
        : 'area["ISO3166-1"="BR"]->.countryArea;';
    const searchScope = cityBbox
      ? ""
      : cityName
        ? (stateIso
            ? 'rel(area.stateArea)["boundary"="administrative"]["admin_level"~"6|7|8"]["name"~"^' + escapeRegex(cityName) + '$",i]->.cityRel;.cityRel map_to_area -> .searchArea;'
            : 'area["name"~"^' + escapeRegex(cityName) + '$",i]["boundary"="administrative"]["admin_level"~"6|7|8"]->.searchArea;')
        : (stateIso ? 'area.stateArea->.searchArea;' : 'area.countryArea->.searchArea;');
    const target = cityBbox
      ? "nwr(" + cityBbox + ")" + filter
      : "nwr(area.searchArea)" + filter;
    const q = "[out:json][timeout:15];" + stateScope + searchScope + target + ";out center tags;";

    let json:any = null;
    let lastStatus = 503;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 14000);
    try {
      const response = await Promise.any(OVERPASS_URLS.map(async endpoint => {
        const res = await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"ProgressoAcha/1.0"},body:new URLSearchParams({data:q}),cache:"no-store",signal:controller.signal});
        if (!res.ok) {
          lastStatus = res.status;
          throw new Error(`Overpass ${res.status}`);
        }
        return res;
      }));
      json = await response.json();
    } catch (e) {
      console.error("Overpass endpoints failed", e);
    } finally {
      clearTimeout(timeout);
    }
    if (!json) return NextResponse.json({error:"A fonte de dados está temporariamente indisponível. Tente novamente em alguns segundos."},{status:503});
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
      return {user_id:user.id,name:t.name || "Empresa sem nome",segment:category,country:"Brasil",state:t["addr:state"] || state || "",city:t["addr:city"] || city || "",area:t["addr:suburb"] || "",address,phone,website,website_status:website ? "found" : "not_found",opportunity_score:score,source:"openstreetmap",source_id:String(e.id),latitude:lat,longitude:lon};
    }).filter((r:any)=>{
      if (!r.name || r.name === "Empresa sem nome") return false;
      // Em consultas por cidade, coordenadas são obrigatórias e precisam estar
      // dentro do bbox da cidade validada. Sem isso, o lead é descartado.
      if (city && cityBbox) {
        if (r.latitude == null || r.longitude == null) return false;
        const [south, west, north, east] = cityBbox.split(",").map(Number);
        if (!(r.latitude >= south && r.latitude <= north && r.longitude >= west && r.longitude <= east)) return false;
        const expectedCity = requestedCity;
        const returnedCity = normalizeText(r.city);
        // OSM nem sempre preenche addr:city. As coordenadas dentro do bbox
        // são a autoridade para a busca; quando addr:city existir, ele também
        // precisa bater com a cidade solicitada.
        if (returnedCity && !returnedCity.includes(expectedCity) && !expectedCity.includes(returnedCity)) return false;
      }
      return true;
    }).slice(0,companiesPerSearch);

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