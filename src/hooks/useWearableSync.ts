/**
 * useWearableSync — a ponte entre a pulseira e o banco.
 *
 * Existe porque, até aqui, a tela da pulseira mostrava batimento ao vivo e não
 * gravava nada. O paciente via o número subir, achava que estava "enviando para
 * o médico", e o painel do médico continuava vazio. Ver FC ao vivo não é
 * sincronizar; sincronizar é ter linha em `hr_readings` com proveniência.
 *
 * O que este hook concentra:
 *
 *  - **registro do aparelho** em `registered_devices` (uma linha por paciente +
 *    aparelho), com firmware e `last_sync_at` — é o que a tela usa para dizer
 *    "última sincronização bem-sucedida";
 *  - **gravação da sessão ao vivo** com throttle de 1 amostra/minuto;
 *  - **importação de arquivo** em lotes, com deduplicação contra o que já está
 *    no banco;
 *  - **modo demo**: nada, em hipótese alguma, é gravado (`getDevBypass()`).
 *
 * Por que não passa pelos hooks de `useCardioReadings`: o `registrar` de lá
 * escreve uma linha por chamada e só aceita um punhado de campos (não aceita
 * `source_type`, `source_device_id`, `validation_status`). Importar 4 mil
 * leituras assim seriam 4 mil requisições — e todas entrariam sem proveniência
 * e com `validation_status` caindo no DEFAULT 'validated' do banco, que é
 * exatamente o defeito que estamos consertando.
 */

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import {
  amostraParaLeituras,
  decidirGravacaoSono,
  linhasParaLeituras,
  noiteDePacote,
  type DeviceContext,
  type NoiteGravada,
} from "@/lib/wearable/normalize";
import type { WearableSample } from "@/lib/wearable/bleClient";
import type { LinhaImportada } from "@/lib/wearable/importer";
import { classificarPacoteProprietario } from "@/lib/wearable/h59Protocol";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Uma amostra por minuto durante a sessão ao vivo.
 *
 * O sensor notifica a cada 1–2 s. Gravar tudo daria ~2 mil linhas em meia hora
 * de uso, entupindo o gráfico do médico com ruído de PPG e o banco com dado que
 * ninguém lê. Um valor por minuto é a granularidade que o cardiologista usa para
 * tendência de FC de repouso, e é o que a `CaminhadaPage` já assume.
 */
export const INTERVALO_GRAVACAO_MS = 60_000;

/** Tamanho do lote de inserção na importação. */
export const TAMANHO_LOTE = 500;

/** Quantas linhas lemos por página ao buscar duplicatas. */
const PAGINA_LEITURA = 1000;

export type TipoImportado = "batimentos" | "oxigenacao" | "pressao" | "atividade" | "sono";

export const TIPO_ROTULO: Record<TipoImportado, string> = {
  batimentos: "Batimentos",
  oxigenacao: "Oxigenação",
  pressao: "Pressão (estimativa)",
  atividade: "Passos e calorias",
  sono: "Sono",
};

export interface ContagemTipo {
  importados: number;
  /** Já existiam no banco — reimportar o mesmo arquivo não duplica. */
  ignorados: number;
  falhas: number;
}

export interface ResumoImportacao {
  porTipo: Record<TipoImportado, ContagemTipo>;
  importados: number;
  ignorados: number;
  falhas: number;
  erros: string[];
}

const zerado = (): ContagemTipo => ({ importados: 0, ignorados: 0, falhas: 0 });

const resumoVazio = (): ResumoImportacao => ({
  porTipo: {
    batimentos: zerado(), oxigenacao: zerado(), pressao: zerado(),
    atividade: zerado(), sono: zerado(),
  },
  importados: 0, ignorados: 0, falhas: 0, erros: [],
});

/**
 * Colunas reais de cada tabela.
 *
 * O normalizador devolve objetos com `vital_type` e `entered_by_user_id` porque
 * os tipos de `@/types/cardio` os declaram — mas só `bp_readings` tem
 * `entered_by_user_id`, e nenhuma tabela de leitura tem `vital_type` (o tipo
 * está no nome da tabela). Mandar campo inexistente faz o PostgREST rejeitar o
 * lote inteiro. Em vez de confiar na forma do objeto, filtramos por lista.
 */
const COLUNAS: Record<string, string[]> = {
  hr_readings: [
    "patient_user_id", "recorded_at", "bpm", "context", "irregular_flag",
    "rmssd", "sdnn", "source_type", "source_device_id", "source_device_name",
    "entered_by", "validation_status",
  ],
  spo2_readings: [
    "patient_user_id", "recorded_at", "value", "context", "time_below_90_pct",
    "source_type", "source_device_id", "source_device_name", "entered_by",
    "validation_status",
  ],
  bp_readings: [
    "patient_user_id", "recorded_at", "systolic", "diastolic", "pulse", "context",
    "position", "arm", "cuff_validated", "source_type", "source_device_id",
    "source_device_name", "entered_by", "entered_by_user_id", "validation_status",
    "validation_note", "notes",
  ],
  activity_records: [
    "patient_user_id", "activity_date", "recorded_at", "steps", "distance_km",
    "calories", "moderate_minutes", "vigorous_minutes", "avg_heart_rate",
    "max_heart_rate", "source_type", "source_device_id", "source_device_name",
    "entered_by", "validation_status",
  ],
  sleep_records: [
    "patient_user_id", "sleep_date", "recorded_at", "total_minutes", "deep_minutes",
    "light_minutes", "rem_minutes", "awake_minutes", "awakenings", "efficiency_pct",
    "min_heart_rate", "min_spo2", "source_type", "source_device_id",
    "source_device_name", "entered_by", "validation_status",
  ],
};

function limpar(tabela: string, linha: Record<string, any>): Record<string, any> {
  const permitidas = COLUNAS[tabela];
  const out: Record<string, any> = {};
  for (const c of permitidas) if (linha[c] !== undefined) out[c] = linha[c];
  return out;
}

/** Timestamp arredondado ao minuto — a granularidade da deduplicação. */
const aoMinuto = (iso: string) => (iso ? iso.slice(0, 16) : "");

export interface DadosDoDispositivo {
  /** Nome que o próprio aparelho anunciou por Bluetooth. Nunca um modelo presumido. */
  deviceName: string;
  firmware?: string | null;
  protocolo: "ble" | "import";
  /** Identificador do Web Bluetooth, quando houver. */
  externalId?: string | null;
  vitalTypes?: string[];
}

export interface ProgressoImportacao {
  fase: "lendo" | "gravando" | null;
  feitos: number;
  total: number;
}

export function useWearableSync(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const ultimaGravacaoRef = useRef<number>(0);
  const ultimaAmostraRef = useRef<WearableSample | null>(null);
  const [progresso, setProgresso] = useState<ProgressoImportacao>({ fase: null, feitos: 0, total: 0 });

  const invalidar = useCallback(() => {
    [
      queryKeys.hr.all, queryKeys.spo2.all, queryKeys.bp.all,
      queryKeys.activity.all, queryKeys.sleep.all, queryKeys.devices.all,
    ].forEach((k) => qc.invalidateQueries({ queryKey: k }));
  }, [qc]);

  // ── Registro do aparelho ───────────────────────────────────────────

  /**
   * Garante que existe uma linha em `registered_devices` para este aparelho e
   * devolve o id dela — que é o `source_device_id` de toda leitura gravada
   * depois. Sem esse id, o médico vê "veio de um dispositivo" sem saber qual.
   *
   * A chave de identidade é (paciente, categoria, nome anunciado). O certo seria
   * um `external_id` com o id do Web Bluetooth, mas a tabela não tem essa coluna
   * e migração está fora do escopo desta correção — fica anotado aqui porque é a
   * próxima melhoria: o nome anunciado pode repetir entre aparelhos do mesmo lote.
   */
  const registrarDispositivo = useCallback(
    async (info: DadosDoDispositivo): Promise<string | null> => {
      if (demo || !uid) return null;

      const nome = info.deviceName?.trim() || "Pulseira";
      const { data: existente, error: erroBusca } = await (supabase as any)
        .from("registered_devices")
        .select("id, firmware, vital_types")
        .eq("patient_user_id", uid)
        .eq("category", "h59")
        .eq("display_name", nome)
        .limit(1)
        .maybeSingle();
      if (erroBusca) throw erroBusca;

      const vitais = info.vitalTypes ?? ["heart_rate"];

      if (existente?.id) {
        const patch: Record<string, any> = { status: "active", protocol: info.protocolo };
        if (info.firmware) patch.firmware = info.firmware;
        const { error } = await (supabase as any)
          .from("registered_devices").update(patch).eq("id", existente.id);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: queryKeys.devices.all });
        return existente.id as string;
      }

      const { data, error } = await (supabase as any)
        .from("registered_devices")
        .insert({
          patient_user_id: uid,
          display_name: nome,
          // `model` fica nulo de propósito: a ficha do aparelho veio de anúncio,
          // não de manual (docs §4). Não afirmamos modelo que não confirmamos.
          model: null,
          manufacturer: null,
          category: "h59",
          protocol: info.protocolo,
          vital_types: vitais,
          firmware: info.firmware ?? null,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;

      qc.invalidateQueries({ queryKey: queryKeys.devices.all });
      return data?.id as string;
    },
    [demo, uid, qc]
  );

  /**
   * Carimba `last_sync_at`. Só é chamado DEPOIS de uma gravação que deu certo —
   * é essa a diferença entre "conectada" e "sincronizada", e é o único número
   * que a tela principal tem direito de mostrar como última sincronização.
   */
  const marcarSincronizacao = useCallback(
    async (deviceId: string | null, quando?: string) => {
      if (demo || !deviceId) return;
      const { error } = await (supabase as any)
        .from("registered_devices")
        .update({ last_sync_at: quando ?? new Date().toISOString() })
        .eq("id", deviceId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: queryKeys.devices.all });
    },
    [demo, qc]
  );

  // ── Sessão ao vivo ─────────────────────────────────────────────────

  const reiniciarThrottle = useCallback(() => {
    ultimaGravacaoRef.current = 0;
    ultimaAmostraRef.current = null;
  }, []);

  /**
   * Grava uma amostra do Bluetooth, respeitando o throttle.
   *
   * Devolve `true` quando escreveu de fato — a tela usa isso para atualizar o
   * "última sincronização" sem mentir. `forcar: true` é o caso do desconectar:
   * a última amostra da sessão sempre entra, para a sessão não terminar com um
   * minuto de dado perdido.
   */
  const gravarAmostra = useCallback(
    async (
      amostra: WearableSample,
      ctx: Omit<DeviceContext, "patientUserId">,
      opts?: { forcar?: boolean }
    ): Promise<boolean> => {
      ultimaAmostraRef.current = amostra;
      if (demo || !uid) return false;

      const agora = Date.now();
      if (!opts?.forcar && agora - ultimaGravacaoRef.current < INTERVALO_GRAVACAO_MS) return false;
      // Marca antes de aguardar a rede: duas notificações no mesmo segundo não
      // podem disparar duas gravações enquanto a primeira ainda está no ar.
      const anterior = ultimaGravacaoRef.current;
      ultimaGravacaoRef.current = agora;

      try {
        const { heartRate } = amostraParaLeituras(amostra, { ...ctx, patientUserId: uid });
        const { error } = await (supabase as any)
          .from("hr_readings")
          .insert(limpar("hr_readings", heartRate as any));
        if (error) throw error;
        qc.invalidateQueries({ queryKey: queryKeys.hr.all });
        return true;
      } catch (e) {
        // Falhou: devolve o relógio para tentar de novo na próxima notificação.
        ultimaGravacaoRef.current = anterior;
        throw e;
      }
    },
    [demo, uid, qc]
  );

  /** Grava a última amostra vista, ignorando o throttle. Usado ao desconectar. */
  const gravarUltimaAmostra = useCallback(
    async (ctx: Omit<DeviceContext, "patientUserId">): Promise<boolean> => {
      const ultima = ultimaAmostraRef.current;
      if (!ultima) return false;
      return gravarAmostra(ultima, ctx, { forcar: true });
    },
    [gravarAmostra]
  );

  // ── Importação ─────────────────────────────────────────────────────

  /**
   * Lê do banco as chaves já existentes na janela de tempo do arquivo.
   *
   * Buscar por janela (e não o histórico inteiro) é o que faz a deduplicação
   * caber num paciente com dois anos de pulseira: o arquivo cobre semanas, não
   * anos. A chave é (data ao minuto + valor) porque a mesma exportação, reaberta,
   * repete exatamente esses dois — enquanto duas medidas legítimas no mesmo
   * minuto com o mesmo valor são, na prática, a mesma medida.
   */
  const buscarExistentes = useCallback(
    async (
      tabela: string,
      campoJanela: string,
      colunas: string,
      inicio: string,
      fim: string,
      chave: (row: any) => string
    ): Promise<Set<string>> => {
      const set = new Set<string>();
      if (!uid) return set;

      for (let offset = 0; ; offset += PAGINA_LEITURA) {
        const { data, error } = await (supabase as any)
          .from(tabela)
          .select(colunas)
          .eq("patient_user_id", uid)
          .gte(campoJanela, inicio)
          .lte(campoJanela, fim)
          .order(campoJanela, { ascending: true })
          .range(offset, offset + PAGINA_LEITURA - 1);
        if (error) throw error;
        const linhas = (data ?? []) as any[];
        for (const r of linhas) set.add(chave(r));
        if (linhas.length < PAGINA_LEITURA) break;
      }
      return set;
    },
    [uid]
  );

  /**
   * Insere em lotes. Em erro, divide o lote ao meio e tenta de novo, até a linha
   * individual. Assim uma única linha ruim (um valor fora do CHECK do banco, por
   * exemplo) não derruba as outras 499 — mas também não gastamos uma requisição
   * por linha no caminho feliz.
   */
  const inserirLote = useCallback(
    async (
      tabela: string,
      linhas: Record<string, any>[],
      contagem: ContagemTipo,
      erros: string[],
      onProgresso: (n: number) => void
    ): Promise<void> => {
      if (linhas.length === 0) return;

      const { error } = await (supabase as any).from(tabela).insert(linhas);
      if (!error) {
        contagem.importados += linhas.length;
        onProgresso(linhas.length);
        return;
      }

      if (linhas.length === 1) {
        contagem.falhas += 1;
        onProgresso(1);
        const msg = (error as any)?.message ?? "erro desconhecido";
        if (erros.length < 5 && !erros.includes(msg)) erros.push(msg);
        return;
      }

      const meio = Math.floor(linhas.length / 2);
      await inserirLote(tabela, linhas.slice(0, meio), contagem, erros, onProgresso);
      await inserirLote(tabela, linhas.slice(meio), contagem, erros, onProgresso);
    },
    []
  );

  const buscarNoites = useCallback(
    async (inicio: string, fim: string): Promise<NoiteGravada[]> => {
      const out: NoiteGravada[] = [];
      if (!uid) return out;
      const colunas = "id,sleep_date,deep_minutes,light_minutes,rem_minutes,awake_minutes,awakenings,efficiency_pct,min_heart_rate,min_spo2";
      for (let offset = 0; ; offset += PAGINA_LEITURA) {
        const { data, error } = await (supabase as any)
          .from("sleep_records")
          .select(colunas)
          .eq("patient_user_id", uid)
          .gte("sleep_date", inicio)
          .lte("sleep_date", fim)
          .order("sleep_date", { ascending: true })
          .range(offset, offset + PAGINA_LEITURA - 1);
        if (error) throw error;
        const linhas = (data ?? []) as NoiteGravada[];
        out.push(...linhas);
        if (linhas.length < PAGINA_LEITURA) break;
      }
      return out;
    },
    [uid]
  );

  /**
   * Grava noites sem segunda linha na mesma data. O que já está preenchido fica;
   * coluna null recebe o valor novo.
   */
  const persistirSono = useCallback(
    async (linhas: Record<string, any>[]): Promise<ContagemTipo & { erros: string[] }> => {
      const conta: ContagemTipo & { erros: string[] } = { ...zerado(), erros: [] };
      if (linhas.length === 0 || !uid) return conta;

      const datas = linhas.map((l) => String(l.sleep_date).slice(0, 10)).sort();
      const existentes = await buscarNoites(datas[0], datas[datas.length - 1]);
      const decisao = decidirGravacaoSono(linhas as Array<{ sleep_date: string }>, existentes);
      conta.ignorados = decisao.ignoradas;

      const parcial = zerado();
      await inserirLote(
        "sleep_records",
        decisao.inserir.map((l) => limpar("sleep_records", l)),
        parcial,
        conta.erros,
        () => {}
      );
      conta.importados += parcial.importados;
      conta.falhas += parcial.falhas;
      if (parcial.falhas === 0) conta.importados += decisao.mescladasNoInsert;
      else conta.falhas += decisao.mescladasNoInsert;

      for (const item of decisao.completar) {
        const { error } = await (supabase as any)
          .from("sleep_records")
          .update(item.patch)
          .eq("id", item.id)
          .eq("patient_user_id", uid);
        if (error) {
          conta.falhas += item.linhas;
          const msg = (error as any)?.message ?? "erro desconhecido";
          if (conta.erros.length < 5 && !conta.erros.includes(msg)) conta.erros.push(msg);
        } else {
          conta.importados += item.linhas;
        }
      }
      return conta;
    },
    [uid, buscarNoites, inserirLote]
  );

  /**
   * Pacote que não é batimento (21, 105, 106). Sono clínico vai para
   * `sleep_records`; o que o decodificador não entende vai cru para
   * `raw_device_data` e não cria noite.
   */
  const gravarPacoteProprietario = useCallback(
    async (pacote: Uint8Array, ctx: Omit<DeviceContext, "patientUserId">): Promise<boolean> => {
      if (demo || !uid || pacote.byteLength === 0) return false;
      const view = new DataView(pacote.buffer, pacote.byteOffset, pacote.byteLength);
      const classificado = classificarPacoteProprietario(view);
      if (classificado.destino === "outro") return false;
      if (classificado.destino === "cru") {
        const { error } = await (supabase as any).from("raw_device_data").insert({
          patient_user_id: uid,
          device_id: ctx.deviceId ?? null,
          raw_payload: classificado.raw_payload,
          payload_format: classificado.payload_format,
          device_timestamp: classificado.device_timestamp,
          processed: false,
        });
        if (error) throw error;
        return false;
      }
      const noite = noiteDePacote(classificado, { ...ctx, patientUserId: uid });
      const r = await persistirSono([noite]);
      if (r.importados > 0) qc.invalidateQueries({ queryKey: queryKeys.sleep.all });
      if (r.falhas > 0 && r.importados === 0) throw new Error(r.erros[0] ?? "não consegui gravar o sono");
      return r.importados > 0;
    },
    [demo, uid, persistirSono, qc]
  );

  /**
   * Importa TODAS as linhas normalizadas — sem teto de 50, e incluindo
   * atividade e sono, que o normalizador já produzia e a tela jogava fora.
   */
  const importar = useCallback(
    async (linhas: LinhaImportada[], info: DadosDoDispositivo): Promise<ResumoImportacao> => {
      const resumo = resumoVazio();
      if (linhas.length === 0) return resumo;

      if (demo || !uid) {
        // Modo demo não grava — mas a tela ainda mostra o que ENTRARIA, para a
        // demonstração ao cardiologista não parecer quebrada.
        const previa = linhasParaLeituras(linhas, { patientUserId: "demo", deviceName: info.deviceName });
        resumo.porTipo.batimentos.ignorados = previa.heartRate.length;
        resumo.porTipo.oxigenacao.ignorados = previa.spo2.length;
        resumo.porTipo.pressao.ignorados = previa.bloodPressure.length;
        resumo.porTipo.atividade.ignorados = previa.activity.length;
        resumo.porTipo.sono.ignorados = previa.sleep.length;
        resumo.ignorados = Object.values(resumo.porTipo).reduce((s, c) => s + c.ignorados, 0);
        return resumo;
      }

      setProgresso({ fase: "lendo", feitos: 0, total: 0 });

      // O aparelho precisa existir ANTES das leituras: `source_device_id` é
      // chave estrangeira para `registered_devices`.
      const deviceId = await registrarDispositivo({ ...info, protocolo: "import" });

      const leituras = linhasParaLeituras(linhas, {
        patientUserId: uid,
        deviceId,
        deviceName: info.deviceName,
      });

      const total =
        leituras.heartRate.length + leituras.spo2.length + leituras.bloodPressure.length +
        leituras.activity.length + leituras.sleep.length;
      let feitos = 0;
      const avancar = (n: number) => {
        feitos += n;
        setProgresso({ fase: "gravando", feitos, total });
      };
      setProgresso({ fase: "gravando", feitos: 0, total });

      /**
       * Um plano por tabela. `campoJanela` é a coluna pela qual filtramos o que
       * já existe: timestamp nas leituras pontuais, data do dia em sono e
       * atividade — que, aliás, têm UNIQUE (paciente, data) no banco, então lá a
       * chave de deduplicação é a própria data: dois registros do mesmo dia não
       * cabem, independentemente do valor.
       */
      const planos: {
        tipo: TipoImportado;
        tabela: string;
        campoJanela: string;
        colunas: string;
        linhas: Record<string, any>[];
        chaveBanco: (r: any) => string;
        chaveArquivo: (r: any) => string;
        valorJanela: (r: any) => string;
      }[] = [
        {
          tipo: "batimentos", tabela: "hr_readings", campoJanela: "recorded_at",
          colunas: "recorded_at,bpm", linhas: leituras.heartRate as any[],
          chaveBanco: (r) => `${aoMinuto(r.recorded_at)}|${r.bpm}`,
          chaveArquivo: (r) => `${aoMinuto(r.recorded_at)}|${r.bpm}`,
          valorJanela: (r) => r.recorded_at,
        },
        {
          tipo: "oxigenacao", tabela: "spo2_readings", campoJanela: "recorded_at",
          colunas: "recorded_at,value", linhas: leituras.spo2 as any[],
          chaveBanco: (r) => `${aoMinuto(r.recorded_at)}|${r.value}`,
          chaveArquivo: (r) => `${aoMinuto(r.recorded_at)}|${r.value}`,
          valorJanela: (r) => r.recorded_at,
        },
        {
          tipo: "pressao", tabela: "bp_readings", campoJanela: "recorded_at",
          colunas: "recorded_at,systolic,diastolic", linhas: leituras.bloodPressure as any[],
          chaveBanco: (r) => `${aoMinuto(r.recorded_at)}|${r.systolic}/${r.diastolic}`,
          chaveArquivo: (r) => `${aoMinuto(r.recorded_at)}|${r.systolic}/${r.diastolic}`,
          valorJanela: (r) => r.recorded_at,
        },
        {
          tipo: "atividade", tabela: "activity_records", campoJanela: "activity_date",
          colunas: "activity_date", linhas: leituras.activity as any[],
          chaveBanco: (r) => String(r.activity_date).slice(0, 10),
          chaveArquivo: (r) => String(r.activity_date).slice(0, 10),
          valorJanela: (r) => String(r.activity_date).slice(0, 10),
        },
      ];

      if (leituras.sleep.length > 0) {
        const conta = resumo.porTipo.sono;
        try {
          const r = await persistirSono(leituras.sleep as any[]);
          conta.importados += r.importados;
          conta.ignorados += r.ignorados;
          conta.falhas += r.falhas;
          for (const msg of r.erros) {
            if (resumo.erros.length < 5 && !resumo.erros.includes(msg)) resumo.erros.push(msg);
          }
        } catch (e) {
          conta.falhas += leituras.sleep.length;
          const msg = e instanceof Error ? e.message : "não consegui conferir o que já estava salvo";
          if (resumo.erros.length < 5) resumo.erros.push(msg);
        }
        avancar(leituras.sleep.length);
      }

      for (const plano of planos) {
        const conta = resumo.porTipo[plano.tipo];
        if (plano.linhas.length === 0) continue;

        const janela = plano.linhas.map(plano.valorJanela).sort();
        const inicio = janela[0];
        const fim = janela[janela.length - 1];

        let existentes: Set<string>;
        try {
          existentes = await buscarExistentes(
            plano.tabela, plano.campoJanela, plano.colunas, inicio, fim, plano.chaveBanco
          );
        } catch (e) {
          // Sem conseguir ler o que já existe, importar seria duplicar às cegas.
          // Preferimos falhar este tipo e dizer isso ao paciente.
          conta.falhas += plano.linhas.length;
          const msg = e instanceof Error ? e.message : "não consegui conferir o que já estava salvo";
          if (resumo.erros.length < 5) resumo.erros.push(msg);
          avancar(plano.linhas.length);
          continue;
        }

        // Deduplica também DENTRO do arquivo: exportação com linha repetida é comum.
        const vistas = new Set<string>();
        const novas: Record<string, any>[] = [];
        for (const linha of plano.linhas) {
          const k = plano.chaveArquivo(linha);
          if (existentes.has(k) || vistas.has(k)) { conta.ignorados++; avancar(1); continue; }
          vistas.add(k);
          novas.push(limpar(plano.tabela, linha));
        }

        for (let i = 0; i < novas.length; i += TAMANHO_LOTE) {
          await inserirLote(plano.tabela, novas.slice(i, i + TAMANHO_LOTE), conta, resumo.erros, avancar);
        }
      }

      resumo.importados = Object.values(resumo.porTipo).reduce((s, c) => s + c.importados, 0);
      resumo.ignorados = Object.values(resumo.porTipo).reduce((s, c) => s + c.ignorados, 0);
      resumo.falhas = Object.values(resumo.porTipo).reduce((s, c) => s + c.falhas, 0);

      // `last_sync_at` só avança se algo entrou de verdade.
      if (resumo.importados > 0) {
        try { await marcarSincronizacao(deviceId); } catch { /* não invalida a importação */ }
      }

      invalidar();
      setProgresso({ fase: null, feitos: 0, total: 0 });
      return resumo;
    },
    [demo, uid, registrarDispositivo, buscarExistentes, inserirLote, marcarSincronizacao, invalidar, persistirSono]
  );

  return {
    demo,
    progresso,
    registrarDispositivo,
    marcarSincronizacao,
    gravarAmostra,
    gravarUltimaAmostra,
    gravarPacoteProprietario,
    reiniciarThrottle,
    importar,
  };
}
