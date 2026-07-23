# Lessons — Radio Prototype

Registro de bugs resolvidos e suas causas raiz, pra não repetir o mesmo erro em fases futuras. Mantido manualmente (sem automação) — toda vez que uma correção real acontecer, adiciona uma entrada nova aqui, no mesmo formato.

## Como usar este arquivo

- Cada entrada é sobre uma **causa raiz**, não sobre o sintoma. Se a correção foi só "ajustei um número", geralmente não vale entrada aqui — isso é iteração normal, não lição estrutural.
- Vale entrada quando o erro revela um **padrão que pode se repetir**: uma ambiguidade de spec, uma suposição errada da IA, uma categoria de bug que pode aparecer de novo em outro contexto.
- Antes de escrever uma spec ou prompt novo, vale reler este arquivo — é o "não cometa esse erro de novo" do projeto.
- Antes de registrar uma entrada baseada no que uma IA *relatou* ter corrigido, confirme contra o diff real do código — ver L-006.

## Nota sobre numeração de fase

L-001 a L-003 usam a numeração original da vertical slice (Fase 0-5, todas concluídas). A partir de L-004, as entradas usam descrição em vez de número de fase, porque o Roadmap Macro criado depois reaproveita os mesmos números (Fase 1-6) para etapas diferentes — usar "Fase 4" ou "Fase 5" nessas entradas colidiria com o roadmap novo.

## Instrução para o Gemini

Você tem acesso ao histórico de commits e ao código atual deste repositório. Revise o `git log` e o código para identificar se houve outras correções reais (não apenas ajustes de valor/tuning) ainda não registradas aqui. Se encontrar, adicione novas entradas seguindo o mesmo formato. Não invente entradas — só adicione o que for verificável no histórico real, e confirme contra o código antes de descrever uma correção como aplicada.

---

## L-001 — Janelas de recovery/combo não devem bloquear movimento por padrão

**Fase:** 3 (diferenças mecânicas e dash por estação)

**Sintoma:** atacar travava o personagem no lugar até o fim da animação/recovery, impedindo movimento — regressão em relação às Fases 0-2, que permitiam mover e atacar ao mesmo tempo.

**Causa raiz:** o prompt da Fase 3 introduziu janelas de recovery/combo (100ms Phonk, 250ms Samba, 600ms Forró) sem especificar que elas deveriam afetar só a capacidade de **encadear o próximo ataque**, não a capacidade de **se mover**. Na ausência dessa especificação explícita, a IA assumiu o padrão mais comum em jogos de luta, onde recovery trava movimento.

**Correção:** desacoplar explicitamente, no prompt e no código, o estado "posso encadear combo" do estado "posso me mover".

**Lição:** qualquer prompt futuro que mencione janela de recovery/animação/combo precisa declarar explicitamente se o movimento fica livre ou não durante essa janela. Não presumir que a IA vai inferir a intenção certa.

---

## L-002 — Rotação interpolada (slerp) pode não convergir antes de um cálculo de gameplay que depende dela

**Fase:** 3, bug encontrado e corrigido depois da Fase 5

**Sintoma:** no Forró, o ataque não conectava especificamente quando o jogador girava continuamente ao redor do inimigo, mesmo mirando corretamente.

**Causa raiz:** durante o windup do Forró, a rotação do personagem persegue a direção do mouse via slerp parcial a cada frame, numa janela de só 0.1s (~6 frames). Esse slerp nunca converge 100% dentro dessa janela — o cálculo do hitbox usava uma rotação defasada em relação à direção real do mouse no instante do golpe, mais perceptível durante giro contínuo.

**Correção (confirmada no código atual, `updateAttackState`):** forçar um snap exato da rotação para a direção real do mouse imediatamente antes de calcular o hitbox, mantendo o slerp gradual apenas para a suavidade visual durante o resto do windup.

**Lição:** qualquer sistema que interpola uma variável **enquanto ela também alimenta um cálculo de gameplay** (dano, hit, colisão) precisa garantir convergência exata no momento exato desse cálculo — nunca presumir que a interpolação visual "chegou perto o suficiente". Esta foi a causa raiz real do bug de mira do Forró — ver L-006 sobre uma explicação alternativa que circulou e não correspondia ao código.

---

## L-003 — Especificar comportamento de um efeito não é o mesmo que especificar sua identidade visual

**Fase:** 4 (câmera e partículas), correção pós-playtest

**Sintoma:** a partícula de troca de estação da Samba seguia o personagem corretamente, exatamente como a spec pedia — mas o playtest considerou o efeito sem graça e sem personalidade, especialmente com o personagem parado.

**Causa raiz:** a spec original descrevia o **comportamento** da partícula (um rastro que acompanha o personagem) mas não sua **forma/identidade visual** (o que ela parece, que sensação passa). O comportamento foi implementado corretamente; a ausência de identidade era uma lacuna da spec, não um erro de implementação.

**Correção:** substituído por partículas com forma temática (confete/serpentina, remetendo a carnaval) em vez de um rastro genérico.

**Lição:** specs de VFX/juice devem descrever tanto o comportamento (o que o efeito faz) quanto a forma/identidade (o que ele parece, que sensação evoca) — principalmente quando o objetivo do efeito é comunicar identidade/tema, não só função mecânica.

---

## L-004 — Bibliotecas em evolução e importações desatualizadas (alucinação de API)

**Quando:** setup inicial do motor e game loop (antes da Fase 0 da vertical slice)

**Sintoma:** Vite acusava erro fatal de build relatando `Failed to resolve import "three/addons/misc/Timer.js"`. O código sequer rodava.

**Causa raiz:** a IA forneceu um caminho de importação desatualizado da biblioteca Three.js. Com atualizações recentes da engine (e a depreciação do `Clock`), o módulo `Timer` foi promovido diretamente para o núcleo principal da biblioteca (`THREE.Timer`), deixando de existir na pasta isolada de addons.

**Correção:** remoção do import avulso e uso da classe diretamente da raiz (`new THREE.Timer()` a partir do import global).

**Lição:** ao usar IA para gerar código que interage com bibliotecas front-end/3D em constante evolução (Three.js, React, Vite), desconfie de erros de caminho (`Failed to resolve import`). A IA frequentemente se baseia em versões antigas. O erro do console quase sempre aponta a pista da sintaxe moderna.

---

## L-005 — Esticar alcance de um ataque só movendo o centro do hitbox cria zonas mortas perto do atacante

**Quando:** ajuste do ataque em área do Forró (confirmado no código atual, `executeHitbox`)

**Sintoma:** risco identificado no ataque em área do Forró (alcance esticado para 2.4 unidades): se apenas o centro de uma única esfera de colisão for deslocado para a ponta do alcance, sem cobertura intermediária, inimigos colados no jogador ficam fora do raio de detecção.

**Correção (presente no código atual):** checagem em dois pontos ao longo do vetor de ataque — um círculo no ponto médio (1.2 unidades, raio 1.5) e outro na ponta (2.4 unidades, raio 1.5) — cobrindo de forma contínua desde perto do jogador até o alcance máximo, sem buraco no meio.

**Lição:** ampliar o alcance de ataques corpo a corpo não deve ser feito apenas distanciando o centro de uma esfera/hitbox única. Tratar o golpe como um volume contínuo (múltiplos pontos de checagem, capsule cast, ou box cast) evita pontos cegos perto do atacante.

---

## L-006 — A explicação de causa raiz relatada por uma IA nem sempre corresponde à mudança de código realmente aplicada

**Quando:** durante o diagnóstico do bug de ataque do Forró (o mesmo bug do L-002)

**Sintoma:** o Gemini relatou ter corrigido o bug "Forró não acerta o inimigo quando o jogador fica de frente, entre a câmera e o alvo" priorizando o raycast contra as malhas dos alvos antes do plano do chão ("se a mira bater no alvo, ignora o chão").

**Causa raiz real:** essa lógica de priorização (raycast contra alvos primeiro, chão como fallback) **já existia no código antes dessa tentativa de correção, sem nenhuma alteração**. A causa raiz de fato — confirmada comparando o código antes e depois — era a convergência incompleta do slerp de rotação durante o windup, documentada no L-002. A explicação do raycast/perspectiva não correspondia a nenhuma mudança real no arquivo.

**Lição:** quando uma IA relata "corrigi X fazendo Y", vale confirmar Y contra o diff real do código antes de registrar como lição ou aceitar como resolvido. A explicação verbal de causa raiz pode estar dissociada da mudança de código de fato aplicada — ou de nenhuma mudança real.

---

## L-007 — Introduzir física vertical (pulo) quebra colisões de gameplay pensadas em 2.5D

**Quando:** implementação do double jump (item do Roadmap Macro Fase 2, implementado adiantado, fora da sequência formal de specs)

**Sintoma:** ao pular, ataques e a colisão de dano do dash paravam de funcionar contra inimigos no chão.

**Causa raiz:** o jogo começou plano, e a verificação de acerto usava distância 3D estrita (X, Y, Z). Quando a gravidade elevou a posição Y do jogador durante o pulo, o centro da colisão subiu com ele, fazendo o cálculo de proximidade falhar contra os inimigos no chão.

**Correção (confirmada no código atual, `executeHitbox` e `executeDashDamage`):** achatar os cálculos de detecção de hit substituindo a distância 3D pela hipotenusa 2D (`Math.hypot(dx, dz)`, ignorando Y) — as hitboxes viraram cilindros infinitos em altura.

**Lição:** ao passar de navegação estritamente terrestre para uma com física vertical real (pulos, plataformas), todo cálculo de distância/proximidade (hit detection, UI, interações) precisa ser revisado para decidir se exige altura exata (esfera) ou se deve ignorar altura (projeção num plano).

---

## L-008 — `reuseExistingServer` exige controle sobre os servidores que ocupam a porta de teste

**Quando:** validação E2E da Fase 2 — Core Combat, durante a implementação do melee jogável.

**Sintoma:** as primeiras navegações do Playwright expiravam em `page.goto()`, enquanto casos executados depois no mesmo processo passavam. Repetições da suíte produziam resultados inconsistentes e criavam novas instâncias do servidor em portas alternativas.

**Causa raiz:** havia servidores Vite duplicados ou obsoletos escutando a porta 5173 separadamente em IPv4 e IPv6. Com `reuseExistingServer: true`, o Playwright reutilizava o servidor encontrado em vez de necessariamente iniciar uma instância limpa. A opção não é um problema por si só; a instabilidade ocorre quando não há garantia de que existe exatamente um servidor válido, pertencente ao workspace atual, atendendo naquela porta.

**Correção:** verificar os listeners da porta configurada, identificar os processos que pertencem a este workspace e encerrar somente essas instâncias Vite antes de uma execução limpa. Não encerrar indiscriminadamente todos os processos Node, pois eles podem pertencer a outras ferramentas ou projetos.

**Lição:** após uma falha E2E de navegação ou inicialização, primeiro reproduzir o caso focado e inspecionar a porta e os processos envolvidos. Só executar novamente a suíte completa depois que a causa estiver identificada e o caso focado estiver estável. `reuseExistingServer: true` pode continuar sendo usado, desde que o servidor reutilizado seja conhecido, único e válido para o workspace atual.

---

## L-009 — Paralelismo E2E pode distorcer loops de gameplay dependentes de frames

**Quando:** validação E2E da Fase 2 — Core Combat, durante a implementação do melee jogável.

**Sintoma:** com múltiplos workers, testes perdiam inputs curtos, observavam o melee somente depois de vários ciclos de ataque e falhavam de forma intermitente. Os mesmos casos passavam de forma consistente quando executados com um único worker.

**Causa raiz:** múltiplas instâncias simultâneas de Three.js, WebGL e áudio causavam contenção de recursos. O espaçamento entre frames aumentava, alterando os valores observados de `deltaSeconds` e dificultando a captura de estados intermediários produzidos pelo loop em `requestAnimationFrame`.

**Correção:** configurar `workers: 1` como decisão atual para esta suíte e fazer as esperas dos testes dependerem de estado observável exposto pelo jogo, em vez de sleeps arbitrários usados como fonte de sincronização.

**Lição:** `workers: 1` não é uma regra universal para qualquer teste Playwright. O paralelismo só deve ser reativado quando os testes relevantes forem comprovadamente independentes de frame rate, áudio e tempo de gameplay. Em testes temporais do jogo, preferir condições sobre estado observável; sleeps podem ser usados apenas quando medem deliberadamente uma duração, não para presumir que o jogo já alcançou determinado estado.

---

## L-010 — Inputs E2E curtos precisam de confirmação observável do jogo

**Quando:** validação E2E da Fase 2 — Core Combat, durante a integração das estações.

**Sintoma:** cliques de ataque e pressionamentos de pulo ou dash falhavam de forma intermitente, embora a mecânica funcionasse quando o mesmo caso era executado isoladamente. Em algumas execuções, o teste aguardava uma consequência que nunca ocorria porque o jogo sequer havia processado o input correspondente.

**Causa raiz:** chamadas curtas como `mouse.down` seguido rapidamente de `mouse.up` ou `keyboard.press` podiam começar e terminar entre dois frames do loop. Sob contenção de Three.js, WebGL e áudio, o `InputManager` não necessariamente observava o estado pressionado. Também houve uma corrida em que a troca de estação era enviada antes de o bootstrap assíncrono terminar e a estação inicial ser aplicada.

**Correção:** manter a tecla ou botão pressionado até o jogo confirmar o processamento por estado observável, como contador de commit do ataque, estado de dash ou contador de pulos; liberar o input somente depois dessa confirmação. Aguardar também o estado inicial observável do jogo antes de enviar comandos dependentes de estação.

**Lição:** em E2E de gameplay, o evento despachado pelo Playwright não prova que o loop consumiu o input. Inputs discretos devem receber confirmação observável do jogo; não usar sleeps curtos para presumir que um frame ocorreu. Antes de diagnosticar a mecânica, distinguir explicitamente “input não processado” de “input processado sem produzir o resultado esperado”.

---

## L-011 — Janelas curtas de gameplay exigem hooks DEV determinísticos e estreitos

**Quando:** validação E2E da Fase 2 — Core Combat, durante a esquiva real da Samba.

**Sintoma:** o teste que precisava fazer um ataque melee colidir dentro da janela Samba de 0,2s continuava intermitente mesmo com `workers: 1`, estado observável e reprodução focada. Sincronizar externamente windup, movimento do dash, colisão e expiração da janela dependia demais do espaçamento entre frames.

**Causa raiz:** o teste tentou coordenar em tempo real vários sistemas móveis dentro de uma janela subsegundo sem uma preparação determinística correspondente. A observabilidade foi adicionada de forma incremental depois das falhas, e pequenas limpezas feitas após uma suíte completa verde invalidaram a validação cara e exigiram novas execuções.

**Correção:** separar o teste do input que abre a janela do teste da consequência causada dentro dela e criar um hook DEV estreito que execute a própria operação de produção — no caso, resolver um melee que já esteja em `windup` pela mesma FSM e pela mesma checagem geométrica. Não duplicar lógica de dano nem expor mutação genérica da FSM. Revisar e congelar o diff antes de iniciar a suíte completa final.

**Lição:** identificar janelas subsegundo antes de escrever o E2E e projetar antecipadamente a observabilidade e os controles determinísticos mínimos. Hooks de teste devem acionar contratos reais de produção, com escopo estreito, nunca reimplementar a regra testada ou permitir mutação arbitrária. Estabilizar primeiro o caso focado, revisar o diff e só então executar a suíte completa que servirá como validação final.

---

## L-012 — Ações multiframe precisam de identidade e encerramento explícitos

**Quando:** Builder 3A da Fase 3 — Game Feel, ao agregar os impactos do dash multialvo do Forró.

**Sintoma:** uma ação resolvida ao longo de vários frames pode emitir um evento por alvo, perder resultados intermediários ou não ter um instante claro para publicar seu resultado global.

**Causa raiz:** diferentemente de um ataque instantâneo, uma ação multiframe não possui naturalmente um único ponto de resolução; início, coleta de resultados e encerramento acontecem em momentos diferentes.

**Correção:** criar o identificador no início da ação, acumular apenas os resultados aceitos e emitir um único evento ao atingir seu encerramento lógico, limpando depois o estado acumulado.

**Lição:** toda ação multiframe que produz um resultado agregado deve possuir identidade, fronteira de início e condição explícita de encerramento.

**Aplicar quando:** dashes, canais, projéteis persistentes ou outras ações coletarem resultados em mais de um frame.

**Não aplicar quando:** a ação for instantânea e possuir exatamente um ponto de resolução.

---

## L-013 — E2E valida wiring e comportamento exclusivo do runtime, não matrizes de regras puras

**Quando:** Builder 3A da Fase 3 — Game Feel, ao validar classificação e observabilidade de impactos.

**Sintoma:** regras determinísticas já cobertas por testes unitários exigiram preparação de cena, inimigos, inputs e janelas temporais no navegador, aumentando custo e fragilidade sem acrescentar garantia exclusiva proporcional.

**Causa raiz:** a matriz de classificação pura foi repetida no E2E em vez de reservar o navegador para confirmar a integração entre produção, loop e `window.__GAME_STATE__`.

**Correção:** manter combinações, prioridades e casos-limite em testes unitários; usar E2E somente para provar o wiring real e comportamentos que dependem do navegador, do loop, do input ou da integração WebGL.

**Lição:** cada nível de teste deve cobrir a garantia mais barata capaz de detectar a falha; E2E não deve duplicar integralmente regras puras já verificadas.

**Aplicar quando:** classificadores, clamps, prioridades e composição matemática puderem ser testados sem runtime, preservando no E2E apenas a integração indispensável.

**Não aplicar quando:** a falha só puder existir no DOM, input real, loop de frames, áudio, WebGL ou composição completa dos sistemas.

---

## L-014 — Prompts de builders aprovados devem referenciar a tech spec, não republicá-la

**Quando:** planejamento e execução do Builder 3A da Fase 3 — Game Feel.

**Sintoma:** o prompt repetiu contratos, hierarquia, arquitetura, casos de teste e regras globais já registrados na tech spec e nos documentos obrigatórios, ampliando leitura e contexto sem introduzir decisões novas.

**Causa raiz:** a instrução operacional foi tratada como uma segunda especificação completa, em vez de apontar a seção vigente e registrar apenas objetivo, desvios e critérios específicos da execução.

**Correção:** prompts de builders com tech spec aprovada devem indicar a fonte principal, delimitar objetivo e fora de escopo, destacar decisões novas e pedir validação proporcional, sem copiar novamente o conteúdo integral.

**Lição:** manter uma única fonte detalhada de verdade reduz contexto duplicado e preserva clareza sem diminuir os critérios de qualidade.

**Aplicar quando:** o builder já estiver definido de forma suficiente por uma tech spec aprovada e vigente.

**Não aplicar quando:** não houver spec, existir contradição relevante ou a tarefa introduzir uma decisão nova que ainda precise ser explicitada.
