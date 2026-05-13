"use client";

import { SideNav, BottomNav } from "./ResponsiveNav";
import { ToastContainer } from "./Toast";
import { AuthProvider } from "@/hooks/useAuth";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="h-[100dvh] flex overflow-hidden" style={{ background: "var(--bg)" }}>
        <SideNav />
        <main className="flex-1 flex flex-col min-w-0 h-full">
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
          <BottomNav />
        </main>
        <ToastContainer />
      </div>
    </AuthProvider>
  );
}
