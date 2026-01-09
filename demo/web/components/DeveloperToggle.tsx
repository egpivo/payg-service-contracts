'use client';

import { useState } from 'react';

interface DeveloperToggleProps {
  title: string;
  children: React.ReactNode;
}

export function DeveloperToggle({ title, children }: DeveloperToggleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 pt-4 border-t border-[#e0e0e0]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm text-[#667eea] hover:text-[#5568d3] transition-colors"
      >
        <span>{isOpen ? '▼' : '▶'}</span>
        <span className="font-medium">{title}</span>
      </button>
      {isOpen && (
        <div className="mt-3 pl-6 text-sm text-[#666666]">
          {children}
        </div>
      )}
    </div>
  );
}


