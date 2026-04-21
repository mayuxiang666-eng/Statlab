import React, { useState, useEffect, useRef } from 'react';
import {
   ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, CheckCircle,
   ChevronRight, Database, Info, Layout, Layers,
   Lightbulb, Lock, Play, Search, Settings,
   Target, Trophy, Zap, Cpu, MousePointer2,
   GitMerge, Share2, Terminal, Plus, Minus,
   MessageSquare, Sliders, Boxes, Link as LinkIcon,
   Globe, Shield, FlaskConical, FileText, Sparkles,
   Command, Wand2, Network, Cpu as Brain, Move, Loader2,
   ExternalLink, Hammer, Workflow, Activity, Gauge,
   Eye, RefreshCw, Send, ClipboardCheck, History,
   Compass, Map, Crosshair, Package, Code, Copy,
   Quote, Star, Award, Book, BrainCircuit, Rocket,
   Lightbulb as Idea, TerminalSquare, Github, Trash2, Link
} from 'lucide-react';
import { ConfigProvider, Progress, Tag, Modal, Slider, Switch, Tooltip, Empty, Button, Tabs, message, Card, Badge, Input, Segmented, Row, Col, Space, Form, Popconfirm } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { useAuth } from './context/AuthContext';
import { GEN_AI_LESSONS, GenAiLesson, VIBE_PROMPTS, VibePrompt, GithubProject, INITIAL_GITHUB_PROJECTS } from './GenAiCourseData';

// --- Premium Design Tokens (StatLab Industrial Standard) ---
const PRIMARY = '#7c3aed'; // Deep Violet
const SUCCESS = '#10b981';
const WARNING = '#f59e0b';
const BG_LIGHT = '#f8fafc';
const SURFACE = '#ffffff';
const BORDER = '#e2e8f0';
const TEXT_HERO = '#0f172a';
const TEXT_BODY = '#475569';
const ACCENT_GLOW = 'rgba(124, 58, 237, 0.05)';

const STORAGE_KEY = 'statlab_genai_progress_final';

interface ProgressState {
   completed: string[];
   score: number;
   quality: Record<string, { quizScore: number; passed: boolean }>;
}

export default function GenAiLab() {
   const { user, token } = useAuth();
   const userId = user?.id || 'guest';

   const [progress, setProgress] = useState<ProgressState>({ completed: [], score: 0, quality: {} });
   const [selection, setSelection] = useState<{ lesson: GenAiLesson | null; mode: 'learn' | 'quiz' }>({ lesson: null, mode: 'learn' });
   const [activeTab, setActiveTab] = useState('curriculum');
   const [quizResults, setQuizResults] = useState<Record<string, { selected: number; correct: boolean }>>({});
   const [showResultModal, setShowResultModal] = useState(false);
   const [projects, setProjects] = useState<GithubProject[]>(INITIAL_GITHUB_PROJECTS);
   const [showProjectModal, setShowProjectModal] = useState(false);
   const [lessons, setLessons] = useState<GenAiLesson[]>(GEN_AI_LESSONS);
   const [showEditModal, setShowEditModal] = useState(false);
   const [editingLesson, setEditingLesson] = useState<GenAiLesson | null>(null);
   const [editingProject, setEditingProject] = useState<GithubProject | null>(null);
   const [form] = Form.useForm();
   const [editForm] = Form.useForm();
   const containerRef = useRef<HTMLDivElement>(null);
   const isAdmin = user?.username === 'admin' || user?.username === 'root';

   const getStorageKey = () => `${STORAGE_KEY}_${userId}`;
   const getAuthHeader = () => token ? { Authorization: `Bearer ${token}` } : {};

   useEffect(() => {
      const loadData = async () => {
         const userKey = getStorageKey();
         const localSaved = localStorage.getItem(userKey);
         const localData: ProgressState = localSaved ? JSON.parse(localSaved) : { completed: [], score: 0, quality: {} };

         // Fetch Lessons
         try {
            const res = await axios.get('/api/learning/lessons');
            if (res.data && Array.isArray(res.data)) {
               setLessons(res.data);
            }
         } catch (err) {
            console.error("Fetch lessons failed", err);
         }

         // Fetch GitHub Projects
         try {
            const projRes = await axios.get('/api/github-projects');
            if (projRes.data && Array.isArray(projRes.data)) {
               setProjects(prev => {
                  // Merge: API projects first, then any local-only defaults not in API
                  const apiIds = new Set(projRes.data.map((p: any) => p.url));
                  const localOnly = INITIAL_GITHUB_PROJECTS.filter(p => !apiIds.has(p.url));
                  return [...projRes.data, ...localOnly];
               });
            }
         } catch (err) {
            console.error("Fetch projects failed", err);
         }

         if (token && user) {
            try {
               const res = await axios.get('/api/learning/progress', { headers: getAuthHeader() });
               const remoteData = res.data;
               const merged: ProgressState = {
                  completed: Array.from(new Set([...(remoteData.completed || []), ...(localData.completed || [])])),
                  score: Math.max(remoteData.score || 0, localData.score || 0),
                  quality: { ...(remoteData.quality || {}), ...(localData.quality || {}) }
               };
               setProgress(merged);
               localStorage.setItem(userKey, JSON.stringify(merged));
            } catch (err) {
               setProgress(localData);
            }
         } else {
            setProgress(localData);
         }
      };
      loadData();
   }, [userId, token]);

   const persistProgress = async (next: ProgressState) => {
      setProgress(next);
      localStorage.setItem(getStorageKey(), JSON.stringify(next));
      if (token && user) {
         try {
            await axios.post('/api/learning/progress', next, { headers: getAuthHeader() });
         } catch (err) {
            console.error("Sync failed", err);
         }
      }
   };

   const handleStartLesson = (lesson: GenAiLesson) => {
      setSelection({ lesson, mode: 'learn' });
      setQuizResults({});
      if (containerRef.current) containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
   };

   const isLessonUnlocked = (lesson: GenAiLesson) => {
      if (isAdmin) return true;
      if (lesson.stage === 1) return true;
      const prevId = lessons.find(l => l.stage === lesson.stage - 1)?.id;
      return prevId ? progress.completed.includes(prevId) : true;
   };

   const finishQuiz = () => {
      if (!selection.lesson) return;
      const questions = selection.lesson.quiz || [];
      const correctCount = questions.filter(q => quizResults[q.id]?.correct).length;
      const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
      const passed = score >= 80;

      const isFirstTime = !progress.completed.includes(selection.lesson.id);
      const nextProgress = {
         ...progress,
         completed: passed && isFirstTime ? [...progress.completed, selection.lesson.id] : progress.completed,
         score: passed && isFirstTime ? progress.score + selection.lesson.points : progress.score,
         quality: {
            ...progress.quality,
            [selection.lesson.id]: { quizScore: Math.max(progress.quality[selection.lesson.id]?.quizScore || 0, score), passed: passed || progress.quality[selection.lesson.id]?.passed || false }
         }
      };
      persistProgress(nextProgress);
      setShowResultModal(true);
   };

   const handleUpdateLesson = async (values: any) => {
      if (!editingLesson) return;
      try {
         const res = await axios.post(`/api/learning/lessons/${editingLesson.id}`, values, { headers: getAuthHeader() });
         if (res.data.ok) {
            message.success('课程内容已更新');
            const updatedLessons = lessons.map(l => l.id === editingLesson.id ? { ...l, ...values } : l);
            setLessons(updatedLessons);
            if (selection.lesson?.id === editingLesson.id) {
               setSelection({ ...selection, lesson: { ...selection.lesson, ...values } as GenAiLesson });
            }
            setShowEditModal(false);
         }
      } catch (err) {
         message.error('更新失败');
      }
   };

   const openEditModal = (lesson: GenAiLesson) => {
      setEditingLesson(lesson);
      editForm.setFieldsValue({
         titleZh: lesson.titleZh,
         titleEn: lesson.titleEn,
         objectiveZh: lesson.objectiveZh,
         contentZh: lesson.contentZh
      });
      setShowEditModal(true);
   };

   // --- Analogy Displays ---

   const PromptSimulation = () => {
      const [detail, setDetail] = useState(30);
      return (
         <Card style={{ borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.03)', border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: 40 }}>
               <div>
                  <Tag color="purple">VIBE CONTROLLER</Tag>
                  <h3 style={{ fontSize: 22, fontWeight: 900, margin: '16px 0' }}>指令精确度调节</h3>
                  <p style={{ color: TEXT_BODY, fontSize: 13, marginBottom: 32 }}>调整滑块：看提示词如何从“模糊意图”进化为“生产级蓝图”。</p>
                  <Slider value={detail} onChange={setDetail} trackStyle={{ background: PRIMARY }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: TEXT_BODY, fontWeight: 800, marginTop: 12 }}>
                     <span>基础描述</span>
                     <span>RTF 专家框架</span>
                  </div>
               </div>
               <div style={{ background: '#0f172a', borderRadius: 20, padding: 32, color: '#fff', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: PRIMARY, animation: 'scan-x 2s infinite' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, opacity: 0.6 }}>
                     <Terminal size={14} /> <span style={{ fontSize: 11, fontWeight: 900 }}>PROMPT_ENGINE_V4</span>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.8, fontFamily: 'monospace', color: '#cbd5e1' }}>
                     {detail < 40 ? "“帮我写一段 PLC 故障分析代码。”" :
                        detail < 80 ? "“你是一位高级诊断工程师。请针对西门子 S7-1500 报警日志，利用 Python 生成一份包含异常趋势分析的报告。”" :
                           "【角色】：资深系统架构师\n【任务】：基于 ReAct 循环执行深度协议诊断\n【上下文】：MySQL 8.0 持久化，MQTT 实时流\n【格式】：带 plan.md 架构规划的 JSON 输出。"}
                  </div>
                  <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', color: SUCCESS, fontWeight: 900, fontSize: 18 }}>
                     {detail > 80 ? '✓ 进入 Vibe Coding 深度对齐模式' : '✓ 指令已就绪'}
                  </div>
               </div>
            </div>
         </Card>
      );
   };

   const AgentThinkingLoop = () => {
      const [step, setStep] = useState(0);
      const steps = [
         { t: 'Thought', d: '“用户需要对比能耗。我需要先访问库房数据库。”', icon: <Brain /> },
         { t: 'Action', d: '执行：sql_query(\"SELECT * FROM power_logs\")', icon: <TerminalSquare /> },
         { t: 'Observation', d: '获取结果：[20.5, 22.1, 19.8] ... 振动异常！', icon: <Search /> },
         { t: 'Result', d: '“已生成分析结果：周三 14:00 电压波动剧烈。”', icon: <CheckCircle /> }
      ];
      useEffect(() => {
         const timer = setInterval(() => setStep(s => (s + 1) % 4), 3000);
         return () => clearInterval(timer);
      }, []);
      return (
         <Card style={{ borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.03)', border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
               {steps.map((s, idx) => (
                  <div key={idx} style={{
                     width: 180, padding: 24, borderRadius: 20, textAlign: 'center', transition: '0.4s',
                     background: idx === step ? ACCENT_GLOW : 'transparent',
                     border: `2px solid ${idx === step ? PRIMARY : 'transparent'}`,
                     transform: idx === step ? 'translateY(-10px)' : 'none'
                  }}>
                     <div style={{ margin: '0 auto 12px', color: idx === step ? PRIMARY : '#94a3b8' }}>{s.icon}</div>
                     <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 8, color: idx === step ? PRIMARY : TEXT_BODY }}>{s.t}</div>
                     <div style={{ fontSize: 11, color: TEXT_BODY, lineHeight: 1.5 }}>{s.d}</div>
                  </div>
               ))}
            </div>
         </Card>
      );
   };

   const RagNexus = () => {
      const [searching, setSearching] = useState(false);
      const [found, setFound] = useState(false);

      const startSearch = () => {
         setSearching(true);
         setFound(false);
         setTimeout(() => {
            setSearching(false);
            setFound(true);
         }, 2000);
      };

      return (
         <Card style={{ borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.03)', border: `1px solid ${BORDER}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 40, alignItems: 'center' }}>
               <div>
                  <Tag color="blue">KNOWLEDGE RETRIEVAL</Tag>
                  <h3 style={{ fontSize: 22, fontWeight: 900, margin: '16px 0' }}>RAG 知识检索联动</h3>
                  <p style={{ color: TEXT_BODY, fontSize: 13, marginBottom: 24 }}>点击搜索，观察 AI 如何从私有向量库寻找准确答案。</p>
                  <Button type="primary" icon={searching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />} onClick={startSearch} disabled={searching} style={{ background: PRIMARY, borderRadius: 12, height: 44, padding: '0 24px', fontWeight: 900 }}>
                     {searching ? '正在遍历高维向量空间...' : '开始私有知识检索'}
                  </Button>
               </div>
               <div style={{ background: BG_LIGHT, borderRadius: 24, height: 200, position: 'relative', overflow: 'hidden', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {/* Vector Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 8, opacity: 0.2 }}>
                     {Array.from({ length: 50 }).map((_, i) => (
                        <div key={i} style={{ width: 10, height: 10, borderRadius: 2, background: TEXT_HERO }} />
                     ))}
                  </div>

                  {searching && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.1), transparent)', animation: 'scan-x 1.5s infinite' }} />}

                  {found && (
                     <div className="animate-fade" style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ padding: '12px 20px', background: SURFACE, borderRadius: 16, border: `2px solid ${SUCCESS}`, boxShadow: '0 10px 20px rgba(16,185,129,0.1)', fontWeight: 900, color: TEXT_HERO, fontSize: 14 }}>
                           找寻到匹配文档：维修手册-P402
                        </div>
                        <ArrowRight size={24} color={SUCCESS} style={{ transform: 'rotate(90deg)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: PRIMARY, fontWeight: 900 }}>
                           <Brain /> 注入 AI 上下文
                        </div>
                     </div>
                  )}
               </div>
            </div>
         </Card>
      );
   };

   const SkillWorkshop = () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
         {[
            { name: 'Python Processor', icon: <Terminal />, color: '#3776ab', desc: '处理复杂数学与数据清洗' },
            { name: 'SQL Query Tool', icon: <Database />, color: '#4479a1', desc: '实时抓取 ERP 业务数据' },
            { name: 'Messenger API', icon: <Send />, color: '#0088cc', desc: '自动通过飞书/邮件发送告警' }
         ].map(s => (
            <Card key={s.name} hoverable style={{ borderRadius: 20, textAlign: 'center', padding: '10px 0' }}>
               <div style={{ color: s.color, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
               <div style={{ fontWeight: 900, marginBottom: 4 }}>{s.name}</div>
               <div style={{ fontSize: 11, color: TEXT_BODY }}>{s.desc}</div>
            </Card>
         ))}
      </div>
   );

   const McpHub = () => (
      <Card style={{ borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.03)', border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'radial-gradient(#7c3aed 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 40 }}>
               <div style={{ width: 80, height: 80, borderRadius: 24, background: SURFACE, border: `2px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(0,0,0,0.05)' }}>
                  <Database color="#334155" />
               </div>
               <div style={{ width: 120, height: 4, background: `linear-gradient(90deg, ${BORDER}, ${PRIMARY}, ${BORDER})`, position: 'relative' }}>
                  <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: PRIMARY, color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 900 }}>MCP TUNNEL</div>
               </div>
               <div style={{ width: 100, height: 100, borderRadius: '50%', background: PRIMARY, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 30px ${PRIMARY}44` }}>
                  <Brain size={40} />
               </div>
            </div>
         </div>
         <div style={{ textAlign: 'center', padding: '0 0 20px', fontSize: 13, fontWeight: 800, color: TEXT_BODY }}>
            “即插即用”：AI 通过 MCP 协议直接感知外部数据架构
         </div>
      </Card>
   );

   const OrchestrationFlow = () => {
      const [activeStage, setActiveStage] = useState(0);
      const flowStages = [
         { id: 'perceive', label: '感知 (Sensor)', icon: <Activity />, desc: '感知物理世界异常 (IoT / Alerts)', color: '#3b82f6' },
         { id: 'retrieve', label: '增强 (RAG/MCP)', icon: <Layers />, desc: '抓取实时参数与手册知识', color: '#10b981' },
         { id: 'plan', label: '决策 (Brain)', icon: <Brain />, desc: 'Agent 制定分步行动方案', color: PRIMARY },
         { id: 'act', label: '执行 (Skills)', icon: <Rocket />, desc: '通过 API 完成物理世界干预', color: '#f59e0b' }
      ];

      useEffect(() => {
         const interval = setInterval(() => setActiveStage(s => (s + 1) % 4), 4000);
         return () => clearInterval(interval);
      }, []);

      return (
         <Card style={{ borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.03)', border: `1px solid ${BORDER}`, padding: 40, background: '#0f172a', color: '#fff' }}>
            <div style={{ position: 'relative', height: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
               {/* SVG Connecting Paths */}
               <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
                  <defs>
                     <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(124,58,237,0)" />
                        <stop offset="50%" stopColor={PRIMARY} />
                        <stop offset="100%" stopColor="rgba(124,58,237,0)" />
                     </linearGradient>
                  </defs>
                  {/* Horizontal line for progress */}
                  <line x1="10%" y1="50%" x2="90%" y2="50%" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                  {activeStage < 3 && (
                     <circle r="4" fill={PRIMARY}>
                        <animateMotion dur="4s" repeatCount="indefinite" path={`M ${10 + activeStage * 26}% 50% L ${10 + (activeStage + 1) * 26}% 50%`} />
                     </circle>
                  )}
               </svg>

               <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', zIndex: 2 }}>
                  {flowStages.map((stage, idx) => (
                     <div key={stage.id} style={{
                        textAlign: 'center', width: 200, transition: '0.6s',
                        transform: activeStage === idx ? 'scale(1.1) translateY(-10px)' : 'scale(1)',
                        opacity: activeStage === idx ? 1 : 0.4
                     }}>
                        <div style={{
                           width: 80, height: 80, borderRadius: 24, background: activeStage === idx ? stage.color : 'rgba(255,255,255,0.05)',
                           display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
                           boxShadow: activeStage === idx ? `0 0 30px ${stage.color}66` : 'none', color: '#fff', border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                           {stage.icon}
                        </div>
                        <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>{stage.label}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{stage.desc}</div>
                     </div>
                  ))}
               </div>

               {/* SYNERGY DETAIL CARD */}
               <div className="animate-fade" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '24px 32px', borderRadius: 24, marginTop: 40, width: '100%', display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ color: flowStages[activeStage].color }}><Info size={24} /></div>
                  <div>
                     <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: 1 }}>CASE: 产线异常全闭环流程</div>
                     <div style={{ fontSize: 15, fontWeight: 700 }}>
                        {activeStage === 0 ? "1. 传感器发现 5 号电机电流波形异常 -> 触发 Agent" :
                           activeStage === 1 ? "2. Agent 通过 MCP 读取实时电流，通过 RAG 查阅维修手册匹配故障模式" :
                              activeStage === 2 ? "3. 确认为电刷磨损，Agent 自动制定‘停机更换并下账零件’方案" :
                                 "4. 调用技能 API 发送通知、修改生产计划、自动补货 -> 任务达成"}
                     </div>
                  </div>
               </div>
            </div>
         </Card>
      );
   };

   const renderAnalogy = (type: string) => {
      switch (type) {
         case 'prompt': return <PromptSimulation />;
         case 'agent': return <AgentThinkingLoop />;
         case 'rag': return <RagNexus />;
         case 'skill': return <SkillWorkshop />;
         case 'mcp': return <McpHub />;
         case 'orchestration': return <OrchestrationFlow />;
         case 'evolution': return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
               {['2017 Transformer', '2020 GPT-3', '2022 ChatGPT', '2024 Agents'].map(t => (
                  <div key={t} style={{ padding: 24, borderRadius: 20, background: SURFACE, border: `1px solid ${BORDER}`, textAlign: 'center', fontWeight: 900, color: PRIMARY, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>{t}</div>
               ))}
            </div>
         );
         default: return <Empty description="交互组件加载中..." />;
      }
   };

   const handleCopy = (text: string) => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
         navigator.clipboard.writeText(text)
            .then(() => message.success('提示词已复制到剪贴板'))
            .catch(() => {
               // Fallback if writeText fails
               const textArea = document.createElement("textarea");
               textArea.value = text;
               document.body.appendChild(textArea);
               textArea.select();
               try {
                  document.execCommand('copy');
                  message.success('提示词已复制到剪贴板');
               } catch (err) {
                  message.error('复制失败，请手动选择复制');
               }
               document.body.removeChild(textArea);
            });
      } else {
         // Fallback for insecure contexts or unsupported browsers
         const textArea = document.createElement("textarea");
         textArea.value = text;
         document.body.appendChild(textArea);
         textArea.select();
         try {
            document.execCommand('copy');
            message.success('提示词已复制到剪贴板');
         } catch (err) {
            message.error('复制失败，请手动选择复制');
         }
         document.body.removeChild(textArea);
      }
   };

   const VibeCodingGallery = () => {
      const [searchTerm, setSearchTerm] = useState('');
      const [category, setCategory] = useState('全部');

      const categories = ['全部', '编程', '元提示词', '学习教育', '内容创作', '生产力', '商业分析'];

      const filteredPrompts = VIBE_PROMPTS.filter(p => {
         const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.prompt.toLowerCase().includes(searchTerm.toLowerCase());
         const matchesCategory = category === '全部' || p.category === category;
         return matchesSearch && matchesCategory;
      });

      return (
         <div style={{ padding: '0 40px 100px', animation: 'fadeIn 0.6s ease' }}>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
               <Tag color="cyan" style={{ marginBottom: 12 }}>COMMUNITY RESOURCES</Tag>
               <h2 style={{ fontSize: 36, fontWeight: 900, color: TEXT_HERO }}>Vibe Coding 提示词实验室</h2>
               <p style={{ color: TEXT_BODY, fontSize: 18, maxWidth: 800, margin: '20px auto' }}>源自 Vibe-Coding-CN，汇集最前沿的 AI 共鸣提示词，帮你跨越从“想法”到“工程”的鸿沟。</p>
            </div>

            <div style={{ maxWidth: 1000, margin: '0 auto 60px', background: SURFACE, padding: '32px 40px', borderRadius: 32, border: `1px solid ${BORDER}`, boxShadow: '0 10px 30px rgba(0,0,0,0.02)' }}>
               <Row gutter={24} align="middle">
                  <Col span={24} lg={8} style={{ marginBottom: 16 }}>
                     <Input 
                        prefix={<Search size={18} color={TEXT_BODY} />} 
                        placeholder="搜索提示词标题或内容..." 
                        size="large"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ borderRadius: 16, border: `1px solid ${BORDER}`, height: 52 }}
                     />
                  </Col>
                  <Col span={24} lg={16}>
                     <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                        <Segmented 
                           options={categories} 
                           value={category} 
                           onChange={v => setCategory(v as string)}
                           size="large"
                           style={{ padding: 6, borderRadius: 16, background: BG_LIGHT, width: 'max-content', minWidth: '100%' }}
                        />
                     </div>
                  </Col>
               </Row>
            </div>

            {filteredPrompts.length > 0 ? (
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 32 }}>
                  {filteredPrompts.map((p, idx) => (
                     <div key={idx} className="vibe-card" style={{ background: SURFACE, borderRadius: 32, border: `1px solid ${BORDER}`, padding: 40, transition: '0.4s', cursor: 'default' }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                           <Tag color="purple">{p.category?.toUpperCase() || 'GENERAL'}</Tag>
                           <Tag color="blue">{p.title.length > 10 ? 'EXPERT' : 'CORE'}</Tag>
                        </div>
                        <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16, color: TEXT_HERO }}>{p.title}</h3>
                        <div style={{ background: BG_LIGHT, borderRadius: 20, padding: 24, position: 'relative', border: '1px solid #e2e8f0', minHeight: 120 }}>
                           <div style={{ 
                              fontSize: 13, 
                              fontFamily: 'var(--font-mono)', 
                              lineHeight: 1.7, 
                              color: TEXT_BODY,
                              display: '-webkit-box',
                              WebkitLineClamp: 10,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                           }}>
                              {p.prompt}
                           </div>
                           <button
                              onClick={() => handleCopy(p.prompt)}
                              style={{ 
                                 marginTop: 20,
                                 background: SURFACE, 
                                 border: `1px solid ${BORDER}`, 
                                 borderRadius: 10, 
                                 padding: '8px 16px', 
                                 cursor: 'pointer', 
                                 display: 'flex', 
                                 alignItems: 'center', 
                                 gap: 8, 
                                 fontSize: 12, 
                                 fontWeight: 900, 
                                 color: PRIMARY, 
                                 boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                 transition: '0.2s'
                              }}
                              onMouseOver={e => e.currentTarget.style.background = ACCENT_GLOW}
                              onMouseOut={e => e.currentTarget.style.background = SURFACE}
                           >
                              <Copy size={13} /> COPY FULL PROMPT
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            ) : (
               <Empty description="未找到匹配的提示词" style={{ padding: 100 }} />
            )}
         </div>
      );
   };

   const GithubProjectPlaza = () => (
      <div style={{ padding: '0 40px 100px', animation: 'fadeIn 0.6s ease' }}>
         <div style={{ textAlign: 'center', marginBottom: 80, position: 'relative' }}>
            <Tag color="gold" style={{ marginBottom: 12 }}>COMMUNITY HUB</Tag>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: TEXT_HERO }}>GitHub 项目广场</h2>
            <p style={{ color: TEXT_BODY, fontSize: 18, maxWidth: 800, margin: '20px auto' }}>分享你的创新成果，让社区的力量助你一臂之力。每个人都可以是贡献者。</p>
            
            <Button 
               type="primary" 
               size="large" 
               icon={<Plus size={18} />}
               onClick={() => setShowProjectModal(true)}
               style={{ 
                  marginTop: 24, 
                  height: 52, 
                  borderRadius: 16, 
                  padding: '0 32px', 
                  fontWeight: 900, 
                  background: PRIMARY,
                  boxShadow: `0 8px 24px ${PRIMARY}44`
               }}
            >
               分享我的项目
            </Button>
         </div>

         <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 32 }}>
            {projects.map((proj, idx) => (
               <Card 
                  key={proj.id || idx} 
                  hoverable 
                  style={{ borderRadius: 32, border: `1px solid ${BORDER}`, padding: 12 }}
                  bodyStyle={{ padding: 24 }}
               >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                     <Tag color="orange" bordered={false} style={{ borderRadius: 6, fontWeight: 800 }}>{proj.category}</Tag>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {(isAdmin || proj.userId === userId) && (
                           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              <div 
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProject(proj);
                                    form.setFieldsValue({
                                       ...proj,
                                       tags: proj.tags.join(', ')
                                    });
                                    setShowProjectModal(true);
                                 }}
                                 style={{ color: TEXT_BODY, cursor: 'pointer', opacity: 0.6, display: 'flex', alignItems: 'center' }}
                              >
                                 <Settings size={14} />
                              </div>
                              <Popconfirm
                                 title="确定要删除这个项目吗？"
                                 onConfirm={async (e) => {
                                    e?.stopPropagation();
                                    try {
                                       const res = await axios.delete(`/api/github-projects/${proj.id}`, { headers: getAuthHeader() });
                                       if (res.data.ok) {
                                          setProjects(projects.filter(p => p.id !== proj.id));
                                          message.success('删除成功');
                                       }
                                    } catch (err) {
                                       message.error('删除失败');
                                    }
                                 }}
                                 onCancel={(e) => e?.stopPropagation()}
                                 okText="确定"
                                 cancelText="取消"
                              >
                                 <div 
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ color: '#ff4d4f', cursor: 'pointer', opacity: 0.6, display: 'flex', alignItems: 'center' }}
                                 >
                                    <Trash2 size={14} />
                                 </div>
                              </Popconfirm>
                           </div>
                        )}
                        <div style={{ color: TEXT_BODY, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                           <Share2 size={12} /> {proj.author}
                        </div>
                     </div>
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, color: TEXT_HERO, marginBottom: 16 }}>{proj.title}</h3>
                  <p style={{ color: TEXT_BODY, fontSize: 14, lineHeight: 1.6, marginBottom: 24, minHeight: 45 }}>{proj.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
                     {proj.tags.map(t => <Tag key={t} style={{ borderRadius: 6, background: BG_LIGHT, border: 'none', color: TEXT_BODY, fontSize: 11 }}>{t}</Tag>)}
                  </div>
                  <Button 
                     block 
                     type="default" 
                     icon={<ExternalLink size={16} />}
                     href={proj.url}
                     target="_blank"
                     style={{ height: 48, borderRadius: 14, fontWeight: 800, border: `1px solid ${BORDER}` }}
                  >
                     访问仓库
                  </Button>
               </Card>
            ))}
         </div>

         <Modal
            title={<div style={{ fontSize: 22, fontWeight: 900, padding: '10px 0' }}>{editingProject ? '编辑分享内容' : '分享你的创新项目'}</div>}
            open={showProjectModal}
            onCancel={() => {
               setShowProjectModal(false);
               setEditingProject(null);
               form.resetFields();
            }}
            footer={null}
            width={600}
            centered
            bodyStyle={{ padding: '20px 40px 40px' }}
            style={{ borderRadius: 32 }}
         >
            <Form 
               form={form} 
               layout="vertical" 
               onFinish={async (v) => {
                  try {
                     const payload = {
                        ...v,
                        tags: v.tags ? (Array.isArray(v.tags) ? v.tags : v.tags.split(',').map((s: string) => s.trim())) : []
                     };
                     
                     if (editingProject) {
                        const res = await axios.put(`/api/github-projects/${editingProject.id}`, payload, { headers: getAuthHeader() });
                        if (res.data.ok) {
                           setProjects(projects.map(p => p.id === editingProject.id ? { ...p, ...payload } : p));
                           message.success('修改成功');
                        }
                     } else {
                        const res = await axios.post('/api/github-projects', payload, { headers: getAuthHeader() });
                        if (res.data.ok) {
                           const newProj: GithubProject = {
                              ...payload,
                              id: res.data.id,
                              author: user?.username || '匿名用户',
                              userId: userId
                           };
                           setProjects([newProj, ...projects]);
                           message.success('分享成功！项目已保存至数据库');
                        }
                     }
                     setShowProjectModal(false);
                     setEditingProject(null);
                     form.resetFields();
                  } catch (err) {
                     message.error(editingProject ? '更新失败' : '分享失败');
                  }
               }}
            >
               <Form.Item name="title" label="项目名称" rules={[{ required: true }]}>
                  <Input placeholder="例如: StatLab-AutoGPT" style={{ borderRadius: 12, height: 48 }} />
               </Form.Item>
               <Form.Item name="category" label="项目类别" rules={[{ required: true }]}>
                  <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
                     <Segmented options={['编程', '生产力', '科研', '内容', '其他']} size="large" style={{ borderRadius: 10, padding: 4, width: 'max-content', minWidth: '100%' }} />
                  </div>
               </Form.Item>
               <Form.Item name="tags" label="关键词 (逗号分隔)" rules={[{ required: true }]}>
                  <Input placeholder="React, Python, AI" style={{ borderRadius: 12, height: 48 }} />
               </Form.Item>
               <Form.Item name="url" label="项目/仓库链接" rules={[{ required: true, type: 'url' }]}>
                  <Input placeholder="请粘贴 GitHub 仓库或网页链接..." style={{ borderRadius: 12, height: 48 }} />
               </Form.Item>
               <Form.Item name="description" label="项目简介" rules={[{ required: true }]}>
                  <Input.TextArea rows={4} placeholder="简单描述一下你的项目功能与特色..." style={{ borderRadius: 12 }} />
               </Form.Item>
               <Button type="primary" htmlType="submit" block size="large" style={{ height: 56, borderRadius: 16, fontWeight: 900, marginTop: 20 }}>
                  提交分享
               </Button>
            </Form>
         </Modal>
      </div>
   );

   const CurriculumList = () => (
      <div style={{ maxWidth: 1200, margin: '60px auto', padding: '0 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 32 }}>
         {lessons.map(l => {
            const unlocked = isLessonUnlocked(l);
            const completed = progress.completed.includes(l.id);
            return (
               <div
                  key={l.id}
                  onClick={() => unlocked && handleStartLesson(l)}
                  className="lesson-card"
                  style={{
                     background: SURFACE, padding: 40, borderRadius: 32, border: `2px solid ${completed ? PRIMARY : BORDER}`,
                     cursor: unlocked ? 'pointer' : 'default', transition: '0.4s', position: 'relative',
                     boxShadow: completed ? `0 12px 40px ${PRIMARY}15` : '0 2px 4px rgba(0,0,0,0.02)',
                     opacity: unlocked ? 1 : 0.6
                  }}
               >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' }}>
                     <div style={{ width: 48, height: 48, borderRadius: 16, background: completed ? PRIMARY : BG_LIGHT, color: completed ? SURFACE : TEXT_BODY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 20 }}>{l.stage}</div>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {isAdmin && <Settings size={18} color={TEXT_BODY} style={{ cursor: 'pointer', opacity: 0.5 }} onClick={(e) => { e.stopPropagation(); openEditModal(l); }} />}
                        {completed && <CheckCircle size={22} color={SUCCESS} />}
                     </div>
                  </div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 16, color: TEXT_HERO, letterSpacing: '-0.01em' }}>{l.titleZh}</h3>
                  <p style={{ fontSize: 14, color: TEXT_BODY, lineHeight: 1.7 }}>{l.objectiveZh}</p>
                  <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${BG_LIGHT}`, display: 'flex', gap: 24, fontSize: 13, fontWeight: 800, color: TEXT_BODY }}>
                     <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={16} /> {l.duration}</span>
                     <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Trophy size={16} /> {l.points} XP</span>
                  </div>
                  {!unlocked && <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}><Lock color="#94a3b8" size={32} /></div>}
               </div>
            );
         })}
      </div>
   );

   const LessonDetailView = () => {
      const lesson = selection.lesson!;
      if (selection.mode === 'quiz') return renderQuiz();
      return (
         <div className="animate-fade" style={{ background: BG_LIGHT, minHeight: '100%', paddingBottom: 120 }}>
            {/* Top Sticky Header */}
            <div style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: '32px 40px', position: 'sticky', top: 0, zIndex: 10 }}>
               <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => setSelection({ lesson: null, mode: 'learn' })} style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 10, color: TEXT_BODY, fontWeight: 900, cursor: 'pointer', fontSize: 15 }}>
                     <ArrowLeft size={20} /> 返回课程大纲
                  </button>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                     {isAdmin && (
                        <Button 
                           ghost 
                           type="primary" 
                           size="small" 
                           icon={<Settings size={14} />} 
                           onClick={() => openEditModal(lesson)}
                           style={{ color: PRIMARY, borderColor: PRIMARY, borderRadius: 8, fontWeight: 800, marginRight: 12 }}
                        >
                           编辑本章内容
                        </Button>
                     )}
                     <Tag color="blue" bordered={false}>{lesson.chapter}</Tag>
                     <Tag color="purple" bordered={false}>DUR: {lesson.duration}</Tag>
                  </div>
               </div>
            </div>

            <div style={{ maxWidth: 1000, margin: '60px auto', padding: '0 40px' }}>
               <header style={{ marginBottom: 80 }}>
                  <h1 style={{ fontSize: 44, fontWeight: 900, color: TEXT_HERO, marginBottom: 24, letterSpacing: '-0.02em' }}>{lesson.titleZh}</h1>
                  <p style={{ fontSize: 20, color: TEXT_BODY, lineHeight: 1.8, maxWidth: 800 }}>{lesson.objectiveZh}</p>
               </header>

               <section style={{ marginBottom: 100 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: PRIMARY, letterSpacing: 2, marginBottom: 24 }}>INDUSTRIAL INTERACTION MODEL</div>
                  {renderAnalogy(lesson.analogyType)}
               </section>

               <Card style={{ padding: '60px 80px', borderRadius: 48, border: `1px solid ${BORDER}`, boxShadow: '0 40px 100px rgba(0,0,0,0.03)' }}>
                  <div className="markdown-academic">
                     <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {lesson.contentZh}
                     </ReactMarkdown>
                  </div>

                  <footer style={{ marginTop: 80, borderTop: `1px solid ${BORDER}`, paddingTop: 60 }}>
                     <button onClick={() => setSelection({ ...selection, mode: 'quiz' })} style={{ width: '100%', padding: '28px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 24, fontSize: 20, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, boxShadow: `0 12px 40px ${PRIMARY}44` }}>
                        完成本章考核并解锁下一阶段 <ArrowRight size={24} />
                     </button>
                  </footer>
               </Card>
            </div>
         </div>
      );
   };

   const renderQuiz = () => {
      const lesson = selection.lesson!;
      return (
         <div className="animate-fade" style={{ background: BG_LIGHT, minHeight: '100%', padding: '120px 40px' }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
               <div style={{ textAlign: 'center', marginBottom: 80 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: PRIMARY, marginBottom: 16 }}>PHASE ASSESSMENT</div>
                  <h2 style={{ fontSize: 36, fontWeight: 900, color: TEXT_HERO }}>知识深度测量：{lesson.titleZh}</h2>
               </div>
               {lesson.quiz.map((q, idx) => (
                  <div key={q.id} style={{ background: SURFACE, padding: 48, borderRadius: 32, border: `1px solid ${BORDER}`, marginBottom: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                     <div style={{ fontSize: 20, fontWeight: 800, color: TEXT_HERO, marginBottom: 32 }}>{idx + 1}. {q.questionZh}</div>
                     <div style={{ display: 'grid', gap: 14 }}>
                        {q.optionsZh.map((opt, oIdx) => {
                           const isSelected = quizResults[q.id]?.selected === oIdx;
                           return (
                              <div
                                 key={oIdx}
                                 onClick={() => setQuizResults({ ...quizResults, [q.id]: { selected: oIdx, correct: oIdx === q.correctIndex } })}
                                 style={{
                                    padding: '20px 24px', borderRadius: 16, cursor: 'pointer', transition: '0.2s',
                                    background: isSelected ? ACCENT_GLOW : BG_LIGHT,
                                    border: `2px solid ${isSelected ? PRIMARY : 'transparent'}`,
                                    fontWeight: isSelected ? 800 : 500,
                                    color: isSelected ? PRIMARY : TEXT_BODY
                                 }}
                              >
                                 {String.fromCharCode(65 + oIdx)}. {opt}
                              </div>
                           );
                        })}
                     </div>
                  </div>
               ))}
               <button
                  disabled={Object.keys(quizResults).length < lesson.quiz.length}
                  onClick={finishQuiz}
                  style={{ width: '100%', padding: '28px', background: PRIMARY, color: '#fff', borderRadius: 24, border: 'none', fontSize: 20, fontWeight: 900, cursor: 'pointer', opacity: Object.keys(quizResults).length < lesson.quiz.length ? 0.6 : 1 }}
               >
                  提交正式考核报告
               </button>
            </div>
            <Modal open={showResultModal} footer={null} closable={false} onCancel={() => { setShowResultModal(false); setSelection({ lesson: null, mode: 'learn' }); }} width={440}>
               <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ width: 80, height: 80, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                     <Award size={40} color={SUCCESS} />
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12 }}>模块技能验证通过</h2>
                  <p style={{ color: TEXT_BODY, marginBottom: 32 }}>恭喜！你已成功掌握“{lesson.titleZh}”核心原理，XP 积分已同步至云端。</p>
                  <button onClick={() => { setShowResultModal(false); setSelection({ lesson: null, mode: 'learn' }); }} style={{ width: '100%', padding: '14px', background: PRIMARY, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 900, fontSize: 16 }}>继续后续课程</button>
               </div>
            </Modal>
         </div>
      );
   };

   const AdminEditLessonModal = () => (
      <Modal 
         title={`管理员编辑: ${editingLesson?.titleZh}`} 
         open={showEditModal} 
         onCancel={() => setShowEditModal(false)} 
         onOk={() => editForm.submit()}
         width={1100}
         okText="保存修改 (Save Changes)"
         cancelText="取消"
         maskClosable={false}
         destroyOnClose
      >
         <Form form={editForm} layout="vertical" onFinish={handleUpdateLesson}>
            <Row gutter={20}>
               <Col span={12}>
                  <Form.Item name="titleZh" label="章节标题 (中文)" rules={[{ required: true }]}>
                     <Input size="large" style={{ borderRadius: 12 }} />
                  </Form.Item>
               </Col>
               <Col span={12}>
                  <Form.Item name="titleEn" label="章节标题 (English)" rules={[{ required: true }]}>
                     <Input size="large" style={{ borderRadius: 12 }} />
                  </Form.Item>
               </Col>
            </Row>
            <Form.Item name="objectiveZh" label="教学目标/简介" rules={[{ required: true }]}>
               <Input.TextArea rows={2} style={{ borderRadius: 12 }} />
            </Form.Item>
            <Form.Item name="contentZh" label="核心课程正文 (Markdown 格式)" rules={[{ required: true }]}>
               <Input.TextArea rows={20} style={{ borderRadius: 16, fontFamily: 'monospace', fontSize: 14 }} />
            </Form.Item>
         </Form>
      </Modal>
   );

   return (
      <div className="gen-ai-lab-wrapper" ref={containerRef} style={{ height: '100%', overflowY: 'auto', background: BG_LIGHT, scrollBehavior: 'smooth' }}>
         {selection.lesson ? <LessonDetailView /> : (
            <>
               <section style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: '120px 40px 60px' }}>
                  <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                        <Tag color="purple" icon={<BrainCircuit size={10} />} bordered={false} style={{ padding: '4px 12px', fontWeight: 900 }}>STATLAB INDUSTRIAL ACADEMY</Tag>
                        <h1 style={{ fontSize: 56, fontWeight: 900, color: TEXT_HERO, margin: '20px 0', letterSpacing: '-0.04em' }}>生成式 AI 实战实训</h1>
                        <div style={{ display: 'flex', gap: 40, marginTop: 48 }}>
                           <div onClick={() => setActiveTab('curriculum')} className={activeTab === 'curriculum' ? 'active-tab' : 'inactive-tab'}>
                              <Book size={20} /> 系统实训课程
                           </div>
                           <div onClick={() => setActiveTab('vibe')} className={activeTab === 'vibe' ? 'active-tab' : 'inactive-tab'}>
                              <Rocket size={20} /> Vibe Coding 提示词库
                           </div>
                           <div onClick={() => setActiveTab('plaza')} className={activeTab === 'plaza' ? 'active-tab' : 'inactive-tab'}>
                              <Github size={20} /> GitHub 项目广场
                           </div>
                        </div>
                     </div>
                     <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: TEXT_BODY, marginBottom: 8, opacity: 0.6 }}>PERSONAL PROGRESS</div>
                        <div style={{ fontSize: 64, fontWeight: 900, color: PRIMARY, letterSpacing: -2 }}>{progress.score} <span style={{ fontSize: 20, color: TEXT_BODY }}>XP</span></div>
                     </div>
                  </div>
               </section>
               {activeTab === 'curriculum' && <CurriculumList />}
               {activeTab === 'vibe' && <VibeCodingGallery />}
               {activeTab === 'plaza' && <GithubProjectPlaza />}
            </>
         )}
         <AdminEditLessonModal />

         <style>{`
         .gen-ai-lab-wrapper::-webkit-scrollbar { width: 8px; }
         .gen-ai-lab-wrapper::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
         
         .active-tab { font-size: 20px; fontWeight: 900; color: ${PRIMARY}; cursor: pointer; borderBottom: 4px solid ${PRIMARY}; paddingBottom: 16px; display: flex; align-items: center; gap: 12; }
         .inactive-tab { font-size: 20px; fontWeight: 900; color: ${TEXT_BODY}; cursor: pointer; paddingBottom: 16px; display: flex; align-items: center; gap: 12; transition: 0.2s; }
         .inactive-tab:hover { color: ${TEXT_HERO}; }
         
         .lesson-card:hover { transform: translateY(-10px); border-color: ${PRIMARY}; }
         .vibe-card:hover { border-color: ${PRIMARY}; transform: translateY(-8px); }
         
         .markdown-academic h1 { font-size: 32px; font-weight: 900; color: ${TEXT_HERO}; margin: 56px 0 28px; letter-spacing: -0.02em; }
         .markdown-academic h2 { font-size: 24px; font-weight: 900; color: ${TEXT_HERO}; margin: 48px 0 24px; border-bottom: 2px solid ${BG_LIGHT}; padding-bottom: 12px; }
         .markdown-academic p { font-size: 16px; line-height: 1.9; color: ${TEXT_BODY}; margin-bottom: 28px; }
         .markdown-academic blockquote { border-left: 8px solid ${PRIMARY}; background: ${ACCENT_GLOW}; padding: 32px 40px; border-radius: 20px; margin: 48px 0; color: ${TEXT_BODY}; font-style: italic; position: relative; }
         .markdown-academic blockquote::before { content: '“'; position: absolute; top: 10px; left: 10px; font-size: 60px; color: ${PRIMARY}; opacity: 0.1; }
         
         .markdown-academic table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 48px 0; border: 1px solid ${BORDER}; border-radius: 16px; overflow: hidden; }
         .markdown-academic th { background: ${BG_LIGHT}; padding: 16px 20px; text-align: left; font-weight: 900; color: ${TEXT_HERO}; border-bottom: 2px solid ${BORDER}; }
         .markdown-academic td { padding: 16px 20px; border-bottom: 1px solid ${BORDER}; font-size: 15px; color: TEXT_BODY; }
         .markdown-academic tr:last-child td { border-bottom: none; }
         
         .markdown-academic code { background: ${BG_LIGHT}; padding: 4px 10px; border-radius: 8px; font-family: var(--font-mono); color: ${PRIMARY}; font-weight: 600; font-size: 14px; }
         
         @keyframes scan-x { from { left: -100%; } to { left: 100%; } }
         @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
         :root { --font-mono: "JetBrains Mono", "Fira Code", monospace; }
       `}</style>
      </div>
   );
}
