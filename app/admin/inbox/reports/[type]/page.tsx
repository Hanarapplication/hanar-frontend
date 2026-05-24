import { notFound } from 'next/navigation';
import AdminReportsPanel from '@/components/admin/AdminReportsPanel';
import { isReportEntityType, REPORT_INBOX_NAV } from '@/lib/admin/reportTypes';

type PageProps = {
  params: Promise<{ type: string }>;
};

export default async function AdminInboxReportsPage({ params }: PageProps) {
  const { type } = await params;
  if (!isReportEntityType(type)) notFound();

  const config = REPORT_INBOX_NAV.find((entry) => entry.slug === type);
  if (!config) notFound();

  return <AdminReportsPanel entityType={type} title={config.label} />;
}
