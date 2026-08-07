"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, useEffect, type ReactNode } from "react";
import { loadRecipes, RECIPE_CHANGE_EVENT } from "@/lib/recipeStore";
import { useAuth } from "@/hooks/useAuth";
import {
  MessageCircle, BookOpen, BarChart3, Calendar, ShoppingCart,
  Snowflake, Clock, Settings, User, Sun, Moon, ChefHat, LayoutDashboard,
} from "lucide-react";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} style={{
      width: 32, height: 32,
      borderRadius: "50%",
      background: "var(--bg)",
      boxShadow: "var(--shadow-raised-sm)",
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "none", cursor: "pointer", color: "var(--text-secondary)",
    }}>
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

const navIcons: Record<string, ReactNode> = {
  chat:         <MessageCircle size={18} />,
  dashboard:    <LayoutDashboard size={18} />,
  recipes:      <BookOpen size={18} />,
  nutrition:    <BarChart3 size={18} />,
  "meal-plan":  <Calendar size={18} />,
  "shopping-list": <ShoppingCart size={18} />,
  fridge:       <Snowflake size={18} />,
  history:      <Clock size={18} />,
  preferences:  <Settings size={18} />,
  profile:      <User size={20} />,
};

const sidebarItems = [
  { id: "chat", label: "对话", href: "/" },
  { id: "dashboard", label: "概览", href: "/dashboard" },
  { id: "recipes", label: "菜谱", href: "/recipes" },
  { id: "nutrition", label: "饮食", href: "/nutrition" },
  { id: "meal-plan", label: "膳食", href: "/meal-plan" },
  { id: "shopping-list", label: "购物清单", href: "/shopping-list" },
  { id: "fridge", label: "冰箱", href: "/fridge" },
  { id: "history", label: "历史", href: "/history" },
  { id: "preferences", label: "偏好", href: "/preferences" },
];

const bottomItems = [
  { id: "chat", label: "对话", href: "/" },
  { id: "recipes", label: "菜谱", href: "/recipes" },
  { id: "nutrition", label: "饮食", href: "/nutrition" },
  { id: "meal-plan", label: "膳食", href: "/meal-plan" },
  { id: "shopping-list", label: "清单", href: "/shopping-list" },
  { id: "fridge", label: "冰箱", href: "/fridge" },
  { id: "dashboard", label: "概览", href: "/dashboard" },
  { id: "profile", label: "我的", href: "/profile" },
];

export function SideNav() {
  const pathname = usePathname();
  const { token } = useAuth();
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    (async () => { const r = await loadRecipes(); setRecipeCount(r.length); })();
    const update = async () => { const r = await loadRecipes(); setRecipeCount(r.length); };
    window.addEventListener(RECIPE_CHANGE_EVENT, update);
    return () => window.removeEventListener(RECIPE_CHANGE_EVENT, update);
  }, [token]);

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
          background: "var(--surface)", boxShadow: "var(--shadow-raised)",
        }}><ChefHat size={28} color="var(--accent)" /></div>
        <div style={{
          fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
          fontWeight: 700, fontSize: 16, color: "var(--text)", textAlign: "center", lineHeight: 1.3,
        }}>私人厨师</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", marginTop: 2, letterSpacing: 0.5 }}>
          AI Private Chef
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <Link href="/profile" style={{
            width: 32, height: 32,
            borderRadius: "50%",
            background: "var(--bg)",
            boxShadow: "var(--shadow-raised-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
            textDecoration: "none", color: "var(--text-secondary)",
          }}>
            <User size={15} />
          </Link>
          <ThemeToggle />
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
                background: active ? "var(--accent-bg)" : "var(--bg)",
                boxShadow: active ? "none" : "var(--shadow-raised-sm)",
                cursor: "pointer", transition: "var(--transition)",
                whiteSpace: "nowrap", textDecoration: "none",
                fontSize: 13, fontWeight: active ? 500 : 400,
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              <span style={{ width: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {navIcons[item.id]}
              </span>
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
  const { token } = useAuth();
  const [recipeCount, setRecipeCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    (async () => { const r = await loadRecipes(); setRecipeCount(r.length); })();
    const update = async () => { const r = await loadRecipes(); setRecipeCount(r.length); };
    window.addEventListener(RECIPE_CHANGE_EVENT, update);
    return () => window.removeEventListener(RECIPE_CHANGE_EVENT, update);
  }, [token]);

  const isActive = useMemo(() => {
    return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  }, [pathname]);

  return (
    <nav className="lg:hidden flex items-center justify-around safe-area-bottom"
      style={{ background: "var(--bg)", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)", flexShrink: 0 }}>
      {bottomItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "6px 4px", minWidth: 0, flex: 1,
              textDecoration: "none", position: "relative",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                {navIcons[item.id]}
              </span>
            <span style={{
              fontSize: 10, marginTop: 3, lineHeight: 1,
              color: active ? "var(--accent)" : "var(--text-muted)",
              fontWeight: active ? 600 : 400,
            }}>{item.label}</span>
            {item.id === "recipes" && recipeCount > 0 && (
              <span style={{
                position: "absolute", top: 2, right: "50%", transform: "translateX(14px)",
                fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
                borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--accent)", color: "#fff", padding: "0 4px",
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
