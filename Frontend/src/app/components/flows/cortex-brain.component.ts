import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { CortexHow, CortexNode } from './cortex-model';

/** What the brain needs to know about a node, on top of the map model. */
export interface BrainNode extends CortexNode {
  /** People in this department (departments only). */
  people?: number;
  /** People with their own flow (departments only). */
  mapped?: number;
  /** Live flows touching this node. */
  flows?: number;
  /** Runs open right now. */
  runs?: number;
  /** Server gaps on this node. */
  gaps?: number;
}
export interface BrainEdge { from: string; to: string; label: string; how: CortexHow | 'works'; }

interface Body { key: string; node: BrainNode; g: THREE.Group; pick: THREE.Mesh; spinner: THREE.Object3D; halo: THREE.Object3D; mats: THREE.Material[]; label: CSS2DObject; home: THREE.Vector3; ring: THREE.Object3D | null; drop: THREE.Line; size: number; }
interface Wire { edge: BrainEdge; curve: THREE.QuadraticBezierCurve3; line: THREE.Line; mat: THREE.LineBasicMaterial; sparks: THREE.Points | null; }

const HOW_COLOR: Record<string, number> = { code: 0x34d399, manual: 0xf5b942, read: 0x60a5fa, gap: 0xf87171, works: 0x8b9bc4 };
const FLOOR_Y = -16;

/** Flat outline of a regular polygon (sides = 0 → circle), in the XY plane. */
function poly(sides: number, r: number, color: THREE.ColorRepresentation, opacity = 1, rot = 0) {
  const n = sides || 64, pts: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; pts.push(new THREE.Vector3(r * Math.cos(a), r * Math.sin(a), 0)); }
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}
/** Ring of short radial ticks (gauge look), in the XY plane. */
function ticks(count: number, r: number, len: number, color: THREE.ColorRepresentation, opacity = 1, every = 1) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) { if (i % every) continue; const a = (i / count) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); pts.push(new THREE.Vector3(r * c, r * s, 0), new THREE.Vector3((r + len) * c, (r + len) * s, 0)); }
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
}
/** Soft glowing disc that always faces the camera. */
function glow(color: string, size: number, opacity = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d')!;
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, color); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s;
}

/**
 * Cortex as a living thing: Welly at the centre, the intranet's modules orbiting it, departments and the outside
 * world further out, people as dust around their department, and work travelling along the hand-offs as light.
 * Drag to orbit, scroll to zoom, hover to light up a node's neighbourhood, click to inspect, double-click to fly in.
 */
@Component({
  selector: 'app-cortex-brain',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  template: `
    <div #host class="cb-host" (pointermove)="onMove($event)" (pointerdown)="onDown($event)" (pointerup)="onUp($event)" (dblclick)="onDbl($event)" (pointerleave)="hoverKey.set(null)"></div>
    <div class="cb-ctl">
      <button (click)="zoom(0.8)" matTooltip="Zoom in" aria-label="Zoom in"><mat-icon>add</mat-icon></button>
      <button (click)="zoom(1.25)" matTooltip="Zoom out" aria-label="Zoom out"><mat-icon>remove</mat-icon></button>
      <button (click)="home()" matTooltip="Back to the whole picture" aria-label="Home"><mat-icon>fit_screen</mat-icon></button>
      <button [class.on]="spin()" (click)="spin.set(!spin())" [matTooltip]="spin() ? 'Stop turning' : 'Turn slowly'" aria-label="Auto-rotate"><mat-icon>{{ spin() ? 'pause' : '3d_rotation' }}</mat-icon></button>
      <button [class.on]="showPeople()" (click)="showPeople.set(!showPeople())" matTooltip="People as dust around their department" aria-label="People"><mat-icon>groups</mat-icon></button>
    </div>
    <div class="cb-hint"><mat-icon>touch_app</mat-icon>Drag to turn · scroll to zoom · hover to light up · click to inspect · double-click to fly in</div>
    @if (hoverKey(); as k) { @if (tip(); as t) { <div class="cb-tip" [style.left.px]="tipPos().x" [style.top.px]="tipPos().y" [style.--c]="t.color"><b>{{ t.label }}</b><small>{{ t.sub }}</small></div> } }
  `,
  styles: [`
    :host { position: relative; display: block; width: 100%; height: 76vh; min-height: 520px; border-radius: 12px; overflow: hidden; background: radial-gradient(ellipse at 50% 30%, #0b1733 0%, #050a18 55%, #02050d 100%); }
    .cb-host { position: absolute; inset: 0; cursor: grab; touch-action: none; }
    .cb-host:active { cursor: grabbing; }
    :host ::ng-deep .cb-label { pointer-events: none; white-space: nowrap; font: 600 11px/1.2 Inter, system-ui, sans-serif; color: #dbe4ff; text-shadow: 0 1px 6px rgba(0,0,0,.9), 0 0 2px rgba(0,0,0,1); letter-spacing: .01em; transform: translateY(-2px); transition: opacity .25s, color .25s; }
    :host ::ng-deep .cb-label.dim { opacity: .18; }
    :host ::ng-deep .cb-label.lit { color: #fff; font-size: 12px; }
    :host ::ng-deep .cb-label small { display: block; font-weight: 500; font-size: 9.5px; color: #9fb0d8; }
    :host ::ng-deep .cb-label.welly { font-size: 15px; letter-spacing: .14em; text-transform: uppercase; color: #ffe7b0; text-shadow: 0 0 18px rgba(245,185,66,.9), 0 1px 6px rgba(0,0,0,.9); }
    :host ::ng-deep .cb-label.welly small { color: #f5b942; letter-spacing: .04em; text-transform: none; }
    .cb-ctl { position: absolute; right: 12px; top: 12px; display: flex; flex-direction: column; gap: 2px; padding: 4px; border-radius: 12px; background: rgba(8,15,35,.85); border: 1px solid rgba(120,140,200,.25); backdrop-filter: blur(6px); z-index: 2;
      button { width: 30px; height: 30px; border: 0; border-radius: 8px; background: transparent; color: #c7d2ee; cursor: pointer; display: grid; place-items: center;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &:hover { background: rgba(120,140,200,.18); color: #fff; }
        &.on { color: #f5b942; background: rgba(245,185,66,.12); } } }
    .cb-hint { position: absolute; left: 12px; top: 12px; display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; background: rgba(8,15,35,.75); border: 1px solid rgba(120,140,200,.25); color: #8b9bc4; font-size: 11px; z-index: 2; pointer-events: none;
      mat-icon { font-size: 14px; width: 14px; height: 14px; } }
    .cb-tip { position: absolute; z-index: 3; pointer-events: none; transform: translate(14px, 14px); padding: 6px 10px; border-radius: 8px; background: rgba(6,11,26,.92); border: 1px solid var(--c, #8b9bc4); box-shadow: 0 0 18px -4px var(--c, #8b9bc4); color: #fff; font-size: 12px; max-width: 260px;
      b { display: block; } small { color: #9fb0d8; font-size: 11px; } }
  `]
})
export class CortexBrainComponent implements AfterViewInit, OnDestroy {
  nodes = input<BrainNode[]>([]);
  edges = input<BrainEdge[]>([]);
  selected = input<string | null>(null);
  /** Keys that belong to the followed process stream (in order), or null. */
  stream = input<string[] | null>(null);
  select = output<string | null>();
  dive = output<string>();

  spin = signal(true);
  showPeople = signal(true);
  hoverKey = signal<string | null>(null);
  tipPos = signal({ x: 0, y: 0 });
  tip = signal<{ label: string; sub: string; color: string } | null>(null);

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private zone = inject(NgZone);
  private renderer!: THREE.WebGLRenderer;
  private labels!: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private ray = new THREE.Raycaster();
  private clock = new THREE.Clock();
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private bodies = new Map<string, Body>();
  private wires: Wire[] = [];
  private welly!: THREE.Group;
  private wellyFace!: THREE.Group;            // billboarded part: hexes, ticks, core glow
  private wellySpin: { o: THREE.Object3D; v: number }[] = [];
  private wellyCore!: THREE.Sprite;
  private wellyPick!: THREE.Mesh;
  private wellyRings: THREE.Object3D[] = [];
  private wellyDust!: THREE.Points;
  private peopleDust: THREE.Points[] = [];
  private stars!: THREE.Points;
  private floor!: THREE.Group;
  private pickables: THREE.Object3D[] = [];
  private camTarget: { pos: THREE.Vector3; look: THREE.Vector3; t: number } | null = null;
  private downAt: { x: number; y: number } | null = null;
  private ready = false;
  private idleFor = 0;

  private _rebuild = effect(() => { const n = this.nodes(), e = this.edges(); const p = this.showPeople(); if (this.ready) this.build(n, e, p); });
  private _light = effect(() => { this.selected(); this.hoverKey(); this.stream(); if (this.ready) this.relight(); });
  private _fly = effect(() => { const k = this.selected(); if (this.ready && k) this.flyTo(k, false); });

  ngAfterViewInit() {
    const el = this.host().nativeElement;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);
    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    el.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 600);
    this.camera.position.set(0, 42, 92);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false; this.controls.minDistance = 14; this.controls.maxDistance = 220;
    this.controls.maxPolarAngle = Math.PI * 0.62; this.controls.minPolarAngle = Math.PI * 0.12;
    this.controls.addEventListener('start', () => { this.camTarget = null; this.idleFor = 0; });

    this.scene.fog = new THREE.FogExp2(0x050a18, 0.004);

    this.buildStars(); this.buildFloor(); this.buildWelly();
    this.ready = true;
    this.build(this.nodes(), this.edges(), this.showPeople());
    this.resize();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el);
    this.zone.runOutsideAngular(() => this.loop());
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf); this.ro?.disconnect(); this.controls?.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose?.(); });
    this.renderer?.dispose(); this.renderer?.domElement.remove(); this.labels?.domElement.remove();
  }

  // ── scene building ─────────────────────────────────────────────────────────

  private buildStars() {
    const n = 1400, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 180 + Math.random() * 220, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), Math.abs(r * Math.cos(ph)) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3);
      const c = new THREE.Color().setHSL(0.58 + Math.random() * 0.1, 0.6, 0.5 + Math.random() * 0.4); col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.8, vertexColors: true, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false }));
    this.scene.add(this.stars);
  }

  /** The floor: a fading grid, the three orbit rings the nodes sit over, and radial spokes. */
  private buildFloor() {
    this.floor = new THREE.Group(); this.floor.position.y = FLOOR_Y;
    const grid = new THREE.GridHelper(200, 40, 0x1b3a6b, 0x0e1f3f); (grid.material as THREE.Material).transparent = true; (grid.material as THREE.Material).opacity = 0.35; (grid.material as THREE.Material).depthWrite = false;
    this.floor.add(grid);
    for (const [r, c, o] of [[19, 0x22d3ee, 0.35], [36, 0xa78bfa, 0.3], [50, 0x64748b, 0.25]] as [number, number, number][]) {
      const ring = poly(0, r, c, o); ring.rotation.x = -Math.PI / 2; this.floor.add(ring);
      const tk = ticks(72, r, 0.6, c, o * 0.8, 1); tk.rotation.x = -Math.PI / 2; this.floor.add(tk);
    }
    const spokes = ticks(12, 8, 48, 0x1e3a6a, 0.35); spokes.rotation.x = -Math.PI / 2; this.floor.add(spokes);
    const core = poly(6, 8, 0xf5b942, 0.3); core.rotation.x = -Math.PI / 2; this.floor.add(core);
    this.scene.add(this.floor);
  }

  private buildWelly() {
    this.welly = new THREE.Group(); this.welly.name = 'welly';
    // facing part: glowing core, nested hexagons turning against each other, gauge ticks
    this.wellyFace = new THREE.Group();
    this.wellyCore = glow('rgba(255,215,122,1)', 9, 0.95); this.wellyFace.add(this.wellyCore);
    this.wellyFace.add(glow('rgba(245,185,66,0.5)', 22, 0.35));
    const hexA = poly(6, 4.2, 0xffe7b0, 0.95), hexB = poly(6, 5.6, 0xf5b942, 0.7, Math.PI / 6), hexC = poly(6, 7.4, 0xf5b942, 0.35);
    const tA = ticks(60, 6.3, 0.5, 0xffe7b0, 0.8, 1), tB = ticks(24, 8.2, 1.1, 0x22d3ee, 0.7, 1), arc = ticks(120, 9.4, 0.25, 0xf5b942, 0.5, 1);
    this.wellyFace.add(hexA, hexB, hexC, tA, tB, arc);
    this.wellySpin = [{ o: hexA, v: 0.35 }, { o: hexB, v: -0.22 }, { o: hexC, v: 0.12 }, { o: tA, v: -0.5 }, { o: tB, v: 0.3 }, { o: arc, v: -0.08 }];
    this.welly.add(this.wellyFace);
    // three tilted orbit rings that live in real 3D (this is what gives the space depth when you turn it)
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const ring = poly(0, 11 + i * 2.2, i === 1 ? 0x22d3ee : 0xf5b942, 0.5 - i * 0.12); g.add(ring);
      const sat = glow(i === 1 ? 'rgba(103,232,249,1)' : 'rgba(255,231,176,1)', 1.6, 0.9); sat.position.set(11 + i * 2.2, 0, 0); g.add(sat);
      g.rotation.set(Math.PI / 2 + (i - 1) * 0.45, i * 0.7, 0); this.wellyRings.push(g); this.welly.add(g);
    }
    const n = 360, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const r = 6 + Math.random() * 6, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1); pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.wellyDust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe2a8, size: 0.2, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.welly.add(this.wellyDust);
    const lbl = this.makeLabel('Welly', 'the company brain · reads everything', 'welly'); lbl.position.set(0, -11.5, 0); this.welly.add(lbl);
    this.wellyPick = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 8), new THREE.MeshBasicMaterial({ visible: false })); this.wellyPick.userData['key'] = 'welly'; this.welly.add(this.wellyPick);
    // light pillar from floor to Welly
    const pillar = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, FLOOR_Y, 0), new THREE.Vector3(0, -6, 0)]), new THREE.LineBasicMaterial({ color: 0xf5b942, transparent: true, opacity: 0.35 }));
    this.welly.add(pillar);
    this.pickables.push(this.wellyPick);
    this.scene.add(this.welly);
  }

  private makeLabel(text: string, sub: string | null, cls = '') {
    const div = document.createElement('div'); div.className = 'cb-label ' + cls; div.textContent = text;
    if (sub) { const s = document.createElement('small'); s.textContent = sub; div.appendChild(s); }
    return new CSS2DObject(div);
  }

  /** Lay out: modules on an inner ring, departments on a lower outer ring, sources on an upper far ring. */
  private layout(nodes: BrainNode[]) {
    const out = new Map<string, THREE.Vector3>();
    const place = (list: BrainNode[], r: number, y: number, phase: number, wobble: number) => {
      const n = list.length; list.forEach((nd, i) => { const a = phase + (i / Math.max(1, n)) * Math.PI * 2; out.set(nd.key, new THREE.Vector3(r * Math.cos(a), y + Math.sin(a * 3 + i) * wobble, r * Math.sin(a))); });
    };
    place(nodes.filter(n => n.layer === 'module'), 19, 0, -Math.PI / 2, 1.6);
    place(nodes.filter(n => n.layer === 'dept'), 36, -7, -Math.PI / 2 + 0.2, 1.2);
    place(nodes.filter(n => n.layer === 'source'), 50, 9, -Math.PI / 2 - 0.3, 0.8);
    return out;
  }

  private build(nodes: BrainNode[], edges: BrainEdge[], people: boolean) {
    for (const b of this.bodies.values()) { this.scene.remove(b.g, b.label, b.drop); b.g.traverse(o => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); }); b.mats.forEach(m => m.dispose()); b.drop.geometry.dispose(); b.label.element.remove(); }
    for (const w of this.wires) { this.scene.remove(w.line); if (w.sparks) this.scene.remove(w.sparks); w.line.geometry.dispose(); w.mat.dispose(); }
    for (const p of this.peopleDust) { this.scene.remove(p); p.geometry.dispose(); }
    this.bodies.clear(); this.wires = []; this.peopleDust = []; this.pickables = [this.wellyPick];
    const homes = this.layout(nodes);

    for (const nd of nodes) {
      const home = homes.get(nd.key)!; const color = new THREE.Color(nd.color); const hex = '#' + color.getHexString();
      const size = nd.layer === 'module' ? 2.2 + Math.min(1.2, (nd.flows ?? 0) * 0.12) : nd.layer === 'dept' ? 1.9 + Math.min(1.6, (nd.people ?? 0) * 0.06) : 1.7;
      const sides = nd.layer === 'module' ? 6 : nd.layer === 'dept' ? 4 : 3;
      const g = new THREE.Group(); g.position.copy(home);
      const outline = poly(sides, size, color, 0.95, sides === 4 ? Math.PI / 4 : sides === 3 ? Math.PI / 2 : 0);
      const inner = poly(sides, size * 0.55, color, 0.5, sides === 4 ? Math.PI / 4 : sides === 3 ? Math.PI / 2 : 0);
      const spinner = ticks(sides === 6 ? 36 : 24, size * 1.25, 0.35, color, 0.6, 1);
      const dot = glow(hex, size * 1.1, 0.9);
      const halo = poly(0, size * 1.75, color, 0); // lights up on hover/select
      g.add(outline, inner, spinner, dot, halo);
      if (nd.gaps) { const warn = poly(3, 0.7, 0xfb923c, 0.95, Math.PI / 2); warn.position.set(size * 0.95, size * 0.95, 0); g.add(warn); }
      let ring: THREE.Object3D | null = null;
      if (nd.runs) { ring = ticks(48, size * 1.5, 0.3, 0x22d3ee, 0.9, 2); g.add(ring); }
      const pick = new THREE.Mesh(new THREE.SphereGeometry(size * 1.2, 8, 8), new THREE.MeshBasicMaterial({ visible: false })); pick.userData['key'] = nd.key; g.add(pick);
      const mats: THREE.Material[] = [outline.material as THREE.Material, inner.material as THREE.Material, spinner.material as THREE.Material, dot.material];
      const drop = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(home.x, FLOOR_Y, home.z), new THREE.Vector3(home.x, home.y - size, home.z)]), new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }));
      const sub = nd.layer === 'dept' ? `${nd.people ?? 0} people${nd.mapped ? ` · ${nd.mapped} mapped` : ''}${nd.gaps ? ` · ${nd.gaps} gap${nd.gaps > 1 ? 's' : ''}` : ''}`
        : nd.layer === 'module' ? `${nd.flows ?? 0} flow${nd.flows === 1 ? '' : 's'}${nd.runs ? ` · ${nd.runs} live` : ''}${nd.gaps ? ` · ${nd.gaps} gap${nd.gaps > 1 ? 's' : ''}` : ''}` : 'outside source';
      const label = this.makeLabel(nd.short ?? nd.label, sub); label.position.copy(home).add(new THREE.Vector3(0, -(size * 1.3 + 1.2), 0));
      this.scene.add(g, label, drop); this.pickables.push(pick);
      this.bodies.set(nd.key, { key: nd.key, node: nd, g, pick, spinner, halo, mats, label, home, ring, drop, size });

      if (people && nd.layer === 'dept' && nd.people) {
        const n = Math.min(60, nd.people), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), lit = new THREE.Color(nd.color), dim = new THREE.Color(0x56638a);
        for (let i = 0; i < n; i++) {
          const r = size + 1.2 + Math.random() * 2.6, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
          pos.set([home.x + r * Math.sin(ph) * Math.cos(th), home.y + r * Math.cos(ph) * 0.6, home.z + r * Math.sin(ph) * Math.sin(th)], i * 3);
          const c = i < (nd.mapped ?? 0) ? lit : dim; col.set([c.r, c.g, c.b], i * 3);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.34, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })); pts.userData['home'] = home.clone();
        this.scene.add(pts); this.peopleDust.push(pts);
      }
    }

    // Welly → every module: faint threads, Welly reads everything.
    for (const nd of nodes.filter(n => n.layer === 'module')) this.addWire({ from: 'welly', to: nd.key, label: 'Welly reads', how: 'read' }, new THREE.Vector3(0, 0, 0), homes.get(nd.key)!, 0.10, false);
    for (const e of edges) { const a = homes.get(e.from), b = homes.get(e.to); if (a && b) this.addWire(e, a, b, e.how === 'works' ? 0.10 : 0.32, e.how === 'code'); }
    this.relight();
  }

  private addWire(edge: BrainEdge, a: THREE.Vector3, b: THREE.Vector3, opacity: number, sparks: boolean) {
    const mid = a.clone().add(b).multiplyScalar(0.5); const lift = a.distanceTo(b) * 0.22;
    mid.y += lift; mid.multiplyScalar(edge.from === 'welly' ? 1 : 1.06);
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
    const mat = edge.how === 'manual' || edge.how === 'gap'
      ? new THREE.LineDashedMaterial({ color: HOW_COLOR[edge.how], transparent: true, opacity, depthWrite: false, dashSize: edge.how === 'gap' ? 0.6 : 1.4, gapSize: 0.8 })
      : new THREE.LineBasicMaterial({ color: HOW_COLOR[edge.how] ?? 0x8b9bc4, transparent: true, opacity, depthWrite: false });
    const line = new THREE.Line(geo, mat); line.computeLineDistances(); line.userData['base'] = opacity; this.scene.add(line);
    let pts: THREE.Points | null = null;
    if (sparks) {
      const n = 3, pos = new Float32Array(n * 3); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9df7cf, size: 0.55, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
      pts.userData['phase'] = Math.random(); this.scene.add(pts);
    }
    this.wires.push({ edge, curve, line, mat, sparks: pts });
  }

  /** Dim everything that is not near the hovered / selected node or on the followed stream. */
  private relight() {
    const focus = this.hoverKey() ?? this.selected(); const stream = this.stream();
    const near = new Set<string>(); if (focus) { near.add(focus); for (const w of this.wires) { if (w.edge.from === focus) near.add(w.edge.to); if (w.edge.to === focus) near.add(w.edge.from); } }
    const streamSet = stream ? new Set(stream) : null;
    for (const b of this.bodies.values()) {
      const on = streamSet ? streamSet.has(b.key) : focus ? near.has(b.key) : true;
      const isFocus = b.key === focus || b.key === this.selected();
      const base = [0.95, 0.5, 0.6, 0.9];
      b.mats.forEach((m, i) => { (m as THREE.LineBasicMaterial).opacity = on ? base[i] * (isFocus ? 1 : 1) : base[i] * 0.15; });
      ((b.halo as THREE.LineLoop).material as THREE.LineBasicMaterial).opacity = isFocus ? 0.9 : 0;
      (b.drop.material as THREE.LineBasicMaterial).opacity = isFocus ? 0.6 : on ? 0.18 : 0.04;
      b.label.element.classList.toggle('dim', !on); b.label.element.classList.toggle('lit', isFocus);
    }
    for (const w of this.wires) {
      const base = w.line.userData['base'] as number;
      const on = streamSet ? streamSet.has(w.edge.from) && streamSet.has(w.edge.to) : focus ? w.edge.from === focus || w.edge.to === focus : true;
      w.mat.opacity = focus || streamSet ? (on ? Math.max(0.85, base) : base * 0.15) : base;
      if (w.sparks) (w.sparks.material as THREE.PointsMaterial).opacity = on ? 0.95 : 0.1;
    }
  }

  // ── frame loop ─────────────────────────────────────────────────────────────

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
    this.idleFor += dt;
    const pulse = 1 + Math.sin(t * 2.2) * 0.07;
    this.wellyCore.scale.setScalar(9 * pulse);
    this.wellyFace.quaternion.copy(this.camera.quaternion);                     // Welly's dial always faces you
    for (const s of this.wellySpin) s.o.rotation.z += dt * s.v;
    this.wellyRings.forEach((r, i) => { r.rotation.z += dt * (0.25 + i * 0.12) * (i % 2 ? -1 : 1); });
    this.wellyDust.rotation.y += dt * 0.12; this.wellyDust.rotation.x = Math.sin(t * 0.3) * 0.2;
    this.stars.rotation.y += dt * 0.004;
    this.floor.rotation.y += dt * 0.01;

    for (const b of this.bodies.values()) {
      const bob = Math.sin(t * 0.8 + b.home.x * 0.3 + b.home.z * 0.2) * 0.35;
      b.g.position.y = b.home.y + bob;
      b.g.quaternion.copy(this.camera.quaternion);                             // flat shapes face the camera
      b.spinner.rotation.z += dt * (b.node.layer === 'dept' ? -0.4 : 0.3);
      if (b.ring) b.ring.rotation.z -= dt * 1.2;
      b.halo.rotation.z += dt * 0.6;
      const target = (b.key === this.hoverKey() ? 1.25 : b.key === this.selected() ? 1.15 : 1); b.g.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
    }
    for (const p of this.peopleDust) { const h = p.userData['home'] as THREE.Vector3; p.position.y = Math.sin(t * 0.8 + h.x * 0.3 + h.z * 0.2) * 0.35; p.rotation.y = 0; }
    for (const w of this.wires) {
      if (!w.sparks) continue;
      const attr = w.sparks.geometry.getAttribute('position') as THREE.BufferAttribute; const ph = w.sparks.userData['phase'] as number;
      for (let i = 0; i < attr.count; i++) { const u = ((t * 0.22 + ph + i / attr.count) % 1); const p = w.curve.getPoint(u); attr.setXYZ(i, p.x, p.y, p.z); }
      attr.needsUpdate = true;
    }

    if (this.camTarget) {
      const c = this.camTarget; c.t = Math.min(1, c.t + dt / 0.9); const e = 1 - Math.pow(1 - c.t, 3);
      this.camera.position.lerp(c.pos, e * 0.25); this.controls.target.lerp(c.look, e * 0.25);
      if (c.t >= 1) this.camTarget = null;
    } else if (this.spin() && this.idleFor > 2.5 && !this.hoverKey()) { this.controls.autoRotate = true; this.controls.autoRotateSpeed = 0.35; } else this.controls.autoRotate = false;
    this.controls.update();
    this.renderer.render(this.scene, this.camera); this.labels.render(this.scene, this.camera);
  };

  private resize() {
    const el = this.host().nativeElement; const w = el.clientWidth || 800, h = el.clientHeight || 520;
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); this.labels.setSize(w, h);
  }

  // ── interaction ────────────────────────────────────────────────────────────

  private pick(ev: PointerEvent | MouseEvent): string | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const m = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(m, this.camera); this.ray.params.Points = { threshold: 0 } as any;
    const hit = this.ray.intersectObjects(this.pickables, false)[0];
    return hit ? (hit.object.userData['key'] as string) : null;
  }
  onMove(ev: PointerEvent) {
    if (this.downAt) return;
    const k = this.pick(ev); this.idleFor = 0;
    if (k !== this.hoverKey()) {
      this.hoverKey.set(k);
      if (k === 'welly') this.tip.set({ label: 'Welly', sub: 'Reads every module, finds slow steps and gaps, fixes what you let it. Click a node to see what it knows.', color: '#f5b942' });
      else { const b = k ? this.bodies.get(k) : null; this.tip.set(b ? { label: b.node.label, sub: b.node.blurb, color: b.node.color } : null); }
      this.renderer.domElement.style.cursor = k ? 'pointer' : 'grab';
    }
    const r = this.renderer.domElement.getBoundingClientRect(); this.tipPos.set({ x: ev.clientX - r.left, y: ev.clientY - r.top });
  }
  onDown(ev: PointerEvent) { if (ev.button === 0) this.downAt = { x: ev.clientX, y: ev.clientY }; }
  onUp(ev: PointerEvent) {
    const d = this.downAt; this.downAt = null; if (!d) return;
    if (Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) > 4) return;      // it was an orbit drag
    const k = this.pick(ev);
    this.select.emit(k === 'welly' ? null : k);
    if (k === 'welly') this.home();
  }
  onDbl(ev: MouseEvent) { const k = this.pick(ev); if (k && k !== 'welly') { this.flyTo(k, true); this.dive.emit(k); } else this.home(); }

  /** Ease the camera to sit in front of a node, looking at it (closer when diving). */
  flyTo(key: string, close: boolean) {
    const b = this.bodies.get(key); if (!b) return;
    const look = b.home.clone(); const dir = look.clone().normalize(); if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
    const pos = look.clone().add(dir.multiplyScalar(close ? 14 : 24)).add(new THREE.Vector3(0, close ? 5 : 10, 0));
    this.camTarget = { pos, look, t: 0 }; this.idleFor = 0;
  }
  home() { this.camTarget = { pos: new THREE.Vector3(0, 42, 92), look: new THREE.Vector3(0, 0, 0), t: 0 }; }
  zoom(f: number) { const v = this.camera.position.clone().sub(this.controls.target); const d = Math.min(220, Math.max(14, v.length() * f)); this.camTarget = { pos: this.controls.target.clone().add(v.setLength(d)), look: this.controls.target.clone(), t: 0 }; }
}
