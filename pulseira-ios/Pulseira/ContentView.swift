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

    private let recursosLista = """
    Batimentos. Leitura Bluetooth implementada; depende da compatibilidade do firmware e do navegador.

    Oxigenação (SpO₂). Importação de arquivo compatível. Leitura Bluetooth ainda não implementada.

    Sono. Importação de duração e estágios quando presentes no arquivo. Sem busca automática do histórico da pulseira.

    Passos e calorias. Importação de arquivo compatível. São estimativas de atividade.

    Pressão estimada. Importação de arquivo compatível. Não entra na média de pressão nem nos alertas clínicos.
    """

    private let recursosFim = """
    HRV, estresse, distância e registros esportivos são anunciados para o modelo, mas ainda não têm importação validada neste app. Não exibimos números calculados para substituir esses dados.

    Alarmes, notificações, lembrete de movimento, localizar pulseira, câmera remota e atualização de firmware ficam no QWatch Pro. O GPS dos exercícios depende do celular.

    As leituras da pulseira são estimativas de bem-estar. Pressão sem manguito não substitui a medida com aparelho de braço.

    Não habilitados para esta pulseira: peso, glicemia, ECG, temperatura e diagnóstico de arritmia. Não há suporte comprovado para essas funções no modelo identificado.
    """

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Pulseira")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(tinta)
                Text("Compatibilidade: LOKMAT H59MAX · C4001B")
                    .font(.system(size: 14))
                    .foregroundStyle(secundaria)
                    .padding(.top, 4)
                Text("Apple Saúde, Health Connect e outras plataformas ficam na tela de integrações do site.")
                    .font(.system(size: 15))
                    .foregroundStyle(verde)
                    .padding(.top, 12)

                if !conta.logada || conta.aguardandoSenha {
                    formularioConta
                } else {
                Button("Sair") { pedirSaida() }
                    .buttonStyle(.bordered)
                    .padding(.top, 8)

                VStack(alignment: .leading, spacing: 0) {
                    Text(nomeVisivel)
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(tinta)
                    Text(selo)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(verde)
                        .padding(.top, 8)
                    Text(frase)
                        .font(.system(size: 15))
                        .foregroundStyle(secundaria)
                        .padding(.top, 4)
                    Text("ÚLTIMA VEZ QUE SEUS DADOS FORAM SALVOS")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(secundaria)
                        .padding(.top, 16)
                    Text(conta.ultimaIso.map(formatar) ?? "Ainda não recebi nada")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(tinta)
                        .padding(.top, 4)
                    Text("O QUE CHEGOU NOS ÚLTIMOS 7 DIAS")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(secundaria)
                        .padding(.top, 16)
                    Text(textoChegou)
                        .font(.system(size: 15))
                        .foregroundStyle(secundaria)
                        .padding(.top, 4)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cartao)
                .padding(.top, 16)

                Text("batimentos por minuto, agora")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(tinta)
                    .padding(.top, 20)

                if sessao.fase == "conectada" || sessao.salvando {
                    VStack(spacing: 4) {
                        Text(sessao.bpm.map(String.init) ?? "—")
                            .font(.system(size: 48, weight: .bold))
                            .foregroundStyle(verde)
                            .accessibilityLabel(sessao.bpm.map { "\($0) batimentos por minuto" } ?? "Sem batimento")
                        if let contato = sessao.contato {
                            Text(contato ? "Contato com a pele." : "Sem contato com a pele.")
                                .font(.system(size: 14))
                                .foregroundStyle(secundaria)
                        }
                        if let canal = sessao.canal, !canal.isEmpty {
                            Text(canal)
                                .font(.system(size: 14))
                                .foregroundStyle(secundaria)
                        }
                        Text(textoSessao)
                            .font(.system(size: 13))
                            .foregroundStyle(secundaria)
                            .padding(.top, 4)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(16)
                    .background(cartao)
                    .padding(.top, 8)
                }

                if let erro = conta.erroEnvio {
                    Text(erro)
                        .font(.system(size: 15))
                        .foregroundStyle(aviso)
                        .padding(.top, 12)
                } else if sessao.fase == "erro" && !sessao.mensagem.isEmpty {
                    Text(sessao.mensagem)
                        .font(.system(size: 15))
                        .foregroundStyle(aviso)
                        .padding(.top, 12)
                }

                Button(rotuloBotao) { acaoBotao() }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
                    .disabled(sessao.salvando || sessao.fase == "procurando" || sessao.fase == "conectando")

                Text("Importar arquivo")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(tinta)
                    .padding(.top, 28)
                Text("funciona no iPhone também")
                    .font(.system(size: 14))
                    .foregroundStyle(secundaria)

                VStack(alignment: .leading, spacing: 8) {
                    Button("Escolher arquivo") { escolhendoArquivo = true }
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity)
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
                                .buttonStyle(.borderedProminent)
                                .frame(maxWidth: .infinity)
                        }
                        Button("Cancelar") { limparArquivo() }
                            .buttonStyle(.bordered)
                            .frame(maxWidth: .infinity)
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
                .padding(.top, 8)

                Text("Recursos da H59MAX no Encorpei")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(tinta)
                    .padding(.top, 28)
                VStack(alignment: .leading, spacing: 12) {
                    Text("Modelo identificado pela embalagem. O QWatch Pro é o aplicativo companheiro; a compatibilidade de transmissão precisa ser testada na sua unidade.")
                        .font(.system(size: 15))
                        .foregroundStyle(secundaria)
                    Text(recursosLista)
                        .font(.system(size: 15))
                        .foregroundStyle(tinta)
                    Text(recursosFim)
                        .font(.system(size: 15))
                        .foregroundStyle(secundaria)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(cartao)
                .padding(.top, 8)

                Button("Ajuda e detalhes do aparelho") { ajudaAberta.toggle() }
                    .buttonStyle(.bordered)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 20)
                if ajudaAberta {
                    Text("Cada aparelho desses vem de um lote diferente e nem todos falam a mesma língua. Este teste identifica os serviços Bluetooth disponíveis. Isso não comprova que todos os dados possam ser importados.\n\nO teste que lista todos os serviços continua na tela do site. Aqui a seção de conexão só mantém o batimento ao vivo.")
                        .font(.system(size: 15))
                        .foregroundStyle(tinta)
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(cartao)
                        .padding(.top, 8)
                }
                }
            }
            .padding(20)
        }
        .background(fundo)
        .onChange(of: scenePhase) { _, fase in
            sessao.cenaMudou(ativa: fase == .active)
        }
        .onAppear {
            sessao.ligar(conta)
            if conta.logada { conta.carregarPainel() }
        }
        .onChange(of: conta.gravadas) { _, _ in
            if conta.logada { conta.carregarPainel() }
        }
        .onChange(of: conta.logada) { _, logada in
            if logada { conta.carregarPainel() }
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
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
                .disabled(entrando)
            if modoEfetivo == "entrar" {
                Button("Criar minha conta") { modo = "criar"; loginMsg = "" }
                    .buttonStyle(.bordered)
                Button("Esqueci a senha") { modo = "esqueci"; loginMsg = "" }
                    .buttonStyle(.bordered)
                Text("Se o e-mail não abrir o app, cole o link aqui e toque em Entrar.")
                    .font(.system(size: 13))
                    .foregroundStyle(secundaria)
            } else if modoEfetivo == "criar" {
                Button("Reenviar e-mail") { reenviar() }
                    .buttonStyle(.bordered)
                Button("Já tenho conta") { modo = "entrar"; loginMsg = "" }
                    .buttonStyle(.bordered)
            } else if modoEfetivo != "senha" {
                Button("Já tenho conta") { modo = "entrar"; loginMsg = "" }
                    .buttonStyle(.bordered)
            }
            if !loginMsg.isEmpty {
                Text(loginMsg).font(.system(size: 15)).foregroundStyle(aviso)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cartao)
        .padding(.top, 16)
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

    private var fundo: Color { Color(red: 0.957, green: 0.945, blue: 0.918) }
    private var tinta: Color { Color(red: 0.110, green: 0.141, blue: 0.188) }
    private var secundaria: Color { Color(red: 0.243, green: 0.290, blue: 0.349) }
    private var verde: Color { Color(red: 0.059, green: 0.431, blue: 0.337) }
    private var aviso: Color { Color(red: 0.420, green: 0.243, blue: 0.071) }
    private var cartao: Color { Color(red: 1, green: 0.988, blue: 0.969) }
}
