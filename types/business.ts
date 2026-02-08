export interface Business {
  id: string;
  business_name: string;
  slug: string;
  category?: string;
  moderation_status?: string | null;
  lifecycle_status?: string | null;
  status?: string | null;
  is_archived?: boolean;
  menu?: any[];
  carListings?: any[];
  retailItems?: any[];
  [key: string]: any;
} 