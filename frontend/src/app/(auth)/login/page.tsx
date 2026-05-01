"use client";

import { useState, useEffect } from "react";
import { signIn, confirmSignIn, signOut, getCurrentUser } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { COGNITO_PASSWORD_HINT, validateCognitoPassword } from "@/lib/passwordPolicy";

function isUserAlreadyAuthenticatedError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err as { name: string }).name === "UserAlreadyAuthenticatedException"
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [missingAttrs, setMissingAttrs] = useState<string[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"credentials" | "newPassword">("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(() => {
        if (!cancelled) router.replace("/bots");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [router]);

  function applySignInResult(
    out: Awaited<ReturnType<typeof signIn>>
  ): "done" | "newPassword" | "unsupported" {
    if (out.isSignedIn) {
      router.push("/bots");
      return "done";
    }
    const step = out.nextStep?.signInStep;
    if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
      const missing = out.nextStep.missingAttributes ?? [];
      setMissingAttrs(missing);
      const initial: Record<string, string> = {};
      for (const k of missing) initial[k] = "";
      setAttrValues(initial);
      setNewPassword("");
      setConfirmNewPassword("");
      setPhase("newPassword");
      return "newPassword";
    }
    return "unsupported";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      let out: Awaited<ReturnType<typeof signIn>>;
      try {
        out = await signIn({ username: email, password });
      } catch (err) {
        if (isUserAlreadyAuthenticatedError(err)) {
          await signOut();
          out = await signIn({ username: email, password });
        } else {
          throw err;
        }
      }
      const result = applySignInResult(out);
      if (result === "unsupported") {
        setError("Este inicio de sesión requiere un paso adicional que aún no está soportado en la app.");
      }
    } catch (err) {
      setError((err as Error).message ?? "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmNewPassword) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    const pwdErr = validateCognitoPassword(newPassword);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    for (const k of missingAttrs) {
      if (!attrValues[k]?.trim()) {
        setError(`Completa el campo: ${k}`);
        return;
      }
    }
    setLoading(true);
    try {
      const userAttributes =
        missingAttrs.length > 0
          ? Object.fromEntries(missingAttrs.map((k) => [k, attrValues[k].trim()]))
          : undefined;
      const out = await confirmSignIn({
        challengeResponse: newPassword,
        ...(userAttributes && Object.keys(userAttributes).length > 0
          ? { options: { userAttributes } }
          : {}),
      });
      if (out.isSignedIn) {
        router.push("/bots");
        return;
      }
      setError("No se pudo completar el cambio de contraseña. Intenta de nuevo.");
    } catch (err) {
      setError((err as Error).message ?? "Error al establecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  if (phase === "newPassword") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Nueva contraseña</h2>
        <p className="text-sm text-gray-500 mb-6">
          Tu cuenta requiere definir una contraseña permanente antes de continuar.
        </p>

        <form onSubmit={handleNewPasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Nueva contraseña
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">{COGNITO_PASSWORD_HINT}</p>
          </div>
          <div>
            <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              id="confirmNewPassword"
              type="password"
              required
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {missingAttrs.map((key) => (
            <div key={key}>
              <label htmlFor={`attr-${key}`} className="block text-sm font-medium text-gray-700 mb-1">
                {key}
              </label>
              <input
                id={`attr-${key}`}
                type="text"
                required
                value={attrValues[key] ?? ""}
                onChange={(e) =>
                  setAttrValues((prev) => ({
                    ...prev,
                    [key]: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          ))}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={async () => {
                setError("");
                setNewPassword("");
                setConfirmNewPassword("");
                try {
                  await signOut();
                } catch {
                  /* ignore */
                }
                setPhase("credentials");
              }}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
                loading
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
              )}
            >
              {loading ? "Guardando..." : "Continuar"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Iniciar sesión</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="tu@empresa.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors",
            loading
              ? "bg-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
          )}
        >
          {loading ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="text-indigo-600 hover:underline font-medium">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
