"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "../../lib/supabase-browser";

export default function RecoveryPage() {
  const [email,setEmail] = useState("");
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  async function submit(e:FormEvent) {
    e.preventDefault(); setLoading(true); setError(""); setMessage("");
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`
      });
      if (error) throw error;
      setMessage("Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.");
    } catch (err:any) {
      setError(err?.message || "Não foi possível enviar o e-mail.");
    } finally { setLoading(false); }
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div></div>
    <div className="auth-copy"><div className="eyebrow"><span className="pulse"/> RECUPERAÇÃO DE ACESSO</div><h1>Recupere sua senha.</h1><p>Informe seu e-mail e enviaremos um link seguro para criar uma nova senha.</p></div>
    <form onSubmit={submit} className="auth-form">
      <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com"/></label>
      {error && <div className="auth-error">{error}</div>}{message && <div className="auth-success">{message}</div>}
      <button className="primary auth-submit" disabled={loading}>{loading?"Enviando...":"Enviar link de recuperação"} <ArrowRight size={15}/></button>
    </form>
    <Link className="back-home" href="/login"><ArrowLeft size={14}/> Voltar para login</Link>
  </section></main>;
}
