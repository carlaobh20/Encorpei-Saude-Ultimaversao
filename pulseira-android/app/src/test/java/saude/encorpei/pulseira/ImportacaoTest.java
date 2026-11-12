package saude.encorpei.pulseira;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;

/** Datas e colunas do importer.ts: dia/mês, aspas, sono profundo não vira sono total. */
public final class ImportacaoTest {
    public static void main(String[] args) {
        String iso = Importacao.parseData("03/09/2026 08:00");
        if (iso == null) falha("data nula");
        LocalDateTime local = LocalDateTime.ofInstant(Instant.parse(iso), ZoneId.systemDefault());
        if (local.getMonthValue() != 9 || local.getDayOfMonth() != 3 || local.getHour() != 8) falha("03/09 virou " + local);
        if (Importacao.parseData("31/02/2026") != null) falha("31/02");
        if (Importacao.parseData("01/01/1970") != null) falha("1970");

        String csv = "data,sono profundo,oxigenacao,passos,pressao maxima,pressao minima\n"
                + "\"03/09/2026, 08:00\",120,98,\"5.432\",120,80\n";
        Importacao.Resultado r = Importacao.ler(csv, null);
        if (r.precisaConfirmacao) falha("confirmacao indevida");
        if (r.linhas.size() != 1) falha("linhas " + r.linhas.size());
        Importacao.Linha l = r.linhas.get(0);
        if (l.sleepMinutes != null) falha("profundo virou total");
        if (l.deepMinutes == null || l.deepMinutes != 120) falha("deep");
        if (l.spo2 == null || l.spo2 != 98) falha("spo2");
        if (l.steps == null || l.steps != 5432) falha("passos " + l.steps);
        if (l.systolic == null || l.systolic != 120 || l.diastolic == null || l.diastolic != 80) falha("pa");
        if (r.oxigenacao != 1 || r.pressao != 1 || r.atividade != 1) falha("contagem");

        Importacao.Resultado vazio = Importacao.ler("coluna x,coluna y\n1,2\n", null);
        if (!vazio.precisaConfirmacao) falha("devia pedir confirmacao");
        Map<String, Integer> mapa = new HashMap<>();
        mapa.put("recordedAt", 0);
        mapa.put("heartRate", 1);
        Importacao.Resultado manual = Importacao.ler("quando,fc\n03/09/2026 09:00,70\n", mapa);
        if (manual.precisaConfirmacao || manual.batimentos != 1 || manual.linhas.get(0).heartRate != 70) {
            falha("mapa manual");
        }
        System.out.println("PASS importacao");
    }

    private static void falha(String m) {
        throw new AssertionError(m);
    }
}
