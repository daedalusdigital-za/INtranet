// Finance Module Models

export interface FinanceCategory {
  id: number;
  name: string;
  description?: string;
  type: string; // 'income', 'expense', 'both'
  code?: string;
  parentCategoryId?: number;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateFinanceCategoryDto {
  name: string;
  description?: string;
  type: string;
  code?: string;
  parentCategoryId?: number;
}

export interface UpdateFinanceCategoryDto {
  name?: string;
  description?: string;
  type?: string;
  code?: string;
  parentCategoryId?: number;
  isActive?: boolean;
}

export interface BudgetLineItem {
  id: number;
  name: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
}

export interface Budget {
  id: number;
  name: string;
  description?: string;
  fiscalYear: string;
  period?: string;
  department?: string;
  status: string;
  totalBudget: number;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  createdBy?: string;
  approvedBy?: string;
  approvedDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
  lineItems: BudgetLineItem[];
}

export interface CreateBudgetLineItemDto {
  name: string;
  description?: string;
  categoryId?: number;
  allocatedAmount: number;
}

export interface CreateBudgetDto {
  name: string;
  description?: string;
  fiscalYear: string;
  period?: string;
  department?: string;
  totalBudget: number;
  currency?: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  lineItems: CreateBudgetLineItemDto[];
}

export interface UpdateBudgetDto {
  name?: string;
  description?: string;
  fiscalYear?: string;
  period?: string;
  department?: string;
  status?: string;
  totalBudget?: number;
  currency?: string;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}

export interface Expense {
  id: number;
  expenseNumber: string;
  description: string;
  vendor: string;
  status: string;
  amount: number;
  vatAmount?: number;
  totalAmount: number;
  currency: string;
  categoryId?: number;
  categoryName?: string;
  department?: string;
  expenseDate: Date;
  dueDate?: Date;
  submittedBy?: string;
  approvedBy?: string;
  approvedDate?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  invoiceNumber?: string;
  notes?: string;
  receiptPath?: string;
  receiptFileName?: string;
  isRecurring: boolean;
  recurrencePattern?: string;
  budgetId?: number;
  budgetName?: string;
  purchaseOrderId?: number;
  purchaseOrderNumber?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreateExpenseDto {
  expenseNumber: string;
  description: string;
  vendor: string;
  amount: number;
  vatAmount?: number;
  currency?: string;
  categoryId?: number;
  department?: string;
  expenseDate: Date;
  dueDate?: Date;
  invoiceNumber?: string;
  notes?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
  budgetId?: number;
  purchaseOrderId?: number;
}

export interface UpdateExpenseDto {
  description?: string;
  vendor?: string;
  status?: string;
  amount?: number;
  vatAmount?: number;
  categoryId?: number;
  department?: string;
  expenseDate?: Date;
  dueDate?: Date;
  paymentMethod?: string;
  paymentReference?: string;
  invoiceNumber?: string;
  notes?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
}

export interface PurchaseOrderItem {
  id: number;
  description: string;
  productCode?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  lineTotal: number;
  receivedQuantity?: number;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierName: string;
  supplierContact?: string;
  supplierEmail?: string;
  description?: string;
  status: string;
  subTotal: number;
  vatAmount: number;
  total: number;
  currency: string;
  categoryId?: number;
  categoryName?: string;
  department?: string;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  receivedDate?: Date;
  requestedBy?: string;
  approvedBy?: string;
  approvedDate?: Date;
  notes?: string;
  deliveryAddress?: string;
  attachmentPath?: string;
  attachmentFileName?: string;
  createdAt: Date;
  updatedAt?: Date;
  items: PurchaseOrderItem[];
}

export interface CreatePurchaseOrderItemDto {
  description: string;
  productCode?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

export interface CreatePurchaseOrderDto {
  poNumber: string;
  supplierName: string;
  supplierContact?: string;
  supplierEmail?: string;
  description?: string;
  currency?: string;
  categoryId?: number;
  department?: string;
  expectedDeliveryDate?: Date;
  notes?: string;
  deliveryAddress?: string;
  items: CreatePurchaseOrderItemDto[];
}

export interface UpdatePurchaseOrderDto {
  supplierName?: string;
  supplierContact?: string;
  supplierEmail?: string;
  description?: string;
  status?: string;
  categoryId?: number;
  department?: string;
  expectedDeliveryDate?: Date;
  receivedDate?: Date;
  notes?: string;
  deliveryAddress?: string;
}

export interface Payment {
  id: number;
  paymentNumber: string;
  paymentType: string;
  expenseId?: number;
  expenseNumber?: string;
  purchaseOrderId?: number;
  purchaseOrderNumber?: string;
  bookInvoiceId?: number;
  payee: string;
  description?: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentReference?: string;
  bankReference?: string;
  paymentDate: Date;
  processedDate?: Date;
  processedBy?: string;
  approvedBy?: string;
  approvedDate?: Date;
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
  notes?: string;
  proofPath?: string;
  proofFileName?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface CreatePaymentDto {
  paymentNumber: string;
  paymentType: string;
  expenseId?: number;
  purchaseOrderId?: number;
  bookInvoiceId?: number;
  payee: string;
  description?: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paymentReference?: string;
  paymentDate: Date;
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
  notes?: string;
}

export interface UpdatePaymentDto {
  payee?: string;
  description?: string;
  amount?: number;
  status?: string;
  paymentMethod?: string;
  paymentReference?: string;
  bankReference?: string;
  paymentDate?: Date;
  processedDate?: Date;
  bankName?: string;
  accountNumber?: string;
  branchCode?: string;
  notes?: string;
}
