import type { Metadata } from "next";
import { ListForm } from "@/components/ListForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nueva lista",
};

export default function NewListPage() {
  return (
    <div className="mx-auto max-w-xl py-2">
      <ListForm />
    </div>
  );
}
