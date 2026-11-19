import Link from "next/link";
import { focusRing } from "@/lib/ui";

/** No platforms saved: everything shows; say why and where to fix it (FIL-I60-4). */
export const NoPlatformsNotice = () => (
  <p className="para-ti-notice" role="status">
    Ves todo lo que hay en México. <Link href="/perfil" className={`font-medium text-paper underline decoration-white/30 underline-offset-4 ${focusRing}`}>Elige tus plataformas</Link> y te mostramos solo lo que puedes ver.
  </p>
);

/** Cold start: ordered by what is best rated until there are enough ratings (FIL-I60-3). */
export const ColdStartNotice = () => (
  <p className="para-ti-notice" role="status">
    Por ahora va primero lo mejor valorado. Califica lo que ves y Para ti aprende tu gusto.
  </p>
);
