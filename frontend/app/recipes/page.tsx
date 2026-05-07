"use client";

import {useState, useEffect, useCallback} from "react";
import {useRouter} from "next/navigation";
import {Recipe} from "@/types/recipe";
import {RecipeCard} from "@/components/RecipeCard";
import {RecipeDetailModal} from "@/components/RecipeDetailModal";
import { Loading } from "@/components/Loading";
import { showToast } from "@/components/Toast";
import {loadRecipes, RECIPE_CHANGE_EVENT, deleteRecipesBatch} from "@/lib/recipeStore";

export default function RecipesPage() {
    const router = useRouter();
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [searchFocused, setSearchFocused] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [batchDeleting, setBatchDeleting] = useState(false);

    const [loading, setLoading] = useState(true);

    const loadRecipeList = useCallback(async () => {
        const allRecipes = await loadRecipes();
        setRecipes(allRecipes);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadRecipeList();
    }, [loadRecipeList]);

    useEffect(() => {
        const handleRecipeChange = () => loadRecipeList();
        window.addEventListener(RECIPE_CHANGE_EVENT, handleRecipeChange);
        return () => window.removeEventListener(RECIPE_CHANGE_EVENT, handleRecipeChange);
    }, [loadRecipeList]);

    const allTags = [...new Set(recipes.flatMap(r => r.tags || []))].sort();

    const filteredRecipes = (() => {
      let result = recipes;
      if (activeTag) result = result.filter(r => (r.tags || []).includes(activeTag));
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        result = result.filter(r => r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q));
      }
      return result;
    })();

    const toggleSelect = (id: string) => {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    };

    const handleBatchDelete = async () => {
      if (selectedIds.size === 0) return;
      setBatchDeleting(true);
      const ok = await deleteRecipesBatch([...selectedIds]);
      setBatchDeleting(false);
      if (ok) {
        showToast(`已删除 ${selectedIds.size} 道菜谱`, "success");
        setSelectedIds(new Set());
        setSelectMode(false);
        loadRecipeList();
      } else {
        showToast("批量删除失败", "error");
      }
    };

    const toggleSelectAll = () => {
      if (selectedIds.size === filteredRecipes.length) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(filteredRecipes.map(r => r.id)));
      }
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "var(--bg)",
        }}>
            {/* Header */}
            <header style={{
                flexShrink: 0,
                padding: "12px 16px",
                background: "var(--bg)",
                boxShadow: "var(--shadow-raised-sm)",
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    maxWidth: "1280px",
                    margin: "0 auto",
                }}>
                    <div style={{display: "flex", alignItems: "center", gap: "12px"}}>
                        <button
                            onClick={() => router.back()}
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "12px",
                                border: "none",
                                background: "var(--bg)",
                                boxShadow: "var(--shadow-raised-sm)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                fontSize: "16px",
                                color: "var(--text)",
                                transition: "all 0.25s ease",
                            }}
                            onMouseDown={(e) => {
                                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-inset-sm)";
                            }}
                            onMouseUp={(e) => {
                                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)";
                            }}
                            onMouseLeave={(e) => {
                                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)";
                            }}
                        >
                            ←
                        </button>
                        <div>
                            <h1 style={{
                                fontSize: "15px",
                                fontWeight: 700,
                                color: "var(--text)",
                                letterSpacing: "-0.02em",
                                margin: 0,
                                fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                            }}>
                                我的菜谱
                            </h1>
                            <p style={{
                                fontSize: "11px",
                                color: "var(--text-muted)",
                                margin: "2px 0 0 0",
                            }}>
                                {recipes.length} 道菜谱
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Search */}
            <div style={{
                flexShrink: 0,
                padding: "12px 16px 8px",
                maxWidth: "1280px",
                width: "100%",
                marginLeft: "auto",
                marginRight: "auto",
            }}>
                <div style={{position: "relative"}}>
                    <span style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "14px",
                        lineHeight: 1,
                        pointerEvents: "none",
                    }}>
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="搜索菜谱..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                        style={{
                            width: "100%",
                            padding: "10px 36px 10px 36px",
                            borderRadius: "999px",
                            border: "none",
                            outline: "none",
                            fontSize: "14px",
                            color: "var(--text)",
                            background: "var(--bg)",
                            boxShadow: searchFocused ? "var(--shadow-inset-focus)" : "var(--shadow-inset-sm)",
                            transition: "all 0.25s ease",
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            style={{
                                position: "absolute",
                                right: "10px",
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                padding: "4px",
                                cursor: "pointer",
                                fontSize: "13px",
                                color: "var(--text-muted)",
                                lineHeight: 1,
                                transition: "all 0.25s ease",
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            {/* Tag filters */}
            {allTags.length > 0 && (
              <div style={{
                padding: "4px 16px 8px", maxWidth: 1280, width: "100%",
                margin: "0 auto", display: "flex", gap: 6, flexWrap: "wrap",
              }}>
                {allTags.map(tag => (
                  <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                    style={{
                      padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, transition: "all 0.25s ease",
                      background: activeTag === tag ? "var(--accent)" : "var(--bg)",
                      color: activeTag === tag ? "#fff" : "var(--text-secondary)",
                      boxShadow: activeTag === tag ? "var(--shadow-accent)" : "var(--shadow-raised-xs)",
                    }}
                  >{tag}</button>
                ))}
              </div>
            )}

            {/* Batch controls */}
            <div style={{
              padding: "0 16px 8px", maxWidth: 1280, width: "100%", margin: "0 auto",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                style={{
                  padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, transition: "all 0.25s ease",
                  background: selectMode ? "var(--accent)" : "var(--bg)",
                  color: selectMode ? "#fff" : "var(--text-secondary)",
                  boxShadow: selectMode ? "var(--shadow-accent)" : "var(--shadow-raised-xs)",
                }}
              >{selectMode ? "退出选择" : "批量管理"}</button>
              {selectMode && (
                <>
                  <button onClick={toggleSelectAll}
                    style={{
                      padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, background: "var(--bg)", color: "var(--text-secondary)",
                      boxShadow: "var(--shadow-raised-xs)",
                    }}
                  >{selectedIds.size === filteredRecipes.length ? "取消全选" : "全选"}</button>
                  {selectedIds.size > 0 && (
                    <button onClick={handleBatchDelete} disabled={batchDeleting}
                      style={{
                        padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                        fontSize: 11, fontWeight: 600, background: "var(--rose)", color: "#fff",
                        boxShadow: "var(--shadow-raised-xs)", opacity: batchDeleting ? 0.6 : 1,
                      }}
                    >{batchDeleting ? "删除中..." : `删除已选 (${selectedIds.size})`}</button>
                  )}
                </>
              )}
            </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "8px 16px",
                maxWidth: "1280px",
                width: "100%",
                marginLeft: "auto",
                marginRight: "auto",
            }}>
                {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 64 }}>
                        <Loading text="加载菜谱中..." />
                    </div>
                ) : filteredRecipes.length === 0 ? (
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingTop: "64px",
                    }}>
                        <div style={{
                            width: "64px",
                            height: "64px",
                            borderRadius: "20px",
                            background: "var(--bg)",
                            boxShadow: "var(--shadow-raised)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            marginBottom: "16px",
                        }}>
                            🍽
                        </div>
                        <h3 style={{
                            fontSize: "16px",
                            fontWeight: 700,
                            color: "var(--text)",
                            marginBottom: "4px",
                            fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
                        }}>
                            {searchQuery ? "没有找到匹配的菜谱" : "还没有菜谱"}
                        </h3>
                        <p style={{
                            fontSize: "14px",
                            color: "var(--text-muted)",
                        }}>
                            {searchQuery ? "试试其他关键词" : "在对话中让 AI 推荐菜谱并保存"}
                        </p>
                    </div>
                ) : (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: "10px",
                        paddingBottom: "16px",
                    }}>
                        {filteredRecipes.map((recipe) => (
                            <RecipeCard
                                key={recipe.id}
                                recipe={recipe}
                                onClick={selectMode ? undefined : () => setSelectedRecipe(recipe)}
                                selectMode={selectMode}
                                selected={selectedIds.has(recipe.id)}
                                onToggleSelect={() => toggleSelect(recipe.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {selectedRecipe && (
                <RecipeDetailModal
                    recipe={selectedRecipe}
                    onClose={() => setSelectedRecipe(null)}
                />
            )}
        </div>
    );
}
