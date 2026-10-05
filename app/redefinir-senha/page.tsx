"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "../../lib/supabase-browser";

export default function ResetPasswordPage() {
  const [password,setPassword] = useState("");
  const [confirm,setConfirm] = useState("");
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  async function submit(e:FormEvent) {
    e.preventDefault(); setError(""); setMessage("");
    if(password !== confirm){ setError("As senhas não conferem."); return; }
    setLoading(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if(error) throw error;
      setMessage("Senha atualizada com sucesso. Você já pode entrar novamente.");
    } catch(err:any) {
      setError(err?.message || "Não foi possível atualizar a senha.");
    } finally { setLoading(false); }
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div></div>
    <div className="auth-copy"><div className="eyebrow"><span className="pulse"/> NOVA SENHA</div><h1>Defina uma nova senha.</h1><p>Escolha uma senha forte para proteger seu acesso ao Progresso Acha.</p></div>
    <form onSubmit={submit} className="auth-form">
      <label>Nova senha<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
      <label>Confirmar senha<input type="password" required minLength={6} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Digite novamente"/></label>
      {error && <div className="auth-error">{error}</div>}{message && <div className="auth-success">{message}</div>}
      <button className="primary auth-submit" disabled={loading}>{loading?"Atualizando...":"Salvar nova senha"} <ArrowRight size={15}/></button>
    </form>
    <Link className="back-home" href="/login">Voltar para login</Link>
  </section></main>;
}
