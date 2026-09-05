import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_rgba(124,156,255,0.10)_0%,_transparent_55%)]">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
