import EditIcon from "./EditIcon";

interface EditSaveIconButtonProps {
  isEditing: boolean;
  isSaving?: boolean;
  ariaLabel: string;
  onClick: () => void;
}

export default function EditSaveIconButton({
  isEditing,
  isSaving = false,
  ariaLabel,
  onClick,
}: EditSaveIconButtonProps) {
  return (
    <button
      type="button"
      className="text-warm-gray hover:text-charcoal transition-colors disabled:opacity-60"
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={isSaving}
    >
      {isEditing ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="none"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path
            d="M3.33301 8.3335L6.33301 11.3335L12.6663 5.00016"
            stroke="#576E42"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <EditIcon />
      )}
    </button>
  );
}

