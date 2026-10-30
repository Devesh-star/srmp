"use client";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  parseSimulatorParams,
  buildSimulatorUrl,
  moveItem,
  describeChange,
} from "@/lib/charts/helpers";
import { useReducedMotion } from "@/lib/ui/useReducedMotion";
import { getLevelBadgeClasses } from "@/lib/ui/levelStyles";
import { roundTo, MAX_SCORE, RiskLevel } from "@/lib/riskEngine";

interface RiskSummaryItem {
  id: string;
  riskId: string;
  asset: { id: string; name: string; type: string };
  threat: { key: string; name: string; ciaTarget: string };
  vulnerability: { key: string; name: string; severity: string };
  likelihood: number;
  impact: number;
  inherentScore: number;
  inherentLevel: RiskLevel;
  residualScore: number;
  residualLevel: RiskLevel;
  treatment: string;
  status: string;
  controls: Array<{
    key: string;
    name: string;
    category: string;
    reduces: "likelihood" | "impact";
    effectiveness: number;
    implementationCost: string;
    status: "planned" | "implemented";
    implementedAt: string | null;
  }>;
}

interface ControlCatalogItem {
  key: string;
  name: string;
  category: string;
  reduces: "likelihood" | "impact";
  effectiveness: number;
  implementationCost: string;
}

interface SimulationStepDTO {
  controlKey: string;
  controlName: string;
  reduces: "likelihood" | "impact";
  effectiveness: number;
  likelihood: number;
  impact: number;
  scoreBefore: number;
  scoreAfter: number;
  delta: number;
  levelAfter: RiskLevel;
}

interface SimulationDTO {
  riskId: string;
  treatment: string;
  baseline: {
    likelihood: number;
    impact: number;
    score: number;
    level: RiskLevel;
  };
  steps: SimulationStepDTO[];
  final: {
    likelihood: number;
    impact: number;
    score: number;
    level: RiskLevel;
  };
  current: {
    likelihood: number;
    impact: number;
    score: number;
    level: RiskLevel;
  };
}

export function SimulatorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [, startTransition] = useTransition();

  // Parse Initial URL
  const initial = parseSimulatorParams(searchParams.toString());
  const [selectedRiskId, setSelectedRiskId] = useState<string | undefined>(initial.riskId);
  const [orderedControlKeys, setOrderedControlKeys] = useState<string[]>(initial.controls);

  // Risk Search Combobox State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RiskSummaryItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Example clickable suggestions (resolved dynamically)
  const [exampleRisks, setExampleRisks] = useState<Array<{ riskId: string; label: string }>>([]);

  // Loaded Risk Detail
  const [activeRisk, setActiveRisk] = useState<RiskSummaryItem | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);

  // Controls Catalogs
  const [recommendedControls, setRecommendedControls] = useState<ControlCatalogItem[]>([]);
  const [otherControls, setOtherControls] = useState<ControlCatalogItem[]>([]);
  const [otherControlsSearch, setOtherControlsSearch] = useState("");
  const [controlsTotalCount, setControlsTotalCount] = useState(0);

  // Simulation State
  const [simulation, setSimulation] = useState<SimulationDTO | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [announcement, setAnnouncement] = useState("");

  // Keep URL in sync with state
  const syncUrl = useCallback(
    (riskId?: string, keys: string[] = []) => {
      const url = buildSimulatorUrl(riskId, keys);
      startTransition(() => {
        router.replace(url, { scroll: false });
      });
    },
    [router]
  );

  // Fetch initial example risks for the empty state dynamically
  useEffect(() => {
    async function loadExamples() {
      try {
        const res = await fetch("/api/risks?limit=25");
        if (!res.ok) return;
        const data = await res.json();
        const items = data.items || [];
        const examples: Array<{ riskId: string; label: string }> = [];

        // 1. Student Database risk
        const studentRisk = items.find(
          (r: RiskSummaryItem) =>
            r.asset?.name?.toLowerCase().includes("student database") ||
            r.asset?.name?.toLowerCase().includes("student")
        );
        if (studentRisk) {
          examples.push({
            riskId: studentRisk.riskId,
            label: `${studentRisk.riskId} (${studentRisk.asset.name} - ${studentRisk.threat.name})`,
          });
        }

        // 2. First Ransomware risk
        const ransomRisk = items.find(
          (r: RiskSummaryItem) =>
            r.threat?.name?.toLowerCase().includes("ransomware") &&
            r.riskId !== studentRisk?.riskId
        );
        if (ransomRisk) {
          examples.push({
            riskId: ransomRisk.riskId,
            label: `${ransomRisk.riskId} (${ransomRisk.asset.name} - ${ransomRisk.threat.name})`,
          });
        }

        // If either is missing, fill with first available
        if (examples.length === 0 && items.length > 0) {
          examples.push({
            riskId: items[0].riskId,
            label: `${items[0].riskId} (${items[0].asset?.name} - ${items[0].threat?.name})`,
          });
        }
        setExampleRisks(examples);
      } catch {
        // Ignore fallback
      }
    }
    loadExamples();
  }, []);

  // Fetch combobox search results debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/risks?q=${encodeURIComponent(searchQuery.trim())}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
          setDropdownOpen(true);
          setHighlightedIndex(0);
        }
      } catch {
        // Ignore search error
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for combobox
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load selected risk and control catalogs
  const loadRisk = useCallback(
    async (riskId: string, customInitialKeys?: string[]) => {
      setRiskLoading(true);
      setRiskError(null);
      setActiveRisk(null);
      setSimulation(null);

      try {
        const res = await fetch(`/api/risks/${riskId}`);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Failed to load risk");
        }
        const data: RiskSummaryItem = await res.json();
        setActiveRisk(data);

        // Fetch recommendations for this risk
        try {
          const recRes = await fetch(
            `/api/recommendations?assetType=${data.asset.type}&threatKey=${data.threat.key}&vulnerabilityKey=${data.vulnerability.key}`
          );
          if (recRes.ok) {
            const recData = await recRes.json();
            setRecommendedControls(recData.controls || []);
          }
        } catch {
          // Soft fail for recommendations
        }

        // Fetch general controls catalog
        try {
          const ctlRes = await fetch("/api/controls?limit=100");
          if (ctlRes.ok) {
            const ctlData = await ctlRes.json();
            setOtherControls(ctlData.items || []);
            setControlsTotalCount(ctlData.total || (ctlData.items || []).length);
          }
        } catch {
          // Soft fail for controls
        }

        // Determine initial keys
        let keysToUse = customInitialKeys;
        if (!keysToUse || keysToUse.length === 0) {
          // Default: risk's IMPLEMENTED controls ordered by implementedAt
          const implemented = data.controls
            .filter((c) => c.status === "implemented")
            .sort((a, b) => {
              if (!a.implementedAt) return 1;
              if (!b.implementedAt) return -1;
              return new Date(a.implementedAt).getTime() - new Date(b.implementedAt).getTime();
            })
            .map((c) => c.key);
          keysToUse = implemented;
        }

        setOrderedControlKeys(keysToUse);
        syncUrl(riskId, keysToUse);
      } catch (err: unknown) {
        setRiskError((err as Error).message);
      } finally {
        setRiskLoading(false);
      }
    },
    [syncUrl]
  );

  // Trigger load when selectedRiskId changes
  useEffect(() => {
    if (selectedRiskId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadRisk(selectedRiskId, orderedControlKeys.length > 0 ? orderedControlKeys : undefined);
    }
  }, [selectedRiskId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execute Simulation with AbortController and 300ms debounce
  const runSimulation = useCallback(
    async (riskId: string, keys: string[]) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setSimLoading(true);
      setSimError(null);

      try {
        const res = await fetch(`/api/risks/${riskId}/simulate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ controlKeys: keys }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "Simulation request failed");
        }

        const data: SimulationDTO = await res.json();
        setSimulation(data);

        // Announce for screen readers
        const diffFromInherent = roundTo(data.baseline.score - data.final.score, 1);
        setAnnouncement(
          `What-if risk score is ${roundTo(data.final.score, 1)}, ${data.final.level} severity, down ${diffFromInherent} points from inherent.`
        );
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setSimError((err as Error).message);
        }
      } finally {
        setSimLoading(false);
      }
    },
    []
  );

  // Trigger runSimulation whenever orderedControlKeys changes
  useEffect(() => {
    if (!activeRisk) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runSimulation(activeRisk.riskId, orderedControlKeys);
    }, 300);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [activeRisk, orderedControlKeys, runSimulation]);

  // Handle Control Toggle
  const handleToggleControl = (key: string) => {
    if (orderedControlKeys.includes(key)) {
      const next = orderedControlKeys.filter((k) => k !== key);
      setOrderedControlKeys(next);
      syncUrl(activeRisk?.riskId, next);
    } else {
      if (orderedControlKeys.length >= 20) {
        return;
      }
      const next = [...orderedControlKeys, key];
      setOrderedControlKeys(next);
      syncUrl(activeRisk?.riskId, next);
    }
  };

  // Handle Reorder
  const handleMove = (index: number, direction: "up" | "down") => {
    const next = moveItem(orderedControlKeys, index, direction);
    setOrderedControlKeys(next);
    syncUrl(activeRisk?.riskId, next);
  };

  // Presets
  const applyPreset = (preset: "current" | "planned" | "recommended" | "clear") => {
    if (!activeRisk) return;
    let next: string[] = [];

    switch (preset) {
      case "current":
        next = activeRisk.controls
          .filter((c) => c.status === "implemented")
          .sort((a, b) => {
            if (!a.implementedAt) return 1;
            if (!b.implementedAt) return -1;
            return new Date(a.implementedAt).getTime() - new Date(b.implementedAt).getTime();
          })
          .map((c) => c.key);
        break;
      case "planned":
        next = activeRisk.controls.map((c) => c.key).slice(0, 20);
        break;
      case "recommended":
        next = Array.from(new Set(recommendedControls.map((c) => c.key))).slice(0, 20);
        break;
      case "clear":
        next = [];
        break;
    }

    setOrderedControlKeys(next);
    syncUrl(activeRisk.riskId, next);
  };

  // Keyboard navigation for combobox
  const handleComboboxKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setDropdownOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : searchResults.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        const chosen = searchResults[highlightedIndex];
        setSelectedRiskId(chosen.riskId);
        setSearchQuery("");
        setDropdownOpen(false);
      }
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
    }
  };

  // Find control details helper
  const getControlDetails = (key: string) => {
    const fromRisk = activeRisk?.controls.find((c) => c.key === key);
    if (fromRisk) {
      return {
        key: fromRisk.key,
        name: fromRisk.name,
        category: fromRisk.category,
        reduces: fromRisk.reduces,
        effectiveness: fromRisk.effectiveness,
        cost: fromRisk.implementationCost,
        stateTag: fromRisk.status === "implemented" ? "Implemented" : "Planned",
        isAttached: true,
      };
    }
    const fromRec = recommendedControls.find((c) => c.key === key);
    if (fromRec) {
      return {
        key: fromRec.key,
        name: fromRec.name,
        category: fromRec.category,
        reduces: fromRec.reduces,
        effectiveness: fromRec.effectiveness,
        cost: fromRec.implementationCost,
        stateTag: "Not attached",
        isAttached: false,
      };
    }
    const fromOther = otherControls.find((c) => c.key === key);
    if (fromOther) {
      return {
        key: fromOther.key,
        name: fromOther.name,
        category: fromOther.category,
        reduces: fromOther.reduces,
        effectiveness: fromOther.effectiveness,
        cost: fromOther.implementationCost,
        stateTag: "Not attached",
        isAttached: false,
      };
    }
    return {
      key,
      name: key,
      category: "Unknown",
      reduces: "likelihood" as const,
      effectiveness: 0,
      cost: "Medium",
      stateTag: "Not attached",
      isAttached: false,
    };
  };

  // Filter other controls by search term
  const filteredOtherControls = otherControls.filter((c) => {
    // Exclude recommended so they are not duplicate in the UI
    const isRec = recommendedControls.some((r) => r.key === c.key);
    if (isRec) return false;
    if (!otherControlsSearch.trim()) return true;
    const term = otherControlsSearch.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.key.toLowerCase().includes(term);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Screen Reader Announcement Region */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Page Title & Search Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>What-If Risk Simulator</span>
            <span className="text-xs bg-indigo-950 border border-indigo-700/60 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
              ⚡ Live Engine
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Simulate the multi-step risk mitigation impact of applying controls in sequence without modifying database records.
          </p>
        </div>

        {/* Search Combobox */}
        <div ref={comboboxRef} className="relative w-full md:w-96">
          <label htmlFor="risk-combobox" className="sr-only">
            Search and select a risk
          </label>
          <div className="relative">
            <input
              id="risk-combobox"
              type="text"
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-controls="risk-combobox-list"
              aria-autocomplete="list"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                if (!val.trim()) {
                  setSearchResults([]);
                  setIsSearching(false);
                }
                setDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setDropdownOpen(true);
              }}
              onKeyDown={handleComboboxKeyDown}
              placeholder="Search risk by ID, asset, or threat..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {isSearching && (
              <span className="absolute right-2.5 top-2.5 text-xs text-slate-400 animate-spin">
                ◌
              </span>
            )}
          </div>

          {/* Combobox Dropdown */}
          {dropdownOpen && searchResults.length > 0 && (
            <ul
              id="risk-combobox-list"
              role="listbox"
              className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-800 text-xs"
            >
              {searchResults.map((r, idx) => (
                <li
                  key={r.riskId}
                  role="option"
                  aria-selected={idx === highlightedIndex}
                  onClick={() => {
                    setSelectedRiskId(r.riskId);
                    setSearchQuery("");
                    setDropdownOpen(false);
                  }}
                  className={`p-2.5 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                    idx === highlightedIndex
                      ? "bg-indigo-600 text-white"
                      : "hover:bg-slate-800 text-slate-200"
                  }`}
                >
                  <div className="truncate">
                    <span className="font-mono font-bold mr-2 text-indigo-300">
                      {r.riskId}
                    </span>
                    <span className="font-semibold">{r.asset?.name}</span>
                    <span className="opacity-75 text-[11px] block truncate">
                      {r.threat?.name}
                    </span>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] border font-bold shrink-0 ${getLevelBadgeClasses(
                      r.residualLevel
                    )}`}
                  >
                    {r.residualLevel} ({roundTo(r.residualScore, 1)})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Empty State before risk selection */}
      {!selectedRiskId && !activeRisk && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-indigo-950/70 border border-indigo-700/50 flex items-center justify-center text-3xl mx-auto">
            ⚡
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Select a Risk Scenario</h2>
            <p className="text-sm text-slate-400 mt-2">
              Choose an active risk using the search bar above, or select one of these live scenarios to explore mitigation impact:
            </p>
          </div>

          {exampleRisks.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {exampleRisks.map((ex) => (
                <button
                  key={ex.riskId}
                  type="button"
                  onClick={() => setSelectedRiskId(ex.riskId)}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-indigo-300 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Risk Loading & Error States */}
      {riskLoading && (
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-xl p-8 flex items-center justify-center text-slate-400 text-sm animate-pulse">
          Loading risk scenario and library recommendations...
        </div>
      )}

      {riskError && (
        <div className="p-4 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center justify-between">
          <span>Failed to load risk: {riskError}</span>
          <button
            type="button"
            onClick={() => selectedRiskId && loadRisk(selectedRiskId)}
            className="px-3 py-1 bg-rose-900 hover:bg-rose-800 rounded text-white font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Simulator Workstation */}
      {activeRisk && (
        <div className="space-y-6">
          {/* Header Card for Chosen Risk */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-indigo-400 text-lg">
                    {activeRisk.riskId}
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-white font-bold text-base">{activeRisk.asset?.name}</span>
                  <span className="capitalize px-2 py-0.2 rounded text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
                    {activeRisk.asset?.type}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Threat: <span className="text-slate-200">{activeRisk.threat?.name}</span> • Vulnerability:{" "}
                  <span className="text-slate-200">{activeRisk.vulnerability?.name}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/risks/${activeRisk.riskId}`}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline"
                >
                  Open Risk in Register →
                </Link>
              </div>
            </div>

            {/* Inherent, Stored Residual and Treatment Pill */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Parameters
                </span>
                <span className="font-mono font-bold text-white text-sm">
                  L{activeRisk.likelihood} × I{activeRisk.impact}
                </span>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Inherent Baseline
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.2 rounded text-[10px] border font-bold ${getLevelBadgeClasses(activeRisk.inherentLevel)}`}>
                    {activeRisk.inherentLevel}
                  </span>
                  <span className="font-mono font-bold text-white text-sm">
                    {roundTo(activeRisk.inherentScore, 1)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Current Stored Residual
                </span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.2 rounded text-[10px] border font-bold ${getLevelBadgeClasses(activeRisk.residualLevel)}`}>
                    {activeRisk.residualLevel}
                  </span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {roundTo(activeRisk.residualScore, 1)}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Treatment / Status
                </span>
                <span className="capitalize font-bold text-indigo-300">
                  {activeRisk.treatment}
                </span>
                <span className="text-slate-500 text-[10px] ml-1">({activeRisk.status})</span>
              </div>
            </div>

            {/* Treatment & Status Banners (Spec Requirement) */}
            {activeRisk.treatment !== "mitigate" && (
              <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg text-xs text-amber-300 flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <span>
                  This risk uses the <strong>{activeRisk.treatment}</strong> treatment, so its stored residual ignores controls. The simulation shows what Mitigate would achieve.
                </span>
              </div>
            )}

            {activeRisk.status === "Closed" && (
              <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-slate-300 flex items-start gap-2">
                <span>🔒</span>
                <span>This risk is Closed. Simulation evaluates theoretical controls.</span>
              </div>
            )}
          </div>

          {/* Preset Buttons Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                Presets:
              </span>
              <button
                type="button"
                onClick={() => applyPreset("current")}
                className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
              >
                Current State
              </button>
              <button
                type="button"
                onClick={() => applyPreset("planned")}
                className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
              >
                Include Planned Too
              </button>
              <button
                type="button"
                onClick={() => applyPreset("recommended")}
                className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-indigo-300 border border-indigo-700/50 transition-colors"
              >
                All Recommended
              </button>
              <button
                type="button"
                onClick={() => applyPreset("clear")}
                className="px-3 py-1 rounded-md bg-slate-950 hover:bg-slate-800 text-xs font-semibold text-slate-400 hover:text-white border border-slate-800 transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="text-xs text-slate-400 font-medium">
              <span className="font-bold text-white font-mono">{orderedControlKeys.length}</span> of 20 max controls selected
            </div>
          </div>

          {/* Simulation Results Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Simulation Results</span>
                  {simLoading && (
                    <span className="text-xs text-indigo-400 animate-spin">◌</span>
                  )}
                </h2>
                <p className="text-xs text-slate-400">
                  Step-by-step risk compression evaluating diminishing returns per control
                </p>
              </div>

              {/* Summary Scores Pill */}
              {simulation && (
                <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 rounded-lg p-2.5">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-semibold">Inherent</span>
                    <span className="font-mono font-bold text-amber-400 text-xs">
                      {roundTo(simulation.baseline.score, 1)}
                    </span>
                  </div>
                  <span className="text-slate-600 font-bold">→</span>
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-semibold">What-If Final</span>
                    <span className="font-mono font-black text-indigo-400 text-sm">
                      {roundTo(simulation.final.score, 1)}
                    </span>
                  </div>
                  <span className="text-slate-600">•</span>
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded border block ${
                        simulation.final.score < simulation.current.score
                          ? "bg-emerald-950/80 border-emerald-700 text-emerald-400"
                          : simulation.final.score > simulation.current.score
                          ? "bg-rose-950/80 border-rose-700 text-rose-400"
                          : "bg-slate-800 border-slate-700 text-slate-300"
                      }`}
                    >
                      {describeChange(simulation.final.score - simulation.current.score).direction === "same"
                        ? "Same as current"
                        : `What-if is ${describeChange(simulation.final.score - simulation.current.score).text} from current`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {simError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-lg text-xs text-rose-300 flex items-center justify-between">
                <span>Simulation error: {simError}</span>
                <button
                  type="button"
                  onClick={() => runSimulation(activeRisk.riskId, orderedControlKeys)}
                  className="px-2.5 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded font-bold"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Step List Visualization */}
            {simulation && (
              <div className="space-y-3">
                {/* Baseline Row */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400 font-mono text-[11px]">
                      0
                    </span>
                    <div>
                      <span className="font-bold text-white text-sm">Baseline (Inherent Risk)</span>
                      <p className="text-[11px] text-slate-400">
                        Likelihood {simulation.baseline.likelihood} × Impact {simulation.baseline.impact}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:w-1/2">
                    <div className="flex-1">
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (simulation.baseline.score / MAX_SCORE) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.2 rounded text-[10px] border font-bold ${getLevelBadgeClasses(simulation.baseline.level)}`}>
                        {simulation.baseline.level}
                      </span>
                      <span className="font-mono font-black text-white text-sm w-10 text-right">
                        {roundTo(simulation.baseline.score, 1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Applied Steps */}
                {simulation.steps.map((step, idx) => {
                  const pct = Math.min(100, Math.max(0, (step.scoreAfter / MAX_SCORE) * 100));
                  const deltaNum = roundTo(step.delta, 2);

                  return (
                    <div
                      key={`${step.controlKey}-${idx}`}
                      className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-indigo-950 border border-indigo-700/60 flex items-center justify-center font-bold text-indigo-300 font-mono text-[11px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{step.controlName}</span>
                            <span className="font-mono text-[10px] text-indigo-400">
                              ({step.controlKey})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Reduces {step.reduces} by {step.effectiveness}% • Next: L{roundTo(step.likelihood, 2)} × I{roundTo(step.impact, 2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 sm:w-1/2">
                        <div className="flex-1">
                          <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-indigo-500 rounded-full ${
                                reducedMotion ? "" : "transition-all duration-300 ease-out"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-mono text-emerald-400 font-bold w-12 text-right">
                            {deltaNum > 0 ? `-${deltaNum}` : deltaNum === 0 ? "0" : `+${Math.abs(deltaNum)}`}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] border font-bold ${getLevelBadgeClasses(step.levelAfter)}`}>
                            {step.levelAfter}
                          </span>
                          <span className="font-mono font-black text-white text-sm w-10 text-right">
                            {roundTo(step.scoreAfter, 1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {simulation.steps.length === 0 && (
                  <p className="text-xs text-slate-500 italic p-3 text-center">
                    No controls currently applied. Select controls below to simulate their impact.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Two-Column Work Area: Applied Order (Left) vs Control Selection (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Applied In This Order (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <div className="border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white">Applied in this Order</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  The final score does not depend on order; per-step reductions do (diminishing returns).
                </p>
              </div>

              {orderedControlKeys.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No controls selected. Check controls in the catalog to add them.
                </div>
              ) : (
                <ul className="space-y-2" aria-label="Selected controls application order">
                  {orderedControlKeys.map((key, idx) => {
                    const ctl = getControlDetails(key);
                    return (
                      <li
                        key={key}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-slate-500 text-[10px] font-bold w-4">
                            {idx + 1}.
                          </span>
                          <div className="truncate">
                            <span className="font-semibold text-white truncate block">
                              {ctl.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Reduces {ctl.reduces} ({ctl.effectiveness}%)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMove(idx, "up")}
                            aria-label={`Move ${ctl.name} up`}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 font-bold"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === orderedControlKeys.length - 1}
                            onClick={() => handleMove(idx, "down")}
                            aria-label={`Move ${ctl.name} down`}
                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 font-bold"
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleControl(key)}
                            aria-label={`Remove ${ctl.name}`}
                            className="p-1 rounded bg-slate-950 hover:bg-rose-950/80 border border-slate-800 text-slate-400 hover:text-rose-300 font-bold ml-1"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Right Column: Control Selection Catalogs (7 cols) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-white">Select Controls to Simulate</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Select up to 20 controls. Tag indicates attachment status on this risk scenario.
                </p>
              </div>

              {/* Group 1: Recommended for this risk */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 block">
                  Recommended for this risk ({recommendedControls.length})
                </span>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {recommendedControls.map((ctl) => {
                    const isChecked = orderedControlKeys.includes(ctl.key);
                    const disabled = !isChecked && orderedControlKeys.length >= 20;
                    const fromRisk = activeRisk.controls.find((c) => c.key === ctl.key);
                    const stateTag = fromRisk
                      ? fromRisk.status === "implemented"
                        ? "Implemented"
                        : "Planned"
                      : "Not attached";

                    return (
                      <label
                        key={ctl.key}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-indigo-950/40 border-indigo-700/60"
                            : "bg-slate-950/50 border-slate-800 hover:bg-slate-800/40"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={disabled}
                            onChange={() => handleToggleControl(ctl.key)}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="truncate">
                            <span className="font-semibold text-white truncate block">
                              {ctl.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Reduces {ctl.reduces} • {ctl.effectiveness}% eff • Cost: {ctl.implementationCost}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] border font-bold ${
                              stateTag === "Implemented"
                                ? "bg-emerald-950/80 text-emerald-400 border-emerald-700"
                                : stateTag === "Planned"
                                ? "bg-indigo-950/80 text-indigo-300 border-indigo-700"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {stateTag}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Other Controls */}
              <div className="space-y-2 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Other Controls ({otherControls.length})
                  </span>
                  <input
                    type="text"
                    value={otherControlsSearch}
                    onChange={(e) => setOtherControlsSearch(e.target.value)}
                    placeholder="Filter other controls..."
                    className="w-48 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {controlsTotalCount > 100 && (
                  <p className="text-[11px] text-slate-500 italic">
                    Showing the first 100; refine your search
                  </p>
                )}

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {filteredOtherControls.map((ctl) => {
                    const isChecked = orderedControlKeys.includes(ctl.key);
                    const disabled = !isChecked && orderedControlKeys.length >= 20;
                    const fromRisk = activeRisk.controls.find((c) => c.key === ctl.key);
                    const stateTag = fromRisk
                      ? fromRisk.status === "implemented"
                        ? "Implemented"
                        : "Planned"
                      : "Not attached";

                    return (
                      <label
                        key={ctl.key}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-indigo-950/40 border-indigo-700/60"
                            : "bg-slate-950/50 border-slate-800 hover:bg-slate-800/40"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={disabled}
                            onChange={() => handleToggleControl(ctl.key)}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="truncate">
                            <span className="font-semibold text-white truncate block">
                              {ctl.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Reduces {ctl.reduces} • {ctl.effectiveness}% eff • Cost: {ctl.implementationCost}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] border font-bold ${
                              stateTag === "Implemented"
                                ? "bg-emerald-950/80 text-emerald-400 border-emerald-700"
                                : stateTag === "Planned"
                                ? "bg-indigo-950/80 text-indigo-300 border-indigo-700"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {stateTag}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Not Attached Yet Banner (Spec Requirement) */}
              {orderedControlKeys.some(
                (k) => !activeRisk.controls.some((c) => c.key === k)
              ) && (
                <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-lg text-xs text-indigo-300 flex items-center justify-between gap-2">
                  <span>
                    Some selected controls are <strong>Not attached yet</strong>. Add it on the risk page to make it count permanently.
                  </span>
                  <Link
                    href={`/risks/${activeRisk.riskId}`}
                    className="font-bold underline text-white hover:text-indigo-200 shrink-0"
                  >
                    Go to Risk →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
