// ============================================================
// Shared sales domain models — extracted from the former
// 12.8k-line sales-dashboard.component.ts during the split.
// ============================================================

export const COMPANIES = [
  { code: 'PMT', name: 'Promed Technologies', shortName: 'Promed', color: '#1a237e', logo: 'logos/promed-round.png?v=4' },
  { code: 'ACM', name: 'Access Medical', shortName: 'Access', color: '#00695c', logo: 'logos/access-round.png?v=4' },
  { code: 'PHT', name: 'Pharmatech', shortName: 'Pharmatech', color: '#c62828', logo: 'logos/pharmatech-round.png?v=4' },
  { code: 'SBT', name: 'Sebenzani Trading', shortName: 'Sebenzani', color: '#6a1b9a', logo: 'logos/sebenzani-round.png?v=4' }
];

export interface Company {
  code: string;
  name: string;
  shortName: string;
  color: string;
  logo?: string;
}

export interface SalesHistoryRow {
  id: number;
  customerName: string;
  customerNumber?: string | null;
  invoiceNumber: string;
  shipmentNumber?: string | null;
  orderNumber?: string | null;
  invoiceDate: string;
  location?: string | null;
  salesAmount: number;
  totalCost?: number | null;
  grossProfit?: number | null;
  marginPercent?: number | null;
  hasLineDetail: boolean;
  sourceCompany?: string | null;
  isReconciled: boolean;
}

export interface SalesHistoryLine {
  id: number;
  itemCode?: string | null;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  salesAmount: number;
  unitCost: number;
  extCost: number;
  grossProfit: number;
  marginPercent?: number | null;
  itemCategory?: string | null;
  source?: string | null;
}

export interface SalesHistoryReconcile {
  historyCount: number;
  matchedCount: number;
  missingCount: number;
  missingAmount: number;
  missingByMonth: { year: number; month: number; missingCount: number; missingAmount: number }[];
}

export interface CompanySales {
  company: Company;
  todaySales: number;
  yesterdaySales: number;
  todayOrders: number;
  yesterdayOrders: number;
  percentChange: number;
  monthlyDailyAvg: number;
}

export interface Customer {
  id: number;
  customerCode: string;
  name: string;
  shortName?: string;
  email?: string;
  phoneNumber?: string;
  contactPerson?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryProvince?: string;
  deliveryPostalCode?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  createdAt: Date;
  totalOrders?: number;
  totalRevenue?: number;
  companyCode?: string;
}

export interface SalesTripSheetLine {
  customerName?: string;
  invoiceNumber?: string;
  address?: string;
  city?: string;
  province?: string;
  contactPerson?: string;
  contactPhone?: string;
  productDescription?: string;
  quantity: number;
  value: number;
}

export interface SalesTripSheet {
  id: number;
  tripSheetNumber: string;
  status: string; // PendingSignature, PendingApproval, Approved, Rejected
  warehouseCode?: string;
  routeArea?: string;
  scheduledDate?: string;
  notes?: string;
  createdByUserId?: number;
  createdByName?: string;
  signerUserId?: number;
  signerName?: string;
  approverUserId?: number;
  approverName?: string;
  createdAt: string;
  signedByUserId?: number;
  signedByName?: string;
  signedAt?: string;
  checkedByUserId?: number;
  checkedByName?: string;
  checkedAt?: string;
  approvalNotes?: string;
  rejectionReason?: string;
  convertedLoadId?: number;
  convertedLoadNumber?: string;
  totalValue: number;
  lines: SalesTripSheetLine[];
}

export interface Invoice {
  id: number;
  transactionNumber: string;
  customerNumber: string;
  customerName: string;
  customerId?: number;
  productCode: string;
  productDescription: string;
  quantity: number;
  salesAmount: number;
  costOfSales: number;
  transactionDate: Date;
  status: string;
  sourceSystem?: string;
  sourceCompany?: string;
  deliveryProvince?: string;
  deliveryAddress?: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerName: string;
  customerId: number;
  orderDate: Date;
  totalAmount: number;
  status: string;
  priority: string;
  items: number;
  notes?: string;
  companyCode?: string;
}

export interface IncomingOrderEmail {
  messageId: string;
  subject: string;
  from: string;
  fromEmail: string;
  date: Date;
  accountEmail: string;
  accountDisplayName: string;
  hasAttachments: boolean;
  preview: string;
  isRead: boolean;
  priority: string;
  to: string[];
  cc: string[];
  foundInAccounts: string[];
}

export interface SalesStats {
  totalCustomers: number;
  activeCustomers: number;
  totalInvoices: number;
  pendingInvoices: number;
  totalRevenue: number;
  monthlyRevenue: number;
  incomingOrders: number;
  processingOrders: number;
}
