# Roadmap Macro do Projeto
*(índice de fases — as specs detalhadas de cada fase só são escritas quando a fase começa)*

## Fase atual

**Fase 1.5 — Transformation**

Tech spec vigente:

`docs/tech-specs/phase-01-05-transformation.md`

## Princípio de uso deste documento

- Todo item abaixo é possível, não compromisso.
- Nenhuma spec além da próxima fase é escrita com antecedência.
- Se bater vontade de detalhar uma fase futura antes da hora, isso é o sinal de alerta, não uma tarefa a fazer.

---

## Fase 1 — Foundation ✅ Concluída

Objetivo: validar o conceito central do jogo (o rádio).

- ✅ Rádio, três estações (Phonk, Samba, Forró)
- ✅ Troca visual e mecânica
- ✅ Identidade sonora
- ✅ HUD mínimo
- ✅ Deploy (radio-prototype.vercel.app)
- ✅ Teste E aprovado — validado por dois jogadores sem contexto prévio

---

## Fase 1.5 — Transformation (Carga de Energia)

**Pergunta que essa fase responde:** ter que carregar energia e acionar a transformação parece uma recompensa satisfatória, ou só um passo extra chato antes de jogar de verdade?

*Testável contra os alvos-treino já existentes — não depende de inimigo real (Fase 2) para ser validada, por isso vem antes dela: melhor ajustar o núcleo do combate com essa camada já madura do que construir inimigo em cima de um loop ainda incerto.*

Specs possíveis:
- Estado base neutro (cor constante, cenário sem tingimento de estação)
- Barra de energia carregando ao acertar inimigos (taxa por hit a definir)
- Aura escalando em intensidade conforme a carga (0-100%), na cor da estação selecionada no momento
- Transformação manual (tecla R) só com barra cheia: cor do personagem, fog da cena, e troca da faixa de música para uma versão emblemática/especial da estação
- Ver nota de direito autoral no `.specs/SKILL.md` (antipadrões) antes de decidir as faixas emblemáticas reais

**Em aberto, decidir na spec desta fase:** a transformação dura para sempre até o jogador desativar, tem duração limitada, ou reseta ao ser atingido? A troca de estação via tecla continua acessível durante a transformação (sim, por decisão já tomada) — mas ao trocar de estação transformado, a manifestação visual/sonora da nova estação aparece instantaneamente ou precisa recarregar de novo?

---

## Fase 2 — Core Combat

**Pergunta que essa fase responde:** o combate continua divertido depois de alguns minutos?

Specs possíveis:
- Inimigo que ataca
- IA simples
- Sistema de HP do jogador (funcional — hoje é só scaffolding)
- Morte / respawn
- Arena de combate
- Double Jump: implementado antecipadamente; revisar integração com o combate
- Ataques aéreos
- Melhorias no dash
- Lock-on (opcional)

*Nota: testar com 1-2 tipos de inimigo repetindo, não com sistema de waves — waves como progressão de dificuldade pertence à Fase 5. O feedback mínimo de acerto (knockback, destruição/respawn dos alvos) já existe da vertical slice e é suficiente para testar esta fase honestamente, sem precisar esperar a Fase 3.*

---

## Fase 3 — Game Feel

**Critério de sucesso:** o jogador sente prazer só em acertar um inimigo.

Specs possíveis:
- Hitstop
- Camera shake
- Hit sparks
- Trail da arma
- Slow motion localizado
- Flash de impacto
- Melhor knockback
- Melhor feedback sonoro
- Melhor feedback visual
- Partículas de impacto
- **Aprimoramentos de dash por estação** *(o dash já tem comportamento único por estação desde a Fase 3 original da vertical slice — isto é adicionar efeitos novos por cima, não criar do zero):*
  - Phonk: rastro explosivo persistente na área por onde o dash passou (dano contínuo por um tempo — precisa de spec própria: duração, dano por tick, se afeta o mesmo alvo múltiplas vezes)
  - Samba: dano + knockup em quem for atravessado durante o dash (novo — hoje o dash da Samba é puramente defensivo, sem dano; vale checar se isso ainda combina com a fantasia "Ginga"/precisão, ou se dilui ela)
  - Forró: stun em quem for atravessado (adição — o dash do Forró já causa dano a quem atravessa desde a vertical slice; só o stun é novo)

---

## Fase 4a — Armas por Estação

*(separada da produção visual porque é decisão de design testável — precisa de spec, playtest e iteração, como tudo até aqui)*

- Phonk: armas de impacto e explosão — escopeta, bazuca, rastro explosivo ao atirar/atacar
- Samba: artes marciais, capoeira, cordas e ganchos
- Forró: espada + lâminas flutuantes rodopiantes ao redor do personagem, dano em área *(referência de vibe: conceito de "blade dancer" tipo Irelia/LoL ou Jett/Valorant — usar só como inspiração de sensação, não copiar modelo/animação, já que o jogo está deployado publicamente)*

---

## Fase 4b — Produção Visual Final

*(renomeada de "Identidade" — a identidade central do jogo já foi validada na Fase 1; isso é execução sobre o que já foi provado, não uma hipótese a testar)*

- Personagem definitivo *(modelo 3D com rig e animação — categoria de trabalho maior que os demais itens desta lista, ver `references/personagem.md` quando escrito)*
- HUD definitivo
- Menu principal
- Configurações (volume, controles)
- VFX melhores
- Cenário definitivo
- Direção de arte

---

## Fase 5 — Conteúdo

**Pergunta que essa fase responde:** quero continuar jogando?

- Novas arenas
- Waves de inimigos (progressão de dificuldade)
- Mini bosses
- Bosses
- Progressão
- Sistema de rank
- Desbloqueios

---

## Fase 6 — Experimentos

Objetivo: explorar ideias maiores sem comprometer o escopo principal. Categoria à parte — projeto seguinte, não fase sequencial garantida.

- Mecânica de ritmo mais profunda (combos sincronizados com BPM)
- Rádio influenciando timing de forma mais ampla
- Multiplayer / arena PvP
- Rádio colaborativa / música enviada pelos jogadores

---

## Próximas fases

1. Concluir e validar a Fase 1.5 — Transformation.
2. Escrever a tech spec da Fase 2.
3. Implementar e validar a Fase 2 — Core Combat.
4. Escrever a tech spec da Fase 3.
5. Implementar e validar a Fase 3 — Game Feel.

---

## Sobre o GDD

Não é escrito antecipadamente. Sequência:

```
Manifesto → Vertical Slice → Roadmap (este documento) → Specs por fase → GDD
```

O GDD é compilado continuamente conforme cada fase é validada — por exemplo, a seção de combate pode ser escrita assim que Core Combat e Game Feel estiverem prontos e testados, sem esperar o roadmap inteiro terminar.
