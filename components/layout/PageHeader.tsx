import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  actionButton?: ReactNode;
}

export default function PageHeader({ title, actionButton }: PageHeaderProps) {
  return (
    <div className="px-6 pt-6 pb-4 border-b border-light-gray">
      {/* Title + action */}
      <div className="flex items-center justify-between">
        <h1 className="text-[36px] font-bold text-charcoal leading-tight">{title}</h1>
        {actionButton && <div>{actionButton}</div>}
      </div>
    </div>
  );
}
