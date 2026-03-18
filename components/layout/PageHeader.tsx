import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  actionButton?: ReactNode;
}

export default function PageHeader({ title, actionButton }: PageHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-light-gray">
      {/* POS connection status */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="text-xs text-warm-gray">Connected to Harucake POS System</span>
      </div>

      {/* Title + action */}
      <div className="flex items-center justify-between">
        <h1 className="text-[36px] font-bold text-charcoal leading-tight">{title}</h1>
        {actionButton && <div>{actionButton}</div>}
      </div>
    </div>
  );
}
