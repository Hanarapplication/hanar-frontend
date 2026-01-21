export interface Business {
  id: string;
  name: string;
  slug: string;
  category?: string;
  business_status: string;
  status: string;
  menu?: any[];
  carListings?: any[];
  retailItems?: any[];
  [key: string]: any;
} 