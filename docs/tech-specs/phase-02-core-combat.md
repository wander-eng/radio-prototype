# Spec — Fase 2: Core Combat

**Status:** ✅ concluída em 18 de julho de 2026. A implementação técnica A–F
foi concluída em 17 de julho de 2026; os testes manuais e a validação final
foram confirmados pelo responsável pelo projeto no dia seguinte.

## Objetivo

Transformar os alvos estáticos da vertical slice em um encontro de combate contínuo, com ameaças que perseguem, telegrafam e atacam, para responder à pergunta central da fase:

> O combate continua divertido depois de alguns minutos?

A fase deve testar o loop existente — estações, dash, combo, double jump, energia e transformação — sob pressão real, sem antecipar Game Feel, armas, waves ou produção visual.

## Critério de Sucesso

- Pelo menos dois jogadores conseguem permanecer no loop por 10 minutos sem softlock ou interrupção estrutural.
- Os jogadores descrevem decisões diferentes para Phonk, Samba e Forró, não apenas diferenças numéricas.
- A morte parece consequência legível e justa, e o reset devolve o jogador rapidamente ao combate.
- Melee e ranged exigem respostas diferentes de posicionamento, dash e pulo.
- A transformação continua alcançável e útil sob pressão.

## Fontes de Verdade e Conflito Conhecido

- A identidade das estações continua regida por `.specs/SKILL.md` e `.specs/references/station.md`.
- A regra validada da Fase 1.5 prevalece: enquanto transformado, a estação permanece bloqueada até a energia chegar a zero.
- A frase do Manifesto Criativo que permite troca de estação durante a transformação está obsoleta. Corrigir o Manifesto não faz parte desta fase.

## Estado Inicial

### Funcional

- Movimento relativo à câmera, mira por mouse e ataque com windup/recovery sem bloquear movimento.
- Combo e diferenças mecânicas de Phonk, Samba e Forró.
- Dash por estação e double jump.
- Hitboxes ofensivas projetadas em XZ, permitindo acertar alvos terrestres durante o pulo.
- HP, morte, knockback visual e respawn dos alvos-treino.
- Energia, aura, transformação, HUD, pausa e hook de testes.

### Scaffolding ou implementação antecipada

- O jogador possui `hp = 100` e barra no HUD, mas ainda não recebe dano.
- `invulnerableTimer` existe, mas nenhum ataque inimigo o consulta.
- O contra-ataque Samba foi antecipado como dependente de um dash recente; a Fase D preserva essa propriedade e acrescenta esquiva real para slow motion e consumo da ameaça.
- Double jump e colisões ofensivas compatíveis com movimento vertical foram implementados antes desta spec.

### Ausente

- Inimigos ativos, IA, telegraph e ataques recebidos.
- Dano, morte e respawn funcional do jogador.
- Arena limitada, projéteis e coordenação entre inimigos.
- Soft aim assist para alvos móveis.

## Não Negociar

- Preservar as regras validadas das Fases 1 e 1.5, salvo as mudanças explicitamente descritas nesta spec.
- Não usar dano por contato.
- Não introduzir waves, rodadas, progressão ou encerramento do encontro.
- Telegraph deve comunicar o instante do ataque antes de causar dano.
- Toda transição temporal usa `deltaSeconds`; nenhum `setTimeout` é fonte de verdade de gameplay.
- Ataques do jogador continuam ignorando Y. Ataques inimigos consideram altura.
- Movimento continua livre durante windup e recovery, conforme L-001.
- Soft aim assist nunca substitui um raycast direto nem altera câmera, movimento ou dash.
- Nenhum valor cru de dano, velocidade ou invulnerabilidade aparece no HUD.
- Não adicionar motor de física, pathfinding ou dependências.

## Arena e Ciclo Contínuo

- Arena plana de 24 × 24 unidades, limitada em X/Z ao intervalo `[-12, 12]`.
- Sem obstáculos ou arte final; o limite deve ser visível por geometria simples.
- Spawns:
  - jogador: `(0, 1, 4)`;
  - melee A: `(-3, 1, -3)`;
  - melee B: `(3, 1, -3)`;
  - ranged: `(0, 1, -8)`.
- Jogador e inimigos são mantidos dentro dos limites.
- Projéteis são removidos ao sair da arena.
- Separação simples em XZ impede sobreposição durante movimento normal.
- Dashes atravessam inimigos e não são bloqueados pela separação corporal.
- Cada inimigo reaparece individualmente no próprio spawn 3 segundos após morrer.

## Contrato de Combate

O jogador não deve continuar dependendo concretamente de `Target[]`. Criar um contrato mínimo compartilhado por alvos de combate:

- identificador estável;
- posição/malha necessária para mira e colisão;
- HP máximo e atual;
- estado vivo/morrendo/morto;
- operação de receber hit que retorna se o dano foi aplicado e se matou.

O encontro deve ser coordenado por um controlador próprio, responsável por:

- inimigos e projéteis ativos;
- token de ataque dos melees;
- limites da arena;
- respawns individuais;
- reset completo após morte do jogador.

`main.ts` permanece responsável por inicialização e pelo loop, sem absorver a FSM dos inimigos.

## Inimigos

Usar uma classe de inimigo configurável por arquétipo, compartilhando HP, lifecycle, telegraph e contrato de dano.

### Melee

| Parâmetro | Valor inicial |
| --- | --- |
| Quantidade | 2 |
| HP | 50 |
| Velocidade | 3,2 unidades/s |
| Alcance | 1,5 unidades |
| Windup | 0,6s |
| Dano | 20 |
| Recovery | 0,8s |
| Respawn | 3s |

Estados: `chase`, `windup`, `attack`, `recovery`, `dying` e `dead`.

- O ataque resolve uma única checagem ao terminar o windup; não há dano repetido por frame.
- Apenas um melee pode estar em `windup` ou `attack`. O outro continua perseguindo e se reposicionando.
- O token é liberado ao entrar em recovery, morrer ou sofrer reset.
- A checagem usa alcance em XZ e volume vertical limitado. Um jogador suficientemente alto durante o pulo não é atingido.

### Ranged

| Parâmetro | Valor inicial |
| --- | --- |
| Quantidade | 1 |
| HP | 40 |
| Velocidade | 2,5 unidades/s |
| Distância preferencial | 6–9 unidades |
| Windup | 0,8s |
| Dano do projétil | 15 |
| Velocidade do projétil | 7 unidades/s |
| Raio do projétil | 0,35 unidade |
| Vida máxima do projétil | 4s |
| Recovery | 1,2s |
| Respawn | 3s |

Estados: `reposition`, `windup`, `attack`, `recovery`, `dying` e `dead`.

- Move-se para preservar a faixa de distância preferencial.
- Atua independentemente do token dos melees.
- Ao terminar o windup, mira a posição atual do jogador e cria um projétil não teleguiado.
- Projétil e jogador usam colisão 3D, permitindo evasão horizontal ou vertical.
- O projétil é consumido ao acertar, ser esquivado pela Samba, sair da arena, expirar ou ocorrer reset.

### Telegraph provisório

- Durante o windup, o material do inimigo clareia progressivamente para amarelo.
- Um anel geométrico no chão contrai até o instante do ataque.
- O ranged também forma uma esfera luminosa visível antes do disparo.
- O efeito deve ser geométrico, claro e utilitário. Não adicionar hit sparks, áudio, animações finais ou polish de Game Feel.

## Jogador, Dano e Reset

- HP máximo permanece 100.
- Ao sofrer dano válido, atualizar imediatamente o HUD e conceder 0,5s de invulnerabilidade pós-hit.
- Colisões ocorridas durante essa invulnerabilidade não causam dano e não contam como esquiva Samba.
- Receber dano não cancela transformação.

Ao chegar a zero:

1. Marcar o jogador como morto e bloquear input de gameplay.
2. Restaurar `timeScale = 1`, interromper slow motion e congelar o encontro.
3. Mostrar imediatamente o overlay provisório de morte.
4. Manter jogador, inimigos, projéteis e timers de gameplay congelados por tempo indeterminado.
5. Não executar respawn automático nem avançar um timer de retorno.
6. Aguardar ação explícita no botão `Reviver`.
7. Ao reviver, executar o reset completo antes de retirar o overlay:
   - restaurar HP e posição do jogador;
   - restaurar inimigos nos spawns, com HP e FSM iniciais;
   - remover todos os projéteis e liberar o token melee;
   - zerar combo, energia e transformação;
   - limpar estados temporários de Phonk, Samba e Forró;
   - retornar ao visual e áudio base da estação selecionada.
8. Preservar a estação selecionada.
9. Ocultar o overlay somente depois que o reset terminar e um estado consistente puder ser renderizado.
10. Reativar encontro e input.

Não há vidas, game over ou reload da página.

### Overlay provisório de morte

- Ocupa toda a área do jogo e escurece a cena com fundo preto ou neutro semitransparente.
- Usa HTML semântico e apresenta, em ordem:
  1. `Você morreu!`;
  2. `Tentar de novo?`;
  3. botão `<button type="button">Reviver</button>`.
- O botão recebe foco ao abrir, preserva foco visível e pode ser ativado naturalmente por teclado com Enter ou Espaço.
- O overlay intercepta interação para impedir cliques no canvas.
- Enquanto a retomada estiver em progresso, o botão permanece desabilitado e novos cliques são ignorados.
- O mesmo overlay e listener são reutilizados em mortes futuras; não há recriação do HUD, cena, renderer ou listeners.
- Esta é uma interface funcional provisória da Fase 2E.5 e não antecipa o HUD definitivo da Fase 4b.

## Integração das Estações

### Phonk

- Preservar velocidade, combo crescente e dash-cancel existentes.
- Morte ou troca de estação continua limpando o combo.

### Samba — esquiva real

- Dash concede 0,2s de invulnerabilidade específica da Samba.
- Todo dash abre ou renova uma janela de contra-ataque de 1 segundo, mesmo sem uma ameaça esquivada.
- Slow motion só é ativado quando um ataque melee ou projétil colide durante essa janela; a colisão também renova o contra-ataque já concedido pelo dash.
- O ataque evitado é consumido sem causar dano.
- Slow motion: `timeScale = 0,5` por 150ms, com duração controlada por tempo não escalado.
- O consumo da transformação continua usando tempo não escalado.
- A esquiva confirmada renova a mesma janela de contra-ataque; não acumula bônus adicionais.
- O próximo hit Samba bem-sucedido nessa janela recebe dano ×1,5 e consome o bônus.
- Errar não consome o bônus, mas o tempo continua correndo.
- Trocar de estação, morrer ou expirar o tempo limpa a janela.
- Iniciar dash sem evitar um ataque não ativa slow motion, mas mantém o contra-ataque concedido pelo dash.

### Forró — dash ofensivo

- Preservar ataque em área e dash multialvo.
- Cada alvo pode receber dano uma única vez por dash.
- Se o dash atingir um ou mais inimigos, conceder +2 de energia uma única vez naquela ação.
- O ganho ocorre no primeiro acerto válido do dash e usa uma flag por dash para impedir repetição.
- Durante transformação, o ganho continua sendo zero.

### Double jump e altura

- Ataques e dashes do jogador continuam projetados em XZ e podem acertar inimigos terrestres durante o pulo.
- Ataques melee inimigos usam volume vertical limitado.
- Projéteis usam colisão 3D.
- Não criar ataques aéreos distintos, plataformas ou moveset novo.

## Soft Aim Assist

O raycast direto contra uma malha inimiga sempre tem prioridade.

Quando o raycast não atingir um inimigo:

1. Calcular o vetor pretendido pelo mouse contra o plano do chão.
2. Considerar apenas inimigos ativos a até 4,5 unidades em XZ.
3. Descartar candidatos fora de um cone de 20°.
4. Escolher o menor erro angular; usar distância como desempate.
5. Aplicar snap exato da rotação somente no commit do ataque, imediatamente antes da hitbox.

O assist não altera câmera, movimento, dash, estação ou seleção persistente de alvo.

## Matemática Pura

Manter em `combat-math.ts`, ou extrair para módulo focado caso o arquivo deixe de ser coeso, funções puras para:

- clamp de posição nos limites da arena;
- teste de cone do soft aim assist e seleção do melhor candidato;
- alcance horizontal com limite vertical para melee;
- colisão esférica 3D de projétil;
- aplicação/clamp de HP;
- decisão de dano, esquiva ou invulnerabilidade;
- ganho único do dash Forró.

FSM, renderização e objetos Three.js não devem ser duplicados nos testes unitários.

## Observabilidade de Teste

`window.__GAME_STATE__` existe apenas em ambiente DEV e expõe snapshots
serializáveis:

- jogador: HP atual/máximo, vivo/morto, posição completa, invulnerabilidade,
  dash, ataque, pulo e bloqueio de input;
- estação, combo, energia, transformação, aura, estados Samba, slow motion,
  `timeScale` e estado mínimo do dash Forró;
- encontro: `active`, `paused`, `awaiting-revive` ou `reviving`;
- inimigos: id, arquétipo, estado, HP, posição e progresso de telegraph;
- projéteis: id, posição, direção e vida restante;
- token melee, quantidade de projéteis, faixa ativa e estado da tela de morte.

O hook não expõe malhas, materiais, áudio, controladores ou FSMs mutáveis.
`window.__GAME_TEST__` também é DEV-only e se limita a preparar estado por
operações reais: energia, posições, dano/HP, projéteis, transformação,
reset/revive e resolução estreita de uma ameaça Samba. Não existe mutação
genérica de objetos ou estados internos. O controle `startGame()` reutiliza
a inicialização real de HUD e rádio, mas omite a decodificação de áudio nas
páginas E2E para evitar contenção entre instâncias; o fluxo normal por teclado
continua inicializando e carregando o áudio.

## Fases de Build

### Fase A — Fundação de dano

- Criar contrato de alvo e resultados explícitos de hit.
- Implementar dano, invulnerabilidade, morte e reset no jogador.
- Adicionar matemática pura e testes unitários correspondentes.

### Fase B — Melee jogável

- Criar arena limitada, lifecycle, FSM melee e telegraph.
- Validar perseguição, ataque, dano, recovery e pulo defensivo com um inimigo.

### Fase C — Ranged e composição completa

- Implementar reposicionamento, projétil 3D e limpeza.
- Ativar dois melees, um ranged e coordenação por token.

### Fase D — Integração das estações

- Converter Samba em esquiva real.
- Conceder energia uma vez por dash Forró bem-sucedido.
- Integrar soft aim assist e confirmar ataque/dash durante o double jump.

### Fase E — Lifecycle do encontro

- Implementar respawn individual e reset completo após morte.
- Validar pausa, slow motion, limites e limpeza de estados/projéteis.

### Fase E.5 — Tela de morte e retomada manual

- Substituir o retorno automático após 1 segundo por overlay de morte imediato.
- Congelar encontro e timers de gameplay enquanto o overlay estiver aberto.
- Retomar somente pela ação no botão `Reviver`.
- Executar o reset completo centralizado antes de ocultar o overlay.
- Preservar a estação selecionada, bloquear múltiplos cliques e oferecer ativação por teclado.

### Fase F — Observabilidade e validação

- Consolidar hooks DEV serializáveis e remover nomes de estado ambíguos.
- Promover fluxos críticos e estáveis para E2E versionado.
- Auditar regressões, estabilidade observável e arquivos scratch.
- Publicar o protocolo de playtest sem antecipar seu resultado.
- Considerar a implementação tecnicamente concluída somente com testes
  automatizados verdes; a conclusão de design continua dependendo de dois
  jogadores.

Cada fase de build deve permanecer jogável, preservar os testes existentes e ser validada antes da próxima.

## Estratégia de Testes

### Vitest

- Transições das FSMs por `deltaSeconds`.
- Exclusividade e liberação do token melee.
- Dano, clamp de HP e 0,5s de invulnerabilidade.
- Esquiva Samba, slow motion, expiração e consumo no próximo hit.
- Colisão 3D de projétil e volume vertical melee.
- Soft aim assist: prioridade do raycast na integração; cone, alcance e desempate na matemática pura.
- Limites da arena.
- Energia +2 uma vez por dash Forró.
- Morte, overlay, bloqueio de gameplay e reset completo por retomada manual.
- Idempotência da retomada, prevenção de múltiplos cliques e reutilização do listener.

### Playwright

- O arquivo permanente `e2e/core-combat.spec.ts` cobre os contratos críticos
  de encontro, estações, transformação, morte/revive e ciclos repetidos.
- Melee persegue, telegrafa e causa dano.
- Ranged dispara projétil visível e não teleguiado.
- Apenas um melee ataca por vez.
- Invulnerabilidade pós-hit impede dano sobreposto.
- Double jump evita ataques inimigos.
- Esquiva Samba não reduz HP e habilita somente um contra-ataque.
- Dash Samba sem ataque evitado não ativa slow motion, mas habilita o contra-ataque.
- Forró atinge múltiplos inimigos e recebe +2 uma vez.
- Inimigo reaparece após 3 segundos.
- Morte abre o overlay e não causa respawn automático.
- `Reviver` restaura o encontro, preserva estação e zera energia/transformação antes de ocultar o overlay.
- O botão funciona com mouse e teclado sem duplicar resets.
- Controles, estações, transformação, HUD e testes anteriores continuam verdes.

Os specs de `e2e/scratch/` permanecem locais para diagnóstico detalhado por
subfase e não são dependência dos testes permanentes.

## Protocolo de Playtest

O roteiro e o formulário de registro vivem em
`docs/playtests/phase-02-core-combat.md`. A sessão exige 25 minutos por
participante: 5 minutos por estação e 10 minutos com troca livre.

Testes automatizados não respondem à pergunta “o combate continua divertido
depois de alguns minutos?”. Em 18 de julho de 2026, o responsável pelo projeto
confirmou a conclusão dos testes manuais e da validação, encerrando a fase.
Esta spec registra a decisão de aceite, sem inferir participantes ou resultados
individuais que não foram informados.

## Dívidas Deliberadas

- Alvos-treino da Foundation continuam presentes ao lado do encontro para
  preservar regressões da vertical slice.
- O HUD, arena e telegraphs continuam provisórios; acabamento pertence a
  fases posteriores.
- Alguns specs temporários mantêm casos de diagnóstico mais detalhados do que
  a suíte permanente.
- A ausência de crescimento em contagens observáveis reduz o risco de objetos
  órfãos, mas não constitui prova completa de ausência de memory leak.

## Fora de Escopo

- Ataques aéreos distintos ou moveset novo.
- Hard lock-on, câmera travada ou troca manual de alvo.
- Waves, rodadas, bosses, loot, progressão ou dificuldade crescente.
- Armas por estação.
- Hitstop, hit sparks, trails, áudio de impacto ou polish de Game Feel.
- Arte final, obstáculos, cenário ou modelos definitivos.
- Motor de física, navegação complexa ou pathfinding.
- Alterações na energia ou transformação além do reset por morte e do ganho do dash Forró definido aqui.

## Critério de Conclusão

- Todas as fases de build foram implementadas na ordem.
- `npm test`, `npm run build`, `npm run test:e2e`, `npx tsc --noEmit` e
  `git diff --check` passam sem testes ignorados ou enfraquecidos.
- O encontro roda continuamente com dois melees e um ranged, sem waves ou softlocks.
- Dano, morte, retomada manual, respawn de inimigos, arena, altura, soft aim assist e integrações das três estações obedecem a esta spec.
- Os E2E permanentes não dependem de `e2e/scratch/`, que permanece ignorado.
- Os testes manuais e a validação final foram concluídos, e o responsável pelo
  projeto confirmou o encerramento da fase.

## Resultado Técnico da Fase F

- 104 testes unitários em 12 arquivos passaram.
- 9 E2E permanentes de Core Combat foram promovidos para
  `e2e/core-combat.spec.ts`.
- A suíte E2E local completa executou 33 casos: 9 Core Combat, 3 Foundation e
  21 diagnósticos temporários.
- Nenhum teste foi pulado, marcado como fixme ou executado com retry.
- Playwright permaneceu com `workers: 1`.
- TypeScript, build de produção e `git diff --check` passaram.
- A inspeção repetiu 10 respawns de inimigos, 5 ciclos de morte/revive e
  transformações nas três estações sem crescimento nas contagens observáveis
  de inimigos, overlays, botões ou identificadores.
- A suíte permanente não depende de `e2e/scratch/`, que continua ignorado.
- Em 18 de julho de 2026, os testes manuais e a validação foram confirmados
  como concluídos pelo responsável pelo projeto. A Fase 2 foi encerrada.
