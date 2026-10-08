// ============================================================
// Shared logistics domain models â€” extracted from the former
// 36k-line logistics-dashboard.component.ts during the split.
// ============================================================

export interface DashboardStats {
  activeLoads: number;
  inTransit: number;
  delivered: number;
  pending: number;
  totalVehicles: number;
  availableVehicles: number;
  totalDrivers: number;
  availableDrivers: number;
  vehiclesInMaintenance: number;
  upcomingMaintenance: number;
  pendingInvoices: number;
  overdueInvoices: number;
}

export interface ActiveLoad {
  id: number;
  loadNumber: string;
  customerName: string;
  origin: string;
  destination: string;
  status: string;
  vehicleRegistration: string;
  driverName: string;
  scheduledDate?: Date;
  scheduledDelivery: Date;
  progress: number;
}

export interface Vehicle {
  id: number;
  registrationNumber: string;
  type: string;
  vehicleTypeName?: string;
  status: string;
  currentDriver: string;
  currentDriverId?: number;
  currentDriverName?: string;
  province?: string;
  lastLocation: string;
  fuelLevel: number;
  fuelCapacity?: number;
  speed?: number;
  latitude?: number;
  longitude?: number;
  heading?: number;
  lastUpdate?: Date;
  liveStatus?: string;  // moving, stopped, idling, offline
  // CarTrack integration
  carTrackId?: string;
  isLinkedToCarTrack?: boolean;
  // TFN integration
  tfnVehicleId?: string;
  tfnSubAccountNumber?: string;
  tfnVirtualCardNumber?: string;
  tfnCreditLimit?: number;
  tfnCurrentBalance?: number;
  tfnLastSyncedAt?: Date;
  tankSize?: number;
  fuelType?: string;
  averageFuelConsumption?: number;
  isLinkedToTfn?: boolean;
  // Additional fields for edit
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  vinNumber?: string;
  vehicleTypeId?: number;
}

export interface ImportedInvoice {
  id: number;
  transactionNumber: string;
  customerNumber: string;
  customerName: string;
  productCode: string;
  productDescription: string;
  transactionDate: Date;
  quantity: number;
  salesAmount: number;
  costOfSales: number;
  status: string;
  sourceSystem: string;
  deliveryProvince?: string;
  deliveryCity?: string;
  deliveryAddress?: string;
  importBatchId?: string;
  loadId?: number;
  importedAt: Date;
}

export interface MaintenanceRecord {
  id: number;
  vehicleId: number;
  vehicleReg: string;
  vehicleRegistration?: string;
  vehicleType: string;
  maintenanceType: string;
  description: string;
  status: string;
  priority: string;
  scheduledDate: Date;
  completedDate?: Date;
  estimatedCost?: number;
  cost?: number;
  actualCost?: number;
  odometerReading?: number;
  assignedTo?: string;
  actionOwner?: string;
  province?: string;
  feedback?: string;
  dateStood?: Date;
  targetDate?: Date;
  daysStanding?: number;
  serviceProvider?: string;
  notes?: string;
  licenseExpiryDate?: Date;
  daysUntilExpiry?: number;
  proofOfWorkPath?: string;
  proofOfPaymentPath?: string;
}

export interface DeliveryRequest {
  id: number;
  referenceNumber: string;
  department: string;
  scent?: string;
  type?: string;
  batchCode?: string;
  invoiceNumber?: string;
  description?: string;
  quantity: number;
  unitOfMeasure: string;
  deliveryAddress?: string;
  notes?: string;
  priority: string;
  status: string;
  requestedDate: string;
  requestedBy?: string;
  approvedDate?: string;
  deliveredDate?: string;
  handledBy?: string;
  createdAt: string;
}

export interface DeliveryRequestSummary {
  total: number;
  pending: number;
  approved: number;
  inTransit: number;
  delivered: number;
}

