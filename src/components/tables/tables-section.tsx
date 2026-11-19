"use client";

import { Table2 } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddTableForm } from "./add-table-form";
import { TableCard, type TableQrView } from "./table-card";

export function TablesSection({
  tables,
  canManage,
}: {
  tables: TableQrView[];
  canManage: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Mesas</h2>
          <p className="text-sm text-muted-foreground">
            Gestão de mesas, códigos QR e contas
          </p>
        </div>
        {canManage && <AddTableForm />}
      </div>

      {tables.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Table2 className="h-4 w-4" /> Sem mesas
            </CardTitle>
            <CardDescription>
              {canManage
                ? "Crie a primeira mesa para gerar o seu código QR de pagamento."
                : "Ainda não há mesas criadas para este restaurante."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((t) => (
            <TableCard key={t.id} table={t} canManage={canManage} />
          ))}
        </div>
      )}
    </section>
  );
}
