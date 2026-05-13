"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [token, isLoading, router]);

  if (isLoading) {
    return (
      <div className="empty-state pt-16">
        <div style={{ fontSize: 16, color: "var(--text-muted)" }}>加载中...</div>
      </div>
    );
  }

  if (!token) return null;

  return <>{children}</>;
}
