import React from 'react';

export function StatCard({ label, value, max }: { label: string; value: number; max: number }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isUnlimited = max === -1;

  return (
    <div className="card !p-3">
      <p className="text-xs text-tiktok-gray-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-tiktok-gray-900">
        {value}
        {!isUnlimited && <span className="text-xs font-normal text-tiktok-gray-400">/{max}</span>}
      </p>
      {!isUnlimited && (
        <div className="w-full bg-tiktok-gray-100 rounded-full h-1.5 mt-1">
          <div
            className={`h-1.5 rounded-full transition-all ${
              percentage > 80 ? 'bg-brand-error' : 'bg-brand-primary'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
