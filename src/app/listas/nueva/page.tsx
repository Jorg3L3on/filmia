import type { Metadata } from "next";
import { ListForm } from "@/components/ListForm";

export const metadata: Metadata = {
  title: "Nueva lista",
};

export default function NewListPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[#00e054]">Alta</p>
        <h1 className="font-serif text-4xl text-white">Nueva lista</h1>
      </div>
      <ListForm />
    </div>
  );
}
