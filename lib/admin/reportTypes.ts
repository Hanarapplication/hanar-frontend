export const REPORT_ENTITY_TYPES = [
  'post',
  'item',
  'business',
  'organization',
  'seller',
  'chat',
] as const;

export type ReportEntityType = (typeof REPORT_ENTITY_TYPES)[number];

export const REPORT_INBOX_NAV: {
  slug: ReportEntityType;
  label: string;
  navLabel: string;
}[] = [
  { slug: 'post', label: 'Post reports', navLabel: 'Post reports' },
  { slug: 'item', label: 'Item reports', navLabel: 'Item reports' },
  { slug: 'business', label: 'Business reports', navLabel: 'Business reports' },
  { slug: 'organization', label: 'Organization reports', navLabel: 'Organization reports' },
  { slug: 'seller', label: 'Seller reports', navLabel: 'Seller reports' },
  { slug: 'chat', label: 'Chat reports', navLabel: 'Chat reports' },
];

export const REPORT_ENTITY_LABEL: Record<ReportEntityType, string> = {
  post: 'Post',
  item: 'Marketplace Item',
  business: 'Business',
  organization: 'Organization',
  chat: 'Chat',
  seller: 'Seller (user)',
};

export function isReportEntityType(value: string): value is ReportEntityType {
  return (REPORT_ENTITY_TYPES as readonly string[]).includes(value);
}
