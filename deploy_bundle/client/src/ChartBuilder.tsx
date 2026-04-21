import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDraggable,
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  closestCenter
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import React from "react";
import * as echarts from "echarts";
import {
  BarChart3,
  LineChart as LineIcon,
  PieChart as PieIcon,
  ScatterChart,
  Hash,
  Type,
  Clock,
  Trash2,
  AreaChart,
  Activity,
  Grid3X3,
  Box,
  LayoutGrid,
  Zap
} from "lucide-react";
import type { DatasetInfo, DatasetVersionMeta, ColumnMeta } from "@statlab/shared";

type FieldType = "dimension" | "measure" | "time";
type ChannelId = "x" | "y" | "color" | "size" | "filters" | "canvas";
type ChartType = "bar" | "line" | "area" | "pie" | "scatter" | "radar" | "heatmap" | "bubble" | "funnel" | "boxplot";

interface FieldMeta { id: string; name: string; type: FieldType; dataType?: string }
interface FieldRef { fieldId: string; agg?: string }
interface EncodingsState { x?: FieldRef; y: FieldRef[]; color?: FieldRef; size?: FieldRef; filters: FieldRef[] }

interface ChartConfig {
  theme: '极光蓝' | '深海紫' | '森林绿';
  showLabels: boolean;
  sortOrder: 'default' | 'asc' | 'desc';
}

interface BuilderProps {
  datasets: (DatasetInfo & { versions: DatasetVersionMeta[] })[];
  activeDatasetId: number | string | null;
  activeVersion: DatasetVersionMeta | null;
  onSelectDataset: (id: number | string) => void;
  onSelectVersion: (v: DatasetVersionMeta) => void;
}

const THEME_COLORS = {
  '极光蓝': ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  '深海紫': ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
  '森林绿': ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5']
};

const CHART_TYPES: { id: ChartType; icon: React.ReactNode; name: string }[] = [
  { id: "bar", icon: <BarChart3 size={18} />, name: "柱状图" },
  { id: "line", icon: <LineIcon size={18} />, name: "折线图" },
  { id: "area", icon: <AreaChart size={18} />, name: "面积图" },
  { id: "pie", icon: <PieIcon size={18} />, name: "饼图" },
  { id: "scatter", icon: <ScatterChart size={18} />, name: "散点图" },
  { id: "radar", icon: <Activity size={18} />, name: "雷达图" },
  { id: "heatmap", icon: <Grid3X3 size={18} />, name: "热力图" },
  { id: "bubble", icon: <LayoutGrid size={18} />, name: "气泡图" },
  { id: "funnel", icon: <Box size={18} />, name: "漏斗图" },
  { id: "boxplot", icon: <Activity size={18} />, name: "箱线图" },
];

function guessFieldType(col: ColumnMeta): FieldType {
  const name = col.name.toLowerCase();
  const type = col.type?.toLowerCase() || "";
  if (type === "numeric" || type === "int" || type === "float" || type === "double") return "measure";
  if (name.includes("time") || name.includes("date") || type === "datetime" || type === "timestamp") return "time";
  return "dimension";
}

const fieldIcon = (type: FieldType) => {
  if (type === "measure") return <Hash size={13} style={{ color: "var(--accent)" }} />;
  if (type === "time") return <Clock size={13} style={{ color: "#8b5cf6" }} />;
  return <Type size={13} style={{ color: "var(--text-muted)" }} />;
};

// ─── Draggable Field ──────────────────────────────────────────────────────────
const DragField = React.memo(({ field, isOverlay }: { field: FieldMeta; isOverlay?: boolean }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: field.id, data: { field } });
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging && !isOverlay ? 0.3 : 1, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 6, cursor: "grab", userSelect: "none", touchAction: "none", background: isOverlay ? "var(--bg-surface)" : "transparent", border: isOverlay ? "1px solid var(--border)" : "none", boxShadow: isOverlay ? "0 4px 12px rgba(0,0,0,0.12)" : "none", fontSize: 13, color: "var(--text-primary)" }}
      className="cb-field"
    >
      {fieldIcon(field.type)}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{field.name}</span>
    </div>
  );
});

// ─── Hybrid Shelf (drop + click picker) ──────────────────────────────────────
function Shelf({ id, label, children, fields, onAssign }: {
  id: ChannelId; label: string; children: React.ReactNode;
  fields?: FieldMeta[]; onAssign?: (field: FieldMeta) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const filtered = fields && filter ? fields.filter(f => f.name.toLowerCase().includes(filter.toLowerCase())) : (fields || []);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8, position: "relative" }}>
      <div style={{ width: 56, flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--text-muted)", paddingTop: 7, textAlign: "right" }}>{label}</div>
      <div style={{ flex: 1, position: "relative" }}>
        <div ref={setNodeRef}
          onClick={() => { if (fields && onAssign) setOpen(!open); }}
          style={{
            minHeight: 36, padding: "4px 8px", borderRadius: 8, cursor: fields ? "pointer" : "default",
            border: `1.5px dashed ${isOver ? "var(--accent)" : "var(--border)"}`,
            background: isOver ? "var(--accent-dim)" : "var(--bg-raised)",
            display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", transition: "all 0.15s"
          }}>
          {children}
          {fields && onAssign && (
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", padding: "0 2px" }}>{open ? "▲" : "▼"}</span>
          )}
        </div>
        {open && fields && onAssign && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
            border: "1px solid var(--border)", borderRadius: "0 0 8px 8px",
            background: "var(--bg-surface)", maxHeight: 200, overflowY: "auto",
            boxShadow: "0 4px 16px rgba(0,0,0,0.1)"
          }}>
            <div style={{ padding: "5px 8px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-surface)", zIndex: 1 }}>
              <input
                placeholder="搜索字段..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                onClick={e => e.stopPropagation()}
                style={{ width: "100%", padding: "4px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
                autoFocus
              />
            </div>
            {filtered.length === 0 ? (
              <div style={{ padding: 10, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>无匹配字段</div>
            ) : (
              filtered.map(f => (
                <div key={f.id}
                  onClick={(e) => { e.stopPropagation(); onAssign(f); setOpen(false); }}
                  style={{
                    padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
                    cursor: "pointer", borderBottom: "1px solid var(--border)"
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-dim)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {fieldIcon(f.type)}
                  <span style={{ flex: 1 }}>{f.name}</span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{f.type === "measure" ? "定量" : f.type === "time" ? "时间" : "定类"}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chip (assigned field) ────────────────────────────────────────────────────
function Chip({ field, onRemove }: { field: FieldMeta; onRemove: () => void }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
      {fieldIcon(field.type)}
      {field.name}
      <span onClick={onRemove} style={{ cursor: "pointer", opacity: 0.4, marginLeft: 2, display: "flex" }}><Trash2 size={11} /></span>
    </span>
  );
}

// ─── Chart Preview ────────────────────────────────────────────────────────────
function ChartPreview({ option, loading }: { option: echarts.EChartsOption | null; loading?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      if (!chartRef.current) chartRef.current = echarts.init(ref.current);
      if (option) chartRef.current.setOption(option, true);
      else chartRef.current.clear();
    } catch (err) {
      console.error("[ChartBuilder] render error", err);
    }
    const handle = () => { try { chartRef.current?.resize(); } catch {} };
    window.addEventListener("resize", handle);
    return () => { window.removeEventListener("resize", handle); chartRef.current?.dispose(); chartRef.current = null; };
  }, [option]);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 420 }}>
      {loading && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.6)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Zap size={28} style={{ color: "var(--accent)", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>加载中...</span>
          </div>
        </div>
      )}
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

// ─── Build ECharts option ─────────────────────────────────────────────────────
function buildChartOption(
  chartType: ChartType, encodings: EncodingsState, fields: FieldMeta[], displayRows: any[], config: ChartConfig
): echarts.EChartsOption | null {
  if (!fields.length || !displayRows.length) return null;
  const colors = THEME_COLORS[config.theme];
  const x = encodings.x && fields.find(f => f.id === encodings.x?.fieldId);
  let ys = encodings.y.map(r => fields.find(f => f.id === r.fieldId)).filter(Boolean) as FieldMeta[];

  if (chartType === "radar") {
    const targets = ys.length ? ys : fields.filter(f => f.type === "measure");
    if (targets.length < 3) return null;
    const indicators = targets.map(y => ({ name: y.name, max: Math.max(...displayRows.map(r => parseFloat(r[y.name]) || 0)) * 1.2 }));
    return {
      color: colors, radar: { indicator: indicators },
      series: [{ type: "radar", areaStyle: { opacity: 0.1 }, data: displayRows.slice(0, 5).map((row, i) => ({ value: targets.map(y => row[y.name]), name: `#${i + 1}` })), label: { show: config.showLabels } }]
    } as any;
  }

  let finalX = x;
  let finalYs = ys;
  if (!finalX && finalYs.length > 0) {
    finalX = fields.find(f => f.type === "dimension" || f.type === "time") || { id: "__index", name: "序列", type: "dimension" as FieldType, dataType: "numeric" };
  }
  if (finalX && finalYs.length === 0) {
    const m = fields.find(f => f.type === "measure");
    if (m) finalYs = [m]; else finalYs = [{ id: "__count", name: "频数", type: "measure" as FieldType, dataType: "numeric" }];
  }
  if (!finalX || finalYs.length === 0) return null;

  const activeX = finalX;
  const aggregate = (rows: any[]) => {
    const grouped = new Map<string, { total: number; counts: number[] }>();
    rows.forEach(r => {
      const key = r[activeX.name] ?? "(空)";
      if (!grouped.has(key)) grouped.set(key, { total: 0, counts: Array(finalYs.length).fill(0) });
      const b = grouped.get(key)!;
      b.total += 1;
      finalYs.forEach((y, idx) => { if (y.id !== "__count") { const v = parseFloat(r[y.name]); if (!isNaN(v)) b.counts[idx] += 1; } });
    });
    return Array.from(grouped.entries()).map(([k, v]) => {
      const obj: Record<string, any> = { [activeX.name]: k };
      finalYs.forEach((y, idx) => { obj[y.name] = y.id === "__count" ? v.total : v.counts[idx]; });
      return obj;
    });
  };

  const baseData = (chartType === "bar" || chartType === "pie") && activeX.type !== "measure" ? aggregate(displayRows) : displayRows;
  let data = [...baseData];
  if (config.sortOrder !== "default" && finalYs.length > 0) {
    const py = finalYs[0].name;
    data.sort((a, b) => config.sortOrder === "asc" ? (parseFloat(a[py]) || 0) - (parseFloat(b[py]) || 0) : (parseFloat(b[py]) || 0) - (parseFloat(a[py]) || 0));
  }

  if (chartType === "pie") {
    const py = finalYs[0];
    return {
      color: colors, tooltip: { trigger: "item" }, legend: { type: "scroll", bottom: 0, textStyle: { color: "#64748b" } },
      series: [{ name: py.name, type: "pie", radius: ["35%", "70%"], label: { show: config.showLabels, formatter: "{b}: {c}" }, data: data.map((r, i) => ({ name: activeX.id === "__index" ? String(i) : String(r[activeX.name]), value: parseFloat(r[py.name]) || 0 })) }]
    } as any;
  }

  if (chartType === "heatmap") {
    const py = finalYs[0]?.name;
    if (!py) return null;
    const xLabels = data.map((r, i) => activeX.id === "__index" ? String(i) : String(r[activeX.name]));
    return {
      tooltip: { position: "top" }, grid: { height: "50%", top: "10%" },
      xAxis: { type: "category", data: xLabels, splitArea: { show: true } },
      yAxis: { type: "category", data: [py], splitArea: { show: true } },
      visualMap: { min: 0, max: Math.max(...data.map(r => parseFloat(r[py]) || 0)) || 100, calculable: true, orient: "horizontal", left: "center", bottom: "15%" },
      series: [{ type: "heatmap", data: data.map((r, i) => [i, 0, parseFloat(r[py]) || 0]), label: { show: config.showLabels } }]
    } as any;
  }

  if (chartType === "boxplot") {
    const sets = finalYs.map(y => ({ name: y.name, data: data.map(r => parseFloat(r[y.name]) || 0).sort((a, b) => a - b) }));
    const boxData = sets.map(ds => { const d = ds.data; if (!d.length) return [0, 0, 0, 0, 0]; return [d[0], d[Math.floor(d.length * 0.25)], d[Math.floor(d.length * 0.5)], d[Math.floor(d.length * 0.75)], d[d.length - 1]]; });
    return {
      color: colors, tooltip: { trigger: "item" }, grid: { left: "10%", right: "10%", bottom: "15%" },
      xAxis: { type: "category", data: sets.map(ds => ds.name) }, yAxis: { type: "value", splitLine: { lineStyle: { type: "dashed" } } },
      series: [{ type: "boxplot", data: boxData, itemStyle: { color: colors[0], borderColor: colors[0] } }]
    } as any;
  }

  return {
    color: colors,
    tooltip: { trigger: "axis", backgroundColor: "#fff", borderRadius: 12, padding: 12, textStyle: { color: "#1e293b", fontSize: 13 }, borderWidth: 0 },
    legend: { bottom: 10, icon: "circle", textStyle: { color: "#64748b", fontSize: 12 } },
    grid: { top: 60, right: 40, bottom: 80, left: 64 },
    xAxis: { type: activeX.type === "measure" ? "value" : "category", data: activeX.type === "measure" ? undefined : data.map((r, i) => activeX.id === "__index" ? i : r[activeX.name]), axisLine: { lineStyle: { color: "#e2e8f0" } }, axisLabel: { color: "#94a3b8", fontSize: 11 }, boundaryGap: chartType !== "line" && chartType !== "area" },
    yAxis: { type: "value", splitLine: { lineStyle: { type: "dashed", color: "#f1f5f9" } }, axisLine: { show: false }, axisLabel: { color: "#94a3b8", fontSize: 11 } },
    series: finalYs.map(y => ({
      name: y.name, type: chartType === "area" ? "line" : chartType === "scatter" ? "scatter" : chartType,
      areaStyle: chartType === "area" ? { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: `${colors[0]}33` }, { offset: 1, color: `${colors[0]}00` }]) } : undefined,
      smooth: true, label: { show: config.showLabels, position: "top", color: "#64748b", fontSize: 10 },
      symbolSize: chartType === "scatter" ? 10 : 6, showSymbol: chartType === "line" || chartType === "area", data: data.map(r => r[y.name])
    }))
  } as any;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ChartBuilder({ datasets, activeDatasetId, activeVersion, onSelectDataset, onSelectVersion }: BuilderProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeDragItem, setActiveDragItem] = useState<FieldMeta | null>(null);
  const [encodings, setEncodings] = useState<EncodingsState>({ y: [], filters: [] });
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [buildMode, setBuildMode] = useState<"smart" | "manual">("smart");
  const [searchTerm, setSearchTerm] = useState("");
  const [fullData, setFullData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ChartConfig>({ theme: "极光蓝", showLabels: false, sortOrder: "default" });
  const { isOver: isCanvasOver, setNodeRef: setCanvasRef } = useDroppable({ id: "canvas" });

  const fields = useMemo(() => {
    const raw = (activeVersion?.columns || []).map(c => ({ id: c.name, name: c.name, type: guessFieldType(c), dataType: c.type }));
    return searchTerm ? raw.filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase())) : raw;
  }, [activeVersion, searchTerm]);

  const dims = useMemo(() => fields.filter(f => f.type !== "measure"), [fields]);
  const measures = useMemo(() => fields.filter(f => f.type === "measure"), [fields]);
  const activeDs = useMemo(() => datasets.find(d => String(d.id) === String(activeDatasetId)), [datasets, activeDatasetId]);

  useEffect(() => {
    if (activeVersion && !String(activeVersion.id).startsWith("db-")) {
      setLoading(true);
      fetch(`/api/datasets/version/${activeVersion.id}/full-data`).then(r => r.json()).then(d => { setFullData(d); setLoading(false); }).catch(() => setLoading(false));
    } else if (activeVersion && (activeVersion as any).sampleRows) {
      setFullData((activeVersion as any).sampleRows);
    } else { setFullData([]); }
  }, [activeVersion]);

  const displayRows = useMemo(() => fullData.length > 0 ? fullData : ((activeVersion as any)?.sampleRows || []), [fullData, activeVersion]);
  const chartOption = useMemo(() => buildChartOption(chartType, encodings, fields, displayRows, config), [encodings, chartType, fields, displayRows, config]);

  const onDragStart = (e: DragStartEvent) => { const f = fields.find(f => f.id === e.active.id); if (f) setActiveDragItem(f); };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragItem(null);
    const field = fields.find(f => f.id === e.active.id);
    if (!field || !e.over) return;
    const ch = e.over.id as ChannelId;
    if (ch === "canvas") {
      setEncodings(prev => {
        const n = { ...prev };
        if (!n.x && (field.type === "dimension" || field.type === "time")) n.x = { fieldId: field.id };
        else if (field.type === "measure") { if (!n.y.find(r => r.fieldId === field.id)) n.y = [...n.y, { fieldId: field.id }]; }
        else n.color = { fieldId: field.id };
        return n;
      });
    } else {
      setEncodings(prev => {
        const n = { ...prev };
        if (ch === "x") n.x = { fieldId: field.id };
        else if (ch === "y") { if (!n.y.find(r => r.fieldId === field.id)) n.y = [...n.y, { fieldId: field.id }]; }
        else if (ch === "filters") { if (!n.filters.find(r => r.fieldId === field.id)) n.filters = [...n.filters, { fieldId: field.id }]; }
        else (n as any)[ch] = { fieldId: field.id };
        return n;
      });
    }
  };

  const removeChip = (ch: ChannelId, fid: string) => {
    setEncodings(prev => {
      const n = { ...prev };
      if (ch === "x") n.x = undefined;
      else if (ch === "y") n.y = n.y.filter(r => r.fieldId !== fid);
      else if (ch === "filters") n.filters = n.filters.filter(r => r.fieldId !== fid);
      else (n as any)[ch] = undefined;
      return n;
    });
  };

  const getField = (id: string) => fields.find(f => f.id === id);

  const renderChips = (channel: ChannelId) => {
    let items: FieldMeta[] = [];
    if (channel === "x" && encodings.x) { const f = getField(encodings.x.fieldId); if (f) items.push(f); }
    else if (channel === "y") encodings.y.forEach(r => { const f = getField(r.fieldId); if (f) items.push(f); });
    if (!items.length) return <span style={{ color: "var(--text-muted)", fontSize: 11 }}>拖入或点击选择字段</span>;
    return items.map(f => <Chip key={`${channel}-${f.id}`} field={f} onRemove={() => removeChip(channel, f.id)} />);
  };

  const renderSmartChips = () => {
    const chips: { f: FieldMeta; ch: ChannelId }[] = [];
    if (encodings.x) { const f = getField(encodings.x.fieldId); if (f) chips.push({ f, ch: "x" }); }
    encodings.y.forEach(r => { const f = getField(r.fieldId); if (f) chips.push({ f, ch: "y" }); });
    if (encodings.color) { const f = getField(encodings.color.fieldId); if (f) chips.push({ f, ch: "color" }); }
    if (!chips.length) return <span style={{ color: "var(--text-muted)", fontSize: 11 }}>拖入或点击选择变量，自动识别维度与度量...</span>;
    return <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{chips.map(({ f, ch }) => <Chip key={f.id} field={f} onRemove={() => removeChip(ch, f.id)} />)}</div>;
  };

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} modifiers={[restrictToWindowEdges]} collisionDetection={closestCenter}>
      <div className="analysis-layout">
        {/* ── Left: Fields Panel ── */}
        <div className="analysis-sidebar-vars" style={{ width: 260 }}>
          <div className="var-explorer-header">
            <div className="explorer-title" style={{ justifyContent: "space-between" }}>
              <span>📊 数据字段</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <select
                className="version-select-clean"
                style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-surface)", color: "var(--text-primary)" }}
                value={activeDatasetId ? String(activeDatasetId) : ""}
                onChange={e => onSelectDataset(e.target.value)}
              >
                <option value="" disabled>选择数据集...</option>
                {datasets.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
              {activeVersion && activeDs && (
                <select
                  className="version-select-clean"
                  style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-surface)", color: "var(--text-primary)" }}
                  value={String(activeVersion.id)}
                  onChange={e => { const v = activeDs.versions.find(ver => String(ver.id) === e.target.value); if (v) onSelectVersion(v); }}
                >
                  {activeDs.versions.map(v => <option key={v.id} value={String(v.id)}>V{v.version}</option>)}
                </select>
              )}
            </div>
            <div className="search-input">
              <span className="search-icon">🔍</span>
              <input placeholder="搜索字段..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="var-list-group" style={{ flex: 1, overflowY: "auto" }}>
            <div className="subcategory-label" style={{ background: "transparent", color: "var(--text-muted)" }}>定类 / 时间 ({dims.length})</div>
            {dims.length ? dims.map(f => <DragField key={f.id} field={f} />) : <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--text-muted)" }}>暂无</div>}
            <div className="subcategory-label" style={{ background: "transparent", color: "var(--text-muted)", marginTop: 12 }}>定量 ({measures.length})</div>
            {measures.length ? measures.map(f => <DragField key={f.id} field={f} />) : <div style={{ padding: "8px 16px", fontSize: 12, color: "var(--text-muted)" }}>暂无</div>}
          </div>
        </div>

        {/* ── Center: Canvas ── */}
        <div className="analysis-main-workspace" style={{ padding: 20, gap: 16, display: "flex", flexDirection: "column" }}>
          {/* Mode Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>可视化搭建</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
              {(["smart", "manual"] as const).map(m => (
                <button key={m} onClick={() => setBuildMode(m)}
                  style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: buildMode === m ? "var(--accent)" : "var(--bg-surface)", color: buildMode === m ? "white" : "var(--text-secondary)", transition: "all 0.15s" }}>
                  {m === "smart" ? "✨ 智能识别" : "🛠️ 手动配置"}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setEncodings({ y: [], filters: [] }); }}>重置</button>
          </div>

          {/* Shelf area */}
          <div className="card" style={{ padding: 14, margin: 0 }}>
            {buildMode === "manual" ? (
              <>
                <Shelf id="x" label="横轴 X" fields={dims} onAssign={(f) => setEncodings(p => ({ ...p, x: { fieldId: f.id } }))}>{renderChips("x")}</Shelf>
                <Shelf id="y" label="数值 Y" fields={measures} onAssign={(f) => { if (!encodings.y.find(r => r.fieldId === f.id)) setEncodings(p => ({ ...p, y: [...p.y, { fieldId: f.id }] })); }}>{renderChips("y")}</Shelf>
              </>
            ) : (
              <Shelf id="canvas" label="数据栏" fields={fields} onAssign={(f) => {
                setEncodings(prev => {
                  const n = { ...prev };
                  if (!n.x && (f.type === "dimension" || f.type === "time")) n.x = { fieldId: f.id };
                  else if (f.type === "measure") { if (!n.y.find(r => r.fieldId === f.id)) n.y = [...n.y, { fieldId: f.id }]; }
                  else n.color = { fieldId: f.id };
                  return n;
                });
              }}>{renderSmartChips()}</Shelf>
            )}
          </div>

          {/* Chart Preview */}
          <div ref={setCanvasRef} className="card" style={{ flex: 1, padding: 0, margin: 0, overflow: "hidden", position: "relative", border: isCanvasOver ? "2px solid var(--accent)" : undefined }}>
            {isCanvasOver && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(99,102,241,0.06)", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", borderRadius: "var(--radius-md)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
                  <Zap size={24} /> 松手即刻成图
                </div>
              </div>
            )}
            {chartOption ? (
              <ChartPreview option={chartOption} loading={loading} />
            ) : (
              <div className="empty-state" style={{ padding: 60 }}>
                <div className="empty-icon">📈</div>
                <div className="empty-title">拖入或点击选择变量开始可视化</div>
                <div className="empty-desc">将左侧字段拖入数据栏，或点击数据栏下拉选择</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Config Panel ── */}
        <div style={{ width: 260, background: "var(--bg-surface)", borderLeft: "1px solid var(--border)", display: "flex", flexDirection: "column", overflowY: "auto", padding: 16 }}>
          {/* Chart Types */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.03em" }}>图表类型</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
              {CHART_TYPES.map(ct => (
                <div key={ct.id} onClick={() => setChartType(ct.id)}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 4px", borderRadius: 8, cursor: "pointer", border: chartType === ct.id ? "1.5px solid var(--accent)" : "1px solid var(--border)", background: chartType === ct.id ? "var(--accent-dim)" : "var(--bg-raised)", color: chartType === ct.id ? "var(--accent)" : "var(--text-secondary)", transition: "all 0.15s", fontSize: 10, fontWeight: 600 }}>
                  {ct.icon}
                  <span>{ct.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Config */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.03em" }}>样式配置</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>主题</span>
                <select value={config.theme} onChange={e => setConfig(p => ({ ...p, theme: e.target.value as any }))}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 11, background: "var(--bg-raised)", color: "var(--text-primary)" }}>
                  <option>极光蓝</option><option>深海紫</option><option>森林绿</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>数值标签</span>
                <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
                  {["开启", "隐藏"].map(v => (
                    <button key={v} onClick={() => setConfig(p => ({ ...p, showLabels: v === "开启" }))}
                      style={{ padding: "3px 10px", fontSize: 11, border: "none", cursor: "pointer", background: (config.showLabels ? "开启" : "隐藏") === v ? "var(--accent)" : "var(--bg-raised)", color: (config.showLabels ? "开启" : "隐藏") === v ? "white" : "var(--text-muted)", fontWeight: 600 }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>排序</span>
                <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)" }}>
                  {[{ l: "默认", v: "default" }, { l: "升序", v: "asc" }, { l: "降序", v: "desc" }].map(o => (
                    <button key={o.v} onClick={() => setConfig(p => ({ ...p, sortOrder: o.v as any }))}
                      style={{ padding: "3px 10px", fontSize: 11, border: "none", cursor: "pointer", background: config.sortOrder === o.v ? "var(--accent)" : "var(--bg-raised)", color: config.sortOrder === o.v ? "white" : "var(--text-muted)", fontWeight: 600 }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick tips */}
          <div className="card" style={{ padding: 12, margin: 0, background: "var(--bg-raised)", border: "none" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>快捷提示</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <li>智能模式：拖入或点击选择字段</li>
              <li>手动模式：分别拖或点击选择到 X/Y 轴</li>
              <li>多个度量可叠加到 Y 轴</li>
            </ul>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}>
        {activeDragItem ? <DragField field={activeDragItem} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
