interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex items-end border-b border-light-gray">
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap transition-colors border-b-2 -mb-px ${
              isActive
                ? "font-semibold text-charcoal border-charcoal"
                : "font-normal text-warm-gray border-transparent hover:text-charcoal"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
