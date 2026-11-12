package saude.encorpei.pulseira;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.ExecutorService;

/** Remédios, sintomas, caminhada, alimentação e sono — as mesmas gravações do site. */
final class MaisTelas {
    private final Activity activity;
    private final LinearLayout corpo;
    private final ScrollView scroll;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Conta conta;
    private ExecutorService rede;
    private Runnable voltar;
    private java.util.function.Supplier<Integer> pulso;
    private String atual = "remedios";
    private Runnable relogio;
    private int segundos;
    private int segundosNaZona;
    private int restante;
    private int contagem;
    private boolean andando;
    private String fase = "";
    private String sintoma = "";
    private String gatilho = "";
    private String tipoDor = "";
    private final LinkedHashSet<String> associados = new LinkedHashSet<>();
    private boolean repouso;
    private boolean esforcoLeve;
    private boolean atividade;
    private boolean dpn;
    private Boolean inicioSubito;
    private Boolean ritmoRegular;
    private String localEdema = "";
    private Boolean cacifo;
    private String periodo = "";
    private String contexto = "";
    private Integer zonaMin;
    private Integer zonaMax;

    MaisTelas(Activity activity) {
        this.activity = activity;
        corpo = new LinearLayout(activity);
        corpo.setOrientation(LinearLayout.VERTICAL);
        corpo.setPadding(dp(16), dp(16), dp(16), dp(32));
        scroll = new ScrollView(activity);
        scroll.setBackgroundColor(activity.getColor(R.color.fundo));
        scroll.addView(corpo, new ScrollView.LayoutParams(-1, -2));
    }

    View view() {
        return scroll;
    }

    void ligar(Conta conta, ExecutorService rede, Runnable voltar, java.util.function.Supplier<Integer> pulso) {
        this.conta = conta;
        this.rede = rede;
        this.voltar = voltar;
        this.pulso = pulso;
    }

    void abrir(String tela) {
        atual = tela;
        pararRelogio();
        fase = "";
        sintoma = "";
        titulo("Carregando…");
        if ("sintomas".equals(tela)) listaSintomas();
        else if (rede != null) rede.execute(this::carregar);
    }

    void pulsoMudou() {
        if (!"caminhada".equals(atual) || !"ativa".equals(fase)) return;
        activity.runOnUiThread(this::desenharCaminhada);
    }

    private void carregar() {
        try {
            if ("remedios".equals(atual)) remedios();
            else if ("sono".equals(atual)) sono();
            else if ("alimentacao".equals(atual)) alimentacao();
            else if ("caminhada".equals(atual)) caminhada();
        } catch (Exception ex) {
            activity.runOnUiThread(() -> titulo("Não consegui carregar agora. Tente de novo."));
        }
    }

    private void ui(Runnable r) {
        if (Looper.myLooper() == Looper.getMainLooper()) r.run();
        else activity.runOnUiThread(r);
    }

    private void remedios() {
        limpar();
        titulo("Remédios");
        sub("Suas doses de hoje");
        try {
            String uid = conta.uidAtual();
            JSONArray meds = conta.lista("cardio_medications?patient_user_id=eq." + Conta.enc(uid) + "&status=eq.active&select=id,name,dose,med_class,schedule&order=created_at.asc");
            String hoje = LocalDate.now(ZoneOffset.UTC).toString();
            JSONArray tomou = conta.lista("medication_intakes?patient_user_id=eq." + Conta.enc(uid) + "&intake_date=eq." + hoje + "&select=medication_id,scheduled_time,taken");
            JSONArray historico = conta.lista("medication_intakes?patient_user_id=eq." + Conta.enc(uid) + "&intake_date=gte." + LocalDate.now(ZoneOffset.UTC).minusDays(30) + "&select=intake_date,taken&limit=400");
            double d14 = adesao(historico, 14);
            if (d14 >= 0 && d14 < 0.8) {
                aviso("Remédios em atraso", "Você deixou de marcar várias doses nas últimas semanas. Se está com dificuldade para tomar, fale com seu médico — quase sempre dá para ajustar.");
            }
            texto("Hoje");
            int doses = 0;
            for (int i = 0; i < meds.length(); i++) {
                JSONObject med = meds.getJSONObject(i);
                JSONArray horas = med.optJSONArray("schedule");
                if (horas == null) continue;
                for (int h = 0; h < horas.length(); h++) {
                    doses++;
                    String hora = horas.optString(h);
                    boolean taken = marcada(tomou, med.optString("id"), hora);
                    String detalhe = med.optString("name") + "\n" + med.optString("dose") + " · " + classe(med.optString("med_class")) + "\n" + hora;
                    botao(taken ? "Tomei · " + detalhe : "Marcar · " + detalhe, taken ? R.style.BotaoContorno : R.style.BotaoPrimario, () -> {
                        rede.execute(() -> {
                            String erro = marcarDose(med.optString("id"), hora, !taken);
                            activity.runOnUiThread(() -> {
                                if (erro != null) aviso("", erro);
                                else abrir("remedios");
                            });
                        });
                    });
                }
            }
            if (doses == 0) {
                texto("Nenhum remédio cadastrado");
                texto("Quando seu médico prescrever, seus horários aparecem aqui.");
            }
            if (historico.length() > 0) {
                texto("Sua constância");
                texto("Últimos 7 dias: " + pct(adesao(historico, 7)));
                texto("Últimos 14 dias: " + pct(adesao(historico, 14)));
                texto("Últimos 30 dias: " + pct(adesao(historico, 30)));
            }
            texto("Seus remédios");
            if (meds.length() == 0) {
                texto("Nenhum remédio ativo");
                texto("Seus remédios prescritos aparecem aqui.");
            }
            for (int i = 0; i < meds.length(); i++) {
                JSONObject med = meds.getJSONObject(i);
                texto(med.optString("name") + "\n" + med.optString("dose") + " · " + juntar(med.optJSONArray("schedule"))
                        + "\n" + paraQue(med.optString("med_class")));
            }
            try {
                JSONArray titulos = conta.lista("medication_titrations?patient_user_id=eq." + Conta.enc(uid)
                        + "&select=medication_id,previous_dose,new_dose,reason,created_at&order=created_at.desc&limit=20");
                if (titulos.length() > 0) {
                    texto("O que o médico mudou");
                    for (int i = 0; i < titulos.length(); i++) {
                        JSONObject t = titulos.getJSONObject(i);
                        texto(nomeMed(meds, t.optString("medication_id")) + ": " + t.optString("previous_dose") + " → " + t.optString("new_dose")
                                + (t.optString("reason").isEmpty() ? "" : "\n" + t.optString("reason")));
                    }
                }
            } catch (Exception ignored) {
                /* o histórico some; as doses de hoje continuam */
            }
        } catch (Exception ex) {
            texto("Não consegui carregar os remédios.");
        }
        voltarBotao();
    }

    private String marcarDose(String medId, String hora, boolean taken) {
        try {
            JSONObject o = new JSONObject();
            o.put("patient_user_id", conta.uidAtual());
            o.put("medication_id", medId);
            o.put("intake_date", LocalDate.now(ZoneOffset.UTC).toString());
            o.put("scheduled_time", hora);
            o.put("taken", taken);
            o.put("taken_at", taken ? Instant.now().toString() : JSONObject.NULL);
            String erro = conta.gravar("POST", "medication_intakes?on_conflict=medication_id,intake_date,scheduled_time", o.toString(), true);
            if (erro != null && erro.contains("não foi gravada") ) return "A dose não foi gravada (permissão negada ou vínculo inativo).";
            if ("Não consegui gravar agora.".equals(erro)) return "A dose não foi gravada (permissão negada ou vínculo inativo).";
            return erro;
        } catch (Exception ex) {
            return "Não consegui registrar a dose.";
        }
    }

    private void listaSintomas() {
        limpar();
        titulo("Sintomas");
        sub("O que você está sentindo?");
        String[][] itens = {
                {"chest_pain", "Dor no peito"},
                {"dyspnea", "Falta de ar"},
                {"palpitations", "Palpitação (coração disparado)"},
                {"edema", "Inchaço nas pernas"},
                {"syncope", "Desmaio"},
                {"presyncope", "Quase desmaiei"},
                {"claudication", "Dor na perna ao andar"},
                {"dry_cough", "Tosse seca"},
                {"fatigue", "Cansaço fora do comum"},
                {"dizziness", "Tontura"},
        };
        for (String[] item : itens) {
            String tipo = item[0];
            botao(item[1], R.style.BotaoContorno, () -> {
                if ("syncope".equals(tipo)) {
                    textoAviso("Desmaio é emergência.");
                    gravarEmergencia("syncope", new JSONObject(), null);
                    return;
                }
                sintoma = tipo;
                gatilho = "";
                tipoDor = "";
                associados.clear();
                repouso = esforcoLeve = atividade = dpn = false;
                inicioSubito = ritmoRegular = cacifo = null;
                localEdema = periodo = contexto = "";
                formularioSintoma();
            });
        }
        voltarBotao();
    }

    private void formularioSintoma() {
        limpar();
        botao("Voltar", R.style.BotaoContorno, this::listaSintomas);
        if ("chest_pain".equals(sintoma)) formularioDor();
        else if ("dyspnea".equals(sintoma)) formularioAr();
        else if ("palpitations".equals(sintoma)) formularioPalpitacao();
        else if ("edema".equals(sintoma)) formularioEdema();
        else if ("presyncope".equals(sintoma)) formularioQuase();
        else if ("claudication".equals(sintoma)) formularioPerna();
        else if ("dry_cough".equals(sintoma)) formularioTosse();
        else formularioNota("fatigue".equals(sintoma));
    }

    private void formularioDor() {
        titulo("Dor no peito");
        aviso("", "Se a dor está acontecendo agora, não passa e você está em repouso, não espere — vá direto para emergência.");
        texto("Onde dói");
        EditText local = campo("ex.: meio do peito");
        texto("Tipo de dor");
        for (String t : new String[] {"Aperto", "Queimação", "Pontada"}) {
            botao(t, R.style.BotaoContorno, () -> tipoDor = t);
        }
        texto("Há quanto tempo (minutos)");
        EditText duracao = campo("");
        texto("Quando começou");
        botao("Durante esforço", R.style.BotaoContorno, () -> gatilho = "esforco");
        botao("Em repouso", R.style.BotaoContorno, () -> gatilho = "repouso");
        botao("Com emoção/estresse", R.style.BotaoContorno, () -> gatilho = "emocao");
        texto("A dor vai para algum lugar (braço, costas, mandíbula)?");
        EditText irrad = campo("");
        texto("Sentiu junto com a dor");
        for (String s : new String[] {"Suor frio", "Náusea", "Falta de ar"}) {
            botao(s, R.style.BotaoContorno, () -> { if (!associados.add(s)) associados.remove(s); });
        }
        texto("De 0 (nada) a 10 (a pior possível), quanto dói?");
        EditText intensidade = campo("0 a 10");
        botao("Emergência", R.style.BotaoPrimario, () -> {
            JSONObject q = new JSONObject();
            try {
                q.put("local", local.getText().toString());
                q.put("tipo", tipoDor);
                q.put("gatilho", gatilho.isEmpty() ? "repouso" : gatilho);
                q.put("irradiacao", irrad.getText().toString());
                q.put("associados", String.join(", ", associados));
                q.put("pelo_aviso_da_tela", true);
            } catch (Exception ignored) { }
            gravarEmergencia("chest_pain", q, minutos(duracao));
        });
        botao("Registrar", R.style.BotaoPrimario, () -> {
            JSONObject q = new JSONObject();
            try {
                q.put("local", local.getText().toString());
                q.put("tipo", tipoDor);
                q.put("gatilho", gatilho);
                q.put("irradiacao", irrad.getText().toString());
                q.put("associados", String.join(", ", associados));
            } catch (Exception ignored) { }
            Integer min = minutos(duracao);
            if ("repouso".equals(gatilho) && (min == null || min > 10)) {
                gravarEmergencia("chest_pain", q, min);
                return;
            }
            gravarSintoma("chest_pain", q, min, intensidade(intensidade), null, false);
        });
    }

    private JSONObject qualificadoresDor() {
        JSONObject q = new JSONObject();
        try {
            q.put("local", "");
            q.put("tipo", tipoDor);
            q.put("gatilho", gatilho);
            q.put("irradiacao", "");
            q.put("associados", String.join(", ", associados));
        } catch (Exception ignored) { }
        return q;
    }

    private void formularioAr() {
        titulo("Falta de ar");
        texto("Quando você sente falta de ar?");
        botao("Em atividades do dia a dia (ex.: subir escada)", R.style.BotaoContorno, () -> atividade = !atividade);
        botao("Em esforços leves (ex.: andar em casa)", R.style.BotaoContorno, () -> esforcoLeve = !esforcoLeve);
        botao("Mesmo parado, sem fazer nada", R.style.BotaoContorno, () -> repouso = !repouso);
        texto("Quantos travesseiros usa para dormir sem faltar ar?");
        EditText trav = campo("1");
        trav.setText("1");
        botao("Já acordei à noite sem conseguir respirar", R.style.BotaoContorno, () -> dpn = !dpn);
        texto("De 0 (nada) a 10 (muito forte), quanta falta de ar?");
        EditText intensidade = campo("0 a 10");
        botao("Registrar", R.style.BotaoPrimario, () -> {
            int nyha = repouso ? 4 : esforcoLeve ? 3 : atividade ? 2 : 1;
            JSONObject q = new JSONObject();
            try {
                q.put("nyha", nyha);
                q.put("travesseiros", numero(trav.getText().toString()));
                q.put("dispneia_paroxistica_noturna", dpn);
            } catch (Exception ignored) { }
            gravarSintoma("dyspnea", q, null, intensidade(intensidade), null, false);
        });
    }

    private void formularioPalpitacao() {
        titulo("Palpitação (coração disparado)");
        texto("Começou de repente ou foi piorando aos poucos?");
        botao("De repente", R.style.BotaoContorno, () -> inicioSubito = true);
        botao("Aos poucos", R.style.BotaoContorno, () -> inicioSubito = false);
        texto("O batimento estava regular ou desorganizado?");
        botao("Regular", R.style.BotaoContorno, () -> ritmoRegular = true);
        botao("Irregular", R.style.BotaoContorno, () -> ritmoRegular = false);
        texto("Quanto tempo durou (minutos)");
        EditText dur = campo("");
        texto("De 0 (nada) a 10 (muito forte), quanto incomodou?");
        EditText intensidade = campo("0 a 10");
        botao("Registrar", R.style.BotaoPrimario, () -> {
            JSONObject q = new JSONObject();
            try {
                q.put("inicio_subito", inicioSubito != null && inicioSubito);
                q.put("ritmo_regular", ritmoRegular != null && ritmoRegular);
            } catch (Exception ignored) { }
            gravarSintoma("palpitations", q, minutos(dur), intensidade(intensidade), null, false);
        });
    }

    private void formularioEdema() {
        titulo("Inchaço nas pernas");
        texto("Onde está inchado?");
        for (String l : new String[] {"Tornozelo", "Perna", "Abdome"}) botao(l, R.style.BotaoContorno, () -> localEdema = l);
        texto("Se apertar com o dedo, fica marcado?");
        botao("Sim", R.style.BotaoContorno, () -> cacifo = true);
        botao("Não", R.style.BotaoContorno, () -> cacifo = false);
        texto("Piora em que período?");
        botao("Manhã", R.style.BotaoContorno, () -> periodo = "Manhã");
        botao("Fim do dia", R.style.BotaoContorno, () -> periodo = "Fim do dia");
        botao("Registrar", R.style.BotaoPrimario, () -> {
            JSONObject q = new JSONObject();
            try {
                q.put("local", localEdema);
                q.put("cacifo", cacifo != null && cacifo);
                q.put("periodo", periodo);
            } catch (Exception ignored) { }
            gravarSintoma("edema", q, null, null, null, false);
        });
    }

    private void formularioQuase() {
        titulo("Quase desmaiei");
        aviso("", "Se desmaiar de verdade, pare e procure emergência na hora.");
        texto("Aconteceu fazendo o quê?");
        for (String c : new String[] {"Esforço", "Ao levantar rápido", "Ao urinar"}) botao(c, R.style.BotaoContorno, () -> contexto = c);
        texto("Quer contar mais alguma coisa?");
        EditText notas = campo("Sentiu algum aviso antes (tontura, visão escura, suor)?");
        botao("Registrar", R.style.BotaoPrimario, () -> {
            JSONObject q = new JSONObject();
            try { q.put("contexto", contexto); } catch (Exception ignored) { }
            gravarSintoma("presyncope", q, null, null, notas.getText().toString(), false);
        });
    }

    private void formularioPerna() {
        titulo("Dor na perna ao andar");
        texto("Quantos metros/quarteirões você anda até a dor aparecer?");
        EditText dist = campo("ex.: 2 quarteirões");
        botao("Registrar", R.style.BotaoPrimario, () -> {
            JSONObject q = new JSONObject();
            try { q.put("distancia", dist.getText().toString()); } catch (Exception ignored) { }
            gravarSintoma("claudication", q, null, null, null, false);
        });
    }

    private void formularioTosse() {
        titulo("Tosse seca");
        texto("Tosse seca pode ser efeito de um dos seus remédios — vale contar ao médico.");
        texto("Quer contar mais alguma coisa?");
        EditText notas = campo("Quando começou, o que piora ou melhora...");
        botao("Registrar", R.style.BotaoPrimario, () -> gravarSintoma("dry_cough", new JSONObject(), null, null, notas.getText().toString(), false));
    }

    private void formularioNota(boolean cansaco) {
        titulo(cansaco ? "Cansaço fora do comum" : "Tontura");
        EditText intensidade = null;
        if (cansaco) {
            texto("De 0 (nada) a 10 (muito forte), quanto cansaço?");
            intensidade = campo("0 a 10");
        }
        texto("Quer contar mais alguma coisa?");
        EditText notas = campo("Quer contar mais alguma coisa?");
        EditText notaFinal = intensidade;
        botao("Registrar", R.style.BotaoPrimario, () -> gravarSintoma(cansaco ? "fatigue" : "dizziness", new JSONObject(), null,
                cansaco ? intensidade(notaFinal) : null, notas.getText().toString(), false));
    }

    private void gravarEmergencia(String tipo, JSONObject q, Integer minutos) {
        emergencia();
        rede.execute(() -> {
            String erro = enviarSintoma(tipo, q, minutos, null, null, true);
            if (erro != null) activity.runOnUiThread(() -> texto("Registrei no aparelho, mas não consegui enviar ao seu médico. Avise-o."));
        });
    }

    private void gravarSintoma(String tipo, JSONObject q, Integer minutos, Integer intensidade, String notas, boolean emergencia) {
        rede.execute(() -> {
            String erro = enviarSintoma(tipo, q, minutos, intensidade, notas, emergencia);
            activity.runOnUiThread(() -> {
                if (erro != null) texto(erro);
                else {
                    texto("Registrado. Seu médico consegue ver.");
                    listaSintomas();
                }
            });
        });
    }

    private String enviarSintoma(String tipo, JSONObject q, Integer minutos, Integer intensidade, String notas, boolean emergencia) {
        try {
            JSONObject o = new JSONObject();
            o.put("patient_user_id", conta.uidAtual());
            o.put("symptom_type", tipo);
            o.put("occurred_at", Instant.now().toString());
            o.put("duration_minutes", minutos == null ? JSONObject.NULL : minutos);
            o.put("intensity", intensidade == null ? JSONObject.NULL : intensidade);
            o.put("qualifiers", q == null ? new JSONObject() : q);
            o.put("notes", notas == null || notas.trim().isEmpty() ? JSONObject.NULL : notas.trim());
            if (emergencia) o.put("triaged_as", "emergency");
            String erro = conta.gravar("POST", "symptom_reports", o.toString(), emergencia);
            return erro;
        } catch (Exception ex) {
            return "Não consegui registrar o sintoma.";
        }
    }

    private void emergencia() {
        limpar();
        titulo("Emergência");
        texto("Se você não está bem, ligue agora.");
        botao("Ligar 192", R.style.BotaoPrimario, () -> activity.startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:192"))));
        texto("SAMU — atendimento de urgência");
        texto("Quando ligar\nDor no peito que não passa\nFalta de ar que começou de repente\nDesmaio\nFala enrolada ou fraqueza de um lado do corpo");
        texto("Enquanto espera\nSente-se ou deite-se em um lugar confortável.\nNão dirija até o hospital — peça para alguém te levar, ou aguarde a ambulância.\nAvise alguém perto de você para ficar junto enquanto espera.\n\nDepois de procurar atendimento, avise seu médico assim que puder.");
        voltarBotao();
    }

    private void sono() {
        limpar();
        titulo("Sono");
        sub("O que a pulseira registrou à noite");
        try {
            String uid = conta.uidAtual();
            JSONArray noites = conta.lista("sleep_records?patient_user_id=eq." + Conta.enc(uid)
                    + "&select=sleep_date,total_minutes,efficiency_pct,awakenings,min_heart_rate,min_spo2,deep_minutes,light_minutes,rem_minutes&order=sleep_date.desc&limit=14");
            if (noites.length() == 0) {
                texto("Sem dados de sono");
                texto("Conecte sua pulseira para acompanhar o sono aqui.");
                voltarBotao();
                return;
            }
            boolean queda = false;
            for (int i = 0; i < Math.min(7, noites.length()); i++) {
                JSONObject n = noites.getJSONObject(i);
                if (!n.isNull("min_spo2") && n.optInt("min_spo2") < 90) queda = true;
            }
            JSONObject ultima = noites.getJSONObject(0);
            if (queda && !ultima.isNull("min_spo2")) {
                aviso("Oxigenação caindo durante o sono", "Sua oxigenação caiu várias vezes durante o sono. Comente com seu médico — pode valer investigar seu sono.");
            }
            texto("Sua última noite");
            texto("Tempo dormindo: " + duracao(ultima, "total_minutes"));
            texto("Eficiência: " + (ultima.isNull("efficiency_pct") ? "sem registro" : ultima.opt("efficiency_pct") + "%"));
            texto("Despertares: " + (ultima.isNull("awakenings") ? "sem registro" : String.valueOf(ultima.optInt("awakenings"))));
            texto("Batimentos mínimos: " + (ultima.isNull("min_heart_rate") || ultima.optInt("min_heart_rate") == 0 ? "sem registro" : ultima.optInt("min_heart_rate") + " bpm"));
            texto("Oxigenação mínima: " + (ultima.isNull("min_spo2") ? "sem registro" : ultima.optInt("min_spo2") + "%"));
            if (!ultima.isNull("deep_minutes") || !ultima.isNull("light_minutes") || !ultima.isNull("rem_minutes")) {
                texto("Composição da última noite");
                int total = Math.max(1, ultima.optInt("total_minutes"));
                if (!ultima.isNull("deep_minutes")) texto("Sono profundo: " + minutosTexto(ultima.optInt("deep_minutes")) + " · " + Math.round(ultima.optInt("deep_minutes") * 100f / total) + "%");
                if (!ultima.isNull("light_minutes")) texto("Sono leve: " + minutosTexto(ultima.optInt("light_minutes")) + " · " + Math.round(ultima.optInt("light_minutes") * 100f / total) + "%");
                if (!ultima.isNull("rem_minutes")) texto("Sono REM (fase dos sonhos): " + minutosTexto(ultima.optInt("rem_minutes")) + " · " + Math.round(ultima.optInt("rem_minutes") * 100f / total) + "%");
            }
            JSONObject alvo = null;
            try { alvo = conta.lista("cardio_targets?patient_user_id=eq." + Conta.enc(uid) + "&select=sleep_hours&limit=1").optJSONObject(0); } catch (Exception ignored) { }
            double meta = alvo == null || alvo.isNull("sleep_hours") ? 7 : alvo.optDouble("sleep_hours", 7);
            texto("Duração — 14 noites · meta " + meta + " h");
            for (int i = noites.length() - 1; i >= 0; i--) {
                JSONObject n = noites.getJSONObject(i);
                texto(n.optString("sleep_date") + ": " + duracao(n, "total_minutes"));
            }
        } catch (Exception ex) {
            texto("Não consegui carregar o sono.");
        }
        voltarBotao();
    }

    private void alimentacao() {
        limpar();
        titulo("Alimentação");
        sub("Uma pergunta por refeição — sem tabela, sem contagem de calorias");
        try {
            String uid = conta.uidAtual();
            String hoje = LocalDate.now(ZoneOffset.UTC).toString();
            int alvo = 2000;
            JSONArray alvos = conta.lista("cardio_targets?patient_user_id=eq." + Conta.enc(uid) + "&select=sodium_mg_day&limit=1");
            if (alvos.length() > 0 && !alvos.getJSONObject(0).isNull("sodium_mg_day")) alvo = alvos.getJSONObject(0).optInt("sodium_mg_day", 2000);
            JSONArray regs = conta.lista("sodium_entries?patient_user_id=eq." + Conta.enc(uid) + "&dia=gte." + LocalDate.now(ZoneOffset.UTC).minusDays(9) + "&select=dia,refeicao,opcao,sodio_mg");
            int total = 0;
            String[] escolhas = new String[4];
            String[] chaves = {"cafe", "almoco", "lanche", "jantar"};
            for (int i = 0; i < regs.length(); i++) {
                JSONObject r = regs.getJSONObject(i);
                if (hoje.equals(r.optString("dia"))) {
                    total += r.optInt("sodio_mg");
                    for (int k = 0; k < chaves.length; k++) if (chaves[k].equals(r.optString("refeicao"))) escolhas[k] = r.optString("opcao");
                }
            }
            int pct = alvo == 0 ? 0 : Math.round(total * 100f / alvo);
            String frase = total == 0 ? "Nenhuma refeição registrada hoje."
                    : total <= alvo ? "Cerca de " + total + " mg de sódio hoje — dentro da referência de " + alvo + " mg."
                    : "Cerca de " + total + " mg de sódio hoje, acima da referência de " + alvo + " mg. A maior parte costuma vir de industrializados, não do saleiro.";
            texto("Hoje");
            texto(frase);
            texto((pct > 100 ? "Acima da referência do dia" : "Do valor de referência do dia") + ": " + pct + "% de " + alvo + " mg");
            if (pct > 100) texto("A barra chega ao fim em " + alvo + " mg; hoje o total passou disso.");
            texto("O que você comeu hoje?");
            String[][] opcoes = {
                    {"caseira_sem_sal", "Comida de casa, com pouco sal", "400"},
                    {"caseira_normal", "Comida de casa, sal normal", "900"},
                    {"restaurante", "Restaurante ou marmita", "1400"},
                    {"embutidos", "Pão com frios, queijo ou embutido", "1200"},
                    {"industrializado", "Congelado, enlatado ou macarrão instantâneo", "1600"},
                    {"fastfood", "Lanche de rua ou fast-food", "1800"},
                    {"leve", "Fruta, café, lanche leve", "120"},
            };
            String[] rotulos = {"Café da manhã", "Almoço", "Lanche", "Jantar"};
            for (int k = 0; k < chaves.length; k++) {
                texto(rotulos[k]);
                for (String[] op : opcoes) {
                    boolean sel = op[0].equals(escolhas[k]);
                    String refeicao = chaves[k];
                    String chave = op[0];
                    int mg = Integer.parseInt(op[2]);
                    botao((sel ? "● " : "") + op[1], R.style.BotaoContorno, () -> rede.execute(() -> {
                        try {
                            JSONObject o = new JSONObject();
                            o.put("patient_user_id", conta.uidAtual());
                            o.put("dia", LocalDate.now(ZoneOffset.UTC).toString());
                            o.put("refeicao", refeicao);
                            o.put("opcao", chave);
                            o.put("sodio_mg", mg);
                            String erro = conta.gravar("POST", "sodium_entries?on_conflict=patient_user_id,dia,refeicao", o.toString(), true);
                            activity.runOnUiThread(() -> {
                                if (erro != null) texto(erro.equals("Não consegui gravar agora.") ? "O registro de sal não foi gravado. Tente de novo." : erro);
                                else abrir("alimentacao");
                            });
                        } catch (Exception ex) {
                            activity.runOnUiThread(() -> texto("Não consegui salvar."));
                        }
                    }));
                }
            }
            int soma = 0;
            int dias = 0;
            for (int i = 0; i < 7; i++) {
                String dia = LocalDate.now(ZoneOffset.UTC).minusDays(i).toString();
                int doDia = 0;
                for (int r = 0; r < regs.length(); r++) if (dia.equals(regs.getJSONObject(r).optString("dia"))) doDia += regs.getJSONObject(r).optInt("sodio_mg");
                if (doDia > 0) { soma += doDia; dias++; }
            }
            texto("Média dos últimos 7 dias");
            texto(dias == 0 ? "Sem registro" : Math.round(soma / (float) dias) + " mg");
        } catch (Exception ex) {
            texto("Não consegui carregar a alimentação.");
        }
        voltarBotao();
    }

    private void caminhada() {
        limpar();
        titulo("Caminhada");
        sub("Sessão guiada e testes de capacidade");
        try {
            String uid = conta.uidAtual();
            JSONArray alvos = conta.lista("cardio_targets?patient_user_id=eq." + Conta.enc(uid) + "&select=training_hr_min,training_hr_max&limit=1");
            zonaMin = zonaMax = null;
            if (alvos.length() > 0 && !alvos.getJSONObject(0).isNull("training_hr_min") && !alvos.getJSONObject(0).isNull("training_hr_max")) {
                zonaMin = alvos.getJSONObject(0).optInt("training_hr_min");
                zonaMax = alvos.getJSONObject(0).optInt("training_hr_max");
            }
        } catch (Exception ignored) { }
        desenharCaminhada();
    }

    private void desenharCaminhada() {
        if (!"caminhada".equals(atual)) return;
        limpar();
        titulo("Caminhada");
        sub("Sessão guiada e testes de capacidade");
        if (zonaMin == null || zonaMax == null) {
            aviso("", "Seu médico ainda não definiu uma faixa de batimentos para os seus exercícios. Enquanto isso a caminhada fica livre: o app mostra seus batimentos, sem faixa-alvo.");
        } else {
            texto("Faixa definida pelo seu médico: " + zonaMin + " a " + zonaMax + " batimentos por minuto.");
        }
        Integer bpm = pulso == null ? null : pulso.get();
        String estado = textoZona(bpm);
        texto("Pare a caminhada e procure atendimento se sentir");
        texto("Dor ou aperto no peito\nFalta de ar que não passa ao diminuir o passo\nTontura, enjoo ou vontade de desmaiar\nBatimentos irregulares que você sente\nDor em uma das pernas que aperta ao andar\nSuor frio");
        if ("ativa".equals(fase) || "pausada".equals(fase)) {
            int mm = segundos / 60;
            int ss = segundos % 60;
            texto(String.format(java.util.Locale.ROOT, "%02d:%02d", mm, ss));
            texto("Pulseira: " + (bpm == null ? "—" : bpm + " bpm"));
            texto(estado);
            if ("ativa".equals(fase)) botao("Pausar", R.style.BotaoContorno, () -> { fase = "pausada"; pararRelogio(); desenharCaminhada(); });
            else botao("Continuar", R.style.BotaoContorno, () -> { fase = "ativa"; ligarRelogio(); desenharCaminhada(); });
            botao("Encerrar", R.style.BotaoPrimario, () -> { fase = "fim"; pararRelogio(); desenharCaminhada(); });
        } else if ("fim".equals(fase)) {
            texto("Salvar caminhada");
            botao("Salvar caminhada", R.style.BotaoPrimario, this::salvarCaminhada);
        } else {
            botao("Começar a caminhar", R.style.BotaoPrimario, () -> {
                segundos = 0;
                segundosNaZona = 0;
                fase = "ativa";
                ligarRelogio();
                desenharCaminhada();
            });
        }
        texto("Testes de capacidade");
        botao("Caminhada de 6 minutos", R.style.BotaoContorno, () -> { fase = "seis"; restante = 360; desenharTeste(); });
        botao("Sentar e levantar", R.style.BotaoContorno, () -> { fase = "sentar"; restante = 30; contagem = 0; desenharTeste(); });
        botao("Recuperação dos batimentos", R.style.BotaoContorno, () -> { fase = "recupera"; desenharTeste(); });
        voltarBotao();
    }

    private void desenharTeste() {
        limpar();
        if ("seis".equals(fase)) {
            titulo("Caminhada de 6 minutos");
            texto("Ande no seu ritmo mais rápido confortável, em um terreno plano, por 6 minutos. Pode diminuir o passo ou parar se precisar — depois retome se der.");
            botao("Iniciar os 6 minutos", R.style.BotaoPrimario, () -> { restante = 360; fase = "seis-anda"; ligarRestante(this::desenharTeste); desenharTeste(); });
        } else if ("seis-anda".equals(fase)) {
            titulo("Caminhada de 6 minutos");
            texto(String.format(java.util.Locale.ROOT, "%02d:%02d", restante / 60, restante % 60));
            texto("tempo restante");
            botao("Terminei antes", R.style.BotaoContorno, () -> { pararRelogio(); fase = "seis-medir"; desenharTeste(); });
        } else if ("seis-medir".equals(fase)) {
            titulo("Caminhada de 6 minutos");
            texto("Quantos metros você andou?");
            texto("Não sabe o exato? Conte os passos e multiplique por cerca de 0,7 metro, ou use o mapa do celular.");
            EditText metros = campo("ex.: 420");
            texto("Feito em casa, esse teste é uma estimativa e não substitui o teste no consultório.");
            botao("Salvar resultado", R.style.BotaoPrimario, () -> salvarTeste("walk_6min", numero(metros.getText().toString()), null, null));
        } else if ("sentar".equals(fase)) {
            titulo("Sentar e levantar");
            texto("Sente em uma cadeira firme, sem apoiar as mãos. Quando começar, levante e sente o máximo de vezes que conseguir em 30 segundos.");
            botao("Iniciar os 30 segundos", R.style.BotaoPrimario, () -> { restante = 30; contagem = 0; fase = "sentar-conta"; ligarRestante(this::desenharTeste); desenharTeste(); });
        } else if ("sentar-conta".equals(fase)) {
            titulo("Sentar e levantar");
            texto(restante + "s");
            texto("tempo restante");
            texto(String.valueOf(contagem));
            botao("+ 1 (levantei)", R.style.BotaoPrimario, () -> { contagem++; desenharTeste(); });
        } else if ("sentar-fim".equals(fase)) {
            titulo("Sentar e levantar");
            texto("Você fez " + contagem + " repetições.");
            botao("Salvar resultado", R.style.BotaoPrimario, () -> salvarTeste("sit_to_stand_30s", contagem, null, null));
        } else if ("recupera".equals(fase)) {
            titulo("Recuperação dos batimentos");
            texto("Logo depois de fazer algum esforço (a própria caminhada guiada serve), registre seus batimentos.");
            Integer bpm = pulso == null ? null : pulso.get();
            texto("Pulseira: " + (bpm == null ? "—" : bpm + " bpm"));
            texto("Batimentos agora");
            EditText pico = campo("ex.: 128");
            if (bpm != null) botao("Usar pulseira", R.style.BotaoContorno, () -> pico.setText(String.valueOf(bpm)));
            botao("Começar a contar 1 minuto", R.style.BotaoPrimario, () -> {
                if (pico.getText().toString().trim().isEmpty()) return;
                fase = "recupera-espera";
                restante = 60;
                ligarRestante(() -> desenharRecupera(pico.getText().toString()));
                desenharRecupera(pico.getText().toString());
            });
        }
        botao("Voltar", R.style.BotaoContorno, () -> { pararRelogio(); fase = ""; rede.execute(this::caminhada); });
    }

    private void desenharRecupera(String pico) {
        limpar();
        titulo("Recuperação dos batimentos");
        if ("recupera-espera".equals(fase)) {
            texto(restante + "s");
            texto("fique parado, sem se esforçar");
        } else {
            texto("Agora registre seus batimentos de novo.");
            Integer bpm = pulso == null ? null : pulso.get();
            texto("Pulseira: " + (bpm == null ? "—" : bpm + " bpm"));
            texto("Batimentos agora, 1 minuto depois");
            EditText fim = campo("ex.: 104");
            if (bpm != null) botao("Usar pulseira", R.style.BotaoContorno, () -> fim.setText(String.valueOf(bpm)));
            botao("Salvar resultado", R.style.BotaoPrimario, () -> {
                int a = numero(pico);
                int b = numero(fim.getText().toString());
                if (a <= 0 || b <= 0) return;
                int queda = a - b;
                texto(queda >= 12
                        ? "Recuperação esperada. Seu coração desacelerou " + queda + " batimentos no primeiro minuto depois do esforço — dentro do esperado."
                        : "Recuperação lenta. Seu coração desacelerou " + queda + " batimentos no primeiro minuto. Vale comentar com seu médico na próxima consulta.");
                salvarTeste("hr_recovery", queda, a, b);
            });
        }
        botao("Voltar", R.style.BotaoContorno, () -> { pararRelogio(); fase = ""; rede.execute(this::caminhada); });
    }

    private void salvarCaminhada() {
        Integer bpm = pulso == null ? null : pulso.get();
        int duracao = segundos;
        int naZona = segundosNaZona;
        rede.execute(() -> {
            try {
                JSONObject o = new JSONObject();
                o.put("patient_user_id", conta.uidAtual());
                o.put("iniciada_em", Instant.now().minusSeconds(duracao).toString());
                o.put("duracao_segundos", duracao);
                o.put("segundos_na_zona", naZona);
                o.put("fc_media", bpm == null ? JSONObject.NULL : bpm);
                o.put("interrompida", false);
                if (zonaMin != null) o.put("zona_min", zonaMin);
                if (zonaMax != null) o.put("zona_max", zonaMax);
                String erro = conta.gravar("POST", "walk_sessions", o.toString(), false);
                activity.runOnUiThread(() -> {
                    fase = "";
                    if (erro != null) texto(erro.equals("Não consegui gravar agora.") ? "Não consegui salvar a caminhada." : erro);
                    else { texto("Caminhada registrada."); rede.execute(this::caminhada); }
                });
            } catch (Exception ex) {
                activity.runOnUiThread(() -> texto("Não consegui salvar a caminhada."));
            }
        });
    }

    private void salvarTeste(String tipo, int valor, Integer pico, Integer fim) {
        if (valor <= 0 && !"sit_to_stand_30s".equals(tipo)) return;
        rede.execute(() -> {
            try {
                JSONObject o = new JSONObject();
                o.put("patient_user_id", conta.uidAtual());
                o.put("tipo", tipo);
                o.put("valor", valor);
                if (pico != null) o.put("fc_pico", pico);
                if (fim != null) o.put("fc_final", fim);
                String erro = conta.gravar("POST", "capacity_tests", o.toString(), false);
                activity.runOnUiThread(() -> {
                    pararRelogio();
                    fase = "";
                    if (erro != null) texto("Não consegui salvar o teste.");
                    else { texto("Teste registrado."); rede.execute(this::caminhada); }
                });
            } catch (Exception ex) {
                activity.runOnUiThread(() -> texto("Não consegui salvar o teste."));
            }
        });
    }

    private String textoZona(Integer bpm) {
        if (bpm == null || zonaMin == null || zonaMax == null) return "Caminhada livre — sem faixa definida.";
        if (bpm < zonaMin) return "Você pode acelerar um pouco o passo, se estiver confortável.";
        if (bpm > zonaMax) return "Está acima da faixa definida pelo seu médico. Diminua o passo.";
        return "Está na faixa que seu médico definiu.";
    }

    private void ligarRelogio() {
        pararRelogio();
        relogio = new Runnable() {
            @Override public void run() {
                if (!"ativa".equals(fase)) return;
                segundos++;
                Integer bpm = pulso == null ? null : pulso.get();
                if (bpm != null && zonaMin != null && zonaMax != null && bpm >= zonaMin && bpm <= zonaMax) segundosNaZona++;
                desenharCaminhada();
                handler.postDelayed(this, 1000);
            }
        };
        handler.postDelayed(relogio, 1000);
    }

    private void ligarRestante(Runnable redesenha) {
        pararRelogio();
        relogio = new Runnable() {
            @Override public void run() {
                restante--;
                if (restante <= 0) {
                    if ("seis-anda".equals(fase)) fase = "seis-medir";
                    else if ("sentar-conta".equals(fase)) fase = "sentar-fim";
                    else if ("recupera-espera".equals(fase)) fase = "recupera-fim";
                    redesenha.run();
                    return;
                }
                redesenha.run();
                handler.postDelayed(this, 1000);
            }
        };
        handler.postDelayed(relogio, 1000);
    }

    private void pararRelogio() {
        if (relogio != null) handler.removeCallbacks(relogio);
        relogio = null;
    }

    private void limpar() {
        ui(() -> corpo.removeAllViews());
    }

    private void titulo(String s) {
        ui(() -> {
            TextView t = novo(s, 28, true);
            t.setPadding(0, 0, 0, dp(4));
            corpo.addView(t);
        });
    }

    private void sub(String s) {
        ui(() -> {
            TextView t = novo(s, 16, false);
            t.setTextColor(activity.getColor(R.color.secundaria));
            corpo.addView(t);
        });
    }

    private void texto(String s) {
        ui(() -> {
            TextView t = novo(s, 16, false);
            t.setPadding(0, dp(12), 0, 0);
            corpo.addView(t);
        });
    }

    private void textoAviso(String s) {
        TextView t = novo(s, 16, true);
        t.setTextColor(activity.getColor(R.color.aviso));
        corpo.addView(t);
    }

    private void aviso(String titulo, String corpoTxt) {
        if (!titulo.isEmpty()) texto(titulo);
        ui(() -> {
            TextView t = novo(corpoTxt, 16, false);
            t.setTextColor(activity.getColor(R.color.aviso));
            t.setPadding(0, dp(8), 0, 0);
            corpo.addView(t);
        });
    }

    private EditText campo(String dica) {
        EditText e = new EditText(activity);
        e.setHint(dica);
        e.setMinHeight(dp(56));
        e.setTextColor(activity.getColor(R.color.tinta));
        e.setBackgroundResource(R.drawable.campo);
        e.setPadding(dp(12), dp(8), dp(12), dp(8));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = dp(8);
        corpo.addView(e, lp);
        return e;
    }

    private EditText campoDuracao() {
        return campo("");
    }

    private void botao(String rotulo, int estilo, Runnable acao) {
        ui(() -> {
            Button b = new Button(activity, null, 0, estilo);
            b.setText(rotulo);
            b.setAllCaps(false);
            b.setGravity(Gravity.CENTER);
            b.setOnClickListener(v -> acao.run());
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
            lp.topMargin = dp(8);
            corpo.addView(b, lp);
        });
    }

    private void voltarBotao() {
        botao("Voltar", R.style.BotaoContorno, () -> { pararRelogio(); if (voltar != null) voltar.run(); });
    }

    private TextView novo(String s, int sp, boolean negrito) {
        TextView t = new TextView(activity);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(activity.getColor(R.color.tinta));
        if (negrito) t.setTypeface(null, android.graphics.Typeface.BOLD);
        return t;
    }

    private int dp(int v) {
        return Math.round(v * activity.getResources().getDisplayMetrics().density);
    }

    private static boolean marcada(JSONArray tomou, String id, String hora) throws Exception {
        for (int i = 0; i < tomou.length(); i++) {
            JSONObject t = tomou.getJSONObject(i);
            if (id.equals(t.optString("medication_id")) && hora.equals(t.optString("scheduled_time")) && t.optBoolean("taken")) return true;
        }
        return false;
    }

    private static double adesao(JSONArray lista, int dias) throws Exception {
        String corte = LocalDate.now(ZoneOffset.UTC).minusDays(dias).toString();
        int n = 0;
        int ok = 0;
        for (int i = 0; i < lista.length(); i++) {
            JSONObject x = lista.getJSONObject(i);
            if (x.optString("intake_date").compareTo(corte) < 0) continue;
            n++;
            if (x.optBoolean("taken")) ok++;
        }
        return n == 0 ? -1 : (double) ok / n;
    }

    private static String pct(double v) {
        return v < 0 ? "—" : Math.round(v * 100) + "%";
    }

    private static String classe(String c) {
        switch (c) {
            case "acei": return "Inibidor da ECA (IECA)";
            case "arb": return "Bloqueador do receptor de angiotensina (BRA)";
            case "arni": return "Sacubitril-valsartana (ARNI)";
            case "beta_blocker": return "Betabloqueador";
            case "ccb": return "Bloqueador de cálcio";
            case "sglt2": return "Protetor do rim e do coração (iSGLT2)";
            case "mra": return "Antagonista mineralocorticoide";
            case "loop_diuretic": return "Diurético de alça";
            case "thiazide": return "Tiazídico";
            case "statin": return "Estatina";
            case "ezetimibe": return "Ezetimiba";
            case "pcsk9": return "Inibidor de PCSK9";
            case "antiplatelet": return "Antiagregante";
            case "anticoagulant": return "Anticoagulante";
            case "antiarrhythmic": return "Antiarrítmico";
            case "nitrate": return "Nitrato";
            default: return "Outro";
        }
    }

    private static String paraQue(String c) {
        switch (c) {
            case "acei":
            case "arb": return "Controla a pressão e protege o coração e os rins.";
            case "arni": return "Fortalece o coração na insuficiência cardíaca.";
            case "beta_blocker": return "Deixa o coração bater mais devagar e com menos esforço.";
            case "ccb": return "Relaxa os vasos sanguíneos para baixar a pressão.";
            case "sglt2": return "Protege o coração e os rins, e ajuda a controlar o açúcar no sangue.";
            case "mra": return "Ajuda a tirar o excesso de líquido e protege o coração.";
            case "loop_diuretic": return "Tira o excesso de líquido do corpo — o \"diurético\".";
            case "thiazide": return "Tira o excesso de líquido e ajuda a controlar a pressão.";
            case "statin": return "Baixa o colesterol para proteger as artérias.";
            case "ezetimibe": return "Ajuda a baixar o colesterol.";
            case "pcsk9": return "Baixa bastante o colesterol quando os outros remédios não bastam.";
            case "antiplatelet": return "Deixa o sangue menos propenso a formar coágulos.";
            case "anticoagulant": return "Afina o sangue para prevenir coágulos.";
            case "antiarrhythmic": return "Ajuda o coração a manter o ritmo certo.";
            case "nitrate": return "Alivia a dor no peito abrindo os vasos do coração.";
            default: return "Faz parte do seu tratamento — pergunte ao seu médico se tiver dúvida.";
        }
    }

    private static String juntar(JSONArray horas) {
        if (horas == null || horas.length() == 0) return "";
        List<String> p = new ArrayList<>();
        for (int i = 0; i < horas.length(); i++) p.add(horas.optString(i));
        return String.join(", ", p);
    }

    private static String nomeMed(JSONArray meds, String id) throws Exception {
        for (int i = 0; i < meds.length(); i++) if (id.equals(meds.getJSONObject(i).optString("id"))) return meds.getJSONObject(i).optString("name");
        return "Remédio";
    }

    private static String duracao(JSONObject n, String campo) {
        if (n.isNull(campo)) return "sem registro";
        return minutosTexto(n.optInt(campo));
    }

    private static String minutosTexto(int min) {
        int h = min / 60;
        int m = min % 60;
        if (h > 0) return h + " h " + String.format(java.util.Locale.ROOT, "%02d", m) + " min";
        return m + " min";
    }

    private static Integer minutos(EditText e) {
        if (e == null) return null;
        String s = e.getText().toString().trim();
        if (s.isEmpty()) return null;
        try { return Integer.parseInt(s); } catch (Exception ex) { return null; }
    }

    private static int numero(String s) {
        try { return Integer.parseInt(s.trim()); } catch (Exception ex) { return 0; }
    }

    private static Integer intensidade(EditText e) {
        if (e == null || e.getText().toString().trim().isEmpty()) return null;
        int n = numero(e.getText().toString());
        return Math.max(0, Math.min(10, n));
    }
}
