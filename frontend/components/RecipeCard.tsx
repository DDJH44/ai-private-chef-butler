"use client";

import { Recipe } from "@/types/recipe";

function formatContent(content: string): string {
  return content.replace(
    /\[SAVE_RECIPE_START\]([\s\S]*?)\[SAVE_RECIPE_END\]/g,
    (_: string, block: string) => {
      let formatted = "";
      const lines = block.trim().split("\n");
      for (const line of lines) {
        const colonIdx = line.indexOf("：");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx);
        const val = line.slice(colonIdx + 1).trim();
        if (!val) continue;
        switch (key) {
          case "标题": formatted += `**${val}**  `; break;
          case "评分": formatted += `⭐${val}  `; break;
          case "难度": formatted += `🔥${val}  `; break;
          case "时间": formatted += `⏱${val}  `; break;
          case "食材": formatted += `🥬${val.replace(/，/g, "、")}`; break;
          case "步骤": formatted += `📝${val.replace(/[；;]/g, " → ")}`; break;
          case "视频": break;
        }
      }
      return formatted.trim();
    }
  ).trim();
}

interface RecipeCardProps {
  recipe: Recipe;
  onClick?: () => void;
  className?: string;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

export function RecipeCard({ recipe, onClick, className, selectMode, selected, onToggleSelect }: RecipeCardProps) {
  const difficultyColor = (d?: string) => {
    switch (d) {
      case "简单": return "var(--green)";
      case "中等": return "var(--golden)";
      case "困难": return "var(--rose)";
      default: return "var(--accent)";
    }
  };

  const scoreBar = (s: number) => {
    if (s >= 70) return "var(--green)";
    if (s >= 40) return "var(--golden)";
    return "var(--text-muted)";
  };

  return (
    <div
      onClick={selectMode ? onToggleSelect : onClick}
      className={className}
      style={{
        background: "var(--bg)",
        borderRadius: 20,
        boxShadow: selected ? "var(--shadow-accent)" : "var(--shadow-raised)",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.25s ease",
        position: "relative",
        border: selected ? "2px solid var(--accent)" : "none",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-lg)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
    >
      {selectMode && (
        <div style={{
          position: "absolute", top: 10, right: 10, zIndex: 10,
          width: 24, height: 24, borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: selected ? "var(--accent)" : "var(--bg)",
          boxShadow: "var(--shadow-raised-sm)",
          color: selected ? "#fff" : "transparent", fontSize: 12, fontWeight: 700,
          transition: "all 0.2s ease",
        }}>✓</div>
      )}
      {recipe.imageUrl && (
        <div style={{ position: "relative", height: 180, overflow: "hidden" }}>
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s ease" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
          <h3 style={{
            fontSize: 15, fontWeight: 600, color: "var(--text)", lineHeight: 1.4,
            fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
          }}>
            {recipe.title}
          </h3>
          {recipe.difficulty && (
            <span style={{
              fontSize: 10, padding: "3px 10px", borderRadius: 999, fontWeight: 600,
              background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
              color: difficultyColor(recipe.difficulty), flexShrink: 0,
            }}>
              {recipe.difficulty}
            </span>
          )}
        </div>

        {recipe.content && (
          <p style={{
            fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6,
            marginBottom: 12, overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          }}>
            {formatContent(recipe.content)}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--text-muted)" }}>
          {recipe.cookingTime && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12 }}>⏱</span> {recipe.cookingTime}
            </span>
          )}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 12 }}>👨‍🍳</span> {recipe.ingredients.length} 种食材
            </span>
          )}
          {recipe.videoUrl && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#fb7299" }}>
              <span style={{ fontSize: 12 }}>🎬</span> 视频
            </span>
          )}
        </div>

        {recipe.score !== undefined && recipe.score > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <div style={{
              flex: 1, height: 6, borderRadius: 999, overflow: "hidden",
              background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
            }}>
              <div style={{
                height: "100%", borderRadius: 999,
                width: `${Math.min(recipe.score * 20, 100)}%`,
                background: scoreBar(recipe.score * 20),
                transition: "width 0.6s ease",
              }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
              {recipe.score}/5
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
