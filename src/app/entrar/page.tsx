import AuthForm from "@/components/AuthForm";
import { entrar } from "@/actions/auth";
export default function Page() { return <AuthForm action={entrar} />; }
