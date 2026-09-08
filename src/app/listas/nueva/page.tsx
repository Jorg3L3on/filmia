import type { Metadata } from "next";
import { ListForm } from "@/components/ListForm";
import { AUTH_PAGE_DYNAMIC } from "@/lib/rendering";

export const dynamic = AUTH_PAGE_DYNAMIC;

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
