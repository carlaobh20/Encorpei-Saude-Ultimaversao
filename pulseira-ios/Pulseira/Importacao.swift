import Foundation

/// A mesma leitura de CSV de `src/lib/wearable/importer.ts`. Não pede nada por Bluetooth.
enum Importacao {
    static let notaPa = "Estimativa por sensor óptico de pulso — sem manguito, sem validação clínica. Não usar para decisão terapêutica nem para média de MRPA."
    static let nomeArquivo = "Pulseira (arquivo importado)"

    private static let campos = [
        "recordedAt", "deepMinutes", "lightMinutes", "remMinutes", "awakeMinutes", "sleepMinutes",
        "awakenings", "efficiencyPct", "minHeartRate", "minSpo2",
        "systolic", "diastolic", "spo2", "heartRate", "steps", "calories",
    ]
    private static let duracao: Set<String> = ["sleepMinutes", "deepMinutes", "lightMinutes", "remMinutes", "awakeMinutes"]
    private static let limiteAntigo: TimeInterval = 946684800
    private static let futuro: TimeInterval = 600

    struct Linha {
        var recordedAt = ""
        var heartRate: Int?
        var spo2: Int?
        var systolic: Int?
        var diastolic: Int?
        var steps: Int?
        var sleepMinutes: Int?
        var deepMinutes: Int?
        var lightMinutes: Int?
        var remMinutes: Int?
        var awakeMinutes: Int?
        var awakenings: Int?
        var efficiencyPct: Int?
        var minHeartRate: Int?
        var minSpo2: Int?
        var calories: Int?
    }

    struct Resultado {
        var linhas: [Linha] = []
        var ignoradas = 0
        var cabecalho: [String] = []
        var mapeamento: [String: Int] = [:]
        var avisos: [String] = []
        var precisaConfirmacao = false
        var batimentos = 0
        var oxigenacao = 0
        var pressao = 0
        var atividade = 0
        var sono = 0
    }

    static func rotulos() -> [String] {
        ["recordedAt", "heartRate", "spo2", "systolic", "diastolic", "steps", "calories",
         "sleepMinutes", "deepMinutes", "lightMinutes", "remMinutes", "awakeMinutes",
         "awakenings", "efficiencyPct", "minHeartRate", "minSpo2"]
    }

    static func rotulo(_ campo: String) -> String {
        switch campo {
        case "recordedAt": return "Data e hora"
        case "heartRate": return "Batimentos por minuto"
        case "spo2": return "Oxigenação do sangue"
        case "systolic": return "Pressão — número maior"
        case "diastolic": return "Pressão — número menor"
        case "steps": return "Passos"
        case "sleepMinutes": return "Sono (total)"
        case "deepMinutes": return "Sono profundo"
        case "lightMinutes": return "Sono leve"
        case "remMinutes": return "Sono REM"
        case "awakeMinutes": return "Tempo acordado"
        case "awakenings": return "Despertares"
        case "efficiencyPct": return "Eficiência do sono"
        case "minHeartRate": return "Batimentos mínimos"
        case "minSpo2": return "Oxigenação mínima"
        case "calories": return "Calorias"
        default: return campo
        }
    }

    static func ler(_ texto: String?, mapa: [String: Int]?) -> Resultado {
        var r = Resultado()
        guard let texto, !texto.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            r.avisos.append("O arquivo está vazio.")
            return r
        }
        let sep = separador(texto)
        let grade = tokenizar(texto, sep)
        if grade.count < 2 {
            r.avisos.append("O arquivo não tem linhas de dados — só o cabeçalho, ou nada.")
            return r
        }
        var bruto: [String] = []
        var norm: [String] = []
        for c in grade[0] {
            let t = c.trimmingCharacters(in: .whitespacesAndNewlines)
            bruto.append(t)
            norm.append(normalizar(t))
        }
        r.cabecalho = bruto
        var usadas = Array(repeating: false, count: bruto.count)
        for campo in campos {
            if let forcado = mapa?[campo], forcado >= 0, forcado < bruto.count {
                r.mapeamento[campo] = forcado
                usadas[forcado] = true
            }
        }
        for campo in campos where r.mapeamento[campo] == nil {
            let alvos = sinonimos(campo)
            for i in norm.indices where !usadas[i] && !norm[i].isEmpty && alvos.contains(norm[i]) {
                r.mapeamento[campo] = i
                usadas[i] = true
                break
            }
        }
        let semData = r.mapeamento["recordedAt"] == nil
        let semValor = !campos.contains { $0 != "recordedAt" && r.mapeamento[$0] != nil }
        r.precisaConfirmacao = semData || semValor
        if semData { r.avisos.append("Não encontrei a coluna de data e hora. Confirme qual coluna é a data antes de continuar.") }
        if semValor { r.avisos.append("Não reconheci nenhuma coluna de medida neste arquivo. Confirme abaixo qual coluna é o quê.") }
        if r.mapeamento["systolic"] != nil || r.mapeamento["diastolic"] != nil {
            r.avisos.append("A pressão medida pela pulseira é uma estimativa do sensor de luz, sem manguito. Ela entra marcada como estimativa: não entra na sua média de pressão e não dispara aviso.")
        }
        if r.precisaConfirmacao { return r }
        guard let idxData = r.mapeamento["recordedAt"] else { return r }
        for i in 1..<grade.count {
            let cols = grade[i]
            guard let at = parseData(celula(cols, idxData)) else {
                r.ignoradas += 1
                continue
            }
            var l = Linha()
            l.recordedAt = at
            l.heartRate = valor(cols, r.mapeamento, "heartRate")
            l.spo2 = valor(cols, r.mapeamento, "spo2")
            let sis = valor(cols, r.mapeamento, "systolic")
            let dia = valor(cols, r.mapeamento, "diastolic")
            if sis != nil && dia != nil {
                l.systolic = sis
                l.diastolic = dia
            }
            l.steps = valor(cols, r.mapeamento, "steps")
            l.sleepMinutes = valor(cols, r.mapeamento, "sleepMinutes")
            l.deepMinutes = valor(cols, r.mapeamento, "deepMinutes")
            l.lightMinutes = valor(cols, r.mapeamento, "lightMinutes")
            l.remMinutes = valor(cols, r.mapeamento, "remMinutes")
            l.awakeMinutes = valor(cols, r.mapeamento, "awakeMinutes")
            l.awakenings = valor(cols, r.mapeamento, "awakenings")
            l.efficiencyPct = valor(cols, r.mapeamento, "efficiencyPct")
            l.minHeartRate = valor(cols, r.mapeamento, "minHeartRate")
            l.minSpo2 = valor(cols, r.mapeamento, "minSpo2")
            l.calories = valor(cols, r.mapeamento, "calories")
            if l.sleepMinutes == nil, let a = l.deepMinutes, let b = l.lightMinutes, let c = l.remMinutes, let d = l.awakeMinutes {
                let soma = a + b + c + d
                if soma >= 1 && soma <= 1440 { l.sleepMinutes = soma }
            }
            let tem = l.heartRate != nil || l.spo2 != nil || l.systolic != nil || l.steps != nil || l.sleepMinutes != nil || l.calories != nil
            if tem { r.linhas.append(l) } else { r.ignoradas += 1 }
        }
        for l in r.linhas {
            if l.heartRate != nil { r.batimentos += 1 }
            if l.spo2 != nil { r.oxigenacao += 1 }
            if l.systolic != nil && l.diastolic != nil { r.pressao += 1 }
            if l.steps != nil || l.calories != nil { r.atividade += 1 }
            if l.sleepMinutes != nil { r.sono += 1 }
        }
        if r.linhas.isEmpty && r.ignoradas > 0 {
            r.avisos.append("Nenhuma linha pôde ser lida. Confira se a coluna de data está no formato dia/mês/ano.")
        }
        return r
    }

    static func parseData(_ v: String?) -> String? {
        guard let v else { return nil }
        let bruto = v.trimmingCharacters(in: .whitespacesAndNewlines)
        if bruto.isEmpty { return nil }
        var h = 0, min = 0, seg = 0
        if let m = primeiro(#"(\d{1,2}):(\d{2})(?::(\d{2}))?"#, bruto), m.count >= 3 {
            h = Int(m[1]) ?? 0
            min = Int(m[2]) ?? 0
            if m.count > 3, !m[3].isEmpty { seg = Int(m[3]) ?? 0 }
        }
        let baixo = bruto.lowercased()
        let pm = baixo.range(of: #"\bpm\b"#, options: .regularExpression) != nil && h < 12
        let am = baixo.range(of: #"\bam\b"#, options: .regularExpression) != nil && h == 12
        let hFinal = pm ? h + 12 : am ? 0 : h
        if hFinal > 23 || min > 59 || seg > 59 { return nil }
        if let m = primeiro(#"^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b"#, bruto), m.count >= 4 {
            let dia = Int(m[1]) ?? 0
            let mes = Int(m[2]) ?? 0
            let anoBruto = m[3]
            let ano = anoBruto.count == 2 ? 2000 + (Int(anoBruto) ?? 0) : (Int(anoBruto) ?? 0)
            if dia > 12 && mes <= 12 { return montar(ano, mes, dia, hFinal, min, seg) }
            if dia <= 12 && mes > 12 { return montar(ano, dia, mes, hFinal, min, seg) }
            return montar(ano, mes, dia, hFinal, min, seg)
        }
        if bruto.range(of: #"^\d{4}-\d{2}-\d{2}T"#, options: .regularExpression) != nil
            || bruto.range(of: #"(?:Z|[+-]\d{2}:?\d{2})$"#, options: .regularExpression) != nil {
            let iso = normalizarIso(bruto)
            let f = ISO8601DateFormatter()
            f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let data = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
            guard let data else { return nil }
            let t = data.timeIntervalSince1970
            if t < limiteAntigo || t > Date().timeIntervalSince1970 + futuro { return nil }
            let saida = ISO8601DateFormatter()
            saida.formatOptions = [.withInternetDateTime]
            return saida.string(from: data)
        }
        if let m = primeiro(#"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b"#, bruto), m.count >= 4 {
            return montar(Int(m[1]) ?? 0, Int(m[2]) ?? 0, Int(m[3]) ?? 0, hFinal, min, seg)
        }
        if bruto.range(of: #"^\d{10}$|^\d{13}$"#, options: .regularExpression) != nil, let n = Double(bruto) {
            let ms = bruto.count == 10 ? n : n / 1000
            if ms < limiteAntigo || ms > Date().timeIntervalSince1970 + futuro { return nil }
            let saida = ISO8601DateFormatter()
            saida.formatOptions = [.withInternetDateTime]
            return saida.string(from: Date(timeIntervalSince1970: ms))
        }
        return nil
    }

    private static func montar(_ ano: Int, _ mes: Int, _ dia: Int, _ h: Int, _ min: Int, _ seg: Int) -> String? {
        var c = DateComponents()
        c.calendar = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone.current
        c.year = ano
        c.month = mes
        c.day = dia
        c.hour = h
        c.minute = min
        c.second = seg
        guard let data = c.date else { return nil }
        let got = Calendar(identifier: .gregorian).dateComponents(in: TimeZone.current, from: data)
        if got.year != ano || got.month != mes || got.day != dia || got.hour != h { return nil }
        let t = data.timeIntervalSince1970
        if t < limiteAntigo || t > Date().timeIntervalSince1970 + futuro { return nil }
        let saida = ISO8601DateFormatter()
        saida.formatOptions = [.withInternetDateTime]
        return saida.string(from: data)
    }

    private static func normalizarIso(_ bruto: String) -> String {
        if bruto.range(of: #"[+-]\d{4}$"#, options: .regularExpression) != nil {
            let i = bruto.index(bruto.endIndex, offsetBy: -2)
            return String(bruto[..<i]) + ":" + String(bruto[i...])
        }
        return bruto
    }

    private static func valor(_ cols: [String], _ mapa: [String: Int], _ campo: String) -> Int? {
        guard let i = mapa[campo] else { return nil }
        let cru = celula(cols, i).trimmingCharacters(in: .whitespacesAndNewlines)
        if cru.isEmpty { return nil }
        guard let n = duracao.contains(campo) ? parseDuracao(cru) : parseNumero(cru) else { return nil }
        if let faixa = faixa(campo), n < Double(faixa.0) || n > Double(faixa.1) { return nil }
        return Int(n.rounded())
    }

    private static func parseNumero(_ v: String) -> Double? {
        let limpo = v.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: #"[^\d.,-]"#, with: "", options: .regularExpression)
        if limpo.isEmpty || limpo.range(of: #"\d"#, options: .regularExpression) == nil { return nil }
        if limpo.range(of: #"^-?\d{1,3}(\.\d{3})+$"#, options: .regularExpression) != nil {
            return Double(limpo.replacingOccurrences(of: ".", with: ""))
        }
        if limpo.range(of: #"^-?\d{1,3}(,\d{3})+$"#, options: .regularExpression) != nil {
            return Double(limpo.replacingOccurrences(of: ",", with: ""))
        }
        let virgula = limpo.lastIndex(of: ",")
        let ponto = limpo.lastIndex(of: ".")
        var n = limpo
        if let virgula, let ponto {
            let decimal: Character = virgula > ponto ? "," : "."
            let milhar: Character = decimal == "," ? "." : ","
            n = limpo.replacingOccurrences(of: String(milhar), with: "").replacingOccurrences(of: String(decimal), with: ".")
        } else if virgula != nil {
            n = limpo.replacingOccurrences(of: ",", with: ".")
        }
        return Double(n)
    }

    private static func parseDuracao(_ v: String) -> Double? {
        let bruto = v.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let m = inteiro(#"^(\d{1,2})\s*(?:h|:)\s*(\d{1,2})?\s*(?:minutos|min|m)?$"#, bruto) {
            let h = m.0
            let min = m.1 ?? 0
            if min > 59 { return nil }
            return Double(h * 60 + min)
        }
        guard let n = parseNumero(bruto) else { return nil }
        if bruto.range(of: #"\bh\b|hora|hour"#, options: .regularExpression) != nil { return (n * 60).rounded() }
        return n <= 24 ? Double((n * 60).rounded()) : Double(n.rounded())
    }

    private static func celula(_ cols: [String], _ i: Int) -> String {
        i >= 0 && i < cols.count ? cols[i] : ""
    }

    private static func separador(_ texto: String) -> Character {
        let primeira = texto.split(whereSeparator: \.isNewline).first { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.map(String.init) ?? ""
        var melhor: Character = ","
        var melhorN = -1
        for c in [",", ";", "\t"] {
            var n = 0
            var dentro = false
            for ch in primeira {
                if ch == "\"" { dentro.toggle() }
                else if !dentro && String(ch) == c { n += 1 }
            }
            if n > melhorN {
                melhorN = n
                melhor = Character(c)
            }
        }
        return melhor
    }

    private static func tokenizar(_ texto: String, _ sep: Character) -> [[String]] {
        let t = texto.first == "\u{FEFF}" ? String(texto.dropFirst()) : texto
        var linhas: [[String]] = []
        var linha: [String] = []
        var celula = ""
        var aspas = false
        let chars = Array(t)
        var i = 0
        while i < chars.count {
            let c = chars[i]
            if aspas {
                if c == "\"" {
                    if i + 1 < chars.count && chars[i + 1] == "\"" {
                        celula.append("\"")
                        i += 1
                    } else { aspas = false }
                } else { celula.append(c) }
                i += 1
                continue
            }
            if c == "\"" { aspas = true; i += 1; continue }
            if c == sep {
                linha.append(celula)
                celula = ""
                i += 1
                continue
            }
            if c == "\n" || c == "\r" {
                if c == "\r" && i + 1 < chars.count && chars[i + 1] == "\n" { i += 1 }
                linha.append(celula)
                linhas.append(linha)
                linha = []
                celula = ""
                i += 1
                continue
            }
            celula.append(c)
            i += 1
        }
        linha.append(celula)
        linhas.append(linha)
        return linhas.filter { linha in linha.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } }
    }

    private static func normalizar(_ s: String) -> String {
        let n = s.folding(options: .diacriticInsensitive, locale: Locale(identifier: "pt_BR")).lowercased()
        let sem = n.replacingOccurrences(of: #"\([^)]*\)"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"\[[^\]]*\]"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: #"[_./\\-]+"#, with: " ", options: .regularExpression)
        return sem.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func faixa(_ campo: String) -> (Int, Int)? {
        switch campo {
        case "heartRate", "minHeartRate": return (20, 260)
        case "spo2", "minSpo2": return (50, 100)
        case "systolic": return (50, 300)
        case "diastolic": return (30, 200)
        case "steps": return (0, 200_000)
        case "sleepMinutes": return (1, 1440)
        case "deepMinutes", "lightMinutes", "remMinutes", "awakeMinutes", "awakenings": return (0, 1440)
        case "efficiencyPct": return (0, 100)
        case "calories": return (0, 20_000)
        default: return nil
        }
    }

    private static func sinonimos(_ campo: String) -> Set<String> {
        switch campo {
        case "recordedAt":
            return ["date", "time", "datetime", "date time", "data", "hora", "data hora", "data e hora", "timestamp", "measure time", "measurement time", "tempo", "record time", "start time"]
        case "heartRate":
            return ["heart rate", "heartrate", "hr", "bpm", "avg heart rate", "average heart rate", "frequencia cardiaca", "frequencia", "batimentos", "batimento", "pulse", "pulso", "fc", "heart rate bpm"]
        case "spo2":
            return ["spo2", "sp o2", "blood oxygen", "oxygen", "oxygen saturation", "oxigenio", "oxigenacao", "saturacao", "saturacao de oxigenio", "o2", "spo2 %"]
        case "systolic":
            return ["systolic", "systolic bp", "sbp", "sistolica", "pressao sistolica", "pressao maxima", "maxima", "high pressure", "hp", "sys"]
        case "diastolic":
            return ["diastolic", "diastolic bp", "dbp", "diastolica", "pressao diastolica", "pressao minima", "minima", "low pressure", "lp", "dia"]
        case "steps":
            return ["steps", "step", "step count", "passos", "total steps", "numero de passos"]
        case "sleepMinutes":
            return ["sleep", "total sleep", "sleep total", "total sleep time", "sleep duration", "sono", "sono total", "total de sono", "duracao do sono", "tempo de sono", "horas de sono"]
        case "deepMinutes":
            return ["deep sleep", "deep", "deep sleep time", "sono profundo", "profundo"]
        case "lightMinutes":
            return ["light sleep", "light", "light sleep time", "sono leve", "leve"]
        case "remMinutes":
            return ["rem"]
        case "awakeMinutes":
            return ["desperto"]
        case "calories":
            return ["calories", "calorias", "kcal", "cal", "energy", "energia"]
        default:
            return []
        }
    }

    private static func primeiro(_ padrao: String, _ texto: String) -> [String]? {
        guard let r = try? NSRegularExpression(pattern: padrao) else { return nil }
        let ns = texto as NSString
        guard let m = r.firstMatch(in: texto, range: NSRange(location: 0, length: ns.length)) else { return nil }
        return (0..<m.numberOfRanges).map { i in
            let range = m.range(at: i)
            return range.location == NSNotFound ? "" : ns.substring(with: range)
        }
    }

    private static func inteiro(_ padrao: String, _ texto: String) -> (Int, Int?)? {
        guard let partes = primeiro(padrao, texto), partes.count >= 2, let a = Int(partes[1]) else { return nil }
        let b = partes.count > 2 && !partes[2].isEmpty ? Int(partes[2]) : nil
        return (a, b)
    }
}
