export type Database = {
  public: {
    Tables: {
      Businesses: {
        Row: {
          id: string;
          business_name: string;
          slug: string;
          description: string;
          category: string;
          phone: string;
          email: string;
          whatsapp: string;
          website: string;
          hours: string;
          facebook: string;
          instagram: string;
          twitter: string;
          tiktok: string;
          logo_url: string;
          images: string[];
          address: {
            street: string;
            city: string;
            state: string;
            zip: string;
          };
          isRestaurant: boolean;
          isDealership: boolean;
          business_status: string;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
};
