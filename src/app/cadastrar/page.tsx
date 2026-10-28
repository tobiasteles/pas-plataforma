import AuthForm from "@/components/AuthForm";
import { cadastrar } from "@/actions/auth";
export default function Page() { return <AuthForm action={cadastrar} cadastro />; }
