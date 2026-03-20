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
                    {/* top */}
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: rect.y, background: 'rgba(0,0,0,0.45)' }} />
                    {/* bottom */}
                    <div style={{ position: 'fixed', top: rect.y + rect.height, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.45)' }} />
                    {/* left */}
                    <div style={{ position: 'fixed', top: rect.y, left: 0, width: rect.x, height: rect.height, background: 'rgba(0,0,0,0.45)' }} />
                    {/* right */}
                    <div style={{ position: 'fixed', top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height, background: 'rgba(0,0,0,0.45)' }} />

                    {/* 选区边框 */}
                    <div style={{
                        position: 'fixed', ...selStyle,
                        border: '2px solid #0071e3',
                        borderRadius: 4,
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
                        pointerEvents: 'none',
                    }} />

                    {/* 尺寸标注 */}
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
                /* 全屏半透明 + 提示 */
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

            {/* 确认/取消按钮 - 仅在 done 阶段显示 */}
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

/* ─── Main AI Assistant Component ─── */
const AiAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: '您好！我是 StatLab AI 助手。我可以帮您分析数据、解释统计结果或提供操作指导。\n\n💡 点击输入框旁的 📷 按钮可以截取页面区域，我会帮您解读截图中的内容。' }
    ]);
    const [loading, setLoading] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [pendingImage, setPendingImage] = useState<string | null>(null);
    const [fabPos, setFabPos] = useState<{ x: number; y: number }>(() => ({
        x: typeof window !== 'undefined' ? window.innerWidth - 96 : 720,
        y: typeof window !== 'undefined' ? window.innerHeight - 110 : 540
    }));
    const scrollRef = useRef<HTMLDivElement>(null);
    const FAB_SIZE = 64;
    const EDGE = 12;

    const clampPos = (x: number, y: number) => ({
        x: Math.min(Math.max(EDGE, x), (typeof window !== 'undefined' ? window.innerWidth : 1200) - FAB_SIZE - EDGE),
        y: Math.min(Math.max(EDGE, y), (typeof window !== 'undefined' ? window.innerHeight : 800) - FAB_SIZE - EDGE)
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        const onResize = () => setFabPos(p => clampPos(p.x, p.y));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // ESC key to cancel capture
    useEffect(() => {
        if (!capturing) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setCapturing(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [capturing]);

    /* ─── Extract text content from selected region ─── */
    const extractTextFromRect = useCallback((rect: DOMRect) => {
        const elements = document.elementsFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        // Get all text nodes within the rect region
        const textParts: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
            acceptNode: (node) => {
                const el = node as HTMLElement;
                const r = el.getBoundingClientRect();
                // Check if element overlaps with selection rect
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

            // Skip hidden elements and overlay elements
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') continue;
            if (el.closest('.ai-assistant-wrapper')) continue;

            const text = el.innerText?.trim();
            if (text && text.length > 0 && text.length < 2000) {
                // Avoid duplicated parent-child text
                if (!textParts.some(t => t.includes(text) || text.includes(t))) {
                    textParts.push(text);
                }
            }
        }

        return textParts.join('\n').slice(0, 4000); // Limit to 4000 chars
    }, []);

    /* ─── Capture region as image ─── */
    const handleCapture = useCallback(async (rect: DOMRect) => {
        setCapturing(false);

        try {
            // 1) Use Canvas to capture the selected region from the page
            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            const ctx = canvas.getContext('2d')!;
            ctx.scale(dpr, dpr);

            // Try html2canvas-like approach: screenshot using the browser's native method
            // We'll collect the visible elements and draw them
            // Simpler approach: capture from the document body using range

            // Use a simpler, more reliable approach: get all canvas/img/svg elements in region
            // and draw the body via foreignObject SVG
            const svgData = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
                    <foreignObject width="${rect.width}" height="${rect.height}">
                        <div xmlns="http://www.w3.org/1999/xhtml" style="width:${rect.width}px;height:${rect.height}px;overflow:hidden;position:relative;">
                            <div style="position:absolute;left:${-rect.x}px;top:${-rect.y}px;width:${window.innerWidth}px;height:${window.innerHeight}px;pointer-events:none;">
                                ${document.documentElement.outerHTML.replace(/&/g, '&amp;').replace(/#/g, '%23')}
                            </div>
                        </div>
                    </foreignObject>
                </svg>`;

            // Fallback: just capture via offscreen approach + extract text  
            // Since foreignObject has CORS issues, we use a practical approach:
            // Take a visual snapshot using the modern Screen Capture API if available,
            // otherwise extract text content.

            let imageDataUrl: string | null = null;

            // Try native screen capture
            try {
                // @ts-ignore
                if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                    // Don't use getDisplayMedia as it requires user permission for entire screen
                    // Instead, use a canvas-based approach
                }
            } catch { }

            // Practical approach: Create a snapshot from the body by cloning
            // We'll use a lightweight "screenshot" approach
            const targetCanvas = document.createElement('canvas');
            targetCanvas.width = Math.round(rect.width * dpr);
            targetCanvas.height = Math.round(rect.height * dpr);
            const tCtx = targetCanvas.getContext('2d')!;
            tCtx.scale(dpr, dpr);

            // Find all canvases (ECharts) in the region and composite them
            const allCanvases = document.querySelectorAll('canvas');
            let hasDrawn = false;

            // First, fill background
            tCtx.fillStyle = '#f5f5f7';
            tCtx.fillRect(0, 0, rect.width, rect.height);

            allCanvases.forEach(c => {
                const cRect = c.getBoundingClientRect();
                const overlaps = !(cRect.right < rect.x || cRect.left > rect.x + rect.width ||
                    cRect.bottom < rect.y || cRect.top > rect.y + rect.height);
                if (overlaps) {
                    try {
                        tCtx.drawImage(c,
                            0, 0, c.width, c.height,
                            cRect.left - rect.x, cRect.top - rect.y,
                            cRect.width, cRect.height
                        );
                        hasDrawn = true;
                    } catch { }
                }
            });

            // Also capture images
            const allImages = document.querySelectorAll('img');
            allImages.forEach(img => {
                const iRect = img.getBoundingClientRect();
                const overlaps = !(iRect.right < rect.x || iRect.left > rect.x + rect.width ||
                    iRect.bottom < rect.y || iRect.top > rect.y + rect.height);
                if (overlaps) {
                    try {
                        tCtx.drawImage(img,
                            0, 0, img.naturalWidth, img.naturalHeight,
                            iRect.left - rect.x, iRect.top - rect.y,
                            iRect.width, iRect.height
                        );
                        hasDrawn = true;
                    } catch { }
                }
            });

            if (hasDrawn) {
                imageDataUrl = targetCanvas.toDataURL('image/png', 0.85);
            }

            // 2) Extract text content from the region
            const extractedText = extractTextFromRect(rect);

            // 3) Build screenshot as data URL (even without canvas, we create a placeholder)
            if (!imageDataUrl) {
                // Create a text-based screenshot placeholder
                tCtx.fillStyle = '#ffffff';
                tCtx.fillRect(0, 0, rect.width, rect.height);
                tCtx.fillStyle = '#1d1d1f';
                tCtx.font = '13px -apple-system, sans-serif';
                const lines = extractedText.split('\n').slice(0, 20);
                lines.forEach((line, i) => {
                    tCtx.fillText(line.slice(0, 60), 12, 20 + i * 18);
                });
                tCtx.strokeStyle = '#0071e3';
                tCtx.lineWidth = 2;
                tCtx.strokeRect(0, 0, rect.width, rect.height);
                imageDataUrl = targetCanvas.toDataURL('image/png', 0.85);
            }

            // 4) Set pending image + auto-fill input
            setPendingImage(imageDataUrl);
            if (!input.trim()) {
                setInput('请分析这个截图中的内容');
            }

            // Store extracted text for sending to AI
            (window as any).__statlab_capture_text = extractedText;
            (window as any).__statlab_capture_rect = { w: Math.round(rect.width), h: Math.round(rect.height) };

        } catch (err) {
            console.error('Screenshot capture failed:', err);
        }
    }, [input, extractTextFromRect]);

    /* ─── Send message (with optional image context) ─── */
    const handleSend = async () => {
        if ((!input.trim() && !pendingImage) || loading) return;

        // Build the user message content
        let userContent = input.trim();
        const capturedText = (window as any).__statlab_capture_text;
        const capturedRect = (window as any).__statlab_capture_rect;

        if (pendingImage && capturedText) {
            // Append the extracted text as context for the AI
            userContent = `${userContent}\n\n--- 以下是用户截取的页面区域内容（${capturedRect?.w || '?'}×${capturedRect?.h || '?'} px）---\n${capturedText}\n--- 截图内容结束 ---`;
            // Clear capture data
            delete (window as any).__statlab_capture_text;
            delete (window as any).__statlab_capture_rect;
        }

        const userMsg: Message = {
            role: 'user',
            content: input.trim(),
            image: pendingImage || undefined,
        };
        const apiMsg = { role: 'user' as const, content: userContent };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setPendingImage(null);
        setLoading(true);

        const assistantMsg: Message = { role: 'assistant', content: '' };
        setMessages(prev => [...prev, assistantMsg]);

        try {
            const apiMessages = [...messages.map(m => ({ role: m.role, content: m.content })), apiMsg];

            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages })
            });

            if (!response.ok) {
                const errJson = await response.json().catch(() => ({}));
                throw new Error(errJson.error || `HTTP error! status: ${response.status}`);
            }

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
                            next[next.length - 1] = { role: 'assistant', content: accumulatedContent };
                            return next;
                        });
                    }
                } catch {
                    buffer = line + '\n' + buffer;
                }
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
            console.error(err);
            setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'assistant', content: `❌ 出错了: ${err.message}` };
                return next;
            });
        } finally {
            setLoading(false);
        }
    };

    const chatLeft = Math.min(Math.max(fabPos.x - 300 + FAB_SIZE, EDGE), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 392);
    const chatTop = Math.min(Math.max(fabPos.y - 560, EDGE), (typeof window !== 'undefined' ? window.innerHeight : 800) - 560 - EDGE);

    return (
        <div className="ai-assistant-wrapper">
            {/* Capture Overlay */}
            {capturing && (
                <CaptureOverlay
                    onCapture={handleCapture}
                    onCancel={() => setCapturing(false)}
                />
            )}

            {/* Floating Button */}
            {!isOpen && (
                <button
                    className="fab-button ai-fab"
                    style={{ left: fabPos.x, top: fabPos.y, width: FAB_SIZE, height: FAB_SIZE }}
                    onMouseDown={(e) => {
                        const startX = e.clientX; const startY = e.clientY; const start = fabPos;
                        const onMove = (ev: MouseEvent) => {
                            const dx = ev.clientX - startX; const dy = ev.clientY - startY;
                            setFabPos(clampPos(start.x + dx, start.y + dy));
                        };
                        const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                    }}
                    onClick={() => setIsOpen(true)}
                    title="AI 助手"
                >
                    <Sparkles size={20} />
                    <span style={{ fontSize: 11, fontWeight: 800 }}>AI</span>
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="ai-chat-window" style={{ left: chatLeft, top: chatTop }}>
                    <div className="ai-chat-header">
                        <div className="ai-chat-title">
                            <Bot size={18} />
                            <span>StatLab AI 助手</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button
                                className="ai-close-btn"
                                title="截取页面区域"
                                onClick={() => { setCapturing(true); setIsOpen(false); }}
                                style={{ background: 'rgba(255,255,255,0.15)' }}
                            >
                                <Scissors size={14} />
                            </button>
                            <button className="ai-close-btn" onClick={() => setIsOpen(false)}>
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="ai-chat-messages" ref={scrollRef}>
                        {messages.map((m, idx) => (
                            <div key={idx} className={`ai-message ${m.role}`}>
                                <div className="ai-avatar">
                                    {m.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                                </div>
                                <div>
                                    {m.image && (
                                        <div style={{
                                            marginBottom: 6,
                                            borderRadius: 10,
                                            overflow: 'hidden',
                                            border: '1px solid rgba(0,0,0,0.08)',
                                            maxWidth: 220,
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s',
                                        }}
                                            onClick={() => {
                                                // Show full-size image popup
                                                const w = window.open('', '_blank', 'width=800,height=600');
                                                if (w) {
                                                    w.document.write(`<img src="${m.image}" style="max-width:100%;height:auto;">`);
                                                    w.document.title = '截图预览';
                                                }
                                            }}
                                        >
                                            <img src={m.image} alt="截图" style={{
                                                width: '100%', height: 'auto', display: 'block',
                                            }} />
                                        </div>
                                    )}
                                    <div className="ai-content">{m.content}</div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="ai-message assistant">
                                <div className="ai-avatar"><Bot size={14} /></div>
                                <div className="ai-content loading-bubble">
                                    <Loader2 className="animate-spin" size={16} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Pending image preview */}
                    {pendingImage && (
                        <div style={{
                            padding: '8px 12px',
                            borderTop: '1px solid rgba(0,0,0,0.06)',
                            background: 'rgba(248,249,251,0.95)',
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <div style={{ position: 'relative' }}>
                                <img src={pendingImage} alt="截图预览" style={{
                                    height: 48, borderRadius: 8,
                                    border: '1px solid rgba(0,0,0,0.08)',
                                }} />
                                <button
                                    onClick={() => setPendingImage(null)}
                                    style={{
                                        position: 'absolute', top: -6, right: -6,
                                        width: 18, height: 18, borderRadius: '50%',
                                        background: '#ff3b30', color: '#fff', border: 'none',
                                        fontSize: 11, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                                    }}
                                >×</button>
                            </div>
                            <div style={{ flex: 1, fontSize: 12, color: '#86868b' }}>
                                📷 已截取页面区域
                            </div>
                        </div>
                    )}

                    <div className="ai-chat-input">
                        <button
                            onClick={() => { setCapturing(true); setIsOpen(false); }}
                            title="截取页面区域"
                            style={{
                                width: 36, minWidth: 36,
                                background: pendingImage ? '#0071e3' : 'rgba(0,0,0,0.05)',
                                color: pendingImage ? '#fff' : '#86868b',
                                borderRadius: 10,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: 'none', cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Camera size={16} />
                        </button>
                        <input
                            type="text"
                            placeholder={pendingImage ? "描述您想了解的内容..." : "我有疑问，问问 AI..."}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={handleSend} disabled={(!input.trim() && !pendingImage) || loading}>
                            <Send size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiAssistant;
