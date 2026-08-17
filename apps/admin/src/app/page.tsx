"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../lib/auth-context";

export default function AdminRoot() {
  const { user, claims, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user && claims ? "/studio" : "/login");
  }, [loading, user, claims, router]);

  return null;
}
