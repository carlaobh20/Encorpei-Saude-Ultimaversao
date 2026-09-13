/**
 * Sintomas, exames, alertas, dispositivos e o cálculo de risco do paciente.
 */

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import { toastError } from "@/lib/errorHandler";
import {
  DEMO_ALERTS, DEMO_DEVICES, DEMO_EXAMS, DEMO_LABS, DEMO_SYMPTOMS,
} from "@/lib/demoData";
import { avaliarRisco, type RiskResult } from "@/lib/clinical/cardioRiskEngine";
import { classeDaRegra, rotuloDaRegra, type ClasseDeAlerta } from "@/lib/clinical/cardioAlertRules";
import { monitor } from "@/lib/monitor";
import { useBloodPressure, useHeartRate, useSleep, useSpo2, useWeight } from "./useCardioReadings";
import { useCardioMedications } from "./useCardioMedications";
import { useCardioPatient, useTargets } from "./useCardioPatient";
import type {
  CardioAlert, CardioExam, LabResult, RegisteredDevice, SymptomReport,
} from "@/types/cardio";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Sintomas ─────────────────────────────────────────────────────────

export function useSymptoms(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.symptoms.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 60_000,
    queryFn: async (): Promise<SymptomReport[]> => {
      if (demo) return DEMO_SYMPTOMS;
      const { data, error } = await (supabase as any)
        .from("symptom_reports")
        .select("*")
        .eq("patient_user_id", uid)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SymptomReport[];
    },
  });

  const registrar = useMutation({
    mutationFn: async (input: Partial<SymptomReport>) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("symptom_reports")
        .insert({ patient_user_id: user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.symptoms.all });
      toast.success("Registrado. Seu médico consegue ver.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui registrar o sintoma."),
  });

  /**
   * Gravar um sintoma que leva o paciente à emergência.
   *
   * AUDITORIA — o buraco mais grave do app: síncope e dor torácica em repouso
   * navegavam para /emergencia e voltavam ANTES de gravar. O sintoma mais
   * grave era o único que não entrava em `symptom_reports`, nenhum gatilho
   * rodava e o cardiologista não ficava sabendo de nada.
   *
   * Por que esta função existe fora da mutation do TanStack: a tela chama
   * `void registrarEmergencia(...)` e navega na linha seguinte, sem `await`.
   * O componente desmonta no mesmo tick, e um observer de mutation desmontado
   * pode ter os callbacks descartados. Aqui é uma promise solta, presa a nada
   * que o React desmonte — o `insert` chega ao servidor mesmo com a tela já
   * trocada.
   *
   * A ordem é inegociável nos dois sentidos: grava primeiro, mas a gravação
   * NÃO atrasa nem bloqueia o encaminhamento. Se o insert falhar, o paciente
   * já está na tela certa com o 192 na frente dele; o erro vira telemetria e
   * um aviso discreto, nunca um obstáculo.
   */
  const registrarEmergencia = useCallback(
    async (input: Partial<SymptomReport>): Promise<void> => {
      if (demo || !user?.id) return;
      try {
        const { data, error } = await (supabase as any)
          .from("symptom_reports")
          .insert({ patient_user_id: user.id, ...input })
          .select("id");
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("insert sem linha devolvida");
        qc.invalidateQueries({ queryKey: queryKeys.symptoms.all });
        qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
      } catch (e) {
        // Sem `throw`: quem chamou já navegou. Mas isto não pode sumir —
        // é um relato de emergência que não chegou ao médico.
        monitor.error("Falha ao gravar sintoma de emergência", e, {
          symptom_type: String(input.symptom_type ?? ""),
        });
        toast.error("Registrei no aparelho, mas não consegui enviar ao seu médico. Avise-o.");
      }
    },
    [demo, user?.id, qc]
  );

  return { symptoms: query.data ?? [], isLoading: query.isLoading, registrar, registrarEmergencia };
}

// ── Exames ───────────────────────────────────────────────────────────

export function useLabResults(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.labs.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LabResult[]> => {
      if (demo) return DEMO_LABS;
      const { data, error } = await (supabase as any)
        .from("lab_results")
        .select("*")
        .eq("patient_user_id", uid)
        .order("collected_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LabResult[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (input: Partial<LabResult> & { patient_user_id?: string }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("lab_results")
        .insert({ patient_user_id: input.patient_user_id ?? user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.labs.all });
      toast.success("Resultado salvo.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar o resultado."),
  });

  /** Último valor de cada marcador — é o que a tela quase sempre quer. */
  const ultimoPorMarcador = useMemo(() => {
    const mapa = new Map<string, LabResult>();
    for (const r of query.data ?? []) if (!mapa.has(r.marker_key)) mapa.set(r.marker_key, r);
    return mapa;
  }, [query.data]);

  return { labs: query.data ?? [], ultimoPorMarcador, isLoading: query.isLoading, salvar };
}

export function useCardioExams(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.exams.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CardioExam[]> => {
      if (demo) return DEMO_EXAMS;
      const { data, error } = await (supabase as any)
        .from("cardio_exams")
        .select("*")
        .eq("patient_user_id", uid)
        .order("performed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as CardioExam[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (input: Partial<CardioExam> & { patient_user_id?: string }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("cardio_exams")
        .insert({ patient_user_id: input.patient_user_id ?? user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.all });
      toast.success("Exame salvo.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar o exame."),
  });

  /**
   * ANEXAR UM RESULTADO DE VERDADE.
   *
   * AUDITORIA: o botão "Anexar resultado" recebia o arquivo e mostrava
   * "Recebido. Seu médico vai revisar" — sem upload nenhum. O arquivo era
   * descartado pelo coletor de lixo. Mentir sobre um exame é a pior classe de
   * erro deste produto: o paciente acredita que entregou e para de cobrar.
   *
   * Caminho: `exams/<user_id>/<uuid>.<ext>` — é a forma que a política
   * `exams_owner` exige (migração 20260911000000 §7: o dono escreve o que
   * está sob a pasta com o próprio uid) e a que `exams_doctor_read` usa para
   * liberar o médico vinculado.
   *
   * Duas etapas, nesta ordem, sem transação possível entre storage e tabela:
   *  1. sobe o arquivo;
   *  2. registra a linha em `cardio_exams` apontando para ele.
   * Se a etapa 2 falhar, o objeto órfão é apagado — arquivo no bucket que
   * nenhuma linha referencia é arquivo que ninguém vai ler nunca.
   */
  const anexar = useMutation({
    mutationFn: async (file: File): Promise<{ nome: string }> => {
      if (demo) {
        throw new Error("DEMO");
      }
      if (!user?.id) throw new Error("Sessão expirada. Entre de novo para anexar.");

      const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const caminho = `${user.id}/${crypto.randomUUID()}${ext ? "." + ext : ""}`;

      const { error: erroUpload } = await supabase.storage
        .from("exams")
        .upload(caminho, file, { contentType: file.type || undefined, upsert: false });
      if (erroUpload) throw erroUpload;

      const { data, error } = await (supabase as any)
        .from("cardio_exams")
        .insert({
          patient_user_id: user.id,
          // O paciente não sabe (nem deve adivinhar) o tipo do exame. O tipo
          // real é do médico, ao lançar o laudo. `anexo_paciente` diz a
          // verdade: é um arquivo enviado pelo paciente, ainda não lido.
          exam_type: "anexo_paciente",
          performed_at: new Date().toISOString().slice(0, 10),
          findings: { arquivo: file.name },
          file_url: caminho,
        })
        .select("id");

      if (error || !data || data.length === 0) {
        await supabase.storage.from("exams").remove([caminho]);
        throw error ?? new Error("O arquivo subiu mas o registro não foi criado.");
      }
      return { nome: file.name };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.all });
      toast.success(`"${r.nome}" foi enviado. Seu médico já consegue abrir.`);
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === "DEMO") {
        toast.info("Modo demonstração: o arquivo não é enviado a lugar nenhum.");
        return;
      }
      toastError(e, "Não consegui enviar o arquivo. Tente de novo.");
    },
  });

  const exams = useMemo(() => query.data ?? [], [query.data]);

  /**
   * Links assinados para os anexos.
   *
   * O bucket `exams` é PRIVADO — `file_url` guarda o caminho, não uma URL
   * pública, e sem assinatura o arquivo não abre. Assinamos em lote (uma
   * chamada para a lista inteira) porque assinar um por um dentro do `.map()`
   * da tela é o mesmo N+1 que já derrubou a fila do médico.
   */
  const caminhos = useMemo(
    () => exams.map((e) => e.file_url).filter((u): u is string => !!u && !u.startsWith("http")),
    [exams]
  );

  const assinaturas = useQuery({
    queryKey: [...queryKeys.exams.all, "assinados", caminhos.join("|")],
    enabled: !demo && caminhos.length > 0,
    // Uma hora é a validade do link; renovamos com folga antes disso.
    staleTime: 45 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from("exams").createSignedUrls(caminhos, 3600);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.signedUrl && item.path) mapa[item.path] = item.signedUrl;
      }
      return mapa;
    },
  });

  /** URL para abrir o anexo, ou `null` enquanto a assinatura não voltou. */
  const urlDoArquivo = useCallback(
    (fileUrl?: string | null): string | null => {
      if (!fileUrl) return null;
      if (fileUrl.startsWith("http")) return fileUrl;
      return assinaturas.data?.[fileUrl] ?? null;
    },
    [assinaturas.data]
  );

  return { exams, isLoading: query.isLoading, salvar, anexar, urlDoArquivo };
}

// ── Alertas ──────────────────────────────────────────────────────────

/** `CardioAlert` com o `rule_code` já traduzido — ver `rotuloDaRegra`. */
export interface AlertaTraduzido extends CardioAlert {
  /** Nome legível da regra, para paciente e médico. */
  rotulo: string;
  /** Risco clínico ou atraso operacional. */
  classe: ClasseDeAlerta;
  /**
   * Marcas do PACIENTE (migração 20260917000000). São separadas de
   * `is_read`/`is_dismissed` de propósito: aquelas duas são o filtro da fila do
   * médico, e o paciente limpando a própria tela não pode apagar o alerta do
   * painel do cardiologista.
   */
  patient_read_at?: string | null;
  patient_dismissed_at?: string | null;
}

export function useCardioAlerts(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.alerts.doPaciente(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 30_000,
    queryFn: async (): Promise<CardioAlert[]> => {
      if (demo) return DEMO_ALERTS;
      const { data, error } = await (supabase as any)
        .from("cardio_alerts")
        .select("*")
        .eq("patient_user_id", uid)
        // Dois filtros, dois donos: o médico resolveu (is_dismissed) OU o
        // paciente tirou da própria tela (patient_dismissed_at). Qualquer um
        // dos dois some daqui; só o primeiro some da fila do médico.
        .eq("is_dismissed", false)
        .is("patient_dismissed_at", null)
        .order("triggered_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CardioAlert[];
    },
  });

  /**
   * AUDITORIA — o alerta que voltava.
   *
   * `update(...).eq("id", id)` sem `.select()` devolve `error === null` e zero
   * linhas quando a RLS não deixa escrever. Era exatamente o caso: a única
   * política do paciente em `cardio_alerts` era `alerts_patient_read`, um
   * `for select`. O paciente dispensava, o `onSuccess` rodava, a lista era
   * invalidada — e o alerta reaparecia no refetch, porque nada tinha mudado
   * no banco.
   *
   * Duas metades da correção:
   *  · no banco (migração 20260917000000): o paciente PASSA a poder marcar o
   *    próprio alerta como lido/dispensado, e só isso — um gatilho devolve
   *    qualquer outra coluna ao valor antigo;
   *  · aqui: toda escrita leva `.select()` e zero linha é FALHA, com recado.
   *    Silêncio não é sucesso.
   */
  const escrever = async (id: string, patch: Record<string, string | null>) => {
    const { data, error } = await (supabase as any)
      .from("cardio_alerts")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Nenhuma linha foi alterada — provavelmente sem permissão para este alerta.");
    }
  };

  const marcarLido = useMutation({
    mutationFn: async (id: string) => {
      if (demo) return;
      await escrever(id, { patient_read_at: new Date().toISOString() });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alerts.all }),
    onError: (e: unknown) => toastError(e, "Não consegui marcar o alerta como lido."),
  });

  const dispensar = useMutation({
    mutationFn: async (id: string) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const agora = new Date().toISOString();
      await escrever(id, { patient_dismissed_at: agora, patient_read_at: agora });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alerts.all }),
    onError: (e: unknown) => toastError(e, "Não consegui dispensar o alerta."),
  });

  /**
   * `rule_code` traduzido na saída do hook, não na tela.
   *
   * O banco grava `symptom_chest_pain_rest` e `spo2_borderline`; o motor do
   * cliente fala português. Nenhuma tela traduzia nem um nem outro. A ponte
   * mora em cardioAlertRules e é aplicada aqui, de uma vez, para o paciente e
   * para o médico (`useProfessionalAlerts` faz o mesmo) — assim quem
   * renderiza não precisa saber que existem duas nomenclaturas.
   */
  const alerts = useMemo<AlertaTraduzido[]>(
    () =>
      (query.data ?? []).map((a) => ({
        ...a,
        rotulo: rotuloDaRegra(a.rule_code),
        classe: classeDaRegra(a.rule_code),
      })),
    [query.data]
  );

  return {
    alerts,
    // "Não lido" aqui é não lido PELO PACIENTE. O `|| !a.is_read` mantém o modo
    // demo coerente (DEMO_ALERTS não tem as colunas novas) sem inventar estado.
    naoLidos: alerts.filter((a) => !a.patient_read_at && !a.is_read).length,
    isLoading: query.isLoading,
    marcarLido,
    dispensar,
  };
}

// ── Dispositivos ─────────────────────────────────────────────────────

export function useDevices(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.devices.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RegisteredDevice[]> => {
      if (demo) return DEMO_DEVICES as unknown as RegisteredDevice[];
      const { data, error } = await (supabase as any)
        .from("registered_devices")
        .select("*")
        .eq("patient_user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegisteredDevice[];
    },
  });

  const registrar = useMutation({
    mutationFn: async (device: Partial<RegisteredDevice>) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("registered_devices")
        .insert({ patient_user_id: user!.id, ...device });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.devices.all });
      toast.success("Dispositivo registrado.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui registrar o dispositivo."),
  });

  return { devices: query.data ?? [], isLoading: query.isLoading, registrar };
}

// ── Risco consolidado ────────────────────────────────────────────────

/**
 * Junta tudo e roda o motor. É o que alimenta o semáforo na fila do médico
 * e o cartão de situação na home do paciente.
 */
export function useRiskAssessment(patientUserId?: string): { risk: RiskResult; isLoading: boolean } {
  const { data: patient } = useCardioPatient(patientUserId);
  const { targets } = useTargets(patientUserId);
  const bp = useBloodPressure(patientUserId);
  const hr = useHeartRate(patientUserId);
  const weight = useWeight(patientUserId);
  const spo2 = useSpo2(patientUserId);
  const sleep = useSleep(patientUserId);
  const { symptoms } = useSymptoms(patientUserId);
  const { adesao } = useCardioMedications(patientUserId);

  const isLoading = bp.isLoading || hr.isLoading || weight.isLoading;

  const risk = useMemo(
    () =>
      avaliarRisco({
        targets,
        bloodPressure: bp.readings,
        heartRate: hr.readings,
        weight: weight.readings,
        spo2: spo2.readings,
        sleep: sleep.records,
        symptoms,
        adherence14d: adesao?.d14 ?? null,
        heartFailure: !!patient?.history?.heart_failure,
        now: new Date(),
      }),
    [targets, bp.readings, hr.readings, weight.readings, spo2.readings, sleep.records, symptoms, adesao, patient]
  );

  return { risk, isLoading };
}
