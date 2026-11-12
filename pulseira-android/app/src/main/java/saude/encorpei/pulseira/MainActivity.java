package saude.encorpei.pulseira;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.Spinner;
import android.widget.TextView;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends android.app.Activity {
    private static final int PEDIDO_PERMISSAO = 1;

    private TextView nome;
    private TextView selo;
    private TextView frase;
    private View blocoVivo;
    private TextView bpm;
    private TextView contato;
    private TextView canal;
    private TextView mensagem;
    private TextView importarAviso;
    private TextView ajudaCorpo;
    private TextView sessao;
    private TextView ultima;
    private TextView chegou;
    private TextView loginMsg;
    private EditText email;
    private EditText senha;
    private View login;
    private View conteudo;
    private View sair;
    private Button conectar;
    private Button entrar;

    private PulseiraService servico;
    private Conta conta;
    private ExecutorService rede;
    private boolean amarrado;
    private boolean sairDepois;
    private int painelPara = -2;
    private String modo = "entrar";
    private String textoArquivo;
    private Importacao.Resultado previaArquivo;
    private final Map<String, Spinner> mapas = new HashMap<>();
    private EditText nomeConta;
    private EditText senha2;
    private CheckBox termos;
    private CheckBox saude;
    private Button criarConta;
    private Button esqueci;
    private Button reenviar;
    private TextView previa;
    private LinearLayout mapa;
    private Button confirmarArquivo;
    private Button cancelarArquivo;
    private static final int PEDIDO_ARQUIVO = 2;
    private final Runnable contaMudou = () -> runOnUiThread(this::redesenhar);

    private final PulseiraService.Ouvinte ouvinte = e -> redesenhar();

    private final ServiceConnection conexao = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            servico = ((PulseiraService.Local) binder).servico();
            servico.observar(ouvinte);
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            servico = null;
            redesenhar();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        nome = findViewById(R.id.nome);
        selo = findViewById(R.id.selo);
        frase = findViewById(R.id.frase);
        blocoVivo = findViewById(R.id.bloco_vivo);
        bpm = findViewById(R.id.bpm);
        contato = findViewById(R.id.contato);
        canal = findViewById(R.id.canal);
        mensagem = findViewById(R.id.mensagem);
        importarAviso = findViewById(R.id.importar_aviso);
        ajudaCorpo = findViewById(R.id.ajuda_corpo);
        sessao = findViewById(R.id.sessao);
        ultima = findViewById(R.id.ultima);
        chegou = findViewById(R.id.chegou);
        loginMsg = findViewById(R.id.login_msg);
        email = findViewById(R.id.email);
        senha = findViewById(R.id.senha);
        login = findViewById(R.id.login);
        conteudo = findViewById(R.id.conteudo);
        sair = findViewById(R.id.sair);
        conectar = findViewById(R.id.conectar);
        entrar = findViewById(R.id.entrar);
        nomeConta = findViewById(R.id.nome_conta);
        senha2 = findViewById(R.id.senha2);
        termos = findViewById(R.id.termos);
        saude = findViewById(R.id.saude);
        criarConta = findViewById(R.id.criar_conta);
        esqueci = findViewById(R.id.esqueci);
        reenviar = findViewById(R.id.reenviar);
        previa = findViewById(R.id.previa);
        mapa = findViewById(R.id.mapa);
        confirmarArquivo = findViewById(R.id.confirmar_arquivo);
        cancelarArquivo = findViewById(R.id.cancelar_arquivo);
        findViewById(R.id.desligar).setVisibility(View.GONE);
        conta = Conta.obter(this);
        rede = Executors.newSingleThreadExecutor();
        conta.ouvir(contaMudou);
        findViewById(R.id.ajuda).setOnClickListener(v ->
                ajudaCorpo.setVisibility(ajudaCorpo.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE));
        conectar.setOnClickListener(v -> {
            if (servico != null && "conectada".equals(servico.estado().fase)) desligarPulseira();
            else pedirConexao();
        });
        entrar.setOnClickListener(v -> entrar());
        criarConta.setOnClickListener(v -> {
            modo = "entrar".equals(modo) ? "criar" : "entrar";
            if (conta != null) conta.aguardandoSenha = false;
            pintarModo();
        });
        esqueci.setOnClickListener(v -> {
            modo = "esqueci";
            pintarModo();
        });
        reenviar.setOnClickListener(v -> rede.execute(() -> {
            String msg = conta.reenviar(email.getText().toString());
            runOnUiThread(() -> loginMsg.setText(msg));
        }));
        findViewById(R.id.importar).setOnClickListener(v -> escolherArquivo());
        confirmarArquivo.setOnClickListener(v -> confirmarArquivo());
        cancelarArquivo.setOnClickListener(v -> limparArquivo());
        sair.setOnClickListener(v -> pedirSaida());
        tratarLink(getIntent());
        pintarModo();
        redesenhar();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        tratarLink(intent);
    }

    @Override
    protected void onDestroy() {
        if (conta != null) conta.esquecer(contaMudou);
        if (rede != null) rede.shutdown();
        super.onDestroy();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (PulseiraService.emExecucao && !amarrado) {
            bindService(new Intent(this, PulseiraService.class), conexao, 0);
            amarrado = true;
        }
    }

    @Override
    protected void onStop() {
        if (servico != null) servico.esquecer(ouvinte);
        if (amarrado) {
            unbindService(conexao);
            amarrado = false;
            servico = null;
        }
        super.onStop();
    }

    private void pedirConexao() {
        ArrayList<String> falta = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                falta.add(Manifest.permission.BLUETOOTH_SCAN);
            }
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
                falta.add(Manifest.permission.BLUETOOTH_CONNECT);
            }
        } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            falta.add(Manifest.permission.ACCESS_FINE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            falta.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!falta.isEmpty()) {
            requestPermissions(falta.toArray(new String[0]), PEDIDO_PERMISSAO);
            return;
        }
        seguirConexao();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(requestCode, permissions, grants);
        if (requestCode != PEDIDO_PERMISSAO) return;
        for (int i = 0; i < permissions.length; i++) {
            if (Manifest.permission.POST_NOTIFICATIONS.equals(permissions[i])) continue;
            if (grants[i] != PackageManager.PERMISSION_GRANTED) {
                mensagem.setText(R.string.permissao);
                return;
            }
        }
        seguirConexao();
    }

    private void seguirConexao() {
        BluetoothManager manager = getSystemService(BluetoothManager.class);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null) {
            mensagem.setText("Este celular não tem Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            mensagem.setText("O Bluetooth deste celular está desligado. Ligue e toque em conectar de novo.");
            try {
                startActivity(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE));
            } catch (Exception ignored) {
                /* o texto acima cobre a recusa */
            }
            return;
        }
        if (Build.VERSION.SDK_INT < 31 && !localizacaoLigada()) {
            mensagem.setText("Neste Android, a busca da pulseira precisa da localização ligada. O app não lê GPS.");
            return;
        }
        if (amarrado) {
            if (servico != null) servico.esquecer(ouvinte);
            unbindService(conexao);
            amarrado = false;
            servico = null;
        }
        Intent i = new Intent(this, PulseiraService.class);
        startForegroundService(i);
        bindService(i, conexao, BIND_AUTO_CREATE);
        amarrado = true;
    }

    private boolean localizacaoLigada() {
        LocationManager lm = getSystemService(LocationManager.class);
        if (lm == null) return false;
        try {
            if (Build.VERSION.SDK_INT >= 28) return lm.isLocationEnabled();
            return lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                    || lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER);
        } catch (Exception e) {
            return false;
        }
    }

    private void desligarPulseira() {
        if (servico != null) servico.desligar();
        else startForegroundService(new Intent(this, PulseiraService.class).setAction(PulseiraService.ACAO_DESLIGAR));
    }

    private void pedirSaida() {
        if (servico != null && !"parada".equals(servico.estado().fase)) {
            sairDepois = true;
            servico.desligar();
            return;
        }
        conta.sair();
        painelPara = -2;
        redesenhar();
    }

    private void pintarModo() {
        boolean criar = "criar".equals(modo);
        boolean esqueceu = "esqueci".equals(modo);
        boolean senhaNova = "senha".equals(modo) || (conta != null && conta.aguardandoSenha);
        nomeConta.setVisibility(criar ? View.VISIBLE : View.GONE);
        senha.setVisibility(esqueceu ? View.GONE : View.VISIBLE);
        senha2.setVisibility(senhaNova ? View.VISIBLE : View.GONE);
        termos.setVisibility(criar ? View.VISIBLE : View.GONE);
        saude.setVisibility(criar ? View.VISIBLE : View.GONE);
        reenviar.setVisibility(criar ? View.VISIBLE : View.GONE);
        esqueci.setVisibility(criar || senhaNova ? View.GONE : View.VISIBLE);
        criarConta.setText(! "entrar".equals(modo) || senhaNova ? R.string.ja_tenho_conta : R.string.criar_conta);
        if (criar) entrar.setText(R.string.criar_conta);
        else if (esqueceu) entrar.setText("Enviar link de recuperação");
        else if (senhaNova) entrar.setText("Salvar nova senha");
        else entrar.setText(R.string.entrar);
    }

    private void tratarLink(Intent intent) {
        if (intent == null || intent.getData() == null || conta == null) return;
        String bruto = intent.getData().toString();
        if (intent.getData().getFragment() != null && !bruto.contains("#")) {
            bruto = bruto + "#" + intent.getData().getFragment();
        }
        final String link = bruto;
        rede.execute(() -> {
            String msg = conta.abrirLink(link);
            runOnUiThread(() -> {
                if (conta.aguardandoSenha) modo = "senha";
                pintarModo();
                if (msg != null) loginMsg.setText(msg);
                else {
                    painelPara = -2;
                    redesenhar();
                }
            });
        });
    }

    private void entrar() {
        String em = email.getText().toString();
        if (em.contains("access_token")) {
            entrar.setEnabled(false);
            rede.execute(() -> {
                String msg = conta.abrirLink(em);
                runOnUiThread(() -> {
                    entrar.setEnabled(true);
                    if (conta.aguardandoSenha) modo = "senha";
                    pintarModo();
                    if (msg != null) loginMsg.setText(msg);
                    else {
                        painelPara = -2;
                        redesenhar();
                    }
                });
            });
            return;
        }
        entrar.setEnabled(false);
        loginMsg.setText("");
        String se = senha.getText().toString();
        String se2 = senha2.getText().toString();
        String nome = nomeConta.getText().toString();
        boolean aceitaTermos = termos.isChecked();
        boolean aceitaSaude = saude.isChecked();
        String modoAtual = conta.aguardandoSenha ? "senha" : modo;
        rede.execute(() -> {
            String erro;
            boolean okSemSessao = false;
            if ("criar".equals(modoAtual)) erro = conta.cadastrar(nome, em, se, aceitaTermos, aceitaSaude);
            else if ("esqueci".equals(modoAtual)) erro = conta.esqueci(em);
            else if ("senha".equals(modoAtual)) erro = conta.definirSenha(se, se2);
            else erro = conta.entrar(em, se);
            if (erro != null && (erro.startsWith("Conta criada") || erro.startsWith("Enviamos") || erro.startsWith("E-mail reenviado") || erro.startsWith("Escolha"))) {
                okSemSessao = true;
            }
            boolean sessao = erro == null;
            boolean aviso = okSemSessao;
            String texto = erro;
            runOnUiThread(() -> {
                entrar.setEnabled(true);
                if (sessao) {
                    senha.setText("");
                    senha2.setText("");
                    modo = "entrar";
                    painelPara = -2;
                    pintarModo();
                    redesenhar();
                } else if (aviso) {
                    loginMsg.setText(texto);
                    if (texto.startsWith("Este e-mail já tem cadastro")) modo = "entrar";
                    pintarModo();
                } else loginMsg.setText(texto == null ? "" : texto);
            });
        });
    }

    private void escolherArquivo() {
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.setType("*/*");
        i.addCategory(Intent.CATEGORY_OPENABLE);
        try {
            startActivityForResult(Intent.createChooser(i, getString(R.string.escolher_arquivo)), PEDIDO_ARQUIVO);
        } catch (Exception e) {
            importarAviso.setText("Não consegui abrir o arquivo. Tente de novo.");
            importarAviso.setVisibility(View.VISIBLE);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PEDIDO_ARQUIVO || resultCode != RESULT_OK || data == null || data.getData() == null) return;
        try (InputStream in = getContentResolver().openInputStream(data.getData())) {
            if (in == null) return;
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            byte[] tmp = new byte[4096];
            int n;
            int total = 0;
            while ((n = in.read(tmp)) >= 0) {
                total += n;
                if (total > 8_000_000) {
                    importarAviso.setText("O arquivo é grande demais para este app.");
                    importarAviso.setVisibility(View.VISIBLE);
                    return;
                }
                buf.write(tmp, 0, n);
            }
            textoArquivo = buf.toString(java.nio.charset.StandardCharsets.UTF_8);
            mostrarPrevia(Importacao.ler(textoArquivo, null));
        } catch (Exception e) {
            importarAviso.setText("Não consegui importar o arquivo. Tente de novo.");
            importarAviso.setVisibility(View.VISIBLE);
        }
    }

    private void mostrarPrevia(Importacao.Resultado r) {
        previaArquivo = r;
        StringBuilder t = new StringBuilder();
        for (String a : r.avisos) t.append(a).append('\n');
        if (!r.linhas.isEmpty()) {
            t.append(r.batimentos).append(" batimentos, ")
                    .append(r.oxigenacao).append(" oxigenação, ")
                    .append(r.pressao).append(" pressão (estimativa), ")
                    .append(r.atividade).append(" dias de passos, ")
                    .append(r.sono).append(" noites de sono.");
        }
        previa.setText(t.toString().trim());
        previa.setVisibility(View.VISIBLE);
        mapa.removeAllViews();
        mapas.clear();
        if (r.precisaConfirmacao && !r.cabecalho.isEmpty()) {
            List<String> opcoes = new ArrayList<>();
            opcoes.add("— não usar —");
            opcoes.addAll(r.cabecalho);
            for (String campo : Importacao.rotulos()) {
                TextView rotulo = new TextView(this);
                rotulo.setText(Importacao.rotulo(campo));
                rotulo.setTextColor(getColor(R.color.tinta));
                mapa.addView(rotulo);
                Spinner spinner = new Spinner(this);
                spinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, opcoes));
                Integer idx = r.mapeamento.get(campo);
                if (idx != null) spinner.setSelection(idx + 1);
                mapa.addView(spinner);
                mapas.put(campo, spinner);
            }
            mapa.setVisibility(View.VISIBLE);
            confirmarArquivo.setText("Conferir colunas");
        } else {
            mapa.setVisibility(View.GONE);
            confirmarArquivo.setText(R.string.salvar_arquivo);
        }
        confirmarArquivo.setVisibility(r.precisaConfirmacao || !r.linhas.isEmpty() ? View.VISIBLE : View.GONE);
        cancelarArquivo.setVisibility(View.VISIBLE);
        importarAviso.setVisibility(View.GONE);
    }

    private void confirmarArquivo() {
        if (previaArquivo == null) return;
        if (previaArquivo.precisaConfirmacao) {
            Map<String, Integer> override = new HashMap<>();
            for (Map.Entry<String, Spinner> e : mapas.entrySet()) {
                int pos = e.getValue().getSelectedItemPosition();
                if (pos > 0) override.put(e.getKey(), pos - 1);
            }
            mostrarPrevia(Importacao.ler(textoArquivo, override));
            return;
        }
        if (previaArquivo.linhas.isEmpty()) return;
        confirmarArquivo.setEnabled(false);
        String nome = servico != null && servico.estado().nome != null && !servico.estado().nome.isEmpty()
                ? servico.estado().nome : Importacao.NOME_ARQUIVO;
        List<Importacao.Linha> linhas = previaArquivo.linhas;
        rede.execute(() -> {
            String msg = conta.importar(linhas, nome);
            runOnUiThread(() -> {
                confirmarArquivo.setEnabled(true);
                importarAviso.setText(msg);
                importarAviso.setVisibility(View.VISIBLE);
                if (msg.startsWith("Arquivo importado") || msg.startsWith("Esse arquivo já")) limparArquivo();
                painelPara = -2;
                redesenhar();
            });
        });
    }

    private void limparArquivo() {
        textoArquivo = null;
        previaArquivo = null;
        previa.setVisibility(View.GONE);
        mapa.setVisibility(View.GONE);
        confirmarArquivo.setVisibility(View.GONE);
        cancelarArquivo.setVisibility(View.GONE);
    }

    private void redesenhar() {
        PulseiraService.Estado e = servico == null ? null : servico.estado();
        boolean logado = conta != null && conta.temSessao();
        login.setVisibility(logado ? View.GONE : View.VISIBLE);
        conteudo.setVisibility(logado ? View.VISIBLE : View.GONE);
        sair.setVisibility(logado ? View.VISIBLE : View.GONE);
        if (!logado) return;
        if (sairDepois && (e == null || "parada".equals(e.fase)) && (servico == null || !servico.salvando)) {
            sairDepois = false;
            conta.sair();
            painelPara = -2;
            login.setVisibility(View.VISIBLE);
            conteudo.setVisibility(View.GONE);
            sair.setVisibility(View.GONE);
            return;
        }
        if (conta.gravadas != painelPara) {
            painelPara = conta.gravadas;
            rede.execute(() -> conta.carregarPainel());
        }
        String fase = e == null ? "parada" : e.fase;
        boolean conectada = "conectada".equals(fase);
        boolean procurando = "procurando".equals(fase) || "conectando".equals(fase);
        boolean encerrando = servico != null && servico.salvando;
        boolean falhou = conta.erroEnvio != null || "erro".equals(fase);
        if (e != null && e.nome != null && !e.nome.isEmpty()) nome.setText(e.nome);
        else nome.setText(R.string.nome_generico);
        if (procurando) {
            pintarSelo(R.string.selo_conectando, R.drawable.selo_info, R.color.info);
            frase.setText(R.string.frase_conectando);
        } else if (encerrando) {
            pintarSelo(R.string.selo_sincronizando, R.drawable.selo_info, R.color.info);
            frase.setText(R.string.frase_sincronizando);
        } else if (falhou) {
            pintarSelo(R.string.selo_falhou, R.drawable.selo_aviso, R.color.aviso);
            frase.setText(R.string.frase_falhou);
        } else if (conectada && conta.gravadas > 0) {
            seloAtualizada();
        } else if (conectada) {
            pintarSelo(R.string.selo_sincronizando, R.drawable.selo_info, R.color.info);
            frase.setText(R.string.frase_sincronizando);
        } else if (conta.ultimaIso == null) {
            pintarSelo(R.string.selo_nao, R.drawable.selo_normal, R.color.secundaria);
            frase.setText(R.string.frase_nao);
        } else if (diasDesde(conta.ultimaIso) > 3) {
            pintarSelo(R.string.selo_atrasada, R.drawable.selo_aviso, R.color.aviso);
            frase.setText(R.string.frase_atrasada);
        } else {
            seloAtualizada();
        }
        if (encerrando) {
            conectar.setText(R.string.salvando);
            conectar.setEnabled(false);
        } else if (conectada) {
            conectar.setText(R.string.encerrar);
            conectar.setEnabled(true);
        } else if (procurando) {
            conectar.setText(R.string.conectando);
            conectar.setEnabled(false);
        } else {
            conectar.setText(R.string.conectar);
            conectar.setEnabled(true);
        }
        blocoVivo.setVisibility(conectada || encerrando ? View.VISIBLE : View.GONE);
        if (e != null && e.bpm != null) {
            bpm.setText(String.valueOf(e.bpm));
            bpm.setContentDescription(e.bpm + " batimentos por minuto");
        } else {
            bpm.setText(R.string.bpm_vazio);
            bpm.setContentDescription("Sem batimento");
        }
        if (e == null || e.contato == null) contato.setText("");
        else contato.setText(e.contato ? R.string.contato_sim : R.string.contato_nao);
        canal.setText(e == null || e.canal == null ? "" : e.canal);
        int n = conta.gravadas;
        if (n > 0) {
            sessao.setText(n + (n == 1 ? " medida salva nesta sessão" : " medidas salvas nesta sessão"));
        } else {
            sessao.setText(R.string.primeira_medida);
        }
        ultima.setText(conta.ultimaIso == null ? getString(R.string.ultima_vazia) : formatar(conta.ultimaIso));
        chegou.setText(textoChegou());
        if (conta.erroEnvio != null) mensagem.setText(conta.erroEnvio);
        else if ("erro".equals(fase) && e.mensagem != null) mensagem.setText(e.mensagem);
        else mensagem.setText("");
    }

    private void pintarSelo(int texto, int fundo, int tinta) {
        selo.setText(texto);
        selo.setBackgroundResource(fundo);
        selo.setTextColor(getColor(tinta));
    }

    private void seloAtualizada() {
        pintarSelo(R.string.selo_atualizada, R.drawable.selo_ok, R.color.sucesso);
        frase.setText(conta.medicoConhecido && conta.temMedico
                ? R.string.frase_atualizada_medico
                : R.string.frase_atualizada);
    }

    private String textoChegou() {
        StringBuilder s = new StringBuilder();
        juntar(s, conta.batimentos, "batimentos");
        juntar(s, conta.oxigenacao, "oxigenação");
        juntar(s, conta.pressao, "pressão (estimativa)");
        juntar(s, conta.passos, "dias de passos");
        juntar(s, conta.sono, "noites de sono");
        return s.length() == 0 ? getString(R.string.chegou_vazio) : s.toString();
    }

    private static void juntar(StringBuilder s, int n, String rotulo) {
        if (n <= 0) return;
        if (s.length() > 0) s.append(" · ");
        s.append(n).append(' ').append(rotulo);
    }

    private static double diasDesde(String iso) {
        try {
            return (System.currentTimeMillis() - Instant.parse(iso).toEpochMilli()) / 86_400_000.0;
        } catch (Exception e) {
            return 0;
        }
    }

    private static String formatar(String iso) {
        try {
            return DateTimeFormatter.ofPattern("dd/MM/yyyy, HH:mm")
                    .withZone(ZoneId.systemDefault())
                    .format(Instant.parse(iso));
        } catch (Exception e) {
            return iso;
        }
    }
}
