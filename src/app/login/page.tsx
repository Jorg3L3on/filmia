import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { isGoogleSignInEnabled } from "@/lib/auth/google";
import { AuthScreenSkeleton } from "@/components/PageSkeletons";

export const metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthScreenSkeleton label="Cargando entrada" />}>
      <LoginForm googleEnabled={isGoogleSignInEnabled()} />
    </Suspense>
  );
}
