"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AuthGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Only run client-side
    try {
      const raw = localStorage.getItem("df_user");
      const user = raw ? JSON.parse(raw) : null;

      // helper to read cookie
      function getCookie(name) {
        const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
        return v ? v.pop() : null;
      }

      const token = getCookie("df_auth_v3");
      const expRaw = localStorage.getItem("df_auth_exp");
      const exp = expRaw ? Number(expRaw) : null;
      const valid = token && (!exp || exp > Date.now());

      if (pathname === "/login") {
        // If already logged in and session valid, send to home
        if (user && valid) router.replace("/");
        return;
      }

      // For other pages, require login and valid session
      if (!user || !valid) {
        localStorage.removeItem("df_user");
        localStorage.removeItem("df_auth_exp");
        router.replace("/login");
      }
    } catch (e) {
      router.replace("/login");
    }
  }, [pathname, router]);

  return null;
}
