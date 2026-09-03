import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const metadata = {
  title: "Entrar",
};

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_rgba(0,224,84,0.08)_0%,_transparent_55%)]">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
