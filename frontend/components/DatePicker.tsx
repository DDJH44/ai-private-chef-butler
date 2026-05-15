"use client";

import { useState } from "react";

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  onClose: () => void;
}

const WEEKDAY_HEADERS = ["日", "一", "二", "三", "四", "五", "六"];

const QUICK_JUMPS: { label: string; months: number }[] = [
  { label: "今天", months: 0 },
  { label: "1月前", months: -1 },
  { label: "2月前", months: -2 },
  { label: "3月前", months: -3 },
];

export default function DatePicker({ value, onChange, onClose }: DatePickerProps) {
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date();

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const quickJump = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const isToday = (day: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  const isSelected = (day: number) =>
    value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === day;

  const dayStyle = (day: number): React.CSSProperties => {
    if (isSelected(day)) return { ...base.day, ...base.daySelected };
    if (isToday(day)) return { ...base.day, ...base.dayToday };
    return base.day;
  };

  return (
    <div style={base.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={base.modal}>
        {/* Header */}
        <div style={base.header}>
          <button onClick={prevMonth} style={base.arrow} aria-label="上个月">◀</button>
          <span style={base.monthYear}>
            {viewYear}年 {viewMonth + 1}月
          </span>
          <button onClick={nextMonth} style={base.arrow} aria-label="下个月">▶</button>
        </div>

        {/* Weekday headers */}
        <div style={base.weekRow}>
          {WEEKDAY_HEADERS.map((w) => (
            <div key={w} style={base.weekCell}>{w}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={base.grid}>
          {days.map((day, i) => (
            <div key={i} style={day ? dayStyle(day) : base.emptyCell}>
              {day && (
                <button
                  onClick={() => onChange(new Date(viewYear, viewMonth, day))}
                  style={base.dayBtn}
                >{day}</button>
              )}
            </div>
          ))}
        </div>

        {/* Quick jumps */}
        <div style={base.quickRow}>
          {QUICK_JUMPS.map((q) => (
            <button key={q.label} onClick={() => quickJump(q.months)} style={base.quickBtn}>
              {q.label}
            </button>
          ))}
        </div>

        {/* Close */}
        <div style={base.footer}>
          <button onClick={onClose} style={base.cancelBtn}>取消</button>
        </div>
      </div>
    </div>
  );
}

const base: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, zIndex: 50,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)",
    animation: "fadeIn 0.2s ease",
  },
  modal: {
    width: "100%", maxWidth: 360, margin: "0 16px",
    background: "var(--bg)", boxShadow: "var(--shadow-raised-lg)",
    borderRadius: 20, padding: 20,
    animation: "scaleIn 0.25s ease both",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    marginBottom: 16,
  },
  arrow: {
    width: 44, height: 44, borderRadius: 12,
    background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
    border: "none", cursor: "pointer", fontSize: 16,
    color: "var(--text-secondary)", display: "flex",
    alignItems: "center", justifyContent: "center",
    touchAction: "manipulation",
  },
  monthYear: {
    fontSize: 16, fontWeight: 700, color: "var(--text)",
    fontFamily: "var(--font-noto-serif-sc), 'Noto Serif SC', serif",
  },
  weekRow: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
    marginBottom: 4,
  },
  weekCell: {
    textAlign: "center", fontSize: 11, fontWeight: 600,
    color: "var(--text-muted)", padding: "6px 0",
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
    gap: 2,
  },
  emptyCell: {
    aspectRatio: "1",
  },
  day: {
    aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 12, transition: "all 0.2s ease",
  },
  daySelected: {
    background: "var(--accent)", color: "#fff", fontWeight: 700,
    boxShadow: "var(--shadow-accent)",
  },
  dayToday: {
    background: "var(--accent-bg)", fontWeight: 600,
  },
  dayBtn: {
    width: "100%", height: "100%", border: "none", cursor: "pointer",
    background: "transparent", color: "inherit", fontSize: 14,
    fontFamily: "inherit", borderRadius: 12, padding: 0,
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent" as any,
  },
  quickRow: {
    display: "flex", justifyContent: "center", gap: 8,
    marginTop: 16, paddingTop: 16,
    borderTop: "1px solid var(--border-light, rgba(0,0,0,0.06))",
  },
  quickBtn: {
    padding: "8px 14px", borderRadius: 999,
    background: "var(--bg)", boxShadow: "var(--shadow-raised-sm)",
    border: "none", cursor: "pointer", fontSize: 13,
    fontWeight: 500, color: "var(--text-secondary)",
    fontFamily: "inherit", touchAction: "manipulation",
    whiteSpace: "nowrap" as const,
  },
  footer: {
    display: "flex", justifyContent: "center", marginTop: 12,
  },
  cancelBtn: {
    padding: "10px 32px", borderRadius: 12,
    background: "transparent", border: "none", cursor: "pointer",
    fontSize: 14, fontWeight: 500, color: "var(--text-secondary)",
    fontFamily: "inherit", touchAction: "manipulation",
  },
};
