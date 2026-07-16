# Spec — Fase 1.5: Transformação (Carga de Energia)

*(ver `.specs/SKILL.md` golden rule 1 e `.specs/references/station.md` antes de implementar — esta fase estende a camada de identidade, não a substitui)*

**Status:** ✅ Concluída e validada em 16 de julho de 2026.

## Objetivo

Adicionar uma camada de recompensa por cima da identidade de estação já validada: o personagem começa num estado base neutro, carrega energia ao acertar inimigos, e aciona manualmente uma transformação — manifestação visual e sonora completa da estação selecionada — quando a barra está cheia.

## Critério de Sucesso

Alcançar a transformação parece uma recompensa satisfatória por lutar bem — não um passo burocrático antes de "jogar de verdade". A mecânica de estação (dash, dano, velocidade) nunca fica bloqueada esperando energia; isso continua sempre livre via 1/2/3 ou roda do mouse, exatamente como já validado no Teste E.

## Não Negociar

- Mecânica de estação (dash/dano/velocidade) nunca é gateada por energia — sempre ativa via seleção de estação, transformado ou não
- Teclas 1/2/3 e roda do mouse não podem trocar a estação durante a transformação; nenhuma entrada fica enfileirada para depois
- Transformação nunca é automática — sempre acionada manualmente (R), só com barra cheia
- Cor/fog do estado base nunca usa a cor de nenhuma estação — neutro sempre (referência: metálico/cinza do cenário, cápsula azul constante)
- As faixas normais da estação continuam tocando no estado base; a faixa emblemática é exclusiva da transformação
- A faixa emblemática fica parada no estado base e toda transformação inicia uma nova reprodução em `00:00`
- Durante a transformação, acertos não concedem energia
- Faixas emblemáticas com copyright real não entram no build público sem resolver licenciamento (ver `.specs/SKILL.md`, antipadrões)

## Decisões de Design (resolvendo o que ficou em aberto no roadmap)

- **Estado base:** a apresentação visual permanece neutra, mas a faixa normal da estação selecionada continua tocando e a mecânica correspondente permanece ativa.
- **Ativação:** ao pressionar R com energia em 100, `transformed` passa a `true`, a energia permanece em 100 e a faixa normal é substituída pela faixa emblemática da estação atual, reiniciada em `00:00`.
- **Duração por consumo:** durante a transformação, a energia é consumida continuamente à taxa de `100 / 15` por segundo. Ao chegar a 0, `transformed` volta a `false`, o visual retorna ao estado base neutro, a faixa normal da estação atual volta a tocar e a energia permanece em 0. O valor de 15 segundos é um ponto de partida ajustável por playtest.
- **Ganho durante a transformação:** nenhum acerto concede energia enquanto `transformed` for `true`.
- **Estação bloqueada durante a transformação:** a estação selecionada ao pressionar R permanece fixa mecânica, visual e sonoramente até a energia chegar a 0. Teclas 1/2/3 e roda do mouse são ignoradas sem alterar estado oculto. A troca volta a funcionar somente depois do retorno ao estado base.
- **Ganho padronizado:** qualquer ataque bem-sucedido concede +2 uma única vez por ataque, independentemente de ser básico, contra-ataque Samba, teto de dano Phonk ou ataque em área Forró. O Forró nunca concede por alvo. Durante a transformação, o ganho continua sendo 0.
- **Aura escalável:** no estado base, `energia / 100` modula conjuntamente frequência de spawn, opacidade, tamanho e vibração. Em energia 0, a aura fica invisível ou inativa. Durante toda a transformação, a intensidade visual é fixada em 1, independentemente da energia restante; ao encerrar com energia 0, volta imediatamente a 0.
- **HUD provisório:** o bloco de controles exibe R como comando de transformação sem refatoração ampla. A barra provisória já criada na Fase A.5 permanece como está; o HUD definitivo continua na Fase 4b.

## Faixas de Áudio

| Estação | Estado base | Transformação |
| --- | --- | --- |
| Phonk | `public/audio/phonk.mp3` | `public/audio/phonk-transformation.mp3` |
| Samba | `public/audio/samba.mp3` | `public/audio/samba-transformation.mp3` |
| Forró | `public/audio/forro.mp3` | `public/audio/forro-transformation.mp3` |

## Parâmetros

| Parâmetro | Valor |
| --- | --- |
| Energia máxima | 100 |
| Ganho por ataque bem-sucedido | +2 uma única vez por ataque, para qualquer estação ou tipo de hit |
| Ganho de energia transformado | 0, para qualquer tipo de acerto |
| Intensidade da aura no estado base | `energia / 100` (0 a 1, linear) — modula spawn, opacidade, tamanho e vibração |
| Intensidade da aura transformado | 1 durante toda a transformação |
| Duração da transformação | 15s (tunável) |
| Consumo de energia transformado | `100 / 15` por segundo |
| Tecla de transformação | R, só aceita com energia = 100 |

## Divisão por tipo de validação

**Matemática pura → `combat-math.ts` + teste unitário (Vitest):**
- `energyGainForHit(hitType: 'basic' | 'special'): number` — retorna 2 para qualquer tipo válido
- `energyGainForAttack(successfulHitCount: number, transformed: boolean): number` — retorna 2 uma vez por ataque bem-sucedido no estado base; retorna 0 sem acerto ou transformado
- `clampEnergy(current: number, gain: number): number` — soma e limita a [0, 100]
- `auraIntensity(energy: number): number` — retorna `energy / 100`
- `auraIntensityForState(energy: number, transformed: boolean): number` — retorna 1 transformado; caso contrário usa `energy / 100`
- `canTransform(energy: number): boolean` — `energy >= 100`
- `drainTransformationEnergy(current: number, deltaSeconds: number): number` — subtrai `(100 / 15) * deltaSeconds` e limita o resultado ao mínimo de 0

**Integração → `e2e/scratch/fase-1-5-transformacao.spec.ts` (descartável, não commitar):**
- Acertar um alvo aumenta `energy` no `__GAME_STATE__`
- Energia chega a 100, R aciona `transformed: true`
- Acertar um alvo com `transformed: true` não aumenta `energy`
- A energia diminui continuamente durante a transformação
- Tentar trocar de estação por 1/2/3 ou roda do mouse com `transformed: true` não altera `station`
- Depois do fim da transformação, 1/2/3 e roda do mouse voltam a alterar `station`
- A aura permanece em intensidade 1 enquanto transformado e volta a 0 ao encerrar
- Cada ativação reinicia a faixa emblemática em `00:00`; ela não avança no estado base
- Depois de 15s, `transformed` volta a `false`, `energy` chega a 0 e a apresentação visual e sonora retorna ao estado base

O arquivo temporário permanece em `e2e/scratch/`, diretório intencionalmente ignorado pelo Git. Ele deve ser executado localmente por `npm run test:e2e`, mas não versionado.

**Só playtest manual (sem teste automatizado):**
- A transformação parece uma recompensa satisfatória, ou um passo chato?
- 15 segundos é o tempo certo?
- A escalada da aura com a energia é perceptível e gera expectativa?

## Fases de Build

**Fase A — Energia e aura escalando (sem transformação ainda) ✅ Concluída**
Energia interna ganhando +2 uma única vez por ataque bem-sucedido, com frequência de spawn, opacidade, tamanho e vibração da aura já existente reagindo ao valor. Em 0 a aura fica invisível ou inativa; em 100 chega à intensidade máxima. Nenhuma mudança de cor/fog/música ainda; a faixa normal da estação continua tocando.

**Fase A.5 — HUD provisório de energia ✅ Concluída**
Barra funcional provisória já implementada para comunicar vazio, progresso e carga completa. Não é o HUD definitivo da Fase 4b.

**Fase B — Transformação ✅ Concluída**
Tecla R, só ativa com energia 100. Ao ativar: `transformed` passa a `true`, a energia começa em 100, a estação atual fica bloqueada, cor e fog mudam para a manifestação completa, a aura permanece em intensidade 1 e ocorre crossfade da faixa normal para uma nova reprodução da emblemática iniciada em `00:00`. Enquanto transformado, hits não geram energia e o valor é consumido continuamente em 15s. Ao chegar a 0, interrompe a emblemática, reverte o visual e a aura, retorna à faixa normal da estação travada e mantém energia 0. O bloco de controles inclui a tecla R.

**Fase C — Removida**
A proposta anterior de trocar a manifestação durante a transformação foi substituída pela decisão de bloquear a estação até o retorno ao estado base. Não há build separado para troca transformada.

**Fase D — Testes e observabilidade ✅ Concluída**
`combat-math.ts` com as 7 funções acima + `.spec.ts` correspondente (Vitest). Estender `window.__GAME_STATE__` (de `test-hook.ts`) com os campos `energy: number` e `transformed: boolean`. Escrever o `.spec.ts` de E2E descartável com os casos listados acima; executá-lo localmente sem versionar `e2e/scratch/`.

## Fora de Escopo

- Qualquer expansão ou acabamento da barra provisória de energia; o HUD definitivo permanece na Fase 4b
- Qualquer efeito sonoro/visual novo além das faixas emblemáticas definidas nesta spec e da modulação da aura existente — a transformação reaproveita cor, fog, câmera e partículas já construídos, sem criar outra camada de VFX
- Inimigo com ataque real (Fase 2) — esta fase usa os alvos-treino já existentes

## Critério de Conclusão

- ✅ `npm test` passa com as 7 funções de `combat-math.ts`
- ✅ `npm run test:e2e` passa com os casos de integração de `e2e/scratch/`, incluindo bloqueio de ganho transformado, consumo contínuo, estação travada e reativação da troca ao encerrar
- ✅ Playtest manual confirmou a carga, ativação, duração, apresentação visual e sonora, aura, bloqueio de estação e retorno ao estado base
- ✅ Nenhuma regressão foi observada nas fases anteriores: a mecânica de estação continua livre e instantânea no estado base, a faixa normal continua tocando e a identidade da vertical slice foi preservada

## Resultado da Validação

A Fase 1.5 foi considerada concluída após a aprovação dos testes automatizados e da validação manual. A transformação cumpriu o objetivo desta iteração como recompensa do loop de combate, com duração aproximada de 15 segundos e leitura adequada da progressão de energia e da aura.
