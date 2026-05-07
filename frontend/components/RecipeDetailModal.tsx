"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Recipe } from "@/types/recipe";
import { proxyImageUrl } from "@/lib/imageUtils";
import { generateShoppingListFromRecipes } from "@/lib/shoppingListGenerator";
import { recordView, addCookRecord, loadCookHistory } from "@/lib/historyStore";
import { deleteRecipe as deleteRecipeFromStore } from "@/lib/recipeStore";
import { showToast } from "@/components/Toast";
import { generateUUID } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
          case "标题": formatted += `### ${val}\n\n`; break;
          case "评分": formatted += `⭐ ${val}/5  `; break;
          case "难度": formatted += `🔥 ${val}  `; break;
          case "时间": formatted += `⏱ ${val}\n\n`; break;
          case "理由": formatted += `> 💡 ${val}\n\n`; break;
          case "食材": formatted += `**🥬 食材**：${val.replace(/，/g, "、")}\n\n`; break;
          case "调味料": formatted += `**🧂 调料**：${val.replace(/，/g, "、")}\n\n`; break;
          case "步骤": {
            const steps = val.split(/[；;]/).filter(Boolean);
            formatted += `**📝 步骤**\n`;
            steps.forEach((s: string, i: number) => { formatted += `${i + 1}. ${s.trim()}\n`; });
            formatted += "\n";
            break;
          }
        }
      }
      return formatted.trim();
    }
  ).trim();
}

function StarRating({ score }: { score: number }) {
  const rounded = Math.round(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize: 16, color: n <= rounded ? "var(--golden)" : "var(--text-placeholder)" }}>
          {n <= rounded ? "★" : "☆"}
        </span>
      ))}
    </div>
  );
}

const circleBtn = (): React.CSSProperties => ({
  width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 15, borderRadius: "50%", border: "none", cursor: "pointer",
  background: "var(--bg)", color: "var(--text-secondary)",
  boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
});

interface RecipeDetailModalProps { recipe: Recipe; onClose: () => void; }

export function RecipeDetailModal({ recipe, onClose }: RecipeDetailModalProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showCookModal, setShowCookModal] = useState(false);
  const [cookRating, setCookRating] = useState(5);
  const [cookNotes, setCookNotes] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (recipe) recordView(recipe.id, recipe.title); }, [recipe]);
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const scoreLabel = (s?: number) => {
    if (!s) return "";
    if (s >= 4.5) return "强烈推荐";
    if (s >= 3.5) return "值得一试";
    if (s >= 2.5) return "中规中矩";
    return "仅供参考";
  };

  const difficultyColor = (d?: string) => {
    switch (d) {
      case "简单": return "var(--green)";
      case "中等": return "var(--golden)";
      case "困难": return "var(--rose)";
      default: return "var(--accent)";
    }
  };

  const handleCopy = async () => {
    const text = recipe.steps?.join("\n\n") || recipe.content;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* noop */ }
  };

  const handlePrint = () => {
    const pw = window.open("", "_blank");
    if (pw) {
      pw.document.write(`<html><head><title>${recipe.title}</title><style>body{font-family:sans-serif;max-width:720px;margin:32px auto;padding:0 24px;line-height:1.8;color:#1F1D1A}h1{font-size:28px}h2{font-size:18px;margin:24px 0 12px}.step{display:flex;gap:12px;margin-bottom:16px;padding:14px;background:#e4e8ed;border-radius:12px;box-shadow:3px 3px 8px #c8ccd1,-3px -3px 8px #ffffff}.step-num{width:30px;height:30px;background:#6c5ce7;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}img{max-width:100%;border-radius:16px;margin:16px 0}</style></head><body>${recipe.imageUrl?`<img src="${proxyImageUrl(recipe.imageUrl)}">`:""}<h1>${recipe.title}</h1>${recipe.steps?recipe.steps.map((s,i)=>`<div class="step"><div class="step-num">${i+1}</div><div>${s}</div></div>`).join(""):`<div>${formatContent(recipe.content)}</div>`}</body></html>`);
      pw.document.close(); pw.print();
    }
  };

  const handleShare = async () => {
    if (navigator.share) { try { await navigator.share({ title: recipe.title, text: `推荐菜谱：${recipe.title}` }); } catch { handleCopy(); } }
    else { handleCopy(); }
  };

  const handleGenerateShoppingList = async () => {
    await generateShoppingListFromRecipes([recipe]);
    showToast(`已为「${recipe.title}」生成购物清单`, "success");
    router.push("/shopping-list");
  };

  const handleDelete = async () => {
    setDeleting(true);
    const deleted = await deleteRecipeFromStore(recipe.id);
    if (deleted) {
      showToast(`「${recipe.title}」已从菜谱栏移除`, "success");
      onClose();
    } else {
      showToast("删除失败，请重试", "error");
    }
    setDeleting(false);
  };

  const handleSaveCookRecord = () => {
    addCookRecord({ id: generateUUID(), recipe_id: recipe.id, recipe_name: recipe.title, cook_date: new Date().toISOString().split("T")[0], rating: cookRating, notes: cookNotes, photos: [], created_at: new Date().toISOString() });
    showToast("烹饪记录已保存", "success");
    setShowCookModal(false); setCookRating(5); setCookNotes("");
  };

  const modalStyle: React.CSSProperties = {
    position: "relative", width: "100%", maxWidth: 500,
    maxHeight: "92vh", background: "var(--bg)", borderRadius: 24,
    boxShadow: "var(--shadow-raised-lg)", overflow: "hidden",
    display: "flex", flexDirection: "column",
    animation: "slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)",
        animation: "fadeIn 0.2s ease", padding: 16,
      }}
      onClick={onClose}
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Floating top bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: 16, pointerEvents: "none",
        }}>
          <button onClick={onClose} style={{ ...circleBtn(), pointerEvents: "auto" }}
            onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
          >✕</button>
          <div style={{ display: "flex", gap: 8, pointerEvents: "auto" }}>
            <button onClick={handleCopy} style={circleBtn()}
              onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
            >{copied ? "✓" : "📋"}</button>
            <button onClick={handlePrint} style={circleBtn()}
              onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
            >🖨</button>
            <button onClick={handleShare} style={circleBtn()}
              onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
            >📤</button>
            <button onClick={() => setShowDeleteConfirm(true)} style={{ ...circleBtn(), color: "var(--rose)" }}
              onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
              onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
            >🗑</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Hero image */}
          {recipe.imageUrl ? (
            <div style={{ position: "relative", height: 220, overflow: "hidden" }}>
              <img src={proxyImageUrl(recipe.imageUrl)} alt={recipe.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--bg) 10%, transparent)" }} />
            </div>
          ) : (
            <div style={{
              height: 120, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg)", fontSize: 44, color: "var(--text-placeholder)",
            }}>
              👨‍🍳
            </div>
          )}

          {/* Content */}
          <div style={{ padding: "0 24px 16px", marginTop: recipe.imageUrl ? -40 : 0, position: "relative", zIndex: 10 }}>
            {/* Title + info */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{
                fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 8,
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                lineHeight: 1.3,
              }}>
                {recipe.title}
              </h1>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {recipe.difficulty && (
                  <span style={{
                    fontSize: 11, padding: "4px 12px", borderRadius: 999, fontWeight: 600,
                    background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
                    color: difficultyColor(recipe.difficulty),
                  }}>
                    {recipe.difficulty}
                  </span>
                )}
                {recipe.cookingTime && (
                  <span style={{
                    fontSize: 11, padding: "4px 12px", borderRadius: 999,
                    background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
                    color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <span style={{ fontSize: 11 }}>⏱</span> {recipe.cookingTime}
                  </span>
                )}
              </div>

              {recipe.score !== undefined && recipe.score > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StarRating score={recipe.score} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--golden)" }}>{recipe.score}/5</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{scoreLabel(recipe.score)}</span>
                </div>
              )}
            </div>

            {/* Past cook records */}
            {(() => {
              const pastCooks = loadCookHistory().filter(c => c.recipe_id === recipe.id);
              if (pastCooks.length === 0) return null;
              return (
                <div style={{
                  marginBottom: 24, padding: 16, borderRadius: 16,
                  background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", marginBottom: 8 }}>
                    你做过 {pastCooks.length} 次这道菜
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {pastCooks.slice(0, 3).map(cook => (
                      <div key={cook.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 2 }}>
                            {[1,2,3,4,5].map(s => (
                              <span key={s} style={{ fontSize: 11, color: s <= cook.rating ? "var(--golden)" : "var(--text-placeholder)" }}>
                                {s <= cook.rating ? "★" : "☆"}
                              </span>
                            ))}
                          </div>
                          {cook.notes && (
                            <p style={{ fontSize: 11, color: "var(--text-secondary)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{cook.notes}</p>
                          )}
                        </div>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{cook.cook_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Reason */}
            {recipe.reason && (
              <div style={{
                marginBottom: 24, padding: 16, borderRadius: 16,
                background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
              }}>
                <p style={{ fontSize: 13, color: "var(--accent)", lineHeight: 1.6 }}>
                  💡 {recipe.reason}
                </p>
              </div>
            )}

            {/* Ingredients */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h2 style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 12,
                  fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                }}>
                  <span style={{ width: 4, height: 16, borderRadius: 2, background: "var(--accent)" }} />
                  食材清单
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {recipe.ingredients.map((ing, i) => (
                    <span key={i} style={{
                      fontSize: 13, padding: "6px 14px", borderRadius: 12, fontWeight: 500,
                      background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
                      color: "var(--text)",
                    }}>
                      <span style={{ color: "var(--accent)", marginRight: 4 }}>●</span>{ing}
                    </span>
                  ))}
                </div>
                {recipe.seasonings && recipe.seasonings.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {recipe.seasonings.map((s, i) => (
                      <span key={`s-${i}`} style={{
                        fontSize: 12, padding: "4px 12px", borderRadius: 10,
                        background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
                        color: "var(--text-secondary)",
                      }}>
                        🧂 {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Steps */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12,
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
              }}>
                <span style={{ width: 4, height: 16, borderRadius: 2, background: "var(--green)" }} />
                制作步骤
              </h2>
              {recipe.steps && recipe.steps.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recipe.steps.map((step, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, padding: 14, borderRadius: 16,
                      background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
                      transition: "all 0.25s ease",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 10, flexShrink: 0,
                        background: "var(--bg)", boxShadow: "var(--shadow-inset-sm)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: "var(--accent)",
                      }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.7, flex: 1, paddingTop: 2 }}>{step}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: 20, borderRadius: 16,
                  background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
                }}>
                  <div className="prose-chat">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{formatContent(recipe.content)}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            {/* Source link */}
            {recipe.sourceUrl && (
              <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  width: "100%", padding: "12px 0", marginBottom: 16,
                  fontSize: 13, color: "var(--text-muted)", textDecoration: "none",
                  background: "var(--bg)", borderRadius: 16, boxShadow: "var(--shadow-raised-sm)",
                  transition: "all 0.25s ease",
                }}
              >
                查看原始食谱 →
              </a>
            )}
          </div>
        </div>

        {/* Bottom actions */}
        <div style={{
          flexShrink: 0, padding: "12px 20px", display: "flex", gap: 12,
          background: "var(--bg)",
        }}>
          <button onClick={handleGenerateShoppingList}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 0", borderRadius: 16, fontSize: 13, fontWeight: 600,
              background: "var(--bg)", color: "var(--golden)", border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-raised)", transition: "all 0.25s ease",
            }}
            onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
          >
            🛒 加入购物清单
          </button>
          <button onClick={() => setShowCookModal(true)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 0", borderRadius: 16, fontSize: 13, fontWeight: 700,
              background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-accent)", transition: "all 0.25s ease",
            }}
            onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent-inset)"; }}
            onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
          >
            🍳 开始烹饪
          </button>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)",
          animation: "fadeIn 0.2s ease",
        }} onClick={() => setShowDeleteConfirm(false)}>
          <div style={{
            background: "var(--bg)", borderRadius: 24, width: "100%", maxWidth: 380,
            padding: 24, boxShadow: "var(--shadow-raised-lg)",
            animation: "scaleIn 0.2s ease both", textAlign: "center",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg)", boxShadow: "var(--shadow-raised)", fontSize: 24,
            }}>
              🗑
            </div>
            <h3 style={{
              fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 8,
              fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
            }}>移除菜谱</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              确定要从菜谱栏中移除<br/>「{recipe.title}」吗？<br/>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>此操作可以撤销，你仍然可以通过对话重新获取这道菜谱。</span>
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  background: "var(--bg)", color: "var(--text-secondary)",
                  fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer",
                  boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              >保留</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  background: "var(--rose)", color: "#fff",
                  fontSize: 14, fontWeight: 700, border: "none", cursor: deleting ? "not-allowed" : "pointer",
                  boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
                  opacity: deleting ? 0.6 : 1,
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              >{deleting ? "删除中..." : "确认移除"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cook record modal */}
      {showCookModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)",
          animation: "fadeIn 0.2s ease",
        }} onClick={() => setShowCookModal(false)}>
          <div style={{
            background: "var(--bg)", borderRadius: 24, width: "100%", maxWidth: 400,
            padding: 24, boxShadow: "var(--shadow-raised-lg)",
            animation: "scaleIn 0.2s ease both",
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{
              fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4,
              fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
            }}>记录烹饪</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              为「{recipe.title}」留下评价
            </p>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>评分</label>
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setCookRating(star)}
                    style={{
                      fontSize: 28, background: "none", border: "none", cursor: "pointer",
                      color: star <= cookRating ? "var(--golden)" : "var(--text-placeholder)",
                      transition: "transform 0.15s ease",
                    }}
                  >★</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>笔记</label>
              <textarea value={cookNotes} onChange={e => setCookNotes(e.target.value)}
                placeholder="记录心得、改良建议..."
                style={{
                  width: "100%", height: 80, padding: "10px 14px", borderRadius: 12,
                  background: "var(--bg)", border: "none", boxShadow: "var(--shadow-inset-sm)",
                  fontSize: 14, color: "var(--text)", resize: "none", outline: "none",
                  transition: "all 0.25s ease",
                }}
                onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-focus)"; }}
                onBlur={e => { e.currentTarget.style.boxShadow = "var(--shadow-inset-sm)"; }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowCookModal(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  background: "var(--bg)", color: "var(--text-secondary)",
                  fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer",
                  boxShadow: "var(--shadow-raised-sm)", transition: "all 0.25s ease",
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
              >取消</button>
              <button onClick={handleSaveCookRecord}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  background: "var(--accent)", color: "#fff",
                  fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer",
                  boxShadow: "var(--shadow-accent)", transition: "all 0.25s ease",
                }}
                onMouseDown={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent-inset)"; }}
                onMouseUp={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-accent)"; }}
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
