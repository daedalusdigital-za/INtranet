import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { WarehouseBox3D, Warehouse3DViewData, Warehouse3DViewApiResponse, DEFAULT_CONFIG, BoxStatus, WarehouseBuilding, BuildingTransferDto } from './models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Warehouse3DService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get all buildings for a warehouse
   */
  getWarehouseBuildings(warehouseId: number): Observable<WarehouseBuilding[]> {
    return this.http.get<WarehouseBuilding[]>(`${this.apiUrl}/warehouses/${warehouseId}/buildings`);
  }

  /**
   * Get 3D view data for a warehouse from API (all buildings combined)
   */
  getWarehouse3DView(warehouseId: number): Observable<Warehouse3DViewData> {
    return this.http.get<Warehouse3DViewApiResponse>(`${this.apiUrl}/warehouses/${warehouseId}/3dview`).pipe(
      map(response => this.transformApiResponse(response))
    );
  }

  /**
   * Get 3D view data for a specific building
   */
  getBuilding3DView(buildingId: number): Observable<Warehouse3DViewData> {
    return this.http.get<Warehouse3DViewApiResponse>(`${this.apiUrl}/warehouses/buildings/${buildingId}/3dview`).pipe(
      map(response => this.transformApiResponse(response))
    );
  }

  /**
   * Transform API response to internal format used by Three.js component
   */
  private transformApiResponse(response: Warehouse3DViewApiResponse): Warehouse3DViewData {
    return {
      warehouseId: response.warehouseId,
      warehouseName: response.warehouseName,
      boxes: response.boxes.map(box => ({
        id: box.id,
        label: box.label,
        position: { x: box.positionX, y: box.positionY },
        stackLevel: box.stackLevel,
        status: box.status as BoxStatus,
        quantity: box.quantity,
        sku: box.sku,
        commodityName: box.commodityName,
        binLocation: box.binLocation
      })),
      config: response.config || { ...DEFAULT_CONFIG }
    };
  }

  /**
   * Update box position in the warehouse
   */
  updateBoxPosition(boxId: string, positionX: number, positionY: number): Observable<void> {
    // Extract inventory ID from box ID (format: INV-0001)
    const inventoryId = boxId.replace('INV-', '');
    return this.http.put<void>(`${this.apiUrl}/inventory/${inventoryId}/position`, {
      positionX,
      positionY
    });
  }

  /**
   * Transfer inventory item between buildings
   */
  transferBetweenBuildings(transfer: BuildingTransferDto): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/inventory/transfer-building`, transfer);
  }

  /**
   * Placeholder for WebSocket live updates
   * TODO: Implement when WebSocket service is ready
   */
  subscribeToUpdates(warehouseId: number): Observable<WarehouseBox3D[]> {
    // Placeholder for WebSocket subscription
    return of([]);
  }
}
