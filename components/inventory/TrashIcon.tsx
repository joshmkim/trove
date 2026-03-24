import Image from "next/image";

interface TrashIconProps {
  className?: string;
}

export default function TrashIcon({ className }: TrashIconProps) {
  return (
    <span
      className={`relative inline-flex h-4 w-4 items-center justify-center overflow-hidden ${className ?? ""}`.trim()}
      aria-hidden="true"
    >
      <Image src="/Trash.svg" alt="" width={16} height={16} />
    </span>
  );
}

