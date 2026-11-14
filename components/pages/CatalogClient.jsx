"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Store, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CatalogAdmin from "@/components/pages/CatalogAdmin";
import { catalogAuth, catalogClient, catalogSession, loginErrorMessage, isAccountActive } from "@/lib/catalogApi";

const EXPIRED_MSG = "Sua sessão expirou. Entre novamente.";
const goLogin = (router, expired) => {
  catalogSession.clear();
  router.replace(expired ? "/catalogo/login?sessao=expirada" : "/catalogo/login");
};

const Shell = ({ children, testId }) => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10" data-testid={testId}>
    <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white"><Store className="h-5 w-5" /></span>
        <span className="font-heading font-semibold text-slate-900">Meu catálogo</span>
      </div>
      {children}
    </div>
  </div>
);

const PasswordInput = ({ id, value, onChange, testId, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative mt-1">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} className="pr-10" data-testid={testId} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

/* ---------------- /catalogo/login ---------------- */
export const CatalogLogin = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("sessao") === "expirada") setError(EXPIRED_MSG);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Informe e-mail e senha.");
    setBusy(true); setError("");
    try {
      const { mustChangePassword } = await catalogAuth.login(email.trim(), password);
      setPassword("");
      if (mustChangePassword) return router.replace("/catalogo/trocar-senha");
      const me = await catalogAuth.me();
      if (me?.mustChangePassword) return router.replace("/catalogo/trocar-senha");
      router.replace("/catalogo/painel");
    } catch (err) {
      catalogSession.clear();
      setPassword("");
      setError(err?.noToken ? "Não foi possível entrar agora. Tente novamente em instantes." : loginErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell testId="catalog-login-page">
      <h1 className="font-heading text-xl font-bold text-slate-900">Entrar</h1>
      <p className="mt-1 text-sm text-slate-500">Acesse para gerenciar os produtos do seu catálogo.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><Label htmlFor="cl-email">E-mail</Label><Input id="cl-email" type="email" autoComplete="username" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="catalog-login-email" /></div>
        <div><Label htmlFor="cl-pass">Senha</Label><PasswordInput id="cl-pass" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" testId="catalog-login-password" /></div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" data-testid="catalog-login-error">{error}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full rounded-full bg-emerald-600 hover:bg-emerald-700" data-testid="catalog-login-submit">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Entrar
        </Button>
      </form>
    </Shell>
  );
};

/* ---------------- /catalogo/trocar-senha ---------------- */
export const CatalogChangePassword = () => {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!catalogSession.get()) return goLogin(router, false);
    catalogAuth.me()
      .then(() => setReady(true))
      .catch((e) => goLogin(router, e?.response?.status === 401));
  }, [router]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!current) return setError("Informe a senha atual (temporária).");
    if (next.length < 8) return setError("A nova senha deve ter pelo menos 8 caracteres.");
    if (next !== confirm) return setError("A confirmação não coincide com a nova senha.");
    if (next === current) return setError("A nova senha deve ser diferente da atual.");
    setBusy(true);
    try {
      await catalogAuth.changePassword(current, next);
      setCurrent(""); setNext(""); setConfirm("");
      toast.success("Senha alterada com sucesso.");
      router.replace("/catalogo/painel");
    } catch (err) {
      setCurrent(""); setNext(""); setConfirm("");
      const st = err?.response?.status;
      if (st === 401 && !/senha|password/i.test(String(err?.response?.data?.detail || ""))) return goLogin(router, true);
      setError(st === 400 || st === 401 || st === 422 ? "Senha atual incorreta ou nova senha inválida." : !err?.response ? "Erro de conexão. Tente novamente." : "Não foi possível alterar a senha.");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  return (
    <Shell testId="catalog-change-password-page">
      <h1 className="font-heading text-xl font-bold text-slate-900">Crie sua nova senha</h1>
      <p className="mt-1 text-sm text-slate-500">Por segurança, troque a senha temporária antes de continuar.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div><Label htmlFor="cp-cur">Senha atual (temporária)</Label><PasswordInput id="cp-cur" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" testId="catalog-cp-current" /></div>
        <div><Label htmlFor="cp-new">Nova senha (mín. 8 caracteres)</Label><PasswordInput id="cp-new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" testId="catalog-cp-new" /></div>
        <div><Label htmlFor="cp-conf">Confirmar nova senha</Label><PasswordInput id="cp-conf" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" testId="catalog-cp-confirm" /></div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert" data-testid="catalog-cp-error">{error}</p>}
        <Button type="submit" disabled={busy} className="h-11 w-full rounded-full bg-emerald-600 hover:bg-emerald-700" data-testid="catalog-cp-submit">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salvar nova senha
        </Button>
      </form>
    </Shell>
  );
};

/* ---------------- /catalogo/painel ---------------- */
export const CatalogPanel = () => {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!catalogSession.get()) return goLogin(router, false);
    catalogAuth.me()
      .then((a) => {
        if (!isAccountActive(a)) { catalogSession.clear(); return setError("Esta conta está desativada. Fale com o administrador."); }
        if (a?.mustChangePassword) return router.replace("/catalogo/trocar-senha");
        setMe(a);
      })
      .catch((e) => {
        const st = e?.response?.status;
        if (st === 401) return goLogin(router, true);
        setError(st === 403 || st === 404 ? "Acesso não permitido." : "Não foi possível carregar seu painel. Tente novamente.");
      });
  }, [router]);

  const onExpired = useCallback(() => goLogin(router, true), [router]);
  const logout = async () => {
    await catalogAuth.logout();
    router.replace("/catalogo/login");
  };

  if (error) {
    return (
      <Shell testId="catalog-panel-error">
        <p className="text-sm text-slate-600">{error}</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => goLogin(router, false)}>Voltar ao login</Button>
      </Shell>
    );
  }
  if (!me) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="catalog-panel-page">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"><Store className="h-4 w-4" /></span>
            <span className="truncate text-sm text-slate-600" data-testid="catalog-panel-email">{me.email}</span>
          </div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={logout} data-testid="catalog-panel-logout"><LogOut className="mr-1.5 h-4 w-4" /> Sair</Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <CatalogAdmin
          mode="client"
          api={catalogClient}
          fixedClienteId={me.clienteId || ""}
          slug={me.slug || me.clienteSlug || ""}
          onLogout={onExpired}
        />
      </main>
    </div>
  );
};
