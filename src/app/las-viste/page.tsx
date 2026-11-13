import { redirect } from "next/navigation";
import { TANDA_PATH } from "@/lib/juegos/core";

/** «¿Las viste?» was replaced by La tanda (FIL-I50-8): old links and notifications land there. */
export default function LasVistePage() {
  redirect(TANDA_PATH);
}
