import EditableFieldBox from "./EditableFieldBox";

interface EditableNameFieldProps {
  isEditing: boolean;
  value: string;
  onChange: (nextValue: string) => void;
  ariaLabel: string;
}

export default function EditableNameField({
  isEditing,
  value,
  onChange,
  ariaLabel,
}: EditableNameFieldProps) {
  if (!isEditing) {
    return <span className="text-sm font-semibold text-charcoal leading-snug">{value}</span>;
  }

  return (
    <EditableFieldBox>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-[140px] bg-transparent text-sm font-medium leading-snug text-[#958F84] break-words focus:outline-none"
        style={{ fontFamily: "Instrument Sans", overflowWrap: "break-word" }}
        aria-label={ariaLabel}
      />
    </EditableFieldBox>
  );
}

