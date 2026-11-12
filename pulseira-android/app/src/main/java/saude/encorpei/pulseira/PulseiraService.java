package saude.encorpei.pulseira;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.drawable.Icon;
import android.location.LocationManager;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.ParcelUuid;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Segura o GATT fora da tela. O protocolo é o de {@link Protocolo}:
 * Heart Rate padrão ou canal Colmi, comandos 105 e 106.
 */
@SuppressLint("MissingPermission")
public final class PulseiraService extends Service {
    public static final String ACAO_DESLIGAR = "saude.encorpei.pulseira.DESLIGAR";

    /** O que startNotifications() grava no Web Bluetooth. Não é comando da pulseira. */
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");
    private static final String CANAL = "pulseira";
    private static final int NOTIF_ID = 1;
    private static final long REPETIR_MEDICAO_MS = 1500;
    /** Política da sessão Android, não do protocolo da pulseira. */
    private static final long RECONEXAO_MS = 2000;
    private static final int TENTATIVAS_ENDERECO = 3;

    public static volatile boolean emExecucao;

    public static final class Estado {
        public final String fase;
        public final String nome;
        public final Integer bpm;
        public final String canal;
        public final Boolean contato;
        public final String mensagem;

        public Estado(String fase, String nome, Integer bpm, String canal, Boolean contato, String mensagem) {
            this.fase = fase;
            this.nome = nome;
            this.bpm = bpm;
            this.canal = canal;
            this.contato = contato;
            this.mensagem = mensagem;
        }
    }

    public interface Ouvinte {
        void onEstado(Estado estado);
    }

    public final class Local extends Binder {
        public PulseiraService servico() {
            return PulseiraService.this;
        }
    }

    private final Local local = new Local();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final CopyOnWriteArrayList<Ouvinte> ouvintes = new CopyOnWriteArrayList<>();
    private final ArrayDeque<Runnable> fila = new ArrayDeque<>();
    private final AtomicBoolean achou = new AtomicBoolean(false);
    private final Runnable repetirMedicao = this::repetirMedicao;
    private final Runnable quedaRunnable = this::cairAgora;
    private final Runnable avisoBusca = this::avisoBusca;
    private final Runnable encerrarTimeout = this::encerrar;

    private SharedPreferences prefs;
    private Conta conta;
    private ExecutorService rede;
    private final Runnable contaMudou = this::publicar;
    private final ArrayList<Integer> rrJanela = new ArrayList<>();
    public boolean salvando;
    private boolean temAmostra;
    private int ultimoBpm;
    private Boolean ultimoContato;
    private Double ultimoRmssd;
    private Double ultimoSdnn;
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic rx;
    private BluetoothGattCharacteristic tx;
    private Runnable depoisDoCccd;

    private String fase = "parada";
    private String nome;
    private String enderecoAtual;
    private Integer bpm;
    private String canal;
    private Boolean contato;
    private String mensagem;
    private boolean canalColmiAtivo;
    private boolean aoVivo;
    private boolean parado;
    private int semBatimento;
    private int falhas;
    private boolean reconectar;
    private boolean userStop;
    private boolean desligando;
    private boolean encerrado;
    private boolean frente;
    private boolean escaneando;
    private boolean ocupado;
    private boolean quedaAgendada;
    private boolean escrevendoInicio;
    private volatile int opSeq;

    private final BluetoothGattCallback gattCallback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            handler.post(() -> aoMudarConexao(g, status, newState));
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            handler.post(() -> aoServicos(g, status));
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor descriptor, int status) {
            int seq = opSeq;
            handler.post(() -> aoDescritor(g, status, seq));
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] value) {
            byte[] copia = value == null ? new byte[0] : java.util.Arrays.copyOf(value, value.length);
            handler.post(() -> {
                if (g != gatt) return;
                tratar(c, copia);
            });
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) {
            if (Build.VERSION.SDK_INT >= 33) return;
            byte[] value = c.getValue();
            byte[] copia = value == null ? new byte[0] : java.util.Arrays.copyOf(value, value.length);
            handler.post(() -> {
                if (g != gatt) return;
                tratar(c, copia);
            });
        }

        @Override
        public void onCharacteristicWrite(BluetoothGatt g, BluetoothGattCharacteristic c, int status) {
            int seq = opSeq;
            handler.post(() -> aoEscrita(g, status, seq));
        }
    };

    private final ScanCallback scanCallback = new ScanCallback() {
        @Override
        public void onScanResult(int callbackType, ScanResult result) {
            handler.post(() -> aoVer(result));
        }

        @Override
        public void onBatchScanResults(List<ScanResult> results) {
            handler.post(() -> {
                for (ScanResult result : results) aoVer(result);
            });
        }

        @Override
        public void onScanFailed(int errorCode) {
            handler.post(() -> {
                escaneando = false;
                falhar("Não consegui procurar a pulseira. Tente de novo.");
            });
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        emExecucao = true;
        prefs = getSharedPreferences("pulseira", MODE_PRIVATE);
        conta = Conta.obter(this);
        rede = Executors.newSingleThreadExecutor();
        conta.ouvir(contaMudou);
        mensagem = getString(R.string.ociosa);
        garantirCanal();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        garantirCanal();
        boolean pedidoDesligar = intent != null && ACAO_DESLIGAR.equals(intent.getAction());
        if (!pedidoDesligar) {
            boolean nova = "parada".equals(fase) || "erro".equals(fase);
            encerrado = false;
            desligando = false;
            userStop = false;
            if (nova && conta != null) conta.reiniciarSessao();
        }
        entrarFrente();
        if (pedidoDesligar) {
            desligar();
            return START_NOT_STICKY;
        }
        if (intent != null) prefs.edit().putBoolean("ativo", true).apply();
        if (!prefs.getBoolean("ativo", false)) {
            encerrar();
            return START_NOT_STICKY;
        }
        if (gatt == null && !escaneando) comecar();
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return local;
    }

    @Override
    public void onDestroy() {
        emExecucao = false;
        if (conta != null) conta.esquecer(contaMudou);
        if (rede != null) rede.shutdown();
        reconectar = false;
        pararScan();
        fecharGatt();
        super.onDestroy();
    }

    public void observar(Ouvinte ouvinte) {
        ouvintes.add(ouvinte);
        ouvinte.onEstado(snapshot());
    }

    public void esquecer(Ouvinte ouvinte) {
        ouvintes.remove(ouvinte);
    }

    public void desligar() {
        if (desligando || encerrado) return;
        desligando = true;
        userStop = true;
        reconectar = false;
        prefs.edit().putBoolean("ativo", false).apply();
        handler.removeCallbacks(repetirMedicao);
        handler.removeCallbacks(quedaRunnable);
        handler.removeCallbacks(avisoBusca);
        quedaAgendada = false;
        pararScan();
        parado = true;
        aoVivo = false;
        salvando = temAmostra;
        publicar();
        final boolean tem = temAmostra;
        final String nomeSalvo = nome;
        final int bpmSalvo = ultimoBpm;
        final Boolean contatoSalvo = ultimoContato;
        final Double rmssdSalvo = ultimoRmssd;
        final Double sdnnSalvo = ultimoSdnn;
        rede.execute(() -> {
            if (tem) conta.gravar(nomeSalvo, bpmSalvo, contatoSalvo, rmssdSalvo, sdnnSalvo, true);
            handler.post(this::cortarLink);
        });
    }

    private void cortarLink() {
        salvando = false;
        if (encerrado) return;
        if (gatt != null && rx != null && canalColmiAtivo) {
            limparFila();
            enfileirar(() -> escreverRx(Protocolo.pacotePararBatimento(), false));
            handler.postDelayed(encerrarTimeout, REPETIR_MEDICAO_MS);
        } else {
            encerrar();
        }
    }

    private void comecar() {
        reconectar = true;
        falhas = 0;
        BluetoothAdapter adapter = adaptador();
        if (adapter == null) {
            falhar("Este celular não tem Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            falhar("O Bluetooth deste celular está desligado. Ligue e toque em conectar de novo.");
            return;
        }
        if (Build.VERSION.SDK_INT < 31 && !localizacaoLigada()) {
            falhar("Neste Android, a busca da pulseira precisa da localização ligada. O app não lê GPS.");
            return;
        }
        String endereco = prefs.getString("endereco", null);
        if (endereco != null) conectarEndereco(endereco);
        else procurar();
    }

    private void procurar() {
        pararScan();
        achou.set(false);
        BluetoothAdapter adapter = adaptador();
        if (adapter == null || !adapter.isEnabled()) {
            falhar("O Bluetooth deste celular está desligado. Ligue e toque em conectar de novo.");
            return;
        }
        BluetoothLeScanner scannerLocal;
        try {
            scannerLocal = adapter.getBluetoothLeScanner();
        } catch (SecurityException e) {
            falhar("O celular não deixou procurar a pulseira. Permita o Bluetooth e tente de novo.");
            return;
        }
        if (scannerLocal == null) {
            falhar("O Bluetooth deste celular está desligado. Ligue e toque em conectar de novo.");
            return;
        }
        scanner = scannerLocal;
        fase = "procurando";
        mensagem = "Procurando a pulseira.";
        bpm = null;
        canal = null;
        contato = null;
        publicar();
        handler.removeCallbacks(avisoBusca);
        handler.postDelayed(avisoBusca, 15000);
        ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .build();
        try {
            escaneando = true;
            scanner.startScan(null, settings, scanCallback);
        } catch (SecurityException e) {
            escaneando = false;
            falhar("O celular não deixou procurar a pulseira. Permita o Bluetooth e tente de novo.");
        }
    }

    private void avisoBusca() {
        if (!"procurando".equals(fase)) return;
        mensagem = "Ainda procurando. Deixe a pulseira perto do celular.";
        publicar();
    }

    private void aoVer(ScanResult result) {
        if (userStop || encerrado || !escaneando) return;
        BluetoothDevice device = result.getDevice();
        if (device == null) return;
        ScanRecord rec = result.getScanRecord();
        String anunciado = rec == null ? null : rec.getDeviceName();
        if (anunciado == null) {
            try {
                anunciado = device.getName();
            } catch (SecurityException ignored) {
                anunciado = null;
            }
        }
        boolean hr = false;
        if (rec != null && rec.getServiceUuids() != null) {
            for (ParcelUuid uuid : rec.getServiceUuids()) {
                if (Protocolo.HEART_RATE_SERVICE.equals(uuid.getUuid())) hr = true;
            }
        }
        if (!Protocolo.nomeCompativel(anunciado) && !hr) return;
        if (!achou.compareAndSet(false, true)) return;
        pararScan();
        enderecoAtual = device.getAddress();
        prefs.edit().putString("endereco", enderecoAtual).apply();
        if (anunciado != null && !anunciado.isEmpty()) nome = anunciado;
        conectar(device);
    }

    private void conectarEndereco(String endereco) {
        BluetoothAdapter adapter = adaptador();
        if (adapter == null) {
            falhar("Este celular não tem Bluetooth.");
            return;
        }
        BluetoothDevice device;
        try {
            device = adapter.getRemoteDevice(endereco);
        } catch (IllegalArgumentException e) {
            prefs.edit().remove("endereco").apply();
            enderecoAtual = null;
            procurar();
            return;
        }
        enderecoAtual = endereco;
        conectar(device);
    }

    private void conectar(BluetoothDevice device) {
        fase = "conectando";
        mensagem = "Conectando.";
        publicar();
        fecharGatt();
        try {
            gatt = device.connectGatt(this, false, gattCallback, BluetoothDevice.TRANSPORT_LE);
        } catch (SecurityException e) {
            falhar("O celular não deixou conectar na pulseira. Permita o Bluetooth e tente de novo.");
            return;
        }
        if (gatt == null) aoCair();
    }

    private void aoMudarConexao(BluetoothGatt g, int status, int newState) {
        if (g != gatt || userStop || encerrado) return;
        if (status != BluetoothGatt.GATT_SUCCESS) {
            aoCair();
            return;
        }
        if (newState == BluetoothProfile.STATE_CONNECTED) {
            falhas = 0;
            fase = "conectando";
            mensagem = "Conectada. Procurando o canal de batimentos.";
            try {
                String anunciado = g.getDevice().getName();
                if (anunciado != null && !anunciado.isEmpty()) nome = anunciado;
            } catch (SecurityException ignored) {
                /* o anúncio da busca fica */
            }
            publicar();
            try {
                if (!g.discoverServices()) aoCair();
            } catch (SecurityException e) {
                falhouCanal("O celular não deixou ler os canais da pulseira.");
            }
            return;
        }
        if (newState == BluetoothProfile.STATE_DISCONNECTED) aoCair();
    }

    private void aoServicos(BluetoothGatt g, int status) {
        if (g != gatt || userStop || encerrado) return;
        if (status != BluetoothGatt.GATT_SUCCESS) {
            aoCair();
            return;
        }
        montarCanal(g);
    }

    private void montarCanal(BluetoothGatt g) {
        BluetoothGattService hr = g.getService(Protocolo.HEART_RATE_SERVICE);
        if (hr != null) {
            BluetoothGattCharacteristic medicao = hr.getCharacteristic(Protocolo.HEART_RATE_MEASUREMENT);
            if (medicao != null && prepararPadrao(medicao)) return;
        }
        if (ligarColmi(g)) return;
        falhouCanal(mensagemSemCanal(g));
    }

    /** Heart Rate padrão primeiro, como conectarPulseira. Se o aviso não arma, tenta Colmi. */
    private boolean prepararPadrao(BluetoothGattCharacteristic medicao) {
        canalColmiAtivo = false;
        rx = null;
        tx = medicao;
        canal = Protocolo.NOME_CANAL_PADRAO;
        depoisDoCccd = () -> {
            if (nome == null || nome.isEmpty()) nome = "Pulseira";
            fase = "conectada";
            mensagem = "Conectada. O serviço continua com a tela fechada.";
            publicar();
        };
        return ativarAvisos(medicao);
    }

    private boolean ligarColmi(BluetoothGatt g) {
        Par colmi = acharColmi(g);
        if (colmi == null) return false;
        rx = colmi.rx;
        tx = colmi.tx;
        canalColmiAtivo = true;
        canal = Protocolo.NOME_CANAL_COLMI;
        depoisDoCccd = () -> {
            if (nome == null || nome.isEmpty()) nome = "Pulseira";
            fase = "conectada";
            mensagem = "Conectada. Pedindo batimento.";
            aoVivo = true;
            parado = false;
            semBatimento = 0;
            publicar();
            enfileirar(() -> escreverRx(Protocolo.pacoteIniciarBatimento(), true));
        };
        return ativarAvisos(tx);
    }

    private Par acharColmi(BluetoothGatt g) {
        List<BluetoothGattService> servicos = new ArrayList<>(g.getServices());
        servicos.sort(Comparator.comparingInt(s -> Protocolo.ordemServico(s.getUuid())));
        for (BluetoothGattService svc : servicos) {
            BluetoothGattCharacteristic escrita = null;
            BluetoothGattCharacteristic aviso = null;
            for (BluetoothGattCharacteristic c : svc.getCharacteristics()) {
                if (Protocolo.prefixoCaracteristica(c.getUuid(), Protocolo.RX_PREFIXO)) escrita = c;
                if (Protocolo.prefixoCaracteristica(c.getUuid(), Protocolo.TX_PREFIXO)) aviso = c;
            }
            if (escrita != null && aviso != null) return new Par(escrita, aviso);
        }
        for (BluetoothGattService svc : servicos) {
            if (!Protocolo.canalColmi(svc.getUuid())) continue;
            BluetoothGattCharacteristic aviso = null;
            BluetoothGattCharacteristic escrita = null;
            for (BluetoothGattCharacteristic c : svc.getCharacteristics()) {
                int props = c.getProperties();
                if (aviso == null && ((props & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0
                        || (props & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0)) {
                    aviso = c;
                }
                if (escrita == null && ((props & BluetoothGattCharacteristic.PROPERTY_WRITE) != 0
                        || (props & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0)) {
                    escrita = c;
                }
            }
            if (aviso != null && escrita != null) return new Par(escrita, aviso);
        }
        return null;
    }

    private String mensagemSemCanal(BluetoothGatt g) {
        ArrayList<String> prefixos = new ArrayList<>();
        for (BluetoothGattService svc : g.getServices()) prefixos.add(Protocolo.prefixo8(svc.getUuid()));
        String vistos = Protocolo.rotuloCanais(prefixos);
        if (vistos.isEmpty()) {
            return "A pulseira conectou, mas o celular não mostrou os canais dela. Toque em conectar e escolha a pulseira outra vez.";
        }
        return "A pulseira conectou, mas nenhum canal entregou batimentos. Canais vistos: " + vistos + ".";
    }

    private boolean ativarAvisos(BluetoothGattCharacteristic ch) {
        if (gatt == null) return false;
        BluetoothGattDescriptor descriptor = ch.getDescriptor(CCCD);
        if (descriptor == null) return false;
        int props = ch.getProperties();
        boolean indicate = (props & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0
                && (props & BluetoothGattCharacteristic.PROPERTY_NOTIFY) == 0;
        byte[] valor = indicate
                ? BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
                : BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE;
        boolean armou;
        try {
            armou = gatt.setCharacteristicNotification(ch, true);
        } catch (SecurityException e) {
            armou = false;
        }
        if (!armou) return false;
        enfileirar(() -> escreverCccd(descriptor, valor));
        return true;
    }

    private void escreverCccd(BluetoothGattDescriptor descriptor, byte[] valor) {
        if (gatt == null) {
            ocupado = false;
            return;
        }
        opSeq++;
        boolean ok;
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                ok = gatt.writeDescriptor(descriptor, valor) == BluetoothGatt.GATT_SUCCESS;
            } else {
                descriptor.setValue(valor);
                ok = gatt.writeDescriptor(descriptor);
            }
        } catch (SecurityException e) {
            ok = false;
        }
        if (!ok) {
            ocupado = false;
            falhouCanal("A pulseira conectou, mas o celular não ativou os avisos do canal.");
        }
    }

    private void escreverRx(byte[] pacote, boolean inicio) {
        if (gatt == null || rx == null) {
            ocupado = false;
            if (desligando) encerrar();
            return;
        }
        escrevendoInicio = inicio;
        opSeq++;
        int tipo = (rx.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;
        int seq = opSeq;
        boolean ok;
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                ok = gatt.writeCharacteristic(rx, pacote, tipo) == BluetoothGatt.GATT_SUCCESS;
            } else {
                rx.setWriteType(tipo);
                rx.setValue(pacote);
                ok = gatt.writeCharacteristic(rx);
            }
        } catch (SecurityException e) {
            ok = false;
        }
        if (!ok) {
            ocupado = false;
            if (desligando) {
                encerrar();
                return;
            }
            if (inicio) {
                mensagem = "Conectada, mas o pedido de batimento (comando 105) não foi aceito.";
                publicar();
            }
            return;
        }
        if (tipo == BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE) {
            BluetoothGatt alvo = gatt;
            handler.post(() -> aoEscrita(alvo, BluetoothGatt.GATT_SUCCESS, seq));
        }
    }

    private void aoDescritor(BluetoothGatt g, int status, int seq) {
        if (seq != opSeq || encerrado) return;
        opSeq++;
        if (g != gatt) {
            ocupado = false;
            return;
        }
        if (status != BluetoothGatt.GATT_SUCCESS) {
            ocupado = false;
            fila.clear();
            falhouCanal("A pulseira conectou, mas o celular não ativou os avisos do canal.");
            return;
        }
        Runnable seguir = depoisDoCccd;
        depoisDoCccd = null;
        livre();
        if (seguir != null) seguir.run();
    }

    private void aoEscrita(BluetoothGatt g, int status, int seq) {
        if (seq != opSeq || encerrado) return;
        opSeq++;
        if (desligando) {
            ocupado = false;
            encerrar();
            return;
        }
        if (g != gatt) {
            ocupado = false;
            return;
        }
        if (status != BluetoothGatt.GATT_SUCCESS && escrevendoInicio) {
            mensagem = "Conectada, mas o pedido de batimento (comando 105) não foi aceito.";
            publicar();
        }
        escrevendoInicio = false;
        livre();
    }

    private void tratar(BluetoothGattCharacteristic c, byte[] value) {
        if (c.getUuid().equals(Protocolo.HEART_RATE_MEASUREMENT)) {
            tratarPadrao(value);
            return;
        }
        if (tx != null && c.getUuid().equals(tx.getUuid())) tratarColmi(value);
    }

    private void anotar(int valor, Boolean pele, int[] rr) {
        if (userStop || encerrado) return;
        bpm = valor;
        contato = pele;
        if (rr != null) {
            for (int v : rr) {
                rrJanela.add(v);
                if (rrJanela.size() > 60) rrJanela.remove(0);
            }
        }
        int[] janela = new int[rrJanela.size()];
        for (int i = 0; i < janela.length; i++) janela[i] = rrJanela.get(i);
        temAmostra = true;
        ultimoBpm = valor;
        ultimoContato = pele;
        ultimoRmssd = rr == null ? null : Protocolo.calcularRmssd(janela);
        ultimoSdnn = rr == null ? null : Protocolo.calcularSdnn(janela);
        mensagem = "Conectada. O serviço continua com a tela fechada.";
        publicar();
        final String nomeSalvo = nome;
        final Double rm = ultimoRmssd;
        final Double sd = ultimoSdnn;
        rede.execute(() -> {
            if (!userStop) conta.gravar(nomeSalvo, valor, pele, rm, sd, false);
        });
    }

    private void tratarPadrao(byte[] value) {
        Protocolo.AmostraPadrao amostra = Protocolo.lerPadrao(value);
        if (amostra == null || !Protocolo.fcPlausivel(amostra.bpm)) return;
        anotar(amostra.bpm, amostra.contato, amostra.rr);
    }

    private void tratarColmi(byte[] pacote) {
        if (parado || !aoVivo) return;
        Integer lido = Protocolo.lerBatimentoColmi(pacote);
        if (lido != null) {
            if (!Protocolo.fcPlausivel(lido)) return;
            semBatimento = 0;
            handler.removeCallbacks(repetirMedicao);
            anotar(lido, null, null);
            return;
        }
        if (!Protocolo.medicaoColmiEncerrou(pacote)) return;
        if (semBatimento >= 2) {
            mensagem = "Sem batimento novo. Parei de pedir para o LED não ficar piscando. O Bluetooth continua conectado.";
            publicar();
            return;
        }
        semBatimento += 1;
        handler.removeCallbacks(repetirMedicao);
        handler.postDelayed(repetirMedicao, REPETIR_MEDICAO_MS);
    }

    private void repetirMedicao() {
        if (userStop || !aoVivo || rx == null || gatt == null) return;
        enfileirar(() -> escreverRx(Protocolo.pacoteIniciarBatimento(), true));
    }

    private void aoCair() {
        if (!reconectar || userStop || encerrado || quedaAgendada) return;
        quedaAgendada = true;
        handler.postDelayed(quedaRunnable, RECONEXAO_MS);
    }

    private void cairAgora() {
        quedaAgendada = false;
        if (!reconectar || userStop || encerrado) return;
        fecharGatt();
        handler.removeCallbacks(repetirMedicao);
        bpm = null;
        canal = null;
        contato = null;
        aoVivo = false;
        falhas += 1;
        if (enderecoAtual != null && falhas <= TENTATIVAS_ENDERECO) {
            fase = "conectando";
            mensagem = "O link caiu. Tentando de novo.";
            publicar();
            conectarEndereco(enderecoAtual);
        } else {
            falhas = 0;
            prefs.edit().remove("endereco").apply();
            enderecoAtual = null;
            procurar();
        }
    }

    private void falhouCanal(String texto) {
        reconectar = false;
        prefs.edit().remove("endereco").apply();
        enderecoAtual = null;
        fecharGatt();
        fase = "erro";
        mensagem = texto;
        bpm = null;
        canal = null;
        publicar();
    }

    private void falhar(String texto) {
        reconectar = false;
        pararScan();
        fecharGatt();
        fase = "erro";
        mensagem = texto;
        bpm = null;
        canal = null;
        contato = null;
        publicar();
    }

    private void encerrar() {
        if (encerrado) return;
        encerrado = true;
        frente = false;
        userStop = true;
        reconectar = false;
        handler.removeCallbacks(encerrarTimeout);
        handler.removeCallbacks(repetirMedicao);
        handler.removeCallbacks(quedaRunnable);
        handler.removeCallbacks(avisoBusca);
        pararScan();
        fecharGatt();
        fase = "parada";
        nome = null;
        temAmostra = false;
        rrJanela.clear();
        bpm = null;
        canal = null;
        contato = null;
        mensagem = getString(R.string.ociosa);
        publicar();
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void enfileirar(Runnable runnable) {
        fila.add(runnable);
        bombear();
    }

    private void bombear() {
        if (ocupado) return;
        Runnable runnable = fila.poll();
        if (runnable == null) return;
        ocupado = true;
        runnable.run();
    }

    private void livre() {
        ocupado = false;
        bombear();
    }

    private void limparFila() {
        fila.clear();
        ocupado = false;
        opSeq++;
    }

    private void fecharGatt() {
        limparFila();
        BluetoothGatt aberto = gatt;
        gatt = null;
        rx = null;
        tx = null;
        depoisDoCccd = null;
        if (aberto == null) return;
        try {
            aberto.disconnect();
        } catch (Exception ignored) {
            /* já caiu */
        }
        try {
            aberto.close();
        } catch (Exception ignored) {
            /* já fechado */
        }
    }

    private void pararScan() {
        handler.removeCallbacks(avisoBusca);
        escaneando = false;
        BluetoothLeScanner aberto = scanner;
        scanner = null;
        if (aberto == null) return;
        try {
            aberto.stopScan(scanCallback);
        } catch (Exception ignored) {
            /* busca já parada */
        }
    }

    public Estado estado() {
        return snapshot();
    }

    private Estado snapshot() {
        return new Estado(fase, nome, bpm, canal, contato, mensagem);
    }

    private void publicar() {
        Estado estado = snapshot();
        if (Looper.myLooper() == Looper.getMainLooper()) entregar(estado);
        else handler.post(() -> entregar(estado));
    }

    private void entregar(Estado estado) {
        for (Ouvinte ouvinte : ouvintes) ouvinte.onEstado(estado);
        if (!encerrado && frente) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTIF_ID, notificacao());
        }
    }

    private void entrarFrente() {
        Notification n = notificacao();
        if (frente) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTIF_ID, n);
            return;
        }
        frente = true;
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    private Notification notificacao() {
        Intent abrir = new Intent(this, MainActivity.class);
        PendingIntent conteudo = PendingIntent.getActivity(
                this, 1, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Intent parar = new Intent(this, PulseiraService.class).setAction(ACAO_DESLIGAR);
        PendingIntent acao = PendingIntent.getService(
                this, 2, parar, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        String texto = bpm != null && "conectada".equals(fase) ? bpm + " bpm" : mensagem;
        if (texto == null || texto.isEmpty()) texto = "Pulseira";
        return new Notification.Builder(this, CANAL)
                .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
                .setContentTitle("Pulseira")
                .setContentText(texto)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(conteudo)
                .addAction(new Notification.Action.Builder(
                        Icon.createWithResource(this, android.R.drawable.ic_menu_close_clear_cancel),
                        "Desligar",
                        acao).build())
                .build();
    }

    private void garantirCanal() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel canalNotif = new NotificationChannel(
                CANAL, getString(R.string.canal_notif), NotificationManager.IMPORTANCE_LOW);
        canalNotif.setShowBadge(false);
        nm.createNotificationChannel(canalNotif);
    }

    private BluetoothAdapter adaptador() {
        BluetoothManager manager = getSystemService(BluetoothManager.class);
        if (manager == null) return null;
        try {
            return manager.getAdapter();
        } catch (SecurityException e) {
            return null;
        }
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

    private static final class Par {
        final BluetoothGattCharacteristic rx;
        final BluetoothGattCharacteristic tx;

        Par(BluetoothGattCharacteristic rx, BluetoothGattCharacteristic tx) {
            this.rx = rx;
            this.tx = tx;
        }
    }
}
