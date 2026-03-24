import Image from "next/image";

interface EditIconProps {
  className?: string;
}

export default function EditIcon({ className }: EditIconProps) {
  return (
    <span
      className={`relative inline-flex h-4 w-4 items-center justify-center overflow-hidden ${className ?? ""}`.trim()}
      aria-hidden="true"
    >
      <Image src="/Edit.svg" alt="" width={16} height={16} />
    </span>
  );
}

