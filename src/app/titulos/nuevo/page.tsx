import { redirect } from "next/navigation";

export const metadata = {
  title: "Buscar",
} as const;

export default function NewTitlePage() {
  redirect("/buscar");
}
