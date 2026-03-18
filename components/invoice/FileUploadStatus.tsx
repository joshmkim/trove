interface FileUploadStatusProps {
  filename: string;
  size: string;
  status: "completed" | "uploading";
  progress?: number; // 0–100, used when status === "uploading"
  onRemove?: () => void;
}

function FileIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-8 h-8 text-warm-gray shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4 text-green-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="w-4 h-4 text-navy animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export default function FileUploadStatus({
  filename,
  size,
  status,
  progress = 75,
  onRemove,
}: FileUploadStatusProps) {
  const isCompleted = status === "completed";

  return (
    <div className="flex items-start gap-3 p-3 border border-light-gray rounded-sm">
      <FileIcon />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-charcoal truncate">{filename}</span>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove file"
            className="shrink-0 text-warm-gray hover:text-charcoal transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-warm-gray">{size}</span>
          {isCompleted ? (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckIcon />
              Completed
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-navy font-medium">
              <Spinner />
              Uploading
            </span>
          )}
        </div>

        {!isCompleted && (
          <div className="mt-2 h-1 w-full bg-light-gray rounded-full overflow-hidden">
            <div
              className="h-full bg-navy rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
