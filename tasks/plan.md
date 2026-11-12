# Plano de implementação: CAD arquitetônico do ObrasFlow

## Visão geral

Evoluir o Projeto 3D atual para um CAD arquitetônico web integrado ao ObrasFlow. O objetivo não é reproduzir um CAD generalista ou copiar a interface de terceiros, mas permitir importar, localizar, editar, documentar e apresentar plantas de edificações com propriedades construtivas explícitas e ligação direta com quantitativos, BDI, dossiê e portal.

As tarefas são controladas no GitHub pelo épico [#127](https://github.com/erpobras-max/obrasflow/issues/127) e pelas Issues listadas abaixo. Cada Issue deve gerar branch e PR próprias.

## Decisões de arquitetura

- Geometria 2D permanece como fonte do 3D e dos quantitativos; o 3D não deve inventar cobertura, acabamento ou elemento não configurado.
- Navegação e cálculo de limites formam a base comum antes de ferramentas avançadas ou novos formatos DXF.
- Propriedades construtivas são dados persistidos do projeto, não apenas estados visuais locais do viewport.
- Compatibilidade DXF cresce por entidades e fixtures reais, com relatório de itens convertidos e ignorados.
- O escopo é CAD arquitetônico para obras. CAD mecânico, elétrico e industrial generalista fica fora deste épico.
- Não será copiada marca, interface ou implementação de CADCraft, AutoCAD ou outro produto.

## Lista de tarefas

### Fase 1 — Controle visual e propriedades construtivas

1. [#129 — Zoom Total e navegação previsível](https://github.com/erpobras-max/obrasflow/issues/129)
2. [#128 — Cobertura e telhado explicitamente configuráveis](https://github.com/erpobras-max/obrasflow/issues/128)
3. [#130 — Biblioteca editável de pinturas e pisos](https://github.com/erpobras-max/obrasflow/issues/130)

### Checkpoint da Fase 1

- Planta real pode ser recuperada pelo Zoom Total sem alterar sua geometria.
- Projeto novo não apresenta telhado sem escolha do usuário.
- Pinturas, pisos e tetos persistem e aparecem de forma coerente no 2D, 3D, quantitativos e dossiê.
- Testes focados e `npm run build` passam.
- Responsável pelo produto valida o fluxo antes da Fase 2.

### Fase 2 — Núcleo de edição e interoperabilidade

4. [#131 — Seleção, transformação e layers](https://github.com/erpobras-max/obrasflow/issues/131)
5. [#133 — Importação e exportação DXF ampliadas](https://github.com/erpobras-max/obrasflow/issues/133)

As duas frentes podem avançar em paralelo após o utilitário de limites da Issue #129 estar estabilizado. Transformações devem ser divididas em PRs menores: seleção múltipla, mover/copiar, rotacionar/alinhamento e layers. O DXF deve avançar por conjuntos coerentes de entidades, cada um acompanhado de fixture e teste.

### Checkpoint da Fase 2

- Usuário seleciona e transforma vários elementos com entrada numérica, snap, ortho e undo/redo.
- Layers podem ocultar, bloquear e organizar elementos sem removê-los.
- Importador informa o que converteu e o que ignorou.
- Arquivos DXF de regressão mantêm escala, posição relativa e desempenho aceitável.

### Fase 3 — Documentação técnica

6. [#132 — Cotas, anotações, layouts e impressão em escala](https://github.com/erpobras-max/obrasflow/issues/132)

Executar em PRs separadas para cotas associativas, anotações/símbolos e folhas/impressão. Esta fase depende dos layers e das transformações da Fase 2.

### Checkpoint final

- Projeto real completa o fluxo importar → enquadrar → editar → configurar materiais/cobertura → cotar → visualizar em 3D → imprimir.
- Medidas conferem no desenho e na folha exportada.
- Projeto salvo abre novamente sem perda de geometria ou propriedades.
- Testes automatizados, build e aceitação visual passam.
- Documentação e `PROGRESS.md` refletem somente funcionalidades realmente publicadas.

## Dependências

```text
#129 Navegação e limites
 ├─> #131 Seleção, transformações e layers
 └─> #133 DXF avançado

#128 Cobertura explícita ─┐
#130 Acabamentos ─────────┼─> #132 Cotas, layouts e impressão
#131 Layers ──────────────┘
```

## Riscos e mitigação

| Risco                                       | Impacto    | Mitigação                                                                         |
| ------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| Crescimento descontrolado do escopo         | Alto       | Manter o limite arquitetônico e uma Issue/PR por fatia vertical                   |
| Regressão ou perda de geometria             | Alto       | Fixtures, histórico undo/redo e testes de round-trip antes do merge               |
| Arquivos DXF muito grandes ou incompatíveis | Alto       | Processamento incremental, relatório de entidades e limites de segurança          |
| Baixo desempenho no navegador               | Médio/alto | Medir quantidade de objetos, tempo de importação e frame rate em fixtures grandes |
| Interface complexa para usuários ocasionais | Médio      | Ferramentas progressivas, propriedades contextuais e teste com engenheiros        |
| Propriedade intelectual de terceiros        | Médio/alto | Implementação original orientada aos fluxos do ObrasFlow, sem cópia fiel          |

## Questões a validar nos checkpoints

- Quais comandos numéricos são indispensáveis no primeiro uso real: mover, copiar, rotacionar, offset, trim ou extend?
- Quais padrões de cobertura e acabamentos representam a maior parte das obras atendidas?
- A impressão inicial precisa priorizar A4, A3 ou ambos?
- Quais arquivos DXF adicionais devem entrar na biblioteca de regressão depois do `predio.dxf`?

