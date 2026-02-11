import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ElementRef, 
  ViewChild, 
  AfterViewInit,
  HostListener,
  signal,
  computed,
  Output,
  EventEmitter
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { Warehouse3DService } from './warehouse-3d.service';
import { 
  WarehouseBox3D, 
  Warehouse3DViewData, 
  STATUS_COLORS, 
  BoxStatus,
  Warehouse3DConfig 
} from './models';

// Cardboard box colors
const CARDBOARD_BASE = 0x8B6914;
const CARDBOARD_DARK = 0x6B4F12;
const CARDBOARD_LIGHT = 0xA67B1A;

@Component({
  selector: 'app-warehouse-3d',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTooltipModule,
    MatSlideToggleModule
  ],
  templateUrl: './warehouse-3d.component.html',
  styleUrls: ['./warehouse-3d.component.scss']
})
export class Warehouse3DComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef<HTMLDivElement>;

  // Event emitters
  @Output() boxSelected = new EventEmitter<WarehouseBox3D>();
  @Output() boxMoved = new EventEmitter<{ box: WarehouseBox3D; newPosition: { x: number; y: number } }>();

  // State
  isLoading = signal(true);
  warehouseName = signal('Warehouse 3D View');
  selectedBox = signal<WarehouseBox3D | null>(null);
  statusFilter = signal<BoxStatus | 'All'>('All');
  dragModeEnabled = signal(false);
  isDragging = signal(false);
  
  // Data
  private warehouseData: Warehouse3DViewData | null = null;
  private boxes: WarehouseBox3D[] = [];
  
  // Three.js objects
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  
  // Instanced mesh for boxes
  private boxMesh!: THREE.InstancedMesh;
  private boxGeometry!: THREE.BoxGeometry;
  private boxMaterials: Map<BoxStatus, THREE.MeshStandardMaterial> = new Map();
  private instanceToBoxMap: Map<number, WarehouseBox3D> = new Map();
  
  // Highlighted box
  private highlightMesh: THREE.Mesh | null = null;
  
  // Animation
  private animationId: number = 0;
  
  // Status filter options
  statusOptions: (BoxStatus | 'All')[] = ['All', 'Active', 'LowStock', 'Empty', 'Blocked'];

  constructor(
    private warehouse3DService: Warehouse3DService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Get warehouse ID from route params if available
    const warehouseId = this.route.snapshot.queryParams['warehouseId'] || 1;
    this.loadWarehouseData(warehouseId);
  }

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.animate();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.camera || !this.renderer || !this.canvasContainer) return;
    
    const container = this.canvasContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private initThreeJS(): void {
    const container = this.canvasContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    this.camera.position.set(15, 15, 15);
    this.camera.lookAt(10, 0, 5);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Prevent flipping under floor
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;
    this.controls.target.set(10, 0, 5);

    // Lighting
    this.setupLighting();

    // Floor
    this.createFloor();

    // Create materials for each status
    this.createMaterials();

    // Event listeners
    container.addEventListener('click', this.onCanvasClick.bind(this));
  }

  private setupLighting(): void {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Main directional light (overhead warehouse feel)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 30, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    this.scene.add(directionalLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x4a90d9, 0.3);
    fillLight.position.set(-10, 10, -10);
    this.scene.add(fillLight);
  }

  private createFloor(): void {
    // Main warehouse floor - concrete gray
    const floorGeometry = new THREE.PlaneGeometry(60, 40);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a3a4a,
      roughness: 0.9,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(15, -0.01, 8);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Grid helper
    const gridHelper = new THREE.GridHelper(60, 60, 0x555577, 0x444466);
    gridHelper.position.set(15, 0.01, 8);
    this.scene.add(gridHelper);

    // Create forklift aisles with yellow safety markings
    this.createAisles();

    // Create office area
    this.createOfficeArea();
  }

  private createAisles(): void {
    const aisleGeometry = new THREE.PlaneGeometry(2, 35);
    const aisleMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a5a,
      roughness: 0.95,
      metalness: 0.05
    });

    // Vertical aisles every 8 columns
    const aislePositions = [8, 16, 24];
    aislePositions.forEach(x => {
      const aisle = new THREE.Mesh(aisleGeometry, aisleMaterial);
      aisle.rotation.x = -Math.PI / 2;
      aisle.position.set(x * 1.2, 0.02, 6);
      aisle.receiveShadow = true;
      this.scene.add(aisle);

      // Yellow safety lines
      this.createSafetyLine(x * 1.2 - 0.9, 6, 35, false);
      this.createSafetyLine(x * 1.2 + 0.9, 6, 35, false);
    });

    // Horizontal aisle at the front
    const frontAisle = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 2),
      aisleMaterial
    );
    frontAisle.rotation.x = -Math.PI / 2;
    frontAisle.position.set(12, 0.02, -2);
    frontAisle.receiveShadow = true;
    this.scene.add(frontAisle);

    // Safety lines for front aisle
    this.createSafetyLine(12, -1.1, 50, true);
    this.createSafetyLine(12, -2.9, 50, true);
  }

  private createSafetyLine(x: number, z: number, length: number, horizontal: boolean): void {
    const lineGeometry = horizontal 
      ? new THREE.PlaneGeometry(length, 0.1)
      : new THREE.PlaneGeometry(0.1, length);
    const lineMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFCC00,
      roughness: 0.5,
      metalness: 0.1
    });
    const line = new THREE.Mesh(lineGeometry, lineMaterial);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.03, z);
    this.scene.add(line);
  }

  private createOfficeArea(): void {
    const officeX = -8;
    const officeZ = 0;

    // Office floor
    const officeFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a5a6a, roughness: 0.7 })
    );
    officeFloor.rotation.x = -Math.PI / 2;
    officeFloor.position.set(officeX, 0.02, officeZ);
    officeFloor.receiveShadow = true;
    this.scene.add(officeFloor);

    // Desk
    const deskGroup = new THREE.Group();
    
    // Desk top
    const deskTop = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.6 })
    );
    deskTop.position.set(0, 0.75, 0);
    deskTop.castShadow = true;
    deskGroup.add(deskTop);

    // Desk legs
    const legGeometry = new THREE.BoxGeometry(0.1, 0.75, 0.1);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
    [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      leg.position.set(x, 0.375, z);
      leg.castShadow = true;
      deskGroup.add(leg);
    });

    deskGroup.position.set(officeX, 0, officeZ);
    this.scene.add(deskGroup);

    // Computer monitor
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.4, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x2a2a2a })
    );
    monitor.position.set(officeX, 1.1, officeZ - 0.2);
    monitor.castShadow = true;
    this.scene.add(monitor);

    // Monitor screen (glowing)
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.35),
      new THREE.MeshBasicMaterial({ color: 0x3388ff })
    );
    screen.position.set(officeX, 1.1, officeZ - 0.175);
    this.scene.add(screen);

    // Chair
    const chairSeat = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    chairSeat.position.set(officeX, 0.5, officeZ + 0.8);
    chairSeat.castShadow = true;
    this.scene.add(chairSeat);

    const chairBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.6, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x333333 })
    );
    chairBack.position.set(officeX, 0.85, officeZ + 1.05);
    chairBack.castShadow = true;
    this.scene.add(chairBack);

    // Man figure (simplified)
    this.createManFigure(officeX, officeZ + 0.6);
  }

  private createManFigure(x: number, z: number): void {
    const manGroup = new THREE.Group();
    const skinColor = 0xE0AC69;
    const shirtColor = 0x2196F3;
    const pantsColor = 0x37474F;

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshStandardMaterial({ color: skinColor })
    );
    head.position.set(0, 1.5, 0);
    head.castShadow = true;
    manGroup.add(head);

    // Body/Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.45, 0.2),
      new THREE.MeshStandardMaterial({ color: shirtColor })
    );
    torso.position.set(0, 1.1, 0);
    torso.castShadow = true;
    manGroup.add(torso);

    // Arms
    const armGeometry = new THREE.BoxGeometry(0.1, 0.35, 0.1);
    const armMaterial = new THREE.MeshStandardMaterial({ color: shirtColor });
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.25, 1.1, 0);
    leftArm.castShadow = true;
    manGroup.add(leftArm);

    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.25, 1.1, 0);
    rightArm.rotation.x = -0.5; // Reaching toward desk
    rightArm.castShadow = true;
    manGroup.add(rightArm);

    // Legs
    const legGeometry = new THREE.BoxGeometry(0.12, 0.45, 0.12);
    const legMaterial = new THREE.MeshStandardMaterial({ color: pantsColor });
    
    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.1, 0.6, 0);
    leftLeg.rotation.x = Math.PI / 2; // Sitting
    leftLeg.castShadow = true;
    manGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.1, 0.6, 0);
    rightLeg.rotation.x = Math.PI / 2; // Sitting
    rightLeg.castShadow = true;
    manGroup.add(rightLeg);

    manGroup.position.set(x, 0, z);
    this.scene.add(manGroup);
  }

  private createMaterials(): void {
    const statuses: BoxStatus[] = ['Active', 'LowStock', 'Empty', 'Blocked'];
    statuses.forEach(status => {
      const material = new THREE.MeshStandardMaterial({
        color: STATUS_COLORS[status],
        roughness: 0.4,
        metalness: 0.1
      });
      this.boxMaterials.set(status, material);
    });
  }

  private loadWarehouseData(warehouseId: number): void {
    this.isLoading.set(true);
    
    this.warehouse3DService.getWarehouse3DView(warehouseId).subscribe({
      next: (data) => {
        this.warehouseData = data;
        this.warehouseName.set(data.warehouseName);
        this.boxes = data.boxes;
        this.renderBoxes();
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error loading warehouse data:', err);
        this.isLoading.set(false);
      }
    });
  }

  private renderBoxes(): void {
    // Remove existing meshes if any
    if (this.boxMesh) {
      this.scene.remove(this.boxMesh);
      this.boxMesh.geometry.dispose();
    }

    // Remove existing tape meshes
    this.scene.children
      .filter(child => child.userData['isTape'])
      .forEach(child => this.scene.remove(child));

    // Filter boxes based on status
    const filteredBoxes = this.statusFilter() === 'All' 
      ? this.boxes 
      : this.boxes.filter(b => b.status === this.statusFilter());

    if (filteredBoxes.length === 0) return;

    const config = this.warehouseData?.config || {
      boxWidth: 1,
      boxDepth: 1,
      boxHeight: 1,
      gridSpacing: 0.2
    };

    // Create geometry for cardboard boxes
    this.boxGeometry = new THREE.BoxGeometry(
      config.boxWidth * 0.9,
      config.boxHeight * 0.9,
      config.boxDepth * 0.9
    );

    // Cardboard brown material
    const cardboardMaterial = new THREE.MeshStandardMaterial({ 
      color: CARDBOARD_BASE,
      roughness: 0.8,
      metalness: 0.0
    });
    
    this.boxMesh = new THREE.InstancedMesh(
      this.boxGeometry,
      cardboardMaterial,
      filteredBoxes.length
    );
    this.boxMesh.castShadow = true;
    this.boxMesh.receiveShadow = true;

    // Position each instance and add colored tape
    const matrix = new THREE.Matrix4();
    this.instanceToBoxMap.clear();

    // Tape geometry for status indication
    const tapeGeometry = new THREE.PlaneGeometry(config.boxWidth * 0.8, 0.1);

    filteredBoxes.forEach((box, index) => {
      const cellSize = config.boxWidth + config.gridSpacing;
      const x = box.position.x * cellSize;
      const y = (box.stackLevel - 1) * config.boxHeight + config.boxHeight / 2;
      const z = box.position.y * cellSize;

      matrix.setPosition(x, y, z);
      this.boxMesh.setMatrixAt(index, matrix);

      // Map instance to box data
      this.instanceToBoxMap.set(index, box);

      // Add colored tape on top of box based on status
      const tapeMaterial = new THREE.MeshStandardMaterial({
        color: STATUS_COLORS[box.status],
        roughness: 0.3,
        metalness: 0.1
      });

      // Top tape
      const topTape = new THREE.Mesh(tapeGeometry, tapeMaterial);
      topTape.rotation.x = -Math.PI / 2;
      topTape.position.set(x, y + config.boxHeight * 0.45 + 0.01, z);
      topTape.userData['isTape'] = true;
      this.scene.add(topTape);

      // Front tape (vertical)
      const frontTapeGeom = new THREE.PlaneGeometry(0.1, config.boxHeight * 0.8);
      const frontTape = new THREE.Mesh(frontTapeGeom, tapeMaterial);
      frontTape.position.set(x, y, z - config.boxDepth * 0.45 - 0.01);
      frontTape.userData['isTape'] = true;
      this.scene.add(frontTape);
    });

    this.boxMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.boxMesh);
  }

  private onCanvasClick(event: MouseEvent): void {
    const container = this.canvasContainer.nativeElement;
    const rect = container.getBoundingClientRect();
    
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.boxMesh) {
      const intersects = this.raycaster.intersectObject(this.boxMesh);
      
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined) {
          const box = this.instanceToBoxMap.get(instanceId);
          if (box) {
            this.selectBox(box, instanceId);
          }
        }
      } else {
        this.clearSelection();
      }
    }
  }

  private selectBox(box: WarehouseBox3D, instanceId: number): void {
    this.selectedBox.set(box);
    console.log('Selected box:', box);

    // Remove previous highlight
    if (this.highlightMesh) {
      this.scene.remove(this.highlightMesh);
    }

    // Create highlight mesh
    const config = this.warehouseData?.config || { boxWidth: 1, boxDepth: 1, boxHeight: 1, gridSpacing: 0.2 };
    const highlightGeometry = new THREE.BoxGeometry(
      config.boxWidth * 1.05,
      config.boxHeight * 1.05,
      config.boxDepth * 1.05
    );
    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      side: THREE.BackSide
    });
    this.highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);

    // Position highlight at selected box
    const cellSize = config.boxWidth + config.gridSpacing;
    this.highlightMesh.position.set(
      box.position.x * cellSize,
      (box.stackLevel - 1) * config.boxHeight + config.boxHeight / 2,
      box.position.y * cellSize
    );

    this.scene.add(this.highlightMesh);
  }

  clearSelection(): void {
    this.selectedBox.set(null);
    if (this.highlightMesh) {
      this.scene.remove(this.highlightMesh);
      this.highlightMesh = null;
    }
  }

  onStatusFilterChange(): void {
    this.renderBoxes();
    this.clearSelection();
  }

  resetCamera(): void {
    this.camera.position.set(15, 15, 15);
    this.controls.target.set(10, 0, 5);
    this.controls.update();
  }

  fitToContent(): void {
    // Calculate bounds of all boxes
    if (!this.boxes.length) return;
    
    const config = this.warehouseData?.config || { boxWidth: 1, gridSpacing: 0.2 };
    const cellSize = config.boxWidth + config.gridSpacing;
    
    let maxX = 0, maxZ = 0, maxY = 0;
    this.boxes.forEach(box => {
      maxX = Math.max(maxX, box.position.x * cellSize);
      maxZ = Math.max(maxZ, box.position.y * cellSize);
      maxY = Math.max(maxY, box.stackLevel);
    });

    const centerX = maxX / 2;
    const centerZ = maxZ / 2;
    
    this.camera.position.set(centerX + 15, 12, centerZ + 15);
    this.controls.target.set(centerX, 0, centerZ);
    this.controls.update();
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    if (this.controls) {
      this.controls.update();
    }
    
    // Animate highlight
    if (this.highlightMesh) {
      this.highlightMesh.rotation.y += 0.01;
    }
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private cleanup(): void {
    // Cancel animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }

    // Dispose Three.js resources
    if (this.boxMesh) {
      this.boxMesh.geometry.dispose();
      (this.boxMesh.material as THREE.Material).dispose();
    }

    if (this.boxGeometry) {
      this.boxGeometry.dispose();
    }

    this.boxMaterials.forEach(material => material.dispose());
    this.boxMaterials.clear();

    if (this.highlightMesh) {
      this.highlightMesh.geometry.dispose();
      (this.highlightMesh.material as THREE.Material).dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.domElement.remove();
    }

    if (this.controls) {
      this.controls.dispose();
    }

    // Clear scene
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }

    this.instanceToBoxMap.clear();
  }

  getStatusColor(status: BoxStatus): string {
    const colors = {
      Active: '#4CAF50',
      LowStock: '#FFC107',
      Empty: '#F44336',
      Blocked: '#9E9E9E'
    };
    return colors[status];
  }

  goBack(): void {
    this.router.navigate(['/stock-management']);
  }
}
