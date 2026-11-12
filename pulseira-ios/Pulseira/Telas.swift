import SwiftUI

struct CasaTelas: View {
    @Binding var aba: String
    @ObservedObject var conta: Conta
    var bpm: Int? = nil

    var body: some View {
        switch aba {
        case "evolucao": EvolucaoTela(conta: conta)
        case "registrar": RegistrarTela(conta: conta, abrir: { aba = $0 })
        case "medico": MedicoTela(conta: conta)
        case "remedios": RemediosTela(conta: conta, voltar: { aba = "registrar" })
        case "sintomas": SintomasTela(conta: conta, voltar: { aba = "registrar" })
        case "caminhada": CaminhadaTela(conta: conta, bpm: bpm, voltar: { aba = "registrar" })
        case "alimentacao": AlimentacaoTela(conta: conta, voltar: { aba = "registrar" })
        case "sono": SonoTela(conta: conta, voltar: { aba = "registrar" })
        default: HojeTela(conta: conta, abrirRegistro: { aba = "registrar" })
        }
    }
}

struct BarraAbas: View {
    @Binding var aba: String
    private let itens = [("hoje", "Hoje"), ("evolucao", "Evolução"), ("registrar", "Registrar"), ("medico", "Meu médico"), ("pulseira", "Pulseira")]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(itens, id: \.0) { item in
                Button { aba = item.0 } label: {
                    VStack(spacing: 2) {
                        if item.0 == "registrar" {
                            Text("+")
                                .font(.custom("Sora", size: 22).weight(.bold))
                                .foregroundStyle(.white)
                                .frame(width: 38, height: 38)
                                .background(Circle().fill(marcaBotao))
                        } else {
                            Image(systemName: simbolo(item.0))
                                .font(.system(size: 18, weight: aba == item.0 ? .semibold : .regular))
                                .foregroundStyle(aba == item.0 ? marca : secundaria)
                        }
                        Text(item.1)
                            .font(.custom("Inter", size: 11).weight(aba == item.0 ? .bold : .regular))
                            .foregroundStyle(aba == item.0 ? marca : (item.0 == "registrar" ? tinta : secundaria))
                        Capsule()
                            .fill(aba == item.0 && item.0 != "registrar" ? marca : Color.clear)
                            .frame(width: 18, height: 2)
                    }
                    .frame(maxWidth: .infinity, minHeight: 68)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color.white)
        .overlay(Rectangle().frame(height: 1).foregroundStyle(borda), alignment: .top)
        .shadow(color: Color(red: 0.106, green: 0.255, blue: 0.396).opacity(0.04), radius: 5, y: -2)
    }

    private func simbolo(_ id: String) -> String {
        switch id {
        case "hoje": return "house.fill"
        case "evolucao": return "heart.fill"
        case "medico": return "stethoscope"
        default: return "applewatch"
        }
    }

    private var tinta: Color { Color(red: 0.063, green: 0.118, blue: 0.263) }
    private var secundaria: Color { Color(red: 0.325, green: 0.420, blue: 0.569) }
    private var marca: Color { Color(red: 0.071, green: 0.365, blue: 0.690) }
    private var marcaBotao: Color { Color(red: 0.071, green: 0.388, blue: 0.722) }
    private var borda: Color { Color(red: 0.878, green: 0.910, blue: 0.949) }
}

private struct HojeTela: View {
    @ObservedObject var conta: Conta
    var abrirRegistro: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(conta.nomePessoa.isEmpty ? "Hoje" : conta.nomePessoa)
                .font(.custom("Sora", size: 27).weight(.bold))
                .tracking(-1)
                .foregroundStyle(tinta)
            Text(conta.textoHoje.isEmpty ? "Carregando…" : conta.textoHoje)
                .font(.custom("Inter", size: 16))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(LinearGradient(colors: [
                    Color(red: 0.071, green: 0.388, blue: 0.722),
                    Color(red: 0.098, green: 0.416, blue: 0.741),
                    Color(red: 0.078, green: 0.337, blue: 0.604),
                ], startPoint: .leading, endPoint: .trailing))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            Button("Registrar", action: abrirRegistro)
                .buttonStyle(BotaoCheio())
        }
    }
}

private struct EvolucaoTela: View {
    @ObservedObject var conta: Conta

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Minha evolução")
                .font(.custom("Sora", size: 27).weight(.bold))
                .tracking(-1.2)
                .foregroundStyle(tinta)
            Text("A prova de que o esforço está funcionando")
                .font(.system(size: 16))
                .foregroundStyle(secundaria)
            Text(conta.textoMeta.isEmpty ? "Carregando…" : conta.textoMeta)
                .font(.system(size: 16))
                .foregroundStyle(tinta)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(borda, lineWidth: 1))
                .padding(.top, 8)
        }
    }
}

private struct RegistrarTela: View {
    @ObservedObject var conta: Conta
    var abrir: (String) -> Void = { _ in }
    @State private var tipo = ""
    @State private var a = ""
    @State private var b = ""
    @State private var c = ""
    @State private var nota: Int?
    @State private var erro = ""
    @State private var salvando = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Registrar")
                .font(.custom("Sora", size: 27).weight(.bold))
                .tracking(-1.2)
                .foregroundStyle(tinta)
            Text(conta.textoHoje)
                .font(.system(size: 14))
                .foregroundStyle(tinta)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .background(destaque)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            ForEach([("bp", "Pressão"), ("weight", "Peso"), ("wellbeing", "Como me sinto"), ("hr", "Batimentos"), ("spo2", "Oxigenação"), ("glucose", "Glicemia")], id: \.0) { item in
                Button(item.1) { abrirFormulario(item.0) }
                    .buttonStyle(BotaoContorno())
            }
            ForEach([("remedios", "Remédios"), ("sintomas", "Sintoma"), ("caminhada", "Caminhada"), ("alimentacao", "Alimentação"), ("sono", "Sono")], id: \.0) { item in
                Button(item.1) { abrir(item.0) }
                    .buttonStyle(BotaoContorno())
            }
            if !tipo.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    if !ajuda.isEmpty {
                        Text(ajuda).font(.system(size: 14)).foregroundStyle(secundaria)
                    }
                    if tipo == "wellbeing" {
                        Text("De 0 a 10, como você está hoje?").font(.system(size: 16, weight: .medium))
                        Text("0 é o pior dia que você já teve; 10 é o melhor.").font(.system(size: 14)).foregroundStyle(secundaria)
                        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 6), spacing: 8) {
                            ForEach(0..<11, id: \.self) { n in
                                Button(String(n)) { nota = n }
                                    .font(.system(size: 16, weight: .semibold))
                                    .frame(maxWidth: .infinity, minHeight: 48)
                                    .foregroundStyle(nota == n ? Color.white : tinta)
                                    .background(nota == n ? tinta : Color.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                                    .overlay(RoundedRectangle(cornerRadius: 10).stroke(borda, lineWidth: 1))
                            }
                        }
                    } else {
                        Text(rotuloA).font(.system(size: 16, weight: .medium))
                        TextField(dicaA, text: $a).textFieldStyle(.roundedBorder).font(.system(size: 22, weight: .semibold))
                        if tipo == "bp" {
                            Text("Número menor").font(.system(size: 16, weight: .medium))
                            TextField("80", text: $b).textFieldStyle(.roundedBorder).font(.system(size: 22, weight: .semibold))
                            Text("Batimentos (se o aparelho mostrar)").font(.system(size: 16, weight: .medium))
                            TextField("70", text: $c).textFieldStyle(.roundedBorder).font(.system(size: 22, weight: .semibold))
                        }
                    }
                    if !erro.isEmpty { Text(erro).font(.system(size: 14)).foregroundStyle(aviso) }
                    Button(salvando ? "Salvando…" : "Salvar") { salvar() }
                        .buttonStyle(BotaoCheio())
                        .disabled(salvando)
                }
                .padding(16)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(borda, lineWidth: 1))
            }
        }
    }

    private var ajuda: String {
        switch tipo {
        case "bp": return "Sente-se, apoie o braço na mesa e espere cinco minutos parado antes de medir."
        case "weight": return "De manhã, depois de ir ao banheiro e antes de comer — sempre do mesmo jeito. É a comparação entre os dias que interessa ao seu médico."
        default: return ""
        }
    }
    private var rotuloA: String {
        switch tipo {
        case "bp": return "Número maior"
        case "weight": return "Peso de hoje"
        case "hr": return "Batimentos em repouso"
        case "spo2": return "Oxigenação no dedo"
        case "glucose": return "Glicemia"
        default: return ""
        }
    }
    private var dicaA: String {
        switch tipo {
        case "bp": return "120"
        case "weight": return "78,5"
        case "hr": return "68"
        case "spo2": return "97"
        default: return "98"
        }
    }
    private func abrirFormulario(_ novo: String) {
        tipo = novo
        a = ""; b = ""; c = ""; nota = nil; erro = ""
    }
    private func salvar() {
        salvando = true
        let tipo = tipo
        let a = a, b = b, c = c, nota = nota
        DispatchQueue.global(qos: .userInitiated).async {
            let falha = conta.registrarMedida(tipo: tipo, a: a, b: b, c: c, nota: nota)
            DispatchQueue.main.async {
                salvando = false
                if let falha { erro = falha }
                else {
                    erro = "Registrado."
                    conta.carregarCasa()
                }
            }
        }
    }
}

private struct MedicoTela: View {
    @ObservedObject var conta: Conta
    @State private var texto = ""
    @State private var erro = ""
    @State private var emergencia = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(conta.nomeMedico)
                .font(.custom("Sora", size: 27).weight(.bold))
                .tracking(-1.2)
                .foregroundStyle(tinta)
            if !conta.clinicaMedico.isEmpty {
                Text(conta.clinicaMedico).font(.system(size: 16)).foregroundStyle(secundaria)
            }
            Button("Este chat não é para emergência. Se não estiver bem, toque aqui para ver o que fazer.") {
                emergencia.toggle()
            }
            .font(.system(size: 16))
            .foregroundStyle(aviso)
            .multilineTextAlignment(.leading)
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(avisoBg)
            .clipShape(RoundedRectangle(cornerRadius: 14))
            if emergencia {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Emergência").font(.system(size: 22, weight: .bold))
                    Text("Se você não está bem, ligue agora.")
                    Link("Ligar 192", destination: URL(string: "tel:192")!)
                        .font(.system(size: 22, weight: .bold))
                    Text("SAMU — atendimento de urgência").foregroundStyle(secundaria)
                    Text("Quando ligar").font(.system(size: 18, weight: .bold)).padding(.top, 8)
                    Text("Dor no peito que não passa\nFalta de ar que começou de repente\nDesmaio\nFala enrolada ou fraqueza de um lado do corpo")
                    Text("Enquanto espera").font(.system(size: 18, weight: .bold)).padding(.top, 8)
                    Text("Sente-se ou deite-se em um lugar confortável.\nNão dirija até o hospital — peça para alguém te levar, ou aguarde a ambulância.\nAvise alguém perto de você para ficar junto enquanto espera.\n\nDepois de procurar atendimento, avise seu médico assim que puder.")
                }
                .font(.system(size: 16))
                .foregroundStyle(tinta)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
            Text(conta.textoMensagens.isEmpty ? "Nenhuma mensagem ainda. Escreva para o seu médico abaixo." : conta.textoMensagens)
                .font(.system(size: 16))
                .foregroundStyle(tinta)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(borda, lineWidth: 1))
            TextField("Escreva uma mensagem...", text: $texto, axis: .vertical)
                .textFieldStyle(.roundedBorder)
            if !erro.isEmpty { Text(erro).font(.system(size: 14)).foregroundStyle(aviso) }
            Button("Enviar") { enviar() }
                .buttonStyle(BotaoCheio())
        }
    }

    private func enviar() {
        let corpo = texto
        DispatchQueue.global(qos: .userInitiated).async {
            let falha = conta.enviarMensagem(corpo)
            DispatchQueue.main.async {
                if let falha { erro = falha }
                else {
                    texto = ""
                    erro = ""
                    conta.carregarCasa()
                }
            }
        }
    }
}

private struct BotaoCheio: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color.white)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Color(red: 0.071, green: 0.388, blue: 0.722).opacity(configuration.isPressed ? 0.82 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct BotaoContorno: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color(red: 0.063, green: 0.118, blue: 0.263))
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(red: 0.878, green: 0.910, blue: 0.949), lineWidth: 1))
    }
}

private var tinta: Color { Color(red: 0.063, green: 0.118, blue: 0.263) }
private var secundaria: Color { Color(red: 0.325, green: 0.420, blue: 0.569) }
private var aviso: Color { Color(red: 0.490, green: 0.286, blue: 0.051) }
private var avisoBg: Color { Color(red: 0.996, green: 0.953, blue: 0.886) }
private var borda: Color { Color(red: 0.878, green: 0.910, blue: 0.949) }
private var destaque: Color { Color(red: 0.933, green: 0.965, blue: 1.0) }
