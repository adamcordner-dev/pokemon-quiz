// ============================================
// Back Button
// ============================================

import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  to: string;
  label?: string;
}

export default function BackButton({ to, label = 'Back' }: BackButtonProps) {
  const navigate = useNavigate();

  return (
    <button className="back-button" onClick={() => navigate(to)}>
      ← {label}
    </button>
  );
}
