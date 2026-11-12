import Foundation

/// Hoje, evolução, registrar e o médico. As mesmas tabelas e as mesmas frases do site.
extension Conta {
    func carregarCasa() {
        fila.async {
            do {
                let token = try self.tokenValido()
                guard let uid = self.sessao("uid") else { return }
                let nome = Self.primeiroNome(self.um(token, "profiles?id=eq.\(self.enc(uid))&select=full_name"))
                var sys = 130
                var dia = 80
                if let alvo = self.um(token, "cardio_targets?patient_user_id=eq.\(self.enc(uid))&select=bp_systolic_max,bp_diastolic_max&limit=1") {
                    sys = (alvo["bp_systolic_max"] as? NSNumber)?.intValue ?? 130
                    dia = (alvo["bp_diastolic_max"] as? NSNumber)?.intValue ?? 80
                }
                var plano = self.lista(token, "monitoring_plan?patient_user_id=eq.\(self.enc(uid))&is_active=eq.true&select=metric,frequency,times_per_day")
                let prescrito = !plano.isEmpty
                if !prescrito {
                    plano = [
                        ["metric": "bp", "times_per_day": 2, "frequency": "daily"],
                        ["metric": "weight", "times_per_day": 1, "frequency": "daily"],
                        ["metric": "wellbeing", "times_per_day": 1, "frequency": "daily"],
                    ]
                }
                var total = 0
                var concluidas = 0
                var fora = 0
                var itens = ""
                for item in plano {
                    let freq = item["frequency"] as? String ?? "daily"
                    let dias = Self.janelaDias(freq)
                    if dias <= 0 { continue }
                    let metric = item["metric"] as? String ?? ""
                    let vezes = max(1, (item["times_per_day"] as? NSNumber)?.intValue ?? 1)
                    let esperados = freq == "twice_daily" ? max(2, vezes) : freq == "daily" ? max(1, vezes) : 1
                    let feitos = self.feitosHoje(token, uid, metric, dias)
                    if feitos < 0 { fora += 1; continue }
                    total += 1
                    if feitos >= esperados { concluidas += 1 }
                    itens += Self.rotulo(metric) + (feitos >= esperados ? " — feito\n" : " — falta\n")
                }
                var hoje = ""
                if total == 0 && fora > 0 {
                    hoje += "O plano do seu médico inclui registros que esta versão ainda não abre aqui.\n"
                } else if total == 0 {
                    hoje += "Nada combinado para hoje.\n"
                } else if concluidas >= total {
                    hoje += "Tudo registrado por hoje.\n"
                } else {
                    hoje += "Faltam \(total - concluidas) de \(total) registros de hoje.\n"
                }
                hoje += prescrito
                    ? "Este é o plano que seu médico definiu."
                    : "Sugestão do app — seu médico ainda não definiu um plano."
                if concluidas > 0 { hoje += " \(concluidas) já feito\(concluidas > 1 ? "s" : "")." }
                hoje += "\n" + itens + "\n" + self.ultimas(token, uid)
                let meta = self.textoEvolucao(token, uid, sys, dia)
                let medico = self.medico(token, uid)
                let msgs = self.mensagens(token, uid)
                let saudacao = Self.saudacao()
                let pessoa = nome.isEmpty ? saudacao : "\(saudacao), \(nome)"
                self.publicar(pessoa: pessoa, hoje: hoje.trimmingCharacters(in: .whitespacesAndNewlines), meta: meta, medico: medico.0, clinica: medico.1, msgs: msgs)
            } catch {
                self.publicar(pessoa: self.nomePessoa, hoje: "Não consegui carregar o seu dia. Tente de novo.", meta: self.textoMeta, medico: self.nomeMedico, clinica: self.clinicaMedico, msgs: self.textoMensagens)
            }
        }
    }

    func registrarMedida(tipo: String, a: String, b: String, c: String, nota: Int?) -> String? {
        do {
            let token = try tokenValido()
            guard let uid = sessao("uid") else { return "Entre na sua conta antes de registrar." }
            var o: [String: Any] = ["patient_user_id": uid]
            let tabela: String
            if tipo == "bp" {
                let sis = Int(a.trimmingCharacters(in: .whitespaces)) ?? 0
                let dia = Int(b.trimmingCharacters(in: .whitespaces)) ?? 0
                if sis <= 0 || dia <= 0 { return "Preencha os dois números da pressão." }
                let h = Calendar.current.component(.hour, from: Date())
                o["systolic"] = sis
                o["diastolic"] = dia
                if let pulso = Int(c.trimmingCharacters(in: .whitespaces)), pulso > 0 { o["pulse"] = pulso }
                o["context"] = h < 12 ? "morning" : h >= 17 ? "evening" : "random"
                o["cuff_validated"] = true
                tabela = "bp_readings"
            } else if tipo == "weight" {
                let v = Double(a.replacingOccurrences(of: ",", with: ".")) ?? 0
                if v <= 0 { return "Digite seu peso." }
                o["value"] = v
                tabela = "weight_readings"
            } else if tipo == "hr" {
                let v = Int(a.trimmingCharacters(in: .whitespaces)) ?? 0
                if v <= 0 { return "Digite os batimentos." }
                o["bpm"] = v
                o["context"] = "resting"
                tabela = "hr_readings"
            } else if tipo == "spo2" {
                let v = Int(a.trimmingCharacters(in: .whitespaces)) ?? 0
                if v <= 0 { return "Digite a oxigenação." }
                o["value"] = v
                o["context"] = "spot"
                tabela = "spo2_readings"
            } else if tipo == "glucose" {
                let v = Int(a.trimmingCharacters(in: .whitespaces)) ?? 0
                if v <= 0 { return "Digite a glicemia." }
                o["value"] = v
                o["context"] = "random"
                tabela = "glucose_readings"
            } else if tipo == "wellbeing" {
                guard let nota else { return "Escolha um número de 0 a 10." }
                o["desfecho"] = "registrar"
                o["alarmes"] = [String]()
                o["como_se_sente"] = nota
                o["espelho"] = [String: String]()
                tabela = "wellbeing_checkins"
            } else {
                return "Esse registro ainda não está nesta tela."
            }
            let corpo = try JSONSerialization.data(withJSONObject: o)
            let r = try pedir(metodo: "POST", url: Self.urlBase + "/rest/v1/" + tabela, corpo: corpo, token: token, prefer: "return=minimal", faixa: nil)
            if r.codigo < 200 || r.codigo >= 300 {
                let cru = texto(r.dados)
                return cru.isEmpty ? "Não consegui registrar agora." : cru
            }
            return nil
        } catch {
            return "Não consegui registrar agora."
        }
    }

    func enviarMensagem(_ corpo: String) -> String? {
        let t = corpo.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return "Escreva uma mensagem." }
        do {
            let token = try tokenValido()
            guard let uid = sessao("uid") else { return "Entre na sua conta antes de escrever." }
            let o: [String: Any] = ["patient_user_id": uid, "sender_user_id": uid, "sender": "patient", "body": t]
            let dados = try JSONSerialization.data(withJSONObject: o)
            let r = try pedir(metodo: "POST", url: Self.urlBase + "/rest/v1/patient_messages", corpo: dados, token: token, prefer: "return=minimal", faixa: nil)
            if r.codigo < 200 || r.codigo >= 300 { return "Não consegui enviar a mensagem." }
            marcarLidas(token, uid)
            return nil
        } catch {
            return "Não consegui enviar a mensagem."
        }
    }

    private func publicar(pessoa: String, hoje: String, meta: String, medico: String, clinica: String, msgs: String) {
        DispatchQueue.main.async {
            self.nomePessoa = pessoa
            self.textoHoje = hoje
            self.textoMeta = meta
            self.nomeMedico = medico
            self.clinicaMedico = clinica
            self.textoMensagens = msgs
        }
    }

    private func feitosHoje(_ token: String, _ uid: String, _ metric: String, _ dias: Int) -> Int {
        let tabela: String
        let campo: String
        switch metric {
        case "bp": tabela = "bp_readings"; campo = "recorded_at"
        case "weight": tabela = "weight_readings"; campo = "recorded_at"
        case "hr": tabela = "hr_readings"; campo = "recorded_at"
        case "spo2": tabela = "spo2_readings"; campo = "recorded_at"
        case "glucose": tabela = "glucose_readings"; campo = "recorded_at"
        case "wellbeing": tabela = "wellbeing_checkins"; campo = "ocorrido_em"
        case "sleep": tabela = "sleep_records"; campo = "sleep_date"
        case "steps": tabela = "activity_records"; campo = "activity_date"
        default: return -1
        }
        let desde = Calendar.current.date(byAdding: .day, value: -(max(0, dias - 1)), to: Date()) ?? Date()
        let porData = metric == "sleep" || metric == "steps"
        let corte: String
        if porData {
            let f = DateFormatter()
            f.calendar = Calendar(identifier: .gregorian)
            f.locale = Locale(identifier: "en_US_POSIX")
            f.timeZone = TimeZone.current
            f.dateFormat = "yyyy-MM-dd"
            corte = f.string(from: desde)
        } else {
            let inicio = Calendar.current.startOfDay(for: desde)
            corte = ISO8601DateFormatter().string(from: inicio)
        }
        return lista(token, "\(tabela)?patient_user_id=eq.\(enc(uid))&\(campo)=gte.\(enc(corte))&select=id&limit=40").count
    }

    private func ultimas(_ token: String, _ uid: String) -> String {
        let bp = um(token, "bp_readings?patient_user_id=eq.\(enc(uid))&select=systolic,diastolic&order=recorded_at.desc&limit=1")
        let peso = um(token, "weight_readings?patient_user_id=eq.\(enc(uid))&select=value&order=recorded_at.desc&limit=1")
        let fc = um(token, "hr_readings?patient_user_id=eq.\(enc(uid))&select=bpm&order=recorded_at.desc&limit=1")
        let p = bp == nil ? "Pressão: ainda não recebi" : "Pressão: \((bp?["systolic"] as? NSNumber)?.intValue ?? 0)/\((bp?["diastolic"] as? NSNumber)?.intValue ?? 0)"
        let w = peso == nil ? "Peso: ainda não recebi" : "Peso: \(peso?["value"] ?? "") kg"
        let h = fc == nil ? "Batimentos: ainda não recebi" : "Batimentos: \((fc?["bpm"] as? NSNumber)?.intValue ?? 0)"
        return "Últimos registros\n\(p)\n\(w)\n\(h)"
    }

    private func textoEvolucao(_ token: String, _ uid: String, _ sys: Int, _ diaAlvo: Int) -> String {
        var s = textoMeta(token, uid, sys, diaAlvo)
        s += "\n\nCapacidade\n"
        let testes = lista(token, "capacity_tests?patient_user_id=eq.\(enc(uid))&select=tipo,valor,realizado_em&order=realizado_em.desc&limit=40")
        s += Self.capacidade(testes, "walk_6min", "Caminhada de 6 minutos", "m", "metros", "caminhada de 6 minutos")
        s += Self.capacidade(testes, "sit_to_stand_30s", "Sentar e levantar", "rep.", "repetições", "sentar e levantar")
        s += Self.capacidade(testes, "hr_recovery", "Recuperação dos batimentos", "bpm", "bpm", "recuperação dos batimentos")
        s += "\nIdade do coração\n" + textoIdade(token, uid)
        return s
    }

    private func textoMeta(_ token: String, _ uid: String, _ sys: Int, _ diaAlvo: Int) -> String {
        let desde = ISO8601DateFormatter().string(from: Date().addingTimeInterval(-60 * 86_400))
        let lista = self.lista(token, "bp_readings?patient_user_id=eq.\(enc(uid))&recorded_at=gte.\(enc(desde))&select=systolic,diastolic,recorded_at,cuff_validated,validation_status&order=recorded_at.desc&limit=400")
        let agora = Date()
        var dentro = 0
        var total = 0
        var dentroAntes = 0
        var totalAntes = 0
        for r in lista {
            let cuff = (r["cuff_validated"] as? NSNumber)?.boolValue ?? false
            if !cuff || (r["validation_status"] as? String) != "validated" { continue }
            guard let t = Self.instante(r["recorded_at"] as? String ?? "") else { continue }
            let sis = (r["systolic"] as? NSNumber)?.intValue ?? 0
            let dia = (r["diastolic"] as? NSNumber)?.intValue ?? 0
            let noAlvo = sis <= sys && dia <= diaAlvo
            if t > agora.addingTimeInterval(-30 * 86_400) && t <= agora {
                total += 1
                if noAlvo { dentro += 1 }
            } else if t > agora.addingTimeInterval(-60 * 86_400) && t <= agora.addingTimeInterval(-30 * 86_400) {
                totalAntes += 1
                if noAlvo { dentroAntes += 1 }
            }
        }
        let titulo = "Medidas de pressão dentro da meta\n"
        if total < 5 {
            return titulo + "Medidas insuficientes\nVocê tem \(total) medida\(total == 1 ? "" : "s") com aparelho de braço nos últimos 30 dias. A partir de 5 medidas o app mostra o seu percentual."
        }
        let pct = Int((Double(dentro) * 100 / Double(total)).rounded())
        let base = pct >= 50
            ? "\(pct)% das suas \(total) medidas nos últimos 30 dias ficaram dentro da meta."
            : "\(pct)% das suas \(total) medidas nos últimos 30 dias ficaram dentro da meta — a maior parte ficou acima."
        var frase = base
        if totalAntes >= 5 {
            let antes = Int((Double(dentroAntes) * 100 / Double(totalAntes)).rounded())
            let variacao = pct - antes
            if variacao >= 5 { frase = base + " São \(variacao) pontos a mais que no período anterior." }
            else if variacao <= -5 { frase = base + " São \(abs(variacao)) pontos a menos que no período anterior." }
            else { frase = base + " Praticamente igual ao período anterior." }
        }
        return titulo + "\(pct)%\n\(dentro) de \(total) medidas · nos últimos 30 dias\n" + frase
    }

    private func textoIdade(_ token: String, _ uid: String) -> String {
        let p = um(token, "cardio_patients?user_id=eq.\(enc(uid))&select=birth_date,sex,smoking_status,comorbidities,history&limit=1")
        if let motivo = Idade.motivo(p) { return motivo }
        guard let p else { return "Cadastro incompleto." }
        let labs = lista(token, "lab_results?patient_user_id=eq.\(enc(uid))&select=marker_key,value_num&order=collected_at.desc&limit=200")
        var ct: Double?
        var hdl: Double?
        for lab in labs {
            let chave = lab["marker_key"] as? String
            let valor = (lab["value_num"] as? NSNumber)?.doubleValue
            if ct == nil && chave == "total_cholesterol" { ct = valor }
            if hdl == nil && chave == "hdl" { hdl = valor }
        }
        let pressoes = lista(token, "bp_readings?patient_user_id=eq.\(enc(uid))&select=systolic,cuff_validated,validation_status&order=recorded_at.desc&limit=40")
        var n = 0
        var soma = 0
        for r in pressoes where n < 10 {
            let cuff = (r["cuff_validated"] as? NSNumber)?.boolValue ?? false
            if !cuff || (r["validation_status"] as? String) != "validated" { continue }
            soma += (r["systolic"] as? NSNumber)?.intValue ?? 0
            n += 1
        }
        var faltas: [String] = []
        if ct == nil { faltas.append("colesterol total") }
        if hdl == nil { faltas.append("HDL") }
        if n == 0 { faltas.append("uma medida de pressão com aparelho de braço") }
        if !faltas.isEmpty {
            return "Ainda falta um dado para calcular\nPara mostrar a idade do seu coração, precisamos de: \(faltas.joined(separator: ", "))."
        }
        let idade = Idade.anos(p["birth_date"] as? String ?? "")
        guard let ct, let hdl, let r = Idade.calcular(idade: idade, sexo: p["sex"] as? String ?? "", colesterol: ct, hdl: hdl, sistolica: Int((Double(soma) / Double(n)).rounded()), tratado: true, fumante: (p["smoking_status"] as? String) == "current", diabetes: ((p["comorbidities"] as? [String: Any])?["diabetes"] as? NSNumber)?.boolValue ?? false) else {
            return "Ainda falta um dado para calcular"
        }
        let teto = r.noTeto ? "mais de " : ""
        let mais = r.noTeto ? "+" : ""
        let explicacao: String
        if r.diferenca > 0 {
            explicacao = "É uma estimativa de risco traduzida em anos: pessoas com os seus fatores de risco costumam ter o risco de quem tem \(teto)\(r.idadeDoCoracao) anos."
        } else if r.diferenca == 0 {
            explicacao = "É uma estimativa de risco traduzida em anos — e a sua está igual à sua idade real."
        } else {
            explicacao = "É uma estimativa de risco traduzida em anos — a sua está \(abs(r.diferenca)) anos abaixo da sua idade real."
        }
        return "\(r.idadeDoCoracao)\(mais) anos\nSua idade: \(r.idadeReal) anos\n\(explicacao)\nÉ um cálculo populacional a partir dos seus fatores de risco, não uma medida direta do seu coração. Ele se move quando os fatores abaixo se movem."
    }

    private func medico(_ token: String, _ uid: String) -> (String, String) {
        let links = lista(token, "professional_patient_links?patient_user_id=eq.\(enc(uid))&status=eq.active&select=professional_id&limit=1")
        guard let id = links.first?["professional_id"] as? String else { return ("Meu médico", "") }
        guard let p = um(token, "professional_profiles?id=eq.\(enc(id))&select=display_name,clinic_name") else { return ("Seu médico", "") }
        let nome = (p["display_name"] as? String) ?? ""
        return (nome.isEmpty ? "Seu médico" : nome, (p["clinic_name"] as? String) ?? "")
    }

    private func mensagens(_ token: String, _ uid: String) -> String {
        marcarLidas(token, uid)
        let lista = self.lista(token, "patient_messages?patient_user_id=eq.\(enc(uid))&select=sender,body,created_at&order=created_at.asc&limit=300")
        if lista.isEmpty { return "Nenhuma mensagem ainda. Escreva para o seu médico abaixo." }
        return lista.map { m in
            let minha = (m["sender"] as? String) == "patient"
            let hora = Self.hora(m["created_at"] as? String ?? "")
            return (minha ? "Você" : "Médico") + " · " + hora + "\n" + ((m["body"] as? String) ?? "")
        }.joined(separator: "\n\n")
    }

    private func marcarLidas(_ token: String, _ uid: String) {
        let corpo = try? JSONSerialization.data(withJSONObject: ["read_at": ISO8601DateFormatter().string(from: Date())])
        _ = try? pedir(metodo: "PATCH", url: Self.urlBase + "/rest/v1/patient_messages?patient_user_id=eq.\(enc(uid))&sender=eq.doctor&read_at=is.null", corpo: corpo, token: token, prefer: "return=minimal", faixa: nil)
    }

    private func um(_ token: String, _ caminho: String) -> [String: Any]? {
        lista(token, caminho).first
    }

    private func lista(_ token: String, _ caminho: String) -> [[String: Any]] {
        guard let r = try? pedir(metodo: "GET", url: Self.urlBase + "/rest/v1/" + caminho, corpo: nil, token: token, prefer: nil, faixa: nil),
              r.codigo >= 200, r.codigo < 300,
              let json = try? JSONSerialization.jsonObject(with: r.dados) as? [[String: Any]] else { return [] }
        return json
    }

    private static func primeiroNome(_ perfil: [String: Any]?) -> String {
        let nome = (perfil?["full_name"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
        return nome.split(separator: " ").first.map(String.init) ?? ""
    }

    private static func janelaDias(_ freq: String) -> Int {
        switch freq {
        case "weekly": return 7
        case "biweekly": return 15
        case "monthly": return 30
        case "as_needed": return 0
        default: return 1
        }
    }

    private static func rotulo(_ metric: String) -> String {
        switch metric {
        case "bp": return "Pressão"
        case "weight": return "Peso"
        case "hr": return "Batimentos"
        case "spo2": return "Oxigenação"
        case "glucose": return "Glicemia"
        case "steps": return "Passos"
        case "sleep": return "Sono"
        case "wellbeing": return "Como me sinto"
        default: return metric
        }
    }

    private static func saudacao() -> String {
        let h = Calendar.current.component(.hour, from: Date())
        if h < 12 { return "Bom dia" }
        if h < 18 { return "Boa tarde" }
        return "Boa noite"
    }

    private static func hora(_ iso: String) -> String {
        guard let d = instante(iso) else { return "" }
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: d)
    }

    private static func instante(_ iso: String) -> Date? {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: iso) { return d }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: iso)
    }

    private static func capacidade(_ testes: [[String: Any]], _ tipo: String, _ titulo: String, _ curta: String, _ unidade: String, _ nome: String) -> String {
        var atual: Double?
        var anterior: Double?
        for t in testes where (t["tipo"] as? String) == tipo {
            let v = (t["valor"] as? NSNumber)?.doubleValue ?? 0
            if atual == nil { atual = v }
            else if anterior == nil { anterior = v; break }
        }
        guard let atual else {
            return "\(titulo)\n—\nVocê ainda não fez o teste de \(nome).\n"
        }
        let numero = Self.valor(atual) + " " + curta
        let frase: String
        if let anterior {
            let variacao = atual - anterior
            let pct = Int((variacao / anterior * 100).rounded())
            if variacao > 0 { frase = "Você melhorou \(Self.valor(variacao)) \(unidade) desde o teste anterior (\(pct > 0 ? "+" : "")\(pct)%)." }
            else if variacao < 0 { frase = "Desta vez foram \(Self.valor(abs(variacao))) \(unidade) a menos que no teste anterior. Um único teste varia bastante — o que conta é a linha ao longo dos meses." }
            else { frase = "Mesmo resultado do teste anterior: \(Self.valor(atual)) \(unidade)." }
        } else {
            frase = "Primeiro registro: \(Self.valor(atual)) \(unidade). Refaça em 4 a 8 semanas para ver a evolução."
        }
        return "\(titulo)\n\(numero)\n\(frase)\n"
    }

    private static func valor(_ v: Double) -> String {
        if abs(v - v.rounded()) < 0.05 { return String(Int(v.rounded())) }
        return String(format: "%.1f", v)
    }
}

enum Idade {
    struct Resultado {
        let idadeReal: Int
        let idadeDoCoracao: Int
        let diferenca: Int
        let noTeto: Bool
    }

    static func motivo(_ p: [String: Any]?) -> String? {
        guard let p else { return "Cadastro incompleto." }
        let h = p["history"] as? [String: Any] ?? [:]
        if verdade(h["previous_mi"]) || verdade(h["stroke_tia"]) || verdade(h["heart_failure"]) || verdade(h["pci"]) || verdade(h["cabg"]) || verdade(h["pad"]) {
            return "Você já tem um diagnóstico cardiológico estabelecido. Neste caso a Idade do Coração não é a melhor medida — o que conta é o seu Tempo no Alvo e a sua Capacidade."
        }
        let idade = anos(p["birth_date"] as? String ?? "")
        if idade < 30 || idade > 79 { return "A estimativa é validada para idades entre 30 e 79 anos." }
        let sexo = p["sex"] as? String ?? ""
        if sexo != "male" && sexo != "female" { return "Falta o sexo biológico no seu cadastro." }
        return nil
    }

    static func anos(_ nascimento: String) -> Int {
        let partes = nascimento.prefix(10).split(separator: "-")
        guard partes.count == 3, let ano = Int(partes[0]), let mes = Int(partes[1]), let dia = Int(partes[2]) else { return -1 }
        let hoje = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        var idade = (hoje.year ?? 0) - ano
        if (hoje.month ?? 0) < mes || ((hoje.month ?? 0) == mes && (hoje.day ?? 0) < dia) { idade -= 1 }
        return idade
    }

    static func risco(idade: Double, homem: Bool, colesterol: Double, hdl: Double, sistolica: Double, tratado: Bool, fumante: Bool, diabetes: Bool) -> Double? {
        if idade < 30 || idade > 79 || colesterol <= 0 || hdl <= 0 || sistolica <= 0 { return nil }
        let age = homem ? 3.06117 : 2.32888
        let chol = homem ? 1.1237 : 1.20904
        let h = homem ? -0.93263 : -0.70833
        let sbpT = homem ? 1.99881 : 2.82263
        let sbpU = homem ? 1.93303 : 2.76157
        let smoke = homem ? 0.65451 : 0.52873
        let dm = homem ? 0.57367 : 0.69154
        let mean = homem ? 23.9802 : 26.1931
        let s0 = homem ? 0.88936 : 0.95012
        let sum = age * log(idade) + chol * log(colesterol) + h * log(hdl) + (tratado ? sbpT : sbpU) * log(sistolica) + (fumante ? smoke : 0) + (diabetes ? dm : 0)
        let risco = (1 - pow(s0, exp(sum - mean))) * 100
        return (max(0, min(100, risco)) * 10).rounded() / 10
    }

    static func calcular(idade: Int, sexo: String, colesterol: Double, hdl: Double, sistolica: Int, tratado: Bool, fumante: Bool, diabetes: Bool) -> Resultado? {
        let homem = sexo == "male"
        guard let atual = risco(idade: Double(idade), homem: homem, colesterol: colesterol, hdl: hdl, sistolica: Double(sistolica), tratado: tratado, fumante: fumante, diabetes: diabetes) else { return nil }
        let eq = equivalente(atual, homem)
        return Resultado(idadeReal: idade, idadeDoCoracao: eq, diferenca: eq - idade, noTeto: eq >= 85)
    }

    private static func equivalente(_ riscoAtual: Double, _ homem: Bool) -> Int {
        var melhor = 30.0
        var menor = Double.infinity
        var idade = 30.0
        while idade <= 85 {
            if let ref = risco(idade: min(idade, 79), homem: homem, colesterol: 180, hdl: 45, sistolica: 125, tratado: false, fumante: false, diabetes: false) {
                let ajustado = idade > 79 ? ref * (1 + (idade - 79) * 0.06) : ref
                let d = abs(ajustado - riscoAtual)
                if d < menor { menor = d; melhor = idade }
            }
            idade += 0.5
        }
        return Int(melhor.rounded())
    }

    private static func verdade(_ v: Any?) -> Bool {
        (v as? NSNumber)?.boolValue ?? (v as? Bool ?? false)
    }
}
