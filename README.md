# Radio Prototype

Protótipo de jogo de ação 3D para navegador em que trocar a estação de rádio
altera o combate, a música e a apresentação visual. O projeto está em
desenvolvimento e usa o nome provisório “Radio Prototype”.

## Jogar

- [Abrir o protótipo](https://radio-prototype.vercel.app)
- [Ver o código-fonte](https://github.com/wander-eng/radio-prototype)

## Sobre o projeto

Radio Prototype é um protótipo técnico de combate em terceira pessoa. O
personagem alterna entre Phonk, Samba e Forró por meio de um rádio, e cada
estação modifica atributos e ações de combate.

As diferenças mecânicas e a faixa normal ficam ativas no estado base. Ataques
bem-sucedidos carregam energia; ao chegar a 100, a tecla `R` inicia uma
transformação de cerca de 15 segundos. Nesse estado, a aura permanece no
máximo, o personagem e o ambiente assumem as cores da estação e a faixa
emblemática substitui a normal. A estação fica bloqueada até o fim da
transformação.

## Estado atual

| Fase | Estado |
| --- | --- |
| Foundation — rádio e estações | Concluída |
| Transformation — energia e transformação | Concluída |
| Core Combat — inimigos, dano e ciclo do encontro | Concluída |

## Mecânicas implementadas

- Movimento, ataque, combo, dash, pulo e salto duplo.
- Assistência de mira sem alvo persistente.
- Arena com dois inimigos corpo a corpo coordenados e um inimigo à distância
  com projéteis não teleguiados.
- Sinalização dos ataques, HP, dano, invulnerabilidade e respawn individual.
- Evasão vertical de ataques inimigos.
- Energia, aura e transformação por estação.
- Morte com encontro congelado e retomada manual pelo botão `Reviver`.
- HUD provisório, pausa e transições de áudio entre estações.

## Estações de rádio

| Estação | Comportamento atual |
| --- | --- |
| **Phonk — Pancadão** | Maior velocidade, combo com dano crescente e cancelamento por dash |
| **Samba — Ginga** | Dash com janela defensiva e contra-ataque; uma ameaça esquivada ativa câmera lenta |
| **Forró — Arrasta-Pé** | Maior alcance, ataque em área e dash contra vários alvos |

## Controles

| Ação | Controle |
| --- | --- |
| Movimento | `WASD` ou setas |
| Ataque | Botão esquerdo do mouse |
| Pulo / double jump | `Espaço` |
| Dash | `Shift` ou botão direito do mouse |
| Selecionar estação | `1`, `2`, `3` ou roda do mouse |
| Transformação | `R`, com energia cheia |
| Pausa | `Esc` |
| Reviver | Botão `Reviver`, também acionável por teclado quando focado |

## Tecnologias

- TypeScript, Three.js e Vite;
- HTML e CSS para HUD e telas sobrepostas;
- Web Audio API;
- Vitest e Playwright.

O protótipo não utiliza motor de física ou biblioteca de pathfinding. Movimento,
colisões e projéteis são controlados pelo próprio código do jogo.

## Organização do código

O código está organizado por responsabilidades e por sistemas do jogo:

- `main.ts` inicializa os sistemas e coordena o loop.
- `player.ts` concentra movimento, ataques, dash, pulo e estados do jogador.
- `radio.ts`, `audio.ts` e `effects.ts` tratam estação, áudio e efeitos.
- `encounter-controller.ts` atualiza inimigos, projéteis, coordenação dos
  ataques corpo a corpo e reset do encontro.
- `melee-enemy.ts` e `ranged-enemy.ts` implementam os estados dos inimigos.
- `combat-target.ts` define o contrato usado pelos alvos que recebem dano.
- Os módulos `*-math.ts` contêm cálculos de combate usados pelo jogo e por
  testes unitários.
- `hud.ts` controla a interface DOM; `test-hook.ts` expõe estado restrito ao
  ambiente de testes.

## Testes e qualidade

Há testes unitários com Vitest para cálculos de combate, estados dos inimigos,
áudio, HUD, jogador e reset do encontro. Os testes E2E versionados com
Playwright cobrem os fluxos principais da fundação e do Core Combat. Casos
temporários de desenvolvimento ficam em `e2e/scratch/`, fora do versionamento.

```bash
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
```

## Como executar localmente

Requer Node.js e npm.

```bash
git clone https://github.com/wander-eng/radio-prototype.git
cd radio-prototype
npm install
npm run dev
```

O Vite exibirá o endereço local no terminal. `npm run build` gera o build de
produção e `npm run preview` o serve localmente.

## Roadmap resumido

1. Fundação e identidade das estações — concluída.
2. Energia e transformação — concluída.
3. Core Combat — concluído.
4. Game Feel — tech spec aprovada; implementação pendente.
5. Possibilidades posteriores: armas, produção visual, conteúdo e experimentos
   de ritmo.

O roadmap trata os itens futuros como possibilidades, não compromissos.

## Limitações atuais

- Personagem, inimigos, arena, sinalizações e HUD são provisórios.
- O encontro atual tem dois inimigos corpo a corpo e um à distância, sem
  ondas, progressão ou dificuldade crescente.
- Armas finais, chefes, conteúdo de campanha e acabamento de impacto ainda
  não foram implementados.
- Não há trava de mira persistente.

## Autor

**Wandemberg Filgueira**

- GitHub: [@wander-eng](https://github.com/wander-eng)
