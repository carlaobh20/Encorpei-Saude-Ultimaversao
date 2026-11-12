package saude.encorpei.pulseira;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * A mesma conta do site: login de {@code AuthPage} e gravação de
 * {@code useWearableSync} em {@code registered_devices} e {@code hr_readings}.
 * A chave é a publishable de {@code src/lib/config.ts}, não a service_role.
 */
public final class Conta {
    static final String URL_BASE = "https://rmodoqflmabzfsqieiln.supabase.co";
    static final String CHAVE = "sb_publishable_47xoBuULGGAehheD2sAZ0w_KBqb_vMh";

    private static Conta instancia;

    private final SharedPreferences prefs;
    private final CopyOnWriteArrayList<Runnable> ouvintes = new CopyOnWriteArrayList<>();
    private final Object trava = new Object();

    private long ultimaTentativa;
    private long anterior;
    private String deviceId;
    private String deviceNome;
    static final String LINK_AUTH = "encorpei://auth";
    static final String LINK_SENHA = "encorpei://reset-password";

    private String recuperacaoAccess;
    private String recuperacaoRefresh;
    public boolean aguardandoSenha;

    public int gravadas;
    public String ultimaIso;
    public String erroEnvio;
    public boolean temMedico;
    public boolean medicoConhecido;
    public int batimentos;
    public int oxigenacao;
    public int pressao;
    public int passos;
    public int sono;
    public String nomePessoa = "";
    public String textoHoje = "";
    public String textoMeta = "";
    public String nomeMedico = "Meu médico";
    public String clinicaMedico = "";
    public String textoMensagens = "";

    private Conta(Context contexto) {
        prefs = contexto.getApplicationContext().getSharedPreferences("encorpei_conta", Context.MODE_PRIVATE);
    }

    public static Conta obter(Context contexto) {
        if (instancia == null) instancia = new Conta(contexto);
        return instancia;
    }

    public void ouvir(Runnable r) {
        ouvintes.add(r);
    }

    public void esquecer(Runnable r) {
        ouvintes.remove(r);
    }

    public boolean temSessao() {
        return prefs.getString("access", null) != null && prefs.getString("uid", null) != null;
    }

    public String email() {
        return prefs.getString("email", "");
    }

    /** Nova conexão: o relógio do throttle e a contagem da sessão zeram, como na tela. */
    public void reiniciarSessao() {
        synchronized (trava) {
            ultimaTentativa = 0;
            anterior = 0;
            deviceId = null;
            deviceNome = null;
        }
        gravadas = 0;
        erroEnvio = null;
        avisar();
    }

    /**
     * @return null se entrou; senão a frase da tela de login.
     */
    public String entrar(String email, String senha) {
        String e = email == null ? "" : email.trim();
        if (e.isEmpty() || senha == null || senha.isEmpty()) return "Preencha e-mail e senha.";
        try {
            Http r = pedir("POST", URL_BASE + "/auth/v1/token?grant_type=password",
                    "{\"email\":" + Gravacao.j(e) + ",\"password\":" + Gravacao.j(senha) + "}",
                    null, null, null);
            if (r.codigo < 200 || r.codigo >= 300) {
                String msg = texto(r.corpo).toLowerCase();
                if (msg.contains("email not confirmed") || msg.contains("email_not_confirmed")) {
                    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada (e a pasta de spam).";
                }
                return "E-mail ou senha incorretos. Verifique e tente de novo.";
            }
            JSONObject json = new JSONObject(r.corpo);
            String access = json.getString("access_token");
            String refresh = json.optString("refresh_token", "");
            String uid = json.getJSONObject("user").getString("id");
            long exp = System.currentTimeMillis() + json.optLong("expires_in", 3600) * 1000L;
            if (eProfissional(access, uid)) {
                try {
                    pedir("POST", URL_BASE + "/auth/v1/logout", "{}", access, null, null);
                } catch (Exception ignored) {
                    /* a sessão não fica neste app */
                }
                return "Este e-mail está cadastrado como médico. Entre pelo portal do médico.";
            }
            prefs.edit()
                    .putString("access", access)
                    .putString("refresh", refresh)
                    .putString("uid", uid)
                    .putLong("exp", exp)
                    .putString("email", e)
                    .apply();
            erroEnvio = null;
            avisar();
            return null;
        } catch (Exception ex) {
            return "Não foi possível confirmar seu acesso agora. Tente de novo.";
        }
    }

    public void sair() {
        String access = prefs.getString("access", null);
        prefs.edit().clear().apply();
        synchronized (trava) {
            deviceId = null;
            deviceNome = null;
            ultimaTentativa = 0;
        }
        gravadas = 0;
        ultimaIso = null;
        erroEnvio = null;
        temMedico = false;
        medicoConhecido = false;
        batimentos = oxigenacao = pressao = passos = sono = 0;
        avisar();
        if (access == null) return;
        try {
            pedir("POST", URL_BASE + "/auth/v1/logout", "{}", access, null, null);
        } catch (Exception ignored) {
            /* a sessão local já saiu */
        }
    }

    /** true se escreveu uma linha. false se o throttle segurou ou se faltou sessão. */
    public boolean gravar(String nome, int bpm, Boolean contato, Double rmssd, Double sdnn, boolean forcar) {
        if (!temSessao()) return false;
        String aparelho = nome == null || nome.trim().isEmpty() ? "Pulseira" : nome.trim();
        long agora = System.currentTimeMillis();
        synchronized (trava) {
            if (!Gravacao.deveGravar(agora, ultimaTentativa, forcar)) return false;
            anterior = ultimaTentativa;
            ultimaTentativa = agora;
        }
        String quando = Instant.ofEpochMilli(agora).toString();
        try {
            String token = tokenValido();
            String uid = prefs.getString("uid", null);
            if (token == null || uid == null) throw new IllegalStateException("sem sessao");
            String id = garantirDispositivo(token, uid, aparelho, "ble");
            String corpo = Gravacao.jsonLinha(uid, id, aparelho, bpm, contato, quando, rmssd, sdnn);
            Http r = pedir("POST", URL_BASE + "/rest/v1/hr_readings", corpo, token, "return=minimal", null);
            if (r.codigo == 401) {
                token = renovar();
                r = pedir("POST", URL_BASE + "/rest/v1/hr_readings", corpo, token, "return=minimal", null);
            }
            if (r.codigo < 200 || r.codigo >= 300) throw new IllegalStateException("hr " + r.codigo);
            if (id != null) {
                try {
                    pedir("PATCH", URL_BASE + "/rest/v1/registered_devices?id=eq." + enc(id),
                            "{\"last_sync_at\":" + Gravacao.j(quando) + "}",
                            token, "return=minimal", null);
                } catch (Exception ignored) {
                    /* a medida já entrou */
                }
            }
            gravadas += 1;
            ultimaIso = quando;
            erroEnvio = null;
            avisar();
            return true;
        } catch (Exception ex) {
            synchronized (trava) {
                ultimaTentativa = anterior;
            }
            erroEnvio = "Perdi a conexão com a internet no meio do envio. As próximas medidas continuam tentando.";
            avisar();
            return false;
        }
    }

    /** Última sincronização, médico vinculado e contagens de 7 dias. */
    public void carregarPainel() {
        if (!temSessao()) return;
        try {
            String token = tokenValido();
            String uid = prefs.getString("uid", null);
            if (token == null || uid == null) return;
            String corte = Instant.ofEpochMilli(System.currentTimeMillis() - 7L * 86_400_000L).toString();
            String dia = corte.substring(0, 10);
            Http sinc = pedir("GET", URL_BASE + "/rest/v1/registered_devices?patient_user_id=eq." + enc(uid)
                    + "&category=eq.h59&select=last_sync_at&order=last_sync_at.desc.nullslast&limit=1",
                    null, token, null, null);
            if (sinc.codigo >= 200 && sinc.codigo < 300) {
                JSONArray arr = new JSONArray(sinc.corpo);
                if (arr.length() > 0 && !arr.getJSONObject(0).isNull("last_sync_at")) {
                    String iso = arr.getJSONObject(0).getString("last_sync_at");
                    if (ultimaIso == null || iso.compareTo(ultimaIso) > 0) ultimaIso = iso;
                }
            }
            Http med = pedir("GET", URL_BASE + "/rest/v1/professional_patient_links?patient_user_id=eq." + enc(uid)
                    + "&status=eq.active&select=id&limit=1", null, token, null, null);
            if (med.codigo >= 200 && med.codigo < 300) {
                temMedico = new JSONArray(med.corpo).length() > 0;
                medicoConhecido = true;
            }
            batimentos = contar(token, "hr_readings", "recorded_at", corte, uid);
            oxigenacao = contar(token, "spo2_readings", "recorded_at", corte, uid);
            pressao = contar(token, "bp_readings", "recorded_at", corte, uid);
            passos = contar(token, "activity_records", "activity_date", dia, uid);
            sono = contar(token, "sleep_records", "sleep_date", dia, uid);
            avisar();
        } catch (Exception ignored) {
            /* a tela fica com o último painel que deu certo */
        }
    }

    private int contar(String token, String tabela, String campo, String corte, String uid) throws Exception {
        String url = URL_BASE + "/rest/v1/" + tabela
                + "?patient_user_id=eq." + enc(uid)
                + "&source_type=in.(device,import)"
                + "&" + campo + "=gte." + enc(corte)
                + "&select=id";
        Http r = pedir("GET", url, null, token, "count=exact", "0-0");
        if (r.codigo < 200 || r.codigo >= 300) return 0;
        if (r.faixa == null) return 0;
        int barra = r.faixa.lastIndexOf('/');
        if (barra < 0) return 0;
        try {
            return Integer.parseInt(r.faixa.substring(barra + 1).trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private boolean eProfissional(String access, String uid) throws Exception {
        Http paciente = pedir("GET", URL_BASE + "/rest/v1/cardio_patients?user_id=eq." + enc(uid) + "&select=id&limit=1",
                null, access, null, null);
        Http medico = pedir("GET", URL_BASE + "/rest/v1/professional_profiles?user_id=eq." + enc(uid) + "&select=id&limit=1",
                null, access, null, null);
        if (paciente.codigo < 200 || paciente.codigo >= 300 || medico.codigo < 200 || medico.codigo >= 300) {
            throw new IllegalStateException("papel");
        }
        return new JSONArray(medico.corpo).length() > 0;
    }

    private String garantirDispositivo(String token, String uid, String nome, String protocolo) {
        synchronized (trava) {
            if (nome.equals(deviceNome) && deviceId != null) {
                try {
                    pedir("PATCH", URL_BASE + "/rest/v1/registered_devices?id=eq." + enc(deviceId),
                            "{\"status\":\"active\",\"protocol\":" + Gravacao.j(protocolo) + "}",
                            token, "return=minimal", null);
                } catch (Exception ignored) {
                    /* o id ainda serve */
                }
                return deviceId;
            }
        }
        try {
            Http busca = pedir("GET", URL_BASE + "/rest/v1/registered_devices?patient_user_id=eq." + enc(uid)
                    + "&category=eq.h59&display_name=eq." + enc(nome) + "&select=id&limit=1",
                    null, token, null, null);
            if (busca.codigo >= 200 && busca.codigo < 300) {
                JSONArray arr = new JSONArray(busca.corpo);
                if (arr.length() > 0) {
                    String id = arr.getJSONObject(0).getString("id");
                    pedir("PATCH", URL_BASE + "/rest/v1/registered_devices?id=eq." + enc(id),
                            "{\"status\":\"active\",\"protocol\":" + Gravacao.j(protocolo) + "}", token, "return=minimal", null);
                    synchronized (trava) {
                        deviceId = id;
                        deviceNome = nome;
                    }
                    return id;
                }
            }
            Http criado = pedir("POST", URL_BASE + "/rest/v1/registered_devices",
                    Gravacao.jsonDispositivo(uid, nome), token, "return=representation", null);
            if (criado.codigo >= 200 && criado.codigo < 300) {
                JSONArray arr = new JSONArray(criado.corpo);
                if (arr.length() > 0) {
                    String id = arr.getJSONObject(0).getString("id");
                    synchronized (trava) {
                        deviceId = id;
                        deviceNome = nome;
                    }
                    if (!"ble".equals(protocolo)) {
                        pedir("PATCH", URL_BASE + "/rest/v1/registered_devices?id=eq." + enc(id),
                                "{\"protocol\":" + Gravacao.j(protocolo) + "}", token, "return=minimal", null);
                    }
                    return id;
                }
            }
        } catch (Exception ignored) {
            /* segue com source_device_id nulo */
        }
        return null;
    }

    /** Cadastro do paciente, o mesmo de AuthPage.handleRegister. null = já entrou. */
    public String cadastrar(String nome, String email, String senha, boolean termos, boolean saude) {
        String n = nome == null ? "" : nome.trim();
        String e = email == null ? "" : email.trim();
        if (n.isEmpty()) return "Por favor, escreva seu nome completo.";
        if (senha == null || senha.length() < 6) return "A senha precisa ter pelo menos 6 letras ou números.";
        if (!termos || !saude) return "Para criar a conta, é preciso aceitar os termos e o consentimento de dados de saúde.";
        try {
            String corpo = "{\"email\":" + Gravacao.j(e) + ",\"password\":" + Gravacao.j(senha)
                    + ",\"data\":{\"full_name\":" + Gravacao.j(n) + ",\"perfil\":\"paciente\"}}";
            Http r = pedir("POST", URL_BASE + "/auth/v1/signup?redirect_to=" + enc(LINK_AUTH), corpo, null, null, null);
            if (r.codigo < 200 || r.codigo >= 300) {
                String msg = texto(r.corpo).toLowerCase();
                if (msg.contains("already registered") || msg.contains("user_already_exists")) {
                    return "Este e-mail já tem cadastro. Tente entrar.";
                }
                String cru = texto(r.corpo);
                return cru.isEmpty() ? "Não foi possível criar a conta agora." : cru;
            }
            JSONObject json = new JSONObject(r.corpo);
            String access = primeiroToken(json, "access_token");
            String refresh = primeiroToken(json, "refresh_token");
            String uid = primeiroId(json);
            long exp = System.currentTimeMillis() + json.optLong("expires_in", 3600) * 1000L;
            if (access != null && uid != null) {
                try {
                    pedir("POST", URL_BASE + "/rest/v1/consent_records", consentimentos(uid), access, "return=minimal", null);
                } catch (Exception ignored) {
                    /* o cadastro não depende do registro do consentimento */
                }
                guardarSessao(access, refresh, uid, exp, e);
                return null;
            }
            return "Conta criada! Verifique seu e-mail para confirmar o cadastro.";
        } catch (Exception ex) {
            return "Não foi possível confirmar seu acesso agora. Tente de novo.";
        }
    }

    public String reenviar(String email) {
        String e = email == null ? "" : email.trim();
        if (e.isEmpty()) return "Digite seu e-mail.";
        try {
            String corpo = "{\"type\":\"signup\",\"email\":" + Gravacao.j(e)
                    + ",\"options\":{\"email_redirect_to\":" + Gravacao.j(LINK_AUTH) + "}}";
            Http r = pedir("POST", URL_BASE + "/auth/v1/resend", corpo, null, null, null);
            if (r.codigo < 200 || r.codigo >= 300) return "Erro ao reenviar. Tente de novo em alguns minutos.";
            return "E-mail reenviado! Verifique sua caixa de entrada e a pasta de spam.";
        } catch (Exception ex) {
            return "Erro ao reenviar. Tente de novo em alguns minutos.";
        }
    }

    public String esqueci(String email) {
        String e = email == null ? "" : email.trim();
        if (e.isEmpty()) return "Digite seu e-mail.";
        try {
            Http r = pedir("POST", URL_BASE + "/auth/v1/recover?redirect_to=" + enc(LINK_SENHA),
                    "{\"email\":" + Gravacao.j(e) + "}", null, null, null);
            if (r.codigo < 200 || r.codigo >= 300) {
                String cru = texto(r.corpo);
                return cru.isEmpty() ? "Não foi possível enviar o e-mail agora." : cru;
            }
            return "Enviamos um link de recuperação para o seu e-mail.";
        } catch (Exception ex) {
            return "Não foi possível enviar o e-mail agora.";
        }
    }

    /** Abre o link do e-mail. Devolve uma frase, ou null se a sessão já entrou. */
    public String abrirLink(String bruto) {
        if (bruto == null || bruto.isEmpty()) return "Esse link não tem os dados da conta.";
        String access = parametro(bruto, "access_token");
        String refresh = parametro(bruto, "refresh_token");
        String tipo = parametro(bruto, "type");
        String expira = parametro(bruto, "expires_in");
        if (access == null || access.isEmpty()) return "Esse link não tem os dados da conta.";
        long exp = System.currentTimeMillis() + 3600_000L;
        try {
            if (expira != null && !expira.isEmpty()) exp = System.currentTimeMillis() + Long.parseLong(expira) * 1000L;
        } catch (NumberFormatException ignored) {
            /* uma hora */
        }
        if ("recovery".equals(tipo)) {
            recuperacaoAccess = access;
            recuperacaoRefresh = refresh;
            prefs.edit().putLong("exp_recuperacao", exp).apply();
            aguardandoSenha = true;
            avisar();
            return "Escolha a nova senha.";
        }
        try {
            String uid = usuarioDoToken(access);
            if (uid == null) return "Não foi possível confirmar seu acesso agora. Tente de novo.";
            if (eProfissional(access, uid)) {
                try {
                    pedir("POST", URL_BASE + "/auth/v1/logout", "{}", access, null, null);
                } catch (Exception ignored) {
                    /* não fica neste app */
                }
                return "Este e-mail está cadastrado como médico. Entre pelo portal do médico.";
            }
            guardarSessao(access, refresh == null ? "" : refresh, uid, exp, "");
            return null;
        } catch (Exception ex) {
            return "Não foi possível confirmar seu acesso agora. Tente de novo.";
        }
    }

    public String definirSenha(String senha, String confirmacao) {
        if (senha == null || confirmacao == null || !senha.equals(confirmacao)) return "As senhas não são iguais.";
        if (senha.length() < 6) return "A senha precisa ter pelo menos 6 caracteres.";
        if (recuperacaoAccess == null) return "Abra o link do e-mail antes de trocar a senha.";
        try {
            Http r = pedir("PUT", URL_BASE + "/auth/v1/user", "{\"password\":" + Gravacao.j(senha) + "}",
                    recuperacaoAccess, null, null);
            if (r.codigo < 200 || r.codigo >= 300) return "Não foi possível trocar a senha agora.";
            String uid = usuarioDoToken(recuperacaoAccess);
            if (uid != null && eProfissional(recuperacaoAccess, uid)) {
                recuperacaoAccess = null;
                aguardandoSenha = false;
                return "Este e-mail está cadastrado como médico. Entre pelo portal do médico.";
            }
            long exp = prefs.getLong("exp_recuperacao", System.currentTimeMillis() + 3600_000L);
            if (uid != null) guardarSessao(recuperacaoAccess, recuperacaoRefresh == null ? "" : recuperacaoRefresh, uid, exp, "");
            recuperacaoAccess = null;
            aguardandoSenha = false;
            avisar();
            return null;
        } catch (Exception ex) {
            return "Não foi possível trocar a senha agora.";
        }
    }

    /**
     * Grava o CSV já lido, como useWearableSync.importar.
     * Sono, oxigenação, passos e pressão entram por aqui, não por Bluetooth.
     */
    public String importar(java.util.List<Importacao.Linha> linhas, String nomeAparelho) {
        if (!temSessao()) return "Entre na sua conta antes de importar.";
        if (linhas == null || linhas.isEmpty()) return "Não consegui salvar nada deste arquivo.";
        try {
            String token = tokenValido();
            String uid = prefs.getString("uid", null);
            if (token == null || uid == null) return "Entre na sua conta antes de importar.";
            String nome = nomeAparelho == null || nomeAparelho.trim().isEmpty() ? Importacao.NOME_ARQUIVO : nomeAparelho.trim();
            String deviceId = garantirDispositivo(token, uid, nome, "import");
            int importados = 0;
            int ignorados = 0;
            int falhas = 0;
            java.util.List<String> erros = new java.util.ArrayList<>();
            int[] hr = enviarComConta(token, uid, deviceId, nome, linhas, "batimentos");
            importados += hr[0];
            ignorados += hr[1];
            falhas += hr[2];
            int[] spo = contarEnvio(enviarComConta(token, uid, deviceId, nome, linhas, "spo2"));
            importados += spo[0];
            ignorados += spo[1];
            falhas += spo[2];
            int[] pa = contarEnvio(enviarComConta(token, uid, deviceId, nome, linhas, "bp"));
            importados += pa[0];
            ignorados += pa[1];
            falhas += pa[2];
            int[] at = contarEnvio(enviarComConta(token, uid, deviceId, nome, linhas, "activity"));
            importados += at[0];
            ignorados += at[1];
            falhas += at[2];
            int[] sono = enviarSono(token, uid, deviceId, nome, linhas, erros);
            importados += sono[0];
            ignorados += sono[1];
            falhas += sono[2];
            if (importados > 0 && deviceId != null) {
                String quando = Instant.now().toString();
                try {
                    pedir("PATCH", URL_BASE + "/rest/v1/registered_devices?id=eq." + enc(deviceId),
                            "{\"last_sync_at\":" + Gravacao.j(quando) + "}", token, "return=minimal", null);
                } catch (Exception ignored) {
                    /* a importação já entrou */
                }
                if (ultimaIso == null || quando.compareTo(ultimaIso) > 0) ultimaIso = quando;
            }
            avisar();
            if (importados > 0 && temMedico) return "Arquivo importado. Seu médico já consegue ver.";
            if (importados > 0) return "Arquivo importado. As medidas ficaram guardadas no seu histórico.";
            if (ignorados > 0 && falhas == 0) return "Esse arquivo já tinha sido importado. Nada novo foi adicionado.";
            return "Não consegui salvar nada deste arquivo.";
        } catch (Exception ex) {
            return "Não consegui importar o arquivo. Tente de novo.";
        }
    }

    private int enviarTipo(String token, String uid, String deviceId, String nome, String tabela, String janela,
                           java.util.List<Importacao.Linha> linhas, String tipo, java.util.List<String> erros) throws Exception {
        int[] c = enviarComConta(token, uid, deviceId, nome, linhas, tipo);
        return c[0];
    }

    /** [importados, ignorados, falhas] */
    private int[] enviarComConta(String token, String uid, String deviceId, String nome,
                                 java.util.List<Importacao.Linha> linhas, String tipo) throws Exception {
        java.util.List<org.json.JSONObject> novas = new java.util.ArrayList<>();
        String tabela;
        String campo;
        String colunas;
        if ("batimentos".equals(tipo)) {
            tabela = "hr_readings";
            campo = "recorded_at";
            colunas = "recorded_at,bpm";
        } else if ("spo2".equals(tipo)) {
            tabela = "spo2_readings";
            campo = "recorded_at";
            colunas = "recorded_at,value";
        } else if ("bp".equals(tipo)) {
            tabela = "bp_readings";
            campo = "recorded_at";
            colunas = "recorded_at,systolic,diastolic";
        } else {
            tabela = "activity_records";
            campo = "activity_date";
            colunas = "activity_date";
        }
        java.util.List<String> chaves = new java.util.ArrayList<>();
        java.util.List<org.json.JSONObject> candidatas = new java.util.ArrayList<>();
        for (Importacao.Linha l : linhas) {
            org.json.JSONObject row = linhaTabela(tipo, uid, deviceId, nome, l);
            if (row == null) continue;
            String chave = chaveLinha(tipo, row);
            candidatas.add(row);
            chaves.add(chave);
        }
        if (candidatas.isEmpty()) return new int[] {0, 0, 0};
        java.util.List<String> ordem = new java.util.ArrayList<>(chaves);
        java.util.Collections.sort(ordem);
        String inicio = valorJanela(tipo, candidatas.get(0));
        String fim = inicio;
        for (org.json.JSONObject row : candidatas) {
            String v = valorJanela(tipo, row);
            if (v.compareTo(inicio) < 0) inicio = v;
            if (v.compareTo(fim) > 0) fim = v;
        }
        java.util.Set<String> existentes = buscarChaves(token, uid, tabela, campo, colunas, inicio, fim, tipo);
        java.util.Set<String> vistas = new java.util.HashSet<>();
        int ignorados = 0;
        for (int i = 0; i < candidatas.size(); i++) {
            String k = chaves.get(i);
            if (existentes.contains(k) || vistas.contains(k)) {
                ignorados++;
                continue;
            }
            vistas.add(k);
            novas.add(candidatas.get(i));
        }
        int[] ins = inserirLote(token, tabela, novas);
        return new int[] {ins[0], ignorados, ins[1]};
    }

    private int[] enviarSono(String token, String uid, String deviceId, String nome,
                             java.util.List<Importacao.Linha> linhas, java.util.List<String> erros) throws Exception {
        java.util.List<org.json.JSONObject> noites = new java.util.ArrayList<>();
        for (Importacao.Linha l : linhas) {
            org.json.JSONObject row = linhaTabela("sono", uid, deviceId, nome, l);
            if (row != null) noites.add(row);
        }
        if (noites.isEmpty()) return new int[] {0, 0, 0};
        String inicio = noites.get(0).getString("sleep_date");
        String fim = inicio;
        for (org.json.JSONObject n : noites) {
            String d = n.getString("sleep_date");
            if (d.compareTo(inicio) < 0) inicio = d;
            if (d.compareTo(fim) > 0) fim = d;
        }
        java.util.Map<String, org.json.JSONObject> porData = new java.util.LinkedHashMap<>();
        String url = URL_BASE + "/rest/v1/sleep_records?patient_user_id=eq." + enc(uid)
                + "&sleep_date=gte." + enc(inicio) + "&sleep_date=lte." + enc(fim)
                + "&select=id,sleep_date,deep_minutes,light_minutes,rem_minutes,awake_minutes,awakenings,efficiency_pct,min_heart_rate,min_spo2"
                + "&order=sleep_date.asc";
        Http busca = pedir("GET", url, null, token, null, null);
        if (busca.codigo < 200 || busca.codigo >= 300) throw new IllegalStateException("sono");
        JSONArray arr = new JSONArray(busca.corpo == null || busca.corpo.isEmpty() ? "[]" : busca.corpo);
        for (int i = 0; i < arr.length(); i++) {
            org.json.JSONObject e = arr.getJSONObject(i);
            porData.put(e.getString("sleep_date").substring(0, 10), e);
        }
        java.util.Map<String, org.json.JSONObject> pendente = new java.util.LinkedHashMap<>();
        java.util.List<org.json.JSONObject> inserir = new java.util.ArrayList<>();
        int ignorados = 0;
        int mescladas = 0;
        String[] campos = {"deep_minutes", "light_minutes", "rem_minutes", "awake_minutes",
                "awakenings", "efficiency_pct", "min_heart_rate", "min_spo2"};
        java.util.Map<String, org.json.JSONObject> patches = new java.util.LinkedHashMap<>();
        java.util.Map<String, Integer> patchLinhas = new java.util.LinkedHashMap<>();
        for (org.json.JSONObject linha : noites) {
            String dia = linha.getString("sleep_date").substring(0, 10);
            org.json.JSONObject ex = porData.get(dia);
            org.json.JSONObject ins = pendente.get(dia);
            if (ex == null && ins == null) {
                pendente.put(dia, linha);
                inserir.add(linha);
                continue;
            }
            boolean preencheu = false;
            for (String campo : campos) {
                if (linha.isNull(campo)) continue;
                boolean ocupado = false;
                org.json.JSONObject base = ins != null ? ins : ex;
                if (base != null && !base.isNull(campo)) ocupado = true;
                if (ins == null && ex != null) {
                    org.json.JSONObject p = patches.get(ex.getString("id"));
                    if (p != null && !p.isNull(campo)) ocupado = true;
                }
                if (ocupado) continue;
                preencheu = true;
                if (ins != null) ins.put(campo, linha.get(campo));
                else {
                    org.json.JSONObject p = patches.get(ex.getString("id"));
                    if (p == null) p = new org.json.JSONObject();
                    p.put(campo, linha.get(campo));
                    patches.put(ex.getString("id"), p);
                }
            }
            if (!preencheu) ignorados++;
            else if (ins != null) mescladas++;
            else if (ex != null) patchLinhas.put(ex.getString("id"), patchLinhas.getOrDefault(ex.getString("id"), 0) + 1);
        }
        int[] ins = inserirLote(token, "sleep_records", inserir);
        int importados = ins[0];
        int falhas = ins[1];
        if (falhas == 0) importados += mescladas;
        else falhas += mescladas;
        for (java.util.Map.Entry<String, org.json.JSONObject> e : patches.entrySet()) {
            Http r = pedir("PATCH", URL_BASE + "/rest/v1/sleep_records?id=eq." + enc(e.getKey()) + "&patient_user_id=eq." + enc(uid),
                    e.getValue().toString(), token, "return=minimal", null);
            int n = patchLinhas.getOrDefault(e.getKey(), 1);
            if (r.codigo >= 200 && r.codigo < 300) importados += n;
            else falhas += n;
        }
        return new int[] {importados, ignorados, falhas};
    }

    private java.util.Set<String> buscarChaves(String token, String uid, String tabela, String campo, String colunas,
                                               String inicio, String fim, String tipo) throws Exception {
        java.util.Set<String> set = new java.util.HashSet<>();
        for (int offset = 0; ; offset += 1000) {
            String url = URL_BASE + "/rest/v1/" + tabela + "?patient_user_id=eq." + enc(uid)
                    + "&" + campo + "=gte." + enc(inicio) + "&" + campo + "=lte." + enc(fim)
                    + "&select=" + colunas + "&order=" + campo + ".asc";
            Http r = pedir("GET", url, null, token, null, offset + "-" + (offset + 999));
            if (r.codigo < 200 || r.codigo >= 300) throw new IllegalStateException(tabela);
            JSONArray arr = new JSONArray(r.corpo == null || r.corpo.isEmpty() ? "[]" : r.corpo);
            for (int i = 0; i < arr.length(); i++) set.add(chaveLinha(tipo, arr.getJSONObject(i)));
            if (arr.length() < 1000) break;
        }
        return set;
    }

    private int[] inserirLote(String token, String tabela, java.util.List<org.json.JSONObject> linhas) throws Exception {
        if (linhas.isEmpty()) return new int[] {0, 0};
        if (linhas.size() > 500) {
            int[] a = inserirLote(token, tabela, linhas.subList(0, 500));
            int[] b = inserirLote(token, tabela, linhas.subList(500, linhas.size()));
            return new int[] {a[0] + b[0], a[1] + b[1]};
        }
        org.json.JSONArray corpo = new org.json.JSONArray();
        for (org.json.JSONObject o : linhas) corpo.put(o);
        Http r = pedir("POST", URL_BASE + "/rest/v1/" + tabela, corpo.toString(), token, "return=minimal", null);
        if (r.codigo >= 200 && r.codigo < 300) return new int[] {linhas.size(), 0};
        if (linhas.size() == 1) return new int[] {0, 1};
        int meio = linhas.size() / 2;
        int[] a = inserirLote(token, tabela, linhas.subList(0, meio));
        int[] b = inserirLote(token, tabela, linhas.subList(meio, linhas.size()));
        return new int[] {a[0] + b[0], a[1] + b[1]};
    }

    private static String valorJanela(String tipo, org.json.JSONObject row) throws Exception {
        if ("activity".equals(tipo)) return row.getString("activity_date").substring(0, 10);
        return row.getString("recorded_at");
    }

    private static String chaveLinha(String tipo, org.json.JSONObject row) throws Exception {
        if ("activity".equals(tipo)) return row.getString("activity_date").substring(0, Math.min(10, row.getString("activity_date").length()));
        String at = row.optString("recorded_at", "");
        String minuto = at.length() >= 16 ? at.substring(0, 16) : at;
        if ("batimentos".equals(tipo)) return minuto + "|" + row.optInt("bpm");
        if ("spo2".equals(tipo)) return minuto + "|" + row.optInt("value");
        if ("bp".equals(tipo)) return minuto + "|" + row.optInt("systolic") + "/" + row.optInt("diastolic");
        return minuto;
    }

    private static org.json.JSONObject linhaTabela(String tipo, String uid, String deviceId, String nome, Importacao.Linha l) throws Exception {
        org.json.JSONObject o = new org.json.JSONObject();
        o.put("patient_user_id", uid);
        o.put("recorded_at", l.recordedAt);
        o.put("source_type", "import");
        o.put("source_device_id", deviceId == null ? org.json.JSONObject.NULL : deviceId);
        o.put("source_device_name", nome);
        o.put("entered_by", "device");
        o.put("validation_status", "estimated");
        String dia = l.recordedAt.length() >= 10 ? l.recordedAt.substring(0, 10) : l.recordedAt;
        if ("batimentos".equals(tipo)) {
            if (l.heartRate == null) return null;
            o.put("bpm", l.heartRate);
            o.put("context", org.json.JSONObject.NULL);
            o.put("irregular_flag", org.json.JSONObject.NULL);
            o.put("rmssd", org.json.JSONObject.NULL);
            o.put("sdnn", org.json.JSONObject.NULL);
            return o;
        }
        if ("spo2".equals(tipo)) {
            if (l.spo2 == null) return null;
            o.put("value", l.spo2);
            o.put("context", org.json.JSONObject.NULL);
            o.put("time_below_90_pct", org.json.JSONObject.NULL);
            return o;
        }
        if ("bp".equals(tipo)) {
            if (l.systolic == null || l.diastolic == null) return null;
            o.put("systolic", l.systolic);
            o.put("diastolic", l.diastolic);
            o.put("pulse", l.heartRate == null ? org.json.JSONObject.NULL : l.heartRate);
            o.put("context", "random");
            o.put("position", org.json.JSONObject.NULL);
            o.put("arm", org.json.JSONObject.NULL);
            o.put("cuff_validated", false);
            o.put("entered_by_user_id", org.json.JSONObject.NULL);
            o.put("validation_note", Importacao.NOTA_PA);
            return o;
        }
        if ("activity".equals(tipo)) {
            if (l.steps == null && l.calories == null) return null;
            o.put("activity_date", dia);
            o.put("steps", l.steps == null ? org.json.JSONObject.NULL : l.steps);
            o.put("calories", l.calories == null ? org.json.JSONObject.NULL : l.calories);
            o.put("distance_km", org.json.JSONObject.NULL);
            o.put("moderate_minutes", org.json.JSONObject.NULL);
            o.put("vigorous_minutes", org.json.JSONObject.NULL);
            o.put("avg_heart_rate", l.heartRate == null ? org.json.JSONObject.NULL : l.heartRate);
            o.put("max_heart_rate", org.json.JSONObject.NULL);
            return o;
        }
        if (l.sleepMinutes == null) return null;
        o.put("sleep_date", dia);
        o.put("total_minutes", l.sleepMinutes);
        o.put("deep_minutes", l.deepMinutes == null ? org.json.JSONObject.NULL : l.deepMinutes);
        o.put("light_minutes", l.lightMinutes == null ? org.json.JSONObject.NULL : l.lightMinutes);
        o.put("rem_minutes", l.remMinutes == null ? org.json.JSONObject.NULL : l.remMinutes);
        o.put("awake_minutes", l.awakeMinutes == null ? org.json.JSONObject.NULL : l.awakeMinutes);
        o.put("awakenings", l.awakenings == null ? org.json.JSONObject.NULL : l.awakenings);
        o.put("efficiency_pct", l.efficiencyPct == null ? org.json.JSONObject.NULL : l.efficiencyPct);
        o.put("min_heart_rate", l.minHeartRate == null ? org.json.JSONObject.NULL : l.minHeartRate);
        o.put("min_spo2", l.minSpo2 == null ? org.json.JSONObject.NULL : l.minSpo2);
        return o;
    }

    private void guardarSessao(String access, String refresh, String uid, long exp, String email) {
        android.content.SharedPreferences.Editor ed = prefs.edit()
                .putString("access", access)
                .putString("refresh", refresh)
                .putString("uid", uid)
                .putLong("exp", exp);
        if (email != null && !email.isEmpty()) ed.putString("email", email);
        ed.apply();
        erroEnvio = null;
        avisar();
    }

    private static String primeiroToken(JSONObject json, String chave) {
        String direto = json.optString(chave, "");
        if (!direto.isEmpty()) return direto;
        JSONObject session = json.optJSONObject("session");
        if (session == null) return null;
        String s = session.optString(chave, "");
        return s.isEmpty() ? null : s;
    }

    private static String primeiroId(JSONObject json) {
        JSONObject user = json.optJSONObject("user");
        if (user != null && user.has("id")) return user.optString("id", null);
        JSONObject session = json.optJSONObject("session");
        if (session != null) {
            JSONObject u = session.optJSONObject("user");
            if (u != null) return u.optString("id", null);
        }
        String id = json.optString("id", "");
        return id.isEmpty() ? null : id;
    }

    private String usuarioDoToken(String access) throws Exception {
        Http r = pedir("GET", URL_BASE + "/auth/v1/user", null, access, null, null);
        if (r.codigo < 200 || r.codigo >= 300) return null;
        JSONObject json = new JSONObject(r.corpo);
        return json.optString("id", null);
    }

    private static String parametro(String bruto, String chave) {
        int hash = bruto.indexOf('#');
        String q = hash >= 0 ? bruto.substring(hash + 1) : bruto;
        int ask = q.indexOf('?');
        if (hash < 0 && ask >= 0) q = q.substring(ask + 1);
        for (String parte : q.split("&")) {
            int eq = parte.indexOf('=');
            if (eq <= 0) continue;
            if (chave.equals(parte.substring(0, eq))) {
                try {
                    return java.net.URLDecoder.decode(parte.substring(eq + 1), java.nio.charset.StandardCharsets.UTF_8);
                } catch (Exception e) {
                    return parte.substring(eq + 1);
                }
            }
        }
        return null;
    }

    private static String consentimentos(String uid) {
        String versao = "2026-05-24";
        return "["
                + consentimento(uid, "terms", versao) + ","
                + consentimento(uid, "privacy", versao) + ","
                + consentimento(uid, "health_data", versao)
                + "]";
    }

    private static String consentimento(String uid, String tipo, String versao) {
        return "{\"user_id\":" + Gravacao.j(uid)
                + ",\"consent_type\":" + Gravacao.j(tipo)
                + ",\"document_version\":" + Gravacao.j(versao)
                + ",\"status\":\"granted\",\"context\":\"signup\"}";
    }

    private static int[] contarEnvio(int[] c) {
        return c;
    }

    private String tokenValido() throws Exception {
        String access = prefs.getString("access", null);
        long exp = prefs.getLong("exp", 0);
        if (access == null) return null;
        if (System.currentTimeMillis() + 60_000 < exp) return access;
        return renovar();
    }

    private String renovar() throws Exception {
        String refresh = prefs.getString("refresh", null);
        if (refresh == null || refresh.isEmpty()) throw new IllegalStateException("sem refresh");
        Http r = pedir("POST", URL_BASE + "/auth/v1/token?grant_type=refresh_token",
                "{\"refresh_token\":" + Gravacao.j(refresh) + "}", null, null, null);
        if (r.codigo < 200 || r.codigo >= 300) {
            prefs.edit().clear().apply();
            avisar();
            throw new IllegalStateException("refresh");
        }
        JSONObject json = new JSONObject(r.corpo);
        String access = json.getString("access_token");
        String novo = json.optString("refresh_token", refresh);
        long exp = System.currentTimeMillis() + json.optLong("expires_in", 3600) * 1000L;
        prefs.edit().putString("access", access).putString("refresh", novo).putLong("exp", exp).apply();
        return access;
    }

    private void avisar() {
        for (Runnable r : ouvintes) r.run();
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String texto(String corpo) {
        if (corpo == null || corpo.isEmpty()) return "";
        try {
            JSONObject j = new JSONObject(corpo);
            if (j.has("error_description")) return j.optString("error_description");
            if (j.has("msg")) return j.optString("msg");
            if (j.has("message")) return j.optString("message");
            if (j.has("error")) return j.optString("error");
        } catch (Exception ignored) {
            /* corpo cru */
        }
        return corpo;
    }

    /** Hoje, evolução e o médico, nas mesmas tabelas do site. */
    public void carregarCasa() {
        try {
            String token = tokenValido();
            String uid = prefs.getString("uid", null);
            if (uid == null) return;
            String nome = primeiroNome(buscarUm(token, "profiles?id=eq." + enc(uid) + "&select=full_name"));
            int sys = 130;
            int dia = 80;
            JSONObject alvo = buscarUm(token, "cardio_targets?patient_user_id=eq." + enc(uid) + "&select=bp_systolic_max,bp_diastolic_max&limit=1");
            if (alvo != null) {
                sys = alvo.optInt("bp_systolic_max", 130);
                dia = alvo.optInt("bp_diastolic_max", 80);
            }
            JSONArray plano = buscarLista(token, "monitoring_plan?patient_user_id=eq." + enc(uid) + "&is_active=eq.true&select=metric,frequency,times_per_day");
            boolean prescrito = plano.length() > 0;
            if (!prescrito) {
                plano = new JSONArray()
                        .put(item("bp", 2)).put(item("weight", 1)).put(item("wellbeing", 1));
            }
            StringBuilder hoje = new StringBuilder();
            int total = 0;
            int concluidas = 0;
            int fora = 0;
            StringBuilder itens = new StringBuilder();
            for (int i = 0; i < plano.length(); i++) {
                JSONObject item = plano.getJSONObject(i);
                String freq = item.optString("frequency", "daily");
                int dias = janelaDias(freq);
                if (dias <= 0) continue;
                String metric = item.optString("metric");
                int vezes = Math.max(1, item.optInt("times_per_day", 1));
                int esperados = "twice_daily".equals(freq) ? Math.max(2, vezes) : "daily".equals(freq) ? Math.max(1, vezes) : 1;
                int feitos = feitosHoje(token, uid, metric, dias);
                if (feitos < 0) {
                    fora++;
                    continue;
                }
                total++;
                if (feitos >= esperados) concluidas++;
                itens.append(rotuloMetrica(metric)).append(feitos >= esperados ? " — feito" : " — falta").append('\n');
            }
            if (total == 0 && fora > 0) {
                hoje.append("O plano do seu médico inclui registros que esta versão ainda não abre aqui.\n");
            } else if (total == 0) {
                hoje.append("Nada combinado para hoje.\n");
            } else if (concluidas >= total) {
                hoje.append("Tudo registrado por hoje.\n");
            } else {
                hoje.append("Faltam ").append(total - concluidas).append(" de ").append(total).append(" registros de hoje.\n");
            }
            hoje.append(prescrito
                    ? "Este é o plano que seu médico definiu."
                    : "Sugestão do app — seu médico ainda não definiu um plano.");
            if (concluidas > 0) hoje.append(' ').append(concluidas).append(concluidas > 1 ? " já feitos." : " já feito.");
            hoje.append('\n').append(itens).append('\n').append(ultimas(token, uid));
            String meta = textoEvolucao(token, uid, sys, dia);
            String[] medico = medico(token, uid);
            String msgs = mensagens(token, uid);
            String saudacao = saudacao();
            String pessoa = nome.isEmpty() ? saudacao : saudacao + ", " + nome;
            String planoTexto = hoje.toString().trim();
            String medicoNome = medico[0];
            String medicoClinica = medico[1];
            runAvisar(pessoa, planoTexto, meta, medicoNome, medicoClinica, msgs);
        } catch (Exception ex) {
            runAvisar(nomePessoa, "Não consegui carregar o seu dia. Tente de novo.", textoMeta, nomeMedico, clinicaMedico, textoMensagens);
        }
    }

    public String registrarMedida(String tipo, String a, String b, String c, Integer nota) {
        try {
            String token = tokenValido();
            String uid = prefs.getString("uid", null);
            if (uid == null) return "Entre na sua conta antes de registrar.";
            JSONObject o = new JSONObject();
            o.put("patient_user_id", uid);
            String tabela;
            if ("bp".equals(tipo)) {
                int sis = numero(a);
                int dia = numero(b);
                if (sis <= 0 || dia <= 0) return "Preencha os dois números da pressão.";
                int h = java.time.LocalTime.now().getHour();
                o.put("systolic", sis);
                o.put("diastolic", dia);
                if (c != null && !c.trim().isEmpty()) o.put("pulse", numero(c));
                o.put("context", h < 12 ? "morning" : h >= 17 ? "evening" : "random");
                o.put("cuff_validated", true);
                tabela = "bp_readings";
            } else if ("weight".equals(tipo)) {
                double v = decimal(a);
                if (v <= 0) return "Digite seu peso.";
                o.put("value", v);
                tabela = "weight_readings";
            } else if ("hr".equals(tipo)) {
                int v = numero(a);
                if (v <= 0) return "Digite os batimentos.";
                o.put("bpm", v);
                o.put("context", "resting");
                tabela = "hr_readings";
            } else if ("spo2".equals(tipo)) {
                int v = numero(a);
                if (v <= 0) return "Digite a oxigenação.";
                o.put("value", v);
                o.put("context", "spot");
                tabela = "spo2_readings";
            } else if ("glucose".equals(tipo)) {
                int v = numero(a);
                if (v <= 0) return "Digite a glicemia.";
                o.put("value", v);
                o.put("context", "random");
                tabela = "glucose_readings";
            } else if ("wellbeing".equals(tipo)) {
                if (nota == null) return "Escolha um número de 0 a 10.";
                o.put("desfecho", "registrar");
                o.put("alarmes", new JSONArray());
                o.put("como_se_sente", nota);
                o.put("espelho", new JSONObject());
                tabela = "wellbeing_checkins";
            } else {
                return "Esse registro ainda não está nesta tela.";
            }
            Http r = pedir("POST", URL_BASE + "/rest/v1/" + tabela, o.toString(), token, "return=minimal", null);
            if (r.codigo < 200 || r.codigo >= 300) {
                String cru = texto(r.corpo);
                return cru.isEmpty() ? "Não consegui registrar agora." : cru;
            }
            return null;
        } catch (Exception ex) {
            return "Não consegui registrar agora.";
        }
    }

    public String enviarMensagem(String corpo) {
        String t = corpo == null ? "" : corpo.trim();
        if (t.isEmpty()) return "Escreva uma mensagem.";
        try {
            String token = tokenValido();
            String uid = prefs.getString("uid", null);
            if (uid == null) return "Entre na sua conta antes de escrever.";
            JSONObject o = new JSONObject();
            o.put("patient_user_id", uid);
            o.put("sender_user_id", uid);
            o.put("sender", "patient");
            o.put("body", t);
            Http r = pedir("POST", URL_BASE + "/rest/v1/patient_messages", o.toString(), token, "return=minimal", null);
            if (r.codigo < 200 || r.codigo >= 300) return "Não consegui enviar a mensagem.";
            marcarLidas(token, uid);
            return null;
        } catch (Exception ex) {
            return "Não consegui enviar a mensagem.";
        }
    }

    private void runAvisar(String pessoa, String hoje, String meta, String medico, String clinica, String msgs) {
        nomePessoa = pessoa;
        textoHoje = hoje;
        textoMeta = meta;
        nomeMedico = medico;
        clinicaMedico = clinica;
        textoMensagens = msgs;
        avisar();
    }

    private JSONObject item(String metric, int vezes) throws Exception {
        return new JSONObject().put("metric", metric).put("times_per_day", vezes).put("frequency", "daily");
    }

    private static int janelaDias(String freq) {
        if ("weekly".equals(freq)) return 7;
        if ("biweekly".equals(freq)) return 15;
        if ("monthly".equals(freq)) return 30;
        if ("as_needed".equals(freq)) return 0;
        return 1;
    }

    private int feitosHoje(String token, String uid, String metric, int dias) throws Exception {
        String tabela;
        String campo;
        if ("bp".equals(metric)) { tabela = "bp_readings"; campo = "recorded_at"; }
        else if ("weight".equals(metric)) { tabela = "weight_readings"; campo = "recorded_at"; }
        else if ("hr".equals(metric)) { tabela = "hr_readings"; campo = "recorded_at"; }
        else if ("spo2".equals(metric)) { tabela = "spo2_readings"; campo = "recorded_at"; }
        else if ("glucose".equals(metric)) { tabela = "glucose_readings"; campo = "recorded_at"; }
        else if ("wellbeing".equals(metric)) { tabela = "wellbeing_checkins"; campo = "ocorrido_em"; }
        else if ("sleep".equals(metric)) { tabela = "sleep_records"; campo = "sleep_date"; }
        else if ("steps".equals(metric)) { tabela = "activity_records"; campo = "activity_date"; }
        else return -1;
        java.time.LocalDate desde = java.time.LocalDate.now().minusDays(Math.max(0, dias - 1));
        boolean porData = "sleep".equals(metric) || "steps".equals(metric);
        String corte = porData ? desde.toString() : desde.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toString();
        JSONArray lista = buscarLista(token, tabela + "?patient_user_id=eq." + enc(uid) + "&" + campo + "=gte." + enc(corte) + "&select=id&limit=40");
        return lista.length();
    }

    private String ultimas(String token, String uid) throws Exception {
        StringBuilder s = new StringBuilder("Últimos registros\n");
        JSONObject bp = buscarUm(token, "bp_readings?patient_user_id=eq." + enc(uid) + "&select=systolic,diastolic,recorded_at&order=recorded_at.desc&limit=1");
        JSONObject peso = buscarUm(token, "weight_readings?patient_user_id=eq." + enc(uid) + "&select=value,recorded_at&order=recorded_at.desc&limit=1");
        JSONObject fc = buscarUm(token, "hr_readings?patient_user_id=eq." + enc(uid) + "&select=bpm,recorded_at&order=recorded_at.desc&limit=1");
        s.append(bp == null ? "Pressão: ainda não recebi\n" : "Pressão: " + bp.optInt("systolic") + "/" + bp.optInt("diastolic") + "\n");
        s.append(peso == null ? "Peso: ainda não recebi\n" : "Peso: " + peso.opt("value") + " kg\n");
        s.append(fc == null ? "Batimentos: ainda não recebi" : "Batimentos: " + fc.optInt("bpm"));
        return s.toString();
    }

    private String textoMeta(String token, String uid, int sys, int diaAlvo) throws Exception {
        String desde = java.time.Instant.now().minus(java.time.Duration.ofDays(60)).toString();
        JSONArray lista = buscarLista(token, "bp_readings?patient_user_id=eq." + enc(uid)
                + "&recorded_at=gte." + enc(desde)
                + "&select=systolic,diastolic,recorded_at,cuff_validated,validation_status&order=recorded_at.desc&limit=400");
        long agora = System.currentTimeMillis();
        int dentro = 0;
        int total = 0;
        int dentroAntes = 0;
        int totalAntes = 0;
        for (int i = 0; i < lista.length(); i++) {
            JSONObject r = lista.getJSONObject(i);
            if (!r.optBoolean("cuff_validated") || !"validated".equals(r.optString("validation_status"))) continue;
            long t = Instant.parse(r.optString("recorded_at")).toEpochMilli();
            boolean noAlvo = r.optInt("systolic") <= sys && r.optInt("diastolic") <= diaAlvo;
            long diaMs = 86_400_000L;
            if (t > agora - 30 * diaMs && t <= agora) {
                total++;
                if (noAlvo) dentro++;
            } else if (t > agora - 60 * diaMs && t <= agora - 30 * diaMs) {
                totalAntes++;
                if (noAlvo) dentroAntes++;
            }
        }
        String titulo = "Medidas de pressão dentro da meta\n";
        if (total < 5) {
            return titulo + "Medidas insuficientes\nVocê tem " + total + " medida" + (total == 1 ? "" : "s")
                    + " com aparelho de braço nos últimos 30 dias. A partir de 5 medidas o app mostra o seu percentual.";
        }
        int pct = Math.round(dentro * 100f / total);
        String base = pct >= 50
                ? pct + "% das suas " + total + " medidas nos últimos 30 dias ficaram dentro da meta."
                : pct + "% das suas " + total + " medidas nos últimos 30 dias ficaram dentro da meta — a maior parte ficou acima.";
        String frase = base;
        if (totalAntes >= 5) {
            int antes = Math.round(dentroAntes * 100f / totalAntes);
            int variacao = pct - antes;
            if (variacao >= 5) frase = base + " São " + variacao + " pontos a mais que no período anterior.";
            else if (variacao <= -5) frase = base + " São " + Math.abs(variacao) + " pontos a menos que no período anterior.";
            else frase = base + " Praticamente igual ao período anterior.";
        }
        return titulo + pct + "%\n" + dentro + " de " + total + " medidas · nos últimos 30 dias\n" + frase;
    }

    private String textoEvolucao(String token, String uid, int sys, int diaAlvo) throws Exception {
        StringBuilder s = new StringBuilder(textoMeta(token, uid, sys, diaAlvo));
        s.append("\n\nCapacidade\n");
        JSONArray testes = buscarLista(token, "capacity_tests?patient_user_id=eq." + enc(uid)
                + "&select=tipo,valor,realizado_em&order=realizado_em.desc&limit=40");
        s.append(linhaCapacidade(testes, "walk_6min", "Caminhada de 6 minutos", "m", "metros", "caminhada de 6 minutos"));
        s.append(linhaCapacidade(testes, "sit_to_stand_30s", "Sentar e levantar", "rep.", "repetições", "sentar e levantar"));
        s.append(linhaCapacidade(testes, "hr_recovery", "Recuperação dos batimentos", "bpm", "bpm", "recuperação dos batimentos"));
        s.append("\nIdade do coração\n").append(textoIdade(token, uid));
        return s.toString();
    }

    private static String linhaCapacidade(JSONArray testes, String tipo, String titulo, String unidadeCurta, String unidade, String nome) throws Exception {
        Double atual = null;
        Double anterior = null;
        for (int i = 0; i < testes.length(); i++) {
            JSONObject t = testes.getJSONObject(i);
            if (!tipo.equals(t.optString("tipo"))) continue;
            double v = t.optDouble("valor");
            if (atual == null) atual = v;
            else if (anterior == null) { anterior = v; break; }
        }
        String frase;
        String numero = "—";
        if (atual == null) {
            frase = "Você ainda não fez o teste de " + nome + ".";
        } else {
            numero = formatarValor(atual) + " " + unidadeCurta;
            if (anterior == null) {
                frase = "Primeiro registro: " + formatarValor(atual) + " " + unidade + ". Refaça em 4 a 8 semanas para ver a evolução.";
            } else {
                double variacao = atual - anterior;
                int variacaoPct = (int) Math.round((variacao / anterior) * 100);
                if (variacao > 0) frase = "Você melhorou " + formatarValor(variacao) + " " + unidade + " desde o teste anterior (" + (variacaoPct > 0 ? "+" : "") + variacaoPct + "%).";
                else if (variacao < 0) frase = "Desta vez foram " + formatarValor(Math.abs(variacao)) + " " + unidade + " a menos que no teste anterior. Um único teste varia bastante — o que conta é a linha ao longo dos meses.";
                else frase = "Mesmo resultado do teste anterior: " + formatarValor(atual) + " " + unidade + ".";
            }
        }
        return titulo + "\n" + numero + "\n" + frase + "\n";
    }

    private String textoIdade(String token, String uid) throws Exception {
        JSONObject p = buscarUm(token, "cardio_patients?user_id=eq." + enc(uid) + "&select=birth_date,sex,smoking_status,comorbidities,history&limit=1");
        String motivo = Idade.motivo(p);
        if (motivo != null) return motivo;
        JSONArray labs = buscarLista(token, "lab_results?patient_user_id=eq." + enc(uid) + "&select=marker_key,value_num&order=collected_at.desc&limit=200");
        Double ct = null;
        Double hdl = null;
        for (int i = 0; i < labs.length(); i++) {
            JSONObject lab = labs.getJSONObject(i);
            String chave = lab.optString("marker_key");
            if (ct == null && "total_cholesterol".equals(chave) && !lab.isNull("value_num")) ct = lab.optDouble("value_num");
            if (hdl == null && "hdl".equals(chave) && !lab.isNull("value_num")) hdl = lab.optDouble("value_num");
        }
        JSONArray pressoes = buscarLista(token, "bp_readings?patient_user_id=eq." + enc(uid)
                + "&select=systolic,cuff_validated,validation_status&order=recorded_at.desc&limit=40");
        int n = 0;
        int soma = 0;
        for (int i = 0; i < pressoes.length() && n < 10; i++) {
            JSONObject r = pressoes.getJSONObject(i);
            if (!r.optBoolean("cuff_validated") || !"validated".equals(r.optString("validation_status"))) continue;
            soma += r.optInt("systolic");
            n++;
        }
        java.util.ArrayList<String> faltas = new java.util.ArrayList<>();
        if (ct == null) faltas.add("colesterol total");
        if (hdl == null) faltas.add("HDL");
        if (n == 0) faltas.add("uma medida de pressão com aparelho de braço");
        if (!faltas.isEmpty()) {
            return "Ainda falta um dado para calcular\nPara mostrar a idade do seu coração, precisamos de: " + String.join(", ", faltas) + ".";
        }
        int idade = Idade.anos(p.optString("birth_date"));
        Idade.Resultado r = Idade.calcular(idade, p.optString("sex"), ct, hdl, Math.round(soma / (float) n), true,
                "current".equals(p.optString("smoking_status")), p.optJSONObject("comorbidities") != null && p.optJSONObject("comorbidities").optBoolean("diabetes"));
        if (r == null) return "Ainda falta um dado para calcular";
        String teto = r.noTeto ? "mais de " : "";
        String mais = r.noTeto ? "+" : "";
        String explicacao;
        if (r.diferenca > 0) {
            explicacao = "É uma estimativa de risco traduzida em anos: pessoas com os seus fatores de risco costumam ter o risco de quem tem " + teto + r.idadeDoCoracao + " anos.";
        } else if (r.diferenca == 0) {
            explicacao = "É uma estimativa de risco traduzida em anos — e a sua está igual à sua idade real.";
        } else {
            explicacao = "É uma estimativa de risco traduzida em anos — a sua está " + Math.abs(r.diferenca) + " anos abaixo da sua idade real.";
        }
        return r.idadeDoCoracao + mais + " anos\nSua idade: " + r.idadeReal + " anos\n" + explicacao
                + "\nÉ um cálculo populacional a partir dos seus fatores de risco, não uma medida direta do seu coração. Ele se move quando os fatores abaixo se movem.";
    }

    private static String formatarValor(double v) {
        if (Math.abs(v - Math.rint(v)) < 0.05) return String.valueOf((long) Math.rint(v));
        return String.format(java.util.Locale.ROOT, "%.1f", v);
    }

    private String[] medico(String token, String uid) throws Exception {
        JSONArray links = buscarLista(token, "professional_patient_links?patient_user_id=eq." + enc(uid) + "&status=eq.active&select=professional_id&limit=1");
        if (links.length() == 0) return new String[] { "Meu médico", "" };
        String id = links.getJSONObject(0).optString("professional_id");
        JSONObject p = buscarUm(token, "professional_profiles?id=eq." + enc(id) + "&select=display_name,clinic_name");
        if (p == null) return new String[] { "Seu médico", "" };
        String nome = p.optString("display_name", "");
        return new String[] { nome.isEmpty() ? "Seu médico" : nome, p.optString("clinic_name", "") };
    }

    private String mensagens(String token, String uid) throws Exception {
        marcarLidas(token, uid);
        JSONArray lista = buscarLista(token, "patient_messages?patient_user_id=eq." + enc(uid) + "&select=sender,body,created_at&order=created_at.asc&limit=300");
        if (lista.length() == 0) return "Nenhuma mensagem ainda. Escreva para o seu médico abaixo.";
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < lista.length(); i++) {
            JSONObject m = lista.getJSONObject(i);
            boolean minha = "patient".equals(m.optString("sender"));
            s.append(minha ? "Você" : "Médico").append(" · ").append(hora(m.optString("created_at"))).append('\n');
            s.append(m.optString("body")).append("\n\n");
        }
        return s.toString().trim();
    }

    private void marcarLidas(String token, String uid) {
        try {
            JSONObject o = new JSONObject().put("read_at", Instant.now().toString());
            pedir("PATCH", URL_BASE + "/rest/v1/patient_messages?patient_user_id=eq." + enc(uid) + "&sender=eq.doctor&read_at=is.null",
                    o.toString(), token, "return=minimal", null);
        } catch (Exception ignored) {
            /* a conversa continua */
        }
    }

    private JSONObject buscarUm(String token, String caminho) throws Exception {
        JSONArray lista = buscarLista(token, caminho);
        return lista.length() == 0 ? null : lista.getJSONObject(0);
    }

    private JSONArray buscarLista(String token, String caminho) throws Exception {
        Http r = pedir("GET", URL_BASE + "/rest/v1/" + caminho, null, token, null, null);
        if (r.codigo < 200 || r.codigo >= 300) throw new Exception("lista");
        String corpo = r.corpo == null || r.corpo.isEmpty() ? "[]" : r.corpo;
        return new JSONArray(corpo);
    }

    private static String primeiroNome(JSONObject perfil) {
        if (perfil == null) return "";
        String nome = perfil.optString("full_name", "").trim();
        if (nome.isEmpty()) return "";
        int espaco = nome.indexOf(' ');
        return espaco < 0 ? nome : nome.substring(0, espaco);
    }

    private static String rotuloMetrica(String metric) {
        switch (metric) {
            case "bp": return "Pressão";
            case "weight": return "Peso";
            case "hr": return "Batimentos";
            case "spo2": return "Oxigenação";
            case "glucose": return "Glicemia";
            case "steps": return "Passos";
            case "sleep": return "Sono";
            case "wellbeing": return "Como me sinto";
            default: return metric;
        }
    }

    private static String saudacao() {
        int h = java.time.LocalTime.now().getHour();
        if (h < 12) return "Bom dia";
        if (h < 18) return "Boa tarde";
        return "Boa noite";
    }

    private static String hora(String iso) {
        try {
            java.time.ZonedDateTime z = Instant.parse(iso).atZone(java.time.ZoneId.systemDefault());
            return String.format(java.util.Locale.ROOT, "%02d:%02d", z.getHour(), z.getMinute());
        } catch (Exception ex) {
            return "";
        }
    }

    private static int numero(String s) {
        try { return Integer.parseInt(s.trim()); } catch (Exception ex) { return 0; }
    }

    private static double decimal(String s) {
        try { return Double.parseDouble(s.trim().replace(',', '.')); } catch (Exception ex) { return 0; }
    }

    private static Http pedir(String metodo, String url, String json, String token, String prefer, String faixa) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(12000);
        c.setReadTimeout(12000);
        c.setRequestMethod(metodo);
        c.setRequestProperty("apikey", CHAVE);
        c.setRequestProperty("Authorization", "Bearer " + (token != null ? token : CHAVE));
        c.setRequestProperty("Content-Type", "application/json");
        c.setRequestProperty("Accept", "application/json");
        if (prefer != null) c.setRequestProperty("Prefer", prefer);
        if (faixa != null) c.setRequestProperty("Range", faixa);
        if (json != null && !"GET".equals(metodo)) {
            c.setDoOutput(true);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            c.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = c.getOutputStream()) {
                out.write(bytes);
            }
        }
        int codigo = c.getResponseCode();
        InputStream in = codigo >= 400 ? c.getErrorStream() : c.getInputStream();
        String corpo = ler(in);
        String range = c.getHeaderField("Content-Range");
        c.disconnect();
        return new Http(codigo, corpo, range);
    }

    private static String ler(InputStream in) throws Exception {
        if (in == null) return "";
        try (InputStream aberto = in) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] tmp = new byte[2048];
            int n;
            while ((n = aberto.read(tmp)) >= 0) buf.write(tmp, 0, n);
            return buf.toString(StandardCharsets.UTF_8);
        }
    }

    private static final class Http {
        final int codigo;
        final String corpo;
        final String faixa;

        Http(int codigo, String corpo, String faixa) {
            this.codigo = codigo;
            this.corpo = corpo == null ? "" : corpo;
            this.faixa = faixa;
        }
    }
}
