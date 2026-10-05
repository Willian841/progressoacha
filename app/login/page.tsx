"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { createClient } from "../../lib/supabase-browser";

export default function LoginPage() {
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [show,setShow] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState("");

  async function submit(e:FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error } = await createClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "/";
    } catch (err:any) {
      setError(err?.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-shell">
    <section className="auth-card">
      <div className="auth-brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div></div>
      <div className="auth-copy"><div className="eyebrow"><span className="pulse"/> ACESSO SEGURO</div><h1>Entre na sua operação.</h1><p>Continue sua prospecção, acompanhe o CRM e transforme oportunidades em vendas.</p></div>
      <form onSubmit={submit} className="auth-form">
        <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com"/></label>
        <label>Senha<div className="password"><input type={show?"text":"password"} required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha"/><button type="button" onClick={()=>setShow(!show)}>{show?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
        {error && <div className="auth-error">{error}</div>}
        <button className="primary auth-submit" disabled={loading}>{loading?"Entrando...":"Entrar"} <ArrowRight size={15}/></button>
      </form>
      <div className="auth-links"><Link href="/recuperar-senha">Esqueci minha senha</Link><span>·</span><Link href="/cadastro">Criar conta</Link></div>
      <Link className="back-home" href="/">← Voltar para o painel</Link>
    </section>
  </main>;
}
