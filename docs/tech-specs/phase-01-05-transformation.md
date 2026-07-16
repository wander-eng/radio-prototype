# Spec — Fase 1.5: Transformação (Carga de Energia)

*(ver `SKILL.md` golden rule 1 e `references/estacao.md` antes de implementar — esta fase estende a camada de identidade, não a substitui)*

## Objetivo

Adicionar uma camada de recompensa por cima da identidade de estação já validada: o personagem começa num estado base neutro, carrega energia ao acertar inimigos, e aciona manualmente uma transformação — manifestação visual e sonora completa da estação selecionada — quando a barra está cheia.

## Critério de Sucesso

Alcançar a transformação parece uma recompensa satisfatória por lutar bem — não um passo burocrático antes de "jogar de verdade". A mecânica de estação (dash, dano, velocidade) nunca fica bloqueada esperando energia; isso continua sempre livre via 1/2/3, exatamente como já validado no Teste E.

## Não Negociar

- Mecânica de estação (dash/dano/velocidade) nunca é gateada por energia — sempre ativa via seleção de estação, transformado ou não
- Transformação nunca é automática — sempre acionada manualmente (R), só com barra cheia
- Cor/fog do estado base nunca usa a cor de nenhuma estação — neutro sempre (referência: metálico/cinza do cenário, cápsula azul constante)
- Faixas emblemáticas com copyright real não entram no build público sem resolver licenciamento (ver `SKILL.md`, antipadrões)

## Decisões de Design (resolvendo o que ficou em aberto no roadmap)

- **Duração da transformação:** 15 segundos, depois reverte automaticamente ao estado base e energia volta a 0. Valor de partida, ajustável por playtest.
- **Trocar de estação (1/2/3) durante a transformação:** a manifestação (cor, fog, faixa emblemática) troca instantaneamente para a nova estação, sem precisar recarregar — consistente com a mecânica já sendo sempre livre. `transformed` continua `true`, só o conteúdo da manifestação muda.
- **Energia não decai com o tempo** nesta primeira versão — só reseta a 0 ao ativar a transformação. Se o playtest mostrar que isso trivializa a carga (farmar longe do risco), reconsiderar depois.

## Parâmetros

| Parâmetro | Valor |
| --- | --- |
| Energia máxima | 100 |
| Ganho por hit básico | +8 |
| Ganho por hit especial (contra-ataque Samba, área Forró 2+ alvos, teto de dano Phonk) | +15 |
| Intensidade da aura | `energia / 100` (0 a 1, linear) — modula a aura contínua já existente da Fase 4, não cria uma nova |
| Duração da transformação | 15s (tunável) |
| Tecla de transformação | R, só aceita com energia = 100 |

## Divisão por tipo de validação

**Matemática pura → `combat-math.ts` + teste unitário (Vitest):**
- `energyGainForHit(hitType: 'basic' | 'special'): number`
- `clampEnergy(current: number, gain: number): number` — soma e limita a [0, 100]
- `auraIntensity(energy: number): number` — retorna `energy / 100`
- `canTransform(energy: number): boolean` — `energy >= 100`

**Integração → `e2e/scratch/fase-1-5-transformacao.spec.ts` (descartável, não commitar):**
- Acertar um alvo aumenta `energy` no `__GAME_STATE__`
- Energia chega a 100, R aciona `transformed: true`
- Trocar de estação (1/2/3) com `transformed: true` mantém `transformed: true`, atualiza `station`
- Depois de 15s, `transformed` volta a `false` e `energy` volta a 0

**Só playtest manual (sem teste automatizado):**
- A transformação parece uma recompensa satisfatória, ou um passo chato?
- 15 segundos é o tempo certo?
- A escalada da aura com a energia é perceptível e gera expectativa?

## Fases de Build

**Fase A — Energia e aura escalando (sem transformação ainda)**
Barra de energia interna (sem UI ainda — `console.log` do valor basta pra esta fase), ganhando energia ao acertar alvos, com a intensidade da aura já existente reagindo ao valor. Nenhuma mudança de cor/fog/música ainda.

**Fase B — Transformação**
Tecla R, só ativa com energia 100. Ao ativar: cor do personagem e fog mudam pra manifestação completa da estação atual; crossfade pra faixa emblemática; timer de 15s; ao expirar, reverte tudo e zera energia.

**Fase C — Troca de estação durante transformação**
Confirmar que trocar de estação (1/2/3) enquanto `transformed: true` atualiza a manifestação instantaneamente, sem resetar o timer nem a energia.

**Fase D — Testes**
`combat-math.ts` com as 4 funções acima + `.spec.ts` correspondente (Vitest). Extender `window.__GAME_STATE__` (de `test-hook.ts`) com os campos `energy: number` e `transformed: boolean`. Escrever o `.spec.ts` de E2E descartável com os 4 casos listados acima.

## Fora de Escopo

- HUD visual da barra de energia (isso é produção de UI — pode nascer aqui como algo simples e provisório, mas o definitivo é Fase 4b)
- Qualquer efeito sonoro/visual novo além do já existente (aura, câmera, partícula de troca) — a transformação reaproveita o que já foi construído, não cria camada nova de VFX
- Inimigo com ataque real (Fase 2) — esta fase usa os alvos-treino já existentes

## Critério de Conclusão

- `npm test` passa com as 4 funções de `combat-math.ts`
- `npm run test:e2e` passa com os 4 casos do `e2e/scratch/`
- Playtest manual confirma: transformação parece recompensa, aura escala de forma perceptível, 15s parece razoável (ou o ajuste necessário fica anotado pra próxima iteração)
- Nenhuma regressão nas fases anteriores (mecânica de estação continua livre e instantânea, identidade da vertical slice intacta)
