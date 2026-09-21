import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { api } from "./api";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("email"); // "email" -> "otp"
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await api("/auth/request-otp", { method: "POST", body: { email } });
      setStep("otp");
    });

  const verify = () =>
    run(async () => {
      const data = await api("/auth/verify-otp", { method: "POST", body: { email, otp } });
      onLogin(data.user);
    });

  const googleLogin = (response) =>
    run(async () => {
      const data = await api("/auth/google", { method: "POST", body: { credential: response.credential } });
      onLogin(data.user);
    });

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", display: "grid", gap: 12, color: "#fff" }}>
      <h2>Sign in to AI Code Analyzer</h2>

      {step === "email" ? (
        <>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: 10, borderRadius: 8 }}
          />
          <button disabled={busy || !email} onClick={sendCode}>Email me a code</button>
        </>
      ) : (
        <>
          <p>We sent a 6-digit code to {email}</p>
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            style={{ padding: 10, borderRadius: 8, letterSpacing: 6 }}
          />
          <button disabled={busy || otp.length !== 6} onClick={verify}>Verify</button>
          <button type="button" onClick={() => { setStep("email"); setOtp(""); }}>Use a different email</button>
        </>
      )}

      <div style={{ textAlign: "center", opacity: 0.6 }}>or</div>
      <GoogleLogin onSuccess={googleLogin} onError={() => setError("Google sign-in failed")} />

      {error && <p style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}