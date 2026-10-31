import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { ArrowRightLeft, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client.custom";
import { uploadR2 } from "@/lib/r2";
import { formatBRLInput } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const transferenciaSchema = z
  .object({
    conta_origem_id: z.string().min(1, "Selecione a conta de origem"),
    conta_destino_id: z.string().min(1, "Selecione a conta de destino"),
    valor: z.number().min(0.01, "O valor deve ser maior que zero"),
    data_transferencia: z.string().min(1, "Informe a data da transferência"),
    descricao: z.string().optional(),
    observacoes: z.string().optional(),
  })
  .refine((data) => data.conta_origem_id !== data.conta_destino_id, {
    message: "A conta de destino não pode ser igual à de origem",
    path: ["conta_destino_id"],
  });

type TransferenciaFormValues = z.infer<typeof transferenciaSchema>;

interface TransferenciaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contasBancarias: Array<{ id: string; nome: string; tipo: string; ativo: boolean }>;
  onSuccess: () => void;
}

export function TransferenciaFormDialog({
  open,
  onOpenChange,
  contasBancarias,
  onSuccess,
}: TransferenciaFormDialogProps) {
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);

  const form = useForm<TransferenciaFormValues>({
    resolver: zodResolver(transferenciaSchema),
    defaultValues: {
      conta_origem_id: "",
      conta_destino_id: "",
      valor: 0,
      data_transferencia: new Date().toISOString().slice(0, 10),
      descricao: "Transferência entre contas",
      observacoes: "",
    },
  });

  const watchOrigem = form.watch("conta_origem_id");

  const onSubmit = async (values: TransferenciaFormValues) => {
    try {
      let comprovanteUrl: string | null = null;
      if (comprovanteFile) {
        comprovanteUrl = await uploadR2(comprovanteFile, "financeiro/comprovantes");
      }

      const valorCentavos = Math.round(values.valor * 100);

      const { error } = await (supabase as any).from("transferencias_bancarias").insert({
        conta_origem_id: values.conta_origem_id,
        conta_destino_id: values.conta_destino_id,
        valor_centavos: valorCentavos,
        data_transferencia: values.data_transferencia,
        descricao: values.descricao || "Transferência interna",
        comprovante_url: comprovanteUrl,
        observacoes: values.observacoes || null,
      });

      if (error) throw error;

      toast.success("Transferência realizada com sucesso!");
      form.reset({
        conta_origem_id: "",
        conta_destino_id: "",
        valor: 0,
        data_transferencia: new Date().toISOString().slice(0, 10),
        descricao: "Transferência entre contas",
        observacoes: "",
      });
      setComprovanteFile(null);
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao realizar transferência");
    }
  };

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="size-5 text-primary" />
            Transferência entre Contas
          </DialogTitle>
          <DialogDescription>
            Movimente valores entre contas ou caixas internos sem gerar receita ou despesa no DRE.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="conta_origem_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Conta Origem (Sai)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contasBancarias.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="conta_destino_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Conta Destino (Entra)</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contasBancarias
                          .filter((c) => c.id !== watchOrigem)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="valor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Valor (R$) *</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        className="h-9 font-mono"
                        placeholder="0,00"
                        value={formatBRLInput(field.value)}
                        onChange={(e) => {
                          const cleanDigits = e.target.value.replace(/\D/g, "");
                          if (!cleanDigits) {
                            field.onChange(0);
                            return;
                          }
                          field.onChange(parseInt(cleanDigits, 10) / 100);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_transferencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Data da Transferência *</FormLabel>
                    <FormControl>
                      <Input type="date" className="h-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Descrição / Motivo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Suprimento de Caixa de Obra, Resgate..."
                      className="h-9"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Comprovante de Transferência</label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  className="h-9 text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files[0]) setComprovanteFile(files[0]);
                  }}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Detalhes adicionais..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? "Processando..." : "Confirmar Transferência"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

