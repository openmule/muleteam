"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResizablePanelProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number; // 0-1, left panel ratio
  minRatio?: number;
  maxRatio?: number;
  storageKey?: string;
  className?: string;
}

export function ResizablePanel({
  left,
  right,
  defaultRatio = 0.4,
  minRatio = 0.25,
  maxRatio = 0.75,
  storageKey = "muleteam:panel-ratio",
  className,
}: ResizablePanelProps) {
  const [ratio, setRatio] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return Math.max(minRatio, Math.min(maxRatio, Number(saved)));
    }
    return defaultRatio;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const newRatio = Math.max(minRatio, Math.min(maxRatio, x / rect.width));
        setRatio(newRatio);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [minRatio, maxRatio]
  );

  useEffect(() => {
    sessionStorage.setItem(storageKey, String(ratio));
  }, [ratio, storageKey]);

  return (
    <div ref={containerRef} className={`flex flex-1 overflow-hidden ${className ?? ""}`}>
      <div className="flex flex-col min-w-0 overflow-hidden" style={{ flexBasis: `${ratio * 100}%` }}>
        {left}
      </div>
      <div
        className="shrink-0 w-1 bg-border hover:bg-primary/30 cursor-col-resize transition-colors relative group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  );
}
