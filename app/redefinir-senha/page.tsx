"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { createClient } from "../../lib/supabase-browser";

export default function ResetPasswordPage() {
  const [password,setPassword] = useState("");
  const [confirm,setConfirm] = useState("");
  const [loading,setLoading] = useState(false);
  const [checking,setChecking] = useState(true);
  const [ready,setReady] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        // Links de recuperação podem chegar com um código PKCE. Troque-o
        // por uma sessão antes de permitir a alteração da senha.
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          url.searchParams.delete("code");
          window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : "") + url.hash);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (mounted) setError("O link de recuperação expirou ou não é mais válido. Solicite um novo link.");
          return;
        }
        if (mounted) setReady(true);
      } catch (err:any) {
        if (mounted) setError(err?.message || "Não foi possível validar o link de recuperação.");
      } finally {
        if (mounted) setChecking(false);
      }
    })();

    return () => { mounted = false; };
  }, []);

  async function submit(e:FormEvent) {
    e.preventDefault(); setError(""); setMessage("");
    if(password.length > 128){ setError("A senha deve ter no máximo 128 caracteres."); return; }
    if(password.length < 6){ setError("A senha precisa ter pelo menos 6 caracteres."); return; }
    if(password !== confirm){ setError("As senhas não conferem."); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if(error) throw error;
      await supabase.auth.signOut();
      setReady(false);
      setMessage("Senha atualizada com sucesso. Agora entre novamente com sua nova senha.");
    } catch(err:any) {
      setError(err?.message || "Não foi possível atualizar a senha.");
    } finally { setLoading(false); }
  }

  return <main className="auth-shell"><section className="auth-card">
    <div className="auth-brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div></div>
    <div className="auth-copy"><div className="eyebrow"><span className="pulse"/> NOVA SENHA</div><h1>Defina uma nova senha.</h1><p>Escolha uma senha forte para proteger seu acesso ao Progresso Acha.</p></div>
    {checking ? <div className="auth-success">Validando seu link de recuperação...</div> : message ? <div className="auth-success">{message}</div> : ready ? <form onSubmit={submit} className="auth-form">
      <label>Nova senha<input type="password" required minLength={6} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
      <label>Confirmar senha<input type="password" required minLength={6} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Digite novamente"/></label>
      {error && <div className="auth-error">{error}</div>}
      <button className="primary auth-submit" disabled={loading}>{loading?"Atualizando...":"Salvar nova senha"} <ArrowRight size={15}/></button>
    </form> : <div className="auth-error">{error || "Não foi possível validar o link de recuperação."}</div>}
    <Link className="back-home" href="/recuperar-senha">Solicitar novo link</Link>
    <Link className="back-home" href="/login">Voltar para login</Link>
  </section></main>;
}