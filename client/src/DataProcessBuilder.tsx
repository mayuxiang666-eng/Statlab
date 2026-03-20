import React, { useEffect, useState, useMemo } from 'react';
import { Table } from 'antd';
import { DndContext, useSensor, useSensors, PointerSensor, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Layers, Hash, Clock, Type, GripVertical, Package } from 'lucide-react';
import axios from 'axios';

const PROCESS_OPERATIONS = [
  { type: 'fill_missing', label: '缺失值填充' },
  { type: 'standardize', label: '标准化' },
  { type: 'normalize', label: '归一化' },
  { type: 'binning', label: '分箱' },
  { type: 'encode', label: '编码' },
  { type: 'filter', label: '筛选' },
];

function SortableStep({ step, index, onRemove, onParamChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.uid });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: 6,
    marginBottom: 8,
    padding: 12,
    boxShadow: isDragging ? '0 2px 8px #0002' : 'none',
    display: 'flex',
    alignItems: 'center',
    gap: 12
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span style={{ fontWeight: 500 }}>{step.label}</span>
      {step.param !== undefined && (
        <input
          type="text"
          value={step.param}
          onChange={e => onParamChange(step.uid, e.target.value)}
          style={{ marginLeft: 8, width: 80 }}
        />
      )}
      <button onClick={() => onRemove(step.uid)} style={{ marginLeft: 'auto', color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer' }}>删除</button>
    </div>
  );
}

export default function DataProcessBuilder() {
  const [datasets, setDatasets] = useState([]);
  const [activeDatasetId, setActiveDatasetId] = useState(null);
  const [activeVersion, setActiveVersion] = useState(null);
  useEffect(() => {
    axios.get('/api/datasets').then(r => {
      setDatasets(r.data);
      if (r.data.length && !activeDatasetId) {
        setActiveDatasetId(r.data[0].id);
        setActiveVersion(r.data[0].versions[0]);
      }
    }).catch(() => setDatasets([]));
  }, []);

  useEffect(() => {
    if (!activeDatasetId && datasets.length) {
      setActiveDatasetId(datasets[0].id);
      setActiveVersion(datasets[0].versions[0]);
    }
  }, [datasets, activeDatasetId]);

  const columns = useMemo(() => activeVersion?.columns || [], [activeVersion]);
  const categoricalFields = useMemo(() => columns.filter(c => c.type === 'categorical' || c.type === 'time'), [columns]);
  const numericFields = useMemo(() => columns.filter(c => c.type === 'numeric'), [columns]);

  const sensors = useSensors(useSensor(PointerSensor));
  const [workflow, setWorkflow] = useState([]);
  const [result, setResult] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  async function handleRun() {
    if (!activeVersion || workflow.length === 0) return;
    setLoading(true);
    setLog(lg => [...lg, { ts: new Date().toLocaleTimeString(), msg: '开始处理...' }]);
    try {
      const { data } = await axios.post('/api/process', {
        datasetVersionId: activeVersion.id,
        steps: workflow.map(({ type, param }) => ({ type, param }))
      });
      setResult(data.result || null);
      setLog(lg => [...lg, { ts: new Date().toLocaleTimeString(), msg: '处理完成' }]);
    } catch (e) {
      setLog(lg => [...lg, { ts: new Date().toLocaleTimeString(), msg: '处理失败: ' + (e?.response?.data?.error || e.message) }]);
    } finally {
      setLoading(false);
    }
  }

  // 拖拽处理
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;
    // 拖入新操作
    if (active.data?.current?.type === 'operation') {
      const op = PROCESS_OPERATIONS.find(o => o.type === active.id);
      if (op) {
        setWorkflow(wf => [...wf, { ...op, uid: `${op.type}_${Date.now()}`, param: '' }]);
      }
    } else if (active.data?.current?.type === 'step' && active.id !== over.id) {
      // 步骤排序
      const oldIdx = workflow.findIndex(s => s.uid === active.id);
      const newIdx = workflow.findIndex(s => s.uid === over.id);
      setWorkflow(wf => arrayMove(wf, oldIdx, newIdx));
    }
  }

  function handleRemove(uid) {
    setWorkflow(wf => wf.filter(s => s.uid !== uid));
  }
  function handleParamChange(uid, val) {
    setWorkflow(wf => wf.map(s => s.uid === uid ? { ...s, param: val } : s));
  }

  return (
    <div className="dpb-root">
      {/* 左侧资产/操作面板 */}
      <div className="process-operations-panel" style={{ minWidth: 220 }}>
        <div className="panel-title">我的数据资产</div>
        <div style={{ marginBottom: 10 }}>
          <select
            className="input"
            style={{ width: '100%', marginBottom: 8 }}
            value={activeDatasetId ?? ''}
            onChange={e => {
              const ds = datasets.find(d => String(d.id) === e.target.value);
              setActiveDatasetId(ds?.id ?? null);
              setActiveVersion(ds?.versions?.[0] ?? null);
            }}
          >
            {datasets.map(ds => (
              <option key={ds.id} value={ds.id}>{ds.name}</option>
            ))}
          </select>
          {activeVersion && (
            <select
              className="input"
              style={{ width: '100%', marginBottom: 8 }}
              value={activeVersion.id}
              onChange={e => {
                const ver = datasets.find(d => d.id === activeDatasetId)?.versions.find(v => String(v.id) === e.target.value);
                setActiveVersion(ver ?? null);
              }}
            >
              {datasets.find(d => d.id === activeDatasetId)?.versions.map(v => (
                <option key={v.id} value={v.id}>版本 V{v.version}</option>
              ))}
            </select>
          )}
        </div>
        <div className="cb-field-list" style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 18 }}>
          <div className="cb-field-group">
            <div className="cb-field-group-header">
              <span>定类 / 时间</span>
              <span className="cb-field-count">{categoricalFields.length}</span>
            </div>
            {categoricalFields.length ? (
              categoricalFields.map(f => (
                <div key={f.name} className="cb-field">
                  <span className="cb-field-name">{f.name}</span>
                  <span className="cb-field-type">{f.type}</span>
                </div>
              ))
            ) : (
              <div className="cb-field-empty">暂无定类或时间字段</div>
            )}
          </div>
          <div className="cb-field-group">
            <div className="cb-field-group-header">
              <span>定量</span>
              <span className="cb-field-count">{numericFields.length}</span>
            </div>
            {numericFields.length ? (
              numericFields.map(f => (
                <div key={f.name} className="cb-field">
                  <span className="cb-field-name">{f.name}</span>
                  <span className="cb-field-type">{f.type}</span>
                </div>
              ))
            ) : (
              <div className="cb-field-empty">暂无数值字段</div>
            )}
          </div>
        </div>
        <div className="panel-title">数据处理操作</div>
        <div className="operations-list">
          {PROCESS_OPERATIONS.map(op => (
            <div
              key={op.type}
              className="operation-draggable"
              draggable
              style={{ cursor: 'grab' }}
              {...{
                'data-dnd-kit-draggable': true,
                'data-type': 'operation',
                'data-id': op.type
              }}
            >
              {op.label}
            </div>
          ))}
        </div>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={workflow.map(s => s.uid)} strategy={verticalListSortingStrategy}>
          <div className="process-workflow-area" style={{ minHeight: 220, padding: 12, background: '#f9fafb', border: '2px dashed #e0e0e0', borderRadius: 8 }}>
            {workflow.length === 0 ? (
              <div className="workflow-placeholder">将左侧操作拖拽到此处，构建数据处理流程</div>
            ) : (
              workflow.map((step, idx) => (
                <SortableStep key={step.uid} step={step} index={idx} onRemove={handleRemove} onParamChange={handleParamChange} />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
      <div className="process-result-area">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-primary" style={{ minWidth: 80 }} onClick={handleRun} disabled={loading || workflow.length === 0}>
              {loading ? '处理中...' : '执行'}
            </button>
            <span style={{ color: '#888', fontSize: 12 }}>支持多步链式处理</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {result && Array.isArray(result.rows) && result.rows.length > 0 ? (
              <Table
                size="small"
                bordered
                dataSource={result.rows.map((row, i) => ({ key: i, ...row }))}
                columns={result.columns.map(col => ({ title: col, dataIndex: col, key: col }))}
                pagination={{ pageSize: 10 }}
                scroll={{ x: true }}
              />
            ) : (
              <div className="result-placeholder">{loading ? '处理中...' : '处理结果将在此处展示'}</div>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#888', maxHeight: 80, overflowY: 'auto', borderTop: '1px solid #eee', paddingTop: 6 }}>
            <div style={{ fontWeight: 500, marginBottom: 2 }}>日志</div>
            {log.length === 0 ? <div>暂无日志</div> : log.map((l, i) => <div key={i}>[{l.ts}] {l.msg}</div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
