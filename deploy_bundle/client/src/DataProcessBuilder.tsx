import React, { useEffect, useState, useMemo } from 'react';
import { Table, Tooltip } from 'antd';
import {
  DndContext, useSensor, useSensors, PointerSensor, DragEndEvent,
  useDraggable, useDroppable
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Search, Play, Trash2, Save, X, Layers, 
  Database, Activity, Zap, Cpu, HardDrive,
  BarChart3, Hash, MousePointer2, Type
} from 'lucide-react';
import axios from 'axios';
import * as echarts from 'echarts';
import './DataProcessBuilder.css';

// --- Operator Library Constants ---
const OPERATOR_GROUPS = [
  {
    title: 'ML PREPROCESSING',
    items: [
      { type: 'normalize', label: 'Normalization (归一化)', icon: <Layers size={14}/> },
      { type: 'standardize', label: 'Standardization (标准化)', icon: <Hash size={14}/> },
      { type: 'fill_missing', label: 'Regularization (缺失填充)', icon: <Zap size={14}/> },
    ]
  },
  {
    title: 'FEATURE ENGINEERING',
    items: [
      { type: 'add_col', label: 'Add New Column (新曾列)', icon: <Layers size={14}/> },
      { type: 'encode', label: 'One-hot Encoding', icon: <Type size={14}/> },
      { type: 'binning', label: 'Scaling', icon: <BarChart3 size={14}/> },
    ]
  },
  {
    title: 'DATA MANIPULATION',
    items: [
      { type: 'merge', label: 'Data Merge (数据合并)', icon: <Database size={14}/> },
      { type: 'join', label: 'Join / Concatenate', icon: <MousePointer2 size={14}/> },
      { type: 'filter', label: 'Filter / Drop Outliers', icon: <X size={14}/> },
    ]
  }
];

const ALL_OPERATORS = OPERATOR_GROUPS.flatMap(g => g.items);

function DraggableOpItem({ item, onAdd }: { item: any; onAdd: (item: any) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib_${item.type}`,
    data: { type: 'operation', ...item },
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="wb-op-item"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onAdd(item)}
    >
      <span className="wb-op-item-icon">{item.icon}</span>
      {item.label}
    </div>
  );
}

function DraggableDatasetItem({ ds, onSelect }: { ds: any; onSelect: (ds: any) => void }) {
  const version = ds.versions?.[0];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ds_${ds.id}`,
    data: { type: 'dataset', dataset: ds, version },
  });
  if (!version) return null;
  return (
    <div 
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="wb-sidebar-ds-item"
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
      onClick={() => onSelect(ds)}
    >
      <Database size={14} style={{ marginRight: 8, color: '#64748b' }}/>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</span>
    </div>
  );
}

function SourceCard({ dataset, version, index }: any) {
  const label = String.fromCharCode(65 + (index || 0));
  const name = dataset?.name || version?.datasetName || version?.name || 'select_dataset.csv';
  return (
    <div className="wb-flow-card">
      <div className="wb-flow-header">
        <span className="wb-flow-tag" style={{ background: '#dcfce7', color: '#166534' }}>SOURCE {label}</span>
        <Tooltip title="View Source"><Database size={14} style={{ color: '#94a3b8', cursor: 'pointer' }}/></Tooltip>
      </div>
      <div className="wb-flow-body">
        <div className="wb-flow-title" style={{ color: '#2563eb' }}>{name}</div>
        <div className="wb-flow-meta">
          {dataset?.rowCount?.toLocaleString() || version?.rowCount?.toLocaleString() || '45,000'} rows • {version?.columns?.length || 0} fields
        </div>
      </div>
    </div>
  );
}

// --- Sortable Step Card ---
function SortableFlowCard({ step, index, version, onRemove, onParamChange, otherDatasets, renderAddColumnParams }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.uid });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const selectedCols = step.params?.selectedCols || [];
  const colOptions = version?.columns?.map((c: any) => c.name) || [];

  const toggleCol = (col: string) => {
    const newCols = selectedCols.includes(col) 
      ? selectedCols.filter((c: string) => c !== col)
      : [...selectedCols, col];
    onParamChange(step.uid, { ...step.params, selectedCols: newCols });
  };

  const renderParams = () => {
    switch (step.type) {
      case 'fill_missing':
        return (
          <div className="wb-param-group">
            <select 
              className="wb-search-input" 
              style={{ fontSize: 11, height: 28, marginTop: 8 }}
              value={step.params?.method || 'mean'}
              onChange={e => onParamChange(step.uid, { ...step.params, method: e.target.value })}
            >
              <option value="mean">Mean (均值)</option>
              <option value="median">Median (中位数)</option>
              <option value="mode">Mode (众数)</option>
              <option value="constant">Constant (固定值)</option>
            </select>
            {step.params?.method === 'constant' && (
              <input 
                type="text" 
                className="wb-search-input" 
                style={{ fontSize: 11, height: 28, marginTop: 4 }}
                placeholder="Value..." 
                value={step.params?.value || ''}
                onChange={e => onParamChange(step.uid, { ...step.params, value: e.target.value })}
              />
            )}
          </div>
        );
      case 'normalize':
      case 'binning':
        return (
          <div className="wb-param-group" style={{ display: 'flex', gap: 4, marginTop: 8 }}>
            <input 
              type="number" 
              className="wb-search-input" 
              style={{ fontSize: 11, height: 28 }}
              placeholder="Min" 
              value={step.params?.min ?? 0}
              onChange={e => onParamChange(step.uid, { ...step.params, min: Number(e.target.value) })}
            />
            <input 
              type="number" 
              className="wb-search-input" 
              style={{ fontSize: 11, height: 28 }}
              placeholder="Max" 
              value={step.params?.max ?? 1}
              onChange={e => onParamChange(step.uid, { ...step.params, max: Number(e.target.value) })}
            />
          </div>
        );
      case 'filter':
        return (
          <div className="wb-param-group">
            <select 
              className="wb-search-input" 
              style={{ fontSize: 11, height: 28, marginTop: 8 }}
              value={step.params?.column || ''}
              onChange={e => onParamChange(step.uid, { ...step.params, column: e.target.value })}
            >
              <option value="">Select Column...</option>
              {colOptions.map((c: string) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select 
              className="wb-search-input" 
              style={{ fontSize: 11, height: 28, marginTop: 4 }}
              value={step.params?.operator || '=='}
              onChange={e => onParamChange(step.uid, { ...step.params, operator: e.target.value })}
            >
              <option value="==">== Equals</option>
              <option value="!=">!= Not Equal</option>
              <option value=">">&gt; Greater Than</option>
              <option value="<">&lt; Less Than</option>
              <option value="contains">Contains</option>
            </select>
            <input 
              type="text" 
              className="wb-search-input" 
              style={{ fontSize: 11, height: 28, marginTop: 4 }}
              placeholder="Value..." 
              value={step.params?.value || ''}
              onChange={e => onParamChange(step.uid, { ...step.params, value: e.target.value })}
            />
          </div>
        );
      case 'join':
      case 'merge':
        return (
          <div className="wb-param-group">
            <select 
              className="wb-search-input" 
              style={{ fontSize: 11, height: 28, marginTop: 8 }}
              value={step.params?.targetDatasetId || ''}
              onChange={e => onParamChange(step.uid, { ...step.params, targetDatasetId: e.target.value })}
            >
              <option value="">Join with Dataset...</option>
              {otherDatasets?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <select 
                className="wb-search-input" 
                style={{ fontSize: 11, height: 28, flex: 1 }}
                value={step.params?.leftKey || ''}
                onChange={e => onParamChange(step.uid, { ...step.params, leftKey: e.target.value })}
              >
                 <option value="">Left Key...</option>
                 {colOptions.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input 
                type="text" 
                className="wb-search-input" 
                style={{ fontSize: 11, height: 28, flex: 1 }}
                placeholder="Right Key..." 
                value={step.params?.rightKey || ''}
                onChange={e => onParamChange(step.uid, { ...step.params, rightKey: e.target.value })}
              />
            </div>
            <select 
              className="wb-search-input" 
              style={{ fontSize: 11, height: 28, marginTop: 4 }}
              value={step.params?.joinType || 'inner'}
              onChange={e => onParamChange(step.uid, { ...step.params, joinType: e.target.value })}
            >
              <option value="inner">Inner Join</option>
              <option value="left">Left Join</option>
            </select>
          </div>
        );
      case 'add_col':
        return renderAddColumnParams(step, version.id);
      default:
        return null;
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="wb-flow-card">
      <div className="wb-flow-header wb-flow-op-header">
        <span className="wb-flow-tag">{step.type.toUpperCase()}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <div {...attributes} {...listeners} style={{ cursor: 'grab' }}><Layers size={14}/></div>
          <X size={14} style={{ cursor: 'pointer' }} onClick={() => onRemove(step.uid)}/>
        </div>
      </div>
      <div className="wb-flow-body">
        <div className="wb-flow-title">{step.label.split(' (')[0]}</div>
        
        {step.type !== 'add_col' && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Apply to Columns:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflowY: 'auto', padding: 8, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
              {colOptions.map((c: string) => (
                <div 
                  key={c} 
                  onClick={() => toggleCol(c)}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: 12.5, 
                    fontWeight: 600,
                    borderRadius: 8, 
                    cursor: 'pointer',
                    background: selectedCols.includes(c) ? '#2563eb' : '#fff',
                    color: selectedCols.includes(c) ? '#fff' : '#475569',
                    border: '1px solid',
                    borderColor: selectedCols.includes(c) ? '#2563eb' : '#e2e8f0',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s'
                  }}
                  className="col-selection-tag"
                >
                  {c}
                </div>
              ))}
              {colOptions.length === 0 && <span style={{ fontSize: 11, color: '#94a3b8' }}>No columns found</span>}
            </div>
          </div>
        )}

        <div className="wb-flow-meta" style={{ marginTop: 8 }}>
          {step.type === 'normalize' ? 'Operator scaling & constraints' : 'Specific operation parameters'}
        </div>
        {renderParams()}
      </div>
    </div>
  );
}

function CanvasDropZone({ children, isEmpty }: any) {
  const { isOver, setNodeRef } = useDroppable({ id: 'canvas-drop-zone' });
  return (
    <div ref={setNodeRef} className="wb-canvas-content" style={{ background: isOver ? 'rgba(37, 99, 235, 0.05)' : 'transparent' }}>
      {children}
      {isEmpty && (
        <div className="wb-canvas-empty" style={{ marginTop: 40, border: '2px dashed #e2e8f0', width: '100%', maxWidth: 380, borderRadius: 12 }}>
          <div className="wb-canvas-guide">将操作拖拽到此处构建流程</div>
        </div>
      )}
    </div>
  );
}

function CorrelationMatrix({ data, columns }: { data: any[]; columns: string[] }) {
  const chartRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chartRef.current || data.length < 2 || columns.length < 2) return;
    const chart = echarts.getInstanceByDom(chartRef.current) || echarts.init(chartRef.current);
    const matrix = columns.map(rowCol => 
      columns.map(colCol => {
        if (rowCol === colCol) return 1;
        const pairs = data.map(r => ({ x: Number(r[rowCol]), y: Number(r[colCol]) }))
                         .filter(p => !isNaN(p.x) && !isNaN(p.y));
        if (pairs.length < 2) return 0;
        const n = pairs.length;
        const mx = pairs.reduce((a, b) => a + b.x, 0) / n;
        const my = pairs.reduce((a, b) => a + b.y, 0) / n;
        const cov = pairs.reduce((a, b) => a + (b.x - mx) * (b.y - my), 0) / n;
        const varX = pairs.reduce((a, b) => a + (b.x - mx)**2, 0) / n;
        const varY = pairs.reduce((a, b) => a + (b.y - my)**2, 0) / n;
        const sdx = Math.sqrt(varX);
        const sdy = Math.sqrt(varY);
        return sdx === 0 || sdy === 0 ? 0 : parseFloat((cov / (sdx * sdy)).toFixed(3));
      })
    );
    chart.setOption({
      tooltip: { position: 'top' },
      grid: { top: 10, left: 50, right: 10, bottom: 40 },
      xAxis: { type: 'category', data: columns, axisLabel: { fontSize: 9, rotate: 30 } },
      yAxis: { type: 'category', data: columns, axisLabel: { fontSize: 9 } },
      visualMap: { min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: -10, inRange: { color: ['#ef4444', '#f8fafc', '#2563eb'] }, show: false },
      series: [{ type: 'heatmap', data: columns.flatMap((r, ri) => columns.map((c, ci) => [ci, ri, matrix[ri][ci]])), label: { show: true, fontSize: 8 } }]
    });
  }, [data, columns]);
  return <div ref={chartRef} style={{ width: '100%', height: 180 }} />;
}

interface DataProcessBuilderProps {
  activeVersion?: any;
  activeDatasetId?: any;
  addLog?: (level: string, msg: string) => void;
  onVersionCreated?: (v: any) => void;
}

export default function DataProcessBuilder({
  activeVersion: propsActiveVersion,
  activeDatasetId: propsActiveDatasetId,
  addLog: propsAddLog,
  onVersionCreated,
}: DataProcessBuilderProps = {}) {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedSources, setSelectedSources] = useState<any[]>([]);
  const [previewSourceIndex, setPreviewSourceIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [outputNames, setOutputNames] = useState<Record<number, string>>({});
  const [workflows, setWorkflows] = useState<Record<number, any[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [log, setLog] = useState<any[]>([]);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [highlightedCols, setHighlightedCols] = useState<string[]>([]);

  useEffect(() => {
    axios.get('/api/datasets', {
      headers: { Authorization: `Bearer ${localStorage.getItem('statlab_token')}` }
    }).then(r => {
      setDatasets(r.data);
      if (r.data.length && !propsActiveVersion && selectedSources.length === 0) {
        const first = r.data[0].versions?.[0];
        if (first) {
          setSelectedSources([{ ...first, dataset: r.data[0] }]);
          setPreviewSourceIndex(0);
        }
      }
    }).catch(() => setDatasets([]));
  }, []);

  useEffect(() => {
    if (propsActiveVersion && !selectedSources.find(s => s.id === propsActiveVersion.id)) {
      setSelectedSources(prev => [...prev, propsActiveVersion]);
      setPreviewSourceIndex(selectedSources.length);
    }
  }, [propsActiveVersion]);

  const activeVersion = selectedSources[previewSourceIndex] || null;

  useEffect(() => {
    if (activeVersion) {
      axios.get(`/api/datasets/${activeVersion.datasetId}/preview`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('statlab_token')}` }
      }).then(r => {
        const rows = Array.isArray(r.data) ? r.data : (r.data.rows || []);
        setPreviewRows(rows.slice(0, 200));
      }).catch(() => setPreviewRows([]));
    }
  }, [activeVersion]);

  async function handleExecuteSource(sourceIndex: number) {
    const source = selectedSources[sourceIndex];
    const steps = workflows[source.id] || [];
    if (!source || steps.length === 0) return;
    setLoadingMap(prev => ({ ...prev, [source.id]: true }));
    try {
      const currentName = outputNames[source.id] || `Processed_${source.datasetName || 'Data'}`;
      const { data } = await axios.post('/api/process', {
        datasetVersionIds: [source.id],
        steps: steps.map(s => ({ type: s.type, params: s.params })),
        outputName: currentName
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('statlab_token')}` }
      });
      if (data.newVersions && onVersionCreated) {
        data.newVersions.forEach((v: any) => onVersionCreated(v));
      }
      setLog(prev => [...prev, { ts: new Date().toLocaleTimeString(), msg: `Chain ${sourceIndex+1} executed successfully.` }]);
      const processed = steps.flatMap(s => s.params?.selectedCols || []);
      if (steps.some(s => s.type === 'add_col')) processed.push(steps.find(s=>s.type==='add_col')?.params?.columnTitle || 'New Column');
      setHighlightedCols([...new Set(processed)]);
      if (data.newVersions?.length) {
         setSelectedSources(prev => {
           const next = [...prev];
           next[sourceIndex] = data.newVersions[0];
           return next;
         });
      }
    } catch (e: any) {
      setLog(prev => [...prev, { ts: new Date().toLocaleTimeString(), msg: `Error: ` + (e.response?.data?.error || e.message) }]);
    } finally {
      setLoadingMap(prev => ({ ...prev, [source.id]: false }));
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.data?.current?.type === 'operation') {
      const op = ALL_OPERATORS.find(o => `lib_${o.type}` === active.id);
      if (op && activeVersion) {
        setWorkflows(prev => ({
          ...prev,
          [activeVersion.id]: [...(prev[activeVersion.id] || []), { ...op, uid: `${op.type}_${Date.now()}`, params: {} }]
        }));
      }
    } else if (active.data?.current?.type === 'dataset') {
      const { version, dataset } = active.data.current;
      if (version && !selectedSources.find(s => s.id === version.id)) {
        setSelectedSources(prev => [...prev, { ...version, dataset }]);
        setPreviewSourceIndex(selectedSources.length);
      }
    } else {
      const activeId = active.id as string;
      const overId = over.id as string;
      for (const sid of Object.keys(workflows)) {
        const list = workflows[Number(sid)];
        const oldIdx = list.findIndex(s => s.uid === activeId);
        const newIdx = list.findIndex(s => s.uid === overId);
        if (oldIdx !== -1 && newIdx !== -1) {
          setWorkflows(prev => ({ ...prev, [Number(sid)]: arrayMove(list, oldIdx, newIdx) }));
          break;
        }
      }
    }
  }

  const renderAddColumnParams = (step: any, sid: number) => {
    const source = selectedSources.find(s => s.id === sid);
    const cols = source?.columns?.map((c: any) => c.name) || [];
    const insertTerm = (term: string) => {
      const current = step.params?.content || '';
      const newContent = current ? `${current} ${term}` : term;
      const newSteps = workflows[sid].map(s => s.uid === step.uid ? { ...s, params: { ...s.params, content: newContent } } : s);
      setWorkflows(prev => ({ ...prev, [sid]: newSteps }));
    };
    return (
      <div className="wb-param-group">
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Column Configuration</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Header Name</div>
          <input 
            type="text" className="wb-search-input" style={{ fontSize: 12, height: 32, marginBottom: 8 }}
            placeholder="e.g. Total_Score" value={step.params?.columnTitle || ''}
            onChange={e => {
              const newSteps = workflows[sid].map(s => s.uid === step.uid ? { ...s, params: { ...s.params, columnTitle: e.target.value } } : s);
              setWorkflows(prev => ({ ...prev, [sid]: newSteps }));
            }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4 }}>Formula / Constant</div>
          <textarea 
            className="wb-search-input" style={{ fontSize: 12, minHeight: 60, fontFamily: "'JetBrains Mono', monospace" }}
            placeholder="e.g. ColumnA + ColumnB" value={step.params?.content || ''}
            onChange={e => {
              const newSteps = workflows[sid].map(s => s.uid === step.uid ? { ...s, params: { ...s.params, content: e.target.value } } : s);
              setWorkflows(prev => ({ ...prev, [sid]: newSteps }));
            }}
          />
        </div>
        <div style={{ background: '#f8fafc', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>FORMULA HELPER</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {['+', '-', '*', '/', '(', ')', '.', ','].map(op => (
              <button key={op} onClick={() => insertTerm(op)} type="button" style={{ padding: '2px 8px', fontSize: 11, borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>{op}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
            {cols.map(c => (
              <button key={c} onClick={() => insertTerm(c)} type="button" style={{ padding: '2px 8px', fontSize: 10, borderRadius: 4, border: '1px solid #e2e8f0', background: '#f1f5f9', color: '#475569', cursor: 'pointer' }}>{c}</button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="wb-root">
        <aside className="wb-sidebar">
          <div className="wb-sidebar-header">
            <div className="wb-sidebar-title"><Database size={18} style={{ marginRight: 8 }}/>DATA PIPELINE</div>
            <div className="wb-search-box">
              <Search size={14} className="wb-search-icon" />
              <input type="text" className="wb-search-input" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
            </div>
          </div>
          <div className="wb-op-group">
            {OPERATOR_GROUPS.map(group => (
              <div key={group.title}>
                <div className="wb-op-group-title">{group.title}</div>
                {group.items.filter(i => i.label.toLowerCase().includes(searchTerm.toLowerCase())).map(item => (
                  <DraggableOpItem key={item.type} item={item} onAdd={(op) => {
                    if (activeVersion) {
                      setWorkflows(prev => ({
                        ...prev, [activeVersion.id]: [...(prev[activeVersion.id] || []), { ...op, uid: `${op.type}_${Date.now()}`, params: {} }]
                      }));
                    }
                  }}/>
                ))}
              </div>
            ))}
          </div>
          <div style={{ padding: 20, borderTop: '1px solid #e2e8f0' }}>
            <div className="wb-section-label">Source Selection</div>
            <div className="wb-dataset-list">
               {datasets.map(ds => (
                 <DraggableDatasetItem key={ds.id} ds={ds} onSelect={(d) => {
                   const ver = d.versions?.[0];
                   if (ver && !selectedSources.find(s => s.id === ver.id)) {
                     setSelectedSources(prev => [...prev, { ...ver, dataset: d }]);
                     setPreviewSourceIndex(selectedSources.length);
                   }
                 }}/>
               ))}
            </div>
          </div>
        </aside>
        <main className="wb-canvas">
          <div className="wb-canvas-content">
            {selectedSources.map((s, sIdx) => (
              <div key={s.id} className="wb-chain-column">
                <div onClick={() => setPreviewSourceIndex(sIdx)} style={{ cursor: 'pointer', outline: previewSourceIndex === sIdx ? '2px solid #2563eb' : 'none', borderRadius: 8 }}>
                  <SourceCard dataset={s.dataset} version={s} index={sIdx}/>
                </div>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                  <div style={{ position: 'absolute', top: -20, bottom: 0, width: 2, background: '#cbd5e1', zIndex: 0 }}></div>
                  <SortableContext items={(workflows[s.id] || []).map(st => st.uid)} strategy={verticalListSortingStrategy}>
                    {(workflows[s.id] || []).map((step, idx) => (
                      <div key={step.uid} style={{ zIndex: 1, width: '100%' }}>
                        <SortableFlowCard 
                          step={step} index={idx} version={s}
                          otherDatasets={datasets.filter(d => d.id !== s.datasetId)}
                          onRemove={id => setWorkflows(prev => ({ ...prev, [s.id]: prev[s.id].filter(x => x.uid !== id) }))}
                          onParamChange={(id, v) => setWorkflows(prev => ({ ...prev, [s.id]: prev[s.id].map(x => x.uid === id ? { ...x, params: v } : x) }))}
                          renderAddColumnParams={renderAddColumnParams}
                        />
                      </div>
                    ))}
                  </SortableContext>
                  <div className="wb-chain-output-box">
                    <input 
                      type="text" className="wb-search-input" style={{ fontSize: 11, height: 28, marginBottom: 8 }}
                      placeholder="Output Name..." value={outputNames[s.id] || ''}
                      onChange={e => setOutputNames(prev => ({ ...prev, [s.id]: e.target.value }))}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                       <Trash2 size={16} style={{ color: '#ef4444', cursor: 'pointer', padding: 4, background: '#fee2e2', borderRadius: 4 }} onClick={() => {
                           setSelectedSources(prev => prev.filter((_, i) => i !== sIdx));
                           setPreviewSourceIndex(0);
                       }}/>
                       <button className="wb-execute-single-btn" onClick={() => handleExecuteSource(sIdx)} disabled={loadingMap[s.id]}>
                         {loadingMap[s.id] ? '...' : <Play size={12}/>}
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="wb-preview-container">
            <div className="wb-preview-header">
               DATA PREVIEW <span style={{ padding: '2px 6px', background: '#f1f5f9', borderRadius: 4 }}>ROWS: {activeVersion?.dataset?.rowCount?.toLocaleString() || '---'}</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: '#334155' }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: '#f8fafc', borderBottom: '2px solid #e2e8f0', zIndex: 1 }}>
                    {activeVersion?.columns.map((c: any) => (
                      <th key={c.name} style={{ 
                        padding: '12px 16px', 
                        textAlign: 'left', 
                        fontWeight: 700, 
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.025em',
                        whiteSpace: 'nowrap'
                      }}>
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {activeVersion?.columns.map((c: any) => (
                        <td key={c.name} style={{ padding: '6px 16px' }} className={highlightedCols.includes(c.name) ? 'highlight-cell' : ''}>
                          {typeof row[c.name] === 'number' ? row[c.name].toFixed(3) : String(row[c.name] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </DndContext>
  );
}
