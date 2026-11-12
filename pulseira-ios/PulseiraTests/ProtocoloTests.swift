import XCTest
@testable import Pulseira

final class ProtocoloTests: XCTestCase {
    func testPacotes() {
        XCTAssertEqual(hex(Protocolo.pacoteIniciarBatimento()), "69 01 01 00 00 00 00 00 00 00 00 00 00 00 00 6b")
        XCTAssertEqual(hex(Protocolo.pacotePararBatimento()), "6a 01 00 00 00 00 00 00 00 00 00 00 00 00 00 6b")
        XCTAssertEqual(Protocolo.pacoteIniciarBatimento().count, 16)
        XCTAssertEqual(Protocolo.pacoteIniciarBatimento()[0], UInt8(Protocolo.cmdRealtime))
        XCTAssertEqual(Protocolo.pacotePararBatimento()[0], UInt8(Protocolo.cmdRealtimeParar))
        XCTAssertEqual(hex(Protocolo.pacoteColmi(cmd: 105, args: [1, 1, 5])), "69 01 01 05 00 00 00 00 00 00 00 00 00 00 00 70")
    }

    func testLeitura() {
        XCTAssertEqual(Protocolo.lerBatimentoColmi([105, 1, 0, 72]), 72)
        XCTAssertNil(Protocolo.lerBatimentoColmi([105, 1, 0, 0]))
        XCTAssertNil(Protocolo.lerBatimentoColmi([21, 1, 0, 72]))
        XCTAssertTrue(Protocolo.medicaoColmiEncerrou([105, 1, 1]))
        XCTAssertFalse(Protocolo.medicaoColmiEncerrou([105, 1, 0]))
        XCTAssertFalse(Protocolo.fcPlausivel(24))
        XCTAssertTrue(Protocolo.fcPlausivel(25))
        XCTAssertTrue(Protocolo.fcPlausivel(240))
        XCTAssertFalse(Protocolo.fcPlausivel(241))
        XCTAssertEqual(Protocolo.lerPadrao([0x00, 60])?.bpm, 60)
        XCTAssertNil(Protocolo.lerPadrao([0x00, 60])?.contato)
        XCTAssertEqual(Protocolo.lerPadrao([0x01, 0xF0, 0x00])?.bpm, 240)
        XCTAssertEqual(Protocolo.lerPadrao([0x06, 70])?.contato, true)
        XCTAssertEqual(Protocolo.lerPadrao([0x04, 70])?.contato, false)
        XCTAssertEqual(Protocolo.lerPadrao([0x10, 60, 0x00, 0x04])?.rr, [1000])
    }

    func testNomes() {
        XCTAssertTrue(Protocolo.nomeCompativel("H59MAX"))
        XCTAssertFalse(Protocolo.nomeCompativel("QH59"))
        XCTAssertFalse(Protocolo.canalColmi(Protocolo.heartRateService))
        XCTAssertTrue(Protocolo.canalColmi(Protocolo.colmiService))
        XCTAssertEqual(Protocolo.rotuloCanais(["0000180d", "6e40fff0"]), "180d, 6e40fff0")
    }

    private func hex(_ p: [UInt8]) -> String {
        p.map { String(format: "%02x", $0) }.joined(separator: " ")
    }
}
