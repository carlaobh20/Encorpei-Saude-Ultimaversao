package saude.encorpei.pulseira;

import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * A mesma leitura de CSV de {@code src/lib/wearable/importer.ts}.
 * Não pede nada por Bluetooth.
 */
public final class Importacao {
    public static final String NOTA_PA =
            "Estimativa por sensor óptico de pulso — sem manguito, sem validação clínica. Não usar para decisão terapêutica nem para média de MRPA.";
    public static final String NOME_ARQUIVO = "Pulseira (arquivo importado)";

    private static final String[] CAMPOS = {
            "recordedAt", "deepMinutes", "lightMinutes", "remMinutes", "awakeMinutes", "sleepMinutes",
            "awakenings", "efficiencyPct", "minHeartRate", "minSpo2",
            "systolic", "diastolic", "spo2", "heartRate", "steps", "calories",
    };
    private static final String[] DURACAO = {
            "sleepMinutes", "deepMinutes", "lightMinutes", "remMinutes", "awakeMinutes",
    };
    private static final long LIMITE_ANTIGO = Instant.parse("2000-01-01T00:00:00Z").toEpochMilli();
    private static final long FUTURO_MS = 10 * 60_000L;

    private Importacao() {}

    public static final class Linha {
        public String recordedAt;
        public Integer heartRate;
        public Integer spo2;
        public Integer systolic;
        public Integer diastolic;
        public Integer steps;
        public Integer sleepMinutes;
        public Integer deepMinutes;
        public Integer lightMinutes;
        public Integer remMinutes;
        public Integer awakeMinutes;
        public Integer awakenings;
        public Integer efficiencyPct;
        public Integer minHeartRate;
        public Integer minSpo2;
        public Integer calories;
    }

    public static final class Resultado {
        public final List<Linha> linhas = new ArrayList<>();
        public int ignoradas;
        public final List<String> cabecalho = new ArrayList<>();
        public final Map<String, Integer> mapeamento = new LinkedHashMap<>();
        public final List<String> avisos = new ArrayList<>();
        public boolean precisaConfirmacao;
        public int batimentos;
        public int oxigenacao;
        public int pressao;
        public int atividade;
        public int sono;
    }

    public static Resultado ler(String texto, Map<String, Integer> override) {
        Resultado r = new Resultado();
        if (texto == null || texto.trim().isEmpty()) {
            r.avisos.add("O arquivo está vazio.");
            return r;
        }
        String sep = separador(texto);
        List<List<String>> grade = tokenizar(texto, sep);
        if (grade.size() < 2) {
            r.avisos.add("O arquivo não tem linhas de dados — só o cabeçalho, ou nada.");
            return r;
        }
        List<String> bruto = new ArrayList<>();
        List<String> norm = new ArrayList<>();
        for (String c : grade.get(0)) {
            String t = c.trim();
            bruto.add(t);
            norm.add(normalizar(t));
        }
        r.cabecalho.addAll(bruto);
        boolean[] usadas = new boolean[bruto.size()];
        for (String campo : CAMPOS) {
            Integer forcado = override == null ? null : override.get(campo);
            if (forcado != null && forcado >= 0 && forcado < bruto.size()) {
                r.mapeamento.put(campo, forcado);
                usadas[forcado] = true;
            }
        }
        for (String campo : CAMPOS) {
            if (r.mapeamento.containsKey(campo)) continue;
            String[] alvos = sinonimos(campo);
            for (int i = 0; i < norm.size(); i++) {
                if (usadas[i] || norm.get(i).isEmpty()) continue;
                if (contem(alvos, norm.get(i))) {
                    r.mapeamento.put(campo, i);
                    usadas[i] = true;
                    break;
                }
            }
        }
        boolean semData = !r.mapeamento.containsKey("recordedAt");
        boolean semValor = true;
        for (String campo : CAMPOS) {
            if (!"recordedAt".equals(campo) && r.mapeamento.containsKey(campo)) semValor = false;
        }
        r.precisaConfirmacao = semData || semValor;
        if (semData) r.avisos.add("Não encontrei a coluna de data e hora. Confirme qual coluna é a data antes de continuar.");
        if (semValor) r.avisos.add("Não reconheci nenhuma coluna de medida neste arquivo. Confirme abaixo qual coluna é o quê.");
        if (r.mapeamento.containsKey("systolic") || r.mapeamento.containsKey("diastolic")) {
            r.avisos.add("A pressão medida pela pulseira é uma estimativa do sensor de luz, sem manguito. Ela entra marcada como estimativa: não entra na sua média de pressão e não dispara aviso.");
        }
        if (r.precisaConfirmacao) return r;

        int idxData = r.mapeamento.get("recordedAt");
        for (int i = 1; i < grade.size(); i++) {
            List<String> cols = grade.get(i);
            String at = parseData(celula(cols, idxData));
            if (at == null) {
                r.ignoradas++;
                continue;
            }
            Linha l = new Linha();
            l.recordedAt = at;
            l.heartRate = valor(cols, r.mapeamento, "heartRate");
            l.spo2 = valor(cols, r.mapeamento, "spo2");
            Integer sis = valor(cols, r.mapeamento, "systolic");
            Integer dia = valor(cols, r.mapeamento, "diastolic");
            if (sis != null && dia != null) {
                l.systolic = sis;
                l.diastolic = dia;
            }
            l.steps = valor(cols, r.mapeamento, "steps");
            l.sleepMinutes = valor(cols, r.mapeamento, "sleepMinutes");
            l.deepMinutes = valor(cols, r.mapeamento, "deepMinutes");
            l.lightMinutes = valor(cols, r.mapeamento, "lightMinutes");
            l.remMinutes = valor(cols, r.mapeamento, "remMinutes");
            l.awakeMinutes = valor(cols, r.mapeamento, "awakeMinutes");
            l.awakenings = valor(cols, r.mapeamento, "awakenings");
            l.efficiencyPct = valor(cols, r.mapeamento, "efficiencyPct");
            l.minHeartRate = valor(cols, r.mapeamento, "minHeartRate");
            l.minSpo2 = valor(cols, r.mapeamento, "minSpo2");
            l.calories = valor(cols, r.mapeamento, "calories");
            if (l.sleepMinutes == null && l.deepMinutes != null && l.lightMinutes != null
                    && l.remMinutes != null && l.awakeMinutes != null) {
                int soma = l.deepMinutes + l.lightMinutes + l.remMinutes + l.awakeMinutes;
                if (soma >= 1 && soma <= 1440) l.sleepMinutes = soma;
            }
            boolean tem = l.heartRate != null || l.spo2 != null || l.systolic != null
                    || l.steps != null || l.sleepMinutes != null || l.calories != null;
            if (tem) r.linhas.add(l);
            else r.ignoradas++;
        }
        for (Linha l : r.linhas) {
            if (l.heartRate != null) r.batimentos++;
            if (l.spo2 != null) r.oxigenacao++;
            if (l.systolic != null && l.diastolic != null) r.pressao++;
            if (l.steps != null || l.calories != null) r.atividade++;
            if (l.sleepMinutes != null) r.sono++;
        }
        if (r.linhas.isEmpty() && r.ignoradas > 0) {
            r.avisos.add("Nenhuma linha pôde ser lida. Confira se a coluna de data está no formato dia/mês/ano.");
        }
        return r;
    }

    /** dd/mm/aaaa é setembro, não março. Sem fallback genérico de Date. */
    public static String parseData(String v) {
        if (v == null) return null;
        String bruto = v.trim();
        if (bruto.isEmpty()) return null;
        int h = 0;
        int min = 0;
        int seg = 0;
        java.util.regex.Matcher hora = java.util.regex.Pattern.compile("(\\d{1,2}):(\\d{2})(?::(\\d{2}))?").matcher(bruto);
        if (hora.find()) {
            h = Integer.parseInt(hora.group(1));
            min = Integer.parseInt(hora.group(2));
            if (hora.group(3) != null) seg = Integer.parseInt(hora.group(3));
        }
        boolean pm = bruto.toLowerCase(Locale.ROOT).matches(".*\\bpm\\b.*") && h < 12;
        boolean am = bruto.toLowerCase(Locale.ROOT).matches(".*\\bam\\b.*") && h == 12;
        int hFinal = pm ? h + 12 : am ? 0 : h;
        if (hFinal > 23 || min > 59 || seg > 59) return null;

        java.util.regex.Matcher br = java.util.regex.Pattern.compile("^(\\d{1,2})[/-](\\d{1,2})[/-](\\d{2,4})\\b").matcher(bruto);
        if (br.find()) {
            int dia = Integer.parseInt(br.group(1));
            int mes = Integer.parseInt(br.group(2));
            int ano = br.group(3).length() == 2 ? 2000 + Integer.parseInt(br.group(3)) : Integer.parseInt(br.group(3));
            if (dia > 12 && mes <= 12) return montar(ano, mes, dia, hFinal, min, seg);
            if (dia <= 12 && mes > 12) return montar(ano, dia, mes, hFinal, min, seg);
            return montar(ano, mes, dia, hFinal, min, seg);
        }
        if (bruto.matches("\\d{4}-\\d{2}-\\d{2}T.*") || bruto.matches(".*(?:Z|[+-]\\d{2}:?\\d{2})$")) {
            try {
                Instant d = bruto.contains("T") && (bruto.endsWith("Z") || bruto.matches(".*[+-]\\d{2}:?\\d{2}$"))
                        ? Instant.parse(normalizarIso(bruto))
                        : ZonedDateTime.parse(bruto).toInstant();
                long t = d.toEpochMilli();
                if (t < LIMITE_ANTIGO || t > System.currentTimeMillis() + FUTURO_MS) return null;
                return d.toString();
            } catch (Exception e) {
                return null;
            }
        }
        java.util.regex.Matcher iso = java.util.regex.Pattern.compile("^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})\\b").matcher(bruto);
        if (iso.find()) {
            return montar(Integer.parseInt(iso.group(1)), Integer.parseInt(iso.group(2)), Integer.parseInt(iso.group(3)), hFinal, min, seg);
        }
        if (bruto.matches("\\d{10}|\\d{13}")) {
            long ms = bruto.length() == 10 ? Long.parseLong(bruto) * 1000L : Long.parseLong(bruto);
            if (ms < LIMITE_ANTIGO || ms > System.currentTimeMillis() + FUTURO_MS) return null;
            return Instant.ofEpochMilli(ms).toString();
        }
        return null;
    }

    private static String normalizarIso(String bruto) {
        if (bruto.matches(".*[+-]\\d{4}$")) {
            return bruto.substring(0, bruto.length() - 2) + ":" + bruto.substring(bruto.length() - 2);
        }
        return bruto;
    }

    private static String montar(int ano, int mes, int dia, int h, int min, int seg) {
        try {
            LocalDateTime esperado = LocalDateTime.of(ano, mes, dia, h, min, seg);
            ZonedDateTime z = esperado.atZone(ZoneId.systemDefault());
            long t = z.toInstant().toEpochMilli();
            if (t < LIMITE_ANTIGO || t > System.currentTimeMillis() + FUTURO_MS) return null;
            return z.toInstant().toString();
        } catch (Exception e) {
            return null;
        }
    }

    private static Integer valor(List<String> cols, Map<String, Integer> mapa, String campo) {
        Integer i = mapa.get(campo);
        if (i == null) return null;
        String cru = celula(cols, i).trim();
        if (cru.isEmpty()) return null;
        Double n = duracao(campo) ? parseDuracao(cru) : parseNumero(cru);
        if (n == null) return null;
        int[] faixa = faixa(campo);
        if (faixa != null && (n < faixa[0] || n > faixa[1])) return null;
        return (int) Math.round(n);
    }

    static Double parseNumero(String v) {
        if (v == null) return null;
        String limpo = v.trim().replaceAll("[^\\d.,-]", "");
        if (limpo.isEmpty() || !limpo.matches(".*\\d.*")) return null;
        if (limpo.matches("-?\\d{1,3}(\\.\\d{3})+")) return Double.valueOf(limpo.replace(".", ""));
        if (limpo.matches("-?\\d{1,3}(,\\d{3})+")) return Double.valueOf(limpo.replace(",", ""));
        int virgula = limpo.lastIndexOf(',');
        int ponto = limpo.lastIndexOf('.');
        String n = limpo;
        if (virgula >= 0 && ponto >= 0) {
            char decimal = virgula > ponto ? ',' : '.';
            char milhar = decimal == ',' ? '.' : ',';
            n = limpo.replace(String.valueOf(milhar), "").replace(decimal, '.');
        } else if (virgula >= 0) {
            n = limpo.replace(',', '.');
        }
        try {
            double d = Double.parseDouble(n);
            return Double.isFinite(d) ? d : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Double parseDuracao(String v) {
        String bruto = v.trim().toLowerCase(Locale.ROOT);
        java.util.regex.Matcher hm = java.util.regex.Pattern
                .compile("^(\\d{1,2})\\s*(?:h|:)\\s*(\\d{1,2})?\\s*(?:minutos|min|m)?$").matcher(bruto);
        if (hm.matches()) {
            int h = Integer.parseInt(hm.group(1));
            int m = hm.group(2) == null ? 0 : Integer.parseInt(hm.group(2));
            if (m > 59) return null;
            return (double) (h * 60 + m);
        }
        Double n = parseNumero(bruto);
        if (n == null) return null;
        if (bruto.matches(".*\\bh\\b.*|.*hora.*|.*hour.*")) return (double) Math.round(n * 60);
        return n <= 24 ? (double) Math.round(n * 60) : (double) Math.round(n);
    }

    private static String celula(List<String> cols, int i) {
        return i >= 0 && i < cols.size() ? cols.get(i) : "";
    }

    private static boolean duracao(String campo) {
        for (String d : DURACAO) if (d.equals(campo)) return true;
        return false;
    }

    private static boolean contem(String[] alvos, String col) {
        for (String a : alvos) if (a.equals(col)) return true;
        return false;
    }

    static String normalizar(String s) {
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        n = n.toLowerCase(Locale.ROOT);
        n = n.replaceAll("\\([^)]*\\)", " ").replaceAll("\\[[^\\]]*\\]", " ");
        n = n.replaceAll("[_./\\\\-]+", " ");
        n = n.replaceAll("\\s+", " ").trim();
        return n;
    }

    private static String separador(String texto) {
        String primeira = "";
        for (String l : texto.split("\\r?\\n", -1)) {
            if (!l.trim().isEmpty()) {
                primeira = l;
                break;
            }
        }
        String melhor = ",";
        int melhorN = -1;
        for (String c : new String[] {",", ";", "\t"}) {
            int n = 0;
            boolean dentro = false;
            for (int i = 0; i < primeira.length(); i++) {
                char ch = primeira.charAt(i);
                if (ch == '"') dentro = !dentro;
                else if (!dentro && c.charAt(0) == ch) n++;
            }
            if (n > melhorN) {
                melhorN = n;
                melhor = c;
            }
        }
        return melhor;
    }

    private static List<List<String>> tokenizar(String texto, String sep) {
        String t = texto.charAt(0) == '\uFEFF' ? texto.substring(1) : texto;
        List<List<String>> linhas = new ArrayList<>();
        List<String> linha = new ArrayList<>();
        StringBuilder celula = new StringBuilder();
        boolean aspas = false;
        char s = sep.charAt(0);
        for (int i = 0; i < t.length(); i++) {
            char c = t.charAt(i);
            if (aspas) {
                if (c == '"') {
                    if (i + 1 < t.length() && t.charAt(i + 1) == '"') {
                        celula.append('"');
                        i++;
                    } else aspas = false;
                } else celula.append(c);
                continue;
            }
            if (c == '"') {
                aspas = true;
                continue;
            }
            if (c == s) {
                linha.add(celula.toString());
                celula.setLength(0);
                continue;
            }
            if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < t.length() && t.charAt(i + 1) == '\n') i++;
                linha.add(celula.toString());
                linhas.add(linha);
                linha = new ArrayList<>();
                celula.setLength(0);
                continue;
            }
            celula.append(c);
        }
        linha.add(celula.toString());
        linhas.add(linha);
        List<List<String>> uteis = new ArrayList<>();
        for (List<String> l : linhas) {
            boolean algum = false;
            for (String c : l) if (!c.trim().isEmpty()) algum = true;
            if (algum) uteis.add(l);
        }
        return uteis;
    }

    private static int[] faixa(String campo) {
        switch (campo) {
            case "heartRate":
            case "minHeartRate":
                return new int[] {20, 260};
            case "spo2":
            case "minSpo2":
                return new int[] {50, 100};
            case "systolic":
                return new int[] {50, 300};
            case "diastolic":
                return new int[] {30, 200};
            case "steps":
                return new int[] {0, 200_000};
            case "sleepMinutes":
                return new int[] {1, 1440};
            case "deepMinutes":
            case "lightMinutes":
            case "remMinutes":
            case "awakeMinutes":
            case "awakenings":
                return new int[] {0, 1440};
            case "efficiencyPct":
                return new int[] {0, 100};
            case "calories":
                return new int[] {0, 20_000};
            default:
                return null;
        }
    }

    private static String[] sinonimos(String campo) {
        switch (campo) {
            case "recordedAt":
                return new String[] {"date", "time", "datetime", "date time", "data", "hora", "data hora",
                        "data e hora", "timestamp", "measure time", "measurement time", "tempo", "record time", "start time"};
            case "heartRate":
                return new String[] {"heart rate", "heartrate", "hr", "bpm", "avg heart rate", "average heart rate",
                        "frequencia cardiaca", "frequencia", "batimentos", "batimento", "pulse", "pulso", "fc", "heart rate bpm"};
            case "spo2":
                return new String[] {"spo2", "sp o2", "blood oxygen", "oxygen", "oxygen saturation", "oxigenio",
                        "oxigenacao", "saturacao", "saturacao de oxigenio", "o2", "spo2 %"};
            case "systolic":
                return new String[] {"systolic", "systolic bp", "sbp", "sistolica", "pressao sistolica",
                        "pressao maxima", "maxima", "high pressure", "hp", "sys"};
            case "diastolic":
                return new String[] {"diastolic", "diastolic bp", "dbp", "diastolica", "pressao diastolica",
                        "pressao minima", "minima", "low pressure", "lp", "dia"};
            case "steps":
                return new String[] {"steps", "step", "step count", "passos", "total steps", "numero de passos"};
            case "sleepMinutes":
                return new String[] {"sleep", "total sleep", "sleep total", "total sleep time", "sleep duration",
                        "sono", "sono total", "total de sono", "duracao do sono", "tempo de sono", "horas de sono"};
            case "deepMinutes":
                return new String[] {"deep sleep", "deep", "deep sleep time", "sono profundo", "profundo"};
            case "lightMinutes":
                return new String[] {"light sleep", "light", "light sleep time", "sono leve", "leve"};
            case "remMinutes":
                return new String[] {"rem"};
            case "awakeMinutes":
                return new String[] {"desperto"};
            case "calories":
                return new String[] {"calories", "calorias", "kcal", "cal", "energy", "energia"};
            default:
                return new String[0];
        }
    }

    public static List<String> rotulos() {
        return Arrays.asList(
                "recordedAt", "heartRate", "spo2", "systolic", "diastolic", "steps", "calories",
                "sleepMinutes", "deepMinutes", "lightMinutes", "remMinutes", "awakeMinutes",
                "awakenings", "efficiencyPct", "minHeartRate", "minSpo2");
    }

    public static String rotulo(String campo) {
        switch (campo) {
            case "recordedAt": return "Data e hora";
            case "heartRate": return "Batimentos por minuto";
            case "spo2": return "Oxigenação do sangue";
            case "systolic": return "Pressão — número maior";
            case "diastolic": return "Pressão — número menor";
            case "steps": return "Passos";
            case "sleepMinutes": return "Sono (total)";
            case "deepMinutes": return "Sono profundo";
            case "lightMinutes": return "Sono leve";
            case "remMinutes": return "Sono REM";
            case "awakeMinutes": return "Tempo acordado";
            case "awakenings": return "Despertares";
            case "efficiencyPct": return "Eficiência do sono";
            case "minHeartRate": return "Batimentos mínimos";
            case "minSpo2": return "Oxigenação mínima";
            case "calories": return "Calorias";
            default: return campo;
        }
    }
}
