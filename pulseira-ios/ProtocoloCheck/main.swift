import Foundation

func hex(_ p: [UInt8]) -> String {
    p.map { String(format: "%02x", $0) }.joined(separator: " ")
}

func igual(_ achou: String, _ esperava: String, _ nome: String) {
    if achou != esperava { fatalError("\(nome) achou \(achou)") }
}

igual(hex(Protocolo.pacoteIniciarBatimento()),
      "69 01 01 00 00 00 00 00 00 00 00 00 00 00 00 6b", "iniciar")
igual(hex(Protocolo.pacotePararBatimento()),
      "6a 01 00 00 00 00 00 00 00 00 00 00 00 00 00 6b", "parar")
if Protocolo.pacoteIniciarBatimento().count != 16 { fatalError("tamanho") }
if Protocolo.pacoteIniciarBatimento()[0] != UInt8(Protocolo.cmdRealtime) { fatalError("cmd 105") }
if Protocolo.pacotePararBatimento()[0] != UInt8(Protocolo.cmdRealtimeParar) { fatalError("cmd 106") }

igual(hex(Protocolo.pacoteColmi(cmd: 105, args: [1, 1, 5])),
      "69 01 01 05 00 00 00 00 00 00 00 00 00 00 00 70", "checksum")
let cortado = Protocolo.pacoteColmi(cmd: 105, args: Array(repeating: 1, count: 15))
if cortado[14] != 1 { fatalError("15º argumento entrou") }
if cortado[15] != UInt8((105 + 14) & 0xff) { fatalError("checksum com corte") }

if Protocolo.lerBatimentoColmi([105, 1, 0, 72]) != 72 { fatalError("colmi 72") }
if Protocolo.lerBatimentoColmi([105, 1, 0, 0]) != nil { fatalError("colmi zero") }
if Protocolo.lerBatimentoColmi([105, 1, 1, 72]) != nil { fatalError("colmi fim") }
if Protocolo.lerBatimentoColmi([105, 2, 0, 72]) != nil { fatalError("colmi tipo") }
if Protocolo.lerBatimentoColmi([21, 1, 0, 72]) != nil { fatalError("colmi 21") }
if Protocolo.lerBatimentoColmi([105, 1]) != nil { fatalError("colmi curto") }
if !Protocolo.medicaoColmiEncerrou([105, 1, 1]) { fatalError("encerrou") }
if Protocolo.medicaoColmiEncerrou([105, 1, 0]) { fatalError("nao encerrou") }
if Protocolo.medicaoColmiEncerrou([105, 1]) { fatalError("encerrou curto") }

if Protocolo.fcPlausivel(24) || !Protocolo.fcPlausivel(25) { fatalError("fc 25") }
if !Protocolo.fcPlausivel(240) || Protocolo.fcPlausivel(241) { fatalError("fc 240") }

let u8 = Protocolo.lerPadrao([0x00, 60])
if u8?.bpm != 60 || u8?.contato != nil { fatalError("hr u8") }
let u16 = Protocolo.lerPadrao([0x01, 0xF0, 0x00])
if u16?.bpm != 240 { fatalError("hr u16") }
if Protocolo.lerPadrao([0x01, 0x10]) != nil { fatalError("hr u16 curto") }
if Protocolo.lerPadrao([0x08, 55, 0x00, 0x00])?.bpm != 55 { fatalError("hr energia") }
if Protocolo.lerPadrao([0x10, 60, 0x00, 0x04])?.bpm != 60 { fatalError("hr rr") }
if Protocolo.lerPadrao([0x06, 70])?.contato != true { fatalError("contato sim") }
if Protocolo.lerPadrao([0x04, 70])?.contato != false { fatalError("contato nao") }

let prefixos = ["H59", "H-59", "H59 Max", "QWatch", "QCWireless", "Smart Band", "WearFit", "R3L", "TEK"]
if Protocolo.prefixos != prefixos { fatalError("prefixos") }
if !Protocolo.nomeCompativel("H59MAX") || !Protocolo.nomeCompativel("QWatch Pro") { fatalError("nome sim") }
if Protocolo.nomeCompativel("QH59") || Protocolo.nomeCompativel("Mi Band") || Protocolo.nomeCompativel(nil) {
    fatalError("nome nao")
}

if Protocolo.heartRateService.uuidString.lowercased() != "0000180d-0000-1000-8000-00805f9b34fb" { fatalError("180d") }
if Protocolo.heartRateMeasurement.uuidString.lowercased() != "00002a37-0000-1000-8000-00805f9b34fb" { fatalError("2a37") }
if !Protocolo.canalColmi(Protocolo.colmiService)
    || !Protocolo.canalColmi(Protocolo.colmiServiceAlt)
    || !Protocolo.canalColmi(Protocolo.colmiServiceVar) { fatalError("canal colmi") }
if Protocolo.canalColmi(Protocolo.heartRateService) { fatalError("180d nao e colmi") }
if Protocolo.ordemServico(Protocolo.colmiService) != 0
    || Protocolo.ordemServico(Protocolo.colmiServiceVar) != 1
    || Protocolo.ordemServico(Protocolo.heartRateService) != 2 { fatalError("ordem") }
let rx = UUID(uuidString: "6e400002-b5a3-f393-e0a9-e50e24dcca9e")!
let tx = UUID(uuidString: "6e400003-b5a3-f393-e0a9-e50e24dcca9e")!
if !Protocolo.prefixoCaracteristica(rx, Protocolo.rxPrefixo)
    || !Protocolo.prefixoCaracteristica(tx, Protocolo.txPrefixo) { fatalError("prefixo uart") }
if Protocolo.rotuloCanais(["0000180d", "6e40fff0"]) != "180d, 6e40fff0" { fatalError("rotulo") }
if !Protocolo.anuncioCompativel(nome: "H59MAX", uuids: []) { fatalError("anuncio nome") }
if !Protocolo.anuncioCompativel(nome: nil, uuids: ["180D"]) { fatalError("anuncio 180d") }
if !Protocolo.anuncioCompativel(nome: nil, uuids: ["6E40FFF0-B5A3-F393-E0A9-E50E24DCCA9E"]) { fatalError("anuncio colmi") }
if Protocolo.anuncioCompativel(nome: "Mi Band", uuids: []) { fatalError("anuncio nao") }

print("PASS protocolo")
