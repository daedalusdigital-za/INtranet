/**
 * The company cortex: how work actually moves through this intranet. Modules and sources are fixed (they are the
 * code); departments and people are not listed here at all — the Cortex tab builds them from live data and links
 * them to modules through each person's module permissions.
 *
 * Every hand-off and stream step names the code that performs it, so the map stays honest: when the code changes,
 * change this file with it.
 */

export type CortexLayer = 'source' | 'module' | 'dept';
/** How a hand-off happens: the code does it, someone opens a screen and acts, a screen only reads it, or it is not built. */
export type CortexHow = 'code' | 'manual' | 'read' | 'gap';

export interface CortexLink { label: string; route: string; icon: string; }

export interface CortexNode {
  key: string;
  label: string;
  short?: string;
  layer: CortexLayer;
  icon: string;
  color: string;
  x: number;
  y: number;
  blurb: string;
  /** Module permission key (User.Permissions) — how departments are linked to this module. */
  perm?: string;
  route?: string;
  records?: string[];
  sections?: CortexLink[];
  /** Words that, in a flow's name, category or description, mean the flow works in this module. */
  flowWords?: RegExp;
}

export interface CortexEdge { from: string; to: string; label: string; how: CortexHow; ref?: string; who?: string; }

export interface CortexStreamStep { node: string; text: string; how: CortexHow; ref?: string; who?: string; }
export interface CortexStream { key: string; label: string; icon: string; color: string; blurb: string; steps: CortexStreamStep[]; }

export interface CortexGap { key: string; node: string; title: string; detail: string; ref: string; fix: string; template?: string; }

export interface CortexCompany { code: string; name: string; warehouse?: string; note?: string; }

const Y = { source: 66, rowA: 236, rowB: 404, dept: 600 };

export const CORTEX_COMPANIES: CortexCompany[] = [
  { code: 'PMT', name: 'Promed Technologies', warehouse: 'WH-KZN' },
  { code: 'ACM', name: 'Access Medical', warehouse: 'WH-GP' },
  { code: 'PHT', name: 'Promed Pharmacare', warehouse: 'WH-CPT', note: 'Also labelled "Pharmatech" and "Promed Pharmatech" in places' },
  { code: 'SBT', name: 'Sebenzani Trading', warehouse: 'WH-KZN' },
  { code: 'SAW', name: 'SA Wellness', note: 'Back orders and staff assignment only' },
  { code: 'RF', name: 'Rocket Freight', note: 'The logistics brand: RF- loads, the client portal and fleet reports' },
];

export const CORTEX_NODES: CortexNode[] = [
  // ── Sources: what feeds the intranet from outside ─────────────────────────
  { key: 'src-sage', label: 'Sage files', layer: 'source', icon: 'upload_file', color: '#94a3b8', x: 130, y: Y.source,
    blurb: 'No live Sage link: sales reports, back orders and stock on hand arrive as exported files that someone uploads and commits.' },
  { key: 'src-portal', label: 'RF client portal', short: 'Client portal', layer: 'source', icon: 'public', color: '#94a3b8', x: 290, y: Y.source,
    blurb: 'Rocket Freight customers book collections and deliveries themselves and follow them by waybill.' },
  { key: 'src-mail', label: 'Sales mailbox', layer: 'source', icon: 'mark_email_unread', color: '#94a3b8', x: 450, y: Y.source,
    blurb: 'Order emails are watched over IMAP and cached for search on the Sales dashboard. They do not create any records.' },
  { key: 'src-cartrack', label: 'CarTrack', layer: 'source', icon: 'satellite_alt', color: '#94a3b8', x: 610, y: Y.source,
    blurb: 'Live vehicle positions; a 24/7 monitor logs speeding, curfew and geofence incidents for the Controller console.' },
  { key: 'src-fuel', label: 'TFN & Puma', short: 'Fuel feeds', layer: 'source', icon: 'local_gas_station', color: '#94a3b8', x: 770, y: Y.source,
    blurb: 'TFN syncs fuel transactions in the background (it keeps only 14 days, so the intranet keeps history); Puma garage orders are imported.' },
  { key: 'src-clock', label: 'Clocking devices', layer: 'source', icon: 'fingerprint', color: '#94a3b8', x: 930, y: Y.source,
    blurb: 'Biometric devices push clock-ins and clock-outs, keyed on the employee register number.' },
  { key: 'src-apis', label: 'Project APIs', layer: 'source', icon: 'api', color: '#94a3b8', x: 1090, y: Y.source,
    blurb: 'External APIs for the HbA1c kits project and the regional school-delivery programmes.' },

  // ── Modules, row A: the operational chain ─────────────────────────────────
  { key: 'tenders', label: 'Tenders', layer: 'module', icon: 'gavel', color: '#c084fc', x: 110, y: Y.rowA, perm: 'tenders', route: '/tenders',
    blurb: 'Tender register, compliance vault, BOQ builder and analytics, per company code.',
    records: ['Tenders', 'Compliance documents', 'BOQs', 'Contracts'],
    flowWords: /tender|boq|compliance/i },
  { key: 'sales', label: 'Sales', layer: 'module', icon: 'point_of_sale', color: '#38bdf8', x: 300, y: Y.rowA, perm: 'sales', route: '/sales',
    blurb: 'The centre of the system: imported invoices from Sage drive trip sheets, stock dispatch, PODs, debtors and the management dashboards.',
    records: ['Imported invoices', 'Sales history', 'Customers', 'Back orders', 'Order cancellations', 'Sales trip sheets'],
    sections: [{ label: 'Invoices', route: '/sales/invoices', icon: 'receipt_long' }, { label: 'Back orders', route: '/sales/back-orders', icon: 'assignment_return' }, { label: 'Customers', route: '/sales/customers', icon: 'people' }],
    flowWords: /sales|invoice|customer|order|quote|enquir|credit limit/i },
  { key: 'logistics', label: 'Logistics', layer: 'module', icon: 'local_shipping', color: '#22d3ee', x: 520, y: Y.rowA, perm: 'logistics', route: '/logistics',
    blurb: 'Rocket Freight operations: loads and trip sheets, drivers and vehicles, PODs, fleet, maintenance, fuel and requisitions.',
    records: ['Loads / trip sheets (RF-)', 'Shipments & bookings', 'PODs', 'Vehicles & drivers', 'Requisitions', 'Fuel & maintenance'],
    sections: [{ label: 'Loads', route: '/logistics/loads', icon: 'assignment' }, { label: 'Trip sheets', route: '/logistics/trip-sheets', icon: 'description' }, { label: 'PODs', route: '/logistics/pods', icon: 'verified' }, { label: 'Requisitions', route: '/logistics/requisitions', icon: 'receipt_long' }],
    flowWords: /logistic|deliver|pod\b|trip|load|driver|fleet|shipment|dispatch|freight|exception/i },
  { key: 'stock', label: 'Stock', layer: 'module', icon: 'inventory_2', color: '#34d399', x: 740, y: Y.rowA, perm: 'stock_management', route: '/stock-management',
    blurb: 'One stock ledger per warehouse. Stock only leaves through load dispatch approval; stock takes come in from the SOH import.',
    records: ['Warehouse inventory', 'Stock movements', 'Stock counts', 'Stock issues & exceptions'],
    sections: [{ label: 'On hand', route: '/stock-management/on-hand', icon: 'inventory_2' }, { label: 'Dispatch', route: '/stock-management/dispatch', icon: 'local_shipping' }, { label: 'Counts', route: '/stock-management/counts', icon: 'fact_check' }],
    flowWords: /stock|warehouse|write-off|inventory|goods receiv|grn/i },
  { key: 'finance', label: 'Finance', layer: 'module', icon: 'account_balance', color: '#facc15', x: 950, y: Y.rowA, perm: 'finance', route: '/finance',
    blurb: 'Debtors from imported invoices, creditors from Books and requisition invoices, petty-cash requisitions, budgets and commitments.',
    records: ['Debtor payments', 'Requisition invoices', 'Budgets & expenses', 'Monthly commitments'],
    sections: [{ label: 'Debtors', route: '/finance/debtors', icon: 'call_received' }, { label: 'Creditors', route: '/finance/creditors', icon: 'call_made' }, { label: 'Payments', route: '/finance/payments', icon: 'payment' }],
    flowWords: /financ|account|creditor|debtor|payment|purchase|month-end|budget|credit|payroll/i },
  { key: 'books', label: 'Books', layer: 'module', icon: 'menu_book', color: '#fde047', x: 1110, y: Y.rowA, perm: 'finance', route: '/books',
    blurb: 'Supplier invoices captured as PDFs (with OCR), confirmed and sent to Finance for payment.',
    records: ['Book invoices'], flowWords: /books?\b|supplier invoice/i },

  // ── Modules, row B: people, projects and the platform ─────────────────────
  { key: 'hr', label: 'HR', layer: 'module', icon: 'badge', color: '#f472b6', x: 100, y: Y.rowB, perm: 'human_resource', route: '/people',
    blurb: 'HR employee files, attendance from the clocking devices, leave and disciplinary records.',
    records: ['HR employees', 'Attendance', 'Leave requests', 'Disciplinary'], flowWords: /\bhr\b|leave|onboard|leaver|staff|recruit|attendance|employee/i },
  { key: 'projects', label: 'Projects', layer: 'module', icon: 'rocket_launch', color: '#a3e635', x: 245, y: Y.rowB, perm: 'company_projects', route: '/company-projects',
    blurb: 'Distribution programmes: HbA1c kits, the condom project, sanitary pads and school deliveries.',
    records: ['Condom delivery requests', 'HbA1c', 'School deliveries'], flowWords: /project|production|work order|condom|hba1c|school/i },
  { key: 'assets', label: 'Asset register', short: 'Assets', layer: 'module', icon: 'devices', color: '#fb923c', x: 390, y: Y.rowB, route: '/asset-register',
    blurb: 'Company equipment and who has it. Items can be matched to the Books invoice that bought them.',
    records: ['Assets', 'Asset tags'], flowWords: /asset|device|laptop|equipment/i },
  { key: 'paperless', label: 'Paperless', layer: 'module', icon: 'draw', color: '#fda4af', x: 535, y: Y.rowB,
    blurb: 'Documents sent to chosen signers, approvers and viewers, with email bundles and in-app notifications. Opened from the navigation bar.',
    records: ['Paperless documents', 'Signatures'], flowWords: /paperless|sign|signature/i },
  { key: 'tickets', label: 'Support tickets', short: 'Tickets', layer: 'module', icon: 'support_agent', color: '#60a5fa', x: 680, y: Y.rowB, perm: 'support_tickets', route: '/support-ticket',
    blurb: 'IT support requests. Welly can raise them; assignment is free text today.',
    records: ['Support tickets'], flowWords: /support|ticket|issue|\bit\b/i },
  { key: 'flows', label: 'Flows', layer: 'module', icon: 'account_tree', color: '#a78bfa', x: 825, y: Y.rowB, perm: 'flows', route: '/flows',
    blurb: 'Processes with tasks, approvals and an audit trail. Shipment events start flows automatically; tasks also land on people\'s to-do lists.',
    records: ['Flow runs', 'Flow tasks', 'To-dos'] },
  { key: 'welly', label: 'Welly', layer: 'module', icon: 'smart_toy', color: '#e879f9', x: 970, y: Y.rowB, perm: 'ai',
    blurb: 'The AI assistant. It answers questions and can act: create trip sheets, tickets, to-dos and meetings, and edit customers and employees.',
    records: ['Knowledge base', 'Actions taken'] },
  { key: 'mgmt', label: 'Management', layer: 'module', icon: 'insights', color: '#f5b942', x: 1110, y: Y.rowB, perm: 'management', route: '/management',
    blurb: 'Read-only oversight across sales, tenders, logistics, stock, finance, paperless and HR.',
    records: ['Dashboards (read-only)'] },
];

/** Real hand-offs, as the code performs them. */
export const CORTEX_EDGES: CortexEdge[] = [
  { from: 'src-sage', to: 'sales', label: 'Sales report import → imported invoices + sales history', how: 'manual', ref: 'SalesImportController.cs:148', who: 'sales / logistics / finance users' },
  { from: 'src-sage', to: 'sales', label: 'Back-order report import (replaces that company\'s rows)', how: 'manual', ref: 'BackordersController.cs:76' },
  { from: 'src-sage', to: 'stock', label: 'SOH import → stock-take adjustments', how: 'manual', ref: 'StockOnHandImportService.cs:569' },
  { from: 'src-portal', to: 'logistics', label: 'Client booking → shipments (BOOKED)', how: 'code', ref: 'PortalController.cs:252' },
  { from: 'src-mail', to: 'sales', label: 'Order emails cached for search (no records created)', how: 'read', ref: 'SalesMailboxMonitorService.cs:11' },
  { from: 'src-cartrack', to: 'logistics', label: 'Live positions + incident monitor', how: 'code', ref: 'IncidentMonitoringService.cs:9' },
  { from: 'src-fuel', to: 'logistics', label: 'Fuel transactions & garage orders', how: 'code', ref: 'TfnSyncService.cs:47' },
  { from: 'src-clock', to: 'hr', label: 'Clock-ins → attendance', how: 'code', ref: 'ClockingDeviceController.cs:120' },
  { from: 'src-apis', to: 'projects', label: 'HbA1c and school-delivery data', how: 'code', ref: 'HBA1CApiService.cs:39' },

  { from: 'sales', to: 'logistics', label: 'Invoices → trip sheet (RF- load); invoices Assigned', how: 'manual', ref: 'ImportedInvoicesController.cs:1149', who: 'Logistics, or Welly on request' },
  { from: 'sales', to: 'logistics', label: 'Sales trip sheet approved → load (two-person rule)', how: 'manual', ref: 'SalesTripSheetsController.cs:316', who: 'a second sales agent' },
  { from: 'logistics', to: 'stock', label: 'Approve dispatch → ledger deducts every linked line', how: 'manual', ref: 'StockMovementsController.cs:237', who: 'Manager or stock dispatch approver' },
  { from: 'logistics', to: 'sales', label: 'POD → load + invoices Delivered', how: 'code', ref: 'LoadsController.cs:1416' },
  { from: 'sales', to: 'finance', label: 'Imported invoices → debtors (net of collections)', how: 'read', ref: 'FinanceOverviewController.cs:275' },
  { from: 'logistics', to: 'finance', label: 'Requisition → Finance requested / paid', how: 'manual', ref: 'FinanceOverviewController.cs:192', who: 'Finance' },
  { from: 'books', to: 'finance', label: 'Supplier invoice → creditors / payment request', how: 'manual', ref: 'BooksController.cs:600' },
  { from: 'books', to: 'assets', label: 'Invoice matched to the asset it bought', how: 'code', ref: 'AssetInvoiceMatchingService.cs:412' },
  { from: 'logistics', to: 'projects', label: 'Trip sheet marks condom delivery requests Delivered', how: 'code', ref: 'TripSheetController.cs:382' },
  { from: 'logistics', to: 'hr', label: 'Drivers imported into HR employee files', how: 'manual', ref: 'HrEmployeesController.cs:305', who: 'HR' },
  { from: 'logistics', to: 'flows', label: 'Shipment events start flows', how: 'code', ref: 'FlowEvents.cs:29' },
  { from: 'welly', to: 'logistics', label: 'Creates trip sheets on request', how: 'code', ref: 'AIActionService.cs:838' },
  { from: 'welly', to: 'tickets', label: 'Raises support tickets', how: 'code', ref: 'AIActionService.cs:224' },
  { from: 'flows', to: 'hr', label: 'Tasks → people\'s to-do lists', how: 'code', ref: 'FlowEngine.cs:590' },
  { from: 'tenders', to: 'sales', label: 'Award → nothing downstream; tender pricing is a fixed file', how: 'gap', ref: 'TendersController.cs:317' },
  ...['sales', 'tenders', 'logistics', 'stock', 'finance', 'paperless', 'hr'].map(k => ({ from: k, to: 'mgmt', label: 'Rolled up on the Management dashboard', how: 'read' as const, ref: 'ManagementController.cs:184' })),
];

/** End-to-end chains that cross modules, step by step, as the code runs them today. */
export const CORTEX_STREAMS: CortexStream[] = [
  {
    key: 'invoice', label: 'Sage invoice to delivered', icon: 'receipt_long', color: '#38bdf8',
    blurb: 'A Sage sale becomes a load, leaves stock, is delivered with a POD and lands in debtors.',
    steps: [
      { node: 'src-sage', text: 'Sales report exported from Sage and uploaded', how: 'manual', ref: 'SalesImportController.cs:148' },
      { node: 'sales', text: 'Import committed: imported invoices (Pending) + sales history', how: 'code', ref: 'SalesReportImportService.cs:1114' },
      { node: 'logistics', text: 'Invoices picked into a trip sheet (RF- load); invoices Assigned', how: 'manual', ref: 'ImportedInvoicesController.cs:1149', who: 'Logistics or Welly' },
      { node: 'logistics', text: 'Driver and vehicle assigned; load Scheduled', how: 'manual', ref: 'TripSheetController.cs:432' },
      { node: 'stock', text: 'Dispatch approved; ledger deducts each linked line', how: 'manual', ref: 'StockMovementsController.cs:237', who: 'Manager / dispatch approver' },
      { node: 'logistics', text: 'Delivered; POD captured by the driver or scanned by the office', how: 'manual', ref: 'PodDocumentsController.cs:375' },
      { node: 'sales', text: 'Invoices marked Delivered', how: 'code', ref: 'LoadsController.cs:1416' },
      { node: 'finance', text: 'Debtors: net sales minus collections — not tied to delivery', how: 'gap', ref: 'FinanceOverviewController.cs:275' },
    ],
  },
  {
    key: 'rf', label: 'Rocket Freight booking', icon: 'local_shipping', color: '#22d3ee',
    blurb: 'A client books on the portal and follows it to delivery.',
    steps: [
      { node: 'src-portal', text: 'Client books; shipments created as BOOKED', how: 'code', ref: 'BookingIntakeService.cs:32' },
      { node: 'logistics', text: 'Ops confirms or rejects the booking', how: 'manual', ref: 'ClientBookingsController.cs:122' },
      { node: 'logistics', text: 'Shipments planned onto a load (weight checked)', how: 'manual', ref: 'ShipmentsController.cs:127' },
      { node: 'logistics', text: 'Driver scans collect and deliver, POD with signature', how: 'manual', ref: 'ShipmentDriverController.cs:84', who: 'the load\'s driver' },
      { node: 'src-portal', text: 'Client gets SMS / email at each status', how: 'code', ref: 'ShipmentNotificationService.cs:68' },
      { node: 'flows', text: 'Delivery failures start exception flows', how: 'code', ref: 'FlowEvents.cs:29' },
    ],
  },
  {
    key: 'creditor', label: 'Supplier invoice to paid', icon: 'payments', color: '#facc15',
    blurb: 'Creditor invoices through the signed, multi-step approval.',
    steps: [
      { node: 'books', text: 'Supplier invoice PDF captured (OCR)', how: 'manual', ref: 'BooksController.cs:503' },
      { node: 'finance', text: 'Draft with Sage 300 reference → creditors clerk reconciles', how: 'manual', ref: 'RequisitionWorkflow.cs:12', who: 'creditors clerk' },
      { node: 'finance', text: 'Accountant → payment schedule', how: 'manual', ref: 'RequisitionWorkflow.cs:12', who: 'accountant' },
      { node: 'finance', text: 'Finance approver → Leona review → Duran approval', how: 'manual', ref: 'RequisitionInvoicesController.cs:213', who: 'named approvers' },
      { node: 'finance', text: 'Nash pays; invoice Paid then Closed', how: 'manual', ref: 'RequisitionWorkflow.cs:12', who: 'Nash' },
      { node: 'assets', text: 'If it bought equipment, matched to the asset', how: 'code', ref: 'AssetInvoiceMatchingService.cs:412' },
    ],
  },
  {
    key: 'petty', label: 'Requisition to paid', icon: 'request_quote', color: '#fb923c',
    blurb: 'Petty cash, e-wallet and diesel requests from the fleet.',
    steps: [
      { node: 'logistics', text: 'Requisition raised (RF number)', how: 'manual', ref: 'RequisitionsController.cs:155' },
      { node: 'finance', text: 'Finance marks it requested, paid or rejected', how: 'manual', ref: 'FinanceOverviewController.cs:192' },
      { node: 'logistics', text: 'Not linked to the vehicle, driver or load it was for', how: 'gap', ref: 'Requisition.cs:42' },
    ],
  },
  {
    key: 'people', label: 'Clock-in to HR', icon: 'fingerprint', color: '#f472b6',
    blurb: 'From the clocking device to the HR file.',
    steps: [
      { node: 'src-clock', text: 'Device pushes clock-in / out', how: 'code', ref: 'ClockingDeviceController.cs:120' },
      { node: 'hr', text: 'Register and drivers imported into HR employee files', how: 'manual', ref: 'HrEmployeesController.cs:305', who: 'HR' },
      { node: 'hr', text: 'Leave requested, HR approves', how: 'manual', ref: 'LeaveRequestsController.cs:167' },
      { node: 'hr', text: 'Leave does not feed attendance; payroll is not built', how: 'gap', ref: 'LeaveRequestsController.cs:25' },
    ],
  },
  {
    key: 'tender', label: 'Tender to award', icon: 'gavel', color: '#c084fc',
    blurb: 'Bidding, and what an award should set off.',
    steps: [
      { node: 'tenders', text: 'Tender, compliance pack and BOQ prepared', how: 'manual', ref: 'TendersController.cs' },
      { node: 'tenders', text: 'Awarded: date and value recorded', how: 'code', ref: 'TendersController.cs:317' },
      { node: 'sales', text: 'Award does not reach Sales; tender prices are a fixed file', how: 'gap', ref: 'tender-pricing-data.ts:1' },
    ],
  },
];

/** What the code is missing, found by tracing the hand-offs. */
export const CORTEX_GAPS: CortexGap[] = [
  { key: 'debtors-pod', node: 'finance', title: 'Debtors ignore delivery', ref: 'FinanceOverviewController.cs:275',
    detail: 'Receivables are net sales minus collections, so an undelivered or disputed invoice counts the same as one with a signed POD.',
    fix: 'Age debtors from the POD date and flag invoices with no POD; the Missing POD chaser flow covers the chasing.', template: 'Missing POD chaser' },
  { key: 'tender-award', node: 'tenders', title: 'A tender award sets nothing off', ref: 'TendersController.cs:317',
    detail: 'Awarding records a date and value only. Sales tender prices live in a fixed file, and contracts hold the tender number as free text.',
    fix: 'On award, load the BOQ prices into Sales tender pricing and open a contract; a flow can hand the award to Sales and Stock.' },
  { key: 'ticket-routing', node: 'tickets', title: 'Tickets are not routed', ref: 'SupportTicketsController.cs:163',
    detail: 'Assigned-to is free text and there is no department routing, so nothing tells the owner a ticket is theirs.',
    fix: 'Use the Issue to resolution flow: Welly picks the owning department and it is tracked to an SOP.', template: 'Issue to resolution' },
  { key: 'asset-owner', node: 'assets', title: 'Assets are not linked to people', ref: 'AssetRegisterController.cs:72',
    detail: 'Assigned-to is free text, so a leaver\'s laptop and phone cannot be listed or recovered from their record.',
    fix: 'Link assets to the HR employee; the Leaver offboarding flow then checks devices back in.', template: 'Leaver offboarding' },
  { key: 'payroll', node: 'hr', title: 'No payroll, leave not in attendance', ref: 'LeaveRequestsController.cs:25',
    detail: 'Approved leave does not reach attendance, and there is no payroll step anywhere in the code.',
    fix: 'Feed approved leave into attendance, and send a monthly attendance + leave pack to Accounts.' },
  { key: 'req-link', node: 'logistics', title: 'Requisitions float free', ref: 'Requisition.cs:42',
    detail: 'Petty cash, e-wallet and diesel requisitions are not linked to a vehicle, driver or load; paid-to is free text.',
    fix: 'Link requisitions to the vehicle and load so cost per vehicle and per trip can be reported next to fuel.' },
  { key: 'order-mail', node: 'sales', title: 'Order emails create nothing', ref: 'SalesMailboxMonitorService.cs:11',
    detail: 'Orders arrive by email but only become work once Sage has invoiced them and someone imports the report.',
    fix: 'Let Welly read order emails and draft the order or flag it, so nothing waits on the next Sage export.' },
  { key: 'handoff-notify', node: 'flows', title: 'Teams are not told when work arrives', ref: 'ImportedInvoicesController.cs:1149',
    detail: 'Most hand-offs are a status change the next team only sees by opening a screen (an invoice Assigned, a load ready to dispatch).',
    fix: 'Publish events for invoice imported, load ready for dispatch and POD received so flows can notify and escalate.' },
  { key: 'company-labels', node: 'sales', title: 'One company, three names', ref: 'FinanceOverviewController.cs:216',
    detail: 'PHT is shown as Pharmacare, Pharmatech and Promed Pharmatech in different screens.',
    fix: 'Read company names from the OperatingCompanies table everywhere.' },
];
