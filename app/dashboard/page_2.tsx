
*** Begin Patch
*** Update File: app/dashboard/page_2.tsx
@@
 function toggleProgressSort(
   cur: { key: ProgressSortKey; dir: SortDir },
   k: ProgressSortKey
 ) {
-  if (cur.key !== k) return { key: k, dir: "asc" as SortDir };
+  // Start with DESC for date columns in Client Progress Summary
+  const DESC_FIRST = new Set<ProgressSortKey>([
+    "last_call_date",
+    "last_bop_date",
+    "last_followup_date",
+  ]);
+  if (cur.key !== k) {
+    return {
+      key: k,
+      dir: (DESC_FIRST.has(k) ? "desc" : "asc") as SortDir,
+    };
+  }
   return { key: k, dir: cur.dir === "asc" ? ("desc" as SortDir) : ("asc" as SortDir) };
 }
@@
         {/* Header */}
         <header className="flex items-center justify-between gap-3">
           <div className="flex items-center gap-3">
-            {/* Logo — ensure it shows */}
-            /can-logo.png
+            {/* Logo — render image so it displays properly */}
+            /can-logo.png
             <div>
               <div className="text-2xl font-bold text-slate-800">CAN Financial Solutions Clients Report</div>
               {/* Subtitle in normal weight */}
               <div className="text-sm text-slate-500">Protecting Your Tomorrow</div>
             </div>
           </div>
@@
         <Card title="All Records (Editable)">
           <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-2">
             <div className="flex flex-col md:flex-row md:items-center gap-2 w-full">
               <input
                 className="w-80 border border-slate-300 px-3 py-2"
                 placeholder="Search by first name, last name, or phone"
                 value={q}
                 onChange={(e) => setQ(e.target.value)}
               />
               <Button variant="secondary" onClick={() => loadPage(0)}>
                 Go
               </Button>
               <Button
                 variant="secondary"
                 onClick={() => {
                   setQ("");
                   loadPage(0);
                   setRecordsVisible(true);
                 }}
               >
                 Refresh
               </Button>
               <Button variant="secondary" onClick={() => setRecordsVisible((v) => !v)}>
                 {recordsVisible ? "Hide Results" : "Show Results"}
               </Button>
             </div>
 
-            <div className="flex items-center gap-2">
-              <div className="text-xs text-slate-600">
-                Click headers to sort: <b>Client Name</b>, <b>Created Date</b>, <b>BOP Date</b>,{" "}
-                <b>BOP Status</b>, <b>Follow-Up Date</b>, <b>Status</b>.
-              </div>
+            <div className="flex items-center gap-2">
               <div className="flex items-center gap-2 border border-slate-300 px-3 py-2 bg-white">
                 <span className="text-xs font-semibold text-slate-600">Go to page</span>
                 <input
                   type="number"
                   min={1}
                   max={totalPages}
                   className="w-20 border border-slate-300 px-2 py-1 text-sm"
                   value={pageJump}
                   onChange={(e) => setPageJump(e.target.value)}
                 />
                 <Button
                   variant="secondary"
                   onClick={() => {
                     const n = Number(pageJump);
                     if (!Number.isFinite(n)) return;
                     const p = Math.min(totalPages, Math.max(1, Math.floor(n)));
                     loadPage(p - 1);
                   }}
                   disabled={loading || totalPages <= 1}
                 >
                   Go
                 </Button>
               </div>
               <Button
                 variant="secondary"
                 onClick={() => loadPage(Math.max(0, page - 1))}
                 disabled={!canPrev || loading}
               >
                 Previous
               </Button>
               <Button
                 variant="secondary"
                 onClick={() => loadPage(page + 1)}
                 disabled={!canNext || loading}
               >
                 Next
               </Button>
             </div>
           </div>
 
           <div className="text-sm text-slate-600 mb-2">
             {total.toLocaleString()} records • showing {ALL_PAGE_SIZE} per page
           </div>
+          {/* Sort help — one line, right aligned above the table */}
+          <div className="flex justify-end mb-2">
+            <div className="text-xs text-slate-600">
+              Click headers to sort: <b>Client Name</b>, <b>Created Date</b>, <b>BOP Date</b>,{" "}
+              <b>BOP Status</b>, <b>Follow-Up Date</b>, <b>Status</b>.
+            </div>
+          </div>
 
           {recordsVisible && (
             <>
               {loading ? (
                 <div className="text-slate-600">Loading…</div>
               ) : (
                 <ExcelTableEditable
                   rows={records}
                   savingId={savingId}
                   onUpdate={updateCell}
                   extraLeftCols={[{ label: "Client Name", sortable: "client", render: (r) => clientName(r) }]}
                   maxHeightClass="max-h-[560px]"
                   sortState={sortAll}
                   onSortChange={(k) => setSortAll((cur) => toggleSort(cur, k))}
                   stickyLeftCount={1}
                 />
               )}
             </>
           )}
         </Card>
@@
 function ExcelTableEditable({
@@
 }) {
   const { widths, startResize } = useColumnResizer();
   const [openCell, setOpenCell] = useState<string | null>(null);
   const [drafts, setDrafts] = useState<Record<string, string>>({});
@@
+  // Word-wrap keys (editable multi-line text)
+  const WRAP_KEYS = new Set([
+    "referred_by",
+    "product",
+    "comment",
+    "remark",
+    "Comment", // handle possible variations from API
+    "Remark",
+    "Product",
+  ]);
@@
   const columns = useMemo(() => {
@@
     const main = keys.map((k) => {
       const label = labelFor(k);
       const isDateTime = DATE_TIME_KEYS.has(k);
       const defaultW =
         k === "created_at"
           ? 120
           : isDateTime
           ? 220
-          : k.toLowerCase().includes("email")
+          : k.toLowerCase().includes("email")
           ? 240
-          : 160;
+          : WRAP_KEYS.has(k)
+          ? 260   // give wrap columns a bit more room by default
+          : 160;
@@
   const getCellValueForInput = (r: Row, k: string) => {
     const isDateTime = DATE_TIME_KEYS.has(k);
     const val = r[k];
     if (isDateTime) return toLocalInput(val);
     return val ?? "";
   };
@@
-  const handleBlur = async (rowId: string, key: string, cellId: string) => {
+  // Map UI key variants to backend column names when saving (UI-only normalization)
+  const KEY_ALIASES: Record<string, string> = {
+    Comment: "comment",
+    Remark: "remark",
+    Product: "product",
+    ReferredBy: "referred_by",
+  };
+  const handleBlur = async (rowId: string, key: string, cellId: string) => {
     const v = drafts[cellId] ?? "";
     try {
-      await onUpdate(String(rowId), key, v);
+      const mappedKey = KEY_ALIASES[key] ?? key;
+      await onUpdate(String(rowId), mappedKey, v);
     } finally {
       setDrafts((prev) => {
         const next = { ...prev };
         delete next[cellId];
         return next;
       });
     }
   };
@@
                 // ---- EDITABLE CELLS (status dropdowns + datetime-local; save on blur) ----
                 const cellId = `${r.id}:${k}`;
                 const isDateTime = DATE_TIME_KEYS.has(k);
                 const value =
                   drafts[cellId] !== undefined ? drafts[cellId] : String(getCellValueForInput(r, k));
 
                 // Status dropdowns
                 const statusOptions = optionsForKey(k);
                 if (statusOptions) {
                   return (
                     <td key={c.id} className="border border-slate-300 px-2 py-2" style={style}>
                       <select
                         className="w-full bg-transparent border-0 outline-none text-sm"
                         value={value ?? ""}
                         onChange={(e) =>
                           setDrafts((prev) => ({ ...prev, [cellId]: e.target.value }))
                         }
                         onBlur={() => handleBlur(String(r.id), k, cellId)}
                         disabled={savingId != null && String(savingId) === String(r.id)}
                       >
                         {statusOptions.map((opt, idx) => (
                           <option key={`${k}:${idx}:${opt}`} value={opt}>
                             {opt || "—"}
                           </option>
                         ))}
                       </select>
                     </td>
                   );
                 }
 
-                return (
-                  <td key={c.id} className="border border-slate-300 px-2 py-2" style={style}>
-                    <input
-                      type={isDateTime ? "datetime-local" : "text"}
-                      step={isDateTime ? 60 : undefined}
-                      className="w-full bg-transparent border-0 outline-none text-sm"
-                      value={value}
-                      onChange={(e) =>
-                        setDrafts((prev) => ({ ...prev, [cellId]: e.target.value }))
-                      }
-                      onBlur={() => handleBlur(String(r.id), k, cellId)}
-                      disabled={savingId != null && String(savingId) === String(r.id)}
-                    />
-                  </td>
-                );
+                // Multi-line textareas for wrap keys (word-wrap + Shift+Enter new lines)
+                if (WRAP_KEYS.has(k)) {
+                  const wrapStyle: React.CSSProperties = {
+                    ...style,
+                    whiteSpace: "pre-wrap",
+                    wordBreak: "break-word",
+                  };
+                  return (
+                    <td key={c.id} className="border border-slate-300 px-2 py-2" style={wrapStyle}>
+                      <textarea
+                        rows={1}
+                        className="w-full bg-transparent border-0 outline-none text-sm whitespace-pre-wrap break-words resize-none"
+                        value={value}
+                        onChange={(e) =>
+                          setDrafts((prev) => ({ ...prev, [cellId]: e.target.value }))
+                        }
+                        onKeyDown={(e) => {
+                          // Allow Shift+Enter to insert a newline; prevent accidental submit
+                          if (e.key === "Enter" && e.shiftKey) {
+                            // default behavior inserts newline in textarea
+                          }
+                        }}
+                        onBlur={() => handleBlur(String(r.id), k, cellId)}
+                        disabled={savingId != null && String(savingId) === String(r.id)}
+                      />
+                    </td>
+                  );
+                }
+
+                // Default editable input
+                return (
+                  <td key={c.id} className="border border-slate-300 px-2 py-2" style={style}>
+                    <input
+                      type={isDateTime ? "datetime-local" : "text"}
+                      step={isDateTime ? 60 : undefined}
+                      className="w-full bg-transparent border-0 outline-none text-sm"
+                      value={value}
+                      onChange={(e) =>
+                        setDrafts((prev) => ({ ...prev, [cellId]: e.target.value }))
+                      }
+                      onBlur={() => handleBlur(String(r.id), k, cellId)}
+                      disabled={savingId != null && String(savingId) === String(r.id)}
+                    />
+                  </td>
+                );
*** End Patch
