# Spec — Fase 1.5: Transformação (Carga de Energia)

*(ver `.specs/SKILL.md` golden rule 1 e `.specs/references/station.md` antes de implementar — esta fase estende a camada de identidade, não a substitui)*

## Objetivo

Adicionar uma camada de recompensa por cima da identidade de estação já validada: o personagem começa num estado base neutro, carrega energia ao acertar inimigos, e aciona manualmente uma transformação — manifestação visual e sonora completa da estação selecionada — quando a barra está cheia.

## Critério de Sucesso

Alcançar a transformação parece uma recompensa satisfatória por lutar bem — não um passo burocrático antes de "jogar de verdade". A mecânica de estação (dash, dano, velocidade) nunca fica bloqueada esperando energia; isso continua sempre livre via 1/2/3 ou roda do mouse, exatamente como já validado no Teste E.

## Não Negociar

- Mecânica de estação (dash/dano/velocidade) nunca é gateada por energia — sempre ativa via seleção de estação, transformado ou não
- Teclas 1/2/3 e roda do mouse passam pelo mesmo fluxo de troca de estação
- Transformação nunca é automática — sempre acionada manualmente (R), só com barra cheia
- Cor/fog do estado base nunca usa a cor de nenhuma estação — neutro sempre (referência: metálico/cinza do cenário, cápsula azul constante)
- As faixas normais da estação continuam tocando no estado base; a faixa emblemática é exclusiva da transformação
- Durante a transformação, acertos não concedem energia
- Faixas emblemáticas com copyright real não entram no build público sem resolver licenciamento (ver `.specs/SKILL.md`, antipadrões)

## Decisões de Design (resolvendo o que ficou em aberto no roadmap)

- **Estado base:** a apresentação visual permanece neutra, mas a faixa normal da estação selecionada continua tocando e a mecânica correspondente permanece ativa.
- **Ativação:** ao pressionar R com energia em 100, `transformed` passa a `true`, a energia permanece em 100 e a faixa normal é substituída pela faixa emblemática da estação atual.
- **Duração por consumo:** durante a transformação, a energia é consumida continuamente à taxa de `100 / 15` por segundo. Ao chegar a 0, `transformed` volta a `false`, o visual retorna ao estado base neutro, a faixa normal da estação atual volta a tocar e a energia permanece em 0. O valor de 15 segundos é um ponto de partida ajustável por playtest.
- **Ganho durante a transformação:** nenhum acerto concede energia enquanto `transformed` for `true`.
- **Troca de estação durante a transformação:** tanto 1/2/3 quanto a roda do mouse usam o mesmo fluxo. A manifestação visual e a faixa emblemática mudam instantaneamente para a nova estação; `transformed` continua `true`, a energia restante não muda e a duração não reinicia.
- **Hit especial do Forró:** acertar dois ou mais alvos no mesmo ataque concede +15 uma única vez por ataque especial bem-sucedido, independentemente da quantidade de alvos atingidos.
- **Aura escalável:** `energia / 100` modula conjuntamente frequência de spawn, opacidade, tamanho e vibração da aura existente. Em energia 0, a aura fica invisível ou inativa; em energia 100, atinge a manifestação máxima anterior à transformação.

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
| Ganho por hit básico | +8 |
| Ganho por hit especial | +15 para contra-ataque Samba; +15 para teto de dano Phonk; +15 uma vez por ataque Forró que acerte 2+ alvos |
| Ganho de energia transformado | 0, para qualquer tipo de acerto |
| Intensidade da aura | `energia / 100` (0 a 1, linear) — modula spawn, opacidade, tamanho e vibração da aura existente |
| Duração da transformação | 15s (tunável) |
| Consumo de energia transformado | `100 / 15` por segundo |
| Tecla de transformação | R, só aceita com energia = 100 |

## Divisão por tipo de validação

**Matemática pura → `combat-math.ts` + teste unitário (Vitest):**
- `energyGainForHit(hitType: 'basic' | 'special'): number`
- `clampEnergy(current: number, gain: number): number` — soma e limita a [0, 100]
- `auraIntensity(energy: number): number` — retorna `energy / 100`
- `canTransform(energy: number): boolean` — `energy >= 100`
- `drainTransformationEnergy(current: number, deltaSeconds: number): number` — subtrai `(100 / 15) * deltaSeconds` e limita o resultado ao mínimo de 0

**Integração → `e2e/scratch/fase-1-5-transformacao.spec.ts` (descartável, não commitar):**
- Acertar um alvo aumenta `energy` no `__GAME_STATE__`
- Energia chega a 100, R aciona `transformed: true`
- Acertar um alvo com `transformed: true` não aumenta `energy`
- A energia diminui continuamente durante a transformação
- Trocar de estação por 1/2/3 ou roda do mouse com `transformed: true` mantém `transformed: true`, atualiza `station` e não altera a energia restante nem reinicia a duração
- Depois de 15s, `transformed` volta a `false`, `energy` chega a 0 e a apresentação visual e sonora retorna ao estado base

O arquivo temporário permanece em `e2e/scratch/`, diretório intencionalmente ignorado pelo Git. Ele deve ser executado localmente por `npm run test:e2e`, mas não versionado.

**Só playtest manual (sem teste automatizado):**
- A transformação parece uma recompensa satisfatória, ou um passo chato?
- 15 segundos é o tempo certo?
- A escalada da aura com a energia é perceptível e gera expectativa?

## Fases de Build

**Fase A — Energia e aura escalando (sem transformação ainda)**
Barra de energia interna (sem UI ainda — `console.log` do valor basta pra esta fase), ganhando energia ao acertar alvos, com frequência de spawn, opacidade, tamanho e vibração da aura já existente reagindo ao valor. Em 0 a aura fica invisível ou inativa; em 100 chega à intensidade máxima. Nenhuma mudança de cor/fog/música ainda; a faixa normal da estação continua tocando.

**Fase B — Transformação**
Tecla R, só ativa com energia 100. Ao ativar: `transformed` passa a `true`, a energia começa em 100, cor e fog mudam para a manifestação completa da estação atual e ocorre crossfade da faixa normal para a emblemática. Enquanto transformado, hits não geram energia e o valor é consumido continuamente em 15s. Ao chegar a 0, reverte o visual, retorna à faixa normal da estação atual e mantém energia 0.

**Fase C — Troca de estação durante transformação**
Unificar o fluxo de troca por 1/2/3 e roda do mouse. Enquanto `transformed: true`, atualizar imediatamente a manifestação visual e a faixa emblemática, sem alterar a energia restante nem reiniciar a duração.

**Fase D — Testes**
`combat-math.ts` com as 5 funções acima + `.spec.ts` correspondente (Vitest). Estender `window.__GAME_STATE__` (de `test-hook.ts`) com os campos `energy: number` e `transformed: boolean`. Escrever o `.spec.ts` de E2E descartável com os casos listados acima; executá-lo localmente sem versionar `e2e/scratch/`.

## Fora de Escopo

- HUD visual da barra de energia (isso é produção de UI — pode nascer aqui como algo simples e provisório, mas o definitivo é Fase 4b)
- Qualquer efeito sonoro/visual novo além das faixas emblemáticas definidas nesta spec e da modulação da aura existente — a transformação reaproveita cor, fog, câmera e partículas já construídos, sem criar outra camada de VFX
- Inimigo com ataque real (Fase 2) — esta fase usa os alvos-treino já existentes

## Critério de Conclusão

- `npm test` passa com as 5 funções de `combat-math.ts`
- `npm run test:e2e` passa com os casos de integração de `e2e/scratch/`, incluindo bloqueio de ganho transformado, consumo contínuo e troca de estação sem reinício
- Playtest manual confirma: transformação parece recompensa, aura escala de forma perceptível, 15s parece razoável (ou o ajuste necessário fica anotado pra próxima iteração)
- Nenhuma regressão nas fases anteriores (mecânica de estação continua livre e instantânea por teclado e roda do mouse; faixa normal continua no estado base; identidade da vertical slice intacta)
