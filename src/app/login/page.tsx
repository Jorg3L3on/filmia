import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";
import { AuthScreenSkeleton } from "@/components/PageSkeletons";

export const metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthScreenSkeleton label="Cargando entrada" />}>
      <LoginForm />
    </Suspense>
  );
}
