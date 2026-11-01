"use client";

/** Botão de envio que pede confirmação antes de executar a ação do formulário. */
export default function ConfirmButton({ mensagem, children, className = "btn" }: { mensagem: string; children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(mensagem)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
