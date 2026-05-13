"use client";

import { useState } from "react";
import { Recipe } from "@/types/recipe";

interface MultiRecipeSaveProps {
  recipes: Recipe[];
  onConfirm: (selectedRecipes: Recipe[]) => void;
  onCancel: () => void;
}

export function MultiRecipeSave({ recipes, onConfirm, onCancel }: MultiRecipeSaveProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(recipes.map(r => r.id)));
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    const selectedRecipes = recipes.filter(r => selected.has(r.id));
    if (selectedRecipes.length === 0) return;
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      onConfirm(selectedRecipes);
    } finally {
      setSaving(false);
    }
  };

  if (recipes.length === 0) return null;

  return (
    <div style={{ animation: "slideUp 0.35s ease both" }}>
      <div style={{
        background: "var(--bg)", borderRadius: 20,
        boxShadow: "var(--shadow-raised)", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, boxShadow: "var(--shadow-accent)",
            }}>
              <span style={{ color: "#fff" }}>📖</span>
            </div>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>保存菜谱</h3>
              <p style={{ fontSize: 10, color: "var(--text-muted)" }}>共 {recipes.length} 道</p>
            </div>
          </div>
          <button onClick={onCancel} style={{
            fontSize: 12, color: "var(--text-muted)", background: "none", border: "none",
            cursor: "pointer", padding: "4px 8px", borderRadius: 8, transition: "all 0.25s ease",
          }}>取消</button>
        </div>

        {/* Recipe list */}
        <div style={{ padding: "8px 12px", maxHeight: 200, overflowY: "auto" }}>
          {recipes.map(recipe => (
            <button
              key={recipe.id}
              onClick={() => toggle(recipe.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px", borderRadius: 12, marginBottom: 4,
                background: "var(--bg)", border: "none", cursor: "pointer", textAlign: "left",
                boxShadow: selected.has(recipe.id) ? "var(--shadow-inset-sm)" : "var(--shadow-raised-xs)",
                transition: "all 0.25s ease",
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 6,
                background: selected.has(recipe.id) ? "var(--accent)" : "var(--bg)",
                boxShadow: selected.has(recipe.id) ? "var(--shadow-accent)" : "var(--shadow-inset-sm)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, color: "#fff", flexShrink: 0, transition: "all 0.25s ease",
              }}>
                {selected.has(recipe.id) && "✓"}
              </div>
              <span style={{
                fontSize: 13, fontWeight: 500, flex: 1, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap",
                color: selected.has(recipe.id) ? "var(--accent)" : "var(--text-secondary)",
              }}>
                {recipe.title}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setSelected(new Set(recipes.map(r => r.id)))}
            style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            全选
          </button>
          <button onClick={() => setSelected(new Set())}
            style={{ fontSize: 11, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            全不选
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleConfirm}
            disabled={saving || selected.size === 0}
            style={{
              padding: "8px 20px", borderRadius: 12,
              background: "var(--accent)", color: "#fff",
              fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-accent)", transition: "all 0.25s ease",
              opacity: saving || selected.size === 0 ? 0.4 : 1,
            }}
          >
            {saving ? "保存中..." : `保存 ${selected.size} 道`}
          </button>
        </div>
      </div>
    </div>
  );
}
