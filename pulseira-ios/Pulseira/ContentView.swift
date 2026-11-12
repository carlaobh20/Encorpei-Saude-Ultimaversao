import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @ObservedObject var sessao: PulseiraSessao
    @ObservedObject var conta: Conta
    @Environment(\.scenePhase) private var scenePhase
    @State private var ajudaAberta = false
    @State private var avisoImportacao = ""
    @State private var email = ""
    @State private var senha = ""
    @State private var senha2 = ""
    @State private var nomeConta = ""
    @State private var termos = false
    @State private var saude = false
    @State private var modo = "entrar"
    @State private var loginMsg = ""
    @State private var entrando = false
    @State private var sairDepois = false
    @State private var escolhendoArquivo = false
    @State private var textoArquivo = ""
    @State private var previa: Importacao.Resultado?
    @State private var mapas: [String: Int] = [:]
    @State private var aba = "hoje"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center, spacing: 12) {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Encorpei Cardio")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(tinta)
                        Text("Seu cuidado, todos os dias")
                            .font(.system(size: 13))
                            .foregroundStyle(secundaria)
                    }
                    Spacer()
                    if conta.logada && !conta.aguardandoSenha {
                        Button("Sair") { pedirSaida() }
                            .buttonStyle(BotaoContorno(largo: false))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, minHeight: 64, alignment: .leading)
                .background(cartao)

                Group {
                if conta.logada && !conta.aguardandoSenha && aba != "pulseira" {
                    CasaTelas(aba: $aba, conta: conta, bpm: sessao.bpm)
                        .padding(16)
                } else {
                VStack(alignment: .leading, spacing: 0) {
                Text("Pulseira")
                    .font(.system(size: 28, weight: .bold))
                    .tracking(-1.2)
                    .foregroundStyle(tinta)
                Text("Compatibilidade: LOKMAT H59MAX · C4001B")
                    .font(.system(size: 16))
                    .foregroundStyle(secundaria)
                    .padding(.top, 4)
                Text("Apple Saúde, Health Connect e outras plataformas →")
                    .font(.system(size: 16))
                    .underline()
                    .foregroundStyle(tinta)
                    .padding(.top, 16)

                if !conta.logada || conta.aguardandoSenha {
                    formularioConta
                } else {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(alignment: .top, spacing: 12) {
                        Text("⌚")
                            .font(.system(size: 20))
                            .frame(width: 44, height: 44)
                            .background(destaque)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(nomeVisivel)
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(tinta)
                            Text(frase)
                                .font(.system(size: 13))
                                .foregroundStyle(secundaria)
                        }
                        Spacer(minLength: 8)
                        Text(selo)
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(seloTinta)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 2)
                            .background(seloFundo)
                            .clipShape(Capsule())
                    }
                    VStack(alignment: .leading, spacing: 4) {
                        Text("ÚLTIMA VEZ QUE SEUS DADOS FORAM SALVOS")
                            .font(.system(size: 12, weight: .bold))
                            .tracking(0.4)
                            .foregroundStyle(secundaria)
                        Text(conta.ultimaIso.map(formatar) ?? "Ainda não recebi nada")
                            .font(.system(size: 22, weight: .bold))
                            .foregroundStyle(tinta)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(destaque)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                    .padding(.top, 16)
                    Text("O QUE CHEGOU NOS ÚLTIMOS 7 DIAS")
                        .font(.system(size: 12, weight: .bold))
                        .tracking(0.4)
                        .foregroundStyle(secundaria)
                        .padding(.top, 16)
                    Text(textoChegou)
                        .font(.system(size: 16))
                        .foregroundStyle(tinta)
                        .padding(.top, 6)

                    if sessao.fase == "conectada" || sessao.salvando {
                        VStack(spacing: 4) {
                            Text(sessao.bpm.map(String.init) ?? "—")
                                .font(.system(size: 36, weight: .bold))
                                .foregroundStyle(tinta)
                                .accessibilityLabel(sessao.bpm.map { "\($0) batimentos por minuto" } ?? "Sem batimento")
                            Text("batimentos por minuto, agora")
                                .font(.system(size: 13))
                                .foregroundStyle(secundaria)
                            if let contato = sessao.contato {
                                Text(contato ? "Contato com a pele." : "Sem contato com a pele.")
                                    .font(.system(size: 13))
                                    .foregroundStyle(secundaria)
                            }
                            if let canal = sessao.canal, !canal.isEmpty {
                                Text(canal)
                                    .font(.system(size: 13))
                                    .foregroundStyle(secundaria)
                            }
                            Text(textoSessao)
                                .font(.system(size: 13))
                                .foregroundStyle(secundaria)
                                .padding(.top, 4)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(16)
                        .background(mudo)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .padding(.top, 16)
                    }

                    if let erro = conta.erroEnvio {
                        Text(erro)
                            .font(.system(size: 16))
                            .foregroundStyle(aviso)
                            .padding(.top, 12)
                    } else if sessao.fase == "erro" && !sessao.mensagem.isEmpty {
                        Text(sessao.mensagem)
                            .font(.system(size: 16))
                            .foregroundStyle(aviso)
                            .padding(.top, 12)
                    }

                    Button(rotuloBotao) { acaoBotao() }
                        .buttonStyle(BotaoCheio())
                        .padding(.top, 16)
                        .disabled(sessao.salvando || sessao.fase == "procurando" || sessao.fase == "conectando")
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cartao)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(bordaForte, lineWidth: 2))
                .padding(.top, 24)

                Text("Importar arquivo")
                    .font(.system(size: 22, weight: .semibold))
                    .tracking(-0.4)
                    .foregroundStyle(tinta)
                    .padding(.top, 24)
                Text("funciona no iPhone também")
                    .font(.system(size: 16))
                    .foregroundStyle(secundaria)

                VStack(alignment: .leading, spacing: 8) {
                    Button("Importar arquivo") { escolhendoArquivo = true }
                        .buttonStyle(BotaoContorno())
                    Text("Aceita CSV compatível, caso você tenha esse arquivo. A exportação pelo QWatch Pro ainda não foi confirmada. Conectar a pulseira não importa automaticamente todos os dados.")
                        .font(.system(size: 13))
                        .foregroundStyle(secundaria)
                    if let previa {
                        Text(textoPrevia(previa))
                            .font(.system(size: 14))
                            .foregroundStyle(tinta)
                        if previa.precisaConfirmacao {
                            ForEach(Importacao.rotulos(), id: \.self) { campo in
                                Text(Importacao.rotulo(campo))
                                    .font(.system(size: 13))
                                    .foregroundStyle(secundaria)
                                Picker(Importacao.rotulo(campo), selection: Binding(
                                    get: { mapas[campo] ?? -1 },
                                    set: { mapas[campo] = $0 }
                                )) {
                                    Text("— não usar —").tag(-1)
                                    ForEach(Array(previa.cabecalho.enumerated()), id: \.offset) { i, nome in
                                        Text(nome.isEmpty ? "Coluna \(i + 1)" : nome).tag(i)
                                    }
                                }
                                .pickerStyle(.menu)
                            }
                        }
                        if previa.precisaConfirmacao || !previa.linhas.isEmpty {
                            Button(previa.precisaConfirmacao ? "Conferir colunas" : "Salvar no histórico") { confirmarArquivo() }
                                .buttonStyle(BotaoCheio())
                        }
                        Button("Cancelar") { limparArquivo() }
                            .buttonStyle(BotaoContorno())
                    }
                    if !avisoImportacao.isEmpty {
                        Text(avisoImportacao)
                            .font(.system(size: 14))
                            .foregroundStyle(aviso)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cartao)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(borda, lineWidth: 1))
                .padding(.top, 12)

                Text("Recursos da H59MAX no Encorpei")
                    .font(.system(size: 22, weight: .semibold))
                    .tracking(-0.4)
                    .foregroundStyle(tinta)
                    .padding(.top, 24)
                VStack(alignment: .leading, spacing: 12) {
                    Text("Modelo identificado pela embalagem. O QWatch Pro é o aplicativo companheiro; a compatibilidade de transmissão precisa ser testada na sua unidade.")
                        .font(.system(size: 16))
                        .foregroundStyle(secundaria)
                    recurso("Batimentos", "Leitura Bluetooth implementada; depende da compatibilidade do firmware e do navegador.")
                    recurso("Oxigenação (SpO₂)", "Importação de arquivo compatível. Leitura Bluetooth ainda não implementada.")
                    recurso("Sono", "Importação de duração e estágios quando presentes no arquivo. Sem busca automática do histórico da pulseira.")
                    recurso("Passos e calorias", "Importação de arquivo compatível. São estimativas de atividade.")
                    recurso("Pressão estimada", "Importação de arquivo compatível. Não entra na média de pressão nem nos alertas clínicos.")
                    Text("HRV, estresse, distância e registros esportivos são anunciados para o modelo, mas ainda não têm importação validada neste app. Não exibimos números calculados para substituir esses dados.\n\nAlarmes, notificações, lembrete de movimento, localizar pulseira, câmera remota e atualização de firmware ficam no QWatch Pro. O GPS dos exercícios depende do celular.")
                        .font(.system(size: 16))
                        .foregroundStyle(secundaria)
                    Text("As leituras da pulseira são estimativas de bem-estar. Pressão sem manguito não substitui a medida com aparelho de braço.")
                        .font(.system(size: 16))
                        .foregroundStyle(aviso)
                    Text("Não habilitados para esta pulseira: peso, glicemia, ECG, temperatura e diagnóstico de arritmia. Não há suporte comprovado para essas funções no modelo identificado.")
                        .font(.system(size: 16))
                        .foregroundStyle(secundaria)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cartao)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(borda, lineWidth: 1))
                .padding(.top, 12)

                VStack(alignment: .leading, spacing: 0) {
                    Button("Ajuda e detalhes do aparelho") { ajudaAberta.toggle() }
                        .buttonStyle(BotaoContorno())
                    if ajudaAberta {
                        Text("Cada aparelho desses vem de um lote diferente e nem todos falam a mesma língua. Este teste identifica os serviços Bluetooth disponíveis. Isso não comprova que todos os dados possam ser importados.\n\nO teste que lista todos os serviços continua na tela do site. Aqui a seção de conexão só mantém o batimento ao vivo.")
                            .font(.system(size: 16))
                            .foregroundStyle(secundaria)
                            .padding(.top, 16)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cartao)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .overlay(RoundedRectangle(cornerRadius: 14).stroke(borda, lineWidth: 1))
                .padding(.top, 24)
                }
                }
                .padding(16)
                }
                }
            }
        }
        .background(fundo)
        .safeAreaInset(edge: .bottom) {
            if conta.logada && !conta.aguardandoSenha {
                BarraAbas(aba: $aba)
            }
        }
        .onChange(of: scenePhase) { _, fase in
            sessao.cenaMudou(ativa: fase == .active)
        }
        .onAppear {
            sessao.ligar(conta)
            if conta.logada {
                conta.carregarPainel()
                conta.carregarCasa()
            }
        }
        .onChange(of: conta.gravadas) { _, _ in
            if conta.logada { conta.carregarPainel() }
        }
        .onChange(of: conta.logada) { _, logada in
            if logada {
                aba = "hoje"
                conta.carregarPainel()
                conta.carregarCasa()
            }
        }
        .onChange(of: conta.aguardandoSenha) { _, espera in
            if espera { modo = "senha" }
        }
        .fileImporter(isPresented: $escolhendoArquivo, allowedContentTypes: [.commaSeparatedText, .plainText, .data]) { resultado in
            switch resultado {
            case .success(let url):
                let ok = url.startAccessingSecurityScopedResource()
                defer { if ok { url.stopAccessingSecurityScopedResource() } }
                guard let data = try? Data(contentsOf: url), data.count <= 8_000_000,
                      let texto = String(data: data, encoding: .utf8) ?? String(data: data, encoding: .isoLatin1) else {
                    avisoImportacao = "Não consegui importar o arquivo. Tente de novo."
                    return
                }
                textoArquivo = texto
                mostrarPrevia(Importacao.ler(texto, mapa: nil))
            case .failure(_):
                avisoImportacao = "Não consegui importar o arquivo. Tente de novo."
            }
        }
        .onChange(of: sessao.fase) { _, fase in
            if sairDepois, fase == "parada", !sessao.salvando {
                sairDepois = false
                conta.sair()
            }
        }
    }

    private var modoEfetivo: String { conta.aguardandoSenha ? "senha" : modo }

    private var formularioConta: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(tituloConta)
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(tinta)
            if modoEfetivo == "criar" {
                TextField("Nome completo", text: $nomeConta)
                    .textFieldStyle(.roundedBorder)
            }
            if modoEfetivo != "senha" {
                TextField("E-mail", text: $email)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    .textFieldStyle(.roundedBorder)
            }
            if modoEfetivo != "esqueci" {
                SecureField(modoEfetivo == "senha" ? "Nova senha" : "Senha", text: $senha)
                    .textFieldStyle(.roundedBorder)
            }
            if modoEfetivo == "criar" || modoEfetivo == "senha" {
                SecureField("Senha de novo", text: $senha2)
                    .textFieldStyle(.roundedBorder)
            }
            if modoEfetivo == "criar" {
                Toggle("Aceito os termos e a política de privacidade.", isOn: $termos)
                    .font(.system(size: 14))
                    .foregroundStyle(tinta)
                Toggle("Aceito o uso dos meus dados de saúde neste acompanhamento.", isOn: $saude)
                    .font(.system(size: 14))
                    .foregroundStyle(tinta)
            }
            Button(rotuloConta) { entrar() }
                .buttonStyle(BotaoCheio())
                .disabled(entrando)
            if modoEfetivo == "entrar" {
                Button("Criar minha conta") { modo = "criar"; loginMsg = "" }
                    .buttonStyle(BotaoContorno())
                Button("Esqueci a senha") { modo = "esqueci"; loginMsg = "" }
                    .buttonStyle(BotaoContorno())
                Text("Se o e-mail não abrir o app, cole o link aqui e toque em Entrar.")
                    .font(.system(size: 13))
                    .foregroundStyle(secundaria)
            } else if modoEfetivo == "criar" {
                Button("Reenviar e-mail") { reenviar() }
                    .buttonStyle(BotaoContorno())
                Button("Já tenho conta") { modo = "entrar"; loginMsg = "" }
                    .buttonStyle(BotaoContorno())
            } else if modoEfetivo != "senha" {
                Button("Já tenho conta") { modo = "entrar"; loginMsg = "" }
                    .buttonStyle(BotaoContorno())
            }
            if !loginMsg.isEmpty {
                Text(loginMsg).font(.system(size: 15)).foregroundStyle(aviso)
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cartao)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(borda, lineWidth: 1))
        .padding(.top, 20)
    }

    private var tituloConta: String {
        switch modoEfetivo {
        case "criar": return "Criar conta"
        case "esqueci": return "Recuperar a senha"
        case "senha": return "Nova senha"
        default: return "Entre com a sua conta"
        }
    }

    private var rotuloConta: String {
        if entrando {
            if modoEfetivo == "criar" { return "Criando..." }
            if modoEfetivo == "esqueci" { return "Enviando..." }
            if modoEfetivo == "senha" { return "Salvando..." }
            return "Entrando..."
        }
        if modoEfetivo == "criar" { return "Criar minha conta" }
        if modoEfetivo == "esqueci" { return "Enviar link de recuperação" }
        if modoEfetivo == "senha" { return "Salvar nova senha" }
        return "Entrar"
    }

    private func entrar() {
        entrando = true
        loginMsg = ""
        let em = email
        let se = senha
        let se2 = senha2
        let nome = nomeConta
        let aceitaTermos = termos
        let aceitaSaude = saude
        let atual = modoEfetivo
        let colado = em.contains("access_token") ? em : se.contains("access_token") ? se : ""
        DispatchQueue.global(qos: .userInitiated).async {
            var erro: String?
            var aviso: String?
            if !colado.isEmpty {
                erro = conta.abrirLink(colado)
            } else if atual == "criar" {
                erro = conta.cadastrar(nome: nome, email: em, senha: se, termos: aceitaTermos, saude: aceitaSaude)
            } else if atual == "esqueci" {
                aviso = conta.esqueci(email: em)
            } else if atual == "senha" {
                erro = conta.definirSenha(se, confirmacao: se2)
            } else {
                erro = conta.entrar(email: em, senha: se)
            }
            DispatchQueue.main.async {
                entrando = false
                if let aviso { loginMsg = aviso }
                else if let erro { loginMsg = erro }
                else {
                    senha = ""
                    senha2 = ""
                    loginMsg = ""
                }
            }
        }
    }

    private func reenviar() {
        let em = email
        DispatchQueue.global(qos: .userInitiated).async {
            let msg = conta.reenviar(email: em)
            DispatchQueue.main.async { loginMsg = msg }
        }
    }

    private func mostrarPrevia(_ r: Importacao.Resultado) {
        previa = r
        mapas = r.mapeamento
        avisoImportacao = ""
    }

    private func textoPrevia(_ r: Importacao.Resultado) -> String {
        var partes = r.avisos
        if !r.linhas.isEmpty {
            partes.append("\(r.batimentos) batimentos, \(r.oxigenacao) oxigenação, \(r.pressao) pressão (estimativa), \(r.atividade) dias de passos, \(r.sono) noites de sono.")
        }
        return partes.joined(separator: "\n")
    }

    private func confirmarArquivo() {
        guard let previa else { return }
        if previa.precisaConfirmacao {
            var escolha: [String: Int] = [:]
            for (campo, idx) in mapas where idx >= 0 { escolha[campo] = idx }
            mostrarPrevia(Importacao.ler(textoArquivo, mapa: escolha))
            return
        }
        if previa.linhas.isEmpty { return }
        let linhas = previa.linhas
        let nome = (sessao.nome?.isEmpty == false ? sessao.nome : nil) ?? Importacao.nomeArquivo
        avisoImportacao = "Salvando..."
        DispatchQueue.global(qos: .userInitiated).async {
            let msg = conta.importar(linhas: linhas, nome: nome)
            DispatchQueue.main.async {
                avisoImportacao = msg
                if msg.hasPrefix("Arquivo importado") || msg.hasPrefix("Esse arquivo já") {
                    limparArquivo()
                    conta.carregarPainel()
                }
            }
        }
    }

    private func limparArquivo() {
        textoArquivo = ""
        previa = nil
        mapas = [:]
    }

    private func pedirSaida() {
        if sessao.fase != "parada" {
            sairDepois = true
            sessao.desligar()
        } else {
            conta.sair()
        }
    }

    private func acaoBotao() {
        if sessao.fase == "conectada" { sessao.desligar() }
        else { sessao.conectar() }
    }

    private var rotuloBotao: String {
        if sessao.salvando { return "Salvando..." }
        if sessao.fase == "conectada" { return "Encerrar e salvar" }
        if sessao.fase == "procurando" || sessao.fase == "conectando" { return "Conectando..." }
        return "Conectar aparelho"
    }

    private var textoSessao: String {
        let n = conta.gravadas
        if n == 1 { return "1 medida salva nesta sessão" }
        if n > 1 { return "\(n) medidas salvas nesta sessão" }
        return "A primeira medida é salva depois de um minuto conectado"
    }

    private var textoChegou: String {
        var partes: [String] = []
        if conta.batimentos > 0 { partes.append("\(conta.batimentos) batimentos") }
        if conta.oxigenacao > 0 { partes.append("\(conta.oxigenacao) oxigenação") }
        if conta.pressao > 0 { partes.append("\(conta.pressao) pressão (estimativa)") }
        if conta.passos > 0 { partes.append("\(conta.passos) dias de passos") }
        if conta.sono > 0 { partes.append("\(conta.sono) noites de sono") }
        return partes.isEmpty ? "Nenhuma medida nova nos últimos 7 dias." : partes.joined(separator: " · ")
    }

    private func formatar(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let data = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let data else { return iso }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "pt_BR")
        fmt.dateFormat = "dd/MM/yyyy, HH:mm"
        return fmt.string(from: data)
    }

    private var nomeVisivel: String {
        if let nome = sessao.nome, !nome.isEmpty { return nome }
        return "O aparelho que você conectou"
    }

    private var selo: String {
        if sessao.fase == "procurando" || sessao.fase == "conectando" { return "Conectando" }
        if sessao.salvando { return "Sincronizando" }
        if conta.erroEnvio != nil || sessao.fase == "erro" { return "Não deu certo" }
        if sessao.fase == "conectada" { return conta.gravadas > 0 ? "Atualizada" : "Sincronizando" }
        guard let iso = conta.ultimaIso else { return "Não conectada" }
        if diasDesde(iso) > 3 { return "Dados atrasados" }
        return "Atualizada"
    }

    private var frase: String {
        if sessao.fase == "procurando" || sessao.fase == "conectando" {
            return "Procurando o aparelho. Deixe-o perto do celular."
        }
        if sessao.salvando || (sessao.fase == "conectada" && conta.gravadas == 0 && conta.erroEnvio == nil) {
            return "Enviando suas medidas. Não feche esta tela."
        }
        if conta.erroEnvio != nil || sessao.fase == "erro" {
            return "Nada foi enviado desta vez. Você pode tentar de novo."
        }
        if sessao.fase == "conectada" || conta.ultimaIso != nil {
            if let iso = conta.ultimaIso, sessao.fase != "conectada", diasDesde(iso) > 3 {
                return "Faz alguns dias que nada novo chega. Conecte ou importe o arquivo."
            }
            if conta.medicoConhecido && conta.temMedico {
                return "Suas medidas foram salvas e seu médico consegue ver."
            }
            return "Suas medidas foram salvas. Elas ficam guardadas para você — quando um médico assumir seu acompanhamento, ele passa a ver."
        }
        return "O app ainda não recebeu nada deste aparelho."
    }

    private func diasDesde(_ iso: String) -> Double {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let data = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let data else { return 0 }
        return Date().timeIntervalSince(data) / 86_400
    }

    private func recurso(_ nome: String, _ envio: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(nome)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(tinta)
            Text(envio)
                .font(.system(size: 16))
                .foregroundStyle(secundaria)
        }
    }

    private var seloFundo: Color {
        switch selo {
        case "Atualizada": return sucessoBg
        case "Não deu certo", "Dados atrasados": return avisoBg
        case "Conectando", "Sincronizando": return infoBg
        default: return mudo
        }
    }

    private var seloTinta: Color {
        switch selo {
        case "Atualizada": return sucesso
        case "Não deu certo", "Dados atrasados": return aviso
        case "Conectando", "Sincronizando": return info
        default: return secundaria
        }
    }

    private var fundo: Color { Color(red: 0.976, green: 0.980, blue: 0.984) }
    private var tinta: Color { Color(red: 0.110, green: 0.122, blue: 0.149) }
    private var secundaria: Color { Color(red: 0.376, green: 0.412, blue: 0.463) }
    private var aviso: Color { Color(red: 0.490, green: 0.286, blue: 0.051) }
    private var avisoBg: Color { Color(red: 0.996, green: 0.953, blue: 0.886) }
    private var sucesso: Color { Color(red: 0.298, green: 0.682, blue: 0.310) }
    private var sucessoBg: Color { Color(red: 0.922, green: 0.961, blue: 0.925) }
    private var info: Color { Color(red: 0.306, green: 0.447, blue: 0.635) }
    private var infoBg: Color { Color(red: 0.925, green: 0.945, blue: 0.976) }
    private var cartao: Color { .white }
    private var mudo: Color { Color(red: 0.933, green: 0.941, blue: 0.949) }
    private var destaque: Color { Color(red: 0.949, green: 0.949, blue: 0.949) }
    private var borda: Color { Color(red: 0.875, green: 0.886, blue: 0.906) }
    private var bordaForte: Color { Color(red: 0.824, green: 0.824, blue: 0.831) }
}

private struct BotaoCheio: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color.white)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(Color(red: 0.110, green: 0.122, blue: 0.149).opacity(configuration.isPressed ? 0.82 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

private struct BotaoContorno: ButtonStyle {
    var largo = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(Color(red: 0.110, green: 0.122, blue: 0.149))
            .padding(.horizontal, largo ? 0 : 16)
            .frame(maxWidth: largo ? .infinity : nil, minHeight: 48)
            .background(Color.white.opacity(configuration.isPressed ? 0.9 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color(red: 0.875, green: 0.886, blue: 0.906), lineWidth: 1))
    }
}
