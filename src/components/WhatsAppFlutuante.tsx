import { MessageCircle } from "lucide-react";
import { CONTATO } from "@/lib/site";

/** Botão fixo só no celular. Aparece apenas se NEXT_PUBLIC_WHATSAPP estiver preenchida. */
export default function WhatsAppFlutuante() {
  if (!CONTATO.whatsapp) return null;
  const href = `https://wa.me/${CONTATO.whatsapp}?text=${encodeURIComponent("Olá! Tenho uma dúvida sobre o Triênio.")}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label="Falar com a gente no WhatsApp"
      className="fixed bottom-4 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#1FA855] text-white shadow-elevado transition-transform active:scale-95 md:hidden">
      <MessageCircle className="h-7 w-7" aria-hidden />
    </a>
  );
}
