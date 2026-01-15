import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FaLock } from "react-icons/fa";

export default function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const dest = user.role === "admin" ? "/captura" : "/seguimiento";
      nav(dest, { replace: true });
    }
  }, [user, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await login(email, password);
      nav("/captura", { replace: true });
    } catch (e: any) {
      setErr(e.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="card w-full max-w-sm">
        <div className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <FaLock className="text-[#D32D37]" /> Iniciar sesión
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label>Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Ingresa tu correo"
            />
          </div>
          <div className="space-y-1">
            <label>Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {err && 
          <div>
            <p className="text-sm text-red-600">{err}...</p>
            <p className="mt-1 text-xs text-gray-600">
              ¿Olvidaste tu contraseña?{" "}
              <b className="font-medium text-yellow-600">
                Contacta al administrador para restablecerla
              </b>.
            </p> 
          </div>}
          <button className="w-full bg-[#D32D37] text-white hover:bg-yellow-400 hover:text-gray-900" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <div className="mt-3 text-xs text-gray-500">
          Demo: cvp@mail.com - qwerty123 / profesionalddcs@demo.com  - ProfDDCS123 / admin@demo.com - admin123 
        </div>
      </div>
    </div>
  );
}
