export interface Business {
  id: string;
  business_name: string;
  slug: string;
  category?: string;
  moderation_status?: string | null;
  lifecycle_status?: string | null;
  status?: string | null;
  is_archived?: boolean;
  owner_id?: string | null;
  google_place_id?: string | null;
  menu?: any[];
  carListings?: any[];
  retailItems?: any[];
  [key: string]: any;
} 