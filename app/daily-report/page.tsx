import PageHeader from "@/components/layout/PageHeader";
import DailyReportView from "@/components/reports/DailyReportView";

export default function DailyReportPage() {
  return (
    <div>
      <PageHeader title="Daily Report" />
      <DailyReportView />
    </div>
  );
}
