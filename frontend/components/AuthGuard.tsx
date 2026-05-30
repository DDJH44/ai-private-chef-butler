"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loading } from "@/components/Loading";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login?reason=unauthorized");
    }
  }, [token, isLoading, router]);

  if (isLoading) {
    return <Loading text="加载中..." fullPage />;
  }

  if (!token) return null;

  return <>{children}</>;
}
