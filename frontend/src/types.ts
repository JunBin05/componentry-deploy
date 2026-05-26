export type ComponentCategory = 'CPU' | 'GPU' | 'Motherboard' | 'RAM' | 'Storage' | 'PSU' | 'Cooling' | 'Case';

export interface ComponentItem {
  id: string;
  name: string;
  part_name: string;
  sku: string;
  price: number;
  category: ComponentCategory;
  icon: string;
  stock_level: number;
  specs?: Record<string, unknown>;
}

export interface QuoteLineItem {
  component: ComponentItem;
  quantity: number;
  rationale?: string;
  customPrice?: number;
}

export type QuoteStatus = 'Draft' | 'Approved' | 'Sent' | 'Declined';

export interface QuoteProposal {
  id: string;
  date: string;
  customer: string;
  brief: string;
  status: QuoteStatus;
  total: number;
  items: QuoteLineItem[];
  targetBudget?: number;
  project?: string;
  contactNumber?: string;
  supportEmail?: string;
  address?: string;
  quotePrefix?: string;
}

export interface SupplierConfig {
  companyName: string;
  contactNumber: string;
  supportEmail: string;
  businessAddress: string;
  customQuotePrefix: string;
}

export interface StockAlert {
  id: string;
  name: string;
  sku: string;
  stock: number;
  icon: string;
}
