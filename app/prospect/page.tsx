"use client";

import { useState } from "react";
import ProspectCard from "./ProspectCard";
import ProspectTable from "./ProspectTable";

export default function Page() {
  const [prospects, setProspects] = useState([]);
  const [selected, setSelected] = useState(null); // selected row
  const [showCard, setShowCard] = useState(false);
  const [mode, setMode] = useState<"new" | "edit" | null>(null);
  const [highlightId, setHighlightId] = useState(null);
  const [search, setSearch] = useState("");

  // -----------------------------
  // HANDLERS
  // -----------------------------

  const handleRowSelect = (row) => {
    setSelected(row);
    setMode("edit");
    setShowCard(true);
  };

  const handleNewProspect = () => {
    setSelected(null);
    setMode("new");
    setShowCard(true);
  };

  const handleSave = (data) => {
    if (mode === "edit") {
      // update existing
      const updated = prospects.map((p) =>
        p.id === data.id ? data : p
      );
      setProspects(updated);
      setHighlightId(data.id);
    }

    if (mode === "new") {
      // add new
      const newProspect = {
        ...data,
        id: Date.now(),
      };
      setProspects([...prospects, newProspect]);
      setHighlightId(newProspect.id);
    }

    setShowCard(true); // keep card open
  };

  const handleCancel = () => {
    setShowCard(false);
    setSelected(null);
    setMode(null);
  };

  const handleRefresh = () => {
    setShowCard(false);
    setSelected(null);
    setMode(null);
    setSearch("");
    setHighlightId(null);
  };

  // -----------------------------
  // RENDER
  // -----------------------------

  return (
    <div className="p-6 space-y-6">

      {/* Top Bar */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Prospects</h1>

        {/* EDIT BUTTON (only when row selected) */}
        {selected && !showCard && (
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={() => {
              setMode("edit");
              setShowCard(true);
            }}
          >
            Edit Prospect
          </button>
        )}

        {/* REFRESH BUTTON */}
        <button
          className="px-4 py-2 bg-gray-300 rounded"
          onClick={handleRefresh}
        >
          Refresh
        </button>
      </div>

      {/* SEARCH BAR */}
      <input
        type="text"
        placeholder="Search prospects..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border p-2 rounded w-full"
      />

      {/* TABLE */}
      <ProspectTable
        data={prospects.filter((p) =>
          p.name?.toLowerCase().includes(search.toLowerCase())
        )}
        onRowSelect={handleRowSelect}
        highlightId={highlightId}
      />

      {/* NEW PROSPECT BUTTON (hidden when editing) */}
      {!showCard && (
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={handleNewProspect}
        >
          New Prospect
        </button>
      )}

      {/* PROSPECT CARD */}
      {showCard && (
        <ProspectCard
          mode={mode}
          data={selected}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
