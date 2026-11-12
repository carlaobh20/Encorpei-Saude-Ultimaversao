package saude.encorpei.pulseira;

/** A mesma conta de framinghamRisco10a / calcularIdadeDoCoracao para um caso fixo. */
public final class IdadeTest {
    public static void main(String[] args) {
        double risco = Idade.risco(50, true, 200, 50, 130, true, false, false);
        if (Math.abs(risco - 11.4) > 0.001) falha("risco " + risco);
        Idade.Resultado r = Idade.calcular(50, "male", 200, 50, 130, true, false, false);
        if (r.idadeReal != 50 || r.idadeDoCoracao != 58 || r.diferenca != 8) falha("idade " + r.idadeDoCoracao);
        if (Idade.risco(29, true, 200, 50, 130, false, false, false) != null) falha("29");
        if (Idade.risco(80, false, 200, 50, 130, false, false, false) != null) falha("80");
        System.out.println("PASS");
    }

    private static void falha(String m) {
        throw new AssertionError(m);
    }
}
