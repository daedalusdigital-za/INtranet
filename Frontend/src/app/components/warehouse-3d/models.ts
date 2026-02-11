/**
 * Warehouse 3D Models
 * Data interfaces for the 3D warehouse visualization
 */

// API response format (matches backend DTO)
export interface Warehouse3DBoxApiResponse {
  id: string;
  label: string;
  positionX: number;
  positionY: number;
  stackLevel: number;
  status: 'Active' | 'LowStock' | 'Empty' | 'Blocked';
  quantity?: number;
  sku?: string;
  commodityName?: string;
  binLocation?: string;
}

// Internal format used by Three.js component
export interface WarehouseBox3D {
  id: string;
  label: string;
  position: { x: number; y: number };
  stackLevel: number; // 1, 2, or 3
  status: 'Active' | 'LowStock' | 'Empty' | 'Blocked';
  quantity?: number;
  sku?: string;
  commodityName?: string;
  binLocation?: string;
}

export interface Warehouse3DConfig {
  gridColumns: number;
  gridRows: number;
  boxWidth: number;
  boxDepth: number;
  boxHeight: number;
  gridSpacing: number;
  aisleColumns?: number[]; // Columns reserved for forklift aisles
}

// API response format
export interface Warehouse3DViewApiResponse {
  warehouseId: number;
  warehouseName: string;
  boxes: Warehouse3DBoxApiResponse[];
  config: Warehouse3DConfig;
}

// Internal format used by component
export interface Warehouse3DViewData {
  warehouseId: number;
  warehouseName: string;
  boxes: WarehouseBox3D[];
  config: Warehouse3DConfig;
}

export const DEFAULT_CONFIG: Warehouse3DConfig = {
  gridColumns: 20,
  gridRows: 10,
  boxWidth: 1,
  boxDepth: 1,
  boxHeight: 1,
  gridSpacing: 0.2,
  aisleColumns: [8, 16] // Default aisle columns
};

// Status color mapping for Three.js materials
export const STATUS_COLORS = {
  Active: 0x4CAF50,   // Green
  LowStock: 0xFFC107, // Yellow
  Empty: 0xF44336,    // Red
  Blocked: 0x9E9E9E   // Gray
} as const;

export type BoxStatus = keyof typeof STATUS_COLORS;

// Building interface for building selector
export interface WarehouseBuilding {
  id: number;
  warehouseId: number;
  code: string;
  name: string;
  address?: string;
  managerName?: string;
  phoneNumber?: string;
  totalCapacity?: number;
  availableCapacity?: number;
  itemCount: number;
}

// Transfer DTO for inter-building transfers
export interface BuildingTransferDto {
  fromBuildingId: number;
  toBuildingId: number;
  inventoryItemId: number;
  quantity: number;
}
