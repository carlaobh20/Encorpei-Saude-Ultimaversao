package saude.encorpei.pulseira;

/**
 * O que {@code useWearableSync.gravarAmostra} e {@code amostraParaLeituras}
 * gravam em {@code hr_readings}. Sem Android, para o teste rodar no javac.
 */
public final class Gravacao {
    /** useWearableSync.INTERVALO_GRAVACAO_MS */
    public static final long INTERVALO_MS = 60_000;

    private Gravacao() {}

    public static boolean deveGravar(long agora, long ultima, boolean forcar) {
        return forcar || agora - ultima >= INTERVALO_MS;
    }

    /** contactDetected === false → suspect. Contato ou desconhecido → estimated. */
    public static String validacao(Boolean contato) {
        return Boolean.FALSE.equals(contato) ? "suspect" : "estimated";
    }

    /**
     * Colunas de COLUNAS.hr_readings. Sem vital_type e sem entered_by_user_id,
     * que o PostgREST rejeita.
     */
    public static String jsonLinha(
            String uid, String deviceId, String nome, int bpm, Boolean contato,
            String at, Double rmssd, Double sdnn) {
        return "{"
                + "\"patient_user_id\":" + j(uid)
                + ",\"recorded_at\":" + j(at)
                + ",\"bpm\":" + bpm
                + ",\"context\":\"resting\""
                + ",\"irregular_flag\":null"
                + ",\"rmssd\":" + num(rmssd)
                + ",\"sdnn\":" + num(sdnn)
                + ",\"source_type\":\"device\""
                + ",\"source_device_id\":" + j(deviceId)
                + ",\"source_device_name\":" + j(nome)
                + ",\"entered_by\":\"device\""
                + ",\"validation_status\":" + j(validacao(contato))
                + "}";
    }

    /** Insert de registered_devices em registrarDispositivo. model fica nulo. */
    public static String jsonDispositivo(String uid, String nome) {
        return "{"
                + "\"patient_user_id\":" + j(uid)
                + ",\"display_name\":" + j(nome)
                + ",\"model\":null"
                + ",\"manufacturer\":null"
                + ",\"category\":\"h59\""
                + ",\"protocol\":\"ble\""
                + ",\"vital_types\":[\"heart_rate\"]"
                + ",\"firmware\":null"
                + ",\"status\":\"active\""
                + "}";
    }

    static String j(String s) {
        if (s == null) return "null";
        StringBuilder o = new StringBuilder(s.length() + 2);
        o.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' || c == '"') o.append('\\').append(c);
            else if (c == '\n') o.append("\\n");
            else if (c < 0x20) o.append(String.format("\\u%04x", (int) c));
            else o.append(c);
        }
        o.append('"');
        return o.toString();
    }

    private static String num(Double n) {
        if (n == null) return "null";
        if (n.isNaN() || n.isInfinite()) return "null";
        return Double.toString(n);
    }
}
