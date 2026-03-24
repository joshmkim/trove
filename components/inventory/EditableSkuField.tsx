import EditableFieldBox from "./EditableFieldBox";

interface EditableSkuFieldProps {
  isEditing: boolean;
  value: string;
  onChange?: (nextValue: string) => void;
  ariaLabel?: string;
}

export default function EditableSkuField({
  isEditing,
  value,
  onChange,
  ariaLabel = "Edit SKU",
}: EditableSkuFieldProps) {
  if (!isEditing) {
    return (
      <span
        className="text-[13px] font-medium leading-[20px] text-[#958F84]"
        style={{ fontFamily: "Instrument Sans", overflowWrap: "break-word" }}
      >
        {value}
      </span>
    );
  }

  return (
    <EditableFieldBox className="justify-center">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="min-w-[110px] bg-transparent text-[13px] font-medium leading-[20px] text-[#958F84] focus:outline-none"
        style={{ fontFamily: "Instrument Sans", overflowWrap: "break-word" }}
        aria-label={ariaLabel}
      />
    </EditableFieldBox>
  );
}

