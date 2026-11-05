# LOKMAT H59MAX — recursos e integração

Revisão: 05/11/2026. Identificação confirmada pela foto da embalagem: LOKMAT,
H59MAX, código C4001B, bateria 180 mAh. O modelo da embalagem não prova o
protocolo Bluetooth da unidade. Nenhum teste físico foi realizado nesta revisão.

## Evidências

- Manual depositado para FCC ID 2BB8O-H59MAX:
  https://fccid.io/pdf.php?id=8868993
  Documento do requerente, hospedado em espelho. Confirma QWatch Pro, sensor de
  batimentos/oxigenação, notificações, alarmes, câmera remota, atualização e
  exercícios pelo app. Diz expressamente que o produto não é dispositivo médico.
- Ficha do fornecedor H59MAX:
  https://nafantech.com/non-screen-smart-health-bracelet-h59max/
  Anuncia sono, HRV, estresse, pressão, esportes e GPS com celular. É evidência
  comercial do modelo, não validação independente do lote LOKMAT comprado.
- Ficha comercial LOKMAT H59 MAX:
  https://www.geekbuying.com/item/LOKMAT-H59-MAX-Smart-Bracelet-Gold-531889.html
  Corrobora o modelo e as funções anunciadas; não é documentação de API/SDK.

## O que chega ao Encorpei hoje

| Recurso | Suporte no modelo | Integração existente |
|---|---|---|
| Batimentos | Sensor descrito no manual | BLE padrão ou canal proprietário já implementado; falta testar esta unidade |
| SpO₂ | Sensor descrito no manual | CSV compatível; sem comando de coleta Bluetooth implementado |
| Sono e estágios | Anunciados | CSV quando houver campos; decodificador aceita pacote estruturado, mas não solicita histórico de sono |
| Passos e calorias | Atividade anunciada | CSV compatível; sem coleta Bluetooth implementada |
| Pressão | Estimativa anunciada, sem manguito | CSV, sempre estimativa, excluída de MRPA e alertas |
| HRV | Anunciada | Não há importador da HRV do QWatch Pro. Cliente genérico calcula RMSSD/SDNN somente se receber intervalos RR; isso não confirma suporte da H59MAX |
| Estresse, distância, treinos e rota | Anunciados | Sem importador implementado; GPS depende do celular |
| Bateria e firmware | Informações do aparelho | Leitura opcional de serviços Bluetooth, quando disponíveis |

O importador CSV é genérico. **Não foi confirmada exportação CSV no QWatch Pro**,
API pública ou entrega automática em segundo plano nesta unidade.
Não se deve prometer coleta contínua em segundo plano ou transmissão ao médico
sem uma gravação bem-sucedida e vínculo ativo. No iPhone, a integração Bluetooth
web atual não oferece o mesmo caminho de conexão dos navegadores compatíveis.

## Funções fora da integração

Alarmes, notificações de chamadas/mensagens, lembretes de movimento, localizar
pulseira, câmera remota, não perturbe, atualização e reset pertencem ao aplicativo
companheiro. Calendário menstrual e relatório de IA são recursos anunciados do
app, não sensores nem dados importados pelo Encorpei.

Peso, glicemia, ECG, temperatura, diagnóstico de arritmia e GPS independente não
possuem suporte comprovado para este modelo e não são oferecidos como funções
da pulseira. Ausência de comprovação não é um teste físico de ausência de sensor.

## Comportamento da interface

A aba Aparelhos, compartilhada pelo médico e paciente, exibe apenas batimentos,
SpO₂, sono, passos e pressão estimada. Peso e glicemia continuam nas áreas de
registro manual, sem atribuição à pulseira. Leituras importadas também entram
no filtro e mantêm sua origem. Campos sem leitura ficam sem registro; nenhum
valor é fabricado. A página Pulseira distingue capacidade anunciada de envio
implementado. HRV não é cadastrada automaticamente como capacidade BLE.

## Verificação restante

Parear a unidade, conferir nome/firmware e comparar valores e horários com
QWatch Pro. Para ampliar a integração, obter um arquivo real de exportação ou
protocolo/SDK do fornecedor. Não implementar comandos por suposição de modelo.

## Caminho para sincronização sem atualização diária

A descrição do próprio QWatch Pro na App Store confirma exportação para Apple
Health de exercícios, passos, calorias, distância, batimentos e sono:
https://apps.apple.com/br/app/qwatch-pro/id1572827103
Isso não comprova que ele faça a coleta da H59MAX com o app fechado. SpO₂,
pressão, HRV e estresse não constam na lista de exportação dessa descrição.

Caminho candidato no iPhone: H59MAX → QWatch Pro → Apple Health → componente
nativo Encorpei (HealthKit e autorização do paciente) → Supabase → médico.
O PWA atual não implementa HealthKit. Primeiro testar se o QWatch Pro entrega
dados ao Saúde por 24–48 h sem abertura manual. Se essa etapa falhar, ler
HealthKit automaticamente não resolve a falta de dados na origem.

Alternativa: aplicativo nativo comunicando diretamente via BLE, com protocolo
do fabricante e execução em segundo plano. Não basta embalar o site. iOS e
Android impõem permissões e restrições; encerramento forçado, Bluetooth
desativado, distância e ausência de rede continuam interrompendo a entrega.
Não existe garantia de monitoramento contínuo em tempo real.

Fontes técnicas:
- https://developer.apple.com/documentation/healthkit/hkobserverquery
- https://developer.android.com/health-and-fitness/health-connect/read-data
- https://developer.chrome.com/docs/capabilities/bluetooth

No Android, confirmar primeiro se QWatch Pro grava em Health Connect. A
integração Apple Health anunciada não prova suporte equivalente no Android.
Nenhuma sincronização automática nova foi implementada nesta revisão.
