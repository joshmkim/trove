import EditableFieldBox from "./EditableFieldBox";

interface EditableQuantityFieldProps {
  isEditing: boolean;
  value: string;
  onChange: (nextValue: string) => void;
  ariaLabel: string;
  emphasize?: boolean;
}

export default function EditableQuantityField({
  isEditing,
  value,
  onChange,
  ariaLabel,
  emphasize = false,
}: EditableQuantityFieldProps) {
  if (!isEditing) {
    return (
      <span className={emphasize ? "text-sm font-semibold text-charcoal tabular-nums" : "text-sm text-charcoal tabular-nums"}>
        {value}
      </span>
    );
  }

  return (
    <EditableFieldBox className="justify-center">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          if (/^\d*$/.test(next)) onChange(next);
        }}
        inputMode="numeric"
        className="h-[24.01px] w-[30.01px] bg-transparent text-center text-[16px] font-medium leading-[24px] text-[#958F84] focus:outline-none"
        style={{ fontFamily: "Instrument Sans", overflowWrap: "break-word" }}
        aria-label={ariaLabel}
      />
    </EditableFieldBox>
  );
}

