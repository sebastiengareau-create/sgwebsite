import { obtenirInfosEntreprise } from "@/lib/config";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const { nomEntreprise } = await obtenirInfosEntreprise();
  return <LoginForm nomEntreprise={nomEntreprise} />;
}
