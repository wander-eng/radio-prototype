# Receita: Estação (Rádio)

Leia `../SKILL.md` primeiro (golden rules, principalmente 1 e 2). Este arquivo é a versão amarrada e consolidada do que já foi validado — substitui a parte solta do Manifesto Criativo sobre as estações, não o Manifesto inteiro.

## O que define uma estação

Toda estação — as 3 existentes ou uma futura — só está completa quando todos os campos abaixo estão decididos e implementados **juntos** (golden rule 1). Faltar qualquer um deixa a estação incompleta, mesmo que jogável:

- Cor de acento (material emissive do personagem)
- Cor/densidade do fog da cena
- Faixa de música + sequência de sintonia (estática → clique → stinger) na troca
- Velocidade de movimento
- Comportamento de dash
- Regra de dano especial
- Input feel (buffer de combo, cancelamento, recovery)
- Aura contínua (enquanto a estação está ativa, não só no instante da troca)
- Efeito de câmera no switch
- Efeito de partícula no switch (comportamento **e** forma/identidade — golden rule 2)

## As 3 estações (dados validados — Teste E aprovado)

| Campo | Phonk (Pancadão) | Samba (Ginga) | Forró (Arrasta-Pé) |
| --- | --- | --- | --- |
| Cor de acento | Verde-limão metálico `#39FF14` | Dourado `#FFD700` | Laranja terracota `#FF7F27` |
| Fog | Verde escuro, densidade alta | Quase ausente, claro | Laranja quente, densidade média |
| Velocidade | 8 m/s | 6 m/s (referência neutra) | 4.5 m/s, alcance de ataque +60% |
| Dash | Cancela a animação de ataque em andamento; duração 0.15s; cooldown 0.4s | Concede 0.2s de invulnerabilidade + `timeScale` 0.5 por 150ms, sempre que ativado | Trajetória em arco; atinge múltiplos alvos no caminho |
| Dano especial | +5% por hit consecutivo, cap em +30%; reseta ao errar, 2s sem acertar, ou trocar de estação | Contra-ataque: dano x1.5 se conectar dentro de 1s após o dash | Cada hit atinge todos os alvos num raio de 1.5 unidades ao redor |
| Input feel | Buffer mínimo (~100ms), encadeamento quase imediato | Janela de combo exigente (~250ms) — precisão sobre velocidade | Janela de combo generosa (~600ms), aceita mudança de direção durante o ataque |
| Aura contínua | Intensa — partículas densas, rápidas, pulsando perto do corpo | Serpenteante — poucas partículas em trajetória sinuosal (seno) | Rodopiante — partículas em espiral contínua, raio oscilando |
| Câmera no switch | Zoom-punch: FOV reduz e volta em ~150ms — **validado, não mexer** | Nudge lateral + queda no lerp de seguimento — magnitude aumentada após playtest fraco; valor exato de correção não confirmado neste documento, checar código atual | Orbit ao redor do personagem — ângulo aumentado após playtest fraco; valor exato não confirmado, checar código atual |
| Partícula no switch | Burst denso verde/amarelo, dispersão radial, curta duração — **validado, não mexer** | Confete/serpentina (fitas finas, dourado+branco, dispersão com efeito de queda, ~800ms-1s) — substituiu um rastro genérico sem identidade | Rastro circular laranja ao redor do personagem — **validado, não mexer** |

**Nota sobre os campos "não confirmado":** as magnitudes de câmera da Samba e do Forró foram corrigidas por prompt ("aumentar significativamente") mas o valor numérico final não voltou pra esta conversa. Antes de tratar este documento como definitivo, confirme os números reais em `src/effects.ts` (ou onde a lógica de câmera do switch estiver) e atualize esta tabela.

## Checklist para qualquer mudança numa estação existente

- [ ] A mudança altera identidade visual, sonora e mecânica juntas, ou é só ajuste de um campo isolado? Se for só um campo, confirme que os outros já cobrem identidade suficiente (golden rule 1)
- [ ] Se mexeu em VFX/partícula: a spec descreve forma/identidade, não só comportamento (golden rule 2)
- [ ] Passa no teste "reconhecível só no visual" (som mudo) e "reconhecível só no áudio" (sem olhar a tela) — Não Negociar da spec técnica
- [ ] Nenhum valor de atributo (dano, velocidade) virou número visível na tela (golden rule 3)
- [ ] Se a mudança envolve rotação/valor interpolado que afeta hit: convergência garantida no momento do cálculo (golden rule 4)

## Se um dia adicionar uma 4ª estação (não planejado hoje)

Não é uma tarefa leve — é o mesmo tamanho de trabalho que validar Phonk, Samba ou Forró do zero:

1. Decida todos os campos da tabela "O que define uma estação" antes de escrever qualquer código — nome, cor e conceito não podem colidir com as 3 existentes
2. Escreva uma spec técnica própria, no mesmo formato da spec da vertical slice original (objetivo, critério de sucesso, parâmetros, fases de build)
3. Rode os mesmos Testes de Validação A-E antes de considerar pronta
4. Atualize a tabela acima e o Manifesto Criativo

## Fora do escopo deste documento

Armas por estação (`references/arma.md`, ainda não escrito) e qualquer VFX que não seja do momento de troca de estação (aura contínua está aqui; VFX de combate geral — hit, dano recebido — não está, porque ainda não foi desenhado).
