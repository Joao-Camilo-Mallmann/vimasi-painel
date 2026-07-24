import { Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "../utils/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-primary-dark flex items-center justify-center px-4">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent-gold/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent-red/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img
            src="/logo.png"
            alt="Vimasi"
            className="h-14 object-contain drop-shadow-md"
          />
        </div>

        <div className="glass rounded-2xl p-8 sm:p-10 border border-white/10">
          <h1 className="text-2xl font-anton text-white tracking-widest uppercase text-center mb-2">
            ACESSO RESTRITO
          </h1>
          <p className="text-gray-400 text-sm text-center mb-8">
            Área exclusiva para administradores
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            {/* Email */}
            <div className="relative">
              <Mail
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
              <input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-red focus:border-transparent transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
              />
              <input
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-red focus:border-transparent transition-all text-sm"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-accent-red text-sm animate-fade-in-up">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full bg-accent-red hover:bg-accent-red/90 text-white font-bold py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer overflow-hidden tracking-widest uppercase text-sm"
            >
              {/* Shimmer */}
              <div className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer pointer-events-none" />
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  ENTRANDO...
                </span>
              ) : (
                "ENTRAR"
              )}
            </button>
          </form>
        </div>

        <p className="text-gray-600 text-xs text-center mt-6">
          Contas são gerenciadas pelo administrador do sistema.
        </p>
      </div>
    </div>
  );
}
