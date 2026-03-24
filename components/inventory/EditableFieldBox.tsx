import { ReactNode } from "react";

interface EditableFieldBoxProps {
  children: ReactNode;
  className?: string;
}

export default function EditableFieldBox({ children, className }: EditableFieldBoxProps) {
  return (
    <div
      className={`inline-flex items-center gap-2.5 rounded-[6px] bg-white px-2.5 py-1.5 outline outline-1 outline-[rgba(149,143,132,0.35)] ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}

