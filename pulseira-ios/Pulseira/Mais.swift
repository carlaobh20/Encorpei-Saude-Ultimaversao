import SwiftUI

extension Conta {
    func listaMais(_ caminho: String) -> [[String: Any]] {
        guard let token = try? tokenValido(), let r = try? pedir(metodo: "GET", url: Self.urlBase + "/rest/v1/" + caminho, corpo: nil, token: token, prefer: nil, faixa: nil),
              r.codigo >= 200, r.codigo < 300,
              let json = try? JSONSerialization.jsonObject(with: r.dados) as? [[String: Any]] else { return [] }
        return json
    }

    func gravarMais(_ caminho: String, _ objeto: [String: Any], confirmar: Bool) -> String? {
        guard let token = try? tokenValido(), let uid = sessao("uid") else { return "Entre na sua conta antes de registrar." }
        var corpo = objeto
        corpo["patient_user_id"] = uid
        guard let dados = try? JSONSerialization.data(withJSONObject: corpo) else { return "Não consegui gravar agora." }
        let prefer = caminho.contains("on_conflict")
            ? "resolution=merge-duplicates,return=representation"
            : (confirmar ? "return=representation" : "return=minimal")
        guard let r = try? pedir(metodo: "POST", url: Self.urlBase + "/rest/v1/" + caminho, corpo: dados, token: token, prefer: prefer, faixa: nil) else {
            return "Não consegui gravar agora."
        }
        if r.codigo < 200 || r.codigo >= 300 {
            let cru = texto(r.dados)
            return cru.isEmpty ? "Não consegui gravar agora." : cru
        }
        if confirmar {
            let lista = (try? JSONSerialization.jsonObject(with: r.dados) as? [[String: Any]]) ?? []
            if lista.isEmpty { return "Não consegui gravar agora." }
        }
        return nil
    }

    static func hojeUtc() -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(secondsFromGMT: 0)
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}

struct RemediosTela: View {
    @ObservedObject var conta: Conta
    var voltar: () -> Void
    @State private var texto = "Carregando…"
    @State private var doses: [(String, String, String, Bool)] = []

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Remédios").font(.custom("Sora", size: 26).weight(.semibold)).foregroundStyle(tintaMais)
            Text("Suas doses de hoje").foregroundStyle(secundariaMais)
            Text(texto).font(.system(size: 16)).foregroundStyle(tintaMais)
            ForEach(Array(doses.enumerated()), id: \.offset) { _, d in
                Button((d.3 ? "Tomei · " : "Marcar · ") + d.2) { marcar(d.0, d.1, !d.3) }
                    .buttonStyle(d.3 ? BotaoContornoMais() : BotaoCheioMais())
            }
            Button("Voltar", action: voltar).buttonStyle(BotaoContornoMais())
        }
        .onAppear(perform: carregar)
    }

    private func carregar() {
        DispatchQueue.global(qos: .userInitiated).async {
            let uid = conta.sessao("uid") ?? ""
            let meds = conta.listaMais("cardio_medications?patient_user_id=eq.\(conta.enc(uid))&status=eq.active&select=id,name,dose,med_class,schedule&order=created_at.asc")
            let hoje = Conta.hojeUtc()
            let tomou = conta.listaMais("medication_intakes?patient_user_id=eq.\(conta.enc(uid))&intake_date=eq.\(hoje)&select=medication_id,scheduled_time,taken")
            var linhas: [(String, String, String, Bool)] = []
            var corpo = ""
            if meds.isEmpty {
                corpo = "Nenhum remédio cadastrado\nQuando seu médico prescrever, seus horários aparecem aqui."
            }
            for med in meds {
                let horas = med["schedule"] as? [String] ?? (med["schedule"] as? [Any])?.compactMap { $0 as? String } ?? []
                let id = med["id"] as? String ?? ""
                let nome = (med["name"] as? String ?? "") + "\n" + (med["dose"] as? String ?? "") + " · " + Self.classe(med["med_class"] as? String ?? "")
                for hora in horas {
                    let taken = tomou.contains {
                        ($0["medication_id"] as? String) == id && ($0["scheduled_time"] as? String) == hora
                            && (($0["taken"] as? Bool) ?? ($0["taken"] as? NSNumber)?.boolValue ?? false)
                    }
                    linhas.append((id, hora, nome + "\n" + hora, taken))
                }
                corpo += (corpo.isEmpty ? "" : "\n\n") + (med["name"] as? String ?? "") + "\n" + (med["dose"] as? String ?? "") + " · " + horas.joined(separator: ", ") + "\n" + Self.paraQue(med["med_class"] as? String ?? "")
            }
            if !meds.isEmpty { corpo = "Seus remédios\n" + corpo }
            DispatchQueue.main.async { self.texto = corpo; self.doses = linhas }
        }
    }

    private func marcar(_ id: String, _ hora: String, _ taken: Bool) {
        DispatchQueue.global(qos: .userInitiated).async {
            let erro = conta.gravarMais("medication_intakes?on_conflict=medication_id,intake_date,scheduled_time", [
                "medication_id": id,
                "intake_date": Conta.hojeUtc(),
                "scheduled_time": hora,
                "taken": taken,
                "taken_at": taken ? ISO8601DateFormatter().string(from: Date()) : NSNull(),
            ], confirmar: true)
            DispatchQueue.main.async {
                if let erro { texto = erro == "Não consegui gravar agora." ? "A dose não foi gravada (permissão negada ou vínculo inativo)." : erro }
                else { carregar() }
            }
        }
    }

    private static func classe(_ c: String) -> String {
        switch c {
        case "acei": return "Inibidor da ECA (IECA)"
        case "arb": return "Bloqueador do receptor de angiotensina (BRA)"
        case "arni": return "Sacubitril-valsartana (ARNI)"
        case "beta_blocker": return "Betabloqueador"
        case "ccb": return "Bloqueador de cálcio"
        case "sglt2": return "Protetor do rim e do coração (iSGLT2)"
        case "mra": return "Antagonista mineralocorticoide"
        case "loop_diuretic": return "Diurético de alça"
        case "thiazide": return "Tiazídico"
        case "statin": return "Estatina"
        case "ezetimibe": return "Ezetimiba"
        case "pcsk9": return "Inibidor de PCSK9"
        case "antiplatelet": return "Antiagregante"
        case "anticoagulant": return "Anticoagulante"
        case "antiarrhythmic": return "Antiarrítmico"
        case "nitrate": return "Nitrato"
        default: return "Outro"
        }
    }

    private static func paraQue(_ c: String) -> String {
        switch c {
        case "acei", "arb": return "Controla a pressão e protege o coração e os rins."
        case "arni": return "Fortalece o coração na insuficiência cardíaca."
        case "beta_blocker": return "Deixa o coração bater mais devagar e com menos esforço."
        case "ccb": return "Relaxa os vasos sanguíneos para baixar a pressão."
        case "sglt2": return "Protege o coração e os rins, e ajuda a controlar o açúcar no sangue."
        case "mra": return "Ajuda a tirar o excesso de líquido e protege o coração."
        case "loop_diuretic": return "Tira o excesso de líquido do corpo — o \"diurético\"."
        case "thiazide": return "Tira o excesso de líquido e ajuda a controlar a pressão."
        case "statin": return "Baixa o colesterol para proteger as artérias."
        case "ezetimibe": return "Ajuda a baixar o colesterol."
        case "pcsk9": return "Baixa bastante o colesterol quando os outros remédios não bastam."
        case "antiplatelet": return "Deixa o sangue menos propenso a formar coágulos."
        case "anticoagulant": return "Afina o sangue para prevenir coágulos."
        case "antiarrhythmic": return "Ajuda o coração a manter o ritmo certo."
        case "nitrate": return "Alivia a dor no peito abrindo os vasos do coração."
        default: return "Faz parte do seu tratamento — pergunte ao seu médico se tiver dúvida."
        }
    }
}

struct SintomasTela: View {
    @ObservedObject var conta: Conta
    var voltar: () -> Void
    @State private var tipo = ""
    @State private var gatilho = ""
    @State private var tipoDor = ""
    @State private var local = ""
    @State private var irrad = ""
    @State private var duracao = ""
    @State private var intensidade = ""
    @State private var notas = ""
    @State private var associados: Set<String> = []
    @State private var repouso = false
    @State private var leve = false
    @State private var habitual = false
    @State private var dpn = false
    @State private var travesseiros = "1"
    @State private var aviso = ""
    @State private var emergencia = false

    private let lista = [
        ("chest_pain", "Dor no peito"), ("dyspnea", "Falta de ar"), ("palpitations", "Palpitação (coração disparado)"),
        ("edema", "Inchaço nas pernas"), ("syncope", "Desmaio"), ("presyncope", "Quase desmaiei"),
        ("claudication", "Dor na perna ao andar"), ("dry_cough", "Tosse seca"), ("fatigue", "Cansaço fora do comum"), ("dizziness", "Tontura"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if emergencia {
                Text("Emergência").font(.custom("Sora", size: 26).weight(.semibold))
                Text("Se você não está bem, ligue agora.")
                Link("Ligar 192", destination: URL(string: "tel:192")!).font(.system(size: 22, weight: .bold))
                Text("SAMU — atendimento de urgência").foregroundStyle(secundariaMais)
                Text("Quando ligar\nDor no peito que não passa\nFalta de ar que começou de repente\nDesmaio\nFala enrolada ou fraqueza de um lado do corpo")
                Text("Enquanto espera\nSente-se ou deite-se em um lugar confortável.\nNão dirija até o hospital — peça para alguém te levar, ou aguarde a ambulância.\nAvise alguém perto de você para ficar junto enquanto espera.")
                if !aviso.isEmpty { Text(aviso).foregroundStyle(avisoMais) }
                Button("Voltar", action: voltar).buttonStyle(BotaoContornoMais())
            } else if tipo.isEmpty {
                Text("Sintomas").font(.custom("Sora", size: 26).weight(.semibold)).foregroundStyle(tintaMais)
                Text("O que você está sentindo?").foregroundStyle(secundariaMais)
                ForEach(lista, id: \.0) { item in
                    Button(item.1) {
                        if item.0 == "syncope" {
                            aviso = "Desmaio é emergência."
                            gravar("syncope", [:], nil, nil, nil, emergencia: true)
                        } else { tipo = item.0 }
                    }.buttonStyle(BotaoContornoMais())
                }
                Button("Voltar", action: voltar).buttonStyle(BotaoContornoMais())
            } else {
                Text(lista.first { $0.0 == tipo }?.1 ?? "").font(.custom("Sora", size: 26).weight(.semibold)).foregroundStyle(tintaMais)
                formulario
                if !aviso.isEmpty { Text(aviso).foregroundStyle(avisoMais) }
                Button("Voltar") { tipo = "" }.buttonStyle(BotaoContornoMais())
            }
        }
    }

    @ViewBuilder private var formulario: some View {
        if tipo == "chest_pain" {
            Text("Se a dor está acontecendo agora, não passa e você está em repouso, não espere — vá direto para emergência.").foregroundStyle(avisoMais)
            Text("Onde dói")
            TextField("ex.: meio do peito", text: $local).textFieldStyle(.roundedBorder)
            Text("Há quanto tempo (minutos)")
            TextField("", text: $duracao).textFieldStyle(.roundedBorder)
            Button("Durante esforço") { gatilho = "esforco" }.buttonStyle(BotaoContornoMais())
            Button("Em repouso") { gatilho = "repouso" }.buttonStyle(BotaoContornoMais())
            Button("Com emoção/estresse") { gatilho = "emocao" }.buttonStyle(BotaoContornoMais())
            Text("A dor vai para algum lugar (braço, costas, mandíbula)?")
            TextField("", text: $irrad).textFieldStyle(.roundedBorder)
            Text("De 0 (nada) a 10 (a pior possível), quanto dói?")
            TextField("0 a 10", text: $intensidade).textFieldStyle(.roundedBorder)
            Button("Emergência") {
                gravar("chest_pain", ["local": local, "tipo": tipoDor, "gatilho": gatilho.isEmpty ? "repouso" : gatilho, "irradiacao": irrad, "associados": "", "pelo_aviso_da_tela": true], minutos(duracao), nil, nil, emergencia: true)
            }.buttonStyle(BotaoCheioMais())
            Button("Registrar") {
                let min = minutos(duracao)
                let q: [String: Any] = ["local": local, "tipo": tipoDor, "gatilho": gatilho, "irradiacao": irrad, "associados": ""]
                if gatilho == "repouso" && (min == nil || (min ?? 0) > 10) {
                    gravar("chest_pain", q, min, nota(intensidade), nil, emergencia: true)
                } else {
                    gravar("chest_pain", q, min, nota(intensidade), nil, emergencia: false)
                }
            }.buttonStyle(BotaoCheioMais())
        } else if tipo == "dyspnea" {
            Button("Em atividades do dia a dia (ex.: subir escada)") { habitual.toggle() }.buttonStyle(BotaoContornoMais())
            Button("Em esforços leves (ex.: andar em casa)") { leve.toggle() }.buttonStyle(BotaoContornoMais())
            Button("Mesmo parado, sem fazer nada") { repouso.toggle() }.buttonStyle(BotaoContornoMais())
            Text("Quantos travesseiros usa para dormir sem faltar ar?")
            TextField("1", text: $travesseiros).textFieldStyle(.roundedBorder)
            Button("Já acordei à noite sem conseguir respirar") { dpn.toggle() }.buttonStyle(BotaoContornoMais())
            Text("De 0 (nada) a 10 (muito forte), quanta falta de ar?")
            TextField("0 a 10", text: $intensidade).textFieldStyle(.roundedBorder)
            Button("Registrar") {
                let nyha = repouso ? 4 : leve ? 3 : habitual ? 2 : 1
                gravar("dyspnea", ["nyha": nyha, "travesseiros": Int(travesseiros) ?? 0, "dispneia_paroxistica_noturna": dpn], nil, nota(intensidade), nil, emergencia: false)
            }.buttonStyle(BotaoCheioMais())
        } else {
            if tipo == "fatigue" {
                Text("De 0 (nada) a 10 (muito forte), quanto cansaço?")
                TextField("0 a 10", text: $intensidade).textFieldStyle(.roundedBorder)
            }
            if tipo == "dry_cough" {
                Text("Tosse seca pode ser efeito de um dos seus remédios — vale contar ao médico.")
            }
            Text("Quer contar mais alguma coisa?")
            TextField("", text: $notas).textFieldStyle(.roundedBorder)
            Button("Registrar") {
                gravar(tipo, [:], nil, tipo == "fatigue" ? nota(intensidade) : nil, notas, emergencia: false)
            }.buttonStyle(BotaoCheioMais())
        }
    }

    private func gravar(_ tipo: String, _ q: [String: Any], _ minutos: Int?, _ intensidade: Int?, _ notas: String?, emergencia: Bool) {
        if emergencia { self.emergencia = true }
        DispatchQueue.global(qos: .userInitiated).async {
            var o: [String: Any] = [
                "symptom_type": tipo,
                "occurred_at": ISO8601DateFormatter().string(from: Date()),
                "duration_minutes": minutos as Any? ?? NSNull(),
                "intensity": intensidade as Any? ?? NSNull(),
                "qualifiers": q,
                "notes": (notas?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? notas! : NSNull()) as Any,
            ]
            if emergencia { o["triaged_as"] = "emergency" }
            let erro = conta.gravarMais("symptom_reports", o, confirmar: emergencia)
            DispatchQueue.main.async {
                if emergencia {
                    if erro != nil { aviso = "Registrei no aparelho, mas não consegui enviar ao seu médico. Avise-o." }
                } else if let erro {
                    aviso = erro
                } else {
                    aviso = "Registrado. Seu médico consegue ver."
                    self.tipo = ""
                }
            }
        }
    }

    private func minutos(_ s: String) -> Int? { Int(s.trimmingCharacters(in: .whitespaces)) }
    private func nota(_ s: String) -> Int? {
        guard let n = Int(s.trimmingCharacters(in: .whitespaces)) else { return nil }
        return min(10, max(0, n))
    }
}

struct SonoTela: View {
    @ObservedObject var conta: Conta
    var voltar: () -> Void
    @State private var texto = "Carregando…"

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Sono").font(.custom("Sora", size: 26).weight(.semibold)).foregroundStyle(tintaMais)
            Text("O que a pulseira registrou à noite").foregroundStyle(secundariaMais)
            Text(texto).font(.system(size: 16))
            Button("Voltar", action: voltar).buttonStyle(BotaoContornoMais())
        }
        .onAppear(perform: carregar)
    }

    private func carregar() {
        DispatchQueue.global(qos: .userInitiated).async {
            let uid = conta.sessao("uid") ?? ""
            let noites = conta.listaMais("sleep_records?patient_user_id=eq.\(conta.enc(uid))&select=sleep_date,total_minutes,efficiency_pct,awakenings,min_heart_rate,min_spo2,deep_minutes,light_minutes,rem_minutes&order=sleep_date.desc&limit=14")
            let corpo: String
            if noites.isEmpty {
                corpo = "Sem dados de sono\nConecte sua pulseira para acompanhar o sono aqui."
            } else {
                let u = noites[0]
                var s = "Sua última noite\nTempo dormindo: \(Self.minutos(u["total_minutes"]))"
                s += "\nEficiência: \(u["efficiency_pct"].map { "\($0)%" } ?? "sem registro")"
                s += "\nDespertares: \(u["awakenings"].map { "\($0)" } ?? "sem registro")"
                s += "\nOxigenação mínima: \(u["min_spo2"].map { "\($0)%" } ?? "sem registro")"
                if noites.prefix(7).contains(where: { (($0["min_spo2"] as? NSNumber)?.intValue ?? 100) < 90 }) {
                    s = "Oxigenação caindo durante o sono\nSua oxigenação caiu várias vezes durante o sono. Comente com seu médico — pode valer investigar seu sono.\n\n" + s
                }
                corpo = s
            }
            DispatchQueue.main.async { texto = corpo }
        }
    }

    private static func minutos(_ v: Any?) -> String {
        guard let n = (v as? NSNumber)?.intValue else { return "sem registro" }
        let h = n / 60, m = n % 60
        return h > 0 ? "\(h) h \(String(format: "%02d", m)) min" : "\(m) min"
    }
}

struct AlimentacaoTela: View {
    @ObservedObject var conta: Conta
    var voltar: () -> Void
    @State private var texto = "Carregando…"
    private let opcoes: [(String, String, Int)] = [
        ("caseira_sem_sal", "Comida de casa, com pouco sal", 400),
        ("caseira_normal", "Comida de casa, sal normal", 900),
        ("restaurante", "Restaurante ou marmita", 1400),
        ("embutidos", "Pão com frios, queijo ou embutido", 1200),
        ("industrializado", "Congelado, enlatado ou macarrão instantâneo", 1600),
        ("fastfood", "Lanche de rua ou fast-food", 1800),
        ("leve", "Fruta, café, lanche leve", 120),
    ]
    private let refeicoes = [("cafe", "Café da manhã"), ("almoco", "Almoço"), ("lanche", "Lanche"), ("jantar", "Jantar")]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Alimentação").font(.custom("Sora", size: 26).weight(.semibold)).foregroundStyle(tintaMais)
            Text("Uma pergunta por refeição — sem tabela, sem contagem de calorias").foregroundStyle(secundariaMais)
            Text(texto).font(.system(size: 16))
            Text("O que você comeu hoje?").font(.system(size: 18, weight: .semibold))
            ForEach(refeicoes, id: \.0) { ref in
                Text(ref.1).font(.system(size: 16, weight: .semibold)).padding(.top, 8)
                ForEach(opcoes, id: \.0) { op in
                    Button(op.1) { escolher(ref.0, op.0, op.2) }.buttonStyle(BotaoContornoMais())
                }
            }
            Button("Voltar", action: voltar).buttonStyle(BotaoContornoMais())
        }
        .onAppear(perform: carregar)
    }

    private func carregar() {
        DispatchQueue.global(qos: .userInitiated).async {
            let uid = conta.sessao("uid") ?? ""
            let hoje = Conta.hojeUtc()
            var alvo = 2000
            if let linha = conta.listaMais("cardio_targets?patient_user_id=eq.\(conta.enc(uid))&select=sodium_mg_day&limit=1").first,
               let n = (linha["sodium_mg_day"] as? NSNumber)?.intValue { alvo = n }
            let regs = conta.listaMais("sodium_entries?patient_user_id=eq.\(conta.enc(uid))&dia=gte.\(hoje)&select=dia,sodio_mg")
            let total = regs.filter { ($0["dia"] as? String) == hoje }.reduce(0) { $0 + (($1["sodio_mg"] as? NSNumber)?.intValue ?? 0) }
            let frase = total == 0 ? "Nenhuma refeição registrada hoje."
                : total <= alvo ? "Cerca de \(total) mg de sódio hoje — dentro da referência de \(alvo) mg."
                : "Cerca de \(total) mg de sódio hoje, acima da referência de \(alvo) mg. A maior parte costuma vir de industrializados, não do saleiro."
            DispatchQueue.main.async { texto = "Hoje\n" + frase }
        }
    }

    private func escolher(_ refeicao: String, _ opcao: String, _ mg: Int) {
        DispatchQueue.global(qos: .userInitiated).async {
            let erro = conta.gravarMais("sodium_entries?on_conflict=patient_user_id,dia,refeicao", [
                "dia": Conta.hojeUtc(), "refeicao": refeicao, "opcao": opcao, "sodio_mg": mg,
            ], confirmar: true)
            DispatchQueue.main.async {
                if let erro { texto = erro == "Não consegui gravar agora." ? "O registro de sal não foi gravado. Tente de novo." : erro }
                else { carregar() }
            }
        }
    }
}

struct CaminhadaTela: View {
    @ObservedObject var conta: Conta
    var bpm: Int?
    var voltar: () -> Void
    @State private var fase = "pre"
    @State private var segundos = 0
    @State private var naZona = 0
    @State private var restante = 0
    @State private var contagem = 0
    @State private var metros = ""
    @State private var pico = ""
    @State private var fimFc = ""
    @State private var aviso = ""
    @State private var zonaMin: Int?
    @State private var zonaMax: Int?
    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Caminhada").font(.custom("Sora", size: 26).weight(.semibold)).foregroundStyle(tintaMais)
            Text("Sessão guiada e testes de capacidade").foregroundStyle(secundariaMais)
            if let zonaMin, let zonaMax {
                Text("Faixa definida pelo seu médico: \(zonaMin) a \(zonaMax) batimentos por minuto.")
            } else {
                Text("Seu médico ainda não definiu uma faixa de batimentos para os seus exercícios. Enquanto isso a caminhada fica livre: o app mostra seus batimentos, sem faixa-alvo.").foregroundStyle(avisoMais)
            }
            Text("Pare a caminhada e procure atendimento se sentir\nDor ou aperto no peito\nFalta de ar que não passa ao diminuir o passo\nTontura, enjoo ou vontade de desmaiar\nBatimentos irregulares que você sente\nDor em uma das pernas que aperta ao andar\nSuor frio")
            Text("Pulseira: \(bpm.map(String.init) ?? "—") bpm")
            Text(textoZona)
            if fase == "ativa" || fase == "pausada" {
                Text(String(format: "%02d:%02d", segundos / 60, segundos % 60)).font(.system(size: 36, weight: .bold))
                Button(fase == "ativa" ? "Pausar" : "Continuar") { fase = fase == "ativa" ? "pausada" : "ativa" }.buttonStyle(BotaoContornoMais())
                Button("Encerrar") { fase = "fim" }.buttonStyle(BotaoCheioMais())
            } else if fase == "fim" {
                Button("Salvar caminhada") { salvar() }.buttonStyle(BotaoCheioMais())
            } else if fase == "pre" {
                Button("Começar a caminhar") { segundos = 0; naZona = 0; fase = "ativa" }.buttonStyle(BotaoCheioMais())
                Button("Caminhada de 6 minutos") { fase = "seis"; restante = 360 }.buttonStyle(BotaoContornoMais())
                Button("Sentar e levantar") { fase = "sentar"; restante = 30; contagem = 0 }.buttonStyle(BotaoContornoMais())
                Button("Recuperação dos batimentos") { fase = "recupera" }.buttonStyle(BotaoContornoMais())
            } else if fase == "seis" || fase == "sentar" {
                Text("\(restante)s").font(.system(size: 36, weight: .bold))
                if fase == "sentar" {
                    Text("\(contagem)").font(.system(size: 36, weight: .bold))
                    Button("+ 1 (levantei)") { contagem += 1 }.buttonStyle(BotaoCheioMais())
                }
            } else if fase == "seis-medir" {
                Text("Quantos metros você andou?")
                Text("Não sabe o exato? Conte os passos e multiplique por cerca de 0,7 metro, ou use o mapa do celular.").foregroundStyle(secundariaMais)
                TextField("ex.: 420", text: $metros).textFieldStyle(.roundedBorder)
                Text("Feito em casa, esse teste é uma estimativa e não substitui o teste no consultório.").foregroundStyle(secundariaMais)
                Button("Salvar resultado") { salvarTeste("walk_6min", Int(metros) ?? 0, nil, nil) }.buttonStyle(BotaoCheioMais())
            } else if fase == "sentar-fim" {
                Text("Você fez \(contagem) repetições.")
                Button("Salvar resultado") { salvarTeste("sit_to_stand_30s", contagem, nil, nil) }.buttonStyle(BotaoCheioMais())
            } else if fase == "recupera" {
                Text("Logo depois de fazer algum esforço (a própria caminhada guiada serve), registre seus batimentos.")
                TextField("ex.: 128", text: $pico).textFieldStyle(.roundedBorder)
                if bpm != nil { Button("Usar pulseira") { pico = String(bpm!) }.buttonStyle(BotaoContornoMais()) }
                Button("Começar a contar 1 minuto") { restante = 60; fase = "recupera-espera" }.buttonStyle(BotaoCheioMais())
            } else if fase == "recupera-espera" {
                Text("\(restante)s").font(.system(size: 36, weight: .bold))
                Text("fique parado, sem se esforçar")
            } else if fase == "recupera-fim" {
                Text("Agora registre seus batimentos de novo.")
                TextField("ex.: 104", text: $fimFc).textFieldStyle(.roundedBorder)
                if bpm != nil { Button("Usar pulseira") { fimFc = String(bpm!) }.buttonStyle(BotaoContornoMais()) }
                Button("Salvar resultado") {
                    let a = Int(pico) ?? 0, b = Int(fimFc) ?? 0
                    if a > 0 && b > 0 { salvarTeste("hr_recovery", a - b, a, b) }
                }.buttonStyle(BotaoCheioMais())
            }
            if !aviso.isEmpty { Text(aviso).foregroundStyle(avisoMais) }
            Button("Voltar") { if fase == "pre" { voltar() } else { fase = "pre" } }.buttonStyle(BotaoContornoMais())
        }
        .onAppear(perform: zona)
        .onReceive(timer) { _ in
            if fase == "ativa" {
                segundos += 1
                if let bpm, let zonaMin, let zonaMax, bpm >= zonaMin, bpm <= zonaMax { naZona += 1 }
            } else if fase == "seis" || fase == "sentar" || fase == "recupera-espera" {
                restante -= 1
                if restante <= 0 {
                    if fase == "seis" { fase = "seis-medir" }
                    else if fase == "sentar" { fase = "sentar-fim" }
                    else { fase = "recupera-fim" }
                }
            }
        }
    }

    private var textoZona: String {
        guard let bpm, let zonaMin, let zonaMax else { return "Caminhada livre — sem faixa definida." }
        if bpm < zonaMin { return "Você pode acelerar um pouco o passo, se estiver confortável." }
        if bpm > zonaMax { return "Está acima da faixa definida pelo seu médico. Diminua o passo." }
        return "Está na faixa que seu médico definiu."
    }

    private func zona() {
        DispatchQueue.global(qos: .userInitiated).async {
            let uid = conta.sessao("uid") ?? ""
            let linha = conta.listaMais("cardio_targets?patient_user_id=eq.\(conta.enc(uid))&select=training_hr_min,training_hr_max&limit=1").first
            DispatchQueue.main.async {
                zonaMin = (linha?["training_hr_min"] as? NSNumber)?.intValue
                zonaMax = (linha?["training_hr_max"] as? NSNumber)?.intValue
            }
        }
    }

    private func salvar() {
        let duracao = segundos
        let zonaSeg = naZona
        let media = bpm
        let zmin = zonaMin
        let zmax = zonaMax
        DispatchQueue.global(qos: .userInitiated).async {
            var o: [String: Any] = [
                "iniciada_em": ISO8601DateFormatter().string(from: Date().addingTimeInterval(TimeInterval(-duracao))),
                "duracao_segundos": duracao,
                "segundos_na_zona": zonaSeg,
                "fc_media": media as Any? ?? NSNull(),
                "interrompida": false,
            ]
            if let zmin { o["zona_min"] = zmin }
            if let zmax { o["zona_max"] = zmax }
            let erro = conta.gravarMais("walk_sessions", o, confirmar: false)
            DispatchQueue.main.async {
                aviso = erro == nil ? "Caminhada registrada." : "Não consegui salvar a caminhada."
                if erro == nil { fase = "pre" }
            }
        }
    }

    private func salvarTeste(_ tipo: String, _ valor: Int, _ pico: Int?, _ fim: Int?) {
        DispatchQueue.global(qos: .userInitiated).async {
            var o: [String: Any] = ["tipo": tipo, "valor": valor]
            if let pico { o["fc_pico"] = pico }
            if let fim { o["fc_final"] = fim }
            let erro = conta.gravarMais("capacity_tests", o, confirmar: false)
            DispatchQueue.main.async {
                aviso = erro == nil ? "Teste registrado." : "Não consegui salvar o teste."
                if erro == nil { fase = "pre" }
            }
        }
    }
}

private struct BotaoCheioMais: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.custom("Inter", size: 16).weight(.semibold)).foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Color(red: 0.110, green: 0.122, blue: 0.149))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
private struct BotaoContornoMais: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.custom("Inter", size: 16).weight(.semibold)).foregroundStyle(Color(red: 0.110, green: 0.122, blue: 0.149))
            .frame(maxWidth: .infinity, minHeight: 48).background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(red: 0.875, green: 0.886, blue: 0.906), lineWidth: 1))
    }
}
private let tintaMais = Color(red: 0.110, green: 0.122, blue: 0.149)
private let secundariaMais = Color(red: 0.376, green: 0.412, blue: 0.463)
private let avisoMais = Color(red: 0.490, green: 0.286, blue: 0.051)
