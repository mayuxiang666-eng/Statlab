import React from 'react';

interface XpToastProps {
  xp: number;
  visible: boolean;
  label?: string;
}

const XpToast: React.FC<XpToastProps> = ({ xp, visible, label }) => {
  if (!visible) return null;
  return (
    <div className="xp-toast">
      <span style={{ fontSize: 22 }}>🏅</span>
      <span>+{xp} XP</span>
      {label && <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.9 }}>{label}</span>}
    </div>
  );
};

export default XpToast;
