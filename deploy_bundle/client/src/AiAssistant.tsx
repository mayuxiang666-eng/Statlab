import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, User, Send, X, Loader2, Sparkles, Scissors, Camera } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    image?: string; // base64 data URL
}

/* ─── Region Capture Overlay ─── */
function CaptureOverlay({ onCapture, onCancel }: {
    onCapture: (rect: DOMRect) => void;
    onCancel: () => void;
}) {
    const [start, setStart] = useState<{ x: number; y: number } | null>(null);
    const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
    const [phase, setPhase] = useState<'idle' | 'drawing' | 'done'>('idle');

    const getRect = () => {
        if (!start || !end) return null;
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        if (w < 10 || h < 10) return null;
        return new DOMRect(x, y, w, h);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (phase === 'done') return;
        setStart({ x: e.clientX, y: e.clientY });
        setEnd({ x: e.clientX, y: e.clientY });
        setPhase('drawing');
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (phase !== 'drawing') return;
        setEnd({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => {
        if (phase !== 'drawing') return;
        const rect = getRect();
        if (rect) {
            setPhase('done');
        } else {
            setPhase('idle');
            setStart(null);
            setEnd(null);
        }
    };

    const handleConfirm = () => {
        const rect = getRect();
        if (rect) onCapture(rect);
    };

    const rect = getRect();
    const selStyle = rect ? {
        left: rect.x, top: rect.y, width: rect.width, height: rect.height,
    } : undefined;

    return (
        <div
            style={{
                position: 'fixed', inset: 0, zIndex: 10000,
                cursor: phase === 'done' ? 'default' : 'crosshair',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* 四周暗色遮罩 (用 4 个 div 围住选区) */}
            {rect ? (
                <>
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: rect.y, background: 'rgba(0,0,0,0.45)' }} />
                    <div style={{ position: 'fixed', top: rect.y + rect.height, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)' }} />
                    <div style={{ position: 'fixed', top: rect.y, left: 0, width: rect.x, height: rect.height, background: 'rgba(0,0,0,0.45)' }} />
                    <div style={{ position: 'fixed', top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height, background: 'rgba(0,0,0,0.45)' }} />

                    <div style={{
                        position: 'fixed', ...selStyle,
                        border: '2px solid #0071e3',
                        borderRadius: 4,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
                        pointerEvents: 'none',
                    }} />

                    <div style={{
                        position: 'fixed',
                        left: rect.x + rect.width / 2,
                        top: rect.y - 28,
                        transform: 'translateX(-50%)',
                        background: 'rgba(0,0,0,0.7)',
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 600,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                    }}>
                        {Math.round(rect.width)} × {Math.round(rect.height)}
                    </div>
                </>
            ) : (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)' }}>
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
                        borderRadius: 16, padding: '24px 36px', textAlign: 'center',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                    }}>
                        <Camera size={32} style={{ color: '#0071e3', marginBottom: 8 }} />
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#1d1d1f', marginBottom: 4 }}>
                            拖拽选择截图区域
                        </div>
                        <div style={{ fontSize: 13, color: '#86868b' }}>
                            按住鼠标拖动选取您想要截取的区域
                        </div>
                        <div style={{ marginTop: 12, fontSize: 12, color: '#86868b' }}>
                            按 <kbd style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 4, border: '1px solid #ddd' }}>Esc</kbd> 取消
                        </div>
                    </div>
                </div>
            )}

            {phase === 'done' && rect && (
                <div style={{
                    position: 'fixed',
                    left: rect.x + rect.width / 2,
                    top: rect.y + rect.height + 12,
                    transform: 'translateX(-50%)',
                    display: 'flex', gap: 8,
                    animation: 'fadeIn 0.2s ease',
                }}>
                    <button
                        onClick={handleConfirm}
                        style={{
                            padding: '8px 20px', borderRadius: 20, border: 'none',
                            background: '#0071e3', color: '#fff', fontWeight: 600,
                            fontSize: 13, cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(0,113,227,0.35)',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        <Camera size={14} /> 截取此区域
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '8px 18px', borderRadius: 20, border: 'none',
                            background: 'rgba(255,255,255,0.9)', color: '#424245',
                            fontWeight: 500, fontSize: 13, cursor: 'pointer',
                            backdropFilter: 'blur(8px)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                    >
                        取消
                    </button>
                </div>
            )}
        </div>
    );
}

const AiAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: '您好！我是 StatLab AI 助手。我可以帮您分析数据、解释统计结果或提供操作指导。\n\n💡 点击输入框旁的 📷 按钮可以截取页面区域，我会帮您解读截图中的内容。' }
    ]);
    const [loading, setLoading] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const FAB_SIZE = 64;

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        if (!capturing) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setCapturing(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [capturing]);

    const extractTextFromRect = useCallback((rect: DOMRect) => {
        const textParts: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (node) => {
                const el = node as HTMLElement;
                const r = el.getBoundingClientRect();
                const overlaps = !(r.right < rect.x || r.left > rect.x + rect.width ||
                    r.bottom < rect.y || r.top > rect.y + rect.height);
                return overlaps ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
        });

        const visited = new Set<Node>();
        while (walker.nextNode()) {
            const el = walker.currentNode as HTMLElement;
            if (visited.has(el)) continue;
            visited.add(el);

            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            if (el.closest('.ai-assistant-wrapper')) continue;

            const text = el.innerText?.trim();
            if (text && text.length > 0 && text.length < 2000) {
                if (!textParts.some(t => t.includes(text) || text.includes(t))) {
                    textParts.push(text);
                }
            }
        }
        return textParts.join('\n').slice(0, 4000);
    }, []);

    const handleCapture = useCallback(async (rect: DOMRect) => {
        setCapturing(false);
        try {
            const dpr = window.devicePixelRatio || 1;
            let imageDataUrl: string | null = null;
            const targetCanvas = document.createElement('canvas');
            targetCanvas.width = Math.round(rect.width * dpr);
            targetCanvas.height = Math.round(rect.height * dpr);
            const tCtx = targetCanvas.getContext('2d')!;
            tCtx.scale(dpr, dpr);

            const allCanvases = document.querySelectorAll('canvas');
            let hasDrawn = false;
            tCtx.fillStyle = '#f5f5f7';
            tCtx.fillRect(0, 0, rect.width, rect.height);

            allCanvases.forEach(c => {
                const cRect = c.getBoundingClientRect();
                const overlaps = !(cRect.right < rect.x || cRect.left > rect.x + rect.width ||
                    cRect.bottom < rect.y || cRect.top > rect.y + rect.height);
                if (overlaps) {
                    try {
                        tCtx.drawImage(c, 0, 0, c.width, c.height, cRect.left - rect.x, cRect.top - rect.y, cRect.width, cRect.height);
                        hasDrawn = true;
                    } catch { }
                }
            });

            const allImages = document.querySelectorAll('img');
            allImages.forEach(img => {
                const iRect = img.getBoundingClientRect();
                const overlaps = !(iRect.right < rect.x || iRect.left > rect.x + rect.width ||
                    iRect.bottom < rect.y || iRect.top > rect.y + rect.height);
                if (overlaps) {
                    try {
                        tCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, iRect.left - rect.x, iRect.top - rect.y, iRect.width, iRect.height);
                        hasDrawn = true;
                    } catch { }
                }
            });

            if (hasDrawn) imageDataUrl = targetCanvas.toDataURL('image/png', 0.85);

            const extractedText = extractTextFromRect(rect);
            if (!imageDataUrl) {
                tCtx.fillStyle = '#ffffff';
                tCtx.fillRect(0, 0, rect.width, rect.height);
                tCtx.fillStyle = '#1d1d1f';
                tCtx.font = '13px -apple-system, sans-serif';
                extractedText.split('\n').slice(0, 20).forEach((line, i) => tCtx.fillText(line.slice(0, 60), 12, 20 + i * 18));
                tCtx.strokeStyle = '#0071e3';
                tCtx.lineWidth = 2;
                tCtx.strokeRect(0, 0, rect.width, rect.height);
                imageDataUrl = targetCanvas.toDataURL('image/png', 0.85);
            }

            setPendingImage(imageDataUrl);
            if (!input.trim()) setInput('请分析这个截图中的内容');
            (window as any).__statlab_capture_text = extractedText;
            (window as any).__statlab_capture_rect = { w: Math.round(rect.width), h: Math.round(rect.height) };
        } catch (err) {
            console.error('Screenshot capture failed:', err);
        }
    }, [input, extractTextFromRect]);

    const handleSend = async () => {
        if ((!input.trim() && !pendingImage) || loading) return;
        let userContent = input.trim();
        const capturedText = (window as any).__statlab_capture_text;
        const capturedRect = (window as any).__statlab_capture_rect;

        if (pendingImage && capturedText) {
            userContent = `${userContent}\n\n--- 截图区域内容 (${capturedRect?.w}x${capturedRect?.h} px) ---\n${capturedText}\n--- 截图结束 ---`;
            delete (window as any).__statlab_capture_text;
            delete (window as any).__statlab_capture_rect;
        }

        const userMsg: Message = { role: 'user', content: input.trim(), image: pendingImage || undefined };
        const apiMsg = { role: 'user' as const, content: userContent };

        setMessages(prev => [...prev, userMsg]);
        setInput(''); setPendingImage(null); setLoading(true);

        const assistantMsg: Message = { role: 'assistant', content: '' };
        setMessages(prev => [...prev, assistantMsg]);

        try {
            const apiMessages = [...messages.map(m => ({ role: m.role, content: m.content })), apiMsg];
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem("statlab_token") || ""}` },
                body: JSON.stringify({ messages: apiMessages })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            if (!response.body) throw new Error('No body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let buffer = '';

            const flushBuffer = (line: string) => {
                const cleaned = line.trim();
                if (!cleaned) return;
                const payload = cleaned.startsWith('data:') ? cleaned.replace(/^data:\s*/, '') : cleaned;
                try {
                    const json = JSON.parse(payload);
                    const delta = json.message?.content || json.response || '';
                    if (delta) {
                        accumulatedContent += delta;
                        setMessages(prev => {
                            const next = [...prev];
                            next[next.length - 1].content = accumulatedContent;
                            return next;
                        });
                    }
                } catch { buffer = line + '\n' + buffer; }
            };

            while (true) {
                const { done, value } = await reader.read();
                buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) flushBuffer(line);
                if (done) break;
            }
            if (buffer.trim()) flushBuffer(buffer);
        } catch (err: any) {
            setMessages(prev => {
                const next = [...prev];
                next[next.length - 1].content = `❌ 出错了: ${err.message}`;
                return next;
            });
        } finally { setLoading(false); }
    };

    return (
        <div className="ai-assistant-wrapper">
            {capturing && <CaptureOverlay onCapture={handleCapture} onCancel={() => setCapturing(false)} />}

            {/* Floating Button */}
            {!isOpen && (
                <button
                    className="side-fab ai-side-fab"
                    style={{ top: 'calc(50% - 90px)' }}
                    onClick={() => setIsOpen(true)}
                    title="AI 助手"
                >
                    <Bot size={18} />
                    <span style={{ fontSize: 10, fontWeight: 700, marginTop: -2 }}>AI</span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="ai-chat-window" style={{ position: 'fixed', right: 24, top: 92, zIndex: 10001 }}>
                    <div className="ai-chat-header">
                        <div className="ai-chat-title"><Bot size={18} /><span>StatLab AI 助手</span></div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="ai-close-btn" style={{ background: 'rgba(255,255,255,0.15)' }} 
                                    onClick={() => { setCapturing(true); setIsOpen(false); }}><Scissors size={14} /></button>
                            <button className="ai-close-btn" onClick={() => setIsOpen(false)}><X size={18} /></button>
                        </div>
                    </div>

                    <div className="ai-chat-messages" ref={scrollRef}>
                        {messages.map((m, idx) => (
                            <div key={idx} className={`ai-message ${m.role}`}>
                                <div className="ai-avatar">{m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}</div>
                                <div>
                                    {m.image && (
                                        <div className="ai-image-preview" onClick={() => {
                                            const w = window.open('', '_blank');
                                            w?.document.write(`<img src="${m.image}" style="max-width:100%;">`);
                                        }}><img src={m.image} alt="截图" /></div>
                                    )}
                                    <div className="ai-content">{m.content}</div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="ai-message assistant">
                                <div className="ai-avatar"><Bot size={14} /></div>
                                <div className="ai-content loading-bubble"><Loader2 className="animate-spin" size={16} /></div>
                            </div>
                        )}
                    </div>

                    {pendingImage && (
                        <div className="ai-pending-image">
                            <img src={pendingImage} alt="Preview" />
                            <button onClick={() => setPendingImage(null)}>×</button>
                        </div>
                    )}

                    <div className="ai-chat-input">
                        <button className="capture-trigger" onClick={() => { setCapturing(true); setIsOpen(false); }}><Camera size={16} /></button>
                        <input type="text" placeholder="问问 AI..." value={input} onChange={e => setInput(e.target.value)}
                               onKeyDown={e => e.key === 'Enter' && handleSend()} />
                        <button onClick={handleSend} disabled={(!input.trim() && !pendingImage) || loading}><Send size={16} /></button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiAssistant;
