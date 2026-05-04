"use client";

import { useState, useEffect, useCallback } from "react";
import { Recipe } from "@/types/recipe";
import { loadRecipes as getRecipesList, RECIPE_CHANGE_EVENT } from "@/lib/recipeStore";
import { RecipeCard } from "./RecipeCard";

interface RecipePanelProps {
  className?: string;
  onRecipeSelect: (recipe: Recipe) => void;
}

export function RecipePanel({ className, onRecipeSelect }: RecipePanelProps) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const loadRecipes = useCallback(() => {
    try {
      const data = getRecipesList();
      setRecipes(data);
    } catch (error) {
      console.error("加载菜谱失败:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecipes();
    const handleRecipeChange = () => loadRecipes();
    window.addEventListener(RECIPE_CHANGE_EVENT, handleRecipeChange);
    return () => window.removeEventListener(RECIPE_CHANGE_EVENT, handleRecipeChange);
  }, [loadRecipes]);

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={className} style={{
      display: "flex", flexDirection: "column", background: "var(--bg)", height: "100%",
    }}>
      <header style={{
        flexShrink: 0, padding: "14px 16px",
        background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>👨‍🍳</div>
          <div>
            <h2 style={{
              fontSize: 14, fontWeight: 700, color: "var(--text)",
              fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
            }}>菜谱面板</h2>
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{recipes.length} 道菜谱</p>
          </div>
        </div>
      </header>

      <div style={{ flexShrink: 0, padding: "8px 16px" }}>
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, color: "var(--text-placeholder)", pointerEvents: "none",
          }}>🔍</span>
          <input
            type="text"
            placeholder="搜索菜谱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px 10px 36px",
              background: "var(--bg)", border: "none", borderRadius: 12,
              boxShadow: "var(--shadow-inset-sm)",
              fontSize: 14, color: "var(--text)", outline: "none",
              transition: "all 0.25s ease",
            }}
            onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
            onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 16px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16,
              background: "var(--bg)", boxShadow: "var(--shadow-raised)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 12, fontSize: 24, animation: "pulse 2s ease infinite",
            }}>✨</div>
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>加载菜谱中...</p>
          </div>
        ) : filteredRecipes.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: 16 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: "var(--bg)", boxShadow: "var(--shadow-raised)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 16, fontSize: 32,
            }}>👨‍🍳</div>
            <h3 style={{
              fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4,
              fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
            }}>
              {searchQuery ? "没有找到匹配的菜谱" : "还没有菜谱"}
            </h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              {searchQuery ? "试试其他关键词" : "在对话中告诉我你想吃什么"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onClick={() => onRecipeSelect(recipe)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
