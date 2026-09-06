import { SignupForm } from "@/components/SignupForm";

export const metadata = {
  title: "Registro",
};

export default function SignupPage() {
  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_rgba(124,156,255,0.22)_0%,_transparent_58%)]">
      <SignupForm />
    </div>
  );
}
