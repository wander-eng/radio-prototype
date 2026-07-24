# Roadmap Macro do Projeto
*(índice de fases — as specs detalhadas de cada fase só são escritas quando a fase começa)*

## Fase atual

**Nenhuma fase de implementação ativa.**

A **Fase 2 — Core Combat** foi concluída em 18 de julho de 2026.

A **Fase 3 — Game Feel** foi concluída em 24 de julho de 2026 após
implementação dos Builders 3A–3G, validação automatizada e testes manuais.

A próxima etapa planejada é a **Fase 3.5 — Aprimoramentos de Dash por
Estação**. Sua tech spec ainda não foi escrita.

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

## Fase 1.5 — Transformation (Carga de Energia) ✅ Concluída

**Pergunta que essa fase responde:** ter que carregar energia e acionar a transformação parece uma recompensa satisfatória, ou só um passo extra chato antes de jogar de verdade?

*Testável contra os alvos-treino já existentes — não depende de inimigo real (Fase 2) para ser validada, por isso vem antes dela: melhor ajustar o núcleo do combate com essa camada já madura do que construir inimigo em cima de um loop ainda incerto.*

Resultado validado:
- Estado base neutro com mecânica e faixa normal da estação ativas
- Energia de 0 a 100, com ganho de +2 uma única vez por ataque bem-sucedido
- Aura escalando durante a carga e permanecendo máxima durante a transformação
- Transformação manual pela tecla R, disponível somente com energia cheia
- Consumo contínuo da energia ao longo de aproximadamente 15 segundos
- Manifestação visual e faixa emblemática da estação durante a transformação
- Estação bloqueada durante a transformação e liberada novamente ao encerrá-la
- HUD provisório de energia e indicação do comando R
- Testes unitários, E2E e validação manual concluídos

---

## Fase 2 — Core Combat ✅ Concluída

**Pergunta que essa fase responde:** o combate continua divertido depois de alguns minutos?

Resultado implementado e validado:
- ✅ Arena contínua com dois inimigos melee e um ranged
- ✅ IA simples, telegraph, projéteis e coordenação de ataques
- ✅ HP funcional, dano, morte e retomada manual do jogador
- ✅ Respawn individual e reset completo do encontro
- ✅ Double jump integrado ao combate e ataques inimigos sensíveis à altura
- ✅ Esquiva real da Samba e ganho único de energia no dash do Forró
- ✅ Soft aim assist estreito, sem hard lock-on
- ✅ Testes automatizados, testes manuais e validação da fase concluídos

*Nota: testar com 1-2 tipos de inimigo repetindo, não com sistema de waves — waves como progressão de dificuldade pertence à Fase 5. O feedback mínimo de acerto (knockback, destruição/respawn dos alvos) já existe da vertical slice e é suficiente para testar esta fase honestamente, sem precisar esperar a Fase 3.*

---

## Fase 3 — Game Feel ✅ Concluída

**Critério de sucesso:** o jogador sente prazer só em acertar um inimigo.

Resultado implementado e validado:

- ✅ Impactos classificados e agregados por ação
- ✅ Hitstop integrado ao slow motion, pausa, morte e transformação
- ✅ Flash, reação visual e knockback limitado
- ✅ Camera shake posicional sem deriva
- ✅ Hit sparks geométricos e áudio sintético de impacto
- ✅ Identidade sensorial mínima para Phonk, Samba e Forró
- ✅ Limites e limpeza de efeitos em pausa, morte, revive e reset
- ✅ Observabilidade DEV, testes automatizados e validação manual concluídos

---

## Fase 3.5 — Aprimoramentos de Dash por Estação

Próxima fase planejada. Cada item altera regras de combate e exige tech spec
própria antes da implementação:

- Phonk: avaliar rastro explosivo persistente na área atravessada pelo dash.
- Samba: avaliar dano e knockup durante a travessia sem diluir sua identidade
  defensiva e precisa.
- Forró: avaliar stun nos alvos atravessados, incluindo duração, repetição e
  interação com FSM, telegraphs e respawn.

---

## Fase 4a — Armas por Estação

*(separada da produção visual porque é decisão de design testável — precisa de
spec, testes manuais e iteração, como tudo até aqui)*

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

1. Planejar e escrever a tech spec da Fase 3.5 — Aprimoramentos de Dash por
   Estação.

---

## Sobre o GDD

Não é escrito antecipadamente. Sequência:

```
Manifesto → Vertical Slice → Roadmap (este documento) → Specs por fase → GDD
```

O GDD é compilado continuamente conforme cada fase é validada — por exemplo, a seção de combate pode ser escrita assim que Core Combat e Game Feel estiverem prontos e testados, sem esperar o roadmap inteiro terminar.
