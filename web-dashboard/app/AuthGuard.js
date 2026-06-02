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

      if (pathname === "/login") {
        // If already logged in, send to home
        if (user) router.replace("/");
        return;
      }

      // For other pages, require login
      if (!user) {
        router.replace("/login");
      }
    } catch (e) {
      router.replace("/login");
    }
  }, [pathname, router]);

  return null;
}
