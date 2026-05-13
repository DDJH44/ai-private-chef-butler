"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    Preference, FamilyMember,
    ALLERGY_OPTIONS, DIET_TYPES, TASTE_DIMENSIONS, ROLE_OPTIONS,
  DEFAULT_PREFERENCE,
} from "@/types/preference";
import { loadPreference, savePreference } from "@/lib/preferenceStore";
import { generateUUID } from "@/lib/utils";
import { showToast } from "@/components/Toast";
import { AuthGuard } from "@/components/AuthGuard";

const styles = {
    page: {
        display: "flex",
        flexDirection: "column" as const,
        height: "100%",
        background: "var(--bg)",
    },
    header: {
        flexShrink: 0,
        padding: "14px 16px",
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised)",
    },
    headerInner: {
        position: "relative" as const,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        maxWidth: "80rem",
        margin: "0 auto",
        width: "100%",
    },
    backBtn: {
        width: 36,
        height: 36,
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        fontSize: 16,
        color: "var(--text)",
        transition: "all 0.25s ease",
    },
    title: {
        fontSize: 15,
        fontWeight: 700,
        color: "var(--text)",
        letterSpacing: "-0.01em",
        margin: 0,
        fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
    },
    subtitle: {
        fontSize: 11,
        color: "var(--text-muted)",
        marginTop: 2,
        margin: 0,
    },
    scrollArea: {
        flex: 1,
        overflowY: "auto" as const,
        padding: "16px 16px 152px 16px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 16,
        maxWidth: "80rem",
        margin: "0 auto",
        width: "100%",
    },
    card: {
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised)",
        borderRadius: 20,
        padding: 20,
    },
    sectionHeader: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
    },
    sectionIcon: {
        width: 36,
        height: 36,
        borderRadius: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        boxShadow: "var(--shadow-raised-xs)",
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 700,
        color: "var(--text)",
        margin: 0,
        fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
    },
    sectionDesc: {
        fontSize: 10,
        color: "var(--text-muted)",
        marginTop: 2,
        margin: 0,
    },
    input: {
        flex: 1,
        padding: "10px 14px",
        borderRadius: 14,
        fontSize: 12,
        color: "var(--text)",
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset-sm)",
        border: "none",
        outline: "none",
        transition: "all 0.25s ease",
    },
    addBtn: {
        padding: "10px 14px",
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--accent)",
        border: "none",
        cursor: "pointer",
        transition: "all 0.25s ease",
    },
    customTag: {
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        background: "var(--rose)",
        color: "#fff",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
    },
    customTagClose: {
        background: "none",
        border: "none",
        color: "#fff",
        cursor: "pointer",
        fontSize: 10,
        padding: 0,
        opacity: 0.7,
        transition: "all 0.25s ease",
    },
    emptyText: {
        fontSize: 12,
        color: "var(--text-muted)",
        textAlign: "center" as const,
        padding: "12px 0",
    },
    memberCard: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        borderRadius: 16,
        transition: "all 0.25s ease",
    },
    memberIconArea: {
        width: 30,
        height: 30,
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset-sm)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
    },
    memberName: {
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text)",
        margin: 0,
    },
    memberInfo: {
        fontSize: 10,
        color: "var(--text-muted)",
        margin: 0,
    },
    removeBtn: {
        background: "none",
        border: "none",
        color: "var(--text-muted)",
        cursor: "pointer",
        fontSize: 14,
        padding: 4,
        transition: "all 0.25s ease",
    },
    addMemberForm: {
        marginTop: 12,
        padding: 16,
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        borderRadius: 16,
        animation: "slideUp 0.3s ease",
    },
    formLabel: {
        display: "block",
        fontSize: 10,
        color: "var(--text-muted)",
        marginBottom: 4,
    },
    formInput: {
        width: "100%",
        padding: "10px 14px",
        borderRadius: 12,
        fontSize: 12,
        color: "var(--text)",
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset-sm)",
        border: "none",
        outline: "none",
        transition: "all 0.25s ease",
        boxSizing: "border-box" as const,
    },
    cancelBtn: {
        flex: 1,
        padding: "10px 0",
        background: "var(--bg)",
        boxShadow: "var(--shadow-raised-sm)",
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 600,
        color: "var(--text-muted)",
        border: "none",
        cursor: "pointer",
        transition: "all 0.25s ease",
    },
    confirmBtn: {
        flex: 1,
        padding: "10px 0",
        background: "var(--accent)",
        boxShadow: "var(--shadow-raised-sm)",
        borderRadius: 14,
        fontSize: 12,
        fontWeight: 700,
        color: "#fff",
        border: "none",
        cursor: "pointer",
        transition: "all 0.25s ease",
    },
    addMemberBtn: {
        background: "none",
        border: "none",
        color: "var(--accent)",
        cursor: "pointer",
        fontSize: 18,
        padding: 6,
        borderRadius: 10,
        boxShadow: "var(--shadow-raised-xs)",
        transition: "all 0.25s ease",
        lineHeight: 1,
    },
    bottomBar: {
        flexShrink: 0,
        padding: "12px 16px",
        background: "var(--bg)",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.06)",
    },
    saveBtn: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "14px 0",
        background: "var(--accent)",
        boxShadow: "var(--shadow-accent)",
        borderRadius: 20,
        fontWeight: 700,
        fontSize: 14,
        color: "#fff",
        border: "none",
        cursor: "pointer",
        transition: "all 0.25s ease",
        fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
    },
    badge: {
        display: "inline-block",
        padding: "2px 10px",
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset-sm)",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        color: "var(--accent)",
    },
    rangeTrack: {
        width: "100%",
        height: 6,
        borderRadius: 999,
        background: "var(--bg)",
        boxShadow: "var(--shadow-inset-sm)",
        outline: "none",
        WebkitAppearance: "none" as const,
        appearance: "none" as const,
        cursor: "pointer",
        transition: "all 0.25s ease",
    },
    sliderLabel: {
        fontSize: 12,
        fontWeight: 500,
        color: "var(--text-secondary)",
    },
    sliderEnd: {
        fontSize: 9,
        color: "var(--text-muted)",
    },
};

const allergyPill = (selected: boolean): React.CSSProperties => ({
    padding: "7px 14px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    transition: "all 0.25s ease",
    background: selected ? "var(--rose)" : "var(--bg)",
    color: selected ? "#fff" : "var(--text-secondary)",
    boxShadow: selected ? "var(--shadow-inset-sm)" : "var(--shadow-raised-xs)",
});

const dietCard = (selected: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    border: "none",
    textAlign: "left" as const,
    cursor: "pointer",
    transition: "all 0.25s ease",
    background: "var(--bg)",
    boxShadow: selected ? "var(--shadow-inset)" : "var(--shadow-raised-sm)",
});

const dietLabel = (selected: boolean): React.CSSProperties => ({
    fontSize: 12,
    fontWeight: 600,
    color: selected ? "var(--accent)" : "var(--text-secondary)",
});

const rolePill = (selected: boolean): React.CSSProperties => ({
    padding: "5px 14px",
    borderRadius: 12,
    fontSize: 10,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    transition: "all 0.25s ease",
    background: selected ? "var(--accent)" : "var(--bg)",
    color: selected ? "#fff" : "var(--text-muted)",
    boxShadow: selected ? "var(--shadow-inset-sm)" : "var(--shadow-raised-xs)",
});

export default function PreferencesPage() {
    const router = useRouter();
    const [preference, setPreference] = useState<Preference>(DEFAULT_PREFERENCE);
    const [customAllergy, setCustomAllergy] = useState("");
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMember, setNewMember] = useState<Partial<FamilyMember>>({ role: "adult", age: 30, notes: "" });
    const [focusField, setFocusField] = useState<string | null>(null);

    useEffect(() => {
        const loaded = loadPreference();
        if (loaded) setPreference(loaded);
    }, []);

    const toggleAllergy = useCallback((item: string) => {
        setPreference(prev => ({
            ...prev,
            allergies: prev.allergies.includes(item)
                ? prev.allergies.filter(a => a !== item)
                : [...prev.allergies, item],
        }));
    }, []);

    const addCustomAllergy = useCallback(() => {
        const trimmed = customAllergy.trim();
        if (trimmed && !preference.custom_allergies.includes(trimmed)) {
            setPreference(prev => ({ ...prev, custom_allergies: [...prev.custom_allergies, trimmed] }));
            setCustomAllergy("");
        }
    }, [customAllergy, preference.custom_allergies]);

    const updateTaste = useCallback((dim: keyof Preference['taste'], val: number) => {
        setPreference(prev => ({ ...prev, taste: { ...prev.taste, [dim]: val } }));
    }, []);

    const handleAddMember = useCallback(() => {
        if (!newMember.role) return;
        setPreference(prev => ({
            ...prev,
            family_members: [...prev.family_members, {
                id: generateUUID(),
                role: newMember.role as FamilyMember["role"],
                age: newMember.age || 30,
                notes: newMember.notes || "",
            }],
        }));
        setNewMember({ role: "adult", age: 30, notes: "" });
        setShowAddMember(false);
    }, [newMember]);

    const removeMember = useCallback((id: string) => {
        setPreference(prev => ({
            ...prev,
            family_members: prev.family_members.filter(m => m.id !== id),
        }));
    }, []);

    const handleSave = useCallback(() => {
        savePreference(preference);
        showToast("偏好设置已保存", "success");
    }, [preference]);

    const getRoleLabel = (role: string) => {
        return ROLE_OPTIONS.find(r => r.value === role)?.label || role;
    };

    const getInputStyle = (field: string): React.CSSProperties => ({
        ...styles.input,
        boxShadow: focusField === field ? "var(--shadow-inset-focus)" : "var(--shadow-inset-sm)",
    });

    const getFormInputStyle = (field: string): React.CSSProperties => ({
        ...styles.formInput,
        boxShadow: focusField === field ? "var(--shadow-inset-focus)" : "var(--shadow-inset-sm)",
    });

    return (
        <AuthGuard>
        <div style={styles.page}>
            {/* Global range input styles */}
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                input[type="range"] {
                    -webkit-appearance: none;
                    appearance: none;
                    height: 6px;
                    border-radius: 999px;
                    background: var(--bg);
                    box-shadow: var(--shadow-inset-sm);
                    outline: none;
                    transition: all 0.25s ease;
                }
                input[type="range"]:focus {
                    box-shadow: var(--shadow-inset-focus);
                }
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: var(--bg);
                    box-shadow: var(--shadow-raised-sm);
                    cursor: pointer;
                    transition: all 0.25s ease;
                }
                input[type="range"]::-webkit-slider-thumb:hover {
                    box-shadow: var(--shadow-raised);
                }
                input[type="range"]::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: var(--bg);
                    box-shadow: var(--shadow-raised-sm);
                    cursor: pointer;
                    border: none;
                    transition: all 0.25s ease;
                }
            `}</style>

            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerInner}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                            onClick={() => router.back()}
                            style={styles.backBtn}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                        >
                            ←
                        </button>
                        <div>
                            <h1 style={styles.title}>口味偏好设置</h1>
                            <p style={styles.subtitle}>让 AI 更懂你的口味</p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Scrollable content */}
            <div style={styles.scrollArea}>

                {/* Allergies */}
                <div style={styles.card}>
                    <div style={styles.sectionHeader}>
                        <div style={{ ...styles.sectionIcon, background: "var(--accent)" }}>
                            ⚠
                        </div>
                        <div>
                            <h2 style={styles.sectionTitle}>过敏原</h2>
                            <p style={styles.sectionDesc}>选择你不耐受或过敏的食材</p>
                        </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {ALLERGY_OPTIONS.map(item => (
                            <button
                                key={item}
                                onClick={() => toggleAllergy(item)}
                                style={allergyPill(preference.allergies.includes(item))}
                                onMouseEnter={e => {
                                    if (!preference.allergies.includes(item)) {
                                        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)";
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (!preference.allergies.includes(item)) {
                                        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)";
                                    }
                                }}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <input
                            value={customAllergy}
                            onChange={e => setCustomAllergy(e.target.value)}
                            placeholder="自定义过敏原"
                            style={getInputStyle("customAllergy")}
                            onFocus={() => setFocusField("customAllergy")}
                            onBlur={() => setFocusField(null)}
                            onKeyDown={e => e.key === 'Enter' && addCustomAllergy()}
                        />
                        <button onClick={addCustomAllergy} style={styles.addBtn}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                        >
                            添加
                        </button>
                    </div>
                    {preference.custom_allergies.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                            {preference.custom_allergies.map(item => (
                                <span key={item} style={styles.customTag}>
                                    {item}
                                    <button
                                        onClick={() => setPreference(prev => ({
                                            ...prev,
                                            custom_allergies: prev.custom_allergies.filter(a => a !== item),
                                        }))}
                                        style={styles.customTagClose}
                                    >
                                        ✕
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Diet Type */}
                <div style={styles.card}>
                    <div style={styles.sectionHeader}>
                        <div style={{ ...styles.sectionIcon, background: "var(--green)" }}>
                            🌿
                        </div>
                        <div>
                            <h2 style={styles.sectionTitle}>饮食类型</h2>
                            <p style={styles.sectionDesc}>选择你的饮食偏好</p>
                        </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {DIET_TYPES.map(diet => (
                            <button
                                key={diet.value}
                                onClick={() => setPreference(prev => ({ ...prev, diet_type: diet.value }))}
                                style={dietCard(preference.diet_type === diet.value)}
                                onMouseEnter={e => {
                                    if (preference.diet_type !== diet.value) {
                                        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)";
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (preference.diet_type !== diet.value) {
                                        (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)";
                                    }
                                }}
                            >
                                <span style={{ fontSize: 20 }}>{diet.icon}</span>
                                <span style={dietLabel(preference.diet_type === diet.value)}>
                                    {diet.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Taste */}
                <div style={styles.card}>
                    <div style={styles.sectionHeader}>
                        <div style={{ ...styles.sectionIcon, background: "var(--rose)" }}>
                            🔥
                        </div>
                        <div>
                            <h2 style={styles.sectionTitle}>口味偏好</h2>
                            <p style={styles.sectionDesc}>调整你的口味敏感度</p>
                        </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        {TASTE_DIMENSIONS.map(dim => (
                            <div key={dim.key}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={styles.sliderLabel}>
                                        {dim.label}
                                    </span>
                                    <span style={styles.badge}>{preference.taste[dim.key]}/5</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={5}
                                    step={1}
                                    value={preference.taste[dim.key]}
                                    onChange={e => updateTaste(dim.key, parseInt(e.target.value))}
                                    style={{ width: "100%", cursor: "pointer" }}
                                />
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                                    <span style={styles.sliderEnd}>{dim.left}</span>
                                    <span style={styles.sliderEnd}>{dim.right}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Family Members */}
                <div style={styles.card}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <div style={styles.sectionHeader}>
                            <div style={{ ...styles.sectionIcon, background: "var(--golden)" }}>
                                👥
                            </div>
                            <div>
                                <h2 style={styles.sectionTitle}>家庭成员</h2>
                                <p style={styles.sectionDesc}>为家人定制个性化菜谱</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowAddMember(true)}
                            style={styles.addMemberBtn}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)"; }}
                        >
                            ＋
                        </button>
                    </div>
                    {preference.family_members.length === 0 && !showAddMember ? (
                        <p style={styles.emptyText}>暂无家庭成员，点击右上角 + 添加</p>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {preference.family_members.map(member => (
                                <div key={member.id} style={styles.memberCard}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                        <div style={styles.memberIconArea}>
                                            <span style={{ fontSize: 12 }}>👤</span>
                                        </div>
                                        <div>
                                            <p style={styles.memberName}>{getRoleLabel(member.role)}</p>
                                            <p style={styles.memberInfo}>{member.age}岁{member.notes ? ` · ${member.notes}` : ""}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeMember(member.id)}
                                        style={styles.removeBtn}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--rose)"; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {showAddMember && (
                        <div style={styles.addMemberForm}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                                <div>
                                    <label style={styles.formLabel}>年龄</label>
                                    <input
                                        type="number"
                                        value={newMember.age || 30}
                                        onChange={e => setNewMember(prev => ({ ...prev, age: parseInt(e.target.value) || 30 }))}
                                        style={getFormInputStyle("memberAge")}
                                        onFocus={() => setFocusField("memberAge")}
                                        onBlur={() => setFocusField(null)}
                                    />
                                </div>
                                <div>
                                    <label style={styles.formLabel}>备注</label>
                                    <input
                                        value={newMember.notes || ""}
                                        onChange={e => setNewMember(prev => ({ ...prev, notes: e.target.value }))}
                                        placeholder="可选"
                                        style={getFormInputStyle("memberNotes")}
                                        onFocus={() => setFocusField("memberNotes")}
                                        onBlur={() => setFocusField(null)}
                                    />
                                </div>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                                {ROLE_OPTIONS.map(role => (
                                    <button
                                        key={role.value}
                                        onClick={() => setNewMember(prev => ({ ...prev, role: role.value as FamilyMember["role"] }))}
                                        style={rolePill(newMember.role === role.value)}
                                        onMouseEnter={e => {
                                            if (newMember.role !== role.value) {
                                                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)";
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (newMember.role !== role.value) {
                                                (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-xs)";
                                            }
                                        }}
                                    >
                                        {role.label}
                                    </button>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <button
                                    onClick={() => setShowAddMember(false)}
                                    style={styles.cancelBtn}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised)"; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-raised-sm)"; }}
                                >
                                    取消
                                </button>
                                <button onClick={handleAddMember} style={styles.confirmBtn}>
                                    添加
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Save */}
            <div style={styles.bottomBar}>
                <button
                    onClick={handleSave}
                    style={styles.saveBtn}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                >
                    💾 保存偏好设置
                </button>
            </div>
        </div>
        </AuthGuard>
    );
}
