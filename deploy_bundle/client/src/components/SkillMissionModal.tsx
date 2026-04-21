import React, { useState } from 'react';
import { X, ChevronRight, CheckCircle, Play, AlertCircle, Award, RotateCcw } from 'lucide-react';

/* ─── Mission data type ─────────────────────────────────────────────────── */
export interface MissionScenario {
  id: string;
  title: string;
  branch: string;
  difficulty: string;
  xpReward: number;
  mission: string;
  desc: string;
  briefing: {
    context: string;
    tableHeaders: string[];
    tableRows: (string | number)[][];
  };
  coding: {
    referenceCode: string;
    templateCode: string;
    solutionKeywords: string[];
    hint: string;
  };
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
}

interface SkillMissionModalProps {
  scenario: MissionScenario;
  onClose: () => void;
  onComplete: (xpEarned: number) => void;
}

const MISSION_BLUEPRINT_STYLES = `
  .mission-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }

  .mission-modal {
    width: 100vw;
    height: 100vh;
    background: #f1f5f9;
    background-image: 
      linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px),
      linear-gradient(rgba(0, 0, 0, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 0, 0, 0.08) 1px, transparent 1px);
    background-size: 20px 20px, 20px 20px, 100px 100px, 100px 100px;
    display: flex;
    flex-direction: column;
    box-shadow: none;
    border: none;
    border-radius: 0;
  }

  .mission-modal::before {
    content: "INDUSTRIAL_MISSION_STATION_v3.1";
    position: absolute;
    top: 72px;
    left: 40px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.1em;
    pointer-events: none;
    z-index: 10;
  }

  .mission-modal-header {
    background: white;
    border-bottom: 2px solid #e2e8f0;
    padding: 20px 40px;
    display: flex;
    align-items: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.02);
    z-index: 20;
  }

  .mission-modal-body {
    flex: 1;
    overflow: auto;
    position: relative;
  }

  .mission-modal-footer {
    background: white;
    border-top: 2px solid #e2e8f0;
    padding: 24px 40px;
    display: flex;
    align-items: center;
    z-index: 20;
  }

  .mission-code-pane {
    background: white !important;
    border: 2px solid #e2e8f0 !important;
    border-radius: 16px !important;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
  }

  .mission-code-pane-header {
    background: #f8fafc !important;
    border-bottom: 1px solid #e2e8f0 !important;
    padding: 12px 20px !important;
    display: flex;
    align-items: center;
  }

  .mission-code-numbers {
    background: #f8fafc !important;
    color: #94a3b8 !important;
    border-right: 1px solid #e2e8f0 !important;
    font-family: 'JetBrains Mono', monospace;
    padding: 16px 12px !important;
    text-align: right;
    font-size: 11px !important;
    line-height: 1.6;
    user-select: none;
  }

  .mission-code-editor {
    flex: 1;
    background: white !important;
    color: #1e293b !important;
    font-family: 'JetBrains Mono', monospace !important;
    border: none !important;
    outline: none !important;
    resize: none !important;
    padding: 16px 20px !important;
    line-height: 1.6 !important;
  }

  .mission-code-editor.readonly {
    background: #f1f5f9 !important;
    opacity: 0.8;
  }

  .mission-step-dot {
    background: #f1f5f9;
    border: 2px solid #e2e8f0;
    color: #94a3b8;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: 800;
  }
  .mission-step-dot.active { background: #2563eb; border-color: #2563eb; color: white; box-shadow: 0 0 15px rgba(37,99,235,0.3); }
  .mission-step-dot.done { background: #10b981; border-color: #10b981; color: white; }

  .mission-step-line { background: #e2e8f0; height: 2px; }
  .mission-step-line.done { background: #10b981; }

  .mission-data-table th { background: #f8fafc; color: #64748b; font-weight: 800; text-transform: uppercase; font-size: 11px; padding: 12px 16px; border-bottom: 2px solid #e2e8f0; }
  .mission-data-table td { color: #1e293b; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-family: 'JetBrains Mono', monospace; }

  .mission-quiz-option {
    background: white;
    border: 2px solid #e2e8f0;
    color: #1e293b;
    cursor: pointer;
    transition: all 0.2s;
  }
  .mission-quiz-option:hover { border-color: #2563eb; background: #eff6ff; }
  .mission-quiz-option.selected { border-color: #2563eb; background: #2563eb; color: white; }
  .mission-quiz-option.correct { border-color: #10b981; background: #10b981; color: white; }
  .mission-quiz-option.wrong { border-color: #ef4444; background: #ef4444; color: white; }

  .btn-mission-back {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    color: #64748b;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s;
    margin-right: 24px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .btn-mission-back:hover { background: #e2e8f0; color: #1e293b; }

  @keyframes missionFadeIn { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
`;

/* ─── Component ─────────────────────────────────────────────────────────── */
const SkillMissionModal: React.FC<SkillMissionModalProps> = ({ scenario, onClose, onComplete }) => {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0); // 0=brief, 1=code, 2=quiz, 3=done
  const [userCode, setUserCode] = useState(scenario.coding.templateCode);
  const [codeStatus, setCodeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [codeError, setCodeError] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<number[]>(Array(scenario.quiz.length).fill(-1));
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  /* ── code validation ── */
  const validateCode = () => {
    const code = userCode.toLowerCase();
    const allPresent = scenario.coding.solutionKeywords.every(kw => code.includes(kw.toLowerCase()));
    if (allPresent) {
      setCodeStatus('success');
      setCodeError('');
    } else {
      const missing = scenario.coding.solutionKeywords.filter(kw => !code.toLowerCase().includes(kw.toLowerCase()));
      setCodeStatus('error');
      setCodeError(`提示：代码中尚未包含关键调用：${missing.join(', ')}`);
    }
  };

  /* ── quiz submit ── */
  const submitQuiz = () => {
    let score = 0;
    scenario.quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correctIndex) score++;
    });
    setQuizScore(score);
    setQuizSubmitted(true);
  };

  /* ── go to done ── */
  const finishMission = () => {
    const bonus = quizScore === scenario.quiz.length ? 50 : 0;
    const total = scenario.xpReward + bonus;
    onComplete(total);
    setStep(3);
  };

  /* ── helpers ── */
  const stepDone = (s: number) => step > s;
  const stepActive = (s: number) => step === s;

  return (
    <div className="mission-modal-overlay">
      <style>{MISSION_BLUEPRINT_STYLES}</style>
      <div className="mission-modal" style={{ animation: 'missionFadeIn 0.5s ease' }}>

        {/* ── Header ── */}
        <div className="mission-modal-header">
          <button onClick={onClose} className="btn-mission-back" title="返回关卡选择">
             <RotateCcw size={14} style={{ transform: 'scaleX(-1)' }} />
             <span>BACK_TO_LEVELMAP</span>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace' }}>
              PRO MISSION / {scenario.branch} / {scenario.difficulty}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1e293b', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              {scenario.title}
            </div>
          </div>

          {/* Step bar */}
          {step < 3 && (
            <div className="mission-step-bar" style={{ display: 'flex', alignItems: 'center', margin: '0 60px' }}>
              {['场景解读', '核心实操', '知识验证'].map((label, i) => (
                <React.Fragment key={i}>
                  <div className={`mission-step-dot ${stepDone(i) ? 'done' : stepActive(i) ? 'active' : ''}`}
                    style={{ width: 32, height: 32, fontSize: 12 }}>
                    {stepDone(i) ? <CheckCircle size={16} /> : i + 1}
                    <span style={{ position: 'absolute', bottom: -20, whiteSpace: 'nowrap', fontSize: 10, color: stepActive(i) ? '#1e293b' : '#94a3b8', fontWeight: 800 }}>{label}</span>
                  </div>
                  {i < 2 && <div className={`mission-step-line ${stepDone(i) ? 'done' : ''}`} style={{ width: 50, height: 2, margin: '0 8px' }} />}
                </React.Fragment>
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#64748b', cursor: 'pointer', padding: 10, borderRadius: 12, transition: 'all 0.2s' }}
            title="关闭">
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="mission-modal-body">

          {/* STEP 0 — Briefing (Visual Redesign) */}
          {step === 0 && (
            <div style={{ padding: '60px 100px', animation: 'missionFadeIn 0.5s ease', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: 56 }}>
                <div style={{ fontSize: 56, marginBottom: 20, filter: 'grayscale(1) brightness(0.5)' }}>📡</div>
                <h2 style={{ fontSize: 36, fontWeight: 900, color: '#1e293b', marginBottom: 12, letterSpacing: '-0.02em' }}>任务场景接入</h2>
                <div style={{ color: '#64748b', fontSize: 18, fontWeight: 500 }}>请仔细阅读业务背景与数据结构，准备进入核心实操环节。</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
                <div>
                  <div style={{ marginBottom: 32, padding: '32px', background: 'white', border: '2px solid #e2e8f0', borderLeft: '6px solid #2563eb', borderRadius: '12px 24px 24px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#2563eb', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>Mission Objective</div>
                    <div style={{ fontSize: 18, color: '#1e293b', fontWeight: 700, lineHeight: 1.5 }}>{scenario.mission}</div>
                  </div>
                  <div style={{ padding: '0 12px' }}>
                     <h3 style={{ fontSize: 14, fontWeight: 800, color: '#475569', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scenario Context</h3>
                     <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.8, fontWeight: 500 }}>
                        {scenario.briefing.context}
                     </p>
                  </div>
                </div>

                <div style={{ background: 'white', borderRadius: 32, padding: 32, border: '2px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.04)' }}>
                  <div style={{ marginBottom: 20, fontSize: 11, fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>
                    Data Structure Preview
                  </div>
                  <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                    <table className="mission-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{scenario.briefing.tableHeaders.map(h => <th key={h}>{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {scenario.briefing.tableRows.map((row, ri) => (
                          <tr key={ri} style={{ background: ri % 2 === 0 ? '#f8fafc' : 'white' }}>
                            {row.map((cell, ci) => <td key={ci} style={{ fontSize: 13 }}>{cell}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — Coding (PRO IDE LAYOUT) */}
          {step === 1 && (
            <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
              {/* Sidebar Briefing */}
              <div style={{ width: 380, background: 'white', borderRight: '2px solid #e2e8f0', padding: '40px 32px', overflowY: 'auto' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#2563eb', textTransform: 'uppercase', marginBottom: 24, letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace' }}>任务指引 / GUIDELINE</div>
                
                <div style={{ marginBottom: 40 }}>
                  <div style={{ fontSize: 15, color: '#1e293b', fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>业务目标</div>
                  <div style={{ fontSize: 15, color: '#64748b', lineHeight: 1.7, fontWeight: 500 }}>{scenario.mission}</div>
                </div>

                <div style={{ marginBottom: 40 }}>
                   <div style={{ fontSize: 15, color: '#1e293b', fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.02em' }}>核心考点</div>
                   <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                     {scenario.coding.solutionKeywords.map(kw => (
                       <span key={kw} style={{ fontSize: 11, padding: '6px 14px', background: '#f8fafc', borderRadius: 12, color: '#475569', border: '1px solid #e2e8f0', fontWeight: 750, fontFamily: 'JetBrains Mono, monospace' }}>{kw}</span>
                     ))}
                   </div>
                </div>

                <div style={{ padding: 24, background: '#eff6ff', borderRadius: 24, border: '2px solid #dbeafe' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#2563eb', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase' }}>
                    <AlertCircle size={14} /> 专家提示 / TECH_INSIGHT
                  </div>
                  <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6, fontWeight: 500 }}>{scenario.coding.hint}</div>
                </div>
              </div>

              {/* Main IDE area */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px', background: '#f8fafc', gap: 24 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                  
                  {/* Reference Solution Pane */}
                  <div className="mission-code-pane" style={{ height: '32%', minHeight: 220 }}>
                    <div className="mission-code-pane-header">
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                      </div>
                      <span style={{ marginLeft: 16, fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>REFERENCE_SOLUTION.PY</span>
                    </div>
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                      <div className="mission-code-numbers">
                        {scenario.coding.referenceCode.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                      </div>
                      <textarea className="mission-code-editor readonly" readOnly value={scenario.coding.referenceCode} spellCheck={false} style={{ fontSize: 15 }} />
                    </div>
                  </div>

                  {/* Writable Workspace Pane */}
                  <div className="mission-code-pane" style={{ flex: 1 }}>
                    <div className="mission-code-pane-header" style={{ justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                         <div style={{ display: 'flex', gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#1e293b', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>WORKSPACE : MAIN.PY</span>
                      </div>
                      <div style={{ fontSize: 9, padding: '4px 12px', background: '#2563eb', borderRadius: 8, color: '#fff', fontWeight: 900, letterSpacing: '0.05em' }}>WRITABLE_ENV</div>
                    </div>
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                      <div className="mission-code-numbers">
                        {(userCode || ' ').split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
                      </div>
                      <textarea
                        className="mission-code-editor"
                        value={userCode}
                        onChange={e => { setUserCode(e.target.value); setCodeStatus('idle'); }}
                        spellCheck={false}
                        style={{ fontSize: 16 }}
                        placeholder="# Start coding here..."
                      />
                    </div>
                  </div>
                </div>

                {/* Feedback Console */}
                <div style={{ height: 100, display: 'flex', gap: 20 }}>
                  {codeStatus === 'idle' && (
                    <div style={{ flex: 1, background: 'white', borderRadius: 24, border: '2px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 15, fontWeight: 700 }}>
                      <Play size={18} style={{ marginRight: 12, opacity: 0.5 }} /> 等待数据处理任务提交验证...
                    </div>
                  )}
                  {codeStatus === 'success' && (
                    <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 24, border: '2px solid #bbf7d0', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 24px rgba(16,185,129,0.05)' }}>
                      <div style={{ background: '#10b981', padding: 10, borderRadius: 12 }}>
                        <CheckCircle size={28} color="#fff" />
                      </div>
                      <div>
                        <div style={{ color: '#065f46', fontWeight: 900, fontSize: 16, letterSpacing: '0.02em' }}>MISSION VALIDATION PASSED</div>
                        <div style={{ color: '#059669', fontSize: 14, marginTop: 4, fontWeight: 500 }}>代码逻辑严密，已成功识别并处理工业核心数据流。</div>
                      </div>
                    </div>
                  )}
                  {codeStatus === 'error' && (
                    <div style={{ flex: 1, background: '#fef2f2', borderRadius: 24, border: '2px solid #fecaca', padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 20, boxShadow: '0 8px 24px rgba(239,68,68,0.05)' }}>
                      <div style={{ background: '#ef4444', padding: 10, borderRadius: 12 }}>
                        <AlertCircle size={28} color="#fff" />
                      </div>
                      <div>
                        <div style={{ color: '#991b1b', fontWeight: 900, fontSize: 16, letterSpacing: '0.02em' }}>SYNTAX / LOGIC ERROR</div>
                        <div style={{ color: '#dc2626', fontSize: 14, marginTop: 4, fontWeight: 500 }}>{codeError}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — Quiz */}
          {step === 2 && (
            <div style={{ padding: '60px 100px', animation: 'missionFadeIn 0.4s ease', maxWidth: 1200, margin: '0 auto' }}>
              <div style={{ marginBottom: 48 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#1e293b', marginBottom: 8, letterSpacing: '-0.01em' }}>知识强度识别 / KNOWLEDGE_VERIFICATION</div>
                <div style={{ color: '#64748b', fontWeight: 500 }}>回答以下问题以验证你对工业 AI 流程的理解深度。</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {scenario.quiz.map((q, qi) => (
                  <div key={qi} style={{ background: 'white', borderRadius: 24, padding: 32, border: '2px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 24, color: '#1e293b', display: 'flex', gap: 16 }}>
                      <span style={{ color: '#2563eb', fontFamily: 'JetBrains Mono, monospace' }}>0{qi + 1}.</span>
                      <span>{q.question}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {q.options.map((opt, oi) => {
                        let cls = 'mission-quiz-option';
                        if (quizSubmitted) {
                          if (oi === q.correctIndex) cls += ' correct';
                          else if (oi === quizAnswers[qi] && oi !== q.correctIndex) cls += ' wrong';
                        } else if (quizAnswers[qi] === oi) {
                          cls += ' selected';
                        }
                        return (
                          <div key={oi} className={cls} onClick={() => !quizSubmitted && setQuizAnswers(prev => { const n = [...prev]; n[qi] = oi; return n; })}
                            style={{ padding: '20px 24px', borderRadius: 16, fontSize: 14, fontWeight: 600 }}>
                            <span style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid currentColor', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, marginRight: 16, fontFamily: 'JetBrains Mono, monospace' }}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {quizSubmitted && (
                 <div style={{
                  padding: '32px 40px', borderRadius: 32,
                  background: quizScore >= Math.ceil(scenario.quiz.length * 2 / 3) ? '#f0fdf4' : '#fef2f2',
                  border: `2px solid ${quizScore >= Math.ceil(scenario.quiz.length * 2 / 3) ? '#bbf7d0' : '#fecaca'}`,
                  display: 'flex', alignItems: 'center', gap: 24, marginTop: 48, boxShadow: '0 8px 30px rgba(0,0,0,0.04)'
                }}>
                  {quizScore >= Math.ceil(scenario.quiz.length * 2 / 3)
                    ? <CheckCircle size={48} color="#10b981" />
                    : <AlertCircle size={48} color="#ef4444" />}
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#1e293b' }}>
                      能力评估结果: {quizScore} / {scenario.quiz.length}
                    </div>
                    <div style={{ fontSize: 15, color: '#64748b', marginTop: 6, fontWeight: 500 }}>
                      {quizScore >= Math.ceil(scenario.quiz.length * 2 / 3)
                        ? `测试已通过。你能够准确识别工业实战中的关键节点。奖励 ${scenario.xpReward}${quizScore === scenario.quiz.length ? ' (+50 完美奖金)' : ''} XP`
                        : '评估未达标。建议回顾实操流程，重新进行知识点扫描。'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — Done */}
          {step === 3 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, animation: 'missionFadeIn 0.8s ease' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 120, filter: 'drop-shadow(0 0 40px rgba(37,99,235,0.2))' }}>🛡️</div>
                <div style={{ position: 'absolute', bottom: 15, right: -15, background: '#10b981', color: '#fff', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '6px solid #f1f5f9', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
                  <CheckCircle size={32} />
                </div>
              </div>
              
              <h2 style={{ fontSize: 48, fontWeight: 900, margin: '40px 0 16px', color: '#1e293b', letterSpacing: '-0.03em' }}>
                MISSION <span style={{ color: '#2563eb' }}>ACCOMPLISHED</span>
              </h2>
              <div style={{ fontSize: 18, color: '#64748b', marginBottom: 56, textAlign: 'center', maxWidth: 600, fontWeight: 500, lineHeight: 1.6 }}>
                恭喜，你已完成 <strong>{scenario.title}</strong>。<br />
                实战经验值与能力勋章已同步至你的工业基因。
              </div>

              <div style={{ display: 'flex', gap: 32 }}>
                <div style={{ width: 260, padding: '40px 24px', borderRadius: 32, background: 'white', border: '2px solid #e2e8f0', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#2563eb', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace' }}>EXPERIENCE</div>
                  <div style={{ fontSize: 42, fontWeight: 900, color: '#1e293b' }}>+{scenario.xpReward + (quizScore === scenario.quiz.length ? 50 : 0)} XP</div>
                </div>
                <div style={{ width: 260, padding: '40px 24px', borderRadius: 32, background: 'white', border: '2px solid #e2e8f0', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.03)' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#10b981', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace' }}>ACCURACY</div>
                  <div style={{ fontSize: 42, fontWeight: 900, color: '#1e293b' }}>{Math.round((quizScore / scenario.quiz.length) * 100)}%</div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="mission-modal-footer">
          {step < 3 && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>
              TERMINATE_MISSION_INST_0x4F
            </button>
          )}

          <div style={{ flex: 1 }} />

          {step === 0 && (
            <button className="btn btn-primary" style={{ height: 60, padding: '0 48px', borderRadius: 20, fontSize: 16, fontWeight: 900, boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)', letterSpacing: '0.02em' }}
              onClick={() => setStep(1)}>
              BEYOND THE BASICS <ChevronRight size={20} />
            </button>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                onClick={validateCode}
                style={{ height: 60, padding: '0 32px', borderRadius: 20, border: '2px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 800, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <Play size={18} /> RUN_VALIDATION
              </button>
              <button
                className="btn btn-primary"
                style={{ height: 60, padding: '0 40px', borderRadius: 20, fontSize: 16, fontWeight: 900, opacity: codeStatus === 'success' ? 1 : 0.4, transition: 'all 0.3s', boxShadow: codeStatus === 'success' ? '0 8px 24px rgba(37, 99, 235, 0.25)' : 'none' }}
                disabled={codeStatus !== 'success'}
                onClick={() => setStep(2)}>
                QUIZ_AUTHORIZATION <ChevronRight size={18} />
              </button>
            </div>
          )}

          {step === 2 && !quizSubmitted && (
            <button
              onClick={submitQuiz}
              disabled={quizAnswers.some(a => a === -1)}
              className="btn btn-primary"
              style={{ height: 60, padding: '0 48px', borderRadius: 20, fontSize: 16, fontWeight: 900, opacity: quizAnswers.some(a => a === -1) ? 0.4 : 1 }}>
              SUBMIT_EVALUATION
            </button>
          )}

          {step === 2 && quizSubmitted && (
            <div style={{ display: 'flex', gap: 16 }}>
              {quizScore < Math.ceil(scenario.quiz.length * 2 / 3) ? (
                <button
                  onClick={() => { setQuizAnswers(Array(scenario.quiz.length).fill(-1)); setQuizSubmitted(false); setQuizScore(0); }}
                  style={{ height: 60, padding: '0 32px', borderRadius: 20, border: '2px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: 800, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <RotateCcw size={16} /> REBOOT_QUIZ
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ height: 60, padding: '0 48px', borderRadius: 20, fontSize: 16, fontWeight: 900, boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)' }}
                  onClick={finishMission}>
                  <Award size={20} /> CLAIM_REWARDS
                </button>
              )}
            </div>
          )}

          {step === 3 && (
            <button
              className="btn btn-primary"
              style={{ height: 60, padding: '0 48px', borderRadius: 20, fontSize: 16, fontWeight: 900, boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)' }}
              onClick={onClose}>
              RETURN_TO_BASE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SkillMissionModal;
