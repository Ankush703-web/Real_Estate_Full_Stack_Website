import { useState } from "react";

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("customer");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("The API is unavailable. Start the server with npm start in the server folder.");
      }
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      localStorage.setItem("gharmap-token", data.token);
      onAuthenticated(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="brand">GharMap India</p>
        <p className="eyebrow">Private property desk</p>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-copy">Sign in as a customer to explore homes or as a dealer to publish listings.</p>

        <div className="auth-tabs" role="tablist" aria-label="Account action">
          <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => setMode("login")}>Log in</button>
          <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => setMode("register")}>Register</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <fieldset className="role-picker">
            <legend>Continue as</legend>
            <label className={role === "customer" ? "is-active" : ""}>
              <input type="radio" name="role" value="customer" checked={role === "customer"} onChange={(event) => setRole(event.target.value)} />
              Customer
            </label>
            <label className={role === "dealer" ? "is-active" : ""}>
              <input type="radio" name="role" value="dealer" checked={role === "dealer"} onChange={(event) => setRole(event.target.value)} />
              Dealer
            </label>
          </fieldset>
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "register" ? 8 : undefined} autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
          {mode === "register" && <p className="field-hint">Use at least 8 characters.</p>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-btn" type="submit" disabled={busy}>{busy ? "Working..." : mode === "login" ? "Enter GharMap" : "Create account"}</button>
        </form>
      </section>
    </main>
  );
}
