"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Search, KanbanSquare, TrendingUp } from "lucide-react";
import { createClient } from "../../lib/supabase-browser";

export default function SignupPage() {
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  async function submit(e:FormEvent) {
    e.preventDefault(); setLoading(true); setError(""); setMessage("");
    const cleanName=name.trim();
    const cleanEmail=email.trim().toLowerCase();
    if(cleanName.length<2){setError("Informe seu nome para continuar.");setLoading(false);return;}\n    if(!/^\\S+@\\S+\\.\\S+$/.test(cleanEmail)){setError("Informe um e-mail válido.");setLoading(false);return;}\n    if(password.length<6){setError("A senha precisa ter pelo menos 6 caracteres.");setLoading(false);return;}
    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await createClient().auth.signUp({
        email:cleanEmail, password,
        options:{
          data:{ full_name:cleanName },
          emailRedirectTo: redirectTo,
        }
      });
      if (error) throw error;
      setMessage("Conta criada. Verifique seu e-mail para confirmar o acesso.");
    } catch (err:any) {
      setError(err?.message || "Não foi possível criar sua conta.");
    } finally { setLoading(false); }
  }

  return <main className="auth-shell">
    <div className="auth-layout">
      <aside className="auth-showcase">
        <div className="showcase-orbit orbit-one"/>
        <div className="showcase-orbit orbit-two"/>
        <div className="showcase-content">
          <span className="showcase-badge"><Sparkles size={12}/> COMECE A PROSPECTAR</span>
          <h2>Seu próximo cliente<br/><em>pode estar aqui.</em></h2>
          <p>Descubra empresas, salve oportunidades e acompanhe cada contato até a venda.</p>
          <div className="showcase-stats">
            <div><Search size={15}/><strong>Descubra</strong><span>novas empresas</span></div>
            <div><KanbanSquare size={15}/><strong>Conduza</strong><span>seu pipeline</span></div>
            <div><TrendingUp size={15}/><strong>Cresça</strong><span>suas vendas</span></div>
          </div>
          <div className="showcase-quote"><span>✓</span><div><b>Comece grátis.</b><small>Crie sua conta em poucos segundos.</small></div></div>
        </div>
      </aside>
      <section className="auth-card">
    <div className="auth-brand"><div className="logo"><Sparkles size={17}/></div><div><b>Progresso</b><span>ACHA</span></div></div>
    <div className="auth-copy"><div className="eyebrow"><span className="pulse"/> COMECE AGORA</div><h1>Crie sua conta.</h1><p>Tenha seu espaço para buscar leads, organizar contatos e acompanhar vendas.</p></div>
    <form onSubmit={submit} className="auth-form">
      <label>Nome<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Seu nome"/></label>
      <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@empresa.com"/></label>
      <label>Senha<input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
      {error && <div className="auth-error">{error}</div>}{message && <div className="auth-success">{message}</div>}
      <button className="primary auth-submit" disabled={loading}>{loading?"Criando...":"Criar minha conta"} <ArrowRight size={15}/></button>
    </form>
    <div className="social-proof"><div className="social-proof-head"><div><span className="proof-kicker">EXPERIÊNCIA PROGRESSO ACHA</span><strong>Feito para quem quer prospectar mais.</strong></div><div className="proof-rating">★★★★★<small>Exemplos demonstrativos</small></div></div><div className="testimonial-grid"><article><p>“Uma forma muito mais organizada de transformar pesquisa em oportunidades comerciais.”</p><span>Empreendedor • exemplo</span></article><article><p>“O funil ajuda a não perder o timing de cada contato e deixa a operação muito mais clara.”</p><span>Profissional de vendas • exemplo</span></article></div></div><div className="auth-links"><span>Já tem conta?</span><Link href="/login">Entrar</Link></div>
      </section>\n    </div>\n  </main>;
}
