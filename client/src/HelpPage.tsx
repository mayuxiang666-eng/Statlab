import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import mermaid from 'mermaid';
import 'github-markdown-css/github-markdown-light.css';

function MermaidChart({ chart }: { chart: string }) {
    const id = useRef('mermaid-' + Math.random().toString(36).substr(2, 9));
    const [svg, setSvg] = useState('');

    useEffect(() => {
        mermaid.initialize({ startOnLoad: false, theme: 'default' });

        // Wrap rendering in a try-catch to ensure any sync throw is also handled
        const renderChart = async () => {
            try {
                const res = await mermaid.render(id.current, chart);
                setSvg(res.svg);
            } catch (err: any) {
                console.error("Mermaid error:", err);
                setSvg(`<pre style="color:red;font-size:12px;white-space:pre-wrap;text-align:left;">Mermaid Error: ${err.message || String(err)}</pre>`);
            }
        };

        renderChart();
    }, [chart]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0', background: '#f8fafc', padding: 16, borderRadius: 12 }}>
            <pre style={{ fontSize: 10, alignSelf: 'flex-start', color: '#666' }}>DEBUG STRING: {JSON.stringify(chart)}</pre>
            <div dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
    );
}

export default function HelpPage() {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/statlab_technical_documentation.md')
            .then(r => r.text())
            .then(text => {
                setContent(text);
                setLoading(false);
            })
            .catch(e => {
                setContent('文档加载失败: ' + String(e));
                setLoading(false);
            });
    }, []);

    return (
        <div style={{ overflowY: "auto", padding: 24, height: "100%", background: "var(--bg-base)" }}>
            <div className="card" style={{ maxWidth: 960, margin: "0 auto", padding: "40px 48px", background: "var(--bg-surface)", minHeight: '80vh' }}>
                {loading ? (
                    <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 24, marginBottom: 12 }}>📚</div>
                        正在加载技术文档...
                    </div>
                ) : (
                    <div className="markdown-body" style={{ color: "var(--text-primary)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw, rehypeSlug]}
                            components={{
                                code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    if (!inline && match && match[1] === 'mermaid') {
                                        const text = Array.isArray(children) ? children.join('') : String(children);
                                        return <MermaidChart chart={text.replace(/\n$/, '')} />;
                                    }
                                    return <code className={className} {...props}>{children}</code>;
                                }
                            }}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </div>
            <style>{`
                .markdown-body {
                    background: transparent;
                }
                .markdown-body h1 {
                    border-bottom: 2px solid var(--accent);
                    padding-bottom: 0.3em;
                    margin-bottom: 24px;
                }
                .markdown-body h2 {
                    border-bottom: 1px solid var(--border);
                    padding-bottom: 0.3em;
                    margin-top: 32px;
                }
                .markdown-body table {
                    width: 100%;
                }
                .markdown-body table th {
                    background: var(--bg-raised);
                }
            `}</style>
        </div>
    );
}
