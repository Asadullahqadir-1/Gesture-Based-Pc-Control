"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Header() {
  const [user, setUser] = useState(null);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("df_user");
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {
      setUser(null);
    }
  }, []);

  function logout() {
    localStorage.removeItem("df_user");
    // remove auth cookie
    try { document.cookie = "df_auth=; Path=/; Max-Age=0; SameSite=Lax"; } catch(e) {}
    setUser(null);
    router.push("/login");
  }

  return (
    <header style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid #eee'}}>
      <div style={{fontWeight:700}}>DriveFlow</div>
      <nav>
        {user ? (
          <div style={{display:'flex', gap:12, alignItems:'center'}}>
            <span style={{color:'#333'}}>Hello, {user.username}</span>
            <button onClick={logout} style={{padding:'6px 10px', borderRadius:6, border:'1px solid #ddd', background:'#fff'}}>Logout</button>
          </div>
        ) : (
          <Link href="/login">Log in</Link>
        )}
      </nav>
    </header>
  );
}
