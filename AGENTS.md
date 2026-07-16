# AGENTS.md — Radio Prototype

## Visão geral do projeto

Radio Prototype é um jogo de ação 3D para navegador construído com:

- Vite
- TypeScript
- Three.js puro

## Contexto obrigatório

Antes de iniciar qualquer tarefa de implementação, design ou gameplay:

1. Leia `.specs/ROADMAP.md` para identificar a fase atual.
2. Leia a especificação técnica correspondente em `docs/tech-specs/`.
3. Leia `.specs/SKILL.md`.
4. Identifique e leia as referências aplicáveis em `.specs/references/`.

Não presuma qual é a fase atual apenas pelo nome dos arquivos. Use o
`ROADMAP.md` como fonte de verdade.

Se o roadmap não apontar claramente para uma tech spec, informe a
ambiguidade antes de implementar.

## Correção de bugs

Antes de investigar ou corrigir um bug:

1. Leia `.specs/LESSONS.md`.
2. Verifique se já existe uma causa raiz documentada para o mesmo padrão
   ou para um problema semelhante.
3. Investigue a causa raiz antes de alterar o código.
4. Não implemente uma correção que contradiga uma lição registrada sem
   explicar por que ela não se aplica ao caso atual.

Não considere o desaparecimento do sintoma como prova de que a causa raiz
foi corrigida.

## Regras de trabalho

Antes de editar:

1. Identifique os arquivos provavelmente envolvidos.
2. Explique brevemente o plano.
3. Informe riscos ou ambiguidades relevantes.

Durante a implementação:

- Limite as alterações ao escopo da tarefa.
- Não faça refatorações paralelas sem necessidade.
- Não adicione nem atualize dependências sem justificar e solicitar
  aprovação.
- Preserve os padrões e contratos existentes do projeto.
- Não desative, enfraqueça ou remova testes para obter resultado verde.
- Não altere arquivos gerados ou artefatos de teste, salvo quando a tarefa
  exigir explicitamente.

Depois da implementação:

- Revise o diff completo.
- Procure alterações acidentais e regressões óbvias.
- Informe os arquivos modificados e o motivo de cada alteração relevante.

## Organização dos testes

- Testes unitários usam Vitest e ficam próximos ao arquivo de origem como
  `*.spec.ts`.
- Testes end-to-end usam Playwright e ficam em `e2e/`.
- Não coloque testes Playwright dentro de `src/`.
- Não use testes E2E como substitutos para testes unitários focados.
- Testes exploratórios ou descartáveis devem ficar em `e2e/scratch/` e
  não devem ser versionados.

## Validação obrigatória

Nunca considere uma tarefa, teste ou bug resolvido apenas porque o código
parece correto.

Para alterações em código-fonte, configuração de build ou comportamento:

```bash
npm test
npm run test:e2e
```
Para alterações exclusivamente documentais, os testes podem ser omitidos, mas isso deve ser informado explicitamente na conclusão.

A tarefa só pode ser considerada concluída quando:

- os comandos aplicáveis tiverem sido executados;
- todos tiverem terminado com sucesso;
- nenhum teste relevante tiver sido ignorado, removido ou enfraquecido;
- o resultado tiver sido comparado com os critérios de aceite da tech spec.

Se algum comando não puder ser executado, informe:

- o comando;
- a mensagem de erro;
- a causa provável;
- o impacto sobre a validação;
- o que ainda falta verificar.

Não declare a tarefa como concluída quando houver validação pendente.