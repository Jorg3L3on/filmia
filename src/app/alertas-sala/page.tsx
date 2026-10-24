import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToastBench } from "@/components/toast/ToastBench";
import { isToastBenchEnabled } from "@/lib/toast";

export const metadata: Metadata = {
  title: "Banco de alertas",
  robots: { index: false, follow: false },
};

const AlertasSalaPage = () => {
  if (!isToastBenchEnabled()) {
    notFound();
  }
  return <ToastBench />;
};

export default AlertasSalaPage;
