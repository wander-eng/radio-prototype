---
name: game-designer
description: Regras de design e implementação para qualquer trabalho criativo/visual neste jogo (radio-prototype) — identidade de estação, armas por estação, inimigos, VFX, HUD. Use ao criar, ajustar ou revisar qualquer um desses elementos, ou ao decidir se uma mudança preserva a identidade do rádio. Depois deste arquivo, leia a receita específica em references/ que casa com sua tarefa. Não use para matemática de combate pura, testes automatizados, ou infraestrutura de build — isso é responsabilidade da spec técnica da fase e do `.specs/LESSONS.md`, não desta skill.
license: uso pessoal do projeto
metadata:
  author: wander
  version: 1.0.0
---

# Game Designer — Radio Prototype

Esta skill existe porque o Manifesto Criativo, sozinho, não é rígido o suficiente pra guiar implementação — várias decisões que pareciam óbvias na hora só ficaram claras depois de erradas no playtest (ver golden rule 4). Este arquivo é a versão amarrada dessas decisões.

## Ordem de leitura

1. Leia este arquivo inteiro primeiro — é o modelo mental e as regras não-negociáveis.
2. Leia a **uma** receita que casa com sua tarefa:

| Sua tarefa | Receita | Status |
| --- | --- | --- |
| Identidade de estação (cor, som, câmera, partícula, mecânica) | `references/station.md` | ✅ Validado (Teste E aprovado) |
| Arma por estação | `references/arma.md` | ⏳ Ainda não escrito — decisões de design não tomadas (Fase 4a do Roadmap Macro) |
| Inimigo / IA simples | `references/inimigo.md` | ✅ Disponível — modelo validado na Fase 2 |
| Personagem definitivo (modelo 3D com rig e animação) | `references/personagem.md` | ⏳ Ainda não escrito — nenhuma decisão de pipeline/estilo tomada (Fase 4b do Roadmap Macro) |
| VFX genérico (fora de troca de estação) | `references/station.md` (seção de VFX) | Parcial — cobre só o VFX de troca de estação hoje |
| HUD | Ver spec técnica da Fase 1 — Foundation | Já implementado, sem receita própria ainda |

Se sua tarefa é sobre uma categoria sem receita ainda, **pare e escreva a spec da fase correspondente primeiro** (ver `.specs/ROADMAP.md`) — não invente a regra aqui.

## Golden rules (não-negociáveis)

Cada uma nasceu de um erro real deste projeto, não de teoria genérica. Onde relevante, a fonte está entre parênteses.

1. **O rádio muda identidade, não atributo.** A mecânica (dano, velocidade, dash) muda instantaneamente e sempre ao trocar de estação — isso nunca é gateado. A partir da Fase 1.5, a manifestação visual e sonora completa (cor, fog, faixa emblemática) passou a ser uma camada de recompensa por cima disso (carrega energia, transforma) — mas a mecânica correspondente já estava ativa antes da transformação. Uma estação que só multiplica um número, sem nenhuma identidade sensorial correspondente (nem a mecânica nem a aura escalando com a carga), não conta como funcionando. (Manifesto — Princípio do Rádio)

2. **Comportamento especificado ≠ identidade visual especificada.** Descrever o que um efeito *faz* ("segue o personagem") não garante que ele tenha personalidade. Toda spec de VFX/juice precisa descrever também a *forma* e a *sensação* que evoca. (Lessons L-003 — o rastro da Samba seguiu certinho e ainda assim ficou sem graça)

3. **Nunca expor atributo cru como número na tela.** Dano, velocidade, etc. se sentem jogando, não se leem. Contadores de gameplay (combo, por exemplo) são categoria diferente e são permitidos. (Spec técnica — Não Negociar)

4. **Toda variável interpolada que também alimenta um cálculo de gameplay precisa convergência garantida no momento exato do cálculo.** Suavização visual (slerp, lerp) nunca deve ser a fonte de verdade pra um hit, dano ou colisão — force snap antes de calcular. (Lessons L-002)

5. **Hit detection precisa cobrir um volume contínuo, sem zona morta, e ser agnóstica a Y assim que existir movimento vertical.** Esticar alcance só movendo o centro de uma esfera cria buraco perto do atacante; pular sem achatar a checagem quebra o combate contra alvos no chão. (Lessons L-005, L-007)

6. **Nunca aceitar a explicação de causa raiz de uma IA sem confirmar contra o código real.** "Corrigi X fazendo Y" só vira lição ou fica registrado como resolvido depois de checar que Y de fato mudou algo. (Lessons L-006)

7. **Rule of cool acima de realismo, mas o absurdo é tratado com naturalidade pelos personagens.** Humor nasce de situação e personalidade, nunca de referência datada ou paródia de pessoa real. (Manifesto — Regras de Tom, O Que Não É)

## Onde as coisas vivem (caminhos reais)

- Combate, movimento, dash, ataque: `src/player.ts`
- Alvos e HP: `src/target.ts`
- Câmera: `src/camera.ts` — **atenção:** offset fixo em espaço de mundo, não gira com a direção do personagem (isso molda qual configuração de ataque/mira é "de frente" vs "de lado")
- Estado da estação: `src/radio.ts`
- HUD (overlay HTML/CSS): `src/hud.ts`
- Input (WASD, mouse, teclas): `src/input.ts`
- Matemática pura de combate: `src/combat-math.ts`

**Alerta de arquitetura (não é regra, é aviso pra quando a Fase 4b chegar):** hoje, `player.ts` mistura decisão de estado (qual ataque, qual direção, qual estação) com manipulação direta da mesh da cápsula (`mesh.rotation.y`, posição). Isso é adequado pra uma forma primitiva. Quando o personagem definitivo (modelo rigado com `AnimationMixer`) entrar, essa mistura vai exigir mais retrabalho do que precisaria se decisão e representação visual já estivessem separadas — o padrão a mirar é algo como "a lógica decide qual ação tocar, sem saber nada de Three.js; a representação visual só lê essa decisão e toca a animação correspondente". Não é motivo pra refatorar agora — é motivo pra não se surpreender depois.
- Registro de bugs/causas raiz: `.specs/LESSONS.md`
- Roadmap macro: `.specs/ROADMAP.md`

## Antipadrões (não fazer)

- ❌ Escrever spec de VFX só com comportamento, sem forma/identidade (golden rule 2)
- ❌ Deixar rotação/valor interpolado alimentar hitbox sem forçar snap no momento do cálculo (golden rule 4)
- ❌ Aceitar "corrigi X" de uma IA sem checar o diff real do código (golden rule 6)
- ❌ Adicionar um atributo funcional (barra de vida, energia) pra um sistema que ainda não existe, sem marcar explicitamente como scaffolding não-funcional
- ❌ Misturar decisão de design testável (arma, estação, inimigo) com produção pura (menu, cenário, direção de arte) na mesma fase/spec
- ❌ Reutilizar um número de fase do Roadmap Macro pra rotular algo que não é dessa fase (ver nota de numeração no `.specs/LESSONS.md`)
- ❌ Usar gravação comercial real de música (faixa emblemática de transformação, por exemplo) ou copiar asset/animação de personagem de propriedade registrada (ex: referências como Irelia/LoL, Jett/Valorant) diretamente no jogo já deployado publicamente — usar só como referência de vibe/sensação ao especificar, nunca como asset final sem verificação de licença

## Definição de pronto (por elemento de design)

- [ ] Identidade visual, sonora e mecânica mudam juntas, se aplicável (golden rule 1)
- [ ] VFX tem forma/identidade descrita, não só comportamento (golden rule 2)
- [ ] Testado contra pelo menos um dos Testes de Validação da spec técnica relevante
- [ ] Nenhum atributo cru exposto como número na tela (golden rule 3)
- [ ] Se uma causa raiz real foi encontrada durante a implementação, virou entrada no `.specs/LESSONS.md`
- [ ] Rótulo de fase não colide com o Roadmap Macro
