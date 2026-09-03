import { SignupForm } from "@/components/SignupForm";

export const metadata = {
  title: "Registro",
};

export default function SignupPage() {
  return (
    <div className="min-h-[80vh] bg-[radial-gradient(ellipse_at_top,_rgba(0,224,84,0.08)_0%,_transparent_55%)]">
      <SignupForm />
    </div>
  );
}
