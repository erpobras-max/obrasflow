import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Package, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client.custom";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface EstoqueObraProps {
  obraId: string;
}

interface EstoqueItem {
  id: string;
  saldo: number;
  material: {
    id: string;
    codigo: string;
    descricao: string;
    unidade: string;
    estoque_min: number;
  } | null;
}

export function EstoqueObra({ obraId }: EstoqueObraProps) {
  const [busca, setBusca] = useState("");

  const { data: estoque, isLoading } = useQuery({
    queryKey: ["estoque-obra", obraId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_obra")
        .select(`
          id,
          saldo,
          material:materiais(id, codigo, descricao, unidade, estoque_min)
        `)
        .eq("obra_id", obraId);

      if (error) throw error;
      return (data ?? []) as unknown as EstoqueItem[];
    },
  });

  const filtrados = useMemo(() => {
    if (!estoque) return [];
    return estoque.filter((item) => {
      if (!item.material) return false;
      const term = busca.toLowerCase().trim();
      return (
        item.material.descricao.toLowerCase().includes(term) ||
        item.material.codigo.toLowerCase().includes(term)
      );
    });
  }, [estoque, busca]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 max-w-sm">
        <Search className="size-4 text-muted-foreground shrink-0" />
        <Input
          placeholder="Buscar material..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Saldo Atual</TableHead>
              <TableHead className="text-right">Estoque Mínimo</TableHead>
              <TableHead className="w-32 text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Package className="size-8 mx-auto mb-2 opacity-50" />
                  Nenhum saldo em estoque nesta obra
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((item) => {
                if (!item.material) return null;
                const saldo = Number(item.saldo);
                const min = Number(item.material.estoque_min || 0);

                let statusLabel = "Normal";
                let statusBadge = "bg-green-100 text-green-800 hover:bg-green-100/80";

                if (saldo === 0) {
                  statusLabel = "Zerado";
                  statusBadge = "bg-red-100 text-red-800 hover:bg-red-100/80";
                } else if (saldo <= min) {
                  statusLabel = "Baixo";
                  statusBadge = "bg-amber-100 text-amber-800 hover:bg-amber-100/80";
                }

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">{item.material.codigo}</TableCell>
                    <TableCell className="font-medium">{item.material.descricao}</TableCell>
                    <TableCell>{item.material.unidade}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {saldo.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {min.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={statusBadge}>{statusLabel}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
