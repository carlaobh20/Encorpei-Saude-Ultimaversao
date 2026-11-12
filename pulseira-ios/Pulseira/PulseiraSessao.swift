import CoreBluetooth
import Foundation

/// Segura o GATT com o app fora da tela. O iOS faz isso pelo modo
/// `bluetooth-central`, não por um serviço permanente. O protocolo é o de `Protocolo`.
final class PulseiraSessao: NSObject, ObservableObject {
    static let restoreId = "saude.encorpei.pulseira"
    private static let repetirMedicao: TimeInterval = 1.5
    /// Política da sessão, não do protocolo da pulseira. Igual ao app Android.
    private static let reconexao: TimeInterval = 2
    private static let tentativasEndereco = 3

    @Published var fase = "parada"
    @Published var nome: String?
    @Published var bpm: Int?
    @Published var canal: String?
    @Published var contato: Bool?
    @Published var mensagem = "Desligada. Toque em conectar para segurar o Bluetooth."
    @Published var salvando = false

    var conta: Conta?
    private var rrJanela: [Int] = []
    private var temAmostra = false
    private var ultimoBpm = 0
    private var ultimoContato: Bool?
    private var ultimoRmssd: Double?
    private var ultimoSdnn: Double?

    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var rx: CBCharacteristic?
    private var tx: CBCharacteristic?
    private var pendentes = 0
    private var canalColmiAtivo = false
    private var aoVivo = false
    private var parado = false
    private var semBatimento = 0
    private var falhas = 0
    private var reconectar = false
    private var userStop = false
    private var desligando = false
    private var escaneando = false
    private var emPrimeiroPlano = true
    private var quedaItem: DispatchWorkItem?
    private var medicaoItem: DispatchWorkItem?
    private var avisoItem: DispatchWorkItem?

    private let hrService = CBUUID(nsuuid: Protocolo.heartRateService)
    private let hrMeasurement = CBUUID(nsuuid: Protocolo.heartRateMeasurement)
    private let servicosConhecidos: [CBUUID]

    override init() {
        servicosConhecidos = [
            CBUUID(nsuuid: Protocolo.heartRateService),
            CBUUID(nsuuid: Protocolo.colmiService),
            CBUUID(nsuuid: Protocolo.colmiServiceAlt),
            CBUUID(nsuuid: Protocolo.colmiServiceVar),
        ]
        super.init()
        central = CBCentralManager(
            delegate: self,
            queue: .main,
            options: [
                CBCentralManagerOptionRestoreIdentifierKey: Self.restoreId,
                CBCentralManagerOptionShowPowerAlertKey: true,
            ] as [String: Any]
        )
    }

    func ligar(_ conta: Conta) {
        self.conta = conta
    }

    func conectar() {
        conta?.reiniciarSessao()
        userStop = false
        desligando = false
        reconectar = true
        falhas = 0
        UserDefaults.standard.set(true, forKey: "ativo")
        comecar()
    }

    func desligar() {
        guard !desligando else { return }
        desligando = true
        userStop = true
        reconectar = false
        UserDefaults.standard.set(false, forKey: "ativo")
        medicaoItem?.cancel()
        quedaItem?.cancel()
        avisoItem?.cancel()
        pararBusca()
        parado = true
        aoVivo = false
        let tem = temAmostra
        let nomeSalvo = nome
        let bpmSalvo = ultimoBpm
        let contatoSalvo = ultimoContato
        let rmssdSalvo = ultimoRmssd
        let sdnnSalvo = ultimoSdnn
        salvando = tem
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            if tem {
                self?.conta?.gravar(nome: nomeSalvo, bpm: bpmSalvo, contato: contatoSalvo, rmssd: rmssdSalvo, sdnn: sdnnSalvo, forcar: true)
            }
            DispatchQueue.main.async { self?.cortarLink() }
        }
    }

    private func cortarLink() {
        salvando = false
        if let peripheral, peripheral.state == .connected, let rx, canalColmiAtivo {
            escrever(rx, Protocolo.pacotePararBatimento())
            DispatchQueue.main.asyncAfter(deadline: .now() + Self.repetirMedicao) { [weak self] in
                self?.encerrar()
            }
        } else {
            encerrar()
        }
    }

    func cenaMudou(ativa: Bool) {
        emPrimeiroPlano = ativa
        guard escaneando else { return }
        iniciarBusca()
    }

    private func comecar() {
        guard central.state == .poweredOn else {
            falhar(mensagemDoRadio(central.state))
            return
        }
        reconectar = true
        if let salvo = UserDefaults.standard.string(forKey: "endereco"),
           let uuid = UUID(uuidString: salvo) {
            let achados = central.retrievePeripherals(withIdentifiers: [uuid])
            if let device = achados.first {
                conectar(device)
                return
            }
        }
        iniciarBusca()
    }

    private func iniciarBusca() {
        guard central.state == .poweredOn else {
            falhar(mensagemDoRadio(central.state))
            return
        }
        central.stopScan()
        fase = "procurando"
        mensagem = "Procurando a pulseira."
        bpm = nil
        canal = nil
        contato = nil
        escaneando = true
        // Em primeiro plano a lista é aberta e o filtro é o nome, como no Android.
        // Em segundo plano o iOS só entrega quem anuncia um serviço conhecido.
        let filtro: [CBUUID]? = emPrimeiroPlano ? nil : servicosConhecidos
        central.scanForPeripherals(withServices: filtro, options: nil)
        avisoItem?.cancel()
        let aviso = DispatchWorkItem { [weak self] in
            guard let self, self.fase == "procurando" else { return }
            self.mensagem = "Ainda procurando. Deixe a pulseira perto do iPhone."
        }
        avisoItem = aviso
        DispatchQueue.main.asyncAfter(deadline: .now() + 15, execute: aviso)
    }

    private func conectar(_ device: CBPeripheral) {
        pararBusca()
        fase = "conectando"
        mensagem = "Conectando."
        peripheral = device
        device.delegate = self
        UserDefaults.standard.set(device.identifier.uuidString, forKey: "endereco")
        if let anunciado = device.name, !anunciado.isEmpty { nome = anunciado }
        central.connect(device, options: nil)
    }

    private func pararBusca() {
        avisoItem?.cancel()
        escaneando = false
        central?.stopScan()
    }

    private func escrever(_ ch: CBCharacteristic, _ pacote: [UInt8]) {
        guard let peripheral else {
            if desligando { encerrar() }
            return
        }
        let tipo: CBCharacteristicWriteType = ch.properties.contains(.writeWithoutResponse) ? .withoutResponse : .withResponse
        peripheral.writeValue(Data(pacote), for: ch, type: tipo)
    }

    private func montarCanal() {
        guard let peripheral, let services = peripheral.services else {
            falhouCanal("A pulseira conectou, mas o iPhone não mostrou os canais dela. Toque em conectar e escolha a pulseira outra vez.")
            return
        }
        let ordenados = services.sorted {
            Protocolo.ordemServico(uuidFoundation($0.uuid)) < Protocolo.ordemServico(uuidFoundation($1.uuid))
        }
        if let hr = ordenados.first(where: { $0.uuid == hrService }),
           let medicao = hr.characteristics?.first(where: { $0.uuid == hrMeasurement }),
           prepararPadrao(medicao) {
            return
        }
        if ligarColmi(ordenados) { return }
        falhouCanal(mensagemSemCanal(ordenados))
    }

    private func prepararPadrao(_ medicao: CBCharacteristic) -> Bool {
        guard let peripheral else { return false }
        canalColmiAtivo = false
        rx = nil
        tx = medicao
        canal = Protocolo.nomeCanalPadrao
        peripheral.setNotifyValue(true, for: medicao)
        return true
    }

    private func ligarColmi(_ services: [CBService]) -> Bool {
        guard let par = acharColmi(services), let peripheral else { return false }
        rx = par.rx
        tx = par.tx
        canalColmiAtivo = true
        canal = Protocolo.nomeCanalColmi
        peripheral.setNotifyValue(true, for: par.tx)
        return true
    }

    private func acharColmi(_ services: [CBService]) -> (rx: CBCharacteristic, tx: CBCharacteristic)? {
        for svc in services {
            let chars = svc.characteristics ?? []
            let escrita = chars.first { prefixo($0.uuid, Protocolo.rxPrefixo) }
            let aviso = chars.first { prefixo($0.uuid, Protocolo.txPrefixo) }
            if let escrita, let aviso { return (escrita, aviso) }
        }
        for svc in services where Protocolo.canalColmi(uuidFoundation(svc.uuid)) {
            let chars = svc.characteristics ?? []
            let aviso = chars.first { $0.properties.contains(.notify) || $0.properties.contains(.indicate) }
            let escrita = chars.first { $0.properties.contains(.write) || $0.properties.contains(.writeWithoutResponse) }
            if let escrita, let aviso { return (escrita, aviso) }
        }
        return nil
    }

    private func mensagemSemCanal(_ services: [CBService]) -> String {
        let vistos = Protocolo.rotuloCanais(services.map { prefixo8($0.uuid) })
        if vistos.isEmpty {
            return "A pulseira conectou, mas o iPhone não mostrou os canais dela. Toque em conectar e escolha a pulseira outra vez."
        }
        return "A pulseira conectou, mas nenhum canal entregou batimentos. Canais vistos: \(vistos)."
    }

    private func anotar(bpm valor: Int, contato pele: Bool?, rr: [Int]?) {
        if userStop { return }
        bpm = valor
        contato = pele
        if let rr {
            rrJanela.append(contentsOf: rr)
            if rrJanela.count > 60 { rrJanela.removeFirst(rrJanela.count - 60) }
        }
        temAmostra = true
        ultimoBpm = valor
        ultimoContato = pele
        ultimoRmssd = rr == nil ? nil : Protocolo.calcularRmssd(rrJanela)
        ultimoSdnn = rr == nil ? nil : Protocolo.calcularSdnn(rrJanela)
        mensagem = "Conectada. O Bluetooth continua com a tela fechada."
        let nomeSalvo = nome
        let rm = ultimoRmssd
        let sd = ultimoSdnn
        DispatchQueue.global(qos: .utility).async { [weak self] in
            guard let self, !self.userStop else { return }
            self.conta?.gravar(nome: nomeSalvo, bpm: valor, contato: pele, rmssd: rm, sdnn: sd, forcar: false)
        }
    }

    private func tratarPadrao(_ value: [UInt8]) {
        guard let amostra = Protocolo.lerPadrao(value), Protocolo.fcPlausivel(amostra.bpm) else { return }
        anotar(bpm: amostra.bpm, contato: amostra.contato, rr: amostra.rr)
    }

    private func tratarColmi(_ pacote: [UInt8]) {
        guard !parado, aoVivo else { return }
        if let lido = Protocolo.lerBatimentoColmi(pacote) {
            guard Protocolo.fcPlausivel(lido) else { return }
            semBatimento = 0
            medicaoItem?.cancel()
            anotar(bpm: lido, contato: nil, rr: nil)
            return
        }
        guard Protocolo.medicaoColmiEncerrou(pacote) else { return }
        if semBatimento >= 2 {
            mensagem = "Sem batimento novo. Parei de pedir para o LED não ficar piscando. O Bluetooth continua conectado."
            return
        }
        semBatimento += 1
        medicaoItem?.cancel()
        let item = DispatchWorkItem { [weak self] in self?.repetirMedicao() }
        medicaoItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.repetirMedicao, execute: item)
    }

    private func repetirMedicao() {
        guard !userStop, aoVivo, let rx else { return }
        escrever(rx, Protocolo.pacoteIniciarBatimento())
    }

    private func aoCair() {
        guard reconectar, !userStop, quedaItem == nil else { return }
        let item = DispatchWorkItem { [weak self] in self?.cairAgora() }
        quedaItem = item
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.reconexao, execute: item)
    }

    private func cairAgora() {
        quedaItem = nil
        guard reconectar, !userStop else { return }
        medicaoItem?.cancel()
        bpm = nil
        canal = nil
        contato = nil
        aoVivo = false
        falhas += 1
        let endereco = peripheral?.identifier ?? UUID(uuidString: UserDefaults.standard.string(forKey: "endereco") ?? "")
        if let endereco, falhas <= Self.tentativasEndereco,
           let device = central.retrievePeripherals(withIdentifiers: [endereco]).first {
            fase = "conectando"
            mensagem = "O link caiu. Tentando de novo."
            conectar(device)
        } else {
            falhas = 0
            UserDefaults.standard.removeObject(forKey: "endereco")
            peripheral = nil
            iniciarBusca()
        }
    }

    private func falhouCanal(_ texto: String) {
        reconectar = false
        UserDefaults.standard.removeObject(forKey: "endereco")
        if let peripheral { central.cancelPeripheralConnection(peripheral) }
        self.peripheral = nil
        rx = nil
        tx = nil
        fase = "erro"
        mensagem = texto
        bpm = nil
        canal = nil
        contato = nil
    }

    private func falhar(_ texto: String) {
        reconectar = false
        pararBusca()
        fase = "erro"
        mensagem = texto
        bpm = nil
        canal = nil
        contato = nil
    }

    private func encerrar() {
        guard desligando else { return }
        desligando = false
        let device = peripheral
        peripheral = nil
        rx = nil
        tx = nil
        fase = "parada"
        nome = nil
        temAmostra = false
        rrJanela.removeAll()
        bpm = nil
        canal = nil
        contato = nil
        mensagem = "Desligada. Toque em conectar para segurar o Bluetooth."
        if let device, device.state == .connected || device.state == .connecting {
            central.cancelPeripheralConnection(device)
        }
    }

    private func mensagemDoRadio(_ state: CBManagerState) -> String {
        switch state {
        case .poweredOff:
            return "O Bluetooth deste iPhone está desligado. Ligue e toque em conectar de novo."
        case .unauthorized:
            return "Sem a permissão de Bluetooth a pulseira não é procurada. Pode conceder nas configurações do app."
        case .unsupported:
            return "Este iPhone não tem Bluetooth."
        default:
            return "O Bluetooth ainda não está pronto. Toque em conectar de novo."
        }
    }

    private func prefixo(_ uuid: CBUUID, _ prefixo: String) -> Bool {
        let s = uuid.uuidString.lowercased().replacingOccurrences(of: "-", with: "")
        return s.hasPrefix(prefixo.lowercased())
    }

    private func prefixo8(_ uuid: CBUUID) -> String {
        let s = uuid.uuidString.lowercased().replacingOccurrences(of: "-", with: "")
        if s.count >= 8 { return String(s.prefix(8)) }
        return s
    }

    /// CBUUID de 16 bits vira a forma curta. Para ordenar, usa o UUID de 128 bits quando bate com os conhecidos.
    private func uuidFoundation(_ uuid: CBUUID) -> UUID {
        let conhecidos = [
            Protocolo.heartRateService, Protocolo.heartRateMeasurement,
            Protocolo.colmiService, Protocolo.colmiServiceAlt, Protocolo.colmiServiceVar,
        ]
        if let igual = conhecidos.first(where: { CBUUID(nsuuid: $0) == uuid }) {
            return igual
        }
        return UUID(uuidString: uuid.uuidString) ?? Protocolo.heartRateService
    }
}

extension PulseiraSessao: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            if UserDefaults.standard.bool(forKey: "ativo"), peripheral == nil, !escaneando, fase != "conectada" {
                comecar()
            }
            return
        }
        if UserDefaults.standard.bool(forKey: "ativo") || fase == "procurando" || fase == "conectando" || fase == "conectada" {
            falhar(mensagemDoRadio(central.state))
        }
    }

    func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        let lista = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] ?? []
        guard UserDefaults.standard.bool(forKey: "ativo"), let device = lista.first else {
            for device in lista { central.cancelPeripheralConnection(device) }
            return
        }
        reconectar = true
        userStop = false
        peripheral = device
        device.delegate = self
        nome = device.name
        fase = device.state == .connected ? "conectada" : "conectando"
        mensagem = "Conectada. O Bluetooth continua com a tela fechada."
        if device.state == .connected {
            device.discoverServices(nil)
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi _: NSNumber) {
        guard escaneando, !userStop else { return }
        let local = advertisementData[CBAdvertisementDataLocalNameKey] as? String
        let anunciado = local ?? peripheral.name
        let uuids = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []).map(\.uuidString)
        guard Protocolo.anuncioCompativel(nome: anunciado, uuids: uuids) else { return }
        if let anunciado, !anunciado.isEmpty { nome = anunciado }
        conectar(peripheral)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        falhas = 0
        self.peripheral = peripheral
        peripheral.delegate = self
        fase = "conectando"
        mensagem = "Conectada. Procurando o canal de batimentos."
        if let anunciado = peripheral.name, !anunciado.isEmpty { nome = anunciado }
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        aoCair()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        if userStop {
            if desligando { encerrar() }
            return
        }
        aoCair()
    }
}

extension PulseiraSessao: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard self.peripheral === peripheral else { return }
        if error != nil || peripheral.services == nil {
            aoCair()
            return
        }
        let services = peripheral.services ?? []
        if services.isEmpty {
            falhouCanal(mensagemSemCanal(services))
            return
        }
        pendentes = services.count
        for service in services {
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard self.peripheral === peripheral else { return }
        pendentes -= 1
        if pendentes <= 0 { montarCanal() }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard self.peripheral === peripheral, !userStop else { return }
        if error != nil {
            if !canalColmiAtivo, ligarColmi(peripheral.services ?? []) { return }
            falhouCanal("A pulseira conectou, mas o iPhone não ativou os avisos do canal.")
            return
        }
        if canalColmiAtivo {
            aoVivo = true
            parado = false
            semBatimento = 0
            if nome == nil || nome?.isEmpty == true { nome = "Pulseira" }
            fase = "conectada"
            mensagem = "Conectada. Pedindo batimento."
            if let rx { escrever(rx, Protocolo.pacoteIniciarBatimento()) }
        } else {
            if nome == nil || nome?.isEmpty == true { nome = "Pulseira" }
            fase = "conectada"
            mensagem = "Conectada. O Bluetooth continua com a tela fechada."
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, let data = characteristic.value else { return }
        let bytes = [UInt8](data)
        if characteristic.uuid == hrMeasurement {
            tratarPadrao(bytes)
            return
        }
        if let tx, characteristic.uuid == tx.uuid {
            tratarColmi(bytes)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
        if desligando {
            encerrar()
            return
        }
        if error != nil, canalColmiAtivo {
            mensagem = "Conectada, mas o pedido de batimento (comando 105) não foi aceito."
        }
    }
}
