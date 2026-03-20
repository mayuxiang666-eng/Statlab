import React, {
  useCallback, useEffect, useMemo, useRef, useState
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { ConfigProvider } from "antd";
import zhCN from "antd/lib/locale/zh_CN";
import enUS from "antd/lib/locale/en_US";
import deDE from "antd/lib/locale/de_DE";
import {
  AlgorithmSpec, AnalysisResult, DatasetInfo,
  DatasetVersionMeta, InputSlotSpec, ParamDef
} from "@statlab/shared";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragEndEvent, useDraggable, useDroppable
} from "@dnd-kit/core";
import * as echarts from "echarts";
import DbConnect from "./DbConnect";
import {
  Database, FileText, Upload, Plus, Download, Trash2, Table, BarChart4
} from "lucide-react";
import ChartBuilder from "./ChartBuilder";
import DataProcessBuilder from "./DataProcessBuilder";
import AiAssistant from "./AiAssistant";
import LabPortal from "./LabPortal";
import PracticalLabs from "./PracticalLabs";
import Competitions from "./Competitions";
import DeploymentTraining from "./DeploymentTraining";
import HelpPage from "./HelpPage";
import PythonLab from "./PythonLab";
import MLWorkspace from "./MLWorkspace";
import { Language, t } from "./locales";
import { useAuth } from "./context/AuthContext";


class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: "var(--text-primary)", marginBottom: 8 }}>渲染出错</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
            {this.state.error?.message || "未知错误"}
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => this.setState({ hasError: false, error: null })}>
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Page = "home" | "data" | "process" | "academic" | "ml" | "report" | "help" | "result" | "db-connect" | "builder" | "python-lab" | "lab-notebooks" | "lab-assignments" | "lab-achievements" | "practical" | "competitions" | "deployment";

type ResTab = "output" | "charts" | "interpret" | "logs";
type LogEntry = { ts: string; level: "info" | "success" | "warn" | "error"; msg: string };
type RunHistoryItem = {
  id: string; algoName: string; algoId: string;
  ts: string; status: "completed" | "failed"; result: AnalysisResult | null;
  datasetId?: number | string | null;
  datasetVersionId?: number | null;
  datasetName?: string;
  algoCategory?: "academic" | "ml" | string;
  analysisName?: string;
  analystName?: string;
};
type DatasetId = number | string;
type VersionLike = DatasetVersionMeta & { id: DatasetId; datasetId: DatasetId };
type DatasetLike = DatasetInfo | {
  id: string;
  name: string;
  originalFilename: string;
  createdAt: string;
  versions: VersionLike[];
  sourceType?: "db";
};

type UserIdentity = {
  key: string;
  ip?: string;
};

function nowStr() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}
function colorCell(val: string | number | null, colName: string): string {
  if (val === null || val === undefined || val === "") return "";
  const s = String(val); const lo = colName.toLowerCase();
  if (lo === "p值" || lo === "p-value" || lo.startsWith("p ")) {
    const n = parseFloat(s);
    if (!isNaN(n)) return n < 0.05 ? "sig" : n < 0.1 ? "marginal" : "ns";
  }
  if (lo.includes("coef") || lo.includes("beta") || lo.includes("r²")) {
    const n = parseFloat(s);
    if (!isNaN(n)) return n > 0 ? "positive" : n < 0 ? "negative" : "";
  }
  return "";
}

// ─── App Root ────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [pendingCourseId, setPendingCourseId] = useState<string | undefined>();
  const [algorithms, setAlgorithms] = useState<AlgorithmSpec[]>([]);
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmSpec | null>(null);
  const [datasets, setDatasets] = useState<DatasetLike[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<DatasetId | null>(null);
  const [activeVersion, setActiveVersion] = useState<VersionLike | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [previewMode, setPreviewMode] = useState<"table" | "coding">("table");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [resTab, setResTab] = useState<ResTab>("output");
  const [algoSearch, setAlgoSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [varSearch, setVarSearch] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([{ ts: nowStr(), level: "info", msg: "StatLab 已就绪" }]);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pasteName, setPasteName] = useState("");
  const [pasteCsv, setPasteCsv] = useState("");
  const [pasteSubmitting, setPasteSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSamplePicker, setShowSamplePicker] = useState(false);
  const [dbCacheLoaded, setDbCacheLoaded] = useState(false);
  const [previewOverflow, setPreviewOverflow] = useState(false);
  const [previewScrollLeft, setPreviewScrollLeft] = useState(0);
  const [previewScrollMax, setPreviewScrollMax] = useState(0);
  const autoImportingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewWrapRef = useRef<HTMLDivElement | null>(null);
  const [loadingFullData, setLoadingFullData] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [guideTab, setGuideTab] = useState<string>("data");
  const [guideFabPos, setGuideFabPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== "undefined" ? window.innerWidth - 110 : 720,
    y: typeof window !== "undefined" ? window.innerHeight - 190 : 520
  }));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const { user, logout: authLogout } = useAuth(); // NEW: use real auth
  const userReady = !!user;
  const [analysisName, setAnalysisName] = useState("");
  const [analystName, setAnalystName] = useState("");
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem("statlab_lang") as Language) || "zh");

  const onDrop = (event: DragEndEvent) => {
    const slotId = event.over?.id as string | undefined;
    if (!slotId || !selectedAlgo || !activeVersion) return;
    const slot = selectedAlgo.inputSpec.find((s) => s.id === slotId);
    if (!slot) return;
    const name = event.active.id as string;
    const varType = activeVersion.columns.find(c => c.name === name)?.type;
    if (!varType) return;
    if (!slot.acceptedTypes.includes(varType)) { addLog("warn", `"${name}" 类型 ${varType} 不匹配槽 ${slot.label}`); return; }
    setAssignments((prev) => {
      const existing = prev[slotId] || [];
      if (existing.includes(name)) return prev;
      const max = typeof slot.max === "number" ? slot.max : Infinity;
      if (existing.length >= max) return prev;
      return { ...prev, [slotId]: [...existing, name] };
    });
  };

  const sampleOptions = useMemo(() => ([
    { id: "", label: "基础示例 (sample.csv)", desc: "简单结构示例" },
    { id: "advertising", label: "广告投放与销售额", desc: "经典回归案例" },
    { id: "housing", label: "房价影响因素分析", desc: "多特征回归" },
    { id: "employee", label: "员工绩效与压力分析", desc: "人效与压力" },
    { id: "finance", label: "金融股票价格", desc: "时序/回归" },
    { id: "medical", label: "医疗患者记录", desc: "健康风险" },
    { id: "energy", label: "建筑能耗", desc: "能耗预测" },
    { id: "manufacturing", label: "制造质量", desc: "良率分析" }
  ]), []);

  const FAB_SIZE = 64;
  const EDGE_MARGIN = 12;
  const clampPos = (x: number, y: number) => ({
    x: Math.min(Math.max(EDGE_MARGIN, x), (typeof window !== "undefined" ? window.innerWidth : 1200) - FAB_SIZE - EDGE_MARGIN),
    y: Math.min(Math.max(EDGE_MARGIN, y), (typeof window !== "undefined" ? window.innerHeight : 800) - FAB_SIZE - EDGE_MARGIN)
  });

  const addLog = useCallback((level: LogEntry["level"], msg: string) => {
    setLogs((p) => [...p.slice(-99), { ts: nowStr(), level, msg }]);
  }, []);

  const importSample = useCallback(async (name?: string) => {
    const api = name ? `/api/datasets/import-sample/${name}` : "/api/datasets/import-sample";
    addLog("info", `导入${name ? "经典" : "示例"}数据...`);
    try {
      const { data } = await axios.post<DatasetInfo>(api);
      await refreshDatasets(); setActiveVersion(data.versions[0] as DatasetVersionMeta); setActiveDatasetId(data.id);
      setPage("data");
      addLog("success", "数据集已导入");
    } catch { addLog("error", "导入失败"); }
  }, [addLog]);

  const importAllSamples = useCallback(async () => {
    if (autoImportingRef.current) return;
    autoImportingRef.current = true;
    addLog("info", "正在导入内置示例数据集...");
    try {
      await importSample();
      await importSample("advertising");
      await importSample("housing");
      await importSample("employee");
      addLog("success", "示例数据集已全部就绪");
    } catch (err: any) {
      addLog("error", err?.response?.data?.error || "示例导入失败");
    } finally {
      autoImportingRef.current = false;
      await refreshDatasets();
    }
  }, [importSample, addLog]);

  const refreshDatasets = useCallback(async () => {
    try {
      const { data } = await axios.get<DatasetInfo[]>("/api/datasets");
      setDatasets((prev) => {
        const dbOnes = prev.filter((d: any) => typeof d.id === "string");
        return [...data, ...dbOnes];
      });
      if (!activeVersion && data[0]?.versions?.[0]) {
        setActiveDatasetId(data[0].id); setActiveVersion(data[0].versions[0] as DatasetVersionMeta);
      }
      if (data.length === 0 && !autoImportingRef.current) {
        await importAllSamples();
      }
    } catch (err) {
      console.error("Failed to fetch datasets", err);
    }
  }, [activeVersion, addLog, importAllSamples]);

  const refreshRunHistory = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: algos } = await axios.get<AlgorithmSpec[]>("/api/algorithms");
      const { data: history } = await axios.get<RunHistoryItem[]>("/api/run-history");
      const mapped = history.map(item => {
        const spec = algos.find(a => a.id === item.algoId);
        return {
          ...item,
          algoName: spec ? spec.name : item.algoId,
          algoCategory: spec?.category || "academic",
          datasetName: item.datasetName || item.datasetId?.toString() || "未知数据集",
        } as RunHistoryItem;
      });
      setRunHistory(mapped);
    } catch (err) {
      const raw = localStorage.getItem(`statlab-run-history:${user.id}`);
      if (raw) {
        try { setRunHistory(JSON.parse(raw)); return; } catch { /* ignore */ }
      }
      console.error("Failed to fetch history", err);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    axios.get<AlgorithmSpec[]>("/api/algorithms").then((r) => setAlgorithms(r.data))
      .catch(() => addLog("error", "无法获取算法列表"));
    refreshDatasets();
    refreshRunHistory();
    setPreviewScrollLeft(0);

    const cachedResult = localStorage.getItem(`statlab-last-result:${user.id}`);
    if (cachedResult) {
      try { setResult(JSON.parse(cachedResult)); } catch { /* ignore */ }
    }
  }, [user?.id, refreshDatasets, refreshRunHistory, addLog]);

  useEffect(() => {
    const onResize = () => setGuideFabPos(p => clampPos(p.x, p.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const lite = runHistory.slice(-100).map(r => ({ ...r, result: undefined }));
      localStorage.setItem(`statlab-run-history:${user.id}`, JSON.stringify(lite));
    } catch { }
  }, [runHistory, user?.id]);

  useEffect(() => {
    if (!user?.id || !result) return;
    try {
      const lite = { ...result, extras: undefined };
      localStorage.setItem(`statlab-last-result:${user.id}`, JSON.stringify(lite));
    } catch { }
  }, [result, user?.id]);

  // Restore DB datasets from localStorage after refresh
  useEffect(() => {
    const restoreDbDatasets = async () => {
      const raw = localStorage.getItem("db-datasets-cache");
      if (!raw) {
        setDbCacheLoaded(true);
        return;
      }
      try {
        const cachedIds: string[] = JSON.parse(raw) || [];
        const fetched: DatasetLike[] = [];
        for (const id of cachedIds) {
          try {
            const { data: dbDs } = await axios.get(`/api/connections/dataset/${id}`);
            const createdAt = new Date().toISOString();
            const version: VersionLike = {
              id: dbDs.id,
              datasetId: dbDs.id,
              version: 1,
              path: "",
              columns: dbDs.columns,
              sampleRows: dbDs.previewRows,
              rowCount: Array.isArray(dbDs.previewRows) ? dbDs.previewRows.length : 0
            };
            fetched.push({
              id: dbDs.id,
              name: dbDs.name || "数据库取数",
              originalFilename: dbDs.name || "db",
              createdAt,
              versions: [version],
              sourceType: "db"
            });
          } catch {
            // drop missing cache entry silently
          }
        }
        if (fetched.length > 0) {
          setDatasets((prev) => {
            const map = new Map<any, DatasetLike>();
            [...prev, ...fetched].forEach((d) => map.set(d.id, d));
            return Array.from(map.values());
          });
        } else {
          localStorage.removeItem("db-datasets-cache");
        }
      } finally {
        setDbCacheLoaded(true);
      }
    };
    restoreDbDatasets();
  }, []);

  // Dynamic focusVar options: sync algo param options with assigned variables
  useEffect(() => {
    if (!selectedAlgo || selectedAlgo.id !== "academic.correlation") return;
    const vars = [...(assignments["variables"] || [])];
    if (vars.length === 0) return;
    setSelectedAlgo((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        paramSchema: prev.paramSchema.map((p) =>
          p.key === "focusVar"
            ? { ...p, options: [{ value: "", label: "—— 全部配对 ——" }, ...vars.map((v: string) => ({ value: v, label: v }))] }
            : p
        )
      };
    });
  }, [assignments, selectedAlgo?.id]);

  // Reset焦点变量当分配列表变化导致无效时
  useEffect(() => {
    if (selectedAlgo?.id !== "academic.correlation") return;
    const vars = [...(assignments["variables"] || [])];
    const focus = String(params["focusVar"] ?? "");
    if (focus && !vars.includes(focus)) {
      setParams((p) => ({ ...p, focusVar: "" }));
    }
  }, [assignments, params, selectedAlgo?.id]);

  const variables = useMemo(() => {
    const cols = activeVersion?.columns || [];
    const assignedSet = new Set(Object.values(assignments).flat());
    const unassigned = cols.filter((c) => !assignedSet.has(c.name));
    return varSearch ? unassigned.filter((c) => c.name.toLowerCase().includes(varSearch.toLowerCase())) : unassigned;
  }, [activeVersion?.columns, varSearch, assignments]);


  const filteredAlgos = useMemo(() => {
    const cat = page === "academic" ? "academic" : page === "ml" ? "ml" : null;
    return algorithms.filter((a) => {
      const matchSearch = !algoSearch || [a.name, a.subcategory, a.description, a.id].some((s) => s.includes(algoSearch));
      return matchSearch && (cat ? a.category === cat : true);
    });
  }, [algorithms, algoSearch, page]);

  const algosBySub = useMemo(() => {
    const m = new Map<string, AlgorithmSpec[]>();
    const ordered = [...filteredAlgos].sort((a, b) => {
      const order = (s: string) => (s === "相关性分析" ? 0 : 1);
      const o = order(a.subcategory) - order(b.subcategory);
      if (o !== 0) return o;
      return a.name.localeCompare(b.name, "zh-CN");
    });
    ordered.forEach((a) => { const arr = m.get(a.subcategory) || []; arr.push(a); m.set(a.subcategory, arr); });
    return m;
  }, [filteredAlgos]);

  const run = async () => {
    if (!selectedAlgo || !activeVersion) return;
    setRunning(true); addLog("info", `运行 "${selectedAlgo.name}"...`);
    try {
      const isDb = String(activeVersion?.id).startsWith("db-");
      const { data } = await axios.post<AnalysisResult>("/api/run", {
        datasetVersionId: activeVersion?.id,
        algorithmId: selectedAlgo.id,
        variables: assignments,
        params,
        analysisName: analysisName.trim() || undefined,
        analystName: analystName.trim() || undefined
      });
      setResult(data); setResTab("output"); setPage("result");
      addLog("success", `"${selectedAlgo.name}" 完成`);
      const historyItem: RunHistoryItem = {
        id: `${Date.now()}`,
        algoName: selectedAlgo.name,
        algoId: selectedAlgo.id,
        ts: new Date().toISOString(),
        status: "completed",
        result: data,
        datasetId: activeDatasetId,
        datasetVersionId: activeVersion.id,
        datasetName: datasets.find(d => d.id === activeDatasetId)?.name,
        algoCategory: selectedAlgo.category,
        analysisName: analysisName.trim() || undefined,
        analystName: analystName.trim() || undefined
      };
      setRunHistory((prev) => [historyItem, ...prev].slice(0, 100));
      refreshRunHistory();
    } catch (err: any) {
      const msg = err?.response?.data?.error || String(err);
      addLog("error", `运行失败: ${msg}`);
      const historyItem: RunHistoryItem = {
        id: `${Date.now()}-err`,
        algoName: selectedAlgo.name,
        algoId: selectedAlgo.id,
        ts: new Date().toISOString(),
        status: "failed",
        result: null,
        datasetId: activeDatasetId,
        datasetVersionId: activeVersion.id,
        datasetName: datasets.find(d => d.id === activeDatasetId)?.name,
        algoCategory: selectedAlgo.category,
        analysisName: analysisName.trim() || undefined,
        analystName: analystName.trim() || undefined
      };
      setRunHistory((prev) => [historyItem, ...prev].slice(0, 100));
    } finally { setRunning(false); }
  };


  const uploadDataset = async (file: File) => {
    const form = new FormData(); form.append("file", file);
    setUploading(true); setUploadProgress(0); addLog("info", `上传 "${file.name}"...`);
    try {
      const { data } = await axios.post<DatasetInfo>("/api/datasets/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.min(100, Math.round((e.loaded / e.total) * 100));
            setUploadProgress(pct);
          }
        }
      });
      await refreshDatasets(); setActiveDatasetId(data.id); setActiveVersion(data.versions[0]);
      setAssignments({}); setResult(null); addLog("success", `"${data.name}" 上传成功`);
    } catch (err: any) { addLog("error", err?.response?.data?.error || "上传失败"); }
    finally {
      setUploading(false);
      setUploadProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const syncPreviewScrollMeta = useCallback(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    setPreviewScrollMax(max);
    setPreviewOverflow(max > 0);
    setPreviewScrollLeft(el.scrollLeft);
  }, []);

  const normalizePastedCsv = (raw: string) => {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return "";

    const rows = lines.map((line) => {
      const trimmed = line.trimEnd();
      // Excel 复制通常是制表符分隔，这里转成逗号分隔（多个连续制表符当作单个分隔符）
      const asCsv = trimmed.includes("\t") ? trimmed.split(/\t+/).join(",") : trimmed;
      return asCsv.split(",");
    });

    const maxCols = Math.max(...rows.map((r) => r.length));
    const header = rows[0];
    const paddedHeader = header.length === maxCols ? header : [...header, ...Array.from({ length: maxCols - header.length }, (_, i) => `col_${i + header.length + 1}`)];

    const paddedRows = [paddedHeader, ...rows.slice(1).map((r) => {
      if (r.length === maxCols) return r;
      return [...r, ...Array.from({ length: maxCols - r.length }, () => "")];
    })];

    return paddedRows.map((r) => r.join(",")).join("\n");
  };

  const uploadPastedCsv = async () => {
    if (!pasteCsv.trim()) { addLog("warn", "请粘贴 CSV 数据"); return; }
    setPasteSubmitting(true);
    try {
      const safeName = pasteName.trim() || "粘贴数据";
      const csv = normalizePastedCsv(pasteCsv);
      const file = new File([csv], `${safeName}.csv`, { type: "text/csv" });
      await uploadDataset(file);
      setPasteName(""); setPasteCsv("");
    } finally {
      setPasteSubmitting(false);
    }
  };

  useEffect(() => {
    syncPreviewScrollMeta();
    const onResize = () => syncPreviewScrollMeta();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeVersion, syncPreviewScrollMeta]);

  const deleteDataset = async (id: DatasetId, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof id !== "number") { addLog("warn", "该数据集来自数据库缓存，暂不支持删除"); return; }
    if (!confirm("确定要删除这个数据集吗？所有历史版本都会被清除。")) return;
    try {
      addLog("info", "删除数据集...");
      await axios.delete(`/api/datasets/${id}`);
      setDatasets((prev) => {
        const next = prev.filter((d) => d.id !== id);
        if (activeDatasetId === id) {
          setActiveDatasetId(next[0]?.id || null);
          setActiveVersion(next[0]?.versions?.[0] || null);
          setAssignments({});
          setResult(null);
        }
        return next;
      });
      addLog("success", "删除成功");
    } catch (err: any) {
      addLog("error", err?.response?.data?.error || "删除失败");
    }
  };

  const loadFullData = async () => {
    if (!activeVersion || loadingFullData) return;
    setLoadingFullData(true);
    addLog("info", "正在加载全量数据，请稍候...");
    try {
      const { data } = await axios.get(`/api/datasets/version/${activeVersion.id}/full-data`);
      setActiveVersion({ ...activeVersion, sampleRows: data, rowCount: data.length });
      addLog("success", `全量数据加载完成，共 ${data.length} 行`);
    } catch (err) {
      addLog("error", "全量数据加载失败");
    } finally {
      setLoadingFullData(false);
    }
  };

  const deleteVersion = async (id: DatasetId) => {
    if (!activeDataset || typeof id !== "number") {
      addLog("warn", "该版本来自数据库取数，暂不支持在此删除");
      return;
    }
    if (!confirm("确定要删除该版本吗？其他版本将保留。")) return;
    try {
      await axios.delete(`/api/datasets/version/${id}`);
      setDatasets((prev) => {
        return prev.map((ds) => {
          if (ds.id !== activeDataset.id) return ds;
          const nextVersions = ds.versions.filter((v) => v.id !== id);
          const nextActive = activeVersion?.id === id ? nextVersions[0] : activeVersion;
          if (nextActive && nextActive !== activeVersion) {
            setActiveVersion(nextActive as VersionLike);
          }
          return { ...ds, versions: nextVersions } as DatasetLike;
        }).filter((d) => (d as any).versions?.length);
      });
      addLog("success", "版本已删除");
    } catch (err: any) {
      const msg = err?.response?.data?.error || "删除版本失败";
      addLog("error", msg);
      alert(msg);
    }
  };

  const onBatchDeleteReport = async (ids: string[]) => {
    if (!ids.length) return;
    if (!confirm(`确定要删除这 ${ids.length} 条选中的结果吗？`)) return;
    try {
      await axios.post("/api/run-history/batch-delete", { ids });
      addLog("success", `成功批量删除 ${ids.length} 条历史记录`);
      await refreshRunHistory();
    } catch (err: any) {
      addLog("error", "批量删除失败");
    }
  };

  const activeDataset = datasets.find((d: any) => d.id === activeDatasetId)
    || (activeVersion ? datasets.find((d: any) => d.id === activeVersion.datasetId) : undefined);

  const isRunReady = selectedAlgo && activeVersion && selectedAlgo.inputSpec.every(
    (s) => (assignments[s.id] || []).length >= s.min
  );

  const analysisNavItems: { id: Page; icon: string; label: string }[] = [
    { id: "home", icon: "🏠", label: t(lang, "nav", "home") },
    { id: "data", icon: "🗂️", label: t(lang, "nav", "data") },
    { id: "process", icon: "🛠️", label: t(lang, "nav", "proc") },
    { id: "academic", icon: "📐", label: t(lang, "nav", "academic") },
    { id: "ml", icon: "🤖", label: t(lang, "nav", "ml") },
    { id: "builder", icon: "🧩", label: t(lang, "nav", "builder") },
    { id: "report", icon: "📊", label: t(lang, "nav", "report") },
  ];

  const practiceNavItems: { id: Page; icon: string; label: string }[] = [
    { id: "python-lab", icon: "📖", label: lang === 'zh' ? "参与学习" : "Learn" },
    { id: "practical", icon: "🧪", label: lang === 'zh' ? "实操实验室" : "Practical" },
    { id: "lab-assignments", icon: "📝", label: lang === 'zh' ? "作业 & 反馈" : "Assignments" },
    { id: "competitions", icon: "🏁", label: lang === 'zh' ? "算法竞赛" : "Competitions" },
    { id: "deployment", icon: "🚀", label: lang === 'zh' ? "部署实训" : "Deployment" },
    { id: "lab-achievements", icon: "🏆", label: lang === 'zh' ? "我的成果" : "Achievements" },
  ];


  const getAntdLocale = () => {
    if (lang === 'en') return enUS;
    if (lang === 'de') return deDE;
    return zhCN;
  };

  return (
    <ConfigProvider locale={getAntdLocale()}>
      <div className="shell">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo brand-logo">
            <div className="brand-mark">
              <img
                src="/continental_logo.png"
                alt="Continental"
              />
            </div>
            <div className="brand-copy">
              <div className="brand-title">Continental</div>
              <div className="brand-sub">Data Platform</div>
            </div>
          </div>
          <nav className="sidebar-nav">
            <div className="sidebar-section-title">{lang === "zh" ? "分析与中心" : "Algorithm Analysis Center"}</div>
            {analysisNavItems.map((item) => (
              <div key={item.id} className={`sidebar-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                <span className="nav-icon" style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
                {(item.id === "academic" || item.id === "ml") && (
                  <span className="nav-badge">{algorithms.filter((a) => a.category === (item.id === "academic" ? "academic" : "ml")).length}</span>
                )}
                {page === item.id && <div className="active-indicator" />}
              </div>
            ))}

            <div className="sidebar-section-title" style={{ marginTop: 12 }}>{lang === "zh" ? "实训训练营" : "Training Camp"}</div>
            {practiceNavItems.map((item) => (
              <div key={item.id} className={`sidebar-item ${page === item.id ? "active" : ""}`} onClick={() => setPage(item.id)}>
                <span className="nav-icon" style={{ fontSize: 16 }}>{item.icon}</span>
                <span>{item.label}</span>
                {page === item.id && <div className="active-indicator" />}
              </div>
            ))}
            {datasets.length > 0 && <>
              <div className="sidebar-section-title" style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t(lang, "sidebar", "myData")}</span>
                <button className="btn-icon-only" title={t(lang, "sidebar", "uploadData")} onClick={() => setShowUploadModal(true)} style={{ opacity: 0.6 }}>
                  <Plus size={14} />
                </button>
              </div>
              <div style={{ maxHeight: "calc(100vh - 300px)", overflowY: "auto", paddingRight: 4, marginTop: 4 }}>
                {datasets.map((d) => (
                  <div key={d.id} className={`sidebar-item ${activeDatasetId === d.id ? "active" : ""}`}
                    style={{ padding: '8px 12px', margin: '2px 8px', fontSize: 13 }}
                    title={d.name}
                    onClick={() => { setActiveDatasetId(d.id); if (d.versions?.[0]) setActiveVersion(d.versions[0] as any); setPage("data"); }}>
                    <span style={{ fontSize: 14, opacity: 0.7 }}>{(d as any).sourceType === 'db' ? '🗄️' : '📄'}</span>
                    <span className="truncate" style={{ flex: 1 }}>{d.name}</span>
                    {activeDatasetId === d.id && <div className="active-indicator" />}
                  </div>
                ))}
              </div>
            </>}
          </nav>
          <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>
                {user?.name?.[0] || user?.username?.[0] || 'U'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                  {user?.name || user?.username}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }} className="truncate">
                  {user?.username}
                </div>
              </div>
              <button 
                className="btn-icon-only" 
                title={lang === "zh" ? "退出登录" : "Logout"} 
                onClick={authLogout}
                style={{ opacity: 0.6, padding: 4 }}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '0 8px' }} />

            <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
              <button style={{ background: lang === 'zh' ? 'var(--accent)' : 'transparent', color: lang === 'zh' ? '#fff' : 'inherit', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }} onClick={() => (window as any).__setLang('zh')}>ZH</button>
              <button style={{ background: lang === 'en' ? 'var(--accent)' : 'transparent', color: lang === 'en' ? '#fff' : 'inherit', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }} onClick={() => (window as any).__setLang('en')}>EN</button>
              <button style={{ background: lang === 'de' ? 'var(--accent)' : 'transparent', color: lang === 'de' ? '#fff' : 'inherit', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', fontSize: 10, cursor: 'pointer' }} onClick={() => (window as any).__setLang('de')}>DE</button>
            </div>
            <div className="status-indicator">
              <span className={`dot ${running ? "loading" : result ? "" : ""}`} />
              <span className="truncate" style={{ flex: 1 }}>
                {running ? t(lang, "sidebar", "computing") : result ? t(lang, "sidebar", "success") : t(lang, "sidebar", "ready")}
              </span>
              <span className="text-muted" style={{ fontSize: 10 }}>{t(lang, "sidebar", "version")}</span>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="main">
          {/* Global Top-Right Header */}
          <header style={{ 
            height: 56, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', 
            padding: '0 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
            flexShrink: 0, zIndex: 100 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{user?.name || user?.username}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user?.username}</span>
              </div>
              <div style={{ 
                width: 32, height: 32, borderRadius: 16, background: 'var(--accent)', color: '#fff', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12
              }}>
                {user?.name?.[0] || user?.username?.[0] || 'U'}
              </div>
            </div>
          </header>

          {page === "builder" ? (
            <ChartBuilder
              datasets={datasets as any}
              activeDatasetId={activeDatasetId}
              activeVersion={activeVersion as any}
              onSelectDataset={(id) => {
                const ds = datasets.find((d) => String(d.id) === String(id));
                if (ds) {
                  setActiveDatasetId(ds.id);
                  if (ds.versions?.[0]) {
                    setActiveVersion(ds.versions[0] as any);
                  }
                  setAssignments({}); // 切换数据集时清空之前的配置，防止冲突
                }
              }}
              onSelectVersion={(v) => setActiveVersion(v as any)}
            />
          ) : (
            <>
              {/* HomePage Content */}
              {page === "home" && (
                <div className="home-page animate-fade" style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 1 }}>
                  <div className="home-hero-v2" style={{
                    padding: "100px 60px",
                    backgroundImage: "url('/ds_hero_bg.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    color: "white",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    minHeight: "460px"
                  }}>
                    {/* Overlay for better readability */}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.5) 100%)", zIndex: 1 }} />

                    <div style={{ position: "relative", zIndex: 2, maxWidth: 900 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(255,154,0,0.15)", padding: "6px 16px", borderRadius: 99, marginBottom: 24, border: "1px solid rgba(255,154,0,0.3)" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff9a00", boxShadow: "0 0 10px #ff9a00" }} />
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "#ff9a00" }}>CONTINENTAL DS ECOSYSTEM</span>
                      </div>
                      <h1 style={{ fontSize: 52, fontWeight: 800, marginBottom: 20, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                        StatLab <span style={{ color: "#ff9a00" }}>Intelligence</span>
                      </h1>
                      <p style={{ fontSize: 18, color: "#94a3b8", marginBottom: 36, lineHeight: 1.6, maxWidth: "600px" }}>
                        专业的工业级数据科学平台。集成了核心统计学引擎、先进机器学习算法与 AI 智能解读，
                        专为复杂工业生产环境中的多维数据深度挖掘而设计。
                      </p>
                      <div style={{ display: "flex", gap: 20 }}>
                        <button className="btn btn-primary" style={{ padding: "14px 40px", borderRadius: 12, fontSize: 15, fontWeight: 600, boxShadow: "0 10px 20px rgba(37,99,235,0.3)" }} onClick={() => setPage("data")}>进入分析中心</button>
                        <button className="btn" style={{ padding: "14px 28px", borderRadius: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 15 }} onClick={() => setPage("help")}>技术文档</button>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: "0 60px 60px", maxWidth: 1400, margin: "0 auto", position: "relative", zIndex: 10 }}>
                    <div className="home-stats-v2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, marginTop: -40 }}>
                      <div className="card" style={{ padding: 24, borderRadius: 20, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", border: "1px solid var(--border)", background: "white", transition: "transform 0.2s" }}>
                        <div style={{ color: "var(--accent)", fontSize: 24, marginBottom: 12 }}>🗂️</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{datasets.length}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>活跃数据集资源</div>
                      </div>
                      <div className="card" style={{ padding: 24, borderRadius: 20, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", border: "1px solid var(--border)", background: "white", transition: "transform 0.2s" }}>
                        <div style={{ color: "var(--success)", fontSize: 24, marginBottom: 12 }}>📊</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{runHistory.length}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>深度分析任务数</div>
                      </div>
                      <div className="card" style={{ padding: 24, borderRadius: 20, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", border: "1px solid var(--border)", background: "white", transition: "transform 0.2s" }}>
                        <div style={{ color: "var(--purple)", fontSize: 24, marginBottom: 12 }}>🤖</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>{algorithms.length}</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>DS 算法库单元</div>
                      </div>
                      <div className="card" style={{ padding: 24, borderRadius: 20, boxShadow: "0 20px 40px rgba(0,0,0,0.08)", border: "1.5px solid rgba(255,154,0,0.2)", background: "white", transition: "transform 0.2s" }}>
                        <div style={{ color: "#ff9a00", fontSize: 24, marginBottom: 12 }}>⚡</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)" }}>AI Core</div>
                        <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>大语言模型分析引擎</div>
                      </div>
                    </div>

                    <div style={{ marginTop: 40, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 30 }}>
                      <div>
                        <div className="section-head" style={{ marginBottom: 16, fontSize: 16 }}>📊 算法分析模块 (Analysis)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                          <div className="card quick-action-v2" style={{ padding: 20, borderRadius: 16, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setShowUploadModal(true)}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ background: "var(--accent-dim)", color: "var(--accent)", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📤</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>数据上传</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>本地 CSV/Excel</div>
                              </div>
                            </div>
                          </div>
                          <div className="card quick-action-v2" style={{ padding: 20, borderRadius: 16, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setPage("db-connect")}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ background: "var(--purple-dim)", color: "var(--purple)", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🔐</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>产线连接</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>MES/PLC 实时数据</div>
                              </div>
                            </div>
                          </div>
                          <div className="card quick-action-v2" style={{ padding: 20, borderRadius: 16, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setPage("process")}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ background: "var(--bg-raised)", color: "var(--text-primary)", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🛠️</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>数据加工</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>清洗与版本控制</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="section-head" style={{ marginTop: 32, marginBottom: 16, fontSize: 16 }}>🎓 实战与技能 (Training)</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                          <div className="card quick-action-v2" style={{ padding: 20, borderRadius: 16, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setPage("python-lab")}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ background: "rgba(167, 139, 250, 0.15)", color: "#a78bfa", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📖</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>基础学习</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Python/ML 教程</div>
                              </div>
                            </div>
                          </div>
                          <div className="card quick-action-v2" style={{ padding: 20, borderRadius: 16, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setPage("practical")}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ background: "var(--success-dim)", color: "var(--success)", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🧪</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>实操演练</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>工业真实场景模拟</div>
                              </div>
                            </div>
                          </div>
                          <div className="card quick-action-v2" style={{ padding: 20, borderRadius: 16, cursor: "pointer", transition: "all 0.2s" }} onClick={() => setPage("deployment")}>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <div style={{ background: "#fef3c7", color: "#d97706", width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚀</div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14 }}>模型部署</div>
                                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>API 服务实训</div>
                              </div>
                            </div>
                          </div>
                        </div>


                        <div className="section-head" style={{ marginTop: 40, marginBottom: 16, fontSize: 16 }}>💡 操作指南</div>
                        <div className="card" style={{ padding: 0, overflow: "hidden", borderRadius: 16 }}>
                          <div style={{ padding: 20, borderBottom: "1px solid var(--border)", background: "var(--bg-overlay)" }}>
                            <div style={{ fontWeight: 700 }}>典型工作流</div>
                          </div>
                          <div style={{ padding: "20px 24px" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                              {[
                                { step: "01", title: "数据落地", desc: "连接数据库或上传文件，自动识别变量类型与质量" },
                                { step: "02", title: "清理加工", desc: "在线处理缺失值、异常值，生成可追溯的版本记录" },
                                { step: "03", title: "建模计算", desc: "点击式配置统计模型或机器学习，结果实时渲染" },
                                { step: "04", title: "AI 解读", desc: "通过 ✨ 智能按钮将数字转化为大白话，输出 PDF 报告" },
                              ].map((item, idx) => (
                                <div key={idx} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--accent)", opacity: 0.3, marginTop: 2 }}>{item.step}</div>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
                                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{item.desc}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="section-head" style={{ marginBottom: 16, fontSize: 16 }}>🕰️ 最近活跃</div>
                        <div className="card" style={{ borderRadius: 16, padding: "10px 0" }}>
                          {runHistory.length === 0 ? (
                            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                              <div style={{ fontSize: 13 }}>暂无历史记录</div>
                            </div>
                          ) : (
                            runHistory.slice(0, 5).map((r, i) => (
                              <div key={i} className="home-history-item-v2"
                                style={{ padding: "12px 20px", borderBottom: i === 4 ? "none" : "1px solid var(--border)", cursor: "pointer" }}
                                onClick={() => {
                                  setPage("result");
                                  setSelectedAlgo(algorithms.find(a => a.id === r.algoId) || null);
                                  setResult(r.result);
                                  setResTab("output");
                                }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>{r.algoName}</div>
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.ts.split(' ')[1]}</div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: r.status === 'completed' ? 'var(--success)' : 'var(--danger)' }} />
                                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.status === 'completed' ? '已完成' : '已失败'}</div>
                                </div>
                              </div>
                            ))
                          )}
                          {runHistory.length > 5 && (
                            <div style={{ padding: "12px 20px", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                              <button className="btn-link-sm" onClick={() => setPage("report")}>查看完整历史报告</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {page !== "home" && (
                <div className="topbar">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="topbar-title">
                      {([...analysisNavItems, ...practiceNavItems]).find((n) => n.id === page)?.icon} {([...analysisNavItems, ...practiceNavItems]).find((n) => n.id === page)?.label}
                    </div>
                    {activeVersion && <div className="topbar-subtitle truncate" title={activeDataset?.name}>{activeDataset?.name} · {activeVersion.columns.length} 字段</div>}
                  </div>
                  <div className="topbar-actions" style={{ flexShrink: 0 }}>
                    {activeDataset && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-raised)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>VERSION</span>
                          <select className="version-select-clean" value={activeVersion?.id ?? ""}
                            onChange={(e) => {
                              const ver = activeDataset.versions.find((v) => v.id === Number(e.target.value));
                              if (ver) setActiveVersion(ver as VersionLike);
                            }}>
                            {activeDataset.versions.map((v) => <option key={v.id} value={v.id}>V{v.version}</option>)}
                          </select>
                          {activeVersion && (
                            <button className="btn-icon-only" title="删除当前版本" onClick={() => deleteVersion(activeVersion.id)} style={{ padding: 4 }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        {activeVersion && (
                          <button className="btn btn-secondary btn-sm" onClick={() => window.open(`/api/datasets/version/${activeVersion.id}/download`, "_blank")} title="导出当前版本为 CSV">
                            <Download size={14} /> 导出
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" style={{ padding: '4px 8px' }} onClick={(e) => deleteDataset(activeDataset.id as any, e as any)} title="删除整个数据集">
                          <Trash2 size={14} />
                        </button>
                        <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
                      </div>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => setShowUploadModal(true)}>
                      <Plus size={14} /> 新增数据集
                    </button>
                  </div>
                </div>
              )}

              {/* ── 我的数据 ── */}
              {page === "data" && (
                <div className="page" style={{ padding: 20, maxWidth: 1400, margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  {!activeDataset ? (
                    <div className="empty-dashboard">
                      <div className="welcome-hero">
                        <div className="hero-icon"><Table size={48} strokeWidth={1.5} /></div>
                        <h1>欢迎来到数据中心</h1>
                        <p>管理您的业务数据，进行清洗、统计分析或机器学习建模。</p>
                        <button className="btn btn-primary btn-lg" style={{ marginTop: 24, padding: '12px 40px' }} onClick={() => setShowUploadModal(true)}>
                          <Plus size={18} /> 开始上传数据集
                        </button>
                      </div>
                      <div className="quick-start-grid">
                        <div className="quick-card" onClick={() => importSample()}>
                          <div className="q-icon">🔬</div>
                          <div className="q-info"><h3>基础科学示例</h3><p>通用统计分析演示</p></div>
                        </div>
                        <div className="quick-card" onClick={() => importSample("advertising")}>
                          <div className="q-icon">📈</div>
                          <div className="q-info"><h3>销售回测模型</h3><p>广告投放与ROI分析</p></div>
                        </div>
                        <div className="quick-card" onClick={() => setPage("process")}>
                          <div className="q-icon">🛠️</div>
                          <div className="q-info"><h3>数据处理</h3><p>缺失/异常/编码</p></div>
                        </div>
                        <div className="quick-card" onClick={() => setPage("db-connect")}>
                          <div className="q-icon"><Database size={24} /></div>
                          <div className="q-info"><h3>生产外部取数</h3><p>MES/PLC 数据库直连</p></div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="data-workbench-v2">
                      <div className="workbench-top">
                        <div className="data-meta-badges">
                          <div className="meta-badge">
                            <span className="mb-label">总样本行数</span>
                            <span className="mb-val">{(activeVersion?.rowCount ?? 0).toLocaleString()}</span>
                          </div>
                          <div className="meta-badge">
                            <span className="mb-label">特征变量数</span>
                            <span className="mb-val">{activeVersion?.columns.length}</span>
                          </div>
                          <div className="meta-badge">
                            <span className="mb-label">缺失值占比</span>
                            <span className="mb-val">
                              {(activeVersion?.columns.reduce((a, b) => a + b.missingRate, 0) / (activeVersion?.columns.length || 1) * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="workbench-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => setPage("academic")}>
                            <BarChart4 size={14} /> 开始统计分析
                          </button>
                        </div>
                      </div>

                      <div className="workbench-grid">
                        {/* Left: Info & Schema */}
                        <div className="workbench-sidebar-v2">
                          <div className="card" style={{ margin: 0, padding: 16 }}>
                            <div className="card-title-v2"><FileText size={14} /> 字段架构 (Schema)</div>
                            <div className="schema-list-v2">
                              {activeVersion?.columns.map(col => (
                                <div key={col.name} className="schema-item-v2">
                                  <div className={`type-tag-v2 ${col.type === "numeric" ? "num" : "cat"}`}>{col.type === "numeric" ? "N" : "C"}</div>
                                  <div className="schema-name truncate">{col.name}</div>
                                  <div className="schema-miss">{(col.missingRate * 100).toFixed(0)}% 缺</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Right: Data Table */}
                        <div className="workbench-main-v2">
                          <div className="card" style={{ margin: 0, padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <div className="preview-header-v2">
                              <span style={{ fontWeight: 600 }}>数据样本预览</span>
                              <div className="preview-ctrls">
                                <button className={`p-tab ${previewMode === "table" ? 'active' : ''}`} onClick={() => setPreviewMode("table")}>标准</button>
                                <button className={`p-tab ${previewMode === "coding" ? 'active' : ''}`} onClick={() => setPreviewMode("coding")}>编码</button>
                                <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 8px' }} />
                                <button className="btn-link-sm" onClick={loadFullData}>{loadingFullData ? "加载中..." : "加载全页"}</button>
                              </div>
                            </div>

                            <div className="data-table-wrap" style={{ border: 'none', borderRadius: 0 }} ref={previewWrapRef} onScroll={syncPreviewScrollMeta}>
                              <table className={`data-table ${previewMode === "coding" ? "coding-style" : ""}`}>
                                <thead>
                                  {previewMode === "coding" && (
                                    <tr>
                                      <th className="index-col"></th>
                                      {activeVersion?.columns.map((_, i) => (
                                        <th key={i} className="excel-col-head">{String.fromCharCode(65 + (i % 26))}{i >= 26 ? Math.floor(i / 26) : ''}</th>
                                      ))}
                                    </tr>
                                  )}
                                  <tr>
                                    <th style={{ width: 40, textAlign: 'center' }}>#</th>
                                    {activeVersion?.columns.map(c => (
                                      <th key={c.name}>{c.name}<span className="col-type-v2">{c.type}</span></th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {activeVersion?.sampleRows.map((row, idx) => (
                                    <tr key={idx}>
                                      <td className="text-muted" style={{ textAlign: 'center', fontSize: 10 }}>{idx + 1}</td>
                                      {activeVersion?.columns.map(c => (
                                        <td key={c.name} className={c.type} style={{ fontSize: 12 }}>{String(row[c.name] ?? "")}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── 数据处理 ── */}
              {page === "process" && (
                <div className="page" style={{ padding: 0, height: "100%", display: "flex", flexDirection: "column" }}>
                  <DataProcessPage
                    activeVersion={activeVersion as any}
                    activeDatasetId={activeDatasetId as any}
                    addLog={addLog}
                    onVersionCreated={async (v) => {
                      await refreshDatasets();
                      setActiveDatasetId(v.datasetId as any);
                      setActiveVersion(v as any);
                      addLog("success", `生成新版本 V${v.version}`);
                    }}
                  />
                </div>
              )}

              {/* ── 数据库连接 ── */}
              {page === "db-connect" && (
                <DbConnect
                  onBack={() => setPage("data")}
                  addLog={addLog}
                  onDatasetCreated={async (datasetId) => {
                    try {
                      const res = await axios.get(`/api/connections/dataset/${datasetId}`);
                      const dbDs = res.data;
                      const createdAt = new Date().toISOString();
                      const version: VersionLike = {
                        id: dbDs.id,
                        datasetId: dbDs.id,
                        version: 1,
                        path: "",
                        columns: dbDs.columns,
                        sampleRows: dbDs.previewRows,
                        rowCount: Array.isArray(dbDs.previewRows) ? dbDs.previewRows.length : 0
                      };
                      const dbDataset: DatasetLike = {
                        id: dbDs.id,
                        name: dbDs.name || "数据库取数",
                        originalFilename: dbDs.name || "db",
                        createdAt,
                        versions: [version],
                        sourceType: "db"
                      };
                      // Persist DB dataset ids so refresh retains them
                      try {
                        const cached: string[] = JSON.parse(localStorage.getItem("db-datasets-cache") || "[]");
                        const uniq = Array.from(new Set([...cached, dbDataset.id]));
                        localStorage.setItem("db-datasets-cache", JSON.stringify(uniq));
                      } catch {
                        // ignore storage errors
                      }
                      setDatasets((prev) => {
                        const exists = prev.find((d: any) => d.id === dbDataset.id);
                        return exists ? prev : [...prev, dbDataset];
                      });
                      setActiveVersion(version);
                      setActiveDatasetId(dbDataset.id);
                      setAssignments({});
                      setResult(null);
                      setPage("data");
                    } catch (e) {
                      addLog("error", "无法加载取出的数据");
                    }
                  }}
                />
              )}



              {/* ── 机器学习工作台 ── */}
              {page === "ml" && (
                <div style={{ flex: 1, display: "flex", overflow: "hidden", height: "100%" }}>
                  <MLWorkspace
                    algorithms={algorithms}
                    activeVersion={activeVersion}
                    datasets={datasets}
                    lang={lang}
                    onSelectDataset={(id) => {
                      const ds = datasets.find(d => String(d.id) === String(id));
                      if (ds) {
                        setActiveDatasetId(ds.id);
                        const ver = ds.versions[ds.versions.length - 1] as VersionLike;
                        if (ver) setActiveVersion(ver);
                      }
                    }}
                    addLog={addLog}
                  />
                </div>
              )}
              
              {page === "python-lab" && (
                <PythonLab initialCourseId={pendingCourseId} />
              )}

              {page === "lab-notebooks" && (
                <LabPortal
                  initialTab="notebooks"
                  onGoToCourse={(courseId) => { setPendingCourseId(courseId); setPage("python-lab"); }}
                />
              )}

              {page === "lab-assignments" && (
                <LabPortal
                  initialTab="assignments"
                  onGoToCourse={(courseId) => { setPendingCourseId(courseId); setPage("python-lab"); }}
                />
              )}

              {page === "lab-achievements" && (
                <LabPortal
                  initialTab="achievements"
                  onGoToCourse={(courseId) => { setPendingCourseId(courseId); setPage("python-lab"); }}
                />
              )}

              {page === "practical" && (
                <PracticalLabs />
              )}

              {page === "competitions" && (
                <Competitions />
              )}

              {page === "deployment" && (
                <DeploymentTraining />
              )}



              {/* ── 学术统计 ── */}
              {page === "academic" && (
                <DndContext sensors={sensors} onDragEnd={onDrop}>
                  <div className="analysis-layout">
                    {/* Column 1: Algos */}
                    <div className="analysis-sidebar-algo">
                      <div style={{ padding: 16, borderBottom: "1px solid var(--border)" }}>
                        <div className="explorer-title">🛠️ 算法库</div>
                        <div className="search-input" style={{ marginTop: 12 }}>
                          <span className="search-icon">🔍</span>
                          <input placeholder="搜索算法..." value={algoSearch} onChange={(e) => setAlgoSearch(e.target.value)} />
                        </div>
                      </div>
                      <div className="algo-list" style={{ flex: 1, overflowY: "auto" }}>
                        {Array.from(algosBySub.entries()).map(([sub, algos]) => {
                          const isCollapsed = collapsedGroups.has(sub) && algoSearch.trim() === "";
                          return (
                            <div key={sub} className="algo-group">
                              <div className="subcategory-label" onClick={() => setCollapsedGroups(prev => {
                                const next = new Set(prev);
                                next.has(sub) ? next.delete(sub) : next.add(sub);
                                return next;
                              })} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", padding: "10px 16px" }}>
                                <span>{sub}</span>
                                <span style={{ fontSize: 10, transform: isCollapsed ? "rotate(-90deg)" : "0deg" }}>▼</span>
                              </div>
                              {!isCollapsed && algos.map((algo) => (
                                <div key={algo.id} className={`algo-item ${selectedAlgo?.id === algo.id ? "active" : ""}`}
                                  onClick={() => { setSelectedAlgo(algo); setAssignments({}); setResult(null); }}>
                                  <div className="algo-item-name">{algo.name}</div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Column 2: Variable Explorer (draggable + reference) */}
                    <div className="analysis-sidebar-vars">
                      <div className="var-explorer-header">
                        <div className="explorer-title" style={{ justifyContent: "space-between" }}>
                          <span>📂 选择变量</span>
                          <div style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer" }} onClick={() => setPage('data')}>预览数据</div>
                        </div>
                        <div className="search-input">
                          <span className="search-icon">🔍</span>
                          <input placeholder="过滤变量..." value={varSearch} onChange={(e) => setVarSearch(e.target.value)} />
                        </div>
                      </div>
                      <div className="var-list-group">
                        {activeVersion ? (
                          (() => {
                            const numVars = variables.filter((c: any) => c.type === 'numeric');
                            const catVars = variables.filter((c: any) => c.type !== 'numeric');
                            return (
                              <>
                                <div className="subcategory-label" style={{ background: "transparent", color: "var(--text-muted)" }}>定量变量 ({numVars.length})</div>
                                {numVars.map((v: any) => (
                                  <DraggableVarItem key={v.name} name={v.name} type={v.type} />
                                ))}
                                <div className="subcategory-label" style={{ background: "transparent", color: "var(--text-muted)", marginTop: 12 }}>定类变量 ({catVars.length})</div>
                                {catVars.map((v: any) => (
                                  <DraggableVarItem key={v.name} name={v.name} type={v.type} />
                                ))}
                              </>
                            );
                          })()
                        ) : (
                          <div className="empty-state" style={{ padding: 20 }}>选择数据集后查看变量</div>
                        )}
                      </div>
                    </div>

                    {/* Column 3: Workspace */}
                    <div className="analysis-main-workspace">
                      {!selectedAlgo ? (
                        <div className="empty-state" style={{ marginTop: 100 }}>
                          <div className="empty-icon">👈</div>
                          <div className="empty-title">准备就绪</div>
                          <div className="empty-desc">请先从左侧算法库中选择一个分析方法</div>
                        </div>
                      ) : (
                        <div className="animate-fade">
                          <div className="workspace-header">
                            <div className="workspace-title">
                              {selectedAlgo.name}
                              <button className="btn btn-ghost btn-xs" title="查看帮助" style={{ borderRadius: "50%", width: 24, height: 24, padding: 0 }}>?</button>
                            </div>
                            <div className="workspace-desc">{selectedAlgo.explanation || selectedAlgo.description}</div>
                          </div>

                          <div className="slot-container">
                            {selectedAlgo.inputSpec.map((spec) => (
                              <HybridSlot
                                key={spec.id}
                                spec={spec}
                                assigned={assignments[spec.id] || []}
                                allColumns={activeVersion?.columns || []}
                                varSearch={varSearch}
                                onChange={(vars) => setAssignments(p => ({ ...p, [spec.id]: vars }))}
                              />
                            ))}
                          </div>

                          {selectedAlgo.paramSchema.length > 0 && (
                            <div className="card" style={{ background: "var(--bg-raised)", border: "none", marginBottom: 20 }}>
                              <div className="card-title" style={{ fontSize: 13 }}>参数与配置</div>
                              <ParamPanel schema={selectedAlgo.paramSchema} values={params} onChange={setParams} />
                            </div>
                          )}

                          <div className="card" style={{ margin: "20px 0 10px", padding: 16, border: "1px dashed var(--border)" }}>
                            <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>📋 分析元数据 (可选)</div>
                            <div className="flex-row" style={{ gap: 12 }}>
                              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>本次分析名称</label>
                                <input className="input" placeholder="例如：A线良率根因分析" value={analysisName} onChange={e => setAnalysisName(e.target.value)} style={{ padding: "6px 10px" }} />
                              </div>
                              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <label style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, display: "block" }}>分析人</label>
                                <input className="input" placeholder="例如：张工" value={analystName} onChange={e => setAnalystName(e.target.value)} style={{ padding: "6px 10px" }} />
                              </div>
                            </div>
                          </div>

                          <div className="action-bar">
                            <button className="btn btn-secondary" onClick={() => { setAssignments({}); setResult(null); setAnalysisName(""); setAnalystName(""); }}>重置</button>
                            <button className="btn btn-primary btn-lg" onClick={run} disabled={!isRunReady || running} style={{ padding: "10px 40px" }}>
                              {running ? "正在计算..." : "开始分析"}
                            </button>
                          </div>

                          {!isRunReady && <div style={{ color: "var(--danger)", fontSize: 12, textAlign: "right", marginTop: 8 }}>⚠️ 请先完成必填变量的分配</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </DndContext>
              )}

              {/* ── 分析结果全屏页面 ── */}
              {page === "result" && (
                <ErrorBoundary>
                  <AnalysisResultPage
                    result={result}
                    resTab={resTab}
                    setResTab={setResTab}
                    logs={logs}
                    setLogs={setLogs}
                    onBack={() => setPage(selectedAlgo ? (selectedAlgo.category === "ml" ? "ml" : "academic") : "report")}
                    algoName={selectedAlgo?.name || "分析结果"}
                    algoCategory={selectedAlgo?.category}
                  />
                </ErrorBoundary>
              )}

              {/* ── 报告中心 ── */}
              {page === "report" && (
                <ErrorBoundary>
                  <ReportPage
                    runHistory={runHistory}
                    datasets={datasets}
                    algorithms={algorithms}
                    onLoadResult={(r) => {
                      const algo = algorithms.find(a => a.id === r.algoId);
                      if (algo) setSelectedAlgo(algo);
                      setResult(r.result); setResTab("output"); setPage("result");
                    }}
                    onDeleteReport={async (id) => {
                      await axios.delete(`/api/run-history/${id}`);
                      await refreshRunHistory();
                    }}
                    onBatchDeleteReport={onBatchDeleteReport}
                  />
                </ErrorBoundary>
              )}

              {/* ── 帮助 ── */}
              {page === "help" && <HelpPage />}
            </>
          )}
          
          <AiAssistant />

        {/* ── Newbie Guide (always available) ── */}
        <button
          className="fab-button guide-fab"
          style={{ left: guideFabPos.x, top: guideFabPos.y, width: FAB_SIZE, height: FAB_SIZE }}
          onMouseDown={(e) => {
            const startX = e.clientX; const startY = e.clientY; const start = guideFabPos;
            const onMove = (ev: MouseEvent) => {
              const dx = ev.clientX - startX; const dy = ev.clientY - startY;
              setGuideFabPos(clampPos(start.x + dx, start.y + dy));
            };
            const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          onClick={() => setShowGuide(true)}
          title="新手引导"
        >
          <span style={{ fontSize: 18 }}>✨</span>
          <span style={{ fontSize: 11, fontWeight: 800 }}>引导</span>
        </button>
        {showGuide && (
          <GuideOverlay
            tab={guideTab}
            onClose={() => setShowGuide(false)}
            onTab={(id) => setGuideTab(id)}
            onJump={(pageId) => { setPage(pageId as Page); setShowGuide(false); }}
            hasDataset={datasets.length > 0}
            hasResult={runHistory.some((r) => r.status === "completed" && r.result)}
            hasModel={runHistory.some((r) => (r.result as any)?.extras?.modelPackage)}
          />
        )}
        </div>

        {/* ── Upload Modal ── */}
        {showUploadModal && (
          <div className="modal-overlay" onClick={() => !uploading && setShowUploadModal(false)}>
            <div className="modal-content" style={{ width: 500, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">📦 导入新数据</span>
                <button className="modal-close-btn" onClick={() => !uploading && setShowUploadModal(false)}>×</button>
              </div>
              <div style={{ padding: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <label className="import-box pulsable" style={{ cursor: 'pointer' }}>
                    <input type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { uploadDataset(f); setShowUploadModal(false); }
                    }} />
                    <div className="ib-icon"><Upload size={24} /></div>
                    <div className="ib-text">上传本地文件</div>
                    <div className="ib-sub">CSV / Excel</div>
                  </label>
                  <div className="import-box" onClick={() => { setPage("db-connect"); setShowUploadModal(false); }}>
                    <div className="ib-icon"><Database size={24} /></div>
                    <div className="ib-text">数据库取数</div>
                    <div className="ib-sub">MES / PLC / SQL</div>
                  </div>
                </div>

                <div className="card" style={{ margin: 0, padding: 16 }}>
                  <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>手动粘贴数据</div>
                  <div className="form-group">
                    <input className="input" placeholder="数据集名称 (非必填)" value={pasteName} onChange={e => setPasteName(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginTop: 8 }}>
                    <textarea className="input" style={{ minHeight: 100, fontSize: 11, fontFamily: 'monospace' }}
                      placeholder="粘贴 CSV 单元格内容..." value={pasteCsv} onChange={e => setPasteCsv(e.target.value)} />
                  </div>
                  <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 12 }}
                    onClick={async () => { await uploadPastedCsv(); setShowUploadModal(false); }}>
                    ✨ 立即创建
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showSamplePicker && (
          <div className="modal-overlay" onClick={() => setShowSamplePicker(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520, maxWidth: "90vw" }}>
              <div className="modal-header">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>选择要导入的示例数据</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>支持专业行业样本，点击即导入</div>
                </div>
                <button className="modal-close-btn" onClick={() => setShowSamplePicker(false)}>×</button>
              </div>
              <div style={{ padding: "8px 0", display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                {sampleOptions.map(opt => (
                  <div key={opt.id || "default"} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{opt.desc}</div>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={async () => {
                      await importSample(opt.id || undefined);
                      setShowSamplePicker(false);
                    }}>导入</button>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>可多次导入不同样本，或一键全部导入</div>
                <button className="btn btn-secondary btn-sm" onClick={async () => {
                  await importAllSamples();
                  setShowSamplePicker(false);
                }}>一键导入全部</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConfigProvider>
  );
}

// ─── DraggableVarPill (for data processing section) ─────────────────────────
function DraggableVarPill({ name, type }: { name: string; type: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: name });
  const isNum = type === "numeric";
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, zIndex: 999, opacity: 0.8, position: "relative" as const }
    : {};
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className={`var-pill ${type}`}
      style={{ ...style, cursor: "grab", opacity: isDragging ? 0.4 : 1 }}
    >
      <div className="var-pill-name">{name}</div>
      <div className="var-pill-type">{type}</div>
      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", userSelect: "none" }}>⋮⋮</span>
    </div>
  );
}

// ─── HybridProcessSlot (drop + click picker for data processing) ────────────
function HybridProcessSlot({ slotId, assigned, allColumns, onAdd, onRemove, onClear, onSelectAll }: {
  slotId: string;
  assigned: string[];
  allColumns: { name: string; type: string }[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onClear: () => void;
  onSelectAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: slotId });
  const filtered = filter ? allColumns.filter(c => c.name.toLowerCase().includes(filter.toLowerCase())) : allColumns;

  return (
    <div>
      <div ref={setNodeRef} style={{
        minHeight: 60, borderRadius: 10,
        border: isOver ? "2px dashed var(--accent)" : "2px dashed var(--border)",
        background: isOver ? "var(--accent-dim)" : "var(--bg-raised)",
        padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 8,
        alignContent: "flex-start", cursor: "pointer", transition: "all 0.15s"
      }} onClick={() => setOpen(!open)}>
        {assigned.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 12, width: "100%", textAlign: "center", paddingTop: 12 }}>
            {isOver ? "松开放入变量" : "点击选择 或 拖拽变量至此"}
          </div>
        ) : (
          assigned.map(v => (
            <span key={v} className="slot-var-chip" style={{ background: "var(--bg-surface)", padding: "5px 10px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6, border: "1px solid var(--border-strong)", fontSize: 12, fontWeight: 600 }}>
              {v}
              <button onClick={(e) => { e.stopPropagation(); onRemove(v); }} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", padding: "0 4px", alignSelf: "center" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{
          border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px",
          background: "var(--bg-surface)", maxHeight: 220, overflowY: "auto"
        }}>
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-surface)", zIndex: 1 }}>
            <input
              placeholder="搜索变量..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{ width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid var(--border)", background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: 12, outline: "none" }}
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>无匹配变量</div>
          ) : (
            filtered.map(c => {
              const checked = assigned.includes(c.name);
              return (
                <div key={c.name}
                  onClick={(e) => { e.stopPropagation(); checked ? onRemove(c.name) : onAdd(c.name); }}
                  style={{
                    padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
                    cursor: "pointer", background: checked ? "var(--accent-dim)" : "transparent",
                    borderBottom: "1px solid var(--border)"
                  }}>
                  <input type="checkbox" checked={checked} readOnly style={{ accentColor: "var(--accent)" }} />
                  <span style={{ fontSize: 13 }}>{c.type === 'numeric' ? '📊' : '🏷️'}</span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{c.type === 'numeric' ? '定量' : '定类'}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── DraggableVarItem (for sidebar variable list) ──────────────────────────
function DraggableVarItem({ name, type }: { name: string; type: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: name });
  const isNum = type === "numeric";
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px,${transform.y}px,0)`, zIndex: 999, opacity: 0.8, position: "relative" as const }
    : {};
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      className="var-list-item"
      style={{ ...style, cursor: "grab", opacity: isDragging ? 0.4 : 1 }}
    >
      <span style={{ fontSize: 14 }}>{isNum ? '📊' : '🏷️'}</span>
      <div className="var-name">{name}</div>
      <span className={`tag ${isNum ? 'accent' : 'purple'}`} style={{ fontSize: 9 }}>{isNum ? '定量' : '定类'}</span>
      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", userSelect: "none" }}>⋮⋮</span>
    </div>
  );
}

// ─── HybridSlot (drop target + click picker) ───────────────────────────────
function HybridSlot({ spec, assigned, allColumns, varSearch, onChange }: {
  spec: InputSlotSpec;
  assigned: string[];
  allColumns: { name: string; type: string }[];
  varSearch: string;
  onChange: (vars: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [localFilter, setLocalFilter] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: spec.id });
  const compatible = allColumns.filter(c => spec.acceptedTypes.includes(c.type as any));
  const filterText = localFilter || varSearch;
  const filtered = filterText ? compatible.filter(c => c.name.toLowerCase().includes(filterText.toLowerCase())) : compatible;
  const hasMax = typeof spec.max === "number";
  const atMax = hasMax && assigned.length >= spec.max!;

  const toggle = (name: string) => {
    if (assigned.includes(name)) {
      onChange(assigned.filter(v => v !== name));
    } else {
      if (atMax) return;
      onChange([...assigned, name]);
    }
  };

  const fillAll = () => {
    const toAdd = compatible.filter(v => !assigned.includes(v.name)).map(v => v.name);
    if (hasMax) {
      const remaining = spec.max! - assigned.length;
      onChange([...assigned, ...toAdd.slice(0, remaining)]);
    } else {
      onChange([...assigned, ...toAdd]);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="slot-header">
        <span style={{ fontWeight: 600 }}>{spec.label}</span>
        <span className={`type-tag ${spec.acceptedTypes.includes('numeric') ? 'numeric' : 'categorical'}`}>
          {spec.acceptedTypes.map(t => t === 'numeric' ? '定量' : '定类').join(' / ')}
        </span>
        {spec.min > 0 && assigned.length === 0 && <span style={{ color: "var(--danger)", fontSize: 10, fontWeight: 600 }}>必填</span>}
        {hasMax && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>最多 {spec.max}</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {compatible.length > 0 && !atMax && (
            <button className="btn btn-ghost btn-xs" style={{ fontSize: 11, padding: "2px 8px" }} onClick={fillAll}>全选</button>
          )}
          {assigned.length > 0 && (
            <button className="btn btn-ghost btn-xs" style={{ fontSize: 11, padding: "2px 8px", color: "var(--text-muted)" }} onClick={() => onChange([])}>清空</button>
          )}
        </div>
      </div>

      <div ref={setNodeRef} style={{
        minHeight: 48, borderRadius: 8,
        border: isOver ? "2px dashed var(--accent)" : "1px solid var(--border)",
        background: isOver ? "var(--accent-dim)" : "var(--bg-surface)",
        padding: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center",
        cursor: "pointer", transition: "all 0.15s"
      }} onClick={() => setOpen(!open)}>
        {assigned.length === 0 ? (
          <span style={{ color: "var(--text-muted)", fontSize: 12, padding: "4px 8px" }}>
            {isOver ? "松开放入变量" : "点击选择 或 拖拽变量至此"}
          </span>
        ) : (
          assigned.map(v => (
            <span key={v} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: "var(--bg-raised)", border: "1px solid var(--border-strong)",
              display: "flex", alignItems: "center", gap: 6
            }}>
              {v}
              <button onClick={(e) => { e.stopPropagation(); toggle(v); }} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
            </span>
          ))
        )}
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-muted)", padding: "0 4px" }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{
          border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px",
          background: "var(--bg-surface)", maxHeight: 220, overflowY: "auto"
        }}>
          <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-surface)", zIndex: 1 }}>
            <input
              placeholder="搜索变量..."
              value={localFilter}
              onChange={e => setLocalFilter(e.target.value)}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%", padding: "5px 8px", borderRadius: 4, border: "1px solid var(--border)",
                background: "var(--bg-raised)", color: "var(--text-primary)", fontSize: 12, outline: "none"
              }}
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 12, fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>无匹配变量</div>
          ) : (
            filtered.map(c => {
              const checked = assigned.includes(c.name);
              const disabled = !checked && atMax;
              return (
                <div
                  key={c.name}
                  onClick={(e) => { e.stopPropagation(); if (!disabled) toggle(c.name); }}
                  style={{
                    padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
                    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
                    background: checked ? "var(--accent-dim)" : "transparent",
                    borderBottom: "1px solid var(--border)"
                  }}
                >
                  <input type="checkbox" checked={checked} readOnly style={{ accentColor: "var(--accent)" }} />
                  <span style={{ fontSize: 13 }}>{c.type === 'numeric' ? '📊' : '🏷️'}</span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{c.type === 'numeric' ? '定量' : '定类'}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Guide Overlay (pro/onboarding) ──────────────────────────────────────────
function GuideOverlay({ tab, onTab, onClose, onJump, hasDataset, hasResult, hasModel }: {
  tab: string;
  onTab: (id: string) => void;
  onClose: () => void;
  onJump: (pageId: string) => void;
  hasDataset: boolean;
  hasResult: boolean;
  hasModel: boolean;
}) {
  const tabs = [
    { id: "play", label: "快速上手" },
    { id: "issues", label: "常见问题" },
    { id: "faq", label: "FAQ" }
  ];

  const playbooks = [
    {
      id: "starter",
      title: "首个完整流程",
      subtitle: "5 分钟跑通：数据 → 处理 → 分析/建模",
      steps: [
        { label: "1. 导入数据", detail: "上传 CSV/Excel，或点击“尝试示例”一键导入", action: () => onJump("data"), done: hasDataset },
        { label: "2. 处理与清洗", detail: "在“数据处理”完成缺失值/异常值清理，生成新版本", action: () => onJump("process"), done: false },
        { label: "3. 分析或建模", detail: "学术统计走“统计分析”，机器学习走“机器学习”页", action: () => onJump("academic"), done: false }
      ],
      ctaLabel: "现在就试一遍",
      cta: () => onJump(hasDataset ? "process" : "data")
    },
    {
      id: "ml",
      title: "机器学习最短路径",
      subtitle: "含特征工程、训练日志与模型导出",
      steps: [
        { label: "选择算法", detail: "左侧选择 ML 算法，分配特征/标签槽位", action: () => onJump("ml"), done: false },
        { label: "检查输入", detail: "类型不匹配会提示，数值型/分类型要对应", action: () => onJump("ml"), done: false },
        { label: "启动训练", detail: "点击“开始训练模型”，在右侧实时查看日志", action: () => onJump("ml"), done: false },
        { label: "导出或预测", detail: "结果页可导出模型 JSON 或提交批量预测", action: () => onJump("report"), done: hasModel }
      ],
      ctaLabel: "去建模",
      cta: () => onJump("ml")
    },
    {
      id: "report",
      title: "报告管理与专业复盘",
      subtitle: "按项目/批次沉淀可追溯的分析结论与模型",
      steps: [
        {
          label: "1. 管理报告资产",
          detail: "在「报告中心」按算法、数据集或时间筛选运行记录，标记关键版本，定期清理无效实验。",
          action: () => onJump("report"),
          done: hasResult
        },
        {
          label: "2. 深度复盘单次分析",
          detail: "点击某条记录进入报告页：先看总览与注意事项，再看图表/规则，结合现场情况补充备注。",
          action: () => onJump("report"),
          done: hasResult
        },
        {
          label: "3. 导出与复用",
          detail: "对工业诊断或 ML 建模类任务，导出 PDF 用于评审，或导出模型用于后续预测与持续监控。",
          action: () => onJump("report"),
          done: hasModel
        }
      ],
      ctaLabel: hasResult ? "打开报告中心" : "查看历史记录",
      cta: () => onJump("report")
    }
  ];

  const issues = [
    { q: "拖拽变量不生效？", a: "检查列类型是否与槽位要求匹配；必填槽位需先填满；若是触摸板，尝试点击选择模式。" },
    { q: "训练卡住/无响应？", a: "查看右侧 Training Log，若无输出刷新页面后重试；超大数据集建议采样或先做缺失清洗。" },
    { q: "指标看不懂？", a: "结果页“评估指标”下方附有解释；回归关注 R²/RMSE，分类关注 Accuracy/F1/AUC。" },
    { q: "预测报错字段不匹配？", a: "批量预测的 JSON 字段必须与训练特征一致；分类独热列需填 0/1；数值列保持数字。" }
  ];

  const faqs = [
    { q: "示例数据在哪里？", a: "首页“尝试示例”或侧边栏“我的数据集”上方的上传按钮。" },
    { q: "能否导出模型？", a: "ML 结果页点击“导出模型文件 (.json)”，可用于再次加载或预测。" },
    { q: "如何保存处理后的版本？", a: "在“数据处理”执行操作后点击生成新版本，原始数据不会被覆盖。" },
    { q: "支持哪些算法？", a: "统计类：描述/相关/T检验/ANOVA 等；ML：回归、分类、聚类、诊断、准备（特征工程）。" }
  ];

  const activeTab = tabs.find((t) => t.id === tab) || tabs[0];

  return (
    <div className="guide-backdrop" onClick={onClose}>
      <div className="guide-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="guide-drawer-head">
          <div>
            <div className="guide-title">🧭 引导助手</div>
            <div className="guide-sub">为小白准备的“边看边做”路径，照着点就行</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>关闭</button>
        </div>

        <div className="guide-tabbar">
          {tabs.map((t) => (
            <button key={t.id} className={`guide-pill ${activeTab.id === t.id ? "active" : ""}`} onClick={() => onTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="guide-content-new">
          {activeTab.id === "play" && (
            <div className="guide-grid">
              {playbooks.map((pb) => (
                <div key={pb.id} className="guide-card">
                  <div className="guide-card-head">
                    <div>
                      <div className="guide-card-title">{pb.title}</div>
                      <div className="guide-card-sub">{pb.subtitle}</div>
                    </div>
                    <span className={`guide-chip ${pb.id === "starter" && hasDataset ? "chip-success" : "chip-muted"}`}>
                      {pb.id === "starter" && hasDataset ? "数据已就绪" : "按序执行"}
                    </span>
                  </div>
                  <div className="guide-steps">
                    {pb.steps.map((s, idx) => (
                      <div key={idx} className="guide-step-row">
                        <div className="guide-step-index">{idx + 1}</div>
                        <div className="guide-step-body">
                          <div className="guide-step-title">{s.label}</div>
                          <div className="guide-step-desc">{s.detail}</div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={s.action}>去看看</button>
                      </div>
                    ))}
                  </div>
                  <div className="guide-card-footer">
                    <button className="btn btn-primary" onClick={pb.cta}>{pb.ctaLabel}</button>
                    <span className="guide-hint">完成后可返回这里继续下一步</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab.id === "issues" && (
            <div className="guide-list">
              {issues.map((item, i) => (
                <div key={i} className="guide-qa">
                  <div className="guide-qa-q">{item.q}</div>
                  <div className="guide-qa-a">{item.a}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab.id === "faq" && (
            <div className="guide-list">
              {faqs.map((item, i) => (
                <div key={i} className="guide-qa">
                  <div className="guide-qa-q">{item.q}</div>
                  <div className="guide-qa-a">{item.a}</div>
                </div>
              ))}
              <div className="guide-foot-note">更多细节可在“帮助文档”查看，或者直接尝试操作，遇到提示按提示修正即可。</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ParamPanel ───────────────────────────────────────────────────────────────
function ParamPanel({ schema, values, onChange }: { schema: ParamDef[]; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (key: string, val: unknown) => onChange({ ...values, [key]: val });
  return (
    <div className="param-grid">
      {schema.map((p) => (
        <div key={p.key} className="param-item">
          <label className="param-label">{p.label}</label>
          {p.type === "boolean" ? (
            <label className="flex-row" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={Boolean(values[p.key] ?? p.default)} onChange={(e) => set(p.key, e.target.checked)} />
              <span className="text-secondary" style={{ fontSize: 12 }}>{values[p.key] ? "是" : "否"}</span>
            </label>
          ) : p.type === "select" ? (
            <select className="param-input" value={String(values[p.key] ?? p.default ?? "")} onChange={(e) => set(p.key, e.target.value)}>
              {(p.options || []).map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
            </select>
          ) : (
            <div className="flex-row" style={{ gap: 6 }}>
              <input type="number" className="param-input" style={{ maxWidth: 72 }}
                min={p.min} max={p.max} step={p.step ?? 1}
                value={String(values[p.key] ?? p.default ?? "")}
                onChange={(e) => set(p.key, Number(e.target.value))} />
              {p.min !== undefined && p.max !== undefined && (
                <input type="range" className="param-input" min={p.min} max={p.max} step={p.step ?? 1}
                  value={Number(values[p.key] ?? p.default ?? p.min)}
                  onChange={(e) => set(p.key, Number(e.target.value))} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ResultTable ── (sortable) ─────────────────────────────────────────────────
function ResultTable({ table }: { table: { title: string; columns: string[]; rows: (string | number | null)[][] } }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = (idx: number) => {
    if (sortCol === idx) {
      if (!sortAsc) setSortCol(null);
      else setSortAsc(false);
    } else {
      setSortCol(idx);
      setSortAsc(false); // default desc — highest correlation on top
    }
  };

  const displayRows = useMemo(() => {
    if (sortCol === null) return table.rows;
    return [...table.rows].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol];
      if (va === vb) return 0;
      if (va === null || va === undefined || va === "—") return 1;
      if (vb === null || vb === undefined || vb === "—") return -1;
      const na = typeof va === "number" ? va : parseFloat(String(va));
      const nb = typeof vb === "number" ? vb : parseFloat(String(vb));
      if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na;
      return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [table.rows, sortCol, sortAsc]);

  return (
    <div className="result-table-wrap">
      <div className="result-table-title">📋 {table.title}</div>
      <div style={{ overflowX: "auto" }}>
        <table className="result-table">
          <thead>
            <tr>
              {table.columns.map((c, idx) => (
                <th key={c} onClick={() => handleSort(idx)}
                  style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                  {c}
                  <span style={{ marginLeft: 4, opacity: sortCol === idx ? 1 : 0.3, fontSize: 11 }}>
                    {sortCol === idx ? (sortAsc ? "↑" : "↓") : "⇅"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                {row.map((val, j) => {
                  const cls = j === 0 && typeof val === "string" ? "label-cell" : colorCell(val, table.columns[j] || "");
                  return <td key={j} className={cls}>{val === null || val === undefined ? "—" : String(val)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ChartModal (fullscreen) ──────────────────────────────────────────────────
function ChartModal({ title, option, onClose }: { title: string; option: Record<string, unknown>; onClose: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<ReturnType<typeof echarts.init> | null>(null);
  const [size, setSize] = useState({ w: window.innerWidth * 0.85, h: window.innerHeight * 0.85 });
  const resizing = useRef(false);
  const startPos = useRef({ x: 0, y: 0, w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    try {
      if (!chartInstance.current) {
        chartInstance.current = echarts.init(ref.current, undefined);
      }
      const chart = chartInstance.current;
      chart.setOption({ backgroundColor: "transparent", ...option }, true);

      const resizeChart = () => chart.resize();
      window.addEventListener("resize", resizeChart);
      setTimeout(resizeChart, 100);

      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", onKey);

      return () => {
        chart.dispose();
        chartInstance.current = null;
        window.removeEventListener("resize", resizeChart);
        window.removeEventListener("keydown", onKey);
      };
    } catch (err) {
      console.error("[ChartModal] setOption failed:", err);
    }
  }, [option, onClose]);

  useEffect(() => {
    chartInstance.current?.resize();
  }, [size]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    resizing.current = true;
    startPos.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      setSize({
        w: Math.max(300, startPos.current.w + ev.clientX - startPos.current.x),
        h: Math.max(200, startPos.current.h + ev.clientY - startPos.current.y)
      });
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content chart-modal-content" style={{ width: size.w, height: size.h, maxHeight: '100vh', maxWidth: '100vw', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">📈 {title}</span>
          <button className="modal-close-btn" onClick={onClose} title="关闭 (Esc)">×</button>
        </div>
        <div style={{ flex: 1, padding: 16, overflow: "hidden" }}>
          <div ref={ref} style={{ width: "100%", height: "100%" }} />
        </div>
        <div onMouseDown={onMouseDown}
          style={{
            position: "absolute", bottom: 0, right: 0, width: 20, height: 20,
            cursor: "nwse-resize", display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 4
          }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" opacity="0.4">
            <path d="M10 0V10H0L10 0Z" fill="currentColor" />
          </svg>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Sanitize ECharts option: fix heatmap that requires category axes
function sanitizeChartOption(opt: Record<string, unknown>): Record<string, unknown> {
  const series = opt.series as any[] | undefined;
  if (!series?.some((s: any) => s.type === "heatmap")) return opt;

  const patched = { ...opt };
  const xAxis = patched.xAxis as any || {};
  const yAxis = patched.yAxis as any || {};
  const heatSeries = series!.find((s: any) => s.type === "heatmap");
  const rawData: any[] = heatSeries?.data || [];

  const needFixX = xAxis.type !== "category" || !xAxis.data;
  const needFixY = yAxis.type !== "category" || !yAxis.data;
  if (!needFixX && !needFixY) return opt;

  const xVals = [...new Set(rawData.map((d: any) => d[0]))].sort((a: number, b: number) => a - b);
  const yVals = [...new Set(rawData.map((d: any) => d[1]))].sort((a: number, b: number) => a - b);
  const xLabels = needFixX ? xVals.map(String) : xAxis.data;
  const yLabels = needFixY ? yVals.map(String) : yAxis.data;

  const fixedData = rawData.map((d: any) => [
    needFixX ? xVals.indexOf(d[0]) : d[0],
    needFixY ? yVals.indexOf(d[1]) : d[1],
    d[2]
  ]);

  patched.xAxis = { ...xAxis, type: "category", data: xLabels };
  patched.yAxis = { ...yAxis, type: "category", data: yLabels };
  patched.series = series!.map((s: any) =>
    s.type === "heatmap" ? { ...s, data: fixedData } : s
  );
  return patched;
}

// ─── EChart (resizable + modal popup) ─────────────────────────────────────────
function EChart({ title, option }: { title: string; option: Record<string, unknown> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<ReturnType<typeof echarts.init> | null>(null);
  const [height, setHeight] = useState(460);
  const [fullscreen, setFullscreen] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(460);

  const safeOption = useMemo(() => sanitizeChartOption(option), [option]);

  useEffect(() => {
    if (!chartRef.current) return;
    try {
      if (!instanceRef.current) {
        instanceRef.current = echarts.init(chartRef.current, undefined);
      }
      instanceRef.current.setOption({ backgroundColor: "transparent", ...safeOption }, true);
      setChartError(null);
    } catch (err: any) {
      console.error("[EChart] setOption failed:", title, err);
      setChartError(err?.message || "图表渲染失败");
      if (instanceRef.current) {
        instanceRef.current.dispose();
        instanceRef.current = null;
      }
      return;
    }
    const inst = instanceRef.current;
    const handle = () => { try { inst?.resize(); } catch { } };
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("resize", handle);
    };
  }, [safeOption]);

  useEffect(() => { try { instanceRef.current?.resize(); } catch { } }, [height]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = height;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setHeight(Math.max(240, startH.current + ev.clientY - startY.current));
    };
    const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <>
      {fullscreen && !chartError && <ChartModal title={title} option={safeOption} onClose={() => setFullscreen(false)} />}
      <div ref={containerRef} style={{ marginBottom: 16, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
        <div className="result-table-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          📈 {title}
          {!chartError && <>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>内部滚轮缩放 · 拖拽下方框柄调高</span>
            <button onClick={() => setFullscreen(true)}
              style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-primary)", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              🔍 放大查看
            </button>
          </>}
        </div>
        {chartError ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
            ⚠️ 图表渲染失败: {chartError}
          </div>
        ) : (
          <>
            <div ref={chartRef}
              style={{ width: "100%", height: `${height}px`, cursor: "default" }} />
            <div onMouseDown={onMouseDown}
              style={{ height: 8, cursor: "ns-resize", background: "var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 32, height: 3, borderRadius: 2, background: "var(--text-muted)" }} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── TableInsight ─────────────────────────────────────────────────────────────
function TableInsight({ table, algoName }: { table: ResultTable; algoName: string }) {
  const [insight, setInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [triggered, setTriggered] = useState(false);

  const generateInsight = async () => {
    if (loading) return;
    setLoading(true);
    setTriggered(true);
    setInsight("");
    const rowSample = table.rows.slice(0, 8).map(r => r.join(" | ")).join("\n");
    const prompt = `[算法:${algoName}] 表:${table.title}\n列:${table.columns.join(" | ")}\n数据(Top8):\n${rowSample}\n\n用中文给出3点结论(每点不超过25字):
      1.`;
    try {
      const resp = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      if (!resp.body) throw new Error("No stream body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let acc = "1.";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Save partial line for next chunk

        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned) continue;
          const payload = cleaned.startsWith("data:") ? cleaned.replace(/^data:\s*/, "") : cleaned;
          try {
            const data = JSON.parse(payload);
            const content = data.message?.content || data.response || "";
            acc += content;
            setInsight(acc);
          } catch (e) { }
        }
        if (done) break;
      }
      if (buffer.trim()) {
        try {
          const payload = buffer.trim().startsWith("data:") ? buffer.trim().replace(/^data:\s*/, "") : buffer.trim();
          const data = JSON.parse(payload);
          const content = data.message?.content || data.response || "";
          acc += content;
          setInsight(acc);
        } catch (e) { }
      }
      if (!acc || acc === "1.") setInsight("未能生成结论，请重试。");
    } catch (err: any) {
      setInsight(`❌ 错误: ${err?.message || "未知"}，请确认 Ollama 正常运行。`);
    } finally {
      setLoading(false);
    }
  };

  const spinnerStyle: React.CSSProperties = {
    display: "inline-block", width: 11, height: 11,
    border: "2px solid var(--accent)", borderTopColor: "transparent",
    borderRadius: "50%", verticalAlign: "middle", marginLeft: 6,
    animation: "spin 0.8s linear infinite"
  };

  return (
    <div style={{ marginBottom: 10 }}>
      {!triggered ? (
        <button onClick={generateInsight}
          style={{
            height: 26, background: "var(--accent-dim)", color: "var(--accent)",
            border: "1px dashed var(--accent)", borderRadius: 6, fontSize: 11,
            padding: "0 10px", fontWeight: 700, cursor: "pointer"
          }}>
          ✨ AI 解读本表
        </button>
      ) : (
        <div style={{
          background: "var(--bg-overlay)", border: "1px solid var(--accent)",
          padding: "10px 14px", borderRadius: 10, boxShadow: "0 2px 8px rgba(99,102,241,0.08)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 13 }}>🤖</span>
            <span style={{ fontWeight: 800, fontSize: 11, color: "var(--accent)" }}>AI 结论·{table.title}</span>
            {loading && <span style={spinnerStyle} />}
            {!loading && (
              <button onClick={() => { setInsight(""); setTriggered(false); }}
                style={{
                  marginLeft: "auto", fontSize: 11, opacity: 0.5,
                  cursor: "pointer", background: "none", border: "none", color: "inherit"
                }}>
                重置
              </button>
            )}
          </div>
          <div style={{ color: "var(--text-primary)", fontSize: 13, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
            {loading && !insight ? "🔄 生成中，请稍候..." : insight}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AnalysisResultPage (Full Screen) ─────────────────────────────────────────
function AnalysisResultPage({ result, resTab, setResTab, logs, setLogs, onBack, algoName, algoCategory }: {
  result: AnalysisResult | null;
  resTab: ResTab;
  setResTab: (t: ResTab) => void;
  logs: LogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>>;
  onBack: () => void;
  algoName: string;
  algoCategory?: string;
}) {

  useEffect(() => {
    // Result changed
  }, [result]);

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <div className="result-header">
        <button className="btn btn-secondary btn-sm" onClick={onBack}>⬅ 返回分析</button>
        <div className="result-header-title">📈 {algoName} - 分析报告</div>
      </div>
      <div className="result-tabs" style={{ background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", padding: "0 10px" }}>
        {(["output", "charts", "interpret", "logs"] as ResTab[]).map((t) => (
          <button key={t} className={`result-tab ${resTab === t ? "active" : ""}`} onClick={() => setResTab(t)}>
            {{ output: "📊 输出报表", charts: "📈 可视化图表", interpret: "💡 结论解释", logs: "🖥 运行日志" }[t]}
          </button>
        ))}
      </div>
      <div className="result-body animate-fade" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          {resTab === "output" && algoName.includes("工业多参数影响分析") && result && (
            <IndustrialAnalysisSummary result={result} />
          )}
          {resTab === "output" && (
            result ? result.tables.map((tbl, i) => (
              <div key={i} style={{ marginBottom: 32 }} className="animate-fade">
                <TableInsight table={tbl} algoName={algoName} />
                <ResultTable table={tbl} />
              </div>
            ))
              : <div className="empty-state">📊 暂无输出数据</div>
          )}
          {resTab === "output" && result && result.figures && result.figures.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>📈 图表预览（包括工况区间影响）</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
                {result.figures.map((fig, i) => (
                  <EChart key={`preview-${i}`} title={fig.title} option={fig.option as any} />
                ))}
              </div>
            </div>
          )}
          {resTab === "charts" && (
            result ? (result.figures.length > 0 ? result.figures.map((fig, i) => <EChart key={i} title={fig.title} option={fig.option as any} />)
              : <div className="empty-state">该算法无图表输出</div>)
              : <div className="empty-state">运行后查看图表</div>
          )}
          {resTab === "interpret" && (
            result ? (
              <>
                <ReportReadingGuide algoName={algoName} result={result} />
                <div className="narrative-box">{result.narrative}</div>
                {result.assumptions.length > 0 && <>
                  <div className="section-head">✅ 前提假设</div>
                  <div className="assumption-list">{result.assumptions.map((a, i) => <div key={i} className="assumption-item">✓ {a}</div>)}</div>
                </>}
                {result.warnings.length > 0 && <>
                  <div className="section-head">⚠️ 注意事项</div>
                  <div className="assumption-list">{result.warnings.map((w, i) => <div key={i} className="warning-item">⚠️ {w}</div>)}</div>
                </>}
                <div className="citation-box">📚 引用参考：{result.citation}</div>
              </>
            ) : <div className="empty-state">运行后查看解释</div>
          )}
          {resTab === "logs" && (
            <>
              <div className="log-area" style={{ maxHeight: "none" }}>
                {logs.map((l, i) => (
                  <div key={i} className="log-line">
                    <span className="log-time">[{l.ts}]</span>
                    <span className={`log-msg ${l.level}`}>{l.msg}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setLogs([])}>清空日志</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── IndustrialAnalysisSummary: 算法简介与核心结论 ────────────────────────────
function IndustrialAnalysisSummary({ result }: { result: AnalysisResult }) {
  // Relaxed matching for tables
  const ruleTable = result.tables.find(t => 
    /规则|Rule|工况|诊断/.test(t.title) && !/数据质量/.test(t.title)
  );
  
  let topRule = "";
  let worstRule = "";
  if (ruleTable) {
    // Search ALL cells for Best/Worst keywords in each row
    const bestRow = ruleTable.rows.find(r => r.some(cell => /最优|推荐|建议|最佳|Best|Positive/i.test(String(cell))));
    const worstRow = ruleTable.rows.find(r => r.some(cell => /最差|回避|预警|高危|Worst|Negative/i.test(String(cell))));
    
    // Function to find the most descriptive rule string in a row
    const getBestRuleText = (row: any[]) => {
      // Prioritize strings containing mathematical comparisons or more than 10 chars
      const candidates = row.filter(c => typeof c === 'string' && (c.includes('>') || c.includes('<') || c.length > 10));
      return candidates.length > 0 ? candidates[0] : row.reduce((a, b) => String(a).length > String(b).length ? a : b, "");
    };

    if (bestRow) topRule = getBestRuleText(bestRow);
    if (worstRow) worstRule = getBestRuleText(worstRow);
    
    // Fallback: if no explicit best/worst label found via keywords, take the first row's longest text if it's long
    if (!topRule && ruleTable.rows.length > 0) {
       const longestInFirst = ruleTable.rows[0].reduce((a, b) => String(a).length > String(b).length ? a : b, "");
       if (String(longestInFirst).length > 10) topRule = String(longestInFirst);
    }
  }

  const importanceTable = result.tables.find(t => 
    /特征|SHAP|重要|关键|Importance|Factor/i.test(t.title) 
    && !/数据质量/.test(t.title)
  );
  
  // Find feature names more intelligently (often in column 0 or 1 if col 0 is rank)
  const topFeatures = importanceTable?.rows.slice(0, 3).map(r => {
    const val0 = String(r[0]);
    const val1 = String(r[1] || "");
    const val2 = String(r[2] || "");
    // Pattern: if first column is just a rank like "1", "01" (small integer)
    if (/^\d+(\.\d+)?$/.test(val0) && val0.length <= 2 && val1 && !/^\d+(\.\d+)?$/.test(val1)) return val1;
    // Pattern: if col 1 is also a number (maybe importance score?), check col 0
    return val0;
  }) || [];

  return (
    <div style={{ marginBottom: 32, padding: '32px 36px', background: 'linear-gradient(145deg, #0f172a, #1e293b)', borderRadius: 24, color: '#f8fafc', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'var(--accent)', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', boxShadow: '0 8px 16px rgba(255,154,0,0.3)' }}>💡</div>
        <div>
          <h3 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 800 }}>算法报告摘要：工业多参数影响分析</h3>
          <div style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, letterSpacing: '0.02em' }}>Automatic Industrial Analytics Summary & Insights</div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: 32 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📘 算法简介</div>
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.8, marginBottom: 0 }}>
            该算法旨在从全量工艺变量中剥离出真正关键的影响因子，通过分析变量间复杂的非线性交互作用，锁定导致目标波动的核心工况窗口。
            目前的分析结果基于模型对已有工况的“黑盒”拆解，目的是找出具有高鲁棒性的参数子集，为您调整工艺窗口提供客观依据。
          </p>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#cbd5e1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🚩 关键因子权重 (Influential Factors)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topFeatures.length > 0 ? topFeatures.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)', opacity: 0.6 }}>0{i+1}</span>
                <span style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 600 }}>{f}</span>
              </div>
            )) : <span style={{ color: '#64748b', fontSize: 13, padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, textAlign: 'center' }}>暂未匹配到显著影响因子</span>}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {topRule ? (
          <div style={{ background: 'rgba(52,211,153,0.08)', borderLeft: '4px solid #10b981', padding: '20px 24px', borderRadius: '4px 16px 16px 4px', border: '1px solid rgba(52,211,153,0.15)', position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
               ✅ 最佳工况识别结论 (Dominant Advantageous Condition)
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.6 }}>
               {topRule}
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            ⚠️ 系统未能自动提取出具体的最优工况组合，请查阅下方的「综合规则诊断」详细列表。
          </div>
        )}

        {worstRule && (
          <div style={{ background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid #ef4444', padding: '20px 24px', borderRadius: '4px 16px 16px 4px', border: '1px solid rgba(239,68,68,0.15)', position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
               ⚠️ 潜在高风险预警 (Critical Warning)
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fca5a5', lineHeight: 1.6 }}>
               应避免：{worstRule}
            </div>
          </div>
        )}
      </div>
      
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ fontSize: 11, color: '#64748b' }}>* 该分析结果由系统根据当前数据集自动生成，实际干预建议先行小范围验证。</div>
      </div>
    </div>
  );
}

// ─── ReportReadingGuide: 专业版报告阅读引导 ────────────────────────────────
function ReportReadingGuide({ algoName, result }: { algoName: string; result: AnalysisResult }) {
  const isIndustrial = algoName.includes("工业多参数影响分析");
  const hasIndustrialTables = result.tables.some(t => t.title.includes("工业影响诊断书") || t.title.includes("综合规则诊断"));

  if (isIndustrial || hasIndustrialTables) {
    return (
      <div className="card" style={{ marginBottom: 20, padding: 18, borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-raised)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>📘 如何专业阅读本工业影响分析报告</div>
        <ol style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
          <li>
            <strong>先看总览诊断书</strong>：在「🩺 工业影响诊断书」中快速确认目标方向（越高越好/越低越好）、模型解释力、是否存在过拟合，以及算法给出的关键结论与风险提示。
          </li>
          <li>
            <strong>重点关注综合规则</strong>：在「🔗 综合规则诊断（决策树 × 联合规则 Top 5）」中，先看「最优工况 / 最差工况」两行，其次看 Top 规则和一句话总结，用于锁定需要重点优化或监控的工况组合。
          </li>
          <li>
            <strong>用阈值 & PDP 理解机理</strong>：结合「🏆 重点特征 (SHAP)」与「⚡ 分段/阈值效应」以及 PDP 曲线，看每个关键参数的有利/不利区间，判断工艺窗口是否合理、是否需要收窄或分档管控。
          </li>
          <li>
            <strong>最后校验数据质量与前提</strong>：查看「🧪 数据质量体检」与共线性检查，以及报告中的前提假设/注意事项，评估结论在当前数据条件下的可靠性，避免忽略缺失、异常或样本偏倚的影响。
          </li>
          <li>
            <strong>将规则落到现场管控</strong>：对重要规则，可在现场 SOP / 报警规则中实现：为关键工况设置联动预警、排产/配方推荐区间，并规划后续小范围 DOE 验证，避免直接按相关性做强干预。
          </li>
        </ol>
      </div>
    );
  }

  // 通用算法的报告阅读说明（非工业分析）
  return (
    <div className="card" style={{ marginBottom: 20, padding: 16, borderRadius: 14, border: "1px solid var(--border)", background: "var(--bg-raised)" }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>📘 如何快速把握本报告</div>
      <ul style={{ paddingLeft: 18, margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
        <li>先看「输出报表」中的总体指标与核心表格，确认目标变量、样本量和主要统计/评估指标。</li>
        <li>结合「可视化图表」观察分布、趋势和异常点，验证数值是否直观合理。</li>
        <li>在「💡 结论解释」下阅读叙述、假设与注意事项，明确本次分析适用的边界条件。</li>
        <li>如需对外沟通或归档，可导出 PDF，并搭配本页解释部分形成完整的业务报告。</li>
      </ul>
    </div>
  );
}

// ─── DataProcessPage ──────────────────────────────────────────────────────────
function DataProcessPage({ activeVersion, activeDatasetId, addLog, onVersionCreated }: {
  activeVersion: VersionLike | null;
  activeDatasetId: DatasetId | null;
  addLog: (l: "info" | "success" | "warn" | "error", m: string) => void;
  onVersionCreated: (v: VersionLike) => void;
}) {
  const [activeOp, setActiveOp] = useState<string | null>(null);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [procResult, setProcResult] = useState<{ info: string; removed: number; modified: number; rowCount: number; version: number } | null>(null);

  const ops = [
    {
      category: "缺失值处理", items: [
        { id: "fill_mean", name: "均值填充", desc: "数值列：用列均值填充缺失值", forType: "numeric" as const },
        { id: "fill_median", name: "中位数填充", desc: "数值列：用中位数填充", forType: "numeric" as const },
        { id: "fill_mode", name: "众数填充", desc: "分类列：用最高频值填充缺失", forType: "categorical" as const },
        { id: "drop_missing", name: "删除缺失行", desc: "删除所有选定列中存在缺失值的行", forType: "any" as const },
      ]
    },
    {
      category: "异常值处理", items: [
        { id: "iqr_clip", name: "IQR 截断", desc: "将 1.5×IQR 范围外的值截断到边界", forType: "numeric" as const },
        { id: "zscore_filter", name: "Z-score 过滤", desc: "删除 |Z| > 3 的行", forType: "numeric" as const },
      ]
    },
    {
      category: "数值变换", items: [
        { id: "standardize", name: "Z-score 标准化", desc: "变换为均值=0、标准差=1", forType: "numeric" as const },
        { id: "minmax", name: "Min-Max 归一化", desc: "缩放到 [0, 1] 区间", forType: "numeric" as const },
        { id: "log1p", name: "对数变换 log(1+x)", desc: "用于右偏分布，要求值 ≥ 0", forType: "numeric" as const },
        { id: "abs", name: "取绝对值", desc: "将负数转换为正数", forType: "numeric" as const },
        { id: "round", name: "数值进位 (0位)", desc: "取整操作", forType: "numeric" as const },
      ]
    },
    {
      category: "文本清洗", items: [
        { id: "trim", name: "去首尾空格", desc: "清除文本两端的空白字符", forType: "categorical" as const },
        { id: "lowercase", name: "全小写转换", desc: "将文本统一为小写", forType: "categorical" as const },
        { id: "uppercase", name: "全大写转换", desc: "将文本统一为大写", forType: "categorical" as const },
      ]
    },
    {
      category: "特征编码", items: [
        { id: "label_encode", name: "标签编码", desc: "将分类文本转换为 0, 1, 2...", forType: "categorical" as const },
        { id: "to_numeric", name: "强制转数值", desc: "尝试将文本列转换为数字", forType: "any" as const },
      ]
    },
    {
      category: "数据集管理", items: [
        { id: "drop_duplicates", name: "删除重复行", desc: "删除指定列完全重复的行记录", forType: "any" as const },
      ]
    }
  ];

  const currentOp = ops.flatMap((g) => g.items).find((o) => o.id === activeOp);
  const relevantCols = activeVersion?.columns.filter((c) => {
    if (!currentOp) return true;
    if (currentOp.forType === "any") return true;
    return c.type === currentOp.forType;
  }) || [];

  const toggleCol = (name: string) => {
    setSelectedCols((prev) => {
      const n = new Set(prev);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  };
  const selectAll = () => setSelectedCols(new Set(relevantCols.map((c) => c.name)));
  const clearAll = () => setSelectedCols(new Set());

  const execute = async () => {
    if (!activeVersion || !activeDatasetId || !activeOp || selectedCols.size === 0) return;
    if (typeof activeDatasetId !== "number") { addLog("warn", "数据库取数暂不支持在线加工，请先落地为文件数据集"); return; }
    setProcessing(true); setProcResult(null);
    addLog("info", `执行 ${currentOp?.name}（${selectedCols.size} 列）...`);
    try {
      const { data } = await axios.post(`/api/datasets/${activeDatasetId}/process`, {
        versionId: activeVersion.id,
        operation: activeOp,
        columns: Array.from(selectedCols),
      });
      setProcResult(data);
      addLog("success", data.info);
      // Build a minimal DatasetVersionMeta to switch to
      const newVer: DatasetVersionMeta = {
        id: data.versionId, datasetId: activeDatasetId,
        version: data.version, path: "",
        columns: activeVersion.columns, sampleRows: activeVersion.sampleRows,
        rowCount: data.rowCount ?? activeVersion.sampleRows.length
      };
      // Fetch fresh version from server
      const { data: freshVer } = await axios.get<DatasetVersionMeta>(`/api/datasets/${activeDatasetId}/versions/${data.versionId}`);
      onVersionCreated(freshVer);
    } catch (err: any) {
      const msg = err?.response?.data?.error || String(err);
      addLog("error", `处理失败: ${msg}`);
    } finally { setProcessing(false); }
  };

  return (
    <DndContext sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))} onDragEnd={(e) => {
      const { active, over } = e;
      if (over && over.id === "target-cols") {
        const name = String(active.id);
        setSelectedCols(prev => new Set(prev).add(name));
      }
    }}>
      <div className="proc-layout">
        {/* Left: op list */}
        <div className="proc-panel">
          <div className="card-title">数据清洗Workbench</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 15 }}>拖拽或点击选择变量到右侧插槽进行加工</div>
          {ops.map((group) => (
            <div key={group.category}>
              <div className="subcategory-label">{group.category}</div>
              {group.items.map((op) => (
                <div key={op.id} className={`op-card ${activeOp === op.id ? "active" : ""}`}
                  onClick={() => { setActiveOp(op.id); setSelectedCols(new Set()); setProcResult(null); }}>
                  <div className="op-card-name">{op.name}</div>
                  <div className="op-card-desc">{op.desc}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right: config + result */}
        <div className="proc-main">
          {!activeVersion ? (
            <div className="empty-state" style={{ marginTop: 80 }}>
              <div className="empty-icon">🗂️</div>
              <div className="empty-title">请先选择数据集</div>
              <div className="empty-desc">前往「我的数据」上传或选择数据集</div>
            </div>
          ) : !activeOp ? (
            <div className="empty-state" style={{ marginTop: 80 }}>
              <div className="empty-icon">🛠️</div>
              <div className="empty-title">选择加工操作</div>
              <div className="empty-desc">
                从左侧选择一个预处理器开始<br />
                当前数据集：<strong>{activeVersion.columns.length}</strong> 列
              </div>
            </div>
          ) : (
            <div className="animate-fade">
              <div className="card" style={{ margin: "0 0 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div className="card-title">{currentOp?.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>{currentOp?.desc}</div>
                  </div>
                  <div className="tag accent">STEP 1</div>
                </div>

                <div className="flex-row" style={{ gap: 20, alignItems: "stretch" }}>
                  {/* Variables source (draggable) */}
                  <div style={{ flex: 1 }}>
                    <div className="section-head">待处理变量</div>
                    <div className="var-grid" style={{ maxHeight: 300, overflowY: "auto", padding: 8, background: "var(--bg-base)", borderRadius: 8 }}>
                      {relevantCols.map((col) => (
                        <DraggableVarPill key={col.name} name={col.name} type={col.type} />
                      ))}
                      {relevantCols.length === 0 && <div className="text-muted">无可用列</div>}
                    </div>
                  </div>

                  {/* Hybrid: Drop + Click Picker */}
                  <div style={{ flex: 1 }}>
                    <div className="section-head">目标插槽 (已选择 {selectedCols.size})</div>
                    <HybridProcessSlot
                      slotId="target-cols"
                      assigned={Array.from(selectedCols)}
                      allColumns={relevantCols}
                      onAdd={(name) => setSelectedCols(prev => new Set(prev).add(name))}
                      onRemove={(v) => setSelectedCols(prev => { const n = new Set(prev); n.delete(v); return n; })}
                      onClear={clearAll}
                      onSelectAll={selectAll}
                    />
                    <div className="flex-row" style={{ marginTop: 10, gap: 8 }}>
                      <button className="btn btn-ghost btn-xs" onClick={selectAll}>全选</button>
                      <button className="btn btn-ghost btn-xs" onClick={clearAll}>清空</button>
                    </div>
                  </div>
                </div>
              </div>

              {procResult && (
                <div className="proc-result animate-slide-up" style={{ marginBottom: 16, borderLeft: "6px solid #10b981", background: "#f0fdf4" }}>
                  <div className="flex-row" style={{ gap: 12 }}>
                    <div style={{
                      background: "#10b981", color: "white", width: 32, height: 32,
                      borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18, fontWeight: "bold"
                    }}>✓</div>
                    <div>
                      <div style={{ fontWeight: 700, color: "#065f46", fontSize: 15 }}>{procResult.info}</div>
                      <div style={{ fontSize: 12, marginTop: 2, color: "#047857" }}>
                        ✨ 数据已自动升级至 <span style={{ fontWeight: 800 }}>版本 V{procResult.version}</span> ·
                        当前共 {procResult.rowCount} 行记录
                      </div>
                    </div>
                    <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto", color: "#059669" }} onClick={() => setProcResult(null)}>关闭提示</button>
                  </div>
                </div>
              )}

              <div className="flex-row" style={{ justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  💡 提示：执行后将保存为新版本，原文件不受影响
                </div>
                <div className="flex-row" style={{ gap: 12 }}>
                  <button className="btn btn-ghost" onClick={() => { setActiveOp(null); setProcResult(null); }}>取消</button>
                  <button className="btn btn-primary btn-lg" onClick={execute}
                    disabled={processing || selectedCols.size === 0}
                    style={{ padding: "10px 30px" }}>
                    {processing ? "⏳ 正在加工..." : `立即执行：${currentOp?.name}`}
                  </button>
                </div>
              </div>

              {/* Data Preview Section */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div className="flex-row" style={{ padding: "12px 16px", background: "var(--bg-overlay)", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>数据样本预览 (前 {activeVersion.sampleRows.length} 条)</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                    版本: V{activeVersion.version} · 总行数: {activeVersion.rowCount}
                  </div>
                </div>
                <div className="data-table-wrap" style={{ maxHeight: 400, border: "none" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        {activeVersion.columns.map(c => (
                          <th key={c.name} style={{ background: selectedCols.has(c.name) ? "var(--accent-dim)" : "" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span>{c.name}</span>
                              <span className="col-type" style={{ fontSize: 9 }}>{c.type}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeVersion.sampleRows.map((row, i) => (
                        <tr key={i}>
                          <td className="text-muted" style={{ textAlign: "center" }}>{i + 1}</td>
                          {activeVersion.columns.map(c => {
                            const val = row[c.name];
                            const isSelected = selectedCols.has(c.name);
                            return (
                              <td key={c.name} className={c.type} style={{
                                background: isSelected ? "rgba(var(--accent-rgb), 0.05)" : "",
                                fontWeight: isSelected ? 500 : 400
                              }}>
                                {val === null || val === undefined ? <span className="text-muted">null</span> : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DndContext>
  );
}

// ─── ReportPage ───────────────────────────────────────────────────────────────
function ReportPage({ runHistory, datasets, algorithms, onLoadResult, onDeleteReport, onBatchDeleteReport }: {
  runHistory: RunHistoryItem[];
  datasets: DatasetLike[];
  algorithms: AlgorithmSpec[];
  onLoadResult: (r: RunHistoryItem) => void;
  onDeleteReport: (id: string) => Promise<void>;
  onBatchDeleteReport: (ids: string[]) => Promise<void>;
}) {
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<RunHistoryItem | null>(null);
  const [predictInput, setPredictInput] = useState<string>("");
  const [predictOutput, setPredictOutput] = useState<any[] | null>(null);
  const [predictError, setPredictError] = useState<string>("");
  const [predicting, setPredicting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (runHistory.length === 0) return;
    // 优先选中最新的已完成记录，便于直接查看指标和参数
    const firstDone = runHistory.find((r) => r.status === "completed");
    setActiveReport(firstDone || runHistory[0]);
  }, [runHistory]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === runHistory.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(runHistory.map(r => r.id)));
    }
  };

  const batchDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    await onBatchDeleteReport(ids);
    setSelectedIds(new Set());
  };

  const modelPkg = useMemo(() => (activeReport?.result as any)?.extras?.modelPackage, [activeReport]);
  const featureList = useMemo(() => {
    if (!modelPkg) return [] as string[];
    const names = (modelPkg.featureNames || modelPkg.finalFeatureNames || []) as string[];
    return Array.isArray(names) ? names : [];
  }, [modelPkg]);
  const runId = activeReport ? Number(activeReport.id) : null;

  useEffect(() => {
    setPredictInput("");
    setPredictOutput(null);
    setPredictError("");
    setPredicting(false);
    if (featureList.length) {
      const tmpl = featureList.reduce((acc, f) => ({ ...acc, [f]: 0 }), {} as Record<string, number>);
      setPredictInput(JSON.stringify([tmpl], null, 2));
    }
  }, [activeReport?.id, featureList]);

  const mlRuns = useMemo(() => runHistory.filter((r) => r.algoCategory === "ml"), [runHistory]);

  const extractMetrics = (r: RunHistoryItem) => {
    const extras: any = r.result?.extras || {};
    if (extras.regression?.metrics) return extras.regression.metrics;
    if (extras.classification?.metrics) return extras.classification.metrics;
    const t = r.result?.tables?.[0];
    const m: Record<string, any> = {};
    if (t?.rows) {
      t.rows.forEach((row) => {
        const key = row?.[0]; const val = row?.[1];
        if (typeof key === "string" && (typeof val === "number" || typeof val === "string")) {
          m[key] = val;
        }
      });
    }
    return m;
  };

  const extractModelParams = (r: RunHistoryItem) => {
    const extras: any = r.result?.extras || {};
    const pkg: any = extras.modelPackage || {};
    const paramsUsed: Record<string, unknown> = pkg.paramsUsed || extras.paramsUsed || {};
    const entries: { label: string; value: any }[] = [];
    if (pkg.target) entries.push({ label: "目标变量", value: pkg.target });
    if (Array.isArray(pkg.featureNames)) entries.push({ label: "特征数", value: pkg.featureNames.length });
    if (pkg.pipeline) {
      entries.push({ label: "编码方式", value: pkg.pipeline.oneHot ? "One-Hot" : "Label" });
      entries.push({ label: "数值填补", value: Object.keys(pkg.pipeline.numImputeValues || {}).length > 0 ? "已填补" : "无" });
    }
    Object.entries(paramsUsed).forEach(([k, v]) => {
      entries.push({ label: k, value: typeof v === "number" ? Number(v.toFixed ? v.toFixed(4) : v) : String(v) });
    });
    return entries;
  };

  const fillPredictTemplate = () => {
    if (!featureList.length) return;
    const tmpl = featureList.reduce((acc, f) => ({ ...acc, [f]: 0 }), {} as Record<string, number>);
    setPredictInput(JSON.stringify([tmpl], null, 2));
  };

  const handlePredict = async () => {
    if (!runId || !modelPkg) {
      setPredictError("该记录缺少模型或 runId，无法预测");
      return;
    }
    setPredictError("");
    setPredictOutput(null);
    let rows: any[] = [];
    try {
      if (!predictInput.trim()) throw new Error("请输入待预测数据 (JSON 数组)");
      const parsed = JSON.parse(predictInput);
      rows = Array.isArray(parsed) ? parsed : [parsed];
    } catch (err: any) {
      setPredictError("JSON 解析失败: " + (err?.message || err));
      return;
    }
    if (rows.length === 0) { setPredictError("行数为 0，无法预测"); return; }
    if (rows.length > 2000) { setPredictError("超过 2000 行上限，请分批提交"); return; }

    setPredicting(true);
    try {
      const { data } = await axios.post(`/api/run/${runId}/predict`, { rows });
      setPredictOutput(data?.predictions || []);
    } catch (err: any) {
      setPredictError(err?.response?.data?.error || err?.message || String(err));
    } finally {
      setPredicting(false);
    }
  };

  const renderChartToDataUrl = async (option: Record<string, unknown>) => {
    const safeOpt = sanitizeChartOption(option);
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "900px";
    container.style.height = "520px";
    document.body.appendChild(container);

    const chart = echarts.init(container, undefined, { renderer: "canvas", width: 900, height: 520 });
    chart.setOption({ backgroundColor: "#ffffff", animation: false, ...safeOpt }, true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const dataUrl = chart.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    chart.dispose();
    container.remove();
    return dataUrl;
  };

  const exportPdf = async (item: RunHistoryItem) => {
    if (!item.result) return;
    setExportingId(item.id);
    try {
      const charts: { title: string; dataUrl: string }[] = [];
      for (const fig of item.result.figures || []) {
        try {
          const dataUrl = await renderChartToDataUrl(fig.option as Record<string, unknown>);
          charts.push({ title: fig.title, dataUrl });
        } catch (err) {
          console.warn("导出图表失败", err);
        }
      }

      const payload = {
        title: `${item.algoName} 报告`,
        summary: `算法: ${item.algoName} · 运行时间: ${item.ts}`,
        tables: item.result.tables || [],
        charts,
        narrative: item.result.narrative,
        citation: item.result.citation
      };

      const res = await axios.post("/api/reports/pdf", payload, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `statlab-${Date.now()}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } finally {
      setExportingId(null);
    }
  };

  // 获取数据集名称
  const getDatasetName = (r: RunHistoryItem) => {
    if (r.datasetName) return r.datasetName;
    const ds = datasets.find(d => d.id === (r as any).datasetId);
    return ds ? ds.name : (r as any).datasetId || "未知数据集";
  };

  // 删除报告
  const deleteReport = async (id: string) => {
    if (!window.confirm("确定要删除该报告记录吗？")) return;
    setDeletingId(id);
    try {
      await onDeleteReport(id);
    } catch (err) {
      alert("删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="report-layout">
      <div className="stat-grid">
        <div className="stat-tile"><div className="stat-tile-val">{runHistory.length}</div><div className="stat-tile-label">历史运行</div></div>
        <div className="stat-tile"><div className="stat-tile-val">{runHistory.filter((r) => r.status === "completed").length}</div><div className="stat-tile-label">成功</div></div>
        <div className="stat-tile"><div className="stat-tile-val">{mlRuns.length}</div><div className="stat-tile-label">机器学习</div></div>
        <div className="stat-tile"><div className="stat-tile-val">{datasets.length}</div><div className="stat-tile-label">数据集</div></div>
        <div className="stat-tile"><div className="stat-tile-val">{algorithms.length}</div><div className="stat-tile-label">算法</div></div>
      </div>

      <div className="section-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>运行历史 / 机器学习报告</span>
          <span className="tag" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>ML {mlRuns.length}</span>
        </div>

        {selectedIds.size > 0 ? (
          <div className="animate-slide-up" style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--accent-dim)", padding: "4px 12px", borderRadius: 8, border: "1px solid var(--accent)" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>已选择 {selectedIds.size} 项</span>
            <button className="btn btn-danger btn-xs" onClick={batchDelete}>批量删除</button>
            <button className="btn btn-ghost btn-xs" onClick={() => setSelectedIds(new Set())}>取消</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className="btn btn-ghost btn-xs" onClick={toggleSelectAll}>
              {selectedIds.size === runHistory.length && runHistory.length > 0 ? "取消全选" : "全选本页"}
            </button>
          </div>
        )}
      </div>

      {runHistory.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-title">暂无记录</div><div className="empty-desc">执行分析后会显示在此处</div></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(520px, 1.4fr) 1fr", gap: 12, alignItems: "start" }}>
          <div className="run-hist" style={{ paddingLeft: 0 }}>
            {runHistory.map((r) => (
              <div key={r.id} className={`run-item ${selectedIds.has(r.id) ? 'selected' : ''}`} onClick={() => setActiveReport(r)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
                <div
                  style={{ display: "flex", alignItems: "center", padding: "4px" }}
                  onClick={(e) => { e.stopPropagation(); toggleSelect(r.id, e); }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => { }}
                    style={{ cursor: "pointer", width: 16, height: 16, margin: 0 }}
                  />
                </div>
                <span className={`tag ${r.status === "completed" ? "success" : "danger"}`}>{r.status === "completed" ? "✓" : "✗"}</span>
                {r.algoCategory === "ml" && <span className="tag" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "none" }}>ML</span>}
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="run-algo" style={{ fontWeight: 700 }}>{r.analysisName || r.algoName}</span>
                    {r.analysisName && <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.7 }}>({r.algoName})</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                    <span className="run-dataset text-muted">[{getDatasetName(r)}]</span>
                    {r.analystName && <span style={{ color: "var(--accent)", fontWeight: 600 }}>👤 {r.analystName}</span>}
                    <span className="run-time text-muted">{r.ts}</span>
                  </div>
                </div>
                <div className="flex-row" style={{ gap: 4 }}>
                  {r.result && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onLoadResult(r); }}>查看</button>
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); exportPdf(r); }} disabled={exportingId === r.id}>
                        {exportingId === r.id ? "生成中..." : "PDF"}
                      </button>
                    </>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); deleteReport(r.id); }} disabled={deletingId === r.id} title="删除报告">{deletingId === r.id ? "删除中..." : "删除"}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="card report-detail" style={{ margin: 0, position: "sticky", top: 12, alignSelf: "start", background: "var(--bg-surface)" }}>
            <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 8 }}>
              🧾 报告详情
              {activeReport?.algoCategory === "ml" && <span className="tag" style={{ background: "var(--accent-dim)", color: "var(--accent)", border: "none" }}>机器学习</span>}
            </div>
            {!activeReport ? (
              <div className="empty-state" style={{ padding: 12, margin: 0 }}><div className="empty-title" style={{ fontSize: 14 }}>选择左侧记录以查看模型参数</div></div>
            ) : (
              <div className="flex-col" style={{ gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 15 }}>{activeReport.analysisName || activeReport.algoName}</div>
                  {activeReport.analysisName && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -2 }}>算法: {activeReport.algoName}</div>}
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {getDatasetName(activeReport)} · {activeReport.ts}
                    {activeReport.analystName && <span style={{ marginLeft: 8, color: "var(--accent)" }}>👤 {activeReport.analystName}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <span className={`tag ${activeReport.status === "completed" ? "success" : "danger"}`}>{activeReport.status === "completed" ? "已完成" : "失败"}</span>
                    <span className="tag" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>Run ID {activeReport.id}</span>
                  </div>
                </div>

                {activeReport.result ? (
                  <>
                    <div className="card" style={{ margin: 0, background: "var(--bg-raised)", border: "1px dashed var(--border)" }}>
                      <div className="card-title" style={{ fontSize: 12, marginBottom: 6 }}>关键指标</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
                        {Object.entries(extractMetrics(activeReport)).slice(0, 6).map(([k, v]) => (
                          <div key={k} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{k}</div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{typeof v === "number" ? v : String(v)}</div>
                          </div>
                        ))}
                        {Object.keys(extractMetrics(activeReport)).length === 0 && <div className="text-muted" style={{ fontSize: 12 }}>暂无可解析的指标</div>}
                      </div>
                    </div>

                    <div className="card" style={{ margin: 0, background: "var(--bg-raised)", border: "1px dashed var(--border)" }}>
                      <div className="card-title" style={{ fontSize: 12, marginBottom: 6 }}>模型参数</div>
                      {extractModelParams(activeReport).length === 0 ? (
                        <div className="text-muted" style={{ fontSize: 12 }}>该记录未附带参数或非机器学习模型</div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8 }}>
                          {extractModelParams(activeReport).map((p, idx) => (
                            <div key={idx} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.label}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, wordBreak: "break-all" }}>{String(p.value)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {modelPkg && (
                      <div className="card" style={{ margin: 0, background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <div className="card-title" style={{ fontSize: 12, marginBottom: 0 }}>🔮 在线预测（最多 2000 行）</div>
                          <span className="tag" style={{ background: "var(--bg-raised)", border: "1px solid var(--border)" }}>runId {activeReport.id}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
                          粘贴 JSON 数组，字段需匹配特征：{featureList.join(", ") || "(特征列表未知)"}
                        </div>
                        <textarea value={predictInput} onChange={(e) => setPredictInput(e.target.value)}
                          placeholder={"[\n  { \"feature1\": 1, \"feature2\": 2 }\n]"}
                          style={{ width: "100%", minHeight: 140, borderRadius: 8, border: "1px solid var(--border)", padding: 10, fontFamily: "JetBrains Mono, monospace", fontSize: 12, background: "var(--bg-base)", color: "var(--text-primary)" }} />
                        <div style={{ display: "flex", gap: 10, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <button className="btn btn-ghost btn-sm" onClick={fillPredictTemplate} disabled={!featureList.length}>填充模板</button>
                          <button className="btn btn-primary btn-sm" onClick={handlePredict} disabled={predicting}
                            style={{ padding: "8px 14px", minWidth: 100 }}>
                            {predicting ? "预测中..." : "提交预测"}
                          </button>
                          {predictError && <span style={{ fontSize: 12, color: "var(--danger)" }}>{predictError}</span>}
                        </div>
                        {predictOutput && (
                          <div style={{ marginTop: 10, fontSize: 12, background: "var(--bg-raised)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>预测结果（前 20 条）</div>
                            <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{JSON.stringify(predictOutput.slice(0, 20), null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex-row" style={{ gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => onLoadResult(activeReport)}>打开完整报告</button>
                      {activeReport.result && <button className="btn btn-secondary btn-sm" onClick={() => exportPdf(activeReport)} disabled={exportingId === activeReport.id}>{exportingId === activeReport.id ? "生成中..." : "导出 PDF"}</button>}
                    </div>
                  </>
                ) : (
                  <div className="text-muted" style={{ fontSize: 12 }}>该记录暂无结果数据</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

