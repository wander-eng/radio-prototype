# Spec — Fase 3: Game Feel

**Status:** ✅ concluída em 24 de julho de 2026. Builders 3A–3G, validação
automatizada e testes manuais concluídos.

## Contexto

A Fase 2 encerrou o núcleo funcional do encontro: jogador com ataque, combo,
dash, pulo e salto duplo; dois melees coordenados; um ranged com projéteis;
dano, HP, invulnerabilidade, morte, retomada manual; soft aim; energia,
transformação e integração das três estações.

O combate já comunica suas regras, mas ainda depende principalmente de barras,
popups, flash simples e deslocamento instantâneo para indicar impacto. A Fase 3
não adiciona profundidade estrutural. Ela melhora a percepção dos eventos que
já existem.

Valores numéricos desta spec para hitstop, shake, flash, partículas, vozes,
knockback e modificadores são **tuning inicial para implementação e validação
manual**.
Eles são limites e pontos de partida verificáveis, não valores finais de
produção.

## Estado Atual Observado

### Fluxo de um ataque do jogador

1. `InputManager` registra o botão esquerdo do mouse.
2. `Player` inicia um windup de 0,1s.
3. No commit, o jogador calcula e fixa a direção exata do golpe.
4. Um raycast direto contra a malha-raiz de um alvo ativo tem prioridade.
5. Sem raycast, o soft aim escolhe um inimigo válido em até 4,5 unidades e 20°.
6. Phonk e Samba selecionam um alvo; Forró pode selecionar vários.
7. `CombatTarget.receiveHit()` aplica o dano e retorna:
   - se o dano foi aplicado;
   - se o alvo morreu;
   - quanto dano foi aceito.
8. O alvo aplica sua reação local de flash e knockback.
9. `Player` atualiza combo, counter Samba e energia.
10. HUD e barras de HP refletem o novo estado.
11. Um inimigo morto encolhe por 0,3s, fica inativo e reaparece após 3s.

Não existe hoje um evento agregado que descreva a ação, a estação, a
quantidade de alvos, o tipo de impacto e sua intensidade.

### Feedbacks atuais

| Evento | Classificação | Estado observado |
| --- | --- | --- |
| Ataque no vazio | Ausente | Não há som de golpe, trail, partícula, hitstop ou reação |
| Hit normal | Funcional, mas fraco | Flash branco de 0,1s, knockback instantâneo de 0,8 e barra de HP |
| Hit letal | Funcional, mas fraco | O inimigo encolhe e desaparece, sem impacto distinto |
| Dano recebido | Funcional, mas fraco | HP e invulnerabilidade mudam, sem reação visual ou sonora própria |
| Projétil acertando | Funcional, mas fraco | O projétil é removido e o HP muda |
| Esquiva Samba | Funcional, mas discreto | Slow motion de 150ms, sem sinal audiovisual próprio |
| Counter Samba | Funcional, mas fraco | Dano ×1,5 e popup `CONTRA-ATAQUE!` |
| Dash Forró acertando | Funcional, mas fraco | Dano multialvo e +2 único, sem resposta global por ação |
| Combo Phonk | Funcional, mas fraco | Multiplicador, contador e popup no teto do combo |
| Transformação | Funcional e suficiente no nível global | Aura, personagem, ambiente e música mudam; hits não recebem peso próprio |
| Morte do jogador | Funcional e suficiente | Overlay imediato, encontro congelado e retomada manual |

### Sistemas relevantes

- `main.ts` coordena loop, delta escalado/não escalado, slow motion, energia,
  transformação, morte e publicação dos hooks DEV.
- `Player` detecta o contexto do ataque e sabe estação, counter, combo,
  transformação indireta, número de alvos e resultado aceito.
- `CombatTarget` conhece HP, estado e resultado de dano, mas não deve conhecer
  câmera, áudio ou efeitos globais.
- Melee, ranged e alvos-treino repetem parte da reação de flash e knockback.
- Melee e projétil chamam `Player.receiveAttack()`, mas não encaminham o
  resultado para um sistema de feedback.
- `FollowCamera` calcula o acompanhamento normal. `EffectsManager` já altera
  FOV, offset, órbita e lerp durante trocas de estação.
- `EffectsManager` cria e descarta diretamente partículas de troca e aura. Não
  há limite global ou operação geral de limpeza.
- `AudioManager` já separa `musicGain` e `sfxGain`, mas não possui vocabulário
  de ataque e impacto. Os assets existentes não incluem sons adequados de hit.
- O loop usa um único `timeScale` mutável para a Samba. Essa representação não
  suporta hitstop sobreposto de forma segura.

### Riscos observados

- Concentrar classificação, tempo, câmera, partículas e áudio em `main.ts`.
- Disparar feedback uma vez por alvo em ataques Forró e multiplicar hitstop,
  shake e som.
- Deixar telegraph e flash escreverem no mesmo material sem prioridade
  explícita.
- Restaurar `timeScale = 1` enquanto o slow motion ou hitstop ainda estiver
  ativo.
- Aplicar shake diretamente à posição da câmera e acumular deriva.
- Criar partículas ou vozes sem teto e degradar WebGL/áudio em sessões longas.
- Testar efeitos subsegundo por frame exato ou sleep fixo no Playwright.

## Problema

O jogo confirma matematicamente que um golpe acertou, mas nem sempre comunica
o impacto com clareza e peso proporcionais. Hits normais, counters, golpes
multialvo, mortes e dano recebido possuem respostas sensoriais muito
semelhantes ou ausentes.

Adicionar efeitos sem hierarquia também falharia: todos os eventos ficariam
ruidosos, esconderiam telegraphs e poderiam reduzir controle e conforto.

## Pergunta da Fase

> O jogador sente prazer só em acertar um inimigo?

## Hipótese

Um conjunto pequeno, hierarquizado e limitado de feedbacks — combinando
resposta temporal, visual, física e sonora — fará os impactos existentes
parecerem mais claros e satisfatórios sem prejudicar o controle, a leitura do
encontro ou a identidade das estações.

A hipótese falha se:

- o jogador não percebe diferença relevante em relação ao build da Fase 2;
- hitstop parece travamento;
- shake, flash ou áudio causam desconforto ou fadiga;
- os efeitos escondem telegraphs ou ameaças;
- ataques multialvo produzem excesso de feedback;
- controles parecem atrasados ou deixam de responder;
- estados temporais ou visuais ficam presos após pausa, morte ou revive;
- as estações continuam sensorialmente iguais ao acertar.

## Critério de Sucesso

### Técnico

- Todo impacto válido é classificado uma única vez por ação.
- Ataque no vazio não dispara feedback de acerto.
- Forró multialvo nunca multiplica hitstop, shake ou som pelo número de alvos.
- Slow motion Samba, hitstop, pausa, morte e transformação não deixam a escala
  temporal presa.
- Efeitos respeitam os tetos globais e são limpos no reset.
- Repetição de combate, respawn, transformação e revive não aumenta
  indefinidamente as contagens observáveis de efeitos.
- Testes anteriores permanecem verdes.

### Perceptivo

A validação manual deve confirmar:

- reconhecimento imediato dos hits sem depender apenas da barra de HP;
- distinção entre dano causado e dano recebido;
- peso superior para hits fortes, counters, multialvo e morte;
- melhora de clareza ou peso em relação ao baseline da Fase 2;
- preservação do controle, do conforto e da leitura dos telegraphs;
- diferenças perceptíveis entre Phonk, Samba e Forró sem pipelines separados.

Prazer não é tratado como métrica automatizável. Testes comprovam contratos e
limites; os testes manuais determinam a aceitação perceptiva da fase.

## Escopo

- Evento tipado e agregado de impacto.
- Classificação proporcional de impactos.
- Hitstop curto e limitado.
- Camera shake posicional pequeno.
- Flash e reação visual de inimigos e jogador.
- Knockback curto com desaceleração.
- Hit sparks geométricos e provisórios.
- Sons de ataque e impacto sintetizados via Web Audio API.
- Diferenciação mínima por estação.
- Observabilidade DEV, testes automatizados e validação manual da fase.
- Limpeza completa em pausa, morte, revive, respawn e reset, conforme aplicável.

## Fora do Escopo

- Armas definitivas ou trail de arma dependente de modelo.
- Movesets, ataques ou fontes de dano novos.
- Rastro Phonk com dano persistente.
- Dano ou knockup no dash Samba.
- Stun no dash Forró.
- Novos inimigos, waves, bosses ou progressão.
- Rank, desbloqueios ou dificuldade crescente.
- Modelos, rig, animações ou HUD finais.
- Menu ou tela de acessibilidade.
- Cenário e produção visual finais.
- Shaders complexos, texturas finais ou sistema genérico de VFX.
- Ragdoll, motor de física, stagger amplo ou hit-stun estrutural.
- Pathfinding ou navegação complexa.
- Reescrita geral da câmera.
- Mixagem profissional ou assets comerciais finais.
- Alteração de pitch/velocidade das músicas.
- Sincronização com BPM.
- Multiplayer.

## Hierarquia de Impactos

### Categorias e tuning inicial

| Categoria | Hitstop | Shake | Flash | Sparks | Reação física | Áudio |
| --- | ---: | --- | ---: | ---: | --- | --- |
| Ataque no vazio | 0 | Nenhum | 0 | 0 | Nenhuma | Swing leve |
| Hit normal | 30ms | 0,025 por 100ms | 80ms | 6 | 0,65 em ~80ms | Hit curto |
| Phonk forte | 45ms | 0,045 por 120ms | 100ms | 10 | 0,85 em ~80ms | Hit grave/seco |
| Counter Samba | 50ms | 0,035 por 100ms | 100ms | 8 | 0,8 em ~80ms | Transiente preciso |
| Forró multialvo | 45ms uma vez | 0,05 por 130ms, uma vez | 90ms por alvo | 4 por alvo, teto 12 | 0,8 por alvo | Varredura única |
| Hit letal em inimigo | 65ms | 0,075 por 160ms | 120ms | 14 | 0,6 antes de `dying` | Impacto de morte |
| Dano recebido | 55ms | 0,08 por 180ms | 120ms no jogador | 6 | Sem deslocar jogador | Dano distinto |
| Esquiva Samba | 0 | 0,02 por 80ms | Sinal dourado de 80ms | 6 | Nenhuma | Confirmação aguda |

Os valores são tuning inicial. O teto global inicial é:

- hitstop: 75ms;
- shake posicional: 0,1 unidade;
- 12 bursts e 96 partículas de impacto simultâneas;
- 8 vozes SFX simultâneas;
- flash: renovação do tempo, nunca soma de brilho.

### Definição das categorias

- **Phonk forte:** hit que alcança ou já utiliza o teto de +30% do combo. Não
  criar “final de combo” ou golpe novo.
- **Counter Samba:** hit válido que consome o bônus ×1,5.
- **Forró multialvo:** ação de ataque que aplica dano em dois ou mais alvos.
  Um único alvo continua sendo hit normal.
- **Hit letal:** substitui a categoria global anterior. Não soma hitstop de
  normal/forte com morte.
- **Dano recebido:** melee e projétil usam a mesma categoria conceitual quando
  `Player.receiveAttack()` aceita dano.
- **Esquiva Samba:** ameaça consumida por esquiva real. O counter concedido
  apenas pelo dash não dispara este feedback.

### Transformação

Transformação é modificador, não categoria independente:

- adiciona inicialmente até 10ms ao hitstop da categoria;
- multiplica shake, partículas e presença sonora por 1,2;
- preserva a cor e o preset sonoro da estação;
- respeita todos os tetos globais;
- não altera dano, energia, combo ou regras de transformação.

### Prioridade e acumulação

1. Morte do jogador e overlay têm prioridade absoluta.
2. Hit letal em inimigo substitui o impacto normal da mesma ação.
3. Counter Samba e Phonk forte substituem o hit normal.
4. Forró multialvo agrega os alvos e emite uma resposta global.
5. Transformação modifica o resultado escolhido.
6. Hitstops próximos usam o maior tempo restante; nunca somam.
7. Impulsos de shake podem somar, mas são limitados pelo teto.
8. Flashes renovam duração sem aumentar brilho.
9. Partículas e áudio descartam ou substituem feedback de menor prioridade
   quando o limite global é alcançado.

Se jogador e inimigo recebem dano no mesmo intervalo, ambos os eventos podem
existir, mas o tempo efetivo usa apenas o maior hitstop e o shake permanece
limitado. Dano letal no jogador abre o overlay no mesmo frame e não pode ser
atrasado por hitstop.

## Requisitos Funcionais

### Evento de impacto

Usar um contrato pequeno e serializável em sua parte lógica:

```ts
type ImpactKind =
  | 'miss'
  | 'normal'
  | 'phonk-strong'
  | 'samba-counter'
  | 'forro-multi'
  | 'enemy-kill'
  | 'player-damaged'
  | 'samba-dodge';

interface ImpactTargetResult {
  targetId: string;
  position: { x: number; y: number; z: number };
  damageAccepted: number;
  killed: boolean;
}

interface ImpactEvent {
  actionId: number;
  kind: ImpactKind;
  source: 'basic-attack' | 'forro-dash' | 'melee' | 'projectile';
  station: 'phonk' | 'samba' | 'forro' | null;
  transformed: boolean;
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  targets: readonly ImpactTargetResult[];
}
```

O formato final pode ser ajustado ao TypeScript existente, preservando:

- um ID por ação;
- nenhum objeto Three.js no payload lógico;
- resultados aceitos por alvo;
- contexto suficiente para classificar o impacto;
- uma emissão global por ação.

### Detecção, classificação e execução

- `Player` agrega resultados dos ataques e do dash Forró.
- A resolução de dano continua pertencendo a `CombatTarget.receiveHit()`.
- `Player.receiveAttack()` continua sendo a fonte de verdade para dano,
  invulnerabilidade e esquiva.
- Melee e projétil encaminham o resultado aceito para o callback local de
  impacto, sem conhecer câmera ou áudio.
- Funções puras classificam categoria, modificadores e limites.
- Um `ImpactFeedbackController`, ou nome equivalente, recebe o evento e
  coordena solicitações de tempo, câmera, partículas e áudio.
- Reação local de material e knockback permanece encapsulada no alvo ou em um
  componente pequeno de apresentação; não vai para `main.ts`.
- `main.ts` instancia os sistemas e encaminha deltas/eventos, sem classificar
  impactos nem criar partículas diretamente.

### Hitstop

- Não interromper `requestAnimationFrame` nem bloquear a thread.
- Hitstop produz escala de gameplay 0 por tempo limitado.
- Movimento do jogador, ataques, dash, física vertical, inimigos, FSM,
  projéteis, knockback e janelas de combate recebem delta escalado 0.
- Input continua sendo coletado. Estado segurado permanece disponível quando
  o gameplay retomar; não criar buffer novo nesta fase.
- Render, HUD, overlay, áudio, shake, flash e partículas continuam atualizando
  com tempo de apresentação não escalado.
- O consumo da transformação continua em tempo não escalado.
- O timer Samba de 150ms continua avançando em tempo não escalado mesmo
  durante hitstop. Hitstop apenas tem prioridade na escala efetiva.
- A janela de counter Samba continua usando tempo de gameplay escalado; não
  expira durante hitstop.
- Solicitações simultâneas usam `max(tempoAtual, novoTempo)`.
- Não existe cooldown separado inicialmente; o ID da ação e a agregação
  multialvo impedem duplicação.
- Dano letal no jogador cancela hitstop e inicia o lifecycle de morte
  imediatamente.

### Controle temporal

Substituir a escrita direta de um único `timeScale` por fontes independentes:

- `hitstopRemaining`;
- `sambaSlowMotionRemaining`;
- estado de pausa/morte.

Prioridade da escala de gameplay:

1. pausa ou morte: encontro não atualiza;
2. hitstop ativo: 0;
3. slow motion Samba ativo: 0,5;
4. normal: 1.

Regras:

- timers de hitstop e Samba usam delta não escalado;
- pausa congela os dois timers;
- transformação usa delta não escalado quando o jogo está ativo;
- morte/revive zera todas as fontes e restaura escala 1;
- nenhum módulo multiplica novamente um delta já escalado.

### Camera shake

- Representar shake como impulsos com amplitude, duração, frequência e origem.
- Usar ruído ou oscilação determinística por impulso, evitando dependência de
  `Math.random()` nos cálculos testáveis.
- Somar impulsos ativos e limitar a amplitude final a 0,1 unidade.
- Usar decaimento `ease-out`; não manter offset residual.
- Dano causado usa shake curto e mais seco.
- Dano recebido usa shake ligeiramente mais longo e grave.
- Aplicar o offset depois do acompanhamento normal e dos offsets de troca de
  estação.
- Não escrever no `baseOffset`, FOV base ou posição de referência.
- Pausa retorna a câmera à posição sem shake e congela a duração restante.
- Ao retomar, o impulso pode concluir pelo tempo restante sem acumular offset.
- Morte, revive e reset descartam todos os impulsos.
- Prever um multiplicador `shakeStrength` com padrão 1 e faixa 0–1 para futura
  configuração, sem criar UI agora.

### Flash e reação visual

- Inimigos recebem flash claro/emissivo proporcional à categoria.
- O jogador recebe flash branco-avermelhado ao sofrer dano.
- Hit letal mantém uma resposta visível antes ou junto do início de `dying`.
- Flash tem prioridade visual temporária sobre telegraph; ao terminar, o
  telegraph vigente reaparece com seu progresso atual.
- Flash não cancela windup, ataque, recovery ou token.
- Cada entidade deve possuir material próprio ou estado-base próprio. Não
  mutar material compartilhado sem clonagem.
- A restauração usa a aparência lógica atual, não uma cor capturada que possa
  ter ficado obsoleta após transformação ou troca.
- Novo hit renova o tempo e atualiza a categoria, sem somar emissividade.
- Respawn, reset, morte do jogador e revive limpam flash e restauram a
  aparência correta.
- Não usar tela inteira piscando.

### Partículas e hit sparks

- Emitir no centro do alvo ou no ponto médio aproximado entre origem e alvo.
- Direção principal acompanha o vetor do golpe; dispersão lateral comunica o
  contato.
- Cada burst usa um `THREE.Points` com geometria própria, não uma malha por
  partícula.
- Vida inicial entre 120ms e 260ms conforme categoria.
- Movimento usa delta de apresentação não escalado; pausa congela.
- Hit letal produz burst maior, mas ainda dentro do teto.
- Ao atingir o limite:
  - efeitos de morte/dano recebido podem remover o burst normal mais antigo;
  - hits normais novos podem ser descartados;
  - nunca exceder 12 bursts ou 96 partículas.
- Criação direta é a decisão inicial. O número baixo de sistemas e a vida
  curta não justificam pooling antes de medição.
- Todo burst removido sai da cena e descarta geometria e material.
- `reset()` é idempotente e limpa todos os bursts.

### Knockback e reação física

- Direção usa o vetor XZ normalizado do ataque.
- Aplicar deslocamento ao longo de aproximadamente 80ms com desaceleração
  `ease-out`.
- Hit normal inicia em 0,65 unidade; forte/counter/multialvo usam os valores da
  tabela.
- Transformação aplica o modificador limitado antes do clamp.
- O deslocamento final respeita `[-12, 12]`.
- Knockback não interrompe FSM, telegraph, token ou recovery.
- Não criar imunidade, stagger ou hit-stun.
- Novo hit substitui ou combina o impulso restante até um deslocamento máximo
  de 1,1 unidade; nunca acumula deslocamento sem teto.
- Hitstop congela a progressão do knockback.
- Hit letal pode deslocar até 0,6 antes ou durante o começo de `dying`.
- Respawn e reset zeram impulso e restauram spawn.
- O jogador não recebe deslocamento nesta fase; shake e flash comunicam dano
  sem retirar controle adicional.

### Áudio de impacto

- Reutilizar `AudioContext`, `sfxGain` e controles de volume existentes.
- Gerar sons provisórios com osciladores, ruído sintetizado, filtros e
  envelopes curtos; não adicionar assets externos.
- Vocabulário mínimo:
  - swing no vazio;
  - hit normal;
  - hit forte/counter;
  - multialvo;
  - morte inimiga;
  - dano recebido;
  - esquiva Samba.
- Usar um motor comum com presets sutis por estação.
- Variar discretamente pitch/envelope entre até três variantes determinísticas
  ou pseudoaleatórias limitadas para reduzir repetição.
- Máximo de 8 vozes de impacto. Ao atingir o teto, substituir a voz normal
  mais antiga; não cortar feedback de morte ou dano recebido para tocar swing.
- SFX continuam durante hitstop.
- Pausa usa a suspensão já existente do `AudioContext`.
- Não alterar pitch, velocidade ou volume automático da música.
- Não aplicar ducking de música nesta fase.
- Reset encerra vozes provisórias ainda ativas.

### Dano letal no jogador

- Dano recebido pode solicitar flash, shake e som.
- Se o dano for letal, morte e overlay têm prioridade no mesmo frame.
- Não atrasar o overlay para concluir hitstop.
- O lifecycle de morte restaura escala 1 e limpa feedbacks temporários.
- O overlay continua sendo a comunicação principal de morte.

## Requisitos Não Funcionais

### Performance

- Não exceder os limites globais definidos nesta spec.
- Não criar nova geometria por partícula individual.
- Não realizar raycasts adicionais para feedback.
- Não introduzir atualização O(n²) entre partículas.
- Expor contagens observáveis para sessões repetidas.
- Medir estabilidade em desktop alvo antes de afirmar desempenho adequado.
- Ausência de crescimento observável não é prova completa de ausência de leak.

### Acessibilidade e conforto

- Shake limitado e preparado para multiplicador 0–1.
- Não usar flash de tela cheia.
- Flash de entidade sem alternância rápida de alto contraste.
- Feedback multialvo agregado.
- Sons com envelope curto e limite de vozes.
- Valores de shake, flash e áudio centralizados em constantes de tuning.
- Menu de acessibilidade permanece fora da fase, mas a implementação não deve
  impedir redução futura de shake, flashes e volume de impacto.

### Manutenção

- Matemática de classificação, tempo, limites e decaimento deve ser pura.
- Objetos Three.js não entram em testes unitários quando um snapshot simples
  basta.
- Controladores expõem operações estreitas e idempotentes.
- Nenhum inimigo conhece detalhes de câmera, HUD ou áudio.
- `main.ts` apenas conecta sistemas e seleciona deltas.

## Decisões de Design

- Feedback proporcional: hit normal permanece pequeno para preservar espaço
  para counter, multialvo e morte.
- Ataque no vazio recebe apenas confirmação sonora leve. Não fingir acerto.
- O feedback não bloqueia movimento além do hitstop global curto; recovery
  continua sem bloquear movimento conforme L-001.
- Hit forte Phonk é derivado do teto existente, não de um combo final novo.
- Esquiva Samba usa slow motion existente e confirmação própria, sem hitstop.
- Forró agrega resposta global por ação.
- Transformação amplia, mas não redefine, o feedback da estação.
- Telegraph permanece informação prioritária de ameaça e deve voltar após
  qualquer flash.
- Efeitos comunicam impacto; não antecipam a linguagem visual final da Fase 4b.

## Decisões Técnicas

- Contrato local `ImpactEvent`.
- Classificação e tuning em módulo puro focado, como `impact-math.ts`.
- Controlador temporal pequeno, como `combat-time.ts`.
- Controlador de feedback que distribui solicitações sem event bus.
- Shake encapsulado na câmera ou em controlador específico.
- Sparks podem ser adicionados a `EffectsManager` apenas se a separação entre
  troca de estação/aura e impacto continuar clara; caso contrário, usar
  `impact-effects.ts`.
- Síntese provisória estende `AudioManager` sem criar segunda árvore de áudio.
- Reações locais reutilizam materiais próprios dos alvos.
- Todos os controladores da fase oferecem `reset()` idempotente.

## Interação com Sistemas Existentes

### Pausa

- Pausa tem prioridade sobre gameplay e não inicia ou termina impacto.
- Timers de hitstop, slow motion, flash, partículas e knockback ficam congelados.
- Áudio continua usando `AudioContext.suspend()`.
- Offset de shake é removido enquanto pausado para não congelar a câmera em
  posição deslocada.
- Ao retomar, fontes temporais continuam pelo tempo restante.

### Morte e revive

- Morte cancela hitstop, slow motion, shake, flashes, partículas, knockback e
  vozes provisórias.
- Overlay aparece imediatamente.
- `Reviver` reutiliza o reset completo existente.
- Nenhum efeito anterior reaparece depois do revive.

### Transformação

- Dreno continua usando tempo não escalado durante hitstop.
- Morte transformado segue o reset já validado.
- Modificador sensorial não muda energia, duração ou bloqueio de estação.
- Cor dos efeitos acompanha a estação travada.

### Slow motion Samba

- Timer continua em tempo real durante hitstop.
- Hitstop tem prioridade apenas na escala efetiva.
- Ao terminar hitstop, slow motion continua somente pelo tempo real restante.
- Nenhum sistema aplica `timeScale` duas vezes.

### Ataques inimigos

- Melee e projétil usam o resultado explícito de `Player.receiveAttack()`.
- `damage-applied` gera dano recebido.
- `dodged-samba` gera esquiva Samba.
- `ignored-global-invulnerability`, `ignored-dead` e `ignored-invalid` não
  geram impacto de dano.
- Projétil consumido por invulnerabilidade global não produz feedback de
  esquiva.

### Alvos-treino

- Continuam implementando `CombatTarget` e podem receber feedback básico.
- Não entram no soft aim dos inimigos ativos.
- O lifecycle particular de retorno à posição original permanece.
- A Fase 3 não uniformiza alvos-treino e inimigos.

## Identidade por Estação

As diferenças abaixo são presets do mesmo sistema, não três pipelines de VFX.
Elas descrevem comportamento e forma/sensação conforme a golden rule 2.

### Phonk — impacto agressivo e seco

- Sparks verde-limão em explosão radial curta, com dispersão angular irregular.
- Hit forte usa transiente grave, ataque rápido e ruído curto.
- Shake tem ataque rápido e duração curta.
- Intensidade cresce apenas ao alcançar o teto do combo.
- Hits comuns permanecem contidos para que a progressão seja percebida.

### Samba — impacto preciso e limpo

- Sparks dourados/brancos estreitos, orientados como corte ou fita breve.
- Counter usa transiente mais agudo e definido.
- Shake tem menor amplitude lateral e duração curta.
- Esquiva real recebe confirmação dourada leve e som distinto.
- Não criar explosão em área nem transformar dash defensivo em ataque.

### Forró — impacto amplo e de varredura

- Sparks laranja em leque ou pequeno arco circular acompanhando a direção.
- Multialvo usa um whoosh/impacto único por ação.
- Reação local existe em cada alvo, mas o feedback global não multiplica.
- A forma deve sugerir fluxo e controle de grupo, não explosão Phonk.

### Transformado

- Mantém a forma da estação.
- Aumenta discretamente escala, densidade e presença sonora.
- Nunca excede limites ou converte hit normal automaticamente em morte/forte.

## Avaliação dos Aprimoramentos de Dash

### Phonk — rastro explosivo persistente com dano

- Ajuda fantasia agressiva, mas cria dano contínuo, ticks, stacking e nova área
  persistente.
- Altera balanceamento, energia, IA e testes.
- Sobrepõe-se às possibilidades de armas/explosões da Fase 4a.
- **Decisão:** fora da Fase 3; encaminhado para a Fase 3.5 com spec própria.

### Samba — dano e knockup

- Adiciona fonte ofensiva e controle vertical ao dash hoje defensivo.
- Pode diluir precisão/esquiva e exige regras de altura e interrupção.
- Precisa de validação manual própria contra a identidade validada.
- **Decisão:** fora da Fase 3; encaminhado para a Fase 3.5 com spec própria.

### Forró — stun

- Reforça controle de grupo, mas altera FSM, token, telegraphs e dificuldade.
- Exige duração, imunidade, stacking e interação com respawn.
- É profundidade estrutural, não apenas feedback.
- **Decisão:** fora da Fase 3; encaminhado para a Fase 3.5 com spec própria.

A Fase 3.5 é a próxima etapa planejada do roadmap. Sua spec deve ser escrita e
aprovada antes de qualquer implementação.

## Observabilidade DEV

Estender `window.__GAME_STATE__` apenas com snapshots serializáveis:

- `hitstopActive`;
- `hitstopRemaining`;
- `effectiveTimeScale`;
- `activeTimeSources`, como lista de `'hitstop' | 'samba-slow-motion'`;
- `cameraShakeActive`;
- `cameraShakeIntensity`;
- `impactParticleCount`;
- `impactBurstCount`;
- `activeImpactVoiceCount`;
- `lastImpactKind`;
- `lastImpactActionId`;
- `lastImpactIntensity`;
- `flashingEntityIds`;
- `knockbackEntityIds`;
- `activeImpactEffectCount`.

Campos de “último impacto” permanecem registrados até o próximo evento ou
reset, permitindo E2E sem depender de um único frame.

Controles DEV estreitos podem:

- preparar posição/HP pelos hooks existentes;
- provocar um ataque real do jogador;
- preparar o teto do combo Phonk;
- preparar counter Samba pela lógica real;
- agrupar alvos para Forró;
- causar dano no jogador pela operação real;
- limpar feedbacks por `reset()`.

Não expor:

- objetos Three.js, materiais ou nós de áudio;
- controle genérico de intensidade arbitrária;
- mutação direta das coleções;
- evento falso que contorne dano e classificação de produção.

## Estratégia de Testes

### Testes unitários

Cobrir:

- classificação de erro, normal, Phonk forte, counter, multialvo, morte,
  dano recebido e esquiva;
- morte substituindo categoria inferior;
- transformação aplicando +10ms/×1,2 e respeitando tetos;
- Forró agregando vários alvos em uma ação;
- combinação de hitstop por máximo, não soma;
- prioridade hitstop sobre Samba;
- timer Samba continuando em tempo não escalado;
- transformação não prolongada por hitstop;
- pausa congelando timers;
- morte/reset limpando fontes;
- decaimento e clamp do shake;
- ausência de deriva após o shake;
- flash renovando duração sem acumular brilho;
- cálculo de impulso e clamp do knockback;
- limite de bursts/partículas;
- prioridade de descarte no limite;
- seleção limitada de variação sonora;
- limite de vozes;
- `reset()` idempotente nos sistemas.

Não testar Three.js diretamente quando a regra puder receber números e
snapshots simples.

### E2E permanente

Criar casos focados, sem pixel assertions:

- ataque no vazio registra `miss` e não cria feedback de acerto;
- hit normal registra evento e ativa hitstop/flash;
- hitstop começa, termina e devolve controle;
- Phonk no teto produz categoria forte;
- counter Samba produz sua categoria e consome o bônus normalmente;
- Forró multialvo registra uma ação e um hitstop;
- dano recebido é distinto de dano causado;
- slow motion e hitstop não deixam escala presa;
- transformação mantém aura/regras e modifica impacto dentro do teto;
- pausa durante efeito não causa softlock;
- morte/revive limpa todos os efeitos;
- repetição não aumenta indefinidamente contagens observáveis.

Preservar `workers: 1`, sem retries ou aumento arbitrário de timeout.
Aplicar L-008 a L-011:

- confirmar servidor Vite do workspace;
- estabilizar primeiro o caso focado;
- segurar inputs até confirmação observável;
- usar hooks estreitos para janelas subsegundo;
- evitar waits fixos, frames exatos e asserts audiovisuais frágeis.

### Validação manual

Somente testes manuais podem avaliar:

- prazer e peso;
- reconhecimento imediato do hit;
- excesso de hitstop ou shake;
- clareza de telegraphs;
- repetição/fadiga de partículas e som;
- sensação distinta entre estações;
- desconforto, enjoo ou perda de controle;
- proporção entre hit normal, forte, morte e dano recebido.

## Plano de Builders

### 3A — Contrato e classificação de impacto

**Objetivo:** representar e classificar impactos sem alterar apresentação.

**Arquivos prováveis:** novo módulo de impacto e matemática, `player.ts`,
`combat-target.ts`, inimigos e projétil.

**Comportamento:**

- criar `ImpactEvent`;
- agregar resultados por ação;
- classificar todas as categorias;
- encaminhar resultados de dano recebido e esquiva;
- deduplicar ação Forró.

**Fora do escopo:** hitstop, shake, flash novo, partículas e áudio.

**Testes:** classificação, prioridade, multialvo, transformação e eventos
ignorados.

**Validação manual:** confirmar que gameplay não mudou.

**Conclusão:** todos os impactos aparecem corretamente em observabilidade
provisória e testes anteriores permanecem verdes.

**Risco:** duplicar eventos nos alvos e no jogador.

### 3B — Hitstop e controle temporal

**Objetivo:** suportar hitstop e Samba sem restaurar escala incorreta.

**Arquivos prováveis:** novo controlador temporal, `main.ts`,
`station-combat-math.ts` e testes.

**Comportamento:**

- fontes independentes;
- prioridade de escala;
- timers não escalados;
- pausa, morte e reset;
- delta zero apenas para gameplay.

**Fora do escopo:** shake e demais feedbacks.

**Testes:** composição temporal, sobreposição, multihit, transformação e reset.

**Validação manual:** hitstop parece impacto, não travamento; input retorna.

**Conclusão:** nenhum fluxo deixa escala diferente de 1 após terminar.

**Dependência:** 3A.

**Risco:** aplicar delta escalado duas vezes.

### 3C — Flash, knockback e reação

**Objetivo:** tornar contato e dano recebido visíveis e físicos.

**Arquivos prováveis:** inimigos, alvo-treino, jogador e módulo puro de reação.

**Comportamento:**

- prioridade flash/telegraph;
- flash do jogador;
- impulso curto desacelerado;
- reação letal;
- limpeza em respawn/reset.

**Fora do escopo:** stagger, cancelamento de FSM e física real.

**Testes:** duração, renovação, prioridade, clamp e reset.

**Validação manual:** telegraph continua legível; knockback não desorganiza a arena.

**Conclusão:** todas as entidades restauram material e posição válidos.

**Dependências:** 3A–3B.

**Risco:** materiais e cores de transformação ficarem presos.

### 3D — Camera shake

**Objetivo:** adicionar impulso espacial curto sem deriva ou desconforto.

**Arquivos prováveis:** `camera.ts`, controlador de shake, `main.ts` e testes.

**Comportamento:**

- impulsos por categoria;
- soma limitada;
- decaimento;
- aplicação depois da câmera base;
- neutralização em pausa/morte/reset.

**Fora do escopo:** reescrita de câmera, rotação cinematográfica ou menu.

**Testes:** decaimento, teto, soma, retorno a zero e idempotência.

**Validação manual:** conforto, telegraphs e efeitos de troca de estação.

**Conclusão:** nenhuma deriva após repetição ou troca de estação.

**Dependências:** 3A–3B.

**Risco:** conflito com offsets existentes da Samba e do Forró.

### 3E — Sparks e áudio sintético

**Objetivo:** comunicar contato com feedback visual descartável e som provisório.

**Arquivos prováveis:** `effects.ts` ou módulo de impacto, `audio.ts`,
controlador de feedback e testes.

**Comportamento:**

- bursts limitados;
- síntese e presets;
- limites e prioridades;
- limpeza total.

**Fora do escopo:** assets finais, shaders, pooling prematuro e mixagem.

**Testes:** limites, descarte, vozes, variantes e reset.

**Validação manual:** repetição sonora, densidade e clareza.

**Conclusão:** efeitos expiram e contagens retornam a zero.

**Dependências:** 3A–3D.

**Riscos:** contenção WebGL/áudio e criação excessiva.

### 3F — Identidade mínima por estação

**Objetivo:** aplicar presets sensoriais sem alterar regras de combate.

**Arquivos prováveis:** configuração de impacto, efeitos e áudio.

**Comportamento:**

- Phonk radial/seco;
- Samba estreito/preciso;
- Forró em leque/agregado;
- modificador transformado.

**Fora do escopo:** pipelines exclusivos, novos danos e aprimoramentos de dash.

**Testes:** seleção de preset, limites e agregação.

**Validação manual:** identificar diferenças com som mudo e apenas pelo áudio.

**Conclusão:** estações são distintas sem comprometer clareza.

**Dependências:** 3A–3E.

**Risco:** efeitos competirem com música e aura.

### 3G — Observabilidade, validação e testes manuais

**Objetivo:** consolidar contratos, regressões e avaliação perceptiva.

**Arquivos prováveis:** `test-hook.ts`, testes unitários, E2E permanente e a
conclusão documental desta spec.

**Comportamento:**

- snapshots finais;
- promoção apenas de E2E estável;
- inspeção de repetição;
- comparação manual antes/depois.

**Fora do escopo:** tuning não sustentado por validação manual e novas
mecânicas.

**Testes:** suíte completa, build, TypeScript e E2E focado antes da suíte.

**Validação manual:** cenários abaixo.

**Conclusão:** critérios técnicos verdes e resultado dos testes manuais
registrado.

**Dependências:** 3A–3F.

**Risco:** confundir teste automatizado verde com validação de prazer.

## Validação Manual

Os cenários abaixo são executados diretamente a partir desta spec. O resultado
deve ser registrado resumidamente na conclusão da fase, nesta própria spec ou
no PR correspondente. Não existe protocolo, formulário ou relatório separado.

### Comparação antes/depois

Usar o commit final da Fase 2 como baseline.

Comparar um roteiro curto no baseline com o mesmo roteiro na Fase 3 quando isso
ajudar a avaliar clareza, peso e conforto.

O roteiro comparativo inclui:

- três ataques no vazio;
- hits normais repetidos;
- Phonk no teto;
- counter Samba;
- Forró multialvo;
- morte de melee e ranged;
- dano melee e de projétil;
- transformação;
- morte e revive.

### Sessão contínua

- 5 minutos Phonk;
- 5 minutos Samba;
- 5 minutos Forró;
- 10 minutos com troca livre;
- pelo menos uma transformação em cada estação;
- pelo menos uma morte e revive;
- ataques no ar, dash e double jump;
- combate contra melee e ranged;
- repetição suficiente para observar fadiga sonora e visual.

### Aspectos avaliados

1. O hit foi reconhecido imediatamente?
2. O golpe pareceu ter peso?
3. Hitstop pareceu impacto ou travamento?
4. O feedback ajudou ou escondeu ameaças?
5. Houve perda de controle?
6. Shake causou incômodo?
7. Efeitos cansaram após alguns minutos?
8. Hits fortes pareceram mais fortes que hits normais?
9. Dano recebido foi distinto de dano causado?
10. Phonk, Samba e Forró pareceram diferentes?
11. O feedback transformado ficou proporcional?
12. Multialvo Forró ficou legível ou excessivo?
13. Algum efeito ficou preso após pausa, morte ou revive?
14. Houve queda perceptível de performance?
15. Qual versão foi preferida e por quê?

### Critério de conclusão perceptiva

- O desenvolvedor executa os cenários manuais relevantes dos builders.
- Clareza, peso, controle e conforto são considerados adequados para o
  protótipo.
- Dano causado e recebido e a hierarquia dos impactos permanecem distinguíveis.
- Problemas perceptivos bloqueantes são corrigidos e retestados.
- Nenhum softlock ou efeito preso permanece sem correção.
- O resultado é registrado resumidamente nesta spec, na conclusão da fase ou
  no PR, sem protocolo ou formulário separado.

## Resultado Técnico do Builder 3G

Os Builders 3A–3G estão implementados e tecnicamente verdes. A observabilidade
final mantém snapshots serializáveis de tempo, shake, reação, sparks, áudio e
último impacto. `lastImpactIntensity` representa a hierarquia lógica da
categoria sem expor objetos de runtime ou duplicar tuning de apresentação.

A validação final de 24 de julho de 2026 registrou:

- Vitest: 21 arquivos e 239 testes aprovados;
- TypeScript: `npx tsc --noEmit` aprovado;
- build de produção: aprovado, com o aviso já conhecido de chunk acima de
  500 kB;
- Playwright: 47 testes aprovados com `workers: 1`, sem skips ou retries;
- 26 casos E2E permanentes e 21 casos locais ignorados em `e2e/scratch`;
- repetição de hits, Forró multialvo, transformação, morte e revive retornou
  escala, shake, flash, knockback, bursts, partículas e vozes ao estado base;
- o reset limpou o último impacto e preservou a estação selecionada;
- a suíte permanente não depende de arquivos em `e2e/scratch`.

Durante a validação manual intermediária do Builder 3E, sparks e SFX iniciais
foram considerados discretos demais. O tuning visual foi ampliado e validado,
o vocabulário sintético deixou de depender do timbre agudo anterior e o volume
inicial da música foi ajustado ao sweet spot manual de aproximadamente 15%.
Nesse ponto, a música permaneceu predominante e os SFX ficaram perceptíveis e
confortáveis. Não foi implementado ducking.

Os testes manuais foram concluídos pelo desenvolvedor, que considerou os
resultados suficientes para o estágio atual do protótipo. Os ajustes
perceptivos feitos durante o Builder 3E foram preservados e não restaram
problemas bloqueantes informados. Com a validação técnica e manual, a Fase 3
foi considerada concluída.

Os aprimoramentos de dash avaliados nesta spec permanecem fora da Fase 3 e
formam a próxima etapa planejada, **Fase 3.5**, que deve receber tech spec
própria antes de qualquer implementação.

## Riscos

- Hitstop reduzir sensação de resposta em vez de aumentar peso.
- Valores discretos demais não serem percebidos.
- Valores fortes demais produzirem fadiga.
- Feedback recebido competir com telegraphs.
- Acúmulo de efeitos em Forró.
- Conflito de materiais entre flash, telegraph e transformação.
- Câmera derivar após shake e switch.
- Timer Samba ou hitstop restaurar escala incorreta.
- Síntese sonora competir com músicas densas.
- Limites descartarem feedback importante.
- E2E falhar por frame rate, áudio ou janelas curtas.
- Static targets e inimigos apresentarem reações inconsistentes.

Mitigar com builders pequenos, tuning centralizado, limites, estado observável,
testes focados e validação manual antes de expandir efeitos.

## Dívidas Deliberadas

- Alvos-treino e inimigos mantêm lifecycles diferentes.
- Reação de HP/apresentação ainda se repete entre melee e ranged; a Fase 3 só
  extrai o necessário para feedback confiável.
- `EffectsManager` já mistura câmera de estação, partículas de troca e aura.
  Separar impacto em controlador próprio é preferível, mas não autoriza
  refatoração geral dos efeitos existentes.
- Não haverá menu de redução de shake/flash nesta fase.
- Sons sintetizados são provisórios e não equivalem a mixagem final.
- Criação direta de bursts permanece até medição justificar pooling.
- Trail de arma depende de arma/modelo e permanece adiado.
- A ausência de crescimento em contagens observáveis não prova ausência total
  de memory leak.

## Critérios de Conclusão da Fase

- Builders 3A–3G concluídos e validados em ordem.
- Classificação de impactos centralizada e deduplicada por ação.
- Hitstop, slow motion, pausa, morte e transformação compõem tempo corretamente.
- Flash, shake, partículas, knockback e áudio respeitam limites.
- Forró multialvo não multiplica feedback global.
- Phonk, Samba e Forró possuem identidade perceptiva mínima.
- Morte, revive, reset e respawn não deixam efeitos ativos ou presos.
- `npm test`, `npx tsc --noEmit`, `npm run build`, E2E focado e
  `npm run test:e2e` passam sem skips, retries ou testes enfraquecidos.
- Os cenários manuais relevantes são concluídos e aceitos pelo desenvolvedor.
- A pergunta da fase recebe resposta baseada também na avaliação manual, não
  apenas em testes automatizados.
- O resultado resumido é registrado e o roadmap marca a Fase 3 como concluída.

## Questões em Aberto

Não há questão bloqueante pendente na Fase 3.

Permanecem deliberadamente abertas para ajustes e validações futuras:

- valores finais de hitstop, shake, flash, partículas e knockback;
- volume e envelopes finais dos sons sintetizados;
- intensidade final do modificador transformado;
- necessidade de pooling após medição;
- necessidade futura de controles de conforto;
- decisões de design e tuning da Fase 3.5.
