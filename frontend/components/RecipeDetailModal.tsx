"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Recipe } from "@/types/recipe";
import { useFeishuStatus } from "@/hooks/useFeishuStatus";
import { proxyImageUrl } from "@/lib/imageUtils";
import { generateShoppingListFromRecipes } from "@/lib/shoppingListGenerator";
import { recordView, addCookRecord, loadCookHistory } from "@/lib/historyStore";
import { deleteRecipe as deleteRecipeFromStore } from "@/lib/recipeStore";
import { getToken } from "@/lib/authStore";
import { authFetch, authHeaders } from "@/lib/http";
import { showToast } from "@/components/Toast";
import { generateUUID } from "@/lib/utils";
import { Star, Flame, Clock, X, Check, Clipboard, Trash2, ChefHat, CookingPot, ShoppingCart, Video } from "lucide-react";
import { RecipeSaveBlock, stripSaveBlocks, difficultyColor } from "./RecipeSaveBlock";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Plain-text formatContent for print (HTML output, can't use JSX) */
function formatContentForPrint(content: string): string {
  return content.replace(
    /\[SAVE_RECIPE_START\]([\s\S]*?)\[SAVE_RECIPE_END\]/g,
    (_: string, block: string) => {
      let formatted = "";
      const lines = block.trim().split("\n");
      for (const line of lines) {
        const idx = line.indexOf("：");
        if (idx === -1) continue;
        const key = line.slice(0, idx);
        const val = line.slice(idx + 1).trim();
        if (!val) continue;
        switch (key) {
          case "标题": formatted += `<h2>${val}</h2>`; break;
          case "评分": formatted += `<p>评分：${val}/5</p>`; break;
          case "难度": formatted += `<p>难度：${val}</p>`; break;
          case "时间": formatted += `<p>时间：${val}</p>`; break;
          case "理由": formatted += `<blockquote>推荐理由：${val}</blockquote>`; break;
          case "食材": formatted += `<p><strong>食材</strong>：${val.replace(/，/g, "、")}</p>`; break;
          case "调味料": formatted += `<p><strong>调料</strong>：${val.replace(/，/g, "、")}</p>`; break;
          case "步骤": {
            const steps = val.split(/[；;]/).filter(Boolean);
            formatted += `<p><strong>步骤</strong></p><ol>`;
            steps.forEach((s: string, i: number) => { formatted += `<li>${s.trim()}</li>`; });
            formatted += "</ol>";
            break;
          }
          case "视频": {
            if (val && val !== "无") formatted += `<p><a href="${val}">观看视频教程</a></p>`;
            break;
          }
        }
      }
      return formatted;
    }
  ).trim();
}

function StarRating({ score }: { score: number }) {
  const rounded = Math.round(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize: 16, color: n <= rounded ? "var(--golden)" : "var(--text-placeholder)" }}>
          {n <= rounded ? <Star size={24} fill="var(--golden)"/> : <Star size={24}/>}
        </span>
      ))}
    </div>
  );
}

const circleBtn = (): React.CSSProperties => ({
  width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 16, borderRadius: "50%", border: "none", cursor: "pointer",
  background: "var(--surface)", color: "var(--text-secondary)",
  boxShadow: "var(--shadow-raised-sm)", transition: "var(--transition)",
});

interface RecipeDetailModalProps { recipe: Recipe; onClose: () => void; }

export function RecipeDetailModal({ recipe, onClose }: RecipeDetailModalProps) {
  const router = useRouter();
  const { configured: feishuConfigured } = useFeishuStatus();
  const [fullRecipe, setFullRecipe] = useState(recipe);
  const [copied, setCopied] = useState(false);
  const [showCookModal, setShowCookModal] = useState(false);
  const [cookRating, setCookRating] = useState(5);
  const [cookNotes, setCookNotes] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch full recipe content if the list view stripped it
  useEffect(() => {
    if (recipe.content) return;
    authFetch(`/api/v1/recipes/${encodeURIComponent(recipe.id)}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => {
        if (data.title) setFullRecipe(data);
      })
      .catch((e) => { console.warn('加载菜谱详情失败:', e); });
  }, [recipe]);

  useEffect(() => { if (recipe) recordView(fullRecipe.id, fullRecipe.title); }, [recipe]);
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

  const handleCopy = async () => {
    const text = fullRecipe.steps?.join("\n\n") || fullRecipe.content;
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* noop */ }
  };

  const handlePrint = () => {
    const pw = window.open("", "_blank");
    if (pw) {
      const title = escapeHtml(fullRecipe.title);
      const imgHtml = fullRecipe.imageUrl ? `<img src="${escapeHtml(proxyImageUrl(fullRecipe.imageUrl))}">` : "";
      const stepsHtml = fullRecipe.steps
        ? fullRecipe.steps.map((s, i) =>
            `<div class="step"><div class="step-num">${i + 1}</div><div>${escapeHtml(s)}</div></div>`
          ).join("")
        : `<div>${formatContentForPrint(fullRecipe.content)}</div>`;
      pw.document.write(`<html><head><title>${title}</title><style>body{font-family:sans-serif;max-width:720px;margin:32px auto;padding:0 24px;line-height:1.8;color:#1F1D1A}h1{font-size:28px}h2{font-size:18px;margin:24px 0 12px}.step{display:flex;gap:12px;margin-bottom:16px;padding:14px;background:#faf8f5;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.06)}.step-num{width:30px;height:30px;background:#6c5ce7;color:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}img{max-width:100%;border-radius:16px;margin:16px 0}</style></head><body>${imgHtml}<h1>${title}</h1>${stepsHtml}</body></html>`);
      pw.document.close(); pw.print();
    }
  };

  const handleShare = async () => {
    if (navigator.share) { try { await navigator.share({ title: fullRecipe.title, text: `推荐菜谱：${fullRecipe.title}` }); } catch { handleCopy(); } }
    else { handleCopy(); }
  };

  const handleShareToFeishu = async () => {
    try {
      const resp = await authFetch(`/api/v1/feishu/recipe-share`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(fullRecipe),
      });
      const data = await resp.json();
      if (resp.ok) {
        showToast("已分享到飞书", "success");
      } else {
        showToast(data.detail || "分享失败", "error");
      }
    } catch (e) {
      showToast(`分享失败: ${(e as Error).message}`, "error");
    }
  };

  const handleGenerateShoppingList = async () => {
    const lists = await generateShoppingListFromRecipes([fullRecipe]);
    showToast(`已为「${lists[0]?.source_recipe_names?.[0] || fullRecipe.title}」生成购物清单`, "success");
    router.push("/shopping-list");
  };

  const handleDelete = async () => {
    setDeleting(true);
    const deleted = await deleteRecipeFromStore(fullRecipe.id);
    if (deleted) {
      showToast(`「${fullRecipe.title}」已从菜谱栏移除`, "success");
      onClose();
    } else {
      showToast("删除失败，请重试", "error");
    }
    setDeleting(false);
  };

  const handleSaveCookRecord = () => {
    if (saving) return;
    setSaving(true);
    addCookRecord({ id: generateUUID(), recipe_id: fullRecipe.id, recipe_name: fullRecipe.title, cook_date: new Date().toISOString().split("T")[0], rating: cookRating, notes: cookNotes, photos: [], created_at: new Date().toISOString() });
    showToast("烹饪记录已保存", "success");
    setShowCookModal(false); setCookRating(5); setCookNotes("");
    setSaving(false);
  };

  const modalStyle: React.CSSProperties = {
    position: "relative", width: "100%", maxWidth: 500,
    maxHeight: "92vh", background: "var(--surface)", borderRadius: 24,
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
          padding: 12, pointerEvents: "none",
        }}>
          <button onClick={onClose} style={{ ...circleBtn(), pointerEvents: "auto", width: 36, height: 36 }}
          ><X size={18} strokeWidth={1.8}/></button>
          <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
            <button onClick={handleCopy} title="复制菜谱内容" style={{ ...circleBtn(), width: 36, height: 36, fontSize: 14 }}
            >{copied ? <Check size={14}/> : <Clipboard size={14}/>}</button>
            <button onClick={() => setShowDeleteConfirm(true)} title="删除菜谱" style={{ ...circleBtn(), width: 36, height: 36, color: "var(--rose)" }}
            ><Trash2 size={14}/></button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Hero image */}
          {fullRecipe.imageUrl ? (
            <div style={{ position: "relative", aspectRatio: "16/9", maxHeight: 220, overflow: "hidden" }}>
              <img src={proxyImageUrl(fullRecipe.imageUrl)} alt={fullRecipe.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--bg) 10%, transparent)" }} />
            </div>
          ) : (
            <div style={{
              height: 120, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg)", fontSize: 44, color: "var(--text-placeholder)",
            }}>
              <ChefHat size={40} strokeWidth={1.5}/>
            </div>
          )}

          {/* Content */}
          <div style={{ padding: "0 24px 16px", marginTop: fullRecipe.imageUrl ? -40 : 0, position: "relative", zIndex: 10 }}>
            {/* Title + info */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{
                fontSize: 24, fontWeight: 700, color: "var(--text)", marginBottom: 8,
                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                lineHeight: 1.3,
              }}>
                {fullRecipe.title}
              </h1>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {fullRecipe.difficulty && (
                  <span style={{
                    fontSize: 11, padding: "4px 12px", borderRadius: 999, fontWeight: 600,
                    background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
                    color: difficultyColor(fullRecipe.difficulty),
                  }}>
                    {fullRecipe.difficulty}
                  </span>
                )}
                {fullRecipe.cookingTime && (
                  <span style={{
                    fontSize: 11, padding: "4px 12px", borderRadius: 999,
                    background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
                    color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4,
                  }}>
                    <Clock size={11} strokeWidth={1.8} /> {fullRecipe.cookingTime}
                  </span>
                )}
              </div>

              {fullRecipe.score !== undefined && fullRecipe.score > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StarRating score={fullRecipe.score} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--golden)" }}>{fullRecipe.score}/5</span>
                </div>
              )}
            </div>

            {/* Past cook records */}
            {(() => {
              const pastCooks = loadCookHistory().filter(c => c.recipe_id === fullRecipe.id);
              if (pastCooks.length === 0) return null;
              return (
                <div style={{
                  marginBottom: 24, padding: 16, borderRadius: 16,
                  background: "var(--surface)", boxShadow: "var(--shadow-inset-sm)",
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
                                {s <= cook.rating ? <Star size={12} fill="var(--golden)"/> : <Star size={12}/>}
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

            {/* Ingredients */}
            {fullRecipe.ingredients && fullRecipe.ingredients.length > 0 && (
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
                  {fullRecipe.ingredients.map((ing, i) => (
                    <span key={i} style={{
                      fontSize: 13, padding: "6px 14px", borderRadius: 12, fontWeight: 500,
                      background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
                      color: "var(--text)",
                    }}>
                      {ing}
                    </span>
                  ))}
                </div>
                {fullRecipe.seasonings && fullRecipe.seasonings.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    {fullRecipe.seasonings.map((s, i) => (
                      <span key={`s-${i}`} style={{
                        fontSize: 12, padding: "4px 12px", borderRadius: 10,
                        background: "var(--bg)", boxShadow: "var(--shadow-raised-xs)",
                        color: "var(--text-secondary)",
                      }}>
                        {s}
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
                <span style={{ width: 4, height: 16, borderRadius: 2, background: "var(--accent)" }} />
                制作步骤
              </h2>
              {fullRecipe.steps && fullRecipe.steps.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {fullRecipe.steps.map((step, i) => (
                    <div key={i} style={{
                      display: "flex", gap: 12, padding: 14, borderRadius: 16,
                      background: "var(--surface)", boxShadow: "var(--shadow-raised-sm)",
                      transition: "var(--transition)",
                    }}
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
                  background: "var(--surface)", boxShadow: "var(--shadow-raised-sm)",
                }}>
                  <RecipeSaveBlock content={fullRecipe.content} />
                </div>
              )}
            </div>

            {/* Source link */}
            {fullRecipe.sourceUrl && (
              <a href={fullRecipe.sourceUrl} target="_blank" rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  width: "100%", padding: "12px 0", marginBottom: 16,
                  fontSize: 13, color: "var(--text-muted)", textDecoration: "none",
                  background: "var(--surface)", borderRadius: 16, boxShadow: "var(--shadow-raised-sm)",
                  transition: "var(--transition)",
                }}
              >
                查看原始食谱 →
              </a>
            )}

            {/* Video tutorials — 使用预存的视频数据 */}
            {(() => {
              const videos = fullRecipe.videos || [];
              if (videos.length === 0) return null;
              return (
                <div style={{ marginBottom: 16 }}>
                  <h2 style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 13, fontWeight: 600, color: "var(--accent)", marginBottom: 10,
                    fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                  }}>
                    <span style={{ width: 4, height: 16, borderRadius: 2, background: "var(--accent)" }} />
                    视频教程
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {videos.map((v, i) => (
                      <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
                          textDecoration: "none", background: "var(--surface)",
                          borderRadius: 14, boxShadow: "var(--shadow-raised-sm)",
                          transition: "var(--transition)",
                        }}
                      >
                        <Video size={16} strokeWidth={1.8} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {v.title}
                          </div>
                          {(v.author || v.play) && (
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                              {v.author ? `UP主：${v.author}` : ""}{v.author && v.play ? " · " : ""}{v.play ? `播放：${v.play}` : ""}
                            </div>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Bottom actions */}
        <div style={{
          flexShrink: 0, padding: "12px 20px", display: "flex", gap: 12,
          background: "var(--surface)",
        }}>
          <button onClick={handleGenerateShoppingList}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 0", borderRadius: 16, fontSize: 13, fontWeight: 600,
              background: "var(--surface)", color: "var(--golden)", border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-raised)", transition: "var(--transition)",
            }}
          >
            <ShoppingCart size={16}/> 加入购物清单
          </button>
          <button onClick={() => setShowCookModal(true)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 0", borderRadius: 16, fontSize: 13, fontWeight: 700,
              background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer",
              boxShadow: "var(--shadow-accent)", transition: "var(--transition)",
            }}
          >
            <CookingPot size={16}/> 开始烹饪
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
            background: "var(--surface)", borderRadius: 24, width: "100%", maxWidth: 380,
            padding: 24, boxShadow: "var(--shadow-raised-lg)",
            animation: "scaleIn 0.2s ease both", textAlign: "center",
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--bg)", boxShadow: "var(--shadow-raised)", fontSize: 24,
            }}>
              <Trash2 size={24} strokeWidth={1.5} color="var(--rose)"/>
            </div>
            <h3 style={{
              fontSize: 17, fontWeight: 700, color: "var(--text)", marginBottom: 8,
              fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
            }}>移除菜谱</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              确定要从菜谱栏中移除<br/>「{fullRecipe.title}」吗？<br/>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>此操作可以撤销，你仍然可以通过对话重新获取这道菜谱。</span>
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  background: "var(--surface)", color: "var(--text-secondary)",
                  fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer",
                  boxShadow: "var(--shadow-raised-sm)", transition: "var(--transition)",
                }}
              >保留</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  background: "var(--rose)", color: "#fff",
                  fontSize: 14, fontWeight: 700, border: "none", cursor: deleting ? "not-allowed" : "pointer",
                  boxShadow: "var(--shadow-raised-sm)", transition: "var(--transition)",
                  opacity: deleting ? 0.6 : 1,
                }}
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
            background: "var(--surface)", borderRadius: 24, width: "100%", maxWidth: 400,
            padding: 24, boxShadow: "var(--shadow-raised-lg)",
            animation: "scaleIn 0.2s ease both",
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{
              fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 4,
              fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
            }}>记录烹饪</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              为「{fullRecipe.title}」留下评价
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
                  ><Star size={24} fill="var(--golden)"/></button>
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
                  transition: "var(--transition)",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button onClick={() => setShowCookModal(false)}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  background: "var(--surface)", color: "var(--text-secondary)",
                  fontSize: 14, fontWeight: 500, border: "none", cursor: "pointer",
                  boxShadow: "var(--shadow-raised-sm)", transition: "var(--transition)",
                }}
              >取消</button>
              <button onClick={handleSaveCookRecord} disabled={saving}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12,
                  background: "var(--accent)", color: "#fff",
                  fontSize: 14, fontWeight: 700, border: "none", cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: "var(--shadow-accent)", transition: "var(--transition)",
                  opacity: saving ? 0.6 : 1,
                }}
              >{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
