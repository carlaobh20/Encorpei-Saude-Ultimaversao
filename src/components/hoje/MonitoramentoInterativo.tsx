import { useState } from "react";
import { Link } from "react-router-dom";
import { useBloodPressure, useHeartRate, useWeight, useSpo2, useSleep, useActivity, useGlucose } from "@/hooks/useCardioReadings";
import type { ClinicalReadingBase } from "@/types/cardio";
import { rotuloProveniencia } from "@/lib/wearable/normalize";
import { numero, quandoLegivel } from "@/lib/formato";

type Linha = { leitura: ClinicalReadingBase; valor: string; data?: string };
export function MonitoramentoInterativo({ patientId, onRegistrar }: { patientId?: string; onRegistrar?: () => void }) {
  const [origem, setOrigem] = useState("todos");
  const bp = useBloodPressure(patientId), hr = useHeartRate(patientId), peso = useWeight(patientId);
  const spo = useSpo2(patientId), sono = useSleep(patientId), atividade = useActivity(patientId), glicose = useGlucose(patientId);
  const grupos = [
    { nome: "Pressão", rota: "/pressao", query: bp, linhas: bp.readings.map(leitura => ({ leitura, valor: `${leitura.systolic}/${leitura.diastolic} mmHg` })) },
    { nome: "Batimentos", rota: "/pressao", query: hr, linhas: hr.readings.map(leitura => ({ leitura, valor: `${leitura.bpm} bpm` })) },
    { nome: "Peso", rota: "/peso", query: peso, linhas: peso.readings.map(leitura => ({ leitura, valor: `${numero(Number(leitura.value), 1)} kg` })) },
    { nome: "Oxigenação", rota: "/pulseira", query: spo, linhas: spo.readings.map(leitura => ({ leitura, valor: `${leitura.value}%` })) },
    { nome: "Sono", rota: "/sono", query: sono, linhas: sono.records.map(leitura => ({ leitura, valor: `${Math.floor(leitura.total_minutes / 60)}h ${leitura.total_minutes % 60}min`, data: leitura.sleep_date })) },
    { nome: "Passos", rota: "/atividade", query: atividade, linhas: atividade.records.map(leitura => ({ leitura, valor: leitura.steps == null ? "Não informado" : `${numero(leitura.steps, 0)} passos`, data: leitura.activity_date })) },
    { nome: "Glicemia", rota: "/glicemia", query: glicose, linhas: glicose.readings.map(leitura => ({ leitura, valor: `${leitura.value} mg/dL` })) },
  ];
  const data = (linha: Linha) => linha.data ? linha.data.split("-").reverse().join("/") : quandoLegivel(linha.leitura.recorded_at);
  const fonte = (linha: Linha) => rotuloProveniencia(linha.leitura.source_type, linha.leitura.validation_status, linha.leitura.source_device_name).label;
  return <section aria-label="Medidas e histórico" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold">{patientId ? "Medidas do paciente" : "Meus dados de saúde"}</h2>
      {onRegistrar && <button onClick={onRegistrar} className="min-h-[48px] rounded-xl bg-primary text-primary-foreground px-4 font-medium">+ Registrar dado</button>}
    </div>
    <p className="text-sm text-muted-foreground">Toque no card para ver os registros. Dados exibidos com a data e a origem da medida.</p>
    <div role="group" aria-label="Origem das medidas" className="flex flex-wrap gap-2">
      {[["todos", "Todos"], ["device", "Aparelhos"], ["manual", "Manuais"]].map(([valor, nome]) => <button key={valor} aria-pressed={origem === valor} onClick={() => setOrigem(valor)} className={`min-h-[48px] rounded-xl border px-4 ${origem === valor ? "bg-primary text-primary-foreground" : "bg-card"}`}>{nome}</button>)}
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
      {grupos.map(grupo => {
        const linhas: Linha[] = grupo.linhas.filter(l => origem === "todos" || l.leitura.source_type === origem);
        const ultima = linhas[0];
        return <details key={grupo.nome} className="rounded-xl border bg-card p-4 group">
          <summary className="cursor-pointer min-h-[48px] rounded-lg focus-visible:outline focus-visible:outline-2">
            <span className="font-medium">{grupo.nome}</span>
            <strong className="block text-2xl mt-1 tabular-nums">{grupo.query.isLoading ? "Carregando…" : grupo.query.isError ? "Falha ao carregar" : ultima?.valor ?? "Sem registro"}</strong>
            {!grupo.query.isError && ultima && <span className="block text-sm text-muted-foreground mt-1">{data(ultima)} · {fonte(ultima)}</span>}
            <span className="block text-sm mt-2 underline group-open:hidden">Ver registros</span>
          </summary>
          <div className="mt-3 border-t pt-3 space-y-3">
            {grupo.query.isError ? <button className="min-h-[48px] underline" onClick={() => void grupo.query.refetch()}>Tentar novamente</button> : <>
              <p className="text-sm text-muted-foreground">Últimos {Math.min(linhas.length, 7)} registros disponíveis neste filtro.</p>
              {linhas.slice(0, 7).map(l => <div key={l.leitura.id} className="border-b pb-2 text-sm"><strong>{l.valor}</strong><p>{data(l)} · {fonte(l)}</p><p className="text-muted-foreground">Estado: {({ validated: "validado", estimated: "estimativa", suspect: "suspeito", pending: "aguarda revisão", rejected: "descartado" })[l.leitura.validation_status]}</p></div>)}
              {grupo.query.cobertura.truncado && <p className="text-sm text-warning-forte">Histórico parcial: o limite de registros foi atingido.</p>}
            </>}
            {!patientId && <Link className="inline-flex min-h-[48px] items-center underline font-medium" to={grupo.rota}>Abrir {grupo.nome.toLowerCase()}</Link>}
          </div>
        </details>;
      })}
    </div>
    <p className="text-sm text-muted-foreground">Estimativas da pulseira não equivalem a medidas clínicas validadas. O acompanhamento depende do plano combinado com o médico.</p>
    {!patientId && <div className="flex flex-wrap gap-2">{[["/pulseira", "Conectar / sincronizar pulseira"], ["/sintomas", "Registrar sintomas"], ["/remedios", "Meus remédios"], ["/exames", "Adicionar exame"]].map(([rota, nome]) => <Link key={rota} to={rota} className="inline-flex items-center min-h-[48px] rounded-xl border bg-card px-3 text-sm font-medium">{nome}</Link>)}</div>}
  </section>;
}
