package saude.encorpei.pulseira;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * O que {@code src/lib/wearable/h59Protocol.ts} e {@code bleClient.ts} já fazem.
 * Pacote de 16 bytes, comandos 105 e 106, UUIDs e prefixos de nome copiados de lá.
 */
public final class Protocolo {
    private Protocolo() {}

    /** GATT.heartRateService. Prefixo 0000180d em bleClient.ts. */
    public static final UUID HEART_RATE_SERVICE =
            UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");

    /** Característica 0x2A37, citada em decodeHeartRateMeasurement. */
    public static final UUID HEART_RATE_MEASUREMENT =
            UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");

    public static final UUID COLMI_SERVICE =
            UUID.fromString("6e40fff0-b5a3-f393-e0a9-e50e24dcca9e");
    public static final UUID COLMI_SERVICE_ALT =
            UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
    public static final UUID COLMI_SERVICE_VAR =
            UUID.fromString("6e400001-b5a3-f393-e0a9-e50e24dcca9f");

    /** bleClient abre o canal por estes prefixos, não pelo UUID completo. */
    public static final String RX_PREFIXO = "6e400002";
    public static final String TX_PREFIXO = "6e400003";

    public static final int CMD_REALTIME = 105;
    public static final int CMD_REALTIME_PARAR = 106;
    public static final int TIPO_BATIMENTO = 1;

    public static final String[] PREFIXOS = {
            "H59", "H-59", "H59 Max", "QWatch", "QCWireless", "Smart Band", "WearFit", "R3L", "TEK",
    };

    /** Nomes em NOMES_CONHECIDOS, bleClient.ts. */
    public static final String NOME_CANAL_PADRAO = "Frequência cardíaca (padrão Bluetooth)";
    public static final String NOME_CANAL_COLMI = "Canal da pulseira (batimentos)";

    public static final class AmostraPadrao {
        public final int bpm;
        public final Boolean contato;
        /** Intervalos RR em milissegundos. Vazio quando o pacote não traz RR. */
        public final int[] rr;

        public AmostraPadrao(int bpm, Boolean contato, int[] rr) {
            this.bpm = bpm;
            this.contato = contato;
            this.rr = rr == null ? new int[0] : rr;
        }
    }

    public static boolean nomeCompativel(String nome) {
        if (nome == null) return false;
        for (String prefixo : PREFIXOS) {
            if (nome.startsWith(prefixo)) return true;
        }
        return false;
    }

    public static String prefixo8(UUID uuid) {
        return uuid.toString().toLowerCase(Locale.ROOT).replace("-", "").substring(0, 8);
    }

    public static boolean canalColmi(UUID uuid) {
        String id = prefixo8(uuid);
        return "6e40fff0".equals(id) || "6e400001".equals(id);
    }

    /** Ordem de listarServicos: 6e40fff0, depois 6e400001, depois o resto. */
    public static int ordemServico(UUID uuid) {
        String id = prefixo8(uuid);
        if ("6e40fff0".equals(id)) return 0;
        if ("6e400001".equals(id)) return 1;
        return 2;
    }

    public static boolean prefixoCaracteristica(UUID uuid, String prefixo) {
        return uuid.toString().toLowerCase(Locale.ROOT).startsWith(prefixo.toLowerCase(Locale.ROOT));
    }

    public static String rotuloCanais(List<String> prefixos) {
        LinkedHashSet<String> vistos = new LinkedHashSet<>();
        for (String p : prefixos) {
            String x = p.toLowerCase(Locale.ROOT);
            vistos.add(x.startsWith("0000") ? x.substring(4) : x);
        }
        return String.join(", ", vistos);
    }

    /** 16 bytes: comando, argumentos, checksum dos 15 primeiros no fim. */
    public static byte[] pacoteColmi(int cmd, int... args) {
        byte[] p = new byte[16];
        p[0] = (byte) (cmd & 0xff);
        for (int i = 0; i < args.length && i < 14; i++) {
            p[i + 1] = (byte) (args[i] & 0xff);
        }
        int soma = 0;
        for (int i = 0; i < 15; i++) soma = (soma + (p[i] & 0xff)) & 0xff;
        p[15] = (byte) soma;
        return p;
    }

    public static byte[] pacoteIniciarBatimento() {
        return pacoteColmi(CMD_REALTIME, TIPO_BATIMENTO, 1);
    }

    public static byte[] pacotePararBatimento() {
        return pacoteColmi(CMD_REALTIME_PARAR, TIPO_BATIMENTO, 0, 0);
    }

    public static Integer lerBatimentoColmi(byte[] data) {
        if (data == null || data.length < 4) return null;
        if ((data[0] & 0xff) != CMD_REALTIME) return null;
        if ((data[1] & 0xff) != TIPO_BATIMENTO) return null;
        if ((data[2] & 0xff) != 0) return null;
        int bpm = data[3] & 0xff;
        return bpm > 0 ? bpm : null;
    }

    public static boolean medicaoColmiEncerrou(byte[] data) {
        return data != null
                && data.length >= 3
                && (data[0] & 0xff) == CMD_REALTIME
                && (data[1] & 0xff) == TIPO_BATIMENTO
                && (data[2] & 0xff) != 0;
    }

    public static boolean fcPlausivel(int bpm) {
        return bpm >= 25 && bpm <= 240;
    }

    /** Mesma conta de calcularRmssd em h59Protocol.ts. Menos de 3 intervalos → nulo. */
    public static Double calcularRmssd(int[] rr) {
        if (rr == null || rr.length < 3) return null;
        double soma = 0;
        for (int i = 1; i < rr.length; i++) {
            double d = rr[i] - rr[i - 1];
            soma += d * d;
        }
        return Math.round(Math.sqrt(soma / (rr.length - 1)) * 10.0) / 10.0;
    }

    /** Mesma conta de calcularSdnn em h59Protocol.ts. */
    public static Double calcularSdnn(int[] rr) {
        if (rr == null || rr.length < 3) return null;
        double media = 0;
        for (int v : rr) media += v;
        media /= rr.length;
        double varia = 0;
        for (int v : rr) {
            double d = v - media;
            varia += d * d;
        }
        return Math.round(Math.sqrt(varia / (rr.length - 1)) * 10.0) / 10.0;
    }

    /**
     * BPM e contato do Heart Rate Measurement (0x2A37).
     * O BPM vem logo após as flags; energia e RR não mudam esse lugar.
     */
    public static AmostraPadrao lerPadrao(byte[] value) {
        if (value == null || value.length < 2) return null;
        int flags = value[0] & 0xff;
        boolean is16 = (flags & 0x01) != 0;
        if (is16 && value.length < 3) return null;
        int bpm = is16 ? (value[1] & 0xff) | ((value[2] & 0xff) << 8) : (value[1] & 0xff);
        int contactBits = (flags >> 1) & 0x03;
        Boolean contato = contactBits < 2 ? null : contactBits == 3;
        int offset = is16 ? 3 : 2;
        if ((flags & 0x08) != 0) offset += 2;
        int[] rr = new int[0];
        if ((flags & 0x10) != 0 && offset + 1 < value.length) {
            int n = (value.length - offset) / 2;
            rr = new int[n];
            for (int i = 0; i < n; i++) {
                int raw = (value[offset] & 0xff) | ((value[offset + 1] & 0xff) << 8);
                rr[i] = Math.round((raw / 1024f) * 1000f);
                offset += 2;
            }
        }
        return new AmostraPadrao(bpm, contato, rr);
    }
}
