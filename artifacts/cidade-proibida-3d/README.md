# Maquete 3D — Salão da Suprema Harmonia

Modelo modular para impressão FDM do **Salão da Suprema Harmonia (Taihe Dian)**, o principal pavilhão cerimonial da Cidade Proibida, em Pequim.

O modelo é uma interpretação arquitetônica simplificada, desenhada do zero para impressão. Não reproduz o molde comercial de papel usado como referência visual.

## Dimensões e escala

- Escala aproximada: **1:400**.
- Base: **200 × 280 mm**, com margem de 5 mm em uma mesa A4 de 210 × 297 mm.
- Altura montada: aproximadamente **88 mm**.
- Salão: proporção de **11 × 5 vãos**, plataforma tripla e cobertura de beiral duplo.
- Encaixes: pino de 4,0 mm, cavidade de 4,5 mm (**0,25 mm de folga por lado**).

A proporção parte das dimensões públicas de aproximadamente 63 × 35 m para o salão e do registro de 11 × 5 vãos. O museu descreve o edifício no eixo central, sobre uma plataforma de mármore branco em três níveis, com a cobertura hierarquicamente mais importante do conjunto.

Fontes consultadas:

- [Palace Museum — Hall of Supreme Harmony](https://intl.dpm.org.cn/hallsinfo/374.html?_wap=1)
- [Visit Beijing — Taihedian](https://english.visitbeijing.com.cn/article/47ONFu0xFTa)
- [Referência visual indicada pelo solicitante](https://maquetepapel.com.br/produto/maquete-de-papel-da-cidade-proibida-na-china/)

## Arquivos para imprimir

1. `00_teste_encaixe.stl` — imprima primeiro; contém um pino e cavidades com três folgas.
2. `01_base.stl`
3. `02_terraco_inferior.stl`
4. `03_terraco_intermediario.stl`
5. `04_terraco_superior.stl`
6. `05_salao_11x5_vaos.stl`
7. `06_beiral_inferior.stl`
8. `07_cobertura_imperial.stl`

`cidade_proibida_montada_REFERENCIA.stl` serve apenas para visualizar a montagem; não deve ser usado para impressão em uma peça.

## Configuração recomendada

- Material: PLA.
- Bico: 0,4 mm.
- Camada: 0,20 mm.
- Paredes: 3 perímetros.
- Topo/fundo: 4 camadas.
- Preenchimento: 12% a 15% em grade ou gyroid.
- Suportes: desativados.
- Orientação: mantenha a face plana de cada STL apoiada na mesa.
- Brim: 5 mm nas coberturas; 8 mm na base se houver tendência de empenamento.

Use primeiro o gabarito. A cavidade central corresponde à folga padrão de 0,25 mm por lado. Se ficar apertada, calibre o fluxo/expansão horizontal no fatiador antes de imprimir as peças grandes.

## Montagem

Monte na ordem numérica. A frente é o lado com três escadarias. Faça um encaixe a seco de todas as peças antes de colar. Se desejar união permanente, use uma gota de cianoacrilato apenas depois de conferir o alinhamento.

As cores históricas mais reconhecíveis são branco/cinza claro para a plataforma, vermelho para o corpo e amarelo/dourado para os telhados. Para troca de cor sem multimaterial, imprima cada STL no filamento correspondente.

## Regenerar e validar

Requer apenas Node.js 20 ou superior:

```powershell
node .\artifacts\cidade-proibida-3d\generate.mjs
```

O gerador recusa triângulos degenerados, coordenadas inválidas, geometria abaixo da mesa e qualquer peça imprimível maior que 200 × 280 mm. O relatório final fica em `manifest.json`.

## Limites do modelo

Este é um modelo educacional e imprimível, não um levantamento arqueológico. Ornamentos finos, balaustradas, telhas individuais, esculturas e a curvatura estrutural completa dos beirais foram reduzidos para sobreviver a uma impressão FDM com bico de 0,4 mm.
