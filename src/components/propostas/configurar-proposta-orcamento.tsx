import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { configuracaoPropostaPadrao, type ConfiguracaoProposta } from '@/lib/proposta-orcamento.functions'

const opcoes: Array<[keyof ConfiguracaoProposta, string]> = [
  ['mostrarEtapas', 'Etapas'], ['mostrarAtividades', 'Atividades'], ['mostrarQuantidades', 'Quantidades'],
  ['mostrarUnidades', 'Unidades'], ['mostrarPrecoUnitario', 'Preço unitário'],
  ['mostrarComposicoes', 'Composição de insumos'], ['mostrarCustosInternos', 'Custos internos'], ['mostrarBdi', 'BDI'],
]

export function ConfigurarPropostaOrcamento({ valor = configuracaoPropostaPadrao, onChange }: { valor?: ConfiguracaoProposta; onChange(v: ConfiguracaoProposta): void }) {
  return <div className="grid gap-3 sm:grid-cols-2">{opcoes.map(([chave, rotulo]) => <div className="flex items-center gap-2" key={chave}><Checkbox id={`proposta-${chave}`} checked={valor[chave]} onCheckedChange={v => onChange({ ...valor, [chave]: Boolean(v) })} /><Label htmlFor={`proposta-${chave}`}>{rotulo}</Label></div>)}</div>
}

