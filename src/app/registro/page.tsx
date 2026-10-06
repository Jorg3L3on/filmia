import { SignupForm } from "@/components/SignupForm";
import { isGoogleSignInEnabled } from "@/lib/auth/google";

export const metadata = {
  title: "Registro",
};

export default function SignupPage() {
  return <SignupForm googleEnabled={isGoogleSignInEnabled()} />;
}
