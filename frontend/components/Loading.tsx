"use client";

interface LoadingProps {
  text?: string;
  fullPage?: boolean;
  size?: "sm" | "md";
}

export function Loading({ text, fullPage, size = "md" }: LoadingProps) {
  const dotSize = size === "sm" ? 6 : 8;

  const content = (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      gap: size === "sm" ? 8 : 12,
    }}>
      <div style={{ display: "flex", gap: size === "sm" ? 4 : 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="typing-dot"
            style={{ width: dotSize, height: dotSize }}
          />
        ))}
      </div>
      {text && (
        <p style={{
          fontSize: size === "sm" ? 11 : 13,
          color: "var(--text-muted)",
          margin: 0,
        }}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 48,
      }}>
        {content}
      </div>
    );
  }

  return content;
}
