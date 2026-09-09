'use client';

import React from 'react';

export function MobileCardField({
  label,
  children,
  className = '',
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 text-xs ${className}`}>
      {label && <span className="text-slate-400 font-semibold shrink-0">{label}</span>}
      <div className="min-w-0 flex-1 text-end">{children}</div>
    </div>
  );
}
