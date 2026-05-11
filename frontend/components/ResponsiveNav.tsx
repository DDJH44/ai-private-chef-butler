"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { loadRecipes, RECIPE_CHANGE_EVENT } from "@/lib/recipeStore";

const sidebarItems = [
  { id: "chat", icon: "💬", label: "对话", href: "/" },
  { id: "recipes", icon: "📖", label: "菜谱", href: "/recipes" },
  { id: "nutrition", icon: "📊", label: "饮食", href: "/nutrition" },
  { id: "meal-plan", icon: "📅", label: "膳食", href: "/meal-plan" },
  { id: "shopping-list", icon: "🛒", label: "购物清单", href: "/shopping-list" },
  { id: "fridge", icon: "🧊", label: "冰箱", href: "/fridge" },
  { id: "history", icon: "🕐", label: "历史", href: "/history" },
  { id: "preferences", icon: "⚙️", label: "偏好", href: "/preferences" },
];

const bottomItems = [
  { id: "chat", icon: "💬", label: "对话", href: "/" },
  { id: "recipes", icon: "📖", label: "菜谱", href: "/recipes" },
  { id: "nutrition", icon: "📊", label: "饮食", href: "/nutrition" },
  { id: "meal-plan", icon: "📅", label: "膳食", href: "/meal-plan" },
  { id: "shopping-list", icon: "🛒", label: "清单", href: "/shopping-list" },
  { id: "fridge", icon: "🧊", label: "冰箱", href: "/fridge" },
  { id: "history", icon: "🕐", label: "历史", href: "/history" },
  { id: "preferences", icon: "⚙️", label: "偏好", href: "/preferences" },
];

export function SideNav() {
  const pathname = usePathname();
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    (async () => { const r = await loadRecipes(); setRecipeCount(r.length); })();
    const update = async () => { const r = await loadRecipes(); setRecipeCount(r.length); };
    window.addEventListener(RECIPE_CHANGE_EVENT, update);
    return () => window.removeEventListener(RECIPE_CHANGE_EVENT, update);
  }, []);

  const isActive = useMemo(() => {
    return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  }, [pathname]);

  return (
    <aside className="hidden lg:flex flex-col flex-shrink-0 h-full overflow-hidden"
      style={{ width: 220, background: "var(--bg)", padding: "24px 16px 20px" }}>
      {/* Brand */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
        <div style={{
          width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, borderRadius: 16, marginBottom: 12,
          background: "var(--bg)", boxShadow: "var(--shadow-raised)",
        }}>👨‍🍳</div>
        <div style={{
          fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
          fontWeight: 700, fontSize: 16, color: "var(--text)", textAlign: "center", lineHeight: 1.3,
        }}>私人厨师</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 2, letterSpacing: 0.5 }}>
          AI Private Chef
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-none" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sidebarItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", borderRadius: 16,
                background: "var(--bg)",
                boxShadow: active ? "var(--shadow-inset)" : "var(--shadow-raised-sm)",
                cursor: "pointer", transition: "all 0.25s ease",
                whiteSpace: "nowrap", textDecoration: "none",
                fontSize: 13, fontWeight: active ? 500 : 400,
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <span style={{ fontSize: 18, width: 24, textAlign: "center", lineHeight: 1 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "recipes" && recipeCount > 0 && (
                <span style={{
                  marginLeft: "auto", fontSize: 10, fontWeight: 700,
                  minWidth: 20, height: 18, borderRadius: 999,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 6px",
                  background: active ? "var(--accent)" : "var(--bg-dark)",
                  color: active ? "#fff" : "var(--text-muted)",
                }}>
                  {recipeCount > 99 ? "99+" : recipeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    (async () => { const r = await loadRecipes(); setRecipeCount(r.length); })();
    const update = async () => { const r = await loadRecipes(); setRecipeCount(r.length); };
    window.addEventListener(RECIPE_CHANGE_EVENT, update);
    return () => window.removeEventListener(RECIPE_CHANGE_EVENT, update);
  }, []);

  const isActive = useMemo(() => {
    return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  }, [pathname]);

  return (
    <nav className="lg:hidden flex items-center justify-around safe-area-bottom"
      style={{ background: "var(--bg)", boxShadow: "0 -4px 16px #c8ccd1, 0 -1px 4px #ffffff", flexShrink: 0 }}>
      {bottomItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "10px 6px", minWidth: 0,
              textDecoration: "none", position: "relative",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
            <span style={{
              fontSize: 9, marginTop: 3, lineHeight: 1,
              color: active ? "var(--accent)" : "var(--text-muted)",
              fontWeight: active ? 600 : 400,
            }}>{item.label}</span>
            {item.id === "recipes" && recipeCount > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 2,
                fontSize: 8, fontWeight: 700, minWidth: 14, height: 14,
                borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--accent)", color: "#fff", padding: "0 3px",
              }}>
                {recipeCount > 99 ? "99+" : recipeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
