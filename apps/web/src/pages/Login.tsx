import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, displayName);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-sm p-8">
        <h1 className="font-display text-2xl text-gold-400">The Hunt for the Tickets</h1>
        <p className="mt-1 text-sm text-slate-400">
          {mode === "login" ? "Sign in to continue your adventure." : "The first account created becomes the Game Master (Admin)."}
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Display name</label>
              <input
                className="w-full rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-gold-500"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              className="w-full rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-gold-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              className="w-full rounded-none border border-ink-600 bg-ink-800 px-3 py-2 text-sm outline-none focus:border-gold-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          className="mt-4 text-xs text-slate-400 underline decoration-dotted hover:text-gold-400"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
