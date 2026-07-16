# Spec Técnica — Protótipo do Rádio
*(recorte de vertical slice; não é o GDD nem o TDD final — ver nota no fim)*

## Objetivo do Protótipo

Provar que trocar de estação de rádio é instantaneamente perceptível e mecanicamente distinto, sem depender de nenhum texto na tela.

## Critério de Sucesso

Alguém observando a tela, sem contexto, consegue dizer "agora ele está em Samba" ou "agora está em Phonk" em menos de 1 segundo após a troca — só pelo visual, áudio e forma de combater, sem ler nada.

*(Princípio geral do rádio — identidade, não buff — está no Manifesto Criativo. Toda decisão técnica abaixo serve a esse princípio.)*

## Não Negociar

- Nunca expor valores de atributo (dano, velocidade etc.) como número ou tooltip na tela — a diferença tem que ser sentida jogando, não lida. (Contadores de gameplay, como o de combo na Fase 5, são outra coisa e continuam permitidos.)
- Nunca deixar uma estação ser só um multiplicador de stat com o mesmo visual e som — se não mudou identidade, a estação não está pronta.
- Nunca mudar mecânica sem mudar visual e áudio junto, e vice-versa — as três sempre andam juntas.
- Toda estação precisa ser reconhecível sozinha: só no visual (som mudo) e só no áudio (sem olhar a tela). Falhou em um dos dois, não está pronta.

## Stack

**Vite + Three.js puro + HTML/CSS simples para o HUD.** Sem React, sem React Three Fiber, sem Zustand, sem Rapier.

Por quê:
- Nenhum elemento desta spec (cor de material, fog, punch de câmera, partículas, bob/tilt procedural, popup de texto, contador) exige framework — são chamadas diretas de Three.js ou manipulação de `textContent`/classe CSS.
- Movimento de personagem em jogo de ação usa controle cinemático, não física real — um motor de física completo (Rapier) atrapalha o ajuste fino de dash-cancel e hit-stun.
- Cada camada a mais (React, gerenciador de estado) é mais uma coisa pra IA gerar errado e pra alguém auditar quando quebrar.
- Colisão de ataque: raycast ou teste de esfera simples. Não precisa de motor de física para isso.

## O Que Troca no Momento da Troca de Estação (checklist)

1. Cor emissive do material do personagem
2. Cor do fog / luz ambiente da cena
3. Faixa de música (crossfade ~200ms)
4. Sequência de sintonia da troca: burst curto de estática/ruído → clique → stinger → entrada da faixa (janela total ~150–200ms, sincronizada com o crossfade do item 3) — a troca precisa soar como sintonizar um rádio de verdade, não um corte seco
5. Efeito de câmera (punch, pan ou orbit — específico por estação)
6. Burst ou trilha de partículas
7. Velocidade de movimento e comportamento do dash
8. Amplitude/frequência do bob (idle) e tilt (corrida) — procedural, sem clipe de animação
9. Nome da estação no HUD, com cor/glow própria

**Fora do v1 (não trocam ainda):** equalizador visual desenhado, ícones por estação, animação rigada — ver seção "Fora de Escopo".

## Parâmetros por Estação

**Base comum (antes de aplicar estação):** velocidade 6 m/s, dano de ataque básico 10, alcance de ataque 1.5m.

| Parâmetro | Phonk (Pancadão) | Samba (Ginga) | Forró (Arrasta-Pé) |
|---|---|---|---|
| Cor de acento | Verde-limão metálico `#39FF14` sobre base escura | Dourado `#FFD700` sobre base clara | Laranja terracota `#FF7F27` |
| Fog da cena | Verde escuro, densidade alta (sensação fechada) | Quase ausente, claro (sensação aberta) | Laranja quente, densidade média |
| Velocidade | +15% (6.9 m/s) | Base (6 m/s) | -5% (5.7 m/s), mas alcance de ataque +60% |
| Dash — comportamento | Cancela a animação de ataque em andamento; duração 0.15s; cooldown 0.4s | Vira "perfect dodge": 0.2s de invulnerabilidade; se acionado na janela certa antes do hit inimigo, `timeScale` cai pra 0.5 por 150ms | Trajetória em arco (curva, não reta); atinge múltiplos alvos no caminho |
| Regra de dano especial | +5% de dano por hit consecutivo, cap em +30% | Contra-ataque após dodge/parry bem-sucedido: dano x1.5 | Cada hit atinge todos os alvos num raio de 1.5m ao redor |
| Bob (idle) | Frequência alta, amplitude baixa (tensão) | Frequência baixa, amplitude alta (relaxado) | Frequência média, trajetória circular (não vertical) |
| Tilt (corrida) | Pouco tilt, postura reta e agressiva | Tilt suave nas curvas | Rotação contínua permitida (giro 360° possível) |
| Câmera no switch | Zoom-punch: 1.08x em 80ms, retorno em 150ms | Pan suave + desaceleração momentânea de 100ms | Orbit leve ao redor do personagem |
| Partícula no switch | Burst denso, verde/amarelo, curta duração | Rastro leve dourado, longa duração (trilha, não burst) | Rastro circular ao redor do personagem, laranja |
| Stinger sonoro | Impacto grave curto | "Shiing" agudo curto | Whoosh de vento |
| Faixa placeholder | Loop de phonk | Loop de samba instrumental | Loop de forró eletrônico |
| **Input Feel** (resposta de controle — diferente de stat) | Buffer de input curtíssimo; ataque cancela quase instantaneamente; recovery mínimo. Resposta crua, quase sem espera. | Buffer de input mais estreito e exigente; janela de perfect dodge generosa, mas timing importa de verdade. Precisão, não velocidade. | Buffer de input generoso; ataques aceitam mudança de direção em curva durante a execução. Fluido, perdoa timing impreciso. |

*(Valores são ponto de partida para o build, ajustáveis por playtesting — não são finais.)*

## Sequência de Build (Fases)

Cada fase deve ficar jogável e testável antes de pedir a próxima. Não empilhar prompts.

**Fase 1 — Chassi base**
Cápsula controlável (WASD) com câmera de terceira pessoa fixa atrás do personagem. Tecla de ataque básico que detecta colisão (raycast/esfera) contra 1-2 bonecos-alvo estáticos, que piscam e recebem um leve knockback visual ao serem atingidos. Sem estações ainda.

**Fase 2 — Identidade sensorial da troca (visual + áudio juntos)**
Sistema de estação com 3 estados (teclas 1/2/3). A troca muda cor emissive do personagem, cor do fog, faixa de música (crossfade ~200ms) e a sequência de sintonia (estática → clique → stinger). Nenhum stat de combate ou input feel muda ainda. Isso testa a hipótese central isolada — identidade sensorial pura — antes de misturar com mecânica. Visual e áudio vão juntos aqui porque são a mesma hipótese (o rádio como identidade), separada da hipótese de gameplay que vem na Fase 3.

**Fase 3 — Diferenças mecânicas e de input**
Liga os parâmetros da tabela (velocidade, dash, dano, e os de Input Feel — buffer, cancelamento, recovery) ao estado da estação atual, sobre a base da Fase 1.

**Fase 4 — Câmera e partículas no switch**
Ao trocar de estação, dispara o efeito de câmera e o burst/trilha de partícula correspondentes daquela estação — a camada de "juice" por cima da identidade já estabelecida na Fase 2.

**Fase 5 — HUD mínimo**
Overlay HTML/CSS: nome da estação (cor/glow muda), popup de texto para eventos (ex: "PERFECT DODGE", "PARRY"), contador de combo numérico. Deliberadamente por último: o critério de sucesso exige perceber a troca sem ler nada na tela. HUD cedo demais deixa você validar a mecânica lendo o nome da estação em vez de sentindo a troca.

## Testes de Validação

Depois da Fase 4 (identidade + mecânica + juice completos, ainda sem HUD):
- **Teste A:** jogar 10 minutos só numa estação — ela é divertida sozinha, sem comparação?
- **Teste B:** alternar de estação a cada 20 segundos — a diferença continua clara depois de repetida várias vezes?
- **Teste C:** lutar com o som desligado — dá pra saber qual estação só pelo visual?
- **Teste D:** lutar sem olhar a tela por alguns segundos, só ouvindo — dá pra saber qual estação só pelo áudio?

Depois da Fase 5 (com HUD):
- **Teste E:** pedir pra alguém jogar sem explicar as diferenças, e perguntar depois: qual estação parecia mais pesada? mais rápida? mais divertida? Se a pessoa responde com adjetivos diferentes por estação sem ter lido nada, o conceito passou no critério de sucesso.

## Fora de Escopo (por agora)

- Equalizador visual do rádio desenhado
- Ícones próprios por estação
- Animação rigada de personagem (idle/corrida por clipe, em vez de procedural)
- Arte final de UI
- IA de inimigos (bonecos-alvo estáticos bastam para testar o combate)

Esses itens não são descartados — voltam quando o conceito estiver validado e houver direção de arte fechada. Gerá-los agora seria trabalho perdido antes de saber se o resto funciona.

---

*Nota: este documento é um recorte de vertical slice, não o GDD nem o TDD do projeto. Quando o protótipo validar o conceito, os parâmetros de estação migram para o GDD e a decisão de stack/arquitetura vira base do TDD.*
