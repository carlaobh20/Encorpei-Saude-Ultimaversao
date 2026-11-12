package saude.encorpei.pulseira;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/** Confere pacote, leitura e prefixos contra h59Protocol.ts / bleClient.ts. */
public final class ProtocoloTest {
    public static void main(String[] args) {
        igual(hex(Protocolo.pacoteIniciarBatimento()),
                "69 01 01 00 00 00 00 00 00 00 00 00 00 00 00 6b", "iniciar");
        igual(hex(Protocolo.pacotePararBatimento()),
                "6a 01 00 00 00 00 00 00 00 00 00 00 00 00 00 6b", "parar");
        if (Protocolo.pacoteIniciarBatimento().length != 16) falha("tamanho");
        if (Protocolo.pacoteIniciarBatimento()[0] != Protocolo.CMD_REALTIME) falha("cmd 105");
        if (Protocolo.pacotePararBatimento()[0] != Protocolo.CMD_REALTIME_PARAR) falha("cmd 106");

        byte[] extra = Protocolo.pacoteColmi(105, 1, 1, 5);
        igual(hex(extra), "69 01 01 05 00 00 00 00 00 00 00 00 00 00 00 70", "checksum");
        int[] muitos = new int[15];
        Arrays.fill(muitos, 1);
        byte[] cortado = Protocolo.pacoteColmi(105, muitos);
        if ((cortado[14] & 0xff) != 1) falha("15º argumento entrou");
        if ((cortado[15] & 0xff) != ((105 + 14) & 0xff)) falha("checksum com corte");

        if (Protocolo.lerBatimentoColmi(new byte[] {105, 1, 0, 72}) == null
                || Protocolo.lerBatimentoColmi(new byte[] {105, 1, 0, 72}) != 72) falha("colmi 72");
        if (Protocolo.lerBatimentoColmi(new byte[] {105, 1, 0, 0}) != null) falha("colmi zero");
        if (Protocolo.lerBatimentoColmi(new byte[] {105, 1, 1, 72}) != null) falha("colmi fim");
        if (Protocolo.lerBatimentoColmi(new byte[] {105, 2, 0, 72}) != null) falha("colmi tipo");
        if (Protocolo.lerBatimentoColmi(new byte[] {21, 1, 0, 72}) != null) falha("colmi 21");
        if (Protocolo.lerBatimentoColmi(new byte[] {105, 1}) != null) falha("colmi curto");
        if (!Protocolo.medicaoColmiEncerrou(new byte[] {105, 1, 1})) falha("encerrou");
        if (Protocolo.medicaoColmiEncerrou(new byte[] {105, 1, 0})) falha("nao encerrou");
        if (Protocolo.medicaoColmiEncerrou(new byte[] {105, 1})) falha("encerrou curto");

        if (Protocolo.fcPlausivel(24) || !Protocolo.fcPlausivel(25)) falha("fc 25");
        if (!Protocolo.fcPlausivel(240) || Protocolo.fcPlausivel(241)) falha("fc 240");

        Protocolo.AmostraPadrao u8 = Protocolo.lerPadrao(new byte[] {0x00, 60});
        if (u8 == null || u8.bpm != 60 || u8.contato != null) falha("hr u8");
        Protocolo.AmostraPadrao u16 = Protocolo.lerPadrao(new byte[] {0x01, (byte) 0xF0, 0x00});
        if (u16 == null || u16.bpm != 240) falha("hr u16");
        if (Protocolo.lerPadrao(new byte[] {0x01, 0x10}) != null) falha("hr u16 curto");
        Protocolo.AmostraPadrao energia = Protocolo.lerPadrao(new byte[] {0x08, 55, 0x00, 0x00});
        if (energia == null || energia.bpm != 55) falha("hr energia");
        Protocolo.AmostraPadrao rr = Protocolo.lerPadrao(new byte[] {0x10, 60, 0x00, 0x04});
        if (rr == null || rr.bpm != 60 || rr.rr.length != 1 || rr.rr[0] != 1000) falha("hr rr");
        int[] janela = {1000, 1100, 900};
        Double rmssd = Protocolo.calcularRmssd(janela);
        Double sdnn = Protocolo.calcularSdnn(janela);
        if (rmssd == null || Math.abs(rmssd - 158.1) > 0.05) falha("rmssd");
        if (sdnn == null || Math.abs(sdnn - 100.0) > 0.05) falha("sdnn");
        if (Protocolo.calcularRmssd(new int[] {800, 900}) != null) falha("rmssd curto");
        Protocolo.AmostraPadrao pele = Protocolo.lerPadrao(new byte[] {0x06, 70});
        if (pele == null || !Boolean.TRUE.equals(pele.contato)) falha("contato sim");
        Protocolo.AmostraPadrao sem = Protocolo.lerPadrao(new byte[] {0x04, 70});
        if (sem == null || !Boolean.FALSE.equals(sem.contato)) falha("contato nao");

        String[] prefixos = {"H59", "H-59", "H59 Max", "QWatch", "QCWireless", "Smart Band", "WearFit", "R3L", "TEK"};
        if (!Arrays.equals(Protocolo.PREFIXOS, prefixos)) falha("prefixos");
        if (!Protocolo.nomeCompativel("H59MAX") || !Protocolo.nomeCompativel("QWatch Pro")) falha("nome sim");
        if (Protocolo.nomeCompativel("QH59") || Protocolo.nomeCompativel("Mi Band") || Protocolo.nomeCompativel(null)) {
            falha("nome nao");
        }

        if (!Protocolo.HEART_RATE_SERVICE.toString().equals("0000180d-0000-1000-8000-00805f9b34fb")) falha("180d");
        if (!Protocolo.HEART_RATE_MEASUREMENT.toString().equals("00002a37-0000-1000-8000-00805f9b34fb")) falha("2a37");
        if (!Protocolo.canalColmi(Protocolo.COLMI_SERVICE)
                || !Protocolo.canalColmi(Protocolo.COLMI_SERVICE_ALT)
                || !Protocolo.canalColmi(Protocolo.COLMI_SERVICE_VAR)) falha("canal colmi");
        if (Protocolo.canalColmi(Protocolo.HEART_RATE_SERVICE)) falha("180d nao e colmi");
        if (Protocolo.ordemServico(Protocolo.COLMI_SERVICE) != 0
                || Protocolo.ordemServico(Protocolo.COLMI_SERVICE_VAR) != 1
                || Protocolo.ordemServico(Protocolo.HEART_RATE_SERVICE) != 2) falha("ordem");
        UUID rx = UUID.fromString("6e400002-b5a3-f393-e0a9-e50e24dcca9e");
        UUID tx = UUID.fromString("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
        if (!Protocolo.prefixoCaracteristica(rx, Protocolo.RX_PREFIXO)
                || !Protocolo.prefixoCaracteristica(tx, Protocolo.TX_PREFIXO)) falha("prefixo uart");
        igual(Protocolo.rotuloCanais(List.of("0000180d", "6e40fff0")), "180d, 6e40fff0", "rotulo");

        if (!Gravacao.deveGravar(120_000, 60_000, false)) falha("throttle passou");
        if (Gravacao.deveGravar(119_999, 60_000, false)) falha("throttle cedo");
        if (!Gravacao.deveGravar(1, 0, true)) falha("throttle forcar");
        String linha = Gravacao.jsonLinha("uid", null, "H\"59", 72, false, "2026-11-12T19:00:00Z", null, 12.5);
        if (!linha.contains("\"validation_status\":\"suspect\"")) falha("suspect");
        if (!linha.contains("\"context\":\"resting\"")) falha("context");
        if (!linha.contains("\"source_type\":\"device\"")) falha("source");
        if (!linha.contains("\"entered_by\":\"device\"")) falha("entered");
        if (!linha.contains("\"bpm\":72")) falha("bpm");
        if (!linha.contains("\"source_device_id\":null")) falha("device nulo");
        if (!linha.contains("\"rmssd\":null") || !linha.contains("\"sdnn\":12.5")) falha("hrv");
        if (linha.contains("vital_type") || linha.contains("entered_by_user_id")) falha("coluna a mais");
        if (!linha.contains("H\\\"59")) falha("aspas");
        String comPele = Gravacao.jsonLinha("uid", "dev", "Pulseira", 60, true, "t", null, null);
        if (!comPele.contains("\"validation_status\":\"estimated\"") || !comPele.contains("\"source_device_id\":\"dev\"")) {
            falha("estimated");
        }
        String aparelho = Gravacao.jsonDispositivo("uid", "Pulseira");
        if (!aparelho.contains("\"model\":null") || !aparelho.contains("\"category\":\"h59\"")
                || !aparelho.contains("\"protocol\":\"ble\"") || !aparelho.contains("\"vital_types\":[\"heart_rate\"]")) {
            falha("dispositivo");
        }

        System.out.println("PASS protocolo");
    }

    private static String hex(byte[] p) {
        StringBuilder s = new StringBuilder();
        for (int i = 0; i < p.length; i++) {
            if (i > 0) s.append(' ');
            s.append(String.format("%02x", p[i] & 0xff));
        }
        return s.toString();
    }

    private static void igual(String achou, String esperava, String nome) {
        if (!achou.equals(esperava)) falha(nome + " achou " + achou);
    }

    private static void falha(String nome) {
        throw new AssertionError(nome);
    }
}
