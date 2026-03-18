interface ViewToggleProps {
  activeView: "list" | "grid";
  onToggle: (view: "list" | "grid") => void;
}

function ListIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function GridIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4"
      fill={filled ? "currentColor" : "none"}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 018.25 20.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
      />
    </svg>
  );
}

export default function ViewToggle({ activeView, onToggle }: ViewToggleProps) {
  const base = "p-2 rounded-sm transition-colors";
  const active = "bg-charcoal text-white";
  const inactive = "bg-white text-warm-gray border border-light-gray hover:border-warm-gray";

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="List view"
        onClick={() => onToggle("list")}
        className={`${base} ${activeView === "list" ? active : inactive}`}
      >
        <ListIcon filled={activeView === "list"} />
      </button>
      <button
        type="button"
        aria-label="Grid view"
        onClick={() => onToggle("grid")}
        className={`${base} ${activeView === "grid" ? active : inactive}`}
      >
        <GridIcon filled={activeView === "grid"} />
      </button>
    </div>
  );
}
