"use client";

import {useState, useEffect, useCallback, useMemo, useDeferredValue} from "react";
import {Recipe} from "@/types/recipe";
import {RecipeCard} from "@/components/RecipeCard";
import {RecipeDetailModal} from "@/components/RecipeDetailModal";
import { Loading } from "@/components/Loading";
import { showToast } from "@/components/Toast";
import { AuthGuard } from "@/components/AuthGuard";
import { getToken } from "@/lib/authStore";
import {loadRecipes, RECIPE_CHANGE_EVENT, deleteRecipesBatch} from "@/lib/recipeStore";
import { Search, X, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export default function RecipesPage() {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const deferredQuery = useDeferredValue(searchQuery);
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [batchDeleting, setBatchDeleting] = useState(false);

    const [loading, setLoading] = useState(true);

    const loadRecipeList = useCallback(async () => {
        if (!getToken()) { setLoading(false); return; }
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

    const allTags = useMemo(() => [...new Set(recipes.flatMap(r => r.tags || []))].sort(), [recipes]);

    const filteredRecipes = useMemo(() => {
      let result = recipes;
      if (activeTag) result = result.filter(r => (r.tags || []).includes(activeTag));
      if (deferredQuery.trim()) {
        const q = deferredQuery.trim().toLowerCase();
        result = result.filter(r => r.title.toLowerCase().includes(q) || r.content.toLowerCase().includes(q));
      }
      return result;
    }, [recipes, activeTag, deferredQuery]);

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
        <AuthGuard>
        <div style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            background: "var(--bg)",
        }}>
            <PageHeader title="我的菜谱" subtitle={`${recipes.length} 道菜谱`} />

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
                    <Search size={16} strokeWidth={1.8} style={{
                        position: "absolute",
                        left: "12px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        lineHeight: 1,
                        pointerEvents: "none",
                        color: "var(--text-muted)",
                    }} />
                    <input
                        type="text"
                        placeholder="搜索菜谱..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                        style={{
                            width: "100%",
                            padding: "10px 36px 10px 36px",
                            borderRadius: "999px",
                            border: "none",
                            outline: "none",
                            fontSize: "14px",
                            color: "var(--text)",
                            background: "var(--bg)",
                            boxShadow: "var(--shadow-inset-sm)",
                            transition: "var(--transition)",
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => { setSearchQuery(""); setActiveTag(null); }}
                            aria-label="清空搜索"
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
                                transition: "var(--transition)",
                            }}
                        >
                            <X size={14} strokeWidth={1.8} />
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
                      fontSize: 11, fontWeight: 600, transition: "var(--transition)",
                      background: activeTag === tag ? "var(--accent)" : "var(--surface)",
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
                  fontSize: 11, fontWeight: 600, transition: "var(--transition)",
                  background: selectMode ? "var(--accent)" : "var(--surface)",
                  color: selectMode ? "#fff" : "var(--text-secondary)",
                  boxShadow: selectMode ? "var(--shadow-accent)" : "var(--shadow-raised-xs)",
                }}
              >{selectMode ? "退出选择" : "批量管理"}</button>
              {selectMode && (
                <>
                  <button onClick={toggleSelectAll}
                    style={{
                      padding: "5px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                      fontSize: 11, fontWeight: 600, background: "var(--surface)", color: "var(--text-secondary)",
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
                            background: "var(--surface)",
                            boxShadow: "var(--shadow-raised)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "28px",
                            marginBottom: "16px",
                        }}>
                            <BookOpen size={32} strokeWidth={1.5} />
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
        </AuthGuard>
    );
}
