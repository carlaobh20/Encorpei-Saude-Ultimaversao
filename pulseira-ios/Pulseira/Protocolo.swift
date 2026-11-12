import Foundation

/// Cópia de `pulseira-android` `Protocolo.java`, que por sua vez copia
/// `src/lib/wearable/h59Protocol.ts` e `bleClient.ts`.
/// Pacote de 16 bytes, comandos 105 e 106, os mesmos UUIDs e prefixos.
enum Protocolo {
    static let heartRateService = UUID(uuidString: "0000180d-0000-1000-8000-00805f9b34fb")!
    /// Característica 0x2A37.
    static let heartRateMeasurement = UUID(uuidString: "00002a37-0000-1000-8000-00805f9b34fb")!
    static let colmiService = UUID(uuidString: "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e")!
    static let colmiServiceAlt = UUID(uuidString: "6e400001-b5a3-f393-e0a9-e50e24dcca9e")!
    static let colmiServiceVar = UUID(uuidString: "6e400001-b5a3-f393-e0a9-e50e24dcca9f")!

    static let rxPrefixo = "6e400002"
    static let txPrefixo = "6e400003"

    static let cmdRealtime = 105
    static let cmdRealtimeParar = 106
    static let tipoBatimento = 1

    static let prefixos = [
        "H59", "H-59", "H59 Max", "QWatch", "QCWireless", "Smart Band", "WearFit", "R3L", "TEK",
    ]

    static let nomeCanalPadrao = "Frequência cardíaca (padrão Bluetooth)"
    static let nomeCanalColmi = "Canal da pulseira (batimentos)"

    struct AmostraPadrao {
        let bpm: Int
        let contato: Bool?
        /// Intervalos RR em milissegundos. Vazio quando o pacote não traz RR.
        let rr: [Int]
    }

    static func nomeCompativel(_ nome: String?) -> Bool {
        guard let nome else { return false }
        return prefixos.contains { nome.hasPrefix($0) }
    }

    static func prefixo8(_ uuid: UUID) -> String {
        let limpo = uuid.uuidString.lowercased().replacingOccurrences(of: "-", with: "")
        return String(limpo.prefix(8))
    }

    static func canalColmi(_ uuid: UUID) -> Bool {
        let id = prefixo8(uuid)
        return id == "6e40fff0" || id == "6e400001"
    }

    /// Ordem de listarServicos: 6e40fff0, depois 6e400001, depois o resto.
    static func ordemServico(_ uuid: UUID) -> Int {
        let id = prefixo8(uuid)
        if id == "6e40fff0" { return 0 }
        if id == "6e400001" { return 1 }
        return 2
    }

    static func prefixoCaracteristica(_ uuid: UUID, _ prefixo: String) -> Bool {
        uuid.uuidString.lowercased().hasPrefix(prefixo.lowercased())
    }

    /// Nome anunciado, serviço 0000180d, ou canal Colmi já conhecido.
    /// O Colmi entra porque o iOS, em segundo plano, pode omitir o nome.
    static func anuncioCompativel(nome: String?, uuids: [String]) -> Bool {
        if nomeCompativel(nome) { return true }
        for bruto in uuids {
            let id = bruto.lowercased().replacingOccurrences(of: "-", with: "")
            if id == "180d" || id.hasPrefix("0000180d") || id.hasPrefix("6e40fff0") || id.hasPrefix("6e400001") {
                return true
            }
        }
        return false
    }

    static func rotuloCanais(_ prefixos: [String]) -> String {
        var vistos: [String] = []
        for p in prefixos {
            let x = p.lowercased()
            let rotulo = x.hasPrefix("0000") ? String(x.dropFirst(4)) : x
            if !vistos.contains(rotulo) { vistos.append(rotulo) }
        }
        return vistos.joined(separator: ", ")
    }

    /// 16 bytes: comando, argumentos, checksum dos 15 primeiros no fim.
    static func pacoteColmi(cmd: Int, args: [Int] = []) -> [UInt8] {
        var p = [UInt8](repeating: 0, count: 16)
        p[0] = UInt8(cmd & 0xff)
        for (i, b) in args.enumerated() where i < 14 {
            p[i + 1] = UInt8(b & 0xff)
        }
        var soma = 0
        for i in 0..<15 {
            soma = (soma + Int(p[i])) & 0xff
        }
        p[15] = UInt8(soma)
        return p
    }

    static func pacoteIniciarBatimento() -> [UInt8] {
        pacoteColmi(cmd: cmdRealtime, args: [tipoBatimento, 1])
    }

    static func pacotePararBatimento() -> [UInt8] {
        pacoteColmi(cmd: cmdRealtimeParar, args: [tipoBatimento, 0, 0])
    }

    static func lerBatimentoColmi(_ data: [UInt8]?) -> Int? {
        guard let data, data.count >= 4 else { return nil }
        if data[0] != UInt8(cmdRealtime) { return nil }
        if data[1] != UInt8(tipoBatimento) { return nil }
        if data[2] != 0 { return nil }
        let bpm = Int(data[3])
        return bpm > 0 ? bpm : nil
    }

    static func medicaoColmiEncerrou(_ data: [UInt8]?) -> Bool {
        guard let data, data.count >= 3 else { return false }
        return data[0] == UInt8(cmdRealtime)
            && data[1] == UInt8(tipoBatimento)
            && data[2] != 0
    }

    static func fcPlausivel(_ bpm: Int) -> Bool {
        bpm >= 25 && bpm <= 240
    }

    /// Mesma conta de calcularRmssd em h59Protocol.ts. Menos de 3 intervalos → nulo.
    static func calcularRmssd(_ rr: [Int]) -> Double? {
        guard rr.count >= 3 else { return nil }
        var soma = 0.0
        for i in 1..<rr.count {
            let d = Double(rr[i] - rr[i - 1])
            soma += d * d
        }
        return (sqrt(soma / Double(rr.count - 1)) * 10).rounded() / 10
    }

    /// Mesma conta de calcularSdnn em h59Protocol.ts.
    static func calcularSdnn(_ rr: [Int]) -> Double? {
        guard rr.count >= 3 else { return nil }
        let media = Double(rr.reduce(0, +)) / Double(rr.count)
        let varia = rr.reduce(0.0) { $0 + pow(Double($1) - media, 2) }
        return (sqrt(varia / Double(rr.count - 1)) * 10).rounded() / 10
    }

    /// BPM e contato do Heart Rate Measurement (0x2A37).
    /// O BPM vem logo após as flags; energia e RR não mudam esse lugar.
    static func lerPadrao(_ value: [UInt8]?) -> AmostraPadrao? {
        guard let value, value.count >= 2 else { return nil }
        let flags = Int(value[0])
        let is16 = (flags & 0x01) != 0
        if is16 && value.count < 3 { return nil }
        let bpm = is16 ? Int(value[1]) | (Int(value[2]) << 8) : Int(value[1])
        let contactBits = (flags >> 1) & 0x03
        let contato: Bool? = contactBits < 2 ? nil : contactBits == 3
        var offset = is16 ? 3 : 2
        if (flags & 0x08) != 0 { offset += 2 }
        var rr: [Int] = []
        if (flags & 0x10) != 0, offset + 1 < value.count {
            while offset + 1 < value.count {
                let raw = Int(value[offset]) | (Int(value[offset + 1]) << 8)
                rr.append(Int((Double(raw) / 1024 * 1000).rounded()))
                offset += 2
            }
        }
        return AmostraPadrao(bpm: bpm, contato: contato, rr: rr)
    }
}
