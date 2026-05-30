"use client";

import { Star, Flame, Clock, Lightbulb, Leaf, Droplets, BookOpen, Video } from "lucide-react";

/** Shared difficulty → color mapper */
export function difficultyColor(d?: string): string {
  switch (d) {
    case "简单": return "var(--green)";
    case "中等": return "var(--golden)";
    case "困难": return "var(--rose)";
    default: return "var(--accent)";
  }
}

interface SaveField {
  key: string;
  label: string;
  value: string;
}

/** Parse SAVE_RECIPE blocks and return structured fields */
function parseSaveBlocks(content: string): SaveField[] {
  const match = content.match(/\[SAVE_RECIPE_START\]([\s\S]*?)\[SAVE_RECIPE_END\]/);
  if (!match) return [];
  const fields: SaveField[] = [];
  const lines = match[1].trim().split("\n");
  for (const line of lines) {
    const idx = line.indexOf("：");
    if (idx === -1) continue;
    const key = line.slice(0, idx);
    const val = line.slice(idx + 1).trim();
    if (!val || val === "无") continue;
    fields.push({ key, label: val, value: val });
  }
  return fields;
}

/** Strip SAVE_RECIPE blocks from content */
export function stripSaveBlocks(content: string): string {
  return content.replace(/\[SAVE_RECIPE_START\][\s\S]*?\[SAVE_RECIPE_END\]/g, "").trim();
}

const iconStyle = { flexShrink: 0 as const, marginRight: 4, verticalAlign: "middle" as const };

/** Render a single save-block field with appropriate Lucide icon */
function SaveFieldRow({ field, compact }: { field: SaveField; compact?: boolean }) {
  const key = field.key;
  const val = field.value;

  if (compact) {
    // Card mode: inline badges
    switch (key) {
      case "难度": return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11, color: "var(--text-secondary)" }}><Flame size={12} strokeWidth={1.8} style={iconStyle}/>{val}</span>;
      case "时间": return <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 11, color: "var(--text-secondary)" }}><Clock size={12} strokeWidth={1.8} style={iconStyle}/>{val}</span>;
      case "食材": return <span style={{ fontSize: 11, color: "var(--text-secondary)" }}><Leaf size={12} strokeWidth={1.8} style={iconStyle}/>{val.replace(/，/g, "、")}</span>;
      default: return null;
    }
  }

  // Modal mode: markdown-style blocks
  switch (key) {
    case "标题": return <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>{val}</h3>;
    case "评分": return <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}><Star size={14} strokeWidth={1.8} style={iconStyle}/>{val}/5</div>;
    case "难度": return <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}><Flame size={14} strokeWidth={1.8} style={iconStyle}/>{val}</div>;
    case "时间": return <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}><Clock size={14} strokeWidth={1.8} style={iconStyle}/>{val}</div>;
    case "理由": return null;
    case "食材": return <p style={{ margin: "4px 0" }}><strong>食材</strong>：{val.replace(/，/g, "、")}</p>;
    case "调味料": return <p style={{ margin: "4px 0" }}><strong>调料</strong>：{val.replace(/，/g, "、")}</p>;
    case "步骤": {
      const steps = val.split(/[；;]/).filter(Boolean);
      return (
        <div style={{ margin: "8px 0" }}>
          <p style={{ fontWeight: 600, margin: "0 0 4px" }}>步骤</p>
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {steps.map((s: string, i: number) => <li key={i} style={{ marginBottom: 4, lineHeight: 1.7 }}>{s.trim()}</li>)}
          </ol>
        </div>
      );
    }
    case "视频": return null;
	    default: return null;
  }
}

interface RecipeSaveBlockProps {
  content: string;
  compact?: boolean; // compact mode for card view
}

/** Display parsed SAVE_RECIPE block fields with Lucide icons */
export function RecipeSaveBlock({ content, compact }: RecipeSaveBlockProps) {
  const fields = parseSaveBlocks(content);
  if (!fields.length) return null;
  return (
    <div style={compact ? { display: "flex", flexWrap: "wrap", gap: "6px 12px" } : {}}>
      {fields.map((f, i) => <SaveFieldRow key={i} field={f} compact={compact} />)}
    </div>
  );
}
