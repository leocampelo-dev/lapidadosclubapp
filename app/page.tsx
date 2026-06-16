// O middleware redireciona automaticamente para /dashboard (nutri) ou /inicio (paciente)
// Esta página só aparece se o middleware falhar
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/auth/login");
}
