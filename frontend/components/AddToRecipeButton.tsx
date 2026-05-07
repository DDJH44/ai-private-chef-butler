"use client";

import { useState } from "react";
import { addRecipe } from "@/lib/recipeStore";
import { parseRecipeFromMessage } from "@/lib/recipeParser";

interface AddToRecipeButtonProps {
  messageContent: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function AddToRecipeButton({ messageContent, onSuccess, onError }: AddToRecipeButtonProps) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (adding || added) return;
    setAdding(true); setError(null);
    try {
      const recipeData = parseRecipeFromMessage(messageContent);
      if (!recipeData || !recipeData.title) throw new Error("无法识别菜谱信息");
      const newRecipe = await addRecipe({
        title: recipeData.title, content: recipeData.content || messageContent,
        imageUrl: recipeData.imageUrl, difficulty: recipeData.difficulty, cookingTime: recipeData.cookingTime,
        ingredients: recipeData.ingredients, seasonings: recipeData.seasonings, steps: recipeData.steps,
        score: recipeData.score, reason: recipeData.reason, isExpanded: false
      });
      if (!newRecipe) throw new Error("保存失败");
      setAdded(true); onSuccess?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "添加失败";
      setError(errorMessage); onError?.(errorMessage);
    } finally { setAdding(false); if (added) setTimeout(() => setAdded(false), 3000); }
  };

  const getStatusText = () => { if (adding) return "保存中..."; if (added) return "已保存"; return "保存到菜谱栏"; };
  const getIcon = () => { if (adding) return "⏳"; if (added) return "✓"; if (error) return "⚠"; return "📖"; };
  const getColors = () => {
    if (error) return { bg: "var(--bg)", color: "var(--rose)", shadow: "var(--shadow-raised-sm)" };
    if (added) return { bg: "var(--bg)", color: "var(--green)", shadow: "var(--shadow-raised-sm)" };
    return { bg: "var(--bg)", color: "var(--accent)", shadow: "var(--shadow-raised-sm)" };
  };

  const colors = getColors();

  return (
    <div style={{ marginTop: 12 }}>
      <button onClick={handleAdd} disabled={adding || added}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "10px 16px", borderRadius: 12,
          background: colors.bg, color: colors.color,
          fontSize: 14, fontWeight: 500, border: "none",
          cursor: adding || added ? "not-allowed" : "pointer",
          boxShadow: colors.shadow, transition: "all 0.25s ease",
          opacity: adding || added ? 0.7 : 1,
        }}
        onMouseDown={e => { if (!adding && !added) (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
        onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = colors.shadow; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = colors.shadow; }}
        title={error ? error : "将此菜谱保存到菜谱栏"}>
        {getIcon()}<span>{getStatusText()}</span>
      </button>
      {error && <p style={{ marginTop: 8, fontSize: 12, color: "var(--rose)", textAlign: "center" }}>{error}</p>}
    </div>
  );
}

export default AddToRecipeButton;
