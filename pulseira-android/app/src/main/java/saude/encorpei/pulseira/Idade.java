package saude.encorpei.pulseira;

import org.json.JSONObject;

/**
 * A mesma conta de {@code heartAge.ts} e {@code framinghamRisco10a} em
 * {@code scores.ts}. Coeficientes de D'Agostino, 2008. Não inventa outro modelo.
 */
final class Idade {
    static final int MAX = 85;

    static final class Resultado {
        final int idadeReal;
        final int idadeDoCoracao;
        final int diferenca;
        final boolean noTeto;

        Resultado(int idadeReal, int idadeDoCoracao) {
            this.idadeReal = idadeReal;
            this.idadeDoCoracao = idadeDoCoracao;
            this.diferenca = idadeDoCoracao - idadeReal;
            this.noTeto = idadeDoCoracao >= MAX;
        }
    }

    private Idade() {}

    /** null quando a estimativa se aplica. Senão a frase da tela. */
    static String motivo(JSONObject p) {
        if (p == null) return "Cadastro incompleto.";
        JSONObject h = p.optJSONObject("history");
        if (h != null && (h.optBoolean("previous_mi") || h.optBoolean("stroke_tia") || h.optBoolean("heart_failure")
                || h.optBoolean("pci") || h.optBoolean("cabg") || h.optBoolean("pad"))) {
            return "Você já tem um diagnóstico cardiológico estabelecido. Neste caso a Idade do Coração não é a melhor medida — o que conta é o seu Tempo no Alvo e a sua Capacidade.";
        }
        int idade = anos(p.optString("birth_date", ""));
        if (idade < 30 || idade > 79) return "A estimativa é validada para idades entre 30 e 79 anos.";
        String sexo = p.optString("sex", "");
        if (!"male".equals(sexo) && !"female".equals(sexo)) return "Falta o sexo biológico no seu cadastro.";
        return null;
    }

    static int anos(String nascimento) {
        if (nascimento == null || nascimento.length() < 10) return -1;
        try {
            java.time.LocalDate d = java.time.LocalDate.parse(nascimento.substring(0, 10));
            java.time.LocalDate hoje = java.time.LocalDate.now();
            int idade = hoje.getYear() - d.getYear();
            if (hoje.getMonthValue() < d.getMonthValue()
                    || (hoje.getMonthValue() == d.getMonthValue() && hoje.getDayOfMonth() < d.getDayOfMonth())) {
                idade--;
            }
            return idade;
        } catch (Exception ex) {
            return -1;
        }
    }

    /** null se a idade está fora de 30–79, como {@code framinghamRisco10a}. */
    static Double risco(double idade, boolean homem, double colesterol, double hdl, double sistolica, boolean tratado, boolean fumante, boolean diabetes) {
        if (idade < 30 || idade > 79) return null;
        if (colesterol <= 0 || hdl <= 0 || sistolica <= 0) return null;
        double age = homem ? 3.06117 : 2.32888;
        double chol = homem ? 1.1237 : 1.20904;
        double h = homem ? -0.93263 : -0.70833;
        double sbpT = homem ? 1.99881 : 2.82263;
        double sbpU = homem ? 1.93303 : 2.76157;
        double smoke = homem ? 0.65451 : 0.52873;
        double dm = homem ? 0.57367 : 0.69154;
        double mean = homem ? 23.9802 : 26.1931;
        double s0 = homem ? 0.88936 : 0.95012;
        double sum = age * Math.log(idade) + chol * Math.log(colesterol) + h * Math.log(hdl)
                + (tratado ? sbpT : sbpU) * Math.log(sistolica)
                + (fumante ? smoke : 0) + (diabetes ? dm : 0);
        double risco = (1 - Math.pow(s0, Math.exp(sum - mean))) * 100;
        return Math.round(Math.max(0, Math.min(100, risco)) * 10d) / 10d;
    }

    static Resultado calcular(int idade, String sexo, double colesterol, double hdl, int sistolica, boolean tratado, boolean fumante, boolean diabetes) {
        boolean homem = "male".equals(sexo);
        Double atual = risco(idade, homem, colesterol, hdl, sistolica, tratado, fumante, diabetes);
        if (atual == null) return null;
        int equivalente = equivalente(atual, homem);
        return new Resultado(idade, equivalente);
    }

    private static int equivalente(double riscoAtual, boolean homem) {
        double melhor = 30;
        double menor = Double.POSITIVE_INFINITY;
        for (double idade = 30; idade <= MAX; idade += 0.5) {
            Double ref = risco(Math.min(idade, 79), homem, 180, 45, 125, false, false, false);
            if (ref == null) continue;
            double ajustado = idade > 79 ? ref * (1 + (idade - 79) * 0.06) : ref;
            double d = Math.abs(ajustado - riscoAtual);
            if (d < menor) {
                menor = d;
                melhor = idade;
            }
        }
        return (int) Math.round(melhor);
    }
}
