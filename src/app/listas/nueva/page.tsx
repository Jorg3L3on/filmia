import type { Metadata } from "next";
import { ListForm } from "@/components/ListForm";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Nueva lista",
};

export default function NewListPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        eyebrow="Alta"
        title="Nueva lista"
        description="Una colección con posters, no una fila de texto."
      />
      <ListForm />
    </div>
  );
}
