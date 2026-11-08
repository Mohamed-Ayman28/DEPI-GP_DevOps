export interface ServiceCategory {
  id: number;
  name: string;
  description?: string;
}

export interface ServicePackage {
  id?: number;
  service_id?: number;
  name: string;
  description: string;
  price: number;
  currency: string;
}

export interface CatalogService {
  id?: number;
  vendor_id: number;
  category_id: number;
  category_name?: string;
  name: string;
  description: string;
  base_price: number;
  currency: string;
  location: string;
  status?: string;
  packages?: ServicePackage[];
  created_at?: string;
}

export interface CreateCatalogService {
  category_id: number;
  name: string;
  description: string;
  base_price: number;
  currency: string;
  location: string;
}
