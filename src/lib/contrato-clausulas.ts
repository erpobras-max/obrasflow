export type ClausulaContrato = {
  titulo: string;
  texto: string;
};

/** Modelo usado quando um contrato civil é criado ou ainda não tem cláusulas salvas. */
export const CLAUSULAS_PADRAO: ClausulaContrato[] = [
  {
    titulo: "CLÁUSULA PRIMEIRA — OBJETO",
    texto:
      "O presente contrato tem por objeto a prestação de serviços de mão de obra descritos em {{objeto}}, conforme os projetos, memoriais e demais documentos aceitos pelas partes.\n\nOs serviços serão executados em conformidade com este contrato, os projetos aplicáveis e as normas técnicas pertinentes.",
  },
  {
    titulo: "CLÁUSULA SEGUNDA — ESCOPO DOS SERVIÇOS",
    texto:
      "Os serviços compreenderão as especificações contratuais, os critérios de medição e os documentos técnicos relacionados à obra.\n\nCada parte assumirá as obrigações necessárias à execução dos serviços, conforme a divisão prevista neste instrumento.",
  },
  {
    titulo: "CLÁUSULA TERCEIRA — DOCUMENTOS DO CONTRATO",
    texto:
      "Integram este contrato, quando existentes, a proposta comercial, o cronograma físico-financeiro, os projetos e os memoriais descritivos.\n\nEm caso de divergência, as partes formalizarão por escrito a interpretação aplicável. Alterações de escopo, prazo ou valor somente terão validade por termo aditivo assinado pelas partes.",
  },
  {
    titulo: "CLÁUSULA QUARTA — OBRIGAÇÕES DA CONTRATADA",
    texto:
      "A CONTRATADA executará os serviços com diligência, observando as boas práticas, a legislação e as normas técnicas aplicáveis.\n\nA CONTRATADA responderá pela qualidade, solidez e segurança dos serviços sob sua responsabilidade e refará, sem ônus para a CONTRATANTE, a parte comprovadamente executada em desacordo com o contratado.\n\nA CONTRATADA entregará os documentos usuais de acompanhamento dos serviços quando solicitados pela fiscalização.",
  },
  {
    titulo: "CLÁUSULA QUINTA — OBRIGAÇÕES DA CONTRATANTE",
    texto:
      "A CONTRATANTE fornecerá, quando previsto no escopo, os materiais necessários, bem como energia, água, esgoto e acesso às áreas de trabalho em condições adequadas.\n\nA CONTRATANTE realizará os pagamentos na forma e nos prazos estabelecidos neste contrato. A ausência de materiais, projetos ou liberação da frente de trabalho poderá suspender o cronograma pelo período correspondente.",
  },
  {
    titulo: "CLÁUSULA SEXTA — PRAZO",
    texto:
      "Os serviços serão executados de {{inicio}} até {{fim}}, conforme o cronograma físico-financeiro.\n\nO prazo poderá ser prorrogado por força maior, caso fortuito, paralisação, alterações de projeto, atraso na disponibilização de materiais ou informações, greve, chuvas que afetem os serviços ou acordo formal entre as partes.",
  },
  {
    titulo: "CLÁUSULA SÉTIMA — PREÇO CONTRATUAL",
    texto:
      "Pela execução dos serviços, a CONTRATANTE pagará à CONTRATADA o valor total de {{valor}}, conforme a proposta comercial e as medições aceitas.\n\nO preço inclui mão de obra, ferramentas de pequeno porte e serviços auxiliares necessários ao escopo contratado. Modificações solicitadas pela CONTRATANTE que alterem preço ou prazo deverão ser formalizadas por termo aditivo.",
  },
  {
    titulo: "CLÁUSULA OITAVA — MEDIÇÃO, FATURAMENTO E PAGAMENTO",
    texto:
      "Os pagamentos serão realizados por depósito, transferência, PIX ou outro meio acordado, conforme as medições e o cronograma físico-financeiro.\n\nA CONTRATANTE efetuará o pagamento dos serviços efetivamente executados e aceitos, observando os prazos definidos entre as partes.",
  },
  {
    titulo: "CLÁUSULA NONA — RESCISÃO E MULTA",
    texto:
      "Este contrato poderá ser rescindido por qualquer das partes em caso de descumprimento contratual, mediante comunicação prévia.\n\nNa rescisão sem justa causa por iniciativa da CONTRATANTE, serão devidos os serviços executados até a última medição, acrescidos de multa rescisória de 2% sobre o saldo remanescente. Em caso de abandono injustificado pela CONTRATADA, incidirá multa de 2% sobre o valor total do contrato, sem prejuízo das perdas e danos comprovados.",
  },
];

export function copiarClausulas(clausulas?: ClausulaContrato[] | null) {
  return clausulas?.length
    ? clausulas.map((clausula) => ({ ...clausula }))
    : CLAUSULAS_PADRAO.map((clausula) => ({ ...clausula }));
}

export function preencherClausula(
  texto: string,
  dados: { objeto: string; inicio: string; fim: string; valor: string },
) {
  return texto
    .replaceAll("{{objeto}}", dados.objeto)
    .replaceAll("{{inicio}}", dados.inicio)
    .replaceAll("{{fim}}", dados.fim)
    .replaceAll("{{valor}}", dados.valor);
}

