import { Suspense } from "react";
import { AuthScreenSkeleton } from "@/components/PageSkeletons";
import { SignupForm } from "@/components/SignupForm";
import { isGoogleSignInEnabled } from "@/lib/auth/google";

export const metadata = {
  title: "Registro",
};

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthScreenSkeleton label="Cargando registro" />}>
      <SignupForm googleEnabled={isGoogleSignInEnabled()} />
    </Suspense>
  );
}
