import Foundation

/// A mesma conta do site: login de `AuthPage` e gravação de `useWearableSync`
/// em `registered_devices` e `hr_readings`. A chave é a publishable de
/// `src/lib/config.ts`, não a service_role.
final class Conta: ObservableObject {
    static let urlBase = "https://rmodoqflmabzfsqieiln.supabase.co"
    static let chave = "sb_publishable_47xoBuULGGAehheD2sAZ0w_KBqb_vMh"
    static let intervalo: TimeInterval = 60

    @Published var logada = false
    @Published var email = ""
    @Published var gravadas = 0
    @Published var ultimaIso: String?
    @Published var erroEnvio: String?
    @Published var temMedico = false
    @Published var medicoConhecido = false
    @Published var batimentos = 0
    @Published var oxigenacao = 0
    @Published var pressao = 0
    @Published var passos = 0
    @Published var sono = 0
    @Published var aguardandoSenha = false
    @Published var nomePessoa = ""
    @Published var textoHoje = ""
    @Published var textoMeta = ""
    @Published var nomeMedico = "Meu médico"
    @Published var clinicaMedico = ""
    @Published var textoMensagens = ""

    static let linkAuth = "encorpei://auth"
    static let linkSenha = "encorpei://reset-password"
    private var recuperacaoAccess: String?
    private var recuperacaoRefresh: String?

    private let trava = NSLock()
    private var ultimaTentativa: TimeInterval = 0
    private var anterior: TimeInterval = 0
    private var deviceId: String?
    private var deviceNome: String?
    let fila = DispatchQueue(label: "encorpei.conta")

    init() {
        logada = sessao("access") != nil && sessao("uid") != nil
        email = sessao("email") ?? ""
    }

    func reiniciarSessao() {
        trava.lock()
        ultimaTentativa = 0
        anterior = 0
        deviceId = nil
        deviceNome = nil
        trava.unlock()
        DispatchQueue.main.async {
            self.gravadas = 0
            self.erroEnvio = nil
        }
    }

    /// nil se entrou; senão a frase da tela de login.
    func entrar(email: String, senha: String) -> String? {
        let e = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if e.isEmpty || senha.isEmpty { return "Preencha e-mail e senha." }
        do {
            let corpo = try JSONSerialization.data(withJSONObject: ["email": e, "password": senha])
            let r = try pedir(metodo: "POST", url: Self.urlBase + "/auth/v1/token?grant_type=password", corpo: corpo, token: nil, prefer: nil, faixa: nil)
            if r.codigo < 200 || r.codigo >= 300 {
                let msg = texto(r.dados).lowercased()
                if msg.contains("email not confirmed") || msg.contains("email_not_confirmed") {
                    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada (e a pasta de spam)."
                }
                return "E-mail ou senha incorretos. Verifique e tente de novo."
            }
            let json = try JSONSerialization.jsonObject(with: r.dados) as? [String: Any] ?? [:]
            guard let access = json["access_token"] as? String,
                  let user = json["user"] as? [String: Any],
                  let uid = user["id"] as? String else {
                return "Não foi possível confirmar seu acesso agora. Tente de novo."
            }
            let refresh = json["refresh_token"] as? String ?? ""
            let expira = (json["expires_in"] as? NSNumber)?.doubleValue ?? 3600
            if try eProfissional(access: access, uid: uid) {
                _ = try? pedir(metodo: "POST", url: Self.urlBase + "/auth/v1/logout", corpo: Data("{}".utf8), token: access, prefer: nil, faixa: nil)
                return "Este e-mail está cadastrado como médico. Entre pelo portal do médico."
            }
            guardar("access", access)
            guardar("refresh", refresh)
            guardar("uid", uid)
            guardar("email", e)
            UserDefaults.standard.set(Date().timeIntervalSince1970 + expira, forKey: "encorpei_exp")
            DispatchQueue.main.async {
                self.email = e
                self.logada = true
                self.erroEnvio = nil
            }
            return nil
        } catch {
            return "Não foi possível confirmar seu acesso agora. Tente de novo."
        }
    }

    func sair() {
        let access = sessao("access")
        for k in ["access", "refresh", "uid", "email"] { UserDefaults.standard.removeObject(forKey: "encorpei_" + k) }
        UserDefaults.standard.removeObject(forKey: "encorpei_exp")
        trava.lock()
        deviceId = nil
        deviceNome = nil
        ultimaTentativa = 0
        trava.unlock()
        DispatchQueue.main.async {
            self.logada = false
            self.email = ""
            self.gravadas = 0
            self.ultimaIso = nil
            self.erroEnvio = nil
            self.temMedico = false
            self.medicoConhecido = false
            self.batimentos = 0
            self.oxigenacao = 0
            self.pressao = 0
            self.passos = 0
            self.sono = 0
        }
        guard let access else { return }
        fila.async {
            _ = try? self.pedir(metodo: "POST", url: Self.urlBase + "/auth/v1/logout", corpo: Data("{}".utf8), token: access, prefer: nil, faixa: nil)
        }
    }

    @discardableResult
    func gravar(nome: String?, bpm: Int, contato: Bool?, rmssd: Double?, sdnn: Double?, forcar: Bool) -> Bool {
        guard sessao("access") != nil else { return false }
        let aparelho = (nome ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? "Pulseira" : nome!.trimmingCharacters(in: .whitespacesAndNewlines)
        let agora = Date().timeIntervalSince1970
        trava.lock()
        let cedo = !forcar && agora - ultimaTentativa < Self.intervalo
        if cedo {
            trava.unlock()
            return false
        }
        let volta = ultimaTentativa
        ultimaTentativa = agora
        trava.unlock()
        let quando = iso(Date(timeIntervalSince1970: agora))
        do {
            var token = try tokenValido()
            guard let uid = sessao("uid") else { throw URLError(.userAuthenticationRequired) }
            let id = try garantirDispositivo(token: token, uid: uid, nome: aparelho)
            let corpo = jsonLinha(uid: uid, deviceId: id, nome: aparelho, bpm: bpm, contato: contato, at: quando, rmssd: rmssd, sdnn: sdnn)
            var r = try pedir(metodo: "POST", url: Self.urlBase + "/rest/v1/hr_readings", corpo: corpo, token: token, prefer: "return=minimal", faixa: nil)
            if r.codigo == 401 {
                token = try renovar()
                r = try pedir(metodo: "POST", url: Self.urlBase + "/rest/v1/hr_readings", corpo: corpo, token: token, prefer: "return=minimal", faixa: nil)
            }
            if r.codigo < 200 || r.codigo >= 300 { throw URLError(.badServerResponse) }
            if let id {
                let patch = try JSONSerialization.data(withJSONObject: ["last_sync_at": quando])
                _ = try? pedir(metodo: "PATCH", url: Self.urlBase + "/rest/v1/registered_devices?id=eq." + enc(id), corpo: patch, token: token, prefer: "return=minimal", faixa: nil)
            }
            DispatchQueue.main.async {
                self.gravadas += 1
                self.ultimaIso = quando
                self.erroEnvio = nil
            }
            return true
        } catch {
            trava.lock()
            ultimaTentativa = volta
            trava.unlock()
            DispatchQueue.main.async {
                self.erroEnvio = "Perdi a conexão com a internet no meio do envio. As próximas medidas continuam tentando."
            }
            return false
        }
    }

    func carregarPainel() {
        guard sessao("access") != nil else { return }
        fila.async {
            do {
                let token = try self.tokenValido()
                guard let uid = self.sessao("uid") else { return }
                let corteData = Date().addingTimeInterval(-7 * 86_400)
                let corte = self.iso(corteData)
                let dia = String(corte.prefix(10))
                let sinc = try self.pedir(metodo: "GET", url: Self.urlBase + "/rest/v1/registered_devices?patient_user_id=eq." + self.enc(uid) + "&category=eq.h59&select=last_sync_at&order=last_sync_at.desc.nullslast&limit=1", corpo: nil, token: token, prefer: nil, faixa: nil)
                var ultima = self.ultimaIso
                if sinc.codigo >= 200 && sinc.codigo < 300,
                   let arr = try JSONSerialization.jsonObject(with: sinc.dados) as? [[String: Any]],
                   let iso = arr.first?["last_sync_at"] as? String {
                    if ultima == nil || iso > ultima! { ultima = iso }
                }
                let med = try self.pedir(metodo: "GET", url: Self.urlBase + "/rest/v1/professional_patient_links?patient_user_id=eq." + self.enc(uid) + "&status=eq.active&select=id&limit=1", corpo: nil, token: token, prefer: nil, faixa: nil)
                var tem = self.temMedico
                var conhecido = self.medicoConhecido
                if med.codigo >= 200 && med.codigo < 300,
                   let arr = try JSONSerialization.jsonObject(with: med.dados) as? [[String: Any]] {
                    tem = !arr.isEmpty
                    conhecido = true
                }
                let bats = self.contar(token: token, tabela: "hr_readings", campo: "recorded_at", corte: corte, uid: uid)
                let oxi = self.contar(token: token, tabela: "spo2_readings", campo: "recorded_at", corte: corte, uid: uid)
                let pa = self.contar(token: token, tabela: "bp_readings", campo: "recorded_at", corte: corte, uid: uid)
                let pas = self.contar(token: token, tabela: "activity_records", campo: "activity_date", corte: dia, uid: uid)
                let noites = self.contar(token: token, tabela: "sleep_records", campo: "sleep_date", corte: dia, uid: uid)
                DispatchQueue.main.async {
                    self.ultimaIso = ultima
                    self.temMedico = tem
                    self.medicoConhecido = conhecido
                    self.batimentos = bats
                    self.oxigenacao = oxi
                    self.pressao = pa
                    self.passos = pas
                    self.sono = noites
                }
            } catch {
                /* fica o último painel que deu certo */
            }
        }
    }

    /// Cadastro do paciente, o mesmo de AuthPage. nil = já entrou.
    func cadastrar(nome: String, email: String, senha: String, termos: Bool, saude: Bool) -> String? {
        let n = nome.trimmingCharacters(in: .whitespacesAndNewlines)
        let e = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if n.isEmpty { return "Por favor, escreva seu nome completo." }
        if senha.count < 6 { return "A senha precisa ter pelo menos 6 letras ou números." }
        if !termos || !saude { return "Para criar a conta, é preciso aceitar os termos e o consentimento de dados de saúde." }
        do {
            let corpo = try JSONSerialization.data(withJSONObject: [
                "email": e, "password": senha,
                "data": ["full_name": n, "perfil": "paciente"],
            ])
            let r = try pedir(metodo: "POST", url: Self.urlBase + "/auth/v1/signup?redirect_to=" + enc(Self.linkAuth), corpo: corpo, token: nil, prefer: nil, faixa: nil)
            if r.codigo < 200 || r.codigo >= 300 {
                let msg = texto(r.dados).lowercased()
                if msg.contains("already registered") || msg.contains("user_already_exists") {
                    return "Este e-mail já tem cadastro. Tente entrar."
                }
                let cru = texto(r.dados)
                return cru.isEmpty ? "Não foi possível criar a conta agora." : cru
            }
            let json = (try? JSONSerialization.jsonObject(with: r.dados) as? [String: Any]) ?? [:]
            let access = primeiroToken(json, "access_token")
            let refresh = primeiroToken(json, "refresh_token") ?? ""
            let uid = primeiroId(json)
            let expira = (json["expires_in"] as? NSNumber)?.doubleValue ?? 3600
            if let access, let uid {
                let consent = consentimentos(uid)
                _ = try? pedir(metodo: "POST", url: Self.urlBase + "/rest/v1/consent_records", corpo: consent, token: access, prefer: "return=minimal", faixa: nil)
                guardarSessao(access: access, refresh: refresh, uid: uid, expira: expira, email: e)
                return nil
            }
            return "Conta criada! Verifique seu e-mail para confirmar o cadastro."
        } catch {
            return "Não foi possível confirmar seu acesso agora. Tente de novo."
        }
    }

    func reenviar(email: String) -> String {
        let e = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if e.isEmpty { return "Digite seu e-mail." }
        do {
            let corpo = try JSONSerialization.data(withJSONObject: [
                "type": "signup", "email": e,
                "options": ["email_redirect_to": Self.linkAuth],
            ])
            let r = try pedir(metodo: "POST", url: Self.urlBase + "/auth/v1/resend", corpo: corpo, token: nil, prefer: nil, faixa: nil)
            if r.codigo < 200 || r.codigo >= 300 { return "Erro ao reenviar. Tente de novo em alguns minutos." }
            return "E-mail reenviado! Verifique sua caixa de entrada e a pasta de spam."
        } catch {
            return "Erro ao reenviar. Tente de novo em alguns minutos."
        }
    }

    func esqueci(email: String) -> String {
        let e = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if e.isEmpty { return "Digite seu e-mail." }
        do {
            let corpo = try JSONSerialization.data(withJSONObject: ["email": e])
            let r = try pedir(metodo: "POST", url: Self.urlBase + "/auth/v1/recover?redirect_to=" + enc(Self.linkSenha), corpo: corpo, token: nil, prefer: nil, faixa: nil)
            if r.codigo < 200 || r.codigo >= 300 {
                let cru = texto(r.dados)
                return cru.isEmpty ? "Não foi possível enviar o e-mail agora." : cru
            }
            return "Enviamos um link de recuperação para o seu e-mail."
        } catch {
            return "Não foi possível enviar o e-mail agora."
        }
    }

    func abrirLink(_ bruto: String) -> String? {
        guard let access = parametro(bruto, "access_token"), !access.isEmpty else {
            return "Esse link não tem os dados da conta."
        }
        let refresh = parametro(bruto, "refresh_token")
        let tipo = parametro(bruto, "type")
        let expira = Double(parametro(bruto, "expires_in") ?? "") ?? 3600
        if tipo == "recovery" {
            recuperacaoAccess = access
            recuperacaoRefresh = refresh
            UserDefaults.standard.set(Date().timeIntervalSince1970 + expira, forKey: "encorpei_exp_recuperacao")
            DispatchQueue.main.async { self.aguardandoSenha = true }
            return "Escolha a nova senha."
        }
        do {
            guard let uid = try usuarioDoToken(access) else { return "Não foi possível confirmar seu acesso agora. Tente de novo." }
            if try eProfissional(access: access, uid: uid) {
                _ = try? pedir(metodo: "POST", url: Self.urlBase + "/auth/v1/logout", corpo: Data("{}".utf8), token: access, prefer: nil, faixa: nil)
                return "Este e-mail está cadastrado como médico. Entre pelo portal do médico."
            }
            guardarSessao(access: access, refresh: refresh ?? "", uid: uid, expira: expira, email: "")
            return nil
        } catch {
            return "Não foi possível confirmar seu acesso agora. Tente de novo."
        }
    }

    func definirSenha(_ senha: String, confirmacao: String) -> String? {
        if senha != confirmacao { return "As senhas não são iguais." }
        if senha.count < 6 { return "A senha precisa ter pelo menos 6 caracteres." }
        guard let access = recuperacaoAccess else { return "Abra o link do e-mail antes de trocar a senha." }
        do {
            let corpo = try JSONSerialization.data(withJSONObject: ["password": senha])
            let r = try pedir(metodo: "PUT", url: Self.urlBase + "/auth/v1/user", corpo: corpo, token: access, prefer: nil, faixa: nil)
            if r.codigo < 200 || r.codigo >= 300 { return "Não foi possível trocar a senha agora." }
            if let uid = try usuarioDoToken(access), try eProfissional(access: access, uid: uid) {
                recuperacaoAccess = nil
                DispatchQueue.main.async { self.aguardandoSenha = false }
                return "Este e-mail está cadastrado como médico. Entre pelo portal do médico."
            }
            if let uid = try usuarioDoToken(access) {
                let expira = UserDefaults.standard.double(forKey: "encorpei_exp_recuperacao") - Date().timeIntervalSince1970
                guardarSessao(access: access, refresh: recuperacaoRefresh ?? "", uid: uid, expira: max(expira, 60), email: "")
            }
            recuperacaoAccess = nil
            DispatchQueue.main.async { self.aguardandoSenha = false }
            return nil
        } catch {
            return "Não foi possível trocar a senha agora."
        }
    }

    func importar(linhas: [Importacao.Linha], nome: String?) -> String {
        guard sessao("access") != nil else { return "Entre na sua conta antes de importar." }
        if linhas.isEmpty { return "Não consegui salvar nada deste arquivo." }
        do {
            let token = try tokenValido()
            guard let uid = sessao("uid") else { return "Entre na sua conta antes de importar." }
            let aparelho = (nome ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? Importacao.nomeArquivo : nome!.trimmingCharacters(in: .whitespacesAndNewlines)
            let deviceId = try garantirDispositivo(token: token, uid: uid, nome: aparelho, protocolo: "import")
            var importados = 0
            var ignorados = 0
            var falhas = 0
            for tipo in ["batimentos", "spo2", "bp", "activity"] {
                let c = try enviar(token: token, uid: uid, deviceId: deviceId, nome: aparelho, linhas: linhas, tipo: tipo)
                importados += c.0
                ignorados += c.1
                falhas += c.2
            }
            let sono = try enviarSono(token: token, uid: uid, deviceId: deviceId, nome: aparelho, linhas: linhas)
            importados += sono.0
            ignorados += sono.1
            falhas += sono.2
            if importados > 0, let deviceId {
                let quando = iso(Date())
                let patch = try JSONSerialization.data(withJSONObject: ["last_sync_at": quando])
                _ = try? pedir(metodo: "PATCH", url: Self.urlBase + "/rest/v1/registered_devices?id=eq." + enc(deviceId), corpo: patch, token: token, prefer: "return=minimal", faixa: nil)
                DispatchQueue.main.async {
                    if self.ultimaIso == nil || quando > self.ultimaIso! { self.ultimaIso = quando }
                }
            }
            if importados > 0 && temMedico { return "Arquivo importado. Seu médico já consegue ver." }
            if importados > 0 { return "Arquivo importado. As medidas ficaram guardadas no seu histórico." }
            if ignorados > 0 && falhas == 0 { return "Esse arquivo já tinha sido importado. Nada novo foi adicionado." }
            return "Não consegui salvar nada deste arquivo."
        } catch {
            return "Não consegui importar o arquivo. Tente de novo."
        }
    }

    private func contar(token: String, tabela: String, campo: String, corte: String, uid: String) -> Int {
        let url = Self.urlBase + "/rest/v1/" + tabela
            + "?patient_user_id=eq." + enc(uid)
            + "&source_type=in.(device,import)"
            + "&" + campo + "=gte." + enc(corte)
            + "&select=id"
        guard let r = try? pedir(metodo: "GET", url: url, corpo: nil, token: token, prefer: "count=exact", faixa: "0-0"),
              r.codigo >= 200, r.codigo < 300,
              let faixa = r.faixa, let barra = faixa.lastIndex(of: "/") else { return 0 }
        return Int(faixa[faixa.index(after: barra)...].trimmingCharacters(in: .whitespaces)) ?? 0
    }

    private func eProfissional(access: String, uid: String) throws -> Bool {
        let paciente = try pedir(metodo: "GET", url: Self.urlBase + "/rest/v1/cardio_patients?user_id=eq." + enc(uid) + "&select=id&limit=1", corpo: nil, token: access, prefer: nil, faixa: nil)
        let medico = try pedir(metodo: "GET", url: Self.urlBase + "/rest/v1/professional_profiles?user_id=eq." + enc(uid) + "&select=id&limit=1", corpo: nil, token: access, prefer: nil, faixa: nil)
        if paciente.codigo < 200 || paciente.codigo >= 300 || medico.codigo < 200 || medico.codigo >= 300 {
            throw URLError(.badServerResponse)
        }
        let arr = try JSONSerialization.jsonObject(with: medico.dados) as? [Any] ?? []
        return !arr.isEmpty
    }

    private func garantirDispositivo(token: String, uid: String, nome: String, protocolo: String = "ble") throws -> String? {
        trava.lock()
        if deviceNome == nome, let deviceId {
            trava.unlock()
            let patch = try JSONSerialization.data(withJSONObject: ["status": "active", "protocol": protocolo])
            _ = try? pedir(metodo: "PATCH", url: Self.urlBase + "/rest/v1/registered_devices?id=eq." + enc(deviceId), corpo: patch, token: token, prefer: "return=minimal", faixa: nil)
            return deviceId
        }
        trava.unlock()
        let busca = try pedir(metodo: "GET", url: Self.urlBase + "/rest/v1/registered_devices?patient_user_id=eq." + enc(uid) + "&category=eq.h59&display_name=eq." + enc(nome) + "&select=id&limit=1", corpo: nil, token: token, prefer: nil, faixa: nil)
        if busca.codigo >= 200 && busca.codigo < 300,
           let arr = try JSONSerialization.jsonObject(with: busca.dados) as? [[String: Any]],
           let id = arr.first?["id"] as? String {
            let patch = try JSONSerialization.data(withJSONObject: ["status": "active", "protocol": protocolo])
            _ = try? pedir(metodo: "PATCH", url: Self.urlBase + "/rest/v1/registered_devices?id=eq." + enc(id), corpo: patch, token: token, prefer: "return=minimal", faixa: nil)
            trava.lock()
            deviceId = id
            deviceNome = nome
            trava.unlock()
            return id
        }
        let criado = try pedir(metodo: "POST", url: Self.urlBase + "/rest/v1/registered_devices", corpo: jsonDispositivo(uid: uid, nome: nome, protocolo: protocolo), token: token, prefer: "return=representation", faixa: nil)
        if criado.codigo >= 200 && criado.codigo < 300,
           let arr = try JSONSerialization.jsonObject(with: criado.dados) as? [[String: Any]],
           let id = arr.first?["id"] as? String {
            trava.lock()
            deviceId = id
            deviceNome = nome
            trava.unlock()
            return id
        }
        return nil
    }

    func tokenValido() throws -> String {
        guard let access = sessao("access") else { throw URLError(.userAuthenticationRequired) }
        if Date().timeIntervalSince1970 + 60 < UserDefaults.standard.double(forKey: "encorpei_exp") { return access }
        return try renovar()
    }

    private func renovar() throws -> String {
        guard let refresh = sessao("refresh"), !refresh.isEmpty else { throw URLError(.userAuthenticationRequired) }
        let corpo = try JSONSerialization.data(withJSONObject: ["refresh_token": refresh])
        let r = try pedir(metodo: "POST", url: Self.urlBase + "/auth/v1/token?grant_type=refresh_token", corpo: corpo, token: nil, prefer: nil, faixa: nil)
        if r.codigo < 200 || r.codigo >= 300 {
            DispatchQueue.main.async { self.sair() }
            throw URLError(.userAuthenticationRequired)
        }
        let json = try JSONSerialization.jsonObject(with: r.dados) as? [String: Any] ?? [:]
        guard let access = json["access_token"] as? String else { throw URLError(.userAuthenticationRequired) }
        let novo = json["refresh_token"] as? String ?? refresh
        let expira = (json["expires_in"] as? NSNumber)?.doubleValue ?? 3600
        guardar("access", access)
        guardar("refresh", novo)
        UserDefaults.standard.set(Date().timeIntervalSince1970 + expira, forKey: "encorpei_exp")
        return access
    }

    private func enviar(token: String, uid: String, deviceId: String?, nome: String, linhas: [Importacao.Linha], tipo: String) throws -> (Int, Int, Int) {
        var candidatas: [[String: Any]] = []
        var chaves: [String] = []
        for l in linhas {
            guard let row = linhaTabela(tipo, uid: uid, deviceId: deviceId, nome: nome, l: l) else { continue }
            candidatas.append(row)
            chaves.append(chaveLinha(tipo, row))
        }
        if candidatas.isEmpty { return (0, 0, 0) }
        let campo = tipo == "activity" ? "activity_date" : "recorded_at"
        let colunas = tipo == "batimentos" ? "recorded_at,bpm" : tipo == "spo2" ? "recorded_at,value" : tipo == "bp" ? "recorded_at,systolic,diastolic" : "activity_date"
        let tabela = tipo == "batimentos" ? "hr_readings" : tipo == "spo2" ? "spo2_readings" : tipo == "bp" ? "bp_readings" : "activity_records"
        var inicio = valorJanela(tipo, candidatas[0])
        var fim = inicio
        for row in candidatas {
            let v = valorJanela(tipo, row)
            if v < inicio { inicio = v }
            if v > fim { fim = v }
        }
        let existentes = try buscarChaves(token: token, uid: uid, tabela: tabela, campo: campo, colunas: colunas, inicio: inicio, fim: fim, tipo: tipo)
        var vistas = Set<String>()
        var novas: [[String: Any]] = []
        var ignorados = 0
        for (i, row) in candidatas.enumerated() {
            let k = chaves[i]
            if existentes.contains(k) || vistas.contains(k) { ignorados += 1; continue }
            vistas.insert(k)
            novas.append(row)
        }
        let ins = try inserirLote(token: token, tabela: tabela, linhas: novas)
        return (ins.0, ignorados, ins.1)
    }

    private func enviarSono(token: String, uid: String, deviceId: String?, nome: String, linhas: [Importacao.Linha]) throws -> (Int, Int, Int) {
        var noites: [[String: Any]] = []
        for l in linhas {
            if let row = linhaTabela("sono", uid: uid, deviceId: deviceId, nome: nome, l: l) { noites.append(row) }
        }
        if noites.isEmpty { return (0, 0, 0) }
        var inicio = String(describing: noites[0]["sleep_date"] ?? "")
        var fim = inicio
        for n in noites {
            let d = String(describing: n["sleep_date"] ?? "")
            if d < inicio { inicio = d }
            if d > fim { fim = d }
        }
        let url = Self.urlBase + "/rest/v1/sleep_records?patient_user_id=eq." + enc(uid)
            + "&sleep_date=gte." + enc(inicio) + "&sleep_date=lte." + enc(fim)
            + "&select=id,sleep_date,deep_minutes,light_minutes,rem_minutes,awake_minutes,awakenings,efficiency_pct,min_heart_rate,min_spo2&order=sleep_date.asc"
        let busca = try pedir(metodo: "GET", url: url, corpo: nil, token: token, prefer: nil, faixa: nil)
        if busca.codigo < 200 || busca.codigo >= 300 { throw URLError(.badServerResponse) }
        let arr = (try? JSONSerialization.jsonObject(with: busca.dados) as? [[String: Any]]) ?? []
        var porData: [String: [String: Any]] = [:]
        for e in arr {
            let dia = String(describing: e["sleep_date"] ?? "").prefix(10)
            porData[String(dia)] = e
        }
        var pendente: [String: [String: Any]] = [:]
        var inserir: [[String: Any]] = []
        var patches: [String: [String: Any]] = [:]
        var patchLinhas: [String: Int] = [:]
        var ignorados = 0
        var mescladas = 0
        let campos = ["deep_minutes", "light_minutes", "rem_minutes", "awake_minutes", "awakenings", "efficiency_pct", "min_heart_rate", "min_spo2"]
        for linha in noites {
            let dia = String(String(describing: linha["sleep_date"] ?? "").prefix(10))
            let ex = porData[dia]
            if ex == nil && pendente[dia] == nil {
                pendente[dia] = linha
                inserir.append(linha)
                continue
            }
            var preencheu = false
            for campo in campos {
                guard let novo = linha[campo], !(novo is NSNull) else { continue }
                let base = pendente[dia] ?? ex
                if let base, let atual = base[campo], !(atual is NSNull) { continue }
                if let id = ex?["id"] as? String, let p = patches[id], let atual = p[campo], !(atual is NSNull) { continue }
                preencheu = true
                if pendente[dia] != nil {
                    pendente[dia]?[campo] = novo
                    if let idx = inserir.firstIndex(where: { String(describing: $0["sleep_date"] ?? "").hasPrefix(dia) }) {
                        inserir[idx][campo] = novo
                    }
                } else if let id = ex?["id"] as? String {
                    var p = patches[id] ?? [:]
                    p[campo] = novo
                    patches[id] = p
                }
            }
            if !preencheu { ignorados += 1 }
            else if pendente[dia] != nil && ex != nil { mescladas += 1 }
            else if let id = ex?["id"] as? String { patchLinhas[id, default: 0] += 1 }
        }
        let ins = try inserirLote(token: token, tabela: "sleep_records", linhas: inserir)
        var importados = ins.0
        var falhas = ins.1
        if falhas == 0 { importados += mescladas } else { falhas += mescladas }
        for (id, patch) in patches {
            let corpo = try JSONSerialization.data(withJSONObject: patch)
            let r = try pedir(metodo: "PATCH", url: Self.urlBase + "/rest/v1/sleep_records?id=eq." + enc(id) + "&patient_user_id=eq." + enc(uid), corpo: corpo, token: token, prefer: "return=minimal", faixa: nil)
            let n = patchLinhas[id] ?? 1
            if r.codigo >= 200 && r.codigo < 300 { importados += n } else { falhas += n }
        }
        return (importados, ignorados, falhas)
    }

    private func buscarChaves(token: String, uid: String, tabela: String, campo: String, colunas: String, inicio: String, fim: String, tipo: String) throws -> Set<String> {
        var set = Set<String>()
        var offset = 0
        while true {
            let url = Self.urlBase + "/rest/v1/" + tabela + "?patient_user_id=eq." + enc(uid)
                + "&" + campo + "=gte." + enc(inicio) + "&" + campo + "=lte." + enc(fim)
                + "&select=" + colunas + "&order=" + campo + ".asc"
            let r = try pedir(metodo: "GET", url: url, corpo: nil, token: token, prefer: nil, faixa: "\(offset)-\(offset + 999)")
            if r.codigo < 200 || r.codigo >= 300 { throw URLError(.badServerResponse) }
            let arr = (try? JSONSerialization.jsonObject(with: r.dados) as? [[String: Any]]) ?? []
            for row in arr { set.insert(chaveLinha(tipo, row)) }
            if arr.count < 1000 { break }
            offset += 1000
        }
        return set
    }

    private func inserirLote(token: String, tabela: String, linhas: [[String: Any]]) throws -> (Int, Int) {
        if linhas.isEmpty { return (0, 0) }
        if linhas.count > 500 {
            let a = try inserirLote(token: token, tabela: tabela, linhas: Array(linhas.prefix(500)))
            let b = try inserirLote(token: token, tabela: tabela, linhas: Array(linhas.dropFirst(500)))
            return (a.0 + b.0, a.1 + b.1)
        }
        let corpo = try JSONSerialization.data(withJSONObject: linhas)
        let r = try pedir(metodo: "POST", url: Self.urlBase + "/rest/v1/" + tabela, corpo: corpo, token: token, prefer: "return=minimal", faixa: nil)
        if r.codigo >= 200 && r.codigo < 300 { return (linhas.count, 0) }
        if linhas.count == 1 { return (0, 1) }
        let meio = linhas.count / 2
        let a = try inserirLote(token: token, tabela: tabela, linhas: Array(linhas.prefix(meio)))
        let b = try inserirLote(token: token, tabela: tabela, linhas: Array(linhas.dropFirst(meio)))
        return (a.0 + b.0, a.1 + b.1)
    }

    private func valorJanela(_ tipo: String, _ row: [String: Any]) -> String {
        if tipo == "activity" { return String(String(describing: row["activity_date"] ?? "").prefix(10)) }
        return String(describing: row["recorded_at"] ?? "")
    }

    private func chaveLinha(_ tipo: String, _ row: [String: Any]) -> String {
        if tipo == "activity" { return String(String(describing: row["activity_date"] ?? "").prefix(10)) }
        let at = String(describing: row["recorded_at"] ?? "")
        let minuto = String(at.prefix(16))
        if tipo == "batimentos" { return minuto + "|" + String(describing: row["bpm"] ?? "") }
        if tipo == "spo2" { return minuto + "|" + String(describing: row["value"] ?? "") }
        if tipo == "bp" { return minuto + "|" + String(describing: row["systolic"] ?? "") + "/" + String(describing: row["diastolic"] ?? "") }
        return minuto
    }

    private func linhaTabela(_ tipo: String, uid: String, deviceId: String?, nome: String, l: Importacao.Linha) -> [String: Any]? {
        var o: [String: Any] = [
            "patient_user_id": uid,
            "recorded_at": l.recordedAt,
            "source_type": "import",
            "source_device_id": deviceId as Any? ?? NSNull(),
            "source_device_name": nome,
            "entered_by": "device",
            "validation_status": "estimated",
        ]
        let dia = String(l.recordedAt.prefix(10))
        if tipo == "batimentos" {
            guard let bpm = l.heartRate else { return nil }
            o["bpm"] = bpm
            o["context"] = NSNull()
            o["irregular_flag"] = NSNull()
            o["rmssd"] = NSNull()
            o["sdnn"] = NSNull()
            return o
        }
        if tipo == "spo2" {
            guard let v = l.spo2 else { return nil }
            o["value"] = v
            o["context"] = NSNull()
            o["time_below_90_pct"] = NSNull()
            return o
        }
        if tipo == "bp" {
            guard let sis = l.systolic, let diaN = l.diastolic else { return nil }
            o["systolic"] = sis
            o["diastolic"] = diaN
            o["pulse"] = l.heartRate as Any? ?? NSNull()
            o["context"] = "random"
            o["position"] = NSNull()
            o["arm"] = NSNull()
            o["cuff_validated"] = false
            o["entered_by_user_id"] = NSNull()
            o["validation_note"] = Importacao.notaPa
            return o
        }
        if tipo == "activity" {
            if l.steps == nil && l.calories == nil { return nil }
            o["activity_date"] = dia
            o["steps"] = l.steps as Any? ?? NSNull()
            o["calories"] = l.calories as Any? ?? NSNull()
            o["distance_km"] = NSNull()
            o["moderate_minutes"] = NSNull()
            o["vigorous_minutes"] = NSNull()
            o["avg_heart_rate"] = l.heartRate as Any? ?? NSNull()
            o["max_heart_rate"] = NSNull()
            return o
        }
        guard let total = l.sleepMinutes else { return nil }
        o["sleep_date"] = dia
        o["total_minutes"] = total
        o["deep_minutes"] = l.deepMinutes as Any? ?? NSNull()
        o["light_minutes"] = l.lightMinutes as Any? ?? NSNull()
        o["rem_minutes"] = l.remMinutes as Any? ?? NSNull()
        o["awake_minutes"] = l.awakeMinutes as Any? ?? NSNull()
        o["awakenings"] = l.awakenings as Any? ?? NSNull()
        o["efficiency_pct"] = l.efficiencyPct as Any? ?? NSNull()
        o["min_heart_rate"] = l.minHeartRate as Any? ?? NSNull()
        o["min_spo2"] = l.minSpo2 as Any? ?? NSNull()
        return o
    }

    private func guardarSessao(access: String, refresh: String, uid: String, expira: Double, email: String) {
        guardar("access", access)
        guardar("refresh", refresh)
        guardar("uid", uid)
        if !email.isEmpty { guardar("email", email) }
        UserDefaults.standard.set(Date().timeIntervalSince1970 + expira, forKey: "encorpei_exp")
        DispatchQueue.main.async {
            if !email.isEmpty { self.email = email }
            self.logada = true
            self.erroEnvio = nil
            self.aguardandoSenha = false
        }
    }

    private func primeiroToken(_ json: [String: Any], _ chave: String) -> String? {
        if let s = json[chave] as? String, !s.isEmpty { return s }
        if let session = json["session"] as? [String: Any], let s = session[chave] as? String, !s.isEmpty { return s }
        return nil
    }

    private func primeiroId(_ json: [String: Any]) -> String? {
        if let user = json["user"] as? [String: Any], let id = user["id"] as? String { return id }
        if let session = json["session"] as? [String: Any], let user = session["user"] as? [String: Any], let id = user["id"] as? String { return id }
        if let id = json["id"] as? String, !id.isEmpty { return id }
        return nil
    }

    private func usuarioDoToken(_ access: String) throws -> String? {
        let r = try pedir(metodo: "GET", url: Self.urlBase + "/auth/v1/user", corpo: nil, token: access, prefer: nil, faixa: nil)
        if r.codigo < 200 || r.codigo >= 300 { return nil }
        let json = (try? JSONSerialization.jsonObject(with: r.dados) as? [String: Any]) ?? [:]
        return json["id"] as? String
    }

    private func parametro(_ bruto: String, _ chave: String) -> String? {
        let q: String
        if let hash = bruto.firstIndex(of: "#") {
            q = String(bruto[bruto.index(after: hash)...])
        } else if let ask = bruto.firstIndex(of: "?") {
            q = String(bruto[bruto.index(after: ask)...])
        } else {
            q = bruto
        }
        for parte in q.split(separator: "&") {
            let pedacos = parte.split(separator: "=", maxSplits: 1).map(String.init)
            if pedacos.count == 2, pedacos[0] == chave {
                return pedacos[1].removingPercentEncoding ?? pedacos[1]
            }
        }
        return nil
    }

    private func consentimentos(_ uid: String) -> Data {
        let versao = "2026-05-24"
        let rows = ["terms", "privacy", "health_data"].map { tipo in
            [
                "user_id": uid,
                "consent_type": tipo,
                "document_version": versao,
                "status": "granted",
                "context": "signup",
            ]
        }
        return (try? JSONSerialization.data(withJSONObject: rows)) ?? Data()
    }

    func sessao(_ chave: String) -> String? {
        UserDefaults.standard.string(forKey: "encorpei_" + chave)
    }

    private func guardar(_ chave: String, _ valor: String) {
        UserDefaults.standard.set(valor, forKey: "encorpei_" + chave)
    }

    func enc(_ s: String) -> String {
        var permitido = CharacterSet.urlQueryAllowed
        permitido.remove(charactersIn: ":#[]@!$&'()*+,;=")
        return s.addingPercentEncoding(withAllowedCharacters: permitido) ?? s
    }

    private func iso(_ data: Date) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: data)
    }

    func texto(_ dados: Data) -> String {
        if let json = try? JSONSerialization.jsonObject(with: dados) as? [String: Any] {
            if let s = json["error_description"] as? String { return s }
            if let s = json["msg"] as? String { return s }
            if let s = json["message"] as? String { return s }
            if let s = json["error"] as? String { return s }
        }
        return String(data: dados, encoding: .utf8) ?? ""
    }

    private func jsonLinha(uid: String, deviceId: String?, nome: String, bpm: Int, contato: Bool?, at: String, rmssd: Double?, sdnn: Double?) -> Data {
        var o: [String: Any] = [
            "patient_user_id": uid,
            "recorded_at": at,
            "bpm": bpm,
            "context": "resting",
            "irregular_flag": NSNull(),
            "rmssd": rmssd as Any? ?? NSNull(),
            "sdnn": sdnn as Any? ?? NSNull(),
            "source_type": "device",
            "source_device_id": deviceId as Any? ?? NSNull(),
            "source_device_name": nome,
            "entered_by": "device",
            "validation_status": contato == false ? "suspect" : "estimated",
        ]
        _ = o
        return (try? JSONSerialization.data(withJSONObject: o)) ?? Data()
    }

    private func jsonDispositivo(uid: String, nome: String, protocolo: String = "ble") -> Data {
        let o: [String: Any] = [
            "patient_user_id": uid,
            "display_name": nome,
            "model": NSNull(),
            "manufacturer": NSNull(),
            "category": "h59",
            "protocol": protocolo,
            "vital_types": ["heart_rate"],
            "firmware": NSNull(),
            "status": "active",
        ]
        return (try? JSONSerialization.data(withJSONObject: o)) ?? Data()
    }

    struct Http {
        let codigo: Int
        let dados: Data
        let faixa: String?
    }

    func pedir(metodo: String, url: String, corpo: Data?, token: String?, prefer: String?, faixa: String?) throws -> Http {
        var req = URLRequest(url: URL(string: url)!)
        req.httpMethod = metodo
        req.timeoutInterval = 12
        req.setValue(Self.chave, forHTTPHeaderField: "apikey")
        req.setValue("Bearer " + (token ?? Self.chave), forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let prefer { req.setValue(prefer, forHTTPHeaderField: "Prefer") }
        if let faixa { req.setValue(faixa, forHTTPHeaderField: "Range") }
        if let corpo, metodo != "GET" { req.httpBody = corpo }
        let sem = DispatchSemaphore(value: 0)
        var dados = Data()
        var resposta: HTTPURLResponse?
        var falha: Error?
        URLSession.shared.dataTask(with: req) { d, r, e in
            dados = d ?? Data()
            resposta = r as? HTTPURLResponse
            falha = e
            sem.signal()
        }.resume()
        sem.wait()
        if let falha { throw falha }
        return Http(codigo: resposta?.statusCode ?? 0, dados: dados, faixa: resposta?.value(forHTTPHeaderField: "Content-Range"))
    }
}
