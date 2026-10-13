import {
  copiarClausulas,
  preencherClausula,
  type ClausulaContrato,
} from "@/lib/contrato-clausulas";

type Props = {
  clausulas?: ClausulaContrato[] | null;
  objeto: string;
  inicio: string;
  fim: string;
  valor: string;
};

export function ClausulasDocumento({ clausulas: salvas, objeto, inicio, fim, valor }: Props) {
  return (
    <>
      {copiarClausulas(salvas).map((clausula, index) => (
        <section key={`${clausula.titulo}-${index}`} className="space-y-2 pt-2">
          <h3 className="font-bold uppercase">{clausula.titulo}</h3>
          {preencherClausula(clausula.texto, { objeto, inicio, fim, valor })
            .split("\n\n")
            .map((paragrafo, paragrafoIndex) => (
              <p key={paragrafoIndex}>{paragrafo}</p>
            ))}
        </section>
      ))}
    </>
  );
}

