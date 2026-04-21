import React from 'react';
import { Award, Download, Share2, X, CheckCircle } from 'lucide-react';

interface CertificateModalProps {
  userName: string;
  courseTitle: string;
  date: string;
  onClose: () => void;
}

const CertificateModal: React.FC<CertificateModalProps> = ({ userName, courseTitle, date, onClose }) => {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(10px)' }}>
      <div style={{ position: 'relative', width: '800px', background: 'var(--bg-raised)', borderRadius: 24, padding: 40, border: '1px solid var(--accent)', boxShadow: '0 30px 60px rgba(0,0,0,0.5)', animation: 'scaleUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={24} />
        </button>

        {/* Certificate Content */}
        <div id="certificate-print-area" style={{ border: '12px double var(--accent)', padding: '60px', textAlign: 'center', position: 'relative', background: 'var(--bg-soft)' }}>
            {/* Watermark/Logo */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.05, pointerEvents: 'none' }}>
                <Award size={400} color="var(--accent)" />
            </div>

            <div style={{ marginBottom: 40 }}>
                <div style={{ fontSize: 48, fontWeight: 900, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>StatLab</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.2em' }}>INDUSTRIAL DATA INTELLIGENCE PLATFORM</div>
            </div>

            <div style={{ fontSize: 24, fontWeight: 300, color: 'var(--text-primary)', marginBottom: 20 }}>CERTIFICATE OF ACHIEVEMENT</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 40 }}>This is to certify that</div>

            <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', borderBottom: '2px solid var(--border)', display: 'inline-block', padding: '0 40px 8px', marginBottom: 40 }}>{userName || '工业数据专家'}</div>

            <div style={{ fontSize: 16, color: 'var(--text-primary)', marginBottom: 12 }}>has successfully completed the industrial expertise track</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', marginBottom: 60 }}>{courseTitle}</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 80 }}>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>ISSUED DATE</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{date}</div>
                </div>
                <div>
                   <div style={{ color: 'var(--accent)', marginBottom: 8 }}><Award size={40} /></div>
                   <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>VERIFIED BY STATLAB ENGINE</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>CERTIFICATE ID</div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>SL-{Math.random().toString(36).substr(2, 9).toUpperCase()}</div>
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button className="btn" style={{ padding: '12px 24px', borderRadius: 12, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <Download size={18} /> 导出为 PDF
            </button>
            <button className="btn btn-primary" style={{ padding: '12px 32px', borderRadius: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Share2 size={18} /> 分享至职场社交
            </button>
        </div>

      </div>
      <style>{`
        @keyframes scaleUp {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default CertificateModal;
