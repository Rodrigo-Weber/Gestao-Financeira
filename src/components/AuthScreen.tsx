import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, WalletCards } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Props {
  onDemo: () => void;
}

export function AuthScreen({ onDemo }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (result.error) setMessage(result.error.message);
    else if (mode === "signup") setMessage("Conta criada. Confirme seu e-mail para entrar.");
  }

  async function resetPassword() {
    if (!supabase || !email) {
      setMessage("Digite seu e-mail primeiro.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setMessage(error ? error.message : "Enviamos o link de recuperação para seu e-mail.");
  }

  return (
    <main className="auth-shell">
      <section className="auth-showcase">
        <div className="brand brand-light">
          <span className="brand-mark"><WalletCards size={22} /></span>
          <span>Weber <strong>Financeiro</strong></span>
        </div>
        <div className="auth-copy">
          <span className="eyebrow light">Controle financeiro sem complicação</span>
          <h1>Clareza para decidir.<br /><em>Liberdade para viver.</em></h1>
          <p>Veja contas, cartões e dívidas em um só lugar — e saiba exatamente quanto ainda tem no mês.</p>
          <div className="auth-metrics">
            <div><strong>1 visão</strong><span>para toda sua vida financeira</span></div>
            <div><strong>30 seg</strong><span>para registrar qualquer gasto</span></div>
          </div>
        </div>
        <div className="auth-orb auth-orb-one" />
        <div className="auth-orb auth-orb-two" />
      </section>
      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div>
            <span className="eyebrow">Bem-vindo</span>
            <h2>{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</h2>
            <p>{mode === "login" ? "Sua vida financeira organizada começa aqui." : "Leva menos de um minuto."}</p>
          </div>
          <label>E-mail<div className="input-icon"><Mail size={18} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" required /></div></label>
          <label>Senha<div className="input-icon"><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" minLength={6} required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {message && <div className="auth-message">{message}</div>}
          <button className="primary-btn full" type="submit" disabled={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"} <ArrowRight size={18} /></button>
          {mode === "login" && <button className="link-btn" type="button" onClick={resetPassword}>Esqueci minha senha</button>}
          <div className="divider"><span>ou</span></div>
          <button className="secondary-btn full" type="button" onClick={onDemo}>Explorar demonstração</button>
          <p className="auth-switch">{mode === "login" ? "Ainda não tem uma conta?" : "Já possui uma conta?"} <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Cadastre-se" : "Entrar"}</button></p>
        </form>
      </section>
    </main>
  );
}
