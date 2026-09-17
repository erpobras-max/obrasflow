import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Search } from "lucide-react";

import { supabase as supabaseOriginal } from "@/integrations/supabase/client.custom";
import { UFS } from "@/lib/clientes.schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const supabase = supabaseOriginal as any;

export type FonteReferencia = "sinapi" | "sicro";
export type TipoReferencia = "insumo" | "composicao";

export interface ReferenciaCustoSelecionada {
  id: string;
  fonte: FonteReferencia;
  tipo: TipoReferencia;
  uf: string;
  competencia: string;
  codigo: string;
  descricao: string;
  unidade: string;
  valorUnitario: number;
}

interface ReferenciaCustosPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (referencia: ReferenciaCustoSelecionada) => void;
  title?: string;
}

const competenciaSort = (a: string, b: string) => {
  const [ma, aa] = a.split("/").map(Number);
  const [mb, ab] = b.split("/").map(Number);
  return (ab * 100 + mb) - (aa * 100 + ma);
};

const formatBRL = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ReferenciaCustosPicker({
  open,
  onOpenChange,
  onSelect,
  title = "Selecionar referência SINAPI/SICRO",
}: ReferenciaCustosPickerProps) {
  const [fonte, setFonte] = useState<FonteReferencia>("sinapi");
  const [tipo, setTipo] = useState<TipoReferencia>("composicao");
  const [uf, setUf] = useState("SP");
  const [competencia, setCompetencia] = useState("");
  const [busca, setBusca] = useState("");

  const tabela = tipo === "composicao" ? "referencia_composicoes" : "referencia_insumos";

  const { data: competencias = [], isLoading: carregandoCompetencias } = useQuery({
    queryKey: ["referencias-competencias", tabela, fonte, uf],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(tabela)
        .select("mes_referencia")
        .eq("fonte", fonte)
        .eq("uf", uf)
        .limit(5000);
      if (error) throw error;
      return [...new Set((data ?? []).map((item: any) => String(item.mes_referencia)))]
        .sort(competenciaSort) as string[];
    },
  });

  useEffect(() => {
    if (!competencias.length) {
      setCompetencia("");
      return;
    }
    if (!competencias.includes(competencia)) setCompetencia(competencias[0]);
  }, [competencias, competencia]);

  const buscaSegura = useMemo(
    () => busca.replace(/[,()%_*]/g, " ").trim().slice(0, 100),
    [busca],
  );

  const { data: referencias = [], isLoading, error } = useQuery({
    queryKey: ["referencias-custos-picker", tabela, fonte, uf, competencia, buscaSegura],
    enabled: open && !!competencia,
    queryFn: async () => {
      const valor = tipo === "composicao" ? "custo_total" : "preco_mediano";
      let query = supabase
        .from(tabela)
        .select(`id,fonte,uf,mes_referencia,codigo,descricao,unidade,${valor}`)
        .eq("fonte", fonte)
        .eq("uf", uf)
        .eq("mes_referencia", competencia)
        .order("codigo")
        .limit(100);
      if (buscaSegura) {
        query = query.or(`codigo.ilike.%${buscaSegura}%,descricao.ilike.%${buscaSegura}%`);
      }
      const { data, error: queryError } = await query;
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  const escolher = (row: any) => {
    const centavos = Number(tipo === "composicao" ? row.custo_total : row.preco_mediano);
    onSelect({
      id: row.id,
      fonte,
      tipo,
      uf: row.uf,
      competencia: row.mes_referencia,
      codigo: row.codigo,
      descricao: row.descricao,
      unidade: row.unidade,
      valorUnitario: centavos / 100,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Consulte a base carregada no sistema. O valor selecionado é uma referência e poderá ser ajustado no item.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={fonte} onValueChange={(value) => setFonte(value as FonteReferencia)}>
            <SelectTrigger aria-label="Fonte"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sinapi">SINAPI</SelectItem>
              <SelectItem value="sicro">SICRO</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={(value) => setTipo(value as TipoReferencia)}>
            <SelectTrigger aria-label="Tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="composicao">Composições</SelectItem>
              <SelectItem value="insumo">Insumos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger aria-label="UF"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UFS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={competencia} onValueChange={setCompetencia} disabled={carregandoCompetencias || !competencias.length}>
            <SelectTrigger aria-label="Competência">
              <SelectValue placeholder={carregandoCompetencias ? "Carregando…" : "Sem competência"} />
            </SelectTrigger>
            <SelectContent>
              {competencias.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              className="pl-9"
              placeholder="Código ou descrição"
              aria-label="Buscar referência"
            />
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Unidade</TableHead>
                <TableHead className="w-32 text-right">Referência</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || carregandoCompetencias ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={5}><Skeleton className="h-9 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-destructive">
                    Não foi possível carregar a base de referência.
                  </TableCell>
                </TableRow>
              ) : referencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <Database className="mx-auto mb-2 size-8 opacity-50" />
                    Nenhuma referência encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : referencias.map((row: any) => {
                const centavos = Number(tipo === "composicao" ? row.custo_total : row.preco_mediano);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.codigo}</TableCell>
                    <TableCell className="text-sm">{row.descricao}</TableCell>
                    <TableCell>{row.unidade}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatBRL(centavos)}</TableCell>
                    <TableCell>
                      <Button type="button" size="sm" onClick={() => escolher(row)}>Usar</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{fonte.toUpperCase()}</Badge>
          <span>{tipo === "composicao" ? "Composições" : "Insumos"}</span>
          <span>{uf}</span>
          {competencia && <span>Competência {competencia}</span>}
          <span>Até 100 resultados por busca</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
