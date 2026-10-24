import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Espaco } from "@/lib/espacos";
import { validateFileSize, validateFileType } from "@/lib/r2";

export type EspacoFormValue = Omit<Espaco, "id" | "token_publico" | "fotos">;

const emptyForm: EspacoFormValue = {
  codigo: "",
  nome: "",
  descricao: "",
  endereco: "",
  capacidade: 1,
  valor_hora: 0,
  duracao_minima_minutos: 60,
  horario_abertura: "08:00",
  horario_fechamento: "18:00",
  comodidades: [],
  regras: "",
  status: "rascunho",
};

export function EspacoFormDialog({
  open,
  target,
  pending,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  target: Espaco | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (value: EspacoFormValue, files: File[], removedKeys: string[]) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState<File[]>([]);
  const [existingKeys, setExistingKeys] = useState<string[]>([]);
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);
  const [comodidades, setComodidades] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(
      target
        ? {
            codigo: target.codigo,
            nome: target.nome,
            descricao: target.descricao ?? "",
            endereco: target.endereco ?? "",
            capacidade: target.capacidade,
            valor_hora: target.valor_hora,
            duracao_minima_minutos: target.duracao_minima_minutos,
            horario_abertura: target.horario_abertura.slice(0, 5),
            horario_fechamento: target.horario_fechamento.slice(0, 5),
            comodidades: target.comodidades,
            regras: target.regras ?? "",
            status: target.status,
          }
        : emptyForm,
    );
    setComodidades(target?.comodidades.join(", ") ?? "");
    setExistingKeys(target?.fotos?.map((photo) => photo.object_key) ?? []);
    setRemovedKeys([]);
    setFiles([]);
  }, [open, target]);

  const update = <K extends keyof EspacoFormValue>(key: K, value: EspacoFormValue[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const addFiles = (selected: FileList | null) => {
    const next = Array.from(selected ?? []);
    if (existingKeys.length + files.length + next.length > 10) {
      toast.error("Cada sala pode ter até 10 fotos.");
      return;
    }
    if (next.some((file) => !validateFileType(file, "imagens") || !validateFileSize(file))) {
      toast.error("Use imagens JPG, PNG ou WebP de até 10 MB.");
      return;
    }
    setFiles((current) => [...current, ...next]);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amenities = comodidades
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    if (!form.codigo.trim() || !form.nome.trim() || form.valor_hora <= 0 || form.capacidade <= 0) {
      toast.error("Preencha código, nome, capacidade e valor por hora.");
      return;
    }
    if (form.horario_fechamento <= form.horario_abertura) {
      toast.error("O horário de fechamento deve ser posterior à abertura.");
      return;
    }
    onSave(
      { ...form, codigo: form.codigo.trim(), nome: form.nome.trim(), comodidades: amenities },
      files,
      removedKeys,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{target ? "Editar espaço" : "Novo espaço"}</DialogTitle>
          <DialogDescription>
            Dados usados na apresentação pública e na reserva por hora.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Código" required>
              <Input
                value={form.codigo}
                maxLength={40}
                onChange={(e) => update("codigo", e.target.value)}
                placeholder="SALA-01"
              />
            </Field>
            <Field label="Nome" required>
              <Input
                value={form.nome}
                maxLength={120}
                onChange={(e) => update("nome", e.target.value)}
                placeholder="Sala Executiva"
              />
            </Field>
            <Field label="Capacidade" required>
              <Input
                type="number"
                min={1}
                value={form.capacidade}
                onChange={(e) => update("capacidade", Number(e.target.value))}
              />
            </Field>
            <Field label="Valor por hora (R$)" required>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.valor_hora || ""}
                onChange={(e) => update("valor_hora", Number(e.target.value))}
              />
            </Field>
            <Field label="Duração mínima (minutos)" required>
              <Input
                type="number"
                min={15}
                step={15}
                value={form.duracao_minima_minutos}
                onChange={(e) => update("duracao_minima_minutos", Number(e.target.value))}
              />
            </Field>
            <Field label="Situação">
              <Select
                value={form.status}
                onValueChange={(value: Espaco["status"]) => update("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="publicado">Publicado</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Abre às" required>
              <Input
                type="time"
                value={form.horario_abertura}
                onChange={(e) => update("horario_abertura", e.target.value)}
              />
            </Field>
            <Field label="Fecha às" required>
              <Input
                type="time"
                value={form.horario_fechamento}
                onChange={(e) => update("horario_fechamento", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Endereço">
            <Input
              value={form.endereco ?? ""}
              maxLength={500}
              onChange={(e) => update("endereco", e.target.value)}
              placeholder="Endereço exibido ao cliente"
            />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={form.descricao ?? ""}
              maxLength={4000}
              onChange={(e) => update("descricao", e.target.value)}
              rows={4}
              placeholder="Apresente o ambiente e os usos recomendados."
            />
          </Field>
          <Field label="Comodidades separadas por vírgula">
            <Input
              value={comodidades}
              onChange={(e) => setComodidades(e.target.value)}
              placeholder="Wi-Fi, TV, ar-condicionado"
            />
          </Field>
          <Field label="Regras de uso">
            <Textarea
              value={form.regras ?? ""}
              maxLength={4000}
              onChange={(e) => update("regras", e.target.value)}
              rows={3}
            />
          </Field>
          <div className="space-y-3">
            <Label>Fotos</Label>
            <div className="flex flex-wrap gap-2">
              {existingKeys.map((key, index) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExistingKeys((current) => current.filter((item) => item !== key));
                    setRemovedKeys((current) => [...current, key]);
                  }}
                >
                  Foto {index + 1} <Trash2 className="ml-2 size-3.5" />
                </Button>
              ))}
              {files.map((file, index) => (
                <Button
                  key={`${file.name}-${index}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  {file.name} <Trash2 className="ml-2 size-3.5" />
                </Button>
              ))}
            </div>
            <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
              <ImagePlus className="size-4" /> Adicionar fotos
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => addFiles(event.target.files)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 size-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}
