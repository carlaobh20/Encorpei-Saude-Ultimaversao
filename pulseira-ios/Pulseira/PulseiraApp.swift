import SwiftUI

@main
struct PulseiraApp: App {
    @StateObject private var sessao = PulseiraSessao()
    @StateObject private var conta = Conta()

    var body: some Scene {
        WindowGroup {
            ContentView(sessao: sessao, conta: conta)
                .onOpenURL { url in
                    let bruto = url.absoluteString
                    DispatchQueue.global(qos: .userInitiated).async {
                        _ = conta.abrirLink(bruto)
                    }
                }
        }
    }
}
