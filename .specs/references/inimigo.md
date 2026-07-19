# Referência: Inimigos

Este documento registra o modelo de inimigos implementado na Fase 2 — Core
Combat. Ele descreve o estado atual do protótipo e não substitui a tech spec,
não redefine parâmetros e não especifica comportamentos futuros.

## Propósito no protótipo

Os inimigos transformam o combate contra alvos estáticos em um encontro
contínuo sob pressão. Os dois arquétipos exigem respostas diferentes:

- melee aproxima-se e força leitura de alcance, telegraph, dash e pulo;
- ranged controla distância e dispara projéteis evitáveis por movimento ou
  altura.

O encontro não possui waves, progressão ou condição de vitória. Inimigos
derrotados reaparecem individualmente para manter o loop ativo.

## Composição atual

O `EncounterController` cria três inimigos persistentes:

| ID | Arquétipo | Spawn | HP |
| --- | --- | --- | --- |
| `melee_0` | Melee | `(-3, 1, -3)` | 50 |
| `melee_1` | Melee | `(3, 1, -3)` | 50 |
| `ranged_0` | Ranged | `(0, 1, -8)` | 40 |

Todos implementam `CombatTarget`, contrato que expõe:

- ID estável;
- objeto de cena usado para posição, mira e colisão;
- HP atual e máximo;
- estado geral `active`, `dying` ou `dead`;
- `receiveHit`, com resultado explícito de dano aplicado, morte e dano aceito.

Os alvos-treino da Foundation continuam no jogo, mas não fazem parte do
encontro controlado pelo `EncounterController`.

## `EncounterController`

O controlador:

- instancia os dois melees, o ranged e o token melee;
- adiciona as malhas dos inimigos à cena;
- atualiza as três FSMs enquanto o jogador está vivo;
- mantém a coleção de projéteis ativos;
- cria, atualiza, remove e descarta a geometria e o material dos projéteis;
- aplica separação simples entre os dois melees;
- limita a posição dos inimigos e remove projéteis que saem da arena;
- expõe snapshots serializáveis para observabilidade DEV;
- executa o reset interno do encontro.

O clamp da posição do jogador é feito em `main.ts`, não no controlador. Pausa,
morte, retomada, energia, transformação, áudio e HUD também são coordenados
fora dele.

## Inimigo melee

### Parâmetros

| Parâmetro | Valor atual |
| --- | --- |
| Quantidade | 2 |
| Velocidade | 3,2 unidades/s |
| Alcance horizontal | 1,5 unidade |
| Tolerância vertical | 1,25 unidade |
| Windup | 0,6s |
| Dano | 20 |
| Recovery | 0,8s |
| Dying | 0,3s |
| Respawn total | 3s |

### Máquina de estados

```text
chase → windup → attack → recovery → chase
   └──────── hit letal → dying → dead → chase
```

- `chase`: persegue o jogador em XZ até o alcance de ataque. A rotação usa
  suavização visual.
- `windup`: mantém posição e avança o telegraph por `deltaSeconds`.
- `attack`: executa uma única checagem de alcance horizontal e vertical e
  chama `Player.receiveAttack(20)` quando ela conecta.
- `recovery`: impede um novo ataque por 0,8s e depois retorna a `chase`.
- `dying`: reduz a escala da malha ao longo de 0,3s.
- `dead`: mantém a malha invisível até completar os 3s contados desde o hit
  letal; então restaura o inimigo no spawn em `chase`.

Não existe dano por contato. Durante movimento normal, uma separação de
1 unidade em XZ evita sobreposição evidente com o jogador. Essa separação é
ignorada enquanto o jogador está em dash, permitindo atravessar o melee.

Quando o token está ocupado e o segundo melee alcança o jogador, ele continua
se movendo em uma direção tangencial, a metade da velocidade normal, em vez de
iniciar outro windup ou ficar parado.

## Inimigo ranged

### Parâmetros

| Parâmetro | Valor atual |
| --- | --- |
| Quantidade | 1 |
| Velocidade | 2,5 unidades/s |
| Distância preferencial | 6–9 unidades em XZ |
| Windup | 0,8s |
| Recovery | 1,2s |
| Dying | 0,3s |
| Respawn total | 3s |

### Máquina de estados

```text
reposition → windup → attack → recovery → reposition
     └────────── hit letal → dying → dead → reposition
```

- `reposition`: aproxima-se quando está além de 9 unidades, afasta-se quando
  está abaixo de 6 e entra em windup quando está dentro da faixa.
- `windup`: olha para o jogador e avança o telegraph por `deltaSeconds`.
- `attack`: captura uma vez a posição atual do jogador, cria um projétil e
  entra imediatamente em recovery.
- `recovery`: aguarda 1,2s antes de voltar a avaliar distância.
- `dying` e `dead`: usam o mesmo ciclo temporal do melee e restauram o ranged
  no spawn em `reposition`.

O ranged não usa nem consulta o token dos melees. Um projétil já disparado
continua ativo quando o ranged morre, até ser consumido, expirar, sair da arena
ou ocorrer reset do encontro.

## Telegraphs atuais

Os telegraphs são geométricos e provisórios:

- durante o windup, o corpo interpola da cor base para amarelo e recebe
  emissivo progressivo;
- um anel amarelo no chão contrai conforme o tempo restante;
- o ranged também mostra uma esfera luminosa que cresce até o disparo.

Ao sair do windup, morrer, reaparecer ou sofrer reset, anel, cor emissiva e
esfera de carga voltam ao estado inativo. Não há áudio de ataque, animação
final, hit spark ou outro acabamento de Game Feel.

## Token de ataque melee

`MeleeAttackToken` guarda o ID do dono atual ou `null`.

- O melee precisa adquirir o token antes de entrar em `windup`.
- O mesmo dono pode consultar/adquirir novamente sem perder a posse.
- Outro melee não pode adquirir o token enquanto ele estiver ocupado.
- O dono libera o token ao resolver o ataque e entrar em `recovery`.
- A morte do dono libera o token.
- Respawn e reset também garantem a liberação.
- O ranged atua independentemente desse mecanismo.

O token coordena somente `windup` e `attack`; não é um sistema geral de
prioridade, formação ou dificuldade.

## Projéteis

O ranged dispara uma esfera visível com:

| Parâmetro | Valor atual |
| --- | --- |
| Dano | 15 |
| Velocidade | 7 unidades/s |
| Raio | 0,35 unidade |
| Vida máxima | 4s |
| Raio simplificado do jogador | 0,5 unidade |

A direção 3D é calculada entre a origem do disparo e a posição do jogador no
instante do ataque. Depois de criado, o projétil não segue nem corrige a mira.

A colisão usa a distância 3D entre duas esferas. O projétil é removido quando:

- uma colisão aceita a resolução da ameaça pelo jogador;
- a invulnerabilidade global ou a esquiva Samba consome a ameaça;
- sua vida chega a zero;
- sua posição X/Z sai de `[-12, 12]`;
- o encontro é resetado.

Ao ser removido, sua malha sai da cena e geometria e material são descartados.

## Dano, HP, morte e respawn

Melee e ranged usam `applyDamageToHp` e só aceitam dano no estado `active`.
O HP não fica abaixo de zero, e `receiveHit` informa o dano efetivamente
aceito.

Em um acerto não letal:

- a barra de HP é atualizada;
- o corpo pisca em branco por 0,1s;
- o inimigo recebe knockback de 0,8 unidade em XZ, na direção do golpe;
- a posição resultante é limitada à arena.

Em um acerto letal:

- windup e telegraph são cancelados;
- o melee libera o token, se o possuir;
- o inimigo entra em `dying`, reduz a escala e depois fica invisível;
- após 3s no total, HP, posição, escala, timers, apresentação e estado inicial
  são restaurados.

Os respawns são independentes. A morte de um inimigo não reseta nem interrompe
os demais.

## Altura, pulo e salto duplo

Os ataques melee inimigos separam alcance horizontal e tolerância vertical.
Mesmo dentro de 1,5 unidade em XZ, o golpe falha quando a diferença em Y é
maior que 1,25 unidade.

Projéteis usam colisão esférica 3D e também podem passar abaixo ou ao lado do
jogador. Pulo e salto duplo são, portanto, ferramentas defensivas contra os
dois arquétipos.

Os ataques e o dash ofensivo do jogador continuam projetados em XZ e ignoram
Y. O jogador pode atingir inimigos terrestres enquanto está no ar.

## Interação com as estações

Os inimigos mantêm os mesmos HP, estados e parâmetros em todas as estações. A
diferença está nas operações do jogador contra `CombatTarget`:

- **Phonk:** ataques aplicam o multiplicador crescente do combo; dash pode
  cancelar um ataque em andamento.
- **Samba:** o dash abre a janela defensiva e o contra-ataque. Uma colisão
  melee ou de projétil durante a esquiva, sem invulnerabilidade global ativa,
  é consumida sem dano e ativa o slow motion; o próximo hit válido com counter
  aplica ×1,5.
- **Forró:** o ataque pode acertar vários alvos, e cada alvo recebe uma
  resolução própria. O dash pode atingir cada inimigo uma vez por ação e
  concede +2 de energia uma única vez se ao menos um hit for aplicado.

Cada ataque bem-sucedido concede +2 de energia uma única vez. Durante
transformação, hits não concedem energia. A transformação não altera HP, IA,
dano ou FSM dos inimigos.

## Reset do encontro

Quando o jogador morre, o loop impede novas atualizações do encontro e mantém
inimigos e projéteis congelados enquanto a tela de morte está aberta.

Ao acionar `Reviver`, `EncounterController.reset()`:

1. remove todos os projéteis;
2. limpa o token melee;
3. restaura os dois melees nos spawns, com 50 HP e estado `chase`;
4. restaura o ranged no spawn, com 40 HP e estado `reposition`;
5. limpa timers, telegraphs, flashes, contadores de ataque/disparo e estados
   de morte;
6. reinicia a sequência de IDs dos projéteis.

O reset reutiliza as instâncias existentes e é idempotente. A restauração do
jogador, energia, transformação, estados das estações, áudio, visual e HUD é
coordenada por `main.ts` e pelos sistemas correspondentes.

## Invariantes

- Existem exatamente dois melees e um ranged no encontro atual.
- Somente um melee pode estar em `windup` ou `attack`.
- Cada ataque melee resolve no máximo uma tentativa de dano.
- Cada ciclo ranged cria no máximo um projétil.
- Projéteis não são teleguiados.
- Não há dano por contato.
- Inimigos e projéteis respeitam os limites X/Z da arena.
- Ataques inimigos consideram altura; ataques do jogador ignoram Y.
- Estados `dying` e `dead` não perseguem, atacam ou disparam.
- Respawn individual não altera os outros inimigos.
- Reset completo remove projéteis, libera o token e cancela ataques pendentes.
- Pausa e tela de morte congelam as atualizações do encontro.

## Limitações atuais

- Corpos, barras de HP e telegraphs usam geometria e DOM provisórios.
- Melee e ranged possuem implementações separadas e repetem parte do ciclo de
  vida, HP e apresentação.
- A movimentação é direta em XZ, sem obstáculos, navegação ou pathfinding.
- A separação corporal é uma correção posicional simples, não física.
- O ranged só aproxima, afasta e permanece na faixa; não usa strafe, cobertura
  ou táticas de grupo.
- A coordenação dos melees limita ataques simultâneos, mas não forma filas,
  papéis ou padrões de grupo.
- O encontro não escala quantidade, atributos ou agressividade.
- Os alvos-treino da Foundation permanecem na cena junto dos inimigos.

## Decisões deliberadamente adiadas

Não fazem parte do modelo atual:

- waves, rodadas ou progressão de dificuldade;
- novos arquétipos, bosses ou coordenação avançada;
- pathfinding, navegação complexa, obstáculos ou cobertura;
- dificuldade adaptativa;
- motor de física, ragdoll ou empurrões físicos;
- animações e modelos finais;
- hitstop, hit sparks, câmera de impacto, áudio de golpe e demais efeitos de
  Game Feel;
- armas por estação e novos ataques;
- arte final da arena e do HUD.

Esses itens permanecem fora desta referência até serem especificados,
implementados e validados em suas fases correspondentes.

## Arquivos relevantes

### Implementação

- `src/combat-target.ts`
- `src/encounter-controller.ts`
- `src/melee-enemy.ts`
- `src/melee-attack-token.ts`
- `src/enemy-projectile.ts`
- `src/ranged-enemy.ts`
- `src/player.ts`
- `src/main.ts`

### Matemática

- `src/melee-math.ts`
- `src/ranged-math.ts`
- `src/combat-math.ts`
- `src/station-combat-math.ts`

### Testes

- `src/melee-math.spec.ts`
- `src/ranged-math.spec.ts`
- `src/melee-attack-token.spec.ts`
- `src/enemy-projectile.spec.ts`
- `src/encounter-composition.spec.ts`
- `src/encounter-controller.spec.ts`
- `e2e/core-combat.spec.ts`

### Documentação relacionada

- `docs/tech-specs/phase-02-core-combat.md`
- `.specs/references/station.md`
- `.specs/LESSONS.md`
