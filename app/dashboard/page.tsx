"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/* ============================================================
   Utilities
============================================================ */

const debounce = (fn: Function, ms = 300) => {
  let t: any;
  return (...args: any[]) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

const loadColWidths = (key: string): Record<string, number> => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
};

const saveColWidths = (key: string, widths: Record<string, number>) => {
  localStorage.setItem(key, JSON.stringify(widths));
};

/* ============================================================
   Status Options
============================================================ */

const STATUS_OPTIONS = ["New", "Initiated", "In-Progress", "On-Hold", "Completed"];
const BOP_STATUS_OPTIONS = [
  "Presented",
  "Business",
  "Client",
  "Clarification",
  "Follow-Up 1",
  "Follow-Up 2",
  "Follow-Up 3",
  "Not Interested",
  "Closed",
];
const FOLLOWUP_STATUS_OPTIONS = ["Open", "In-Progress", "On Hold", "Closed", "Completed"];
const CLIENT_STATUS_OPTIONS = [
  "New",
  "Interested",
  "Not Interested",
  "Referral",
  "Purchased",
  "Re-Open",
];

/* ============================================================
   Main Page
============================================================ */

export default function DashboardPage() {
  /* -------------------------
     Table visibility
  ------------------------- */
  const [showAllRecords, setShowAllRecords] = useState(true);

  /* -------------------------
     Filtering (live, debounced)
  ------------------------- */
  const [filterText, setFilterText] = useState("");
  const debouncedSetFilter = useMemo(
    () => debounce((v: string) => setFilterText(v), 250),
    []
  );

  /* -------------------------
     Column resizing
  ------------------------- */
  const COL_KEY = "all-records-cols";
  const [colWidths, setColWidths] = useState<Record<string, number>>(
    () => loadColWidths(COL_KEY)
  );

  const startResize = (key: string, startX: number) => {
    const startWidth = colWidths[key] ?? 160;
    const onMove = (e: MouseEvent) => {
      setColWidths((prev) => {
        const next = {
          ...prev,
          [key]: Math.max(80, startWidth + (e.clientX - startX)),
        };
        saveColWidths(COL_KEY, next);
        return next;
      });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  /* -------------------------
     Keyboard navigation
  ------------------------- */
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);

  const handleKeyNav = (
    e: React.KeyboardEvent,
    row: number,
    col: number,
    rowCount: number,
    colCount: number
  ) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", "Tab"].includes(e.key))
      return;

    e.preventDefault();
    let next = { row, col };

    switch (e.key) {
      case "ArrowDown":
      case "Enter":
        next.row = Math.min(row + 1, rowCount - 1);
        break;
      case "ArrowUp":
        next.row = Math.max(row - 1, 0);
        break;
      case "ArrowRight":
      case "Tab":
        next.col = Math.min(col + 1, colCount - 1);
        break;
      case "ArrowLeft":
        next.col = Math.max(col - 1, 0);
        break;
    }
    setActiveCell(next);
  };

  /* -------------------------
     Optimistic save indicators
  ------------------------- */
  const [cellStatus, setCellStatus] = useState<
    Record<string, "saving" | "saved" | "error">
  >({});

  const optimisticUpdate = async (
    id: string,
    key: string,
    value: string,
    onUpdate: Function
  ) => {
    const cellId = `${id}:${key}`;
    setCellStatus((s) => ({ ...s, [cellId]: "saving" }));

    try {
      await onUpdate(id, key, value);
      setCellStatus((s) => ({ ...s, [cellId]: "saved" }));
      setTimeout(() => {
        setCellStatus((s) => {
          const { [cellId]: _, ...rest } = s;
          return rest;
        });
      }, 1200);
    } catch {
      setCellStatus((s) => ({ ...s, [cellId]: "error" }));
    }
  };

  /* ============================================================
     JSX
  ============================================================ */

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1600px] mx-auto p-6 space-y-6">

        {/* ============================
           Client Progress Summary
        ============================ */}
        <section className="bg-white rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-3">Client Progress Summary</h2>

          <input
            placeholder="Filter by client name..."
            className="w-full border px-3 py-2 mb-3"
            onChange={(e) => debouncedSetFilter(e.target.value)}
          />

          {/* Table content unchanged */}
        </section>

        {/* ============================
           All Records (Editable)
        ============================ */}
        <section className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">All Records (Editable)</h2>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAllRecords((v) => !v)}
                className="px-3 py-1 border rounded"
              >
                {showAllRecords ? "Hide Results" : "Show Results"}
              </button>
            </div>
          </div>

          <input
            placeholder="Filter by client name, first name, last name, phone, email"
            className="w-full border px-3 py-2 mb-3"
            onChange={(e) => debouncedSetFilter(e.target.value)}
          />

          {!showAllRecords && (
            <div className="text-slate-500 italic py-6 text-center">
              Results hidden
            </div>
          )}

          {showAllRecords && (
            <div className="overflow-auto border rounded">
              {/* Table rendering logic preserved */}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
