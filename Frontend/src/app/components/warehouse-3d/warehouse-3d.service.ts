import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { WarehouseBox3D, Warehouse3DViewData, DEFAULT_CONFIG, BoxStatus } from './models';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class Warehouse3DService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Get 3D view data for a warehouse
   * Currently returns mock data, ready to connect to API
   */
  getWarehouse3DView(warehouseId: number): Observable<Warehouse3DViewData> {
    // TODO: Uncomment when API is ready
    // return this.http.get<Warehouse3DViewData>(`${this.apiUrl}/warehouse/${warehouseId}/3dview`);
    
    // Mock data for development
    return of(this.generateMockData(warehouseId)).pipe(delay(300));
  }

  /**
   * Generate mock warehouse data for testing
   */
  private generateMockData(warehouseId: number): Warehouse3DViewData {
    const boxes: WarehouseBox3D[] = [];
    const statuses: BoxStatus[] = ['Active', 'LowStock', 'Empty', 'Blocked'];
    
    let boxId = 1;
    
    // Generate a grid of boxes with random stacking
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 20; col++) {
        // Random chance to have boxes at this position (80% filled)
        if (Math.random() < 0.8) {
          // Random stack height 1-3
          const maxStack = Math.floor(Math.random() * 3) + 1;
          
          for (let stack = 1; stack <= maxStack; stack++) {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            
            boxes.push({
              id: `BOX-${boxId.toString().padStart(4, '0')}`,
              label: `Item ${boxId}`,
              position: { x: col, y: row },
              stackLevel: stack,
              status: status,
              quantity: Math.floor(Math.random() * 100) + 1,
              sku: `SKU-${col.toString().padStart(2, '0')}${row.toString().padStart(2, '0')}${stack}`,
              commodityName: this.getRandomCommodity(),
              binLocation: `${String.fromCharCode(65 + row)}${col + 1}-L${stack}`
            });
            
            boxId++;
          }
        }
      }
    }

    return {
      warehouseId,
      warehouseName: `Warehouse ${warehouseId}`,
      boxes,
      config: { ...DEFAULT_CONFIG }
    };
  }

  private getRandomCommodity(): string {
    const commodities = [
      'Steel Pipes', 'Copper Wire', 'Cement Bags', 'Paint Buckets',
      'Electrical Panels', 'PVC Fittings', 'Lumber Planks', 'Roof Tiles',
      'Glass Sheets', 'Insulation Rolls', 'Metal Frames', 'Concrete Blocks'
    ];
    return commodities[Math.floor(Math.random() * commodities.length)];
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
