"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DUMMY_USER = { username: "admin", password: "password" };

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (username === DUMMY_USER.username && password === DUMMY_USER.password) {
      localStorage.setItem("df_user", JSON.stringify({ username }));
      try {
        document.cookie = "df_auth=1; Path=/; Max-Age=3600; SameSite=Lax";
      } catch (e) {
        console.error(e);
      }
      router.push("/");
    } else {
      setError("Invalid credentials. Try username: admin / password: password");
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <form onSubmit={handleSubmit} style={{ width: 360, padding: 24, border: '1px solid #e6e6e6', borderRadius: 8, boxShadow: '0 4px 18px rgba(0,0,0,0.06)' }}>
        <h2 style={{ marginTop: 0, marginBottom: 12 }}>Sign In</h2>
        <label style={{ display: 'block', marginBottom: 8 }}>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12 }} />
        <label style={{ display: 'block', marginBottom: 8 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 12 }} />
        <button type="submit" style={{ width: '100%', padding: 10, background: '#111827', color: '#fff', border: 'none', borderRadius: 4 }}>Log in</button>
        {error && <p style={{ color: 'crimson', marginTop: 12 }}>{error}</p>}
        <p style={{ marginTop: 12, color: '#555', fontSize: 13 }}>Dummy credentials: <strong>admin</strong> / <strong>password</strong></p>
      </form>
    </div>
  );
}
