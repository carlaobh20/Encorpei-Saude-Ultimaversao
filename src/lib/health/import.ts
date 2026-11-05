import type { LinhaImportada } from "../wearable/importer";

export type Plataforma = "apple_health" | "health_connect";
export type TipoSaude = "heart_rate" | "spo2" | "steps" | "active_calories" | "sleep";
export interface AmostraSaude {
  type: TipoSaude; source: string; start: string; end: string; value: number; unit: string;
}
export interface PreviaSaude { samples: AmostraSaude[]; ignored: number; sources: string[] }
const tipos = new Set(["heart_rate", "spo2", "steps", "active_calories", "sleep"]);
const data = (v: unknown): string => {
  if (typeof v !== "string" || !/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d+)?\s*(?:Z|[+-]\d\d:?\d\d)$/.test(v)) throw Error("Data sem fuso horário.");
  const iso = v.replace(/^(\d{4}-\d\d-\d\d) /, "$1T").replace(/ ([+-]\d{2})(\d{2})$/, "$1:$2");
  if (!Number.isFinite(Date.parse(iso))) throw Error("Data inválida.");
  return iso;
};
export function validarAmostra(input: unknown): AmostraSaude {
  const a = input as AmostraSaude;
  if (!a || !tipos.has(a.type) || typeof a.source !== "string" || !a.source.trim() || a.source.length > 160) throw Error("Tipo ou origem inválidos.");
  const start = data(a.start), end = data(a.end);
  if (Date.parse(end) < Date.parse(start) || Date.parse(end) > Date.now() + 300000) throw Error("Período inválido ou futuro.");
  if (typeof a.value !== "number" || !Number.isFinite(a.value)) throw Error("Valor inválido.");
  const limites = { heart_rate: [20,260,"bpm"], spo2: [50,100,"%"], steps: [0,200000,"count"], active_calories: [0,20000,"kcal"], sleep: [0,1,"asleep"] } as const;
  const [min,max,unit] = limites[a.type];
  if (a.unit !== unit || a.value < min || a.value > max || (a.type === "steps" && !Number.isInteger(a.value))) throw Error("Unidade ou faixa não suportada.");
  if (a.type === "sleep" && (a.value !== 1 || Date.parse(end) <= Date.parse(start) || Date.parse(end)-Date.parse(start)>86400000)) throw Error("Intervalo de sono inválido.");
  return { type:a.type, source:a.source.trim(), start, end, value:a.value, unit };
}
export function previaDeAmostras(values: unknown[]): PreviaSaude {
  if (!Array.isArray(values) || values.length > 100000) throw Error("Limite de 100 mil amostras por arquivo.");
  const samples: AmostraSaude[] = []; let ignored = 0; const vistos = new Set<string>();
  for (const value of values) {
    try {
      const a = validarAmostra(value);
      const key = JSON.stringify([a.type,a.source,Date.parse(a.start),Date.parse(a.end),a.value]);
      if (vistos.has(key)) { ignored++; continue; }
      vistos.add(key); samples.push(a);
    } catch { ignored++; }
  }
  return { samples, ignored, sources:[...new Set(samples.map(a=>a.source))].sort() };
}
export function importarContrato(text: string): PreviaSaude {
  const obj = JSON.parse(text);
  if (obj?.schema !== "encorpei.health.v1" || obj?.platform !== "health_connect" || !Array.isArray(obj.samples)) throw Error("Use o formato de integração encorpei.health.v1. O backup do Health Connect não é este formato.");
  return previaDeAmostras(obj.samples);
}

/** Adapta atributos do XML oficial; tipos e unidades desconhecidos são descartados. */
export function adaptarRegistroApple(a: Record<string,string>): unknown {
  const types: Record<string,TipoSaude> = {
    HKQuantityTypeIdentifierHeartRate:"heart_rate", HKQuantityTypeIdentifierOxygenSaturation:"spo2",
    HKQuantityTypeIdentifierStepCount:"steps", HKQuantityTypeIdentifierActiveEnergyBurned:"active_calories",
    HKCategoryTypeIdentifierSleepAnalysis:"sleep",
  };
  const type = types[a.type]; if (!type) return null;
  let value = Number(a.value), unit = a.unit;
  if (type === "heart_rate" && unit === "count/min") unit = "bpm";
  if (type === "spo2" && unit === "%" && value <= 1) value *= 100;
  if (type === "active_calories" && unit === "kJ") { value /= 4.184; unit="kcal"; }
  if (type === "sleep") {
    if (!["HKCategoryValueSleepAnalysisAsleep","HKCategoryValueSleepAnalysisAsleepUnspecified","HKCategoryValueSleepAnalysisAsleepCore","HKCategoryValueSleepAnalysisAsleepDeep","HKCategoryValueSleepAnalysisAsleepREM"].includes(a.value)) return null;
    unit="asleep"; value=1;
  }
  return { type,source:a.sourceName,start:a.startDate,end:a.endDate,value,unit };
}
export function importarAppleXml(text: string): PreviaSaude {
  if (/<!ENTITY/i.test(text)) throw Error("XML com entidades personalizadas não é aceito.");
  const xml = new DOMParser().parseFromString(text,"application/xml");
  if (xml.querySelector("parsererror") || xml.documentElement.tagName !== "HealthData") throw Error("Selecione o export.xml do Apple Saúde.");
  const records = Array.from(xml.getElementsByTagName("Record"));
  if (records.length>100000) throw Error("Arquivo acima de 100 mil registros. Use uma exportação menor.");
  return previaDeAmostras(records.map(r=>adaptarRegistroApple(Object.fromEntries(Array.from(r.attributes).map(a=>[a.name,a.value])))));
}

/** Seleção explícita de UMA origem evita somar passos do relógio e celular. */
export function prepararLinhas(preview: PreviaSaude, source: string, desde: string, ate: string, hoje = new Date().toISOString().slice(0,10)) {
  const linhas: LinhaImportada[]=[]; let ignored=0;
  const dias = new Map<string,{steps:AmostraSaude[]; active_calories:AmostraSaude[]; sleep:AmostraSaude[]}>();
  for (const a of preview.samples) {
    if (a.source!==source) continue;
    const dia=(a.type === "sleep" ? a.end : a.start).slice(0,10);
    if (dia<desde||dia>ate) continue;
    if (a.type === "heart_rate" || a.type === "spo2") {
      linhas.push({recordedAt:new Date(a.start).toISOString(),validation:"estimated",...(a.type==="heart_rate"?{heartRate:Math.round(a.value)}:{spo2:Math.round(a.value)})}); continue;
    }
    // Totais diários ainda abertos não entram como se fossem o total final.
    if (dia>=hoje || (a.type!=="sleep" && a.start.slice(0,10)!==a.end.slice(0,10))) { ignored++; continue; }
    if (!dias.has(dia)) dias.set(dia,{steps:[],active_calories:[],sleep:[]});
    dias.get(dia)![a.type].push(a);
  }
  for (const [dia,group] of dias) {
    const row: LinhaImportada={recordedAt:`${dia}T12:00:00.000Z`,validation:"estimated"};
    for (const kind of ["steps","active_calories"] as const) {
      const arr=group[kind].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
      if (!arr.length) continue;
      if (arr.some((a,i)=>i>0 && Date.parse(a.start)<Date.parse(arr[i-1].end))) { ignored+=arr.length; continue; }
      const total = Math.round(arr.reduce((n,a)=>n+a.value,0));
      if (total > (kind === "steps" ? 200000 : 20000)) { ignored+=arr.length; continue; }
      row[kind==="steps"?"steps":"calories"]=total;
    }
    // Une intervalos sobrepostos de sono, sem contar estágios duas vezes.
    let total=0, start=0, end=0;
    for (const a of group.sleep.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))) {
      const x=Date.parse(a.start),y=Date.parse(a.end);
      if (!end) {start=x;end=y;} else if(x<=end) end=Math.max(end,y); else {total+=end-start;start=x;end=y;}
    }
    if (end) { const mins=Math.round((total+end-start)/60000); if(mins>0&&mins<=1440) row.sleepMinutes=mins; else ignored+=group.sleep.length; }
    if (row.steps!=null||row.calories!=null||row.sleepMinutes!=null) linhas.push(row);
  }
  return {linhas,ignored};
}
