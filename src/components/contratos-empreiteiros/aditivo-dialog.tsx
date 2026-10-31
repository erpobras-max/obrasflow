import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FilePlus2, Loader2 } from "lucide-react";

interface AditivoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
  onAditivoCriado: () => void;
}

export function AditivoDialog({
  open,
  onOpenChange,
  contratoId,
  onAditivoCriado,
}: AditivoDialogProps) {
  const [tipo, setTipo] = useState<"quantidade" | "preco" | "prazo" | "escopo" | "misto">("quantidade");
  const [objeto, setObjeto] = useState("");
  const [valorAcrescimoBRL, setValorAcrescimoBRL] = useState("");
  const [diasPrazo, setDiasPrazo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objeto.trim()) {
      toast.error("Informe a descrição do objeto do aditivo.");
      return;
    }

    setSalvando(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Próximo número
      const { data: ultimos } = await supabase
        .from("contrato_empreiteiro_aditivos")
        .select("numero")
        .eq("contrato_empreiteiro_id", contratoId)
        .order("numero", { ascending: false })
        .limit(1);

      const proximoNumero = (ultimos?.[0]?.numero || 0) + 1;

      // Converter BRL para centavos
      const valorLimpo = valorAcrescimoBRL.replace(/\./g, "").replace(",", ".");
      const valorCentavos = Math.round((parseFloat(valorLimpo) || 0) * 100);
      const dias = parseInt(diasPrazo, 10) || 0;

      const { error: errAditivo } = await supabase
        .from("contrato_empreiteiro_aditivos")
        .insert({
          contrato_empreiteiro_id: contratoId,
          numero: proximoNumero,
          tipo,
          objeto: objeto.trim(),
          valor_acrescimo_centavos: valorCentavos,
          dias_prazo: dias,
          status: "aprovado",
          created_by: user.user?.id || null,
        });

      if (errAditivo) throw errAditivo;

      // Atualizar valor total do contrato
      const { data: contratoAtual } = await supabase
        .from("contratos_empreiteiros")
        .select("valor_total_aditivos_centavos, valor_total_atual_centavos")
        .eq("id", contratoId)
        .single();

      if (contratoAtual) {
        const novosAditivos = Number(contratoAtual.valor_total_aditivos_centavos || 0) + valorCentavos;
        const novoAtual = Number(contratoAtual.valor_total_atual_centavos || 0) + valorCentavos;

        await supabase
          .from("contratos_empreiteiros")
          .update({
            valor_total_aditivos_centavos: novosAditivos,
            valor_total_atual_centavos: novoAtual,
            updated_at: new Date().toISOString(),
          })
          .eq("id", contratoId);
      }

      toast.success(`Termo Aditivo nº ${proximoNumero} cadastrado com sucesso.`);
      setObjeto("");
      setValorAcrescimoBRL("");
      setDiasPrazo("");
      onAditivoCriado();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro ao criar aditivo: ${err.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-indigo-600" />
            Novo Termo Aditivo Contratual
          </DialogTitle>
          <DialogDescription>
            Registre aditamentos de valor, quantitativo ou prorrogação de prazo contratual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Tipo do Aditivo</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quantidade">Acréscimo de Quantidade</SelectItem>
                <SelectItem value="preco">Reajuste de Preço</SelectItem>
                <SelectItem value="prazo">Prorrogação de Prazo</SelectItem>
                <SelectItem value="escopo">Alteração de Escopo</SelectItem>
                <SelectItem value="misto">Misto (Escopo, Valor e Prazo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Objeto / Justificativa do Aditivo *</Label>
            <Textarea
              rows={3}
              placeholder="Ex: Inclusão de reforço estrutural e novos pontos de hidráulica..."
              value={objeto}
              onChange={(e) => setObjeto(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Acréscimo de Valor (R$)</Label>
              <Input
                placeholder="0,00"
                value={valorAcrescimoBRL}
                onChange={(e) => setValorAcrescimoBRL(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prorrogação de Prazo (Dias)</Label>
              <Input
                type="number"
                placeholder="Ex: 30"
                value={diasPrazo}
                onChange={(e) => setDiasPrazo(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Criar Termo Aditivo"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

