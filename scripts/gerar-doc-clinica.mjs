import { REGRAS_CLINICAS, regrasAtivas, regrasCriticas, regrasSemOrigem, regrasOrfas } from "../src/domain/clinical-rules/registry.ts";
import { TODAS_AS_CONSTANTES, DIVERGENCIAS_CONHECIDAS } from "../src/domain/clinical-rules/constants.ts";
const CLASSE = { informativa:"Informativa", monitoramento:"Monitoramento", alerta:"Alerta", urgencia:"Urgência", critica:"Crítica" };
const RISCO = { baixo:"Baixo", medio:"Médio", alto:"Alto", critico:"Crítico" };
const STATUS = { ativa:"Ativa", orfa:"Órfã (não executa)", duplicada:"Duplicada", removida:"Removida" };
const L=[];
L.push("# Regras Clínicas — Encorpei Mamãe","",
"> **Documento gerado a partir do código.** Não edite este arquivo à mão: ele é",
"> produzido por `npm run doc:clinico` a partir de `src/domain/clinical-rules/`.",
"> Se a documentação e o código divergirem, o código é a verdade — e o teste",
"> `src/test/clinical/governanca.test.ts` quebra.","",
`Gerado em ${new Date().toISOString().slice(0,10)}.`,"",
"## Para o médico responsável","",
"Este documento existe para que a revisão clínica não dependa de ler código.",
"Cada regra tem identificador estável (OBS-NNN), o que ela avalia, o que produz,",
"em que tela aparece e qual a consequência de ela errar.","",
"**Nenhum limiar deste sistema foi validado clinicamente até hoje.** Todos estão",
"marcados como AGUARDANDO VALIDAÇÃO MÉDICA. Nenhuma referência foi inventada:",
"onde não há registro de origem, está escrito que não há.","",
"---","",
"## Panorama","",
"| | |","|---|---:|",
`| Regras registradas | ${REGRAS_CLINICAS.length} |`,
`| Ativas em produção | ${regrasAtivas().length} |`,
`| Nível de risco crítico | ${regrasCriticas().length} |`,
`| Sem origem clínica documentada | ${regrasSemOrigem().length} |`,
`| Órfãs ou duplicadas | ${regrasOrfas().length} |`,
`| Constantes clínicas centralizadas | ${TODAS_AS_CONSTANTES.length} |`,
`| Divergências conhecidas entre motores | ${DIVERGENCIAS_CONHECIDAS.length} |`,"",
"---","","## Divergências conhecidas","",
"Registradas e **não corrigidas de propósito**: escolher entre dois limiares é",
"decisão clínica, não de engenharia.","");
for (const d of DIVERGENCIAS_CONHECIDAS) {
  L.push(`### ${d.id} — ${d.tema}`,"",
  `- **Motor ativo:** ${d.valorNoMotorAtivo}`,
  `- **Outra fonte:** ${d.valorNaEngineParalela}`,
  `- **Onde vive:** \`${d.ondeVive}\``,
  `- **Impacto:** ${d.impacto}`,"");
}
L.push("---","","## Constantes clínicas","",
"| ID | Valor | Descrição | Origem |","|---|---|---|---|");
for (const c of TODAS_AS_CONSTANTES) L.push(`| \`${c.id}\` | ${c.valor} ${c.unidade} | ${c.descricao} | ${c.origem} |`);
L.push("","---","","## Regras","");
for (const r of REGRAS_CLINICAS) {
  L.push(`### ${r.id} — ${r.nome}`,"",
  `**Classificação:** ${CLASSE[r.classificacao]} · **Risco:** ${RISCO[r.nivelRisco]} · **Status:** ${STATUS[r.status]}`,"",
  r.descricao,"",
  `**Objetivo.** ${r.objetivo}`,"",
  `**Resultado.** ${r.resultado}`,"",
  `**Impacto clínico.** ${r.impactoClinico}`,"",
  `**Telas.** ${r.telas.length ? r.telas.join(" · ") : "— (não aparece em lugar nenhum)"}`,"",
  `**Dados usados.** ${r.dadosUtilizados.join(" · ")}`,"",
  `**Arquivos.** ${r.arquivos.map(a=>"`"+a+"`").join(" · ")}`,"",
  `**Constantes.** ${r.constantes.length ? r.constantes.map(c=>"`"+c+"`").join(" · ") : "—"}`,"",
  `**Dependências.** ${r.dependencias?.length ? r.dependencias.join(" · ") : "—"}`,"",
  `**Origem clínica.** ${r.origem}`,"");
  if (r.observacao) L.push(`> ⚠️ ${r.observacao}`,"");
  L.push("---","");
}
process.stdout.write(L.join("\n"));
