import { getSession } from "@/lib/auth";
import NavBar from "./NavBar";

export default async function Nav() {
  const s = await getSession();
  return <NavBar usuario={s ? { name: s.name, role: s.role } : null} />;
}
