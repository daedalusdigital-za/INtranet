/**
 * The company cortex: how ProMed Technologies / Access Medical / Rocket Freight fits together, in five layers
 * (Management steers, departments do the work, the cortex holds the shared record, AI agents assist, assets and
 * infrastructure carry it all). Static structure lives here; live numbers (flows, runs, people) are joined in by
 * the Cortex tab from the Flows API.
 */

export type CortexLayer = 'gov' | 'dept' | 'core' | 'agent' | 'asset' | 'ext';

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
  /** Department nodes: regexes that match department / employee-register department names to this node. */
  match?: RegExp;
  roles?: string[];
  owns?: string[];
  signsOff?: string[];
  kpis?: string[];
  receives?: string[];
  handsTo?: string[];
  modules?: CortexLink[];
  /** Agent nodes */
  reads?: string[];
  does?: string;
  checkpoint?: string;
  owner?: string;
  /** Core / asset nodes */
  holds?: string[];
  systems?: string[];
}

export interface CortexEdge { from: string; to: string; label: string; kind: 'handoff' | 'approval' | 'data' | 'agent' | 'asset'; }

export interface CortexStreamStep {
  dept: string;
  text: string;
  /** Words that, found in a flow's name or description, mean this step is already covered by a flow. */
  match: string[];
  /** Template (by name) that covers the step if nobody has built it yet. */
  template?: string;
  module?: CortexLink;
}

export interface CortexStream { key: string; label: string; icon: string; color: string; blurb: string; steps: CortexStreamStep[]; }

export interface CortexApproval { decision: string; requestedBy: string; first: string; escalates: string; trigger: string; template?: string; match: string[]; }

const M = {
  sales: { label: 'Sales', route: '/sales', icon: 'trending_up' },
  stock: { label: 'Stock', route: '/stock-management', icon: 'inventory_2' },
  warehouse: { label: 'Warehouse 3D', route: '/warehouse-3d', icon: 'view_in_ar' },
  logistics: { label: 'Logistics', route: '/logistics', icon: 'local_shipping' },
  finance: { label: 'Finance', route: '/finance', icon: 'account_balance' },
  books: { label: 'Books', route: '/books', icon: 'menu_book' },
  tenders: { label: 'Tenders', route: '/tenders', icon: 'gavel' },
  people: { label: 'People', route: '/people', icon: 'badge' },
  tickets: { label: 'Support tickets', route: '/support-ticket', icon: 'support_agent' },
  assets: { label: 'Asset register', route: '/asset-register', icon: 'devices' },
  documents: { label: 'Documents', route: '/documents', icon: 'folder' },
  docs: { label: 'Docs', route: '/docs', icon: 'article' },
  management: { label: 'Management', route: '/management', icon: 'insights' },
  projects: { label: 'Company projects', route: '/company-projects', icon: 'rocket_launch' },
  calendar: { label: 'Calendar', route: '/calendar', icon: 'calendar_month' },
  messages: { label: 'Messages', route: '/messages', icon: 'forum' },
  flows: { label: 'Flows', route: '/flows', icon: 'account_tree' },
} satisfies Record<string, CortexLink>;

/* Map coordinates: a 1200 × 780 board in five horizontal bands, customers on the left edge, suppliers on the right. */
const Y = { gov: 70, dept: 250, core: 440, agent: 590, asset: 720 };
const DX = (i: number) => 150 + i * 112.5;

export const CORTEX_NODES: CortexNode[] = [
  // ── Governance ─────────────────────────────────────────────────────────────
  {
    key: 'mgmt', label: 'Management', layer: 'gov', icon: 'account_balance', color: '#f5b942', x: 600, y: Y.gov,
    blurb: 'Steers the company: strategy, targets, policy and the approvals that sit above department limits.',
    match: /manage?ment|executive|director|\bceo\b|\bmd\b|owner/i,
    roles: ['MD / CEO', 'Department heads'], owns: ['Strategy', 'Budgets (with Finance)', 'Policies'],
    signsOff: ['Capex', 'New hires', 'Pricing policy', 'Large contracts', 'Approvals above matrix limits'],
    kpis: ['Performance vs budget', 'Revenue outlook', 'Working capital', 'Operational risk'],
    receives: ['KPIs from every department'], handsTo: ['Targets and budgets', 'Approvals'],
    modules: [M.management, M.projects, M.tenders],
  },

  // ── Departments ────────────────────────────────────────────────────────────
  {
    key: 'mkt', label: 'Marketing', layer: 'dept', icon: 'campaign', color: '#f472b6', x: DX(0), y: Y.dept,
    blurb: 'Brand, campaigns and lead generation for the medical and freight businesses.',
    match: /marketing|brand|digital/i,
    roles: ['Marketing manager', 'Content', 'Digital'], owns: ['Campaigns', 'Lead source data', 'Brand assets'],
    signsOff: ['Campaign spend', 'Public content'], kpis: ['Leads by source', 'Cost per lead', 'Lead → customer rate'],
    receives: ['Product & price info (Stock, Sales)', 'Budget (Finance)'], handsTo: ['Qualified leads → Sales', 'Insights → Management'],
    modules: [M.documents, M.docs],
  },
  {
    key: 'sales', label: 'Sales', layer: 'dept', icon: 'trending_up', color: '#38bdf8', x: DX(1), y: Y.dept,
    blurb: 'Pipeline, quotes, tenders and orders for hospitals, clinics and freight customers.',
    match: /sales|tender|account manager|\brep\b/i,
    roles: ['Sales manager', 'Reps', 'Sales admin'], owns: ['Customer master', 'Quotes', 'Sales orders', 'Tenders'],
    signsOff: ['Discounts within limit', 'Quote release'], kpis: ['Pipeline value', 'Win rate', 'Orders', 'Average order value'],
    receives: ['Leads (Marketing)', 'Stock availability (Stock)', 'Credit status (Finance)'], handsTo: ['Orders → Stock & Logistics', 'Forecasts → Management'],
    modules: [M.sales, M.tenders],
  },
  {
    key: 'stock', label: 'Stock', layer: 'dept', icon: 'inventory_2', color: '#34d399', x: DX(2), y: Y.dept,
    blurb: 'One stock ledger: levels, reordering, receiving, counts and valuation across the warehouses.',
    match: /stock|warehouse|store|procure|buy(er|ing)|purchas|inventory/i,
    roles: ['Stock controller', 'Storeman', 'Buyer'], owns: ['Item / SKU master', 'Stock movements', 'Purchase orders', 'GRNs'],
    signsOff: ['Stock adjustments', 'Write-offs', 'POs within limit'], kpis: ['Stock value', 'Stock turns', 'Out-of-stock items', 'Count accuracy'],
    receives: ['Sales orders (Sales)', 'Receipts (Logistics)', 'Budgets (Finance)'], handsTo: ['POs → Suppliers', 'Picking lists → Logistics', 'Valuations → Finance'],
    modules: [M.stock, M.warehouse],
  },
  {
    key: 'prod', label: 'Production', layer: 'dept', icon: 'precision_manufacturing', color: '#a3e635', x: DX(3), y: Y.dept,
    blurb: 'Work orders: turns components from Stock into finished goods and books them back.',
    match: /production|manufactur|factory|workshop|assembl|hba1|\bkits?\b/i,
    roles: ['Production supervisor', 'Operators'], owns: ['Work orders', 'Bills of material'],
    signsOff: ['Work order release', 'Scrap'], kpis: ['Work orders on time', 'Yield', 'Scrap rate'],
    receives: ['Components (Stock)', 'Demand (Sales)'], handsTo: ['Finished goods → Stock'],
    modules: [M.stock],
  },
  {
    key: 'log', label: 'Logistics', layer: 'dept', icon: 'local_shipping', color: '#22d3ee', x: DX(4), y: Y.dept,
    blurb: 'Rocket Freight: loads, trip sheets, drivers, delivery and proof of delivery.',
    match: /logistic|dispatch|driver|transport|fleet|freight|deliver|courier/i,
    roles: ['Logistics manager', 'Dispatch controller', 'Drivers'], owns: ['Loads & trip sheets', 'Routes', 'Proof of delivery'],
    signsOff: ['Dispatch schedule', 'Carrier / subcontractor choice'], kpis: ['On-time delivery %', 'Cost per delivery', 'PODs outstanding', 'Failed deliveries'],
    receives: ['Picking lists (Stock)', 'Delivery dates (Sales)'], handsTo: ['PODs → Accounts', 'Receipts → Stock', 'Deliveries → Customers'],
    modules: [M.logistics],
  },
  {
    key: 'fin', label: 'Accounts & Finance', short: 'Finance', layer: 'dept', icon: 'account_balance_wallet', color: '#facc15', x: DX(5), y: Y.dept,
    blurb: 'Debtors, creditors, payroll, month-end and the numbers Management steers by.',
    match: /account|financ|debtor|creditor|payroll|bookkeep/i,
    roles: ['Financial manager', 'Accountant', 'Debtors clerks', 'Creditors clerks'], owns: ['Chart of accounts', 'Invoices', 'Payments', 'Credit limits'],
    signsOff: ['Payments', 'Credit limits', 'Budget variances'], kpis: ['Cash position', 'Debtor days', 'Creditor days', 'Gross margin'],
    receives: ['PODs (Logistics)', 'Supplier invoices (Stock)', 'Payroll inputs (HR)'], handsTo: ['Invoices → Customers', 'Payments → Suppliers', 'Reports → Management'],
    modules: [M.finance, M.books],
  },
  {
    key: 'hr', label: 'HR', layer: 'dept', icon: 'diversity_3', color: '#c084fc', x: DX(6), y: Y.dept,
    blurb: 'Hire to retire: recruitment, onboarding, leave, performance and offboarding.',
    match: /\bhr\b|human res|people|recruit|payroll admin|training/i,
    roles: ['HR manager', 'HR officer'], owns: ['Employee records', 'Contracts', 'Leave'],
    signsOff: ['Hiring offers', 'Leave exceptions', 'Disciplinary steps'], kpis: ['Headcount', 'Staff turnover', 'Open roles', 'Leave liability'],
    receives: ['Hiring requests (all)', 'Approvals (Management)'], handsTo: ['New starters → IT', 'Payroll changes → Accounts'],
    modules: [M.people, M.calendar],
  },
  {
    key: 'it', label: 'IT', layer: 'dept', icon: 'memory', color: '#60a5fa', x: DX(7), y: Y.dept,
    blurb: 'Runs the intranet, Sage, access, security, backups and the Welly agents.',
    match: /\bit\b|information tech|systems|support desk|developer/i,
    roles: ['IT manager', 'Systems admin', 'Support'], owns: ['User accounts', 'System config', 'Data platform'],
    signsOff: ['Access requests', 'New software', 'Agent permissions'], kpis: ['System uptime', 'Open tickets', 'Security incidents', 'Agent actions logged'],
    receives: ['Starters / leavers (HR)', 'System requests (all)'], handsTo: ['Working systems', 'Data platform', 'Dashboards'],
    modules: [M.tickets, M.assets, M.flows],
  },
  {
    key: 'rec', label: 'Reception', layer: 'dept', icon: 'concierge', color: '#fb923c', x: DX(8), y: Y.dept,
    blurb: 'First contact: visitors, calls, couriers and walk-in deliveries.',
    match: /reception|front desk|switchboard|office admin/i,
    roles: ['Receptionist'], owns: ['Visitor log', 'Incoming parcels'],
    signsOff: [], kpis: ['Calls routed', 'Parcels logged same day'],
    receives: ['Visitors, calls, couriers'], handsTo: ['Deliveries → Stock', 'Enquiries → Sales'],
    modules: [M.messages, M.calendar],
  },

  // ── External ──────────────────────────────────────────────────────────────
  { key: 'cust', label: 'Customers', layer: 'ext', icon: 'local_hospital', color: '#e2e8f0', x: 40, y: Y.dept,
    blurb: 'Hospitals, clinics, pharmacies and freight clients. Every touchpoint lands in one customer record.' },
  { key: 'supp', label: 'Suppliers', layer: 'ext', icon: 'factory', color: '#e2e8f0', x: 1160, y: Y.dept,
    blurb: 'Manufacturers, carriers and service providers. Vetted by Stock, paid by Accounts, scored on price, time and quality.' },

  // ── The cortex core ───────────────────────────────────────────────────────
  { key: 'md', label: 'Master data', layer: 'core', icon: 'dataset', color: '#67e8f9', x: 330, y: Y.core,
    blurb: 'One owner per record type. Sales owns customers, Stock owns items, HR owns employees; everyone else reads.',
    holds: ['Customers', 'Suppliers', 'Products / SKUs', 'Employees', 'Assets', 'Chart of accounts'], systems: ['Sage 300', 'Intranet · People', 'Intranet · Stock'] },
  { key: 'tx', label: 'Transactions', layer: 'core', icon: 'receipt_long', color: '#67e8f9', x: 510, y: Y.core,
    blurb: 'Every hand-off between departments is a write here, so status is visible without chasing people.',
    holds: ['Quotes & orders', 'Invoices', 'POs & GRNs', 'Stock movements', 'Loads & PODs', 'Tickets', 'Flow runs'], systems: ['Sage 300', 'Intranet · Logistics', 'Intranet · Stock ledger', 'Flows'] },
  { key: 'docs', label: 'Documents & knowledge', short: 'Knowledge', layer: 'core', icon: 'library_books', color: '#67e8f9', x: 690, y: Y.core,
    blurb: 'Policies, SOPs, contracts, price lists and lessons learned, so a fix is only figured out once.',
    holds: ['Policies & SOPs', 'Contracts', 'Templates', 'Price lists', 'Meeting notes'], systems: ['Intranet · Documents', 'Docs', 'Welly knowledge base'] },
  { key: 'dw', label: 'Data & reporting', short: 'Reporting', layer: 'core', icon: 'monitoring', color: '#67e8f9', x: 870, y: Y.core,
    blurb: 'KPIs defined once and rolled up to the Management dashboard, so every screen calculates them the same way.',
    holds: ['KPIs', 'Dashboards', 'Audit trail'], systems: ['Intranet · Management', 'Home widgets', 'Flow audit trail'] },

  // ── AI agents (Welly) ─────────────────────────────────────────────────────
  { key: 'a-kb', label: 'Knowledge assistant', short: 'Knowledge', layer: 'agent', icon: 'school', color: '#a78bfa', x: 210, y: Y.agent,
    blurb: 'Welly answers staff questions with links to the source document.', reads: ['Policies, SOPs, past tickets'], does: 'Answers questions; flags gaps to document owners', checkpoint: 'None for answers', owner: 'IT (platform), all (content)' },
  { key: 'a-sales', label: 'Sales assistant', short: 'Sales AI', layer: 'agent', icon: 'support_agent', color: '#a78bfa', x: 340, y: Y.agent,
    blurb: 'Drafts quotes and follow-ups, keeps the pipeline current.', reads: ['Customers, price lists, stock, credit'], does: 'Drafts quotes and follow-up emails', checkpoint: 'Rep sends; manager approves discounts', owner: 'Sales' },
  { key: 'a-stock', label: 'Reorder agent', short: 'Reorder AI', layer: 'agent', icon: 'autorenew', color: '#a78bfa', x: 470, y: Y.agent,
    blurb: 'Proposes reorder quantities and draft POs from the stock ledger.', reads: ['Stock levels, sales history, lead times'], does: 'Proposes reorders and draft POs', checkpoint: 'Buyer approves each PO', owner: 'Stock' },
  { key: 'a-fin', label: 'Finance agent', short: 'Finance AI', layer: 'agent', icon: 'calculate', color: '#a78bfa', x: 600, y: Y.agent,
    blurb: 'Three-way matching and reminder drafts.', reads: ['Invoices, POs, GRNs, bank feeds'], does: 'Matches PO / GRN / invoice, flags mismatches, drafts reminders', checkpoint: 'Accounts approves payments and sends reminders', owner: 'Accounts & Finance' },
  { key: 'a-log', label: 'Logistics planner', short: 'Route AI', layer: 'agent', icon: 'route', color: '#a78bfa', x: 730, y: Y.agent,
    blurb: 'Triages delivery exceptions and proposes routes.', reads: ['Orders, addresses, vehicles, exceptions'], does: 'Classifies exceptions, proposes routes and schedules', checkpoint: 'Dispatch confirms', owner: 'Logistics' },
  { key: 'a-hr', label: 'HR assistant', short: 'HR AI', layer: 'agent', icon: 'emoji_people', color: '#a78bfa', x: 860, y: Y.agent,
    blurb: 'Policy answers and onboarding checklists.', reads: ['HR policies, leave balances, checklists'], does: 'Answers policy questions, runs onboarding checklists', checkpoint: 'HR approves offers and leave exceptions', owner: 'HR' },
  { key: 'a-rep', label: 'Reporting agent', short: 'Report AI', layer: 'agent', icon: 'query_stats', color: '#a78bfa', x: 990, y: Y.agent,
    blurb: 'Weekly KPI summaries and variance explanations.', reads: ['Data & reporting'], does: 'Builds KPI summaries, explains variances', checkpoint: 'Finance signs off numbers', owner: 'Finance / Management' },

  // ── Assets & infrastructure ───────────────────────────────────────────────
  { key: 'x-prem', label: 'Premises', layer: 'asset', icon: 'domain', color: '#94a3b8', x: 220, y: Y.asset,
    blurb: 'Offices, warehouse and branches.', owner: 'Management', holds: ['Lease', 'Insurance', 'Maintenance log'] },
  { key: 'x-fleet', label: 'Fleet', layer: 'asset', icon: 'airport_shuttle', color: '#94a3b8', x: 370, y: Y.asset,
    blurb: 'Delivery vehicles and forklifts.', owner: 'Logistics', holds: ['Vehicle register', 'Services', 'Fuel', 'Licences'] },
  { key: 'x-equip', label: 'Equipment', layer: 'asset', icon: 'construction', color: '#94a3b8', x: 520, y: Y.asset,
    blurb: 'Racking, scanners and machinery.', owner: 'Stock / Production', holds: ['Asset register', 'Maintenance schedule'] },
  { key: 'x-hw', label: 'IT hardware', layer: 'asset', icon: 'laptop_chromebook', color: '#94a3b8', x: 670, y: Y.asset,
    blurb: 'Laptops, phones, printers and network. A new starter triggers a device issue; a leaver triggers its return.', owner: 'IT', holds: ['Device register linked to the employee'] },
  { key: 'x-sys', label: 'Systems', layer: 'asset', icon: 'dns', color: '#94a3b8', x: 820, y: Y.asset,
    blurb: 'Sage 300, this intranet, email, Welly.', owner: 'IT', holds: ['System inventory', 'Licences', 'Access register'] },
  { key: 'x-data', label: 'Data platform', layer: 'asset', icon: 'cloud_sync', color: '#94a3b8', x: 970, y: Y.asset,
    blurb: 'SQL Server, integrations and backups.', owner: 'IT', holds: ['Data catalogue', 'Backup log'] },
];

export const CORTEX_EDGES: CortexEdge[] = [
  // The operating loop
  { from: 'cust', to: 'mkt', label: 'Enquiries & campaigns', kind: 'handoff' },
  { from: 'mkt', to: 'sales', label: 'Qualified leads', kind: 'handoff' },
  { from: 'sales', to: 'stock', label: 'Sales orders', kind: 'handoff' },
  { from: 'stock', to: 'prod', label: 'Components', kind: 'handoff' },
  { from: 'prod', to: 'stock', label: 'Finished goods', kind: 'handoff' },
  { from: 'stock', to: 'log', label: 'Picking lists', kind: 'handoff' },
  { from: 'log', to: 'cust', label: 'Deliveries + POD', kind: 'handoff' },
  { from: 'log', to: 'fin', label: 'Proof of delivery', kind: 'handoff' },
  { from: 'fin', to: 'cust', label: 'Invoices & statements', kind: 'handoff' },
  { from: 'stock', to: 'supp', label: 'Purchase orders', kind: 'handoff' },
  { from: 'supp', to: 'log', label: 'Inbound goods', kind: 'handoff' },
  { from: 'fin', to: 'supp', label: 'Payments', kind: 'handoff' },
  { from: 'hr', to: 'it', label: 'Starters & leavers', kind: 'handoff' },
  { from: 'hr', to: 'fin', label: 'Payroll changes', kind: 'handoff' },
  { from: 'rec', to: 'stock', label: 'Walk-in deliveries', kind: 'handoff' },
  { from: 'sales', to: 'fin', label: 'Credit checks', kind: 'handoff' },
  // Governance
  ...['sales', 'stock', 'fin', 'hr', 'it', 'log'].map(k => ({ from: 'mgmt', to: k, label: 'Approvals & targets', kind: 'approval' as const })),
  // Every department reads and writes the cortex
  ...['mkt', 'sales', 'stock', 'prod', 'log', 'fin', 'hr', 'it', 'rec'].map(k => ({ from: k, to: 'tx', label: 'Writes back every step', kind: 'data' as const })),
  { from: 'sales', to: 'md', label: 'Owns customers', kind: 'data' },
  { from: 'stock', to: 'md', label: 'Owns items', kind: 'data' },
  { from: 'hr', to: 'md', label: 'Owns employees', kind: 'data' },
  { from: 'it', to: 'docs', label: 'Runs the knowledge base', kind: 'data' },
  { from: 'md', to: 'dw', label: 'Rolls up', kind: 'data' },
  { from: 'tx', to: 'dw', label: 'Rolls up', kind: 'data' },
  { from: 'dw', to: 'mgmt', label: 'KPIs to the dashboard', kind: 'data' },
  // Agents read the cortex and draft for an owning department
  { from: 'a-kb', to: 'docs', label: 'Reads', kind: 'agent' },
  { from: 'a-sales', to: 'sales', label: 'Drafts for approval', kind: 'agent' },
  { from: 'a-stock', to: 'stock', label: 'Drafts POs', kind: 'agent' },
  { from: 'a-fin', to: 'fin', label: 'Flags mismatches', kind: 'agent' },
  { from: 'a-log', to: 'log', label: 'Triages exceptions', kind: 'agent' },
  { from: 'a-hr', to: 'hr', label: 'Runs checklists', kind: 'agent' },
  { from: 'a-rep', to: 'dw', label: 'Explains variances', kind: 'agent' },
  // Assets carry the work
  { from: 'x-fleet', to: 'log', label: 'Runs on', kind: 'asset' },
  { from: 'x-equip', to: 'stock', label: 'Runs on', kind: 'asset' },
  { from: 'x-equip', to: 'prod', label: 'Runs on', kind: 'asset' },
  { from: 'x-hw', to: 'it', label: 'Issued by', kind: 'asset' },
  { from: 'x-sys', to: 'tx', label: 'System of record', kind: 'asset' },
  { from: 'x-data', to: 'dw', label: 'Feeds', kind: 'asset' },
  { from: 'x-prem', to: 'mgmt', label: 'Owned by', kind: 'asset' },
];

export const CORTEX_STREAMS: CortexStream[] = [
  {
    key: 'l2c', label: 'Lead to cash', icon: 'paid', color: '#38bdf8',
    blurb: 'From a hospital enquiry to money in the bank.',
    steps: [
      { dept: 'mkt', text: 'Capture the lead and qualify it', match: ['lead', 'campaign', 'enquiry'], module: M.sales },
      { dept: 'sales', text: 'Quote, checking stock and credit', match: ['quote', 'enquiry to order', 'credit limit'], template: 'Customer credit limit request', module: M.sales },
      { dept: 'sales', text: 'Convert the accepted quote to an order', match: ['sales order', 'enquiry to order', 'order capture'], module: M.sales },
      { dept: 'stock', text: 'Allocate and issue the picking list', match: ['picking', 'allocate', 'reserve'], module: M.stock },
      { dept: 'log', text: 'Pick, deliver and capture the POD', match: ['pod', 'delivery', 'deliver'], template: 'Missing POD chaser', module: M.logistics },
      { dept: 'fin', text: 'Invoice on POD and collect', match: ['invoice', 'debtor', 'collect', 'payment'], module: M.finance },
      { dept: 'mgmt', text: 'Revenue, margin and debtor days update', match: ['month-end', 'report', 'kpi'], module: M.management },
    ],
  },
  {
    key: 'p2p', label: 'Procure to pay', icon: 'shopping_cart_checkout', color: '#34d399',
    blurb: 'From a requisition to a paid, scored supplier.',
    steps: [
      { dept: 'stock', text: 'Raise a purchase requisition', match: ['purchase request', 'requisition', 'purchase'], template: 'Purchase request approval', module: M.stock },
      { dept: 'mgmt', text: 'Approve the PO by value (approval matrix)', match: ['purchase request', 'approval'], template: 'Purchase request approval' },
      { dept: 'log', text: 'Receive the goods', match: ['receiving', 'inbound', 'goods receiv'], module: M.logistics },
      { dept: 'stock', text: 'Book the GRN', match: ['grn', 'goods receiv'], module: M.stock },
      { dept: 'fin', text: 'Match PO, GRN and invoice, then pay', match: ['creditor', 'supplier payment', 'match', 'invoice to payment'], module: M.finance },
      { dept: 'stock', text: 'Update the supplier scorecard', match: ['scorecard', 'supplier rating'] },
    ],
  },
  {
    key: 'o2d', label: 'Order to delivery', icon: 'local_shipping', color: '#22d3ee',
    blurb: 'Getting the right goods to the right ward on the promised day.',
    steps: [
      { dept: 'sales', text: 'Confirm the order with a delivery date', match: ['sales order', 'enquiry to order', 'delivery date'], module: M.sales },
      { dept: 'stock', text: 'Reserve items; short → procure to pay', match: ['reserve', 'shortage', 'reorder'], module: M.stock },
      { dept: 'log', text: 'Plan the route, dispatch, capture POD', match: ['delivery operations', 'dispatch', 'load', 'pod'], module: M.logistics },
      { dept: 'log', text: 'Failed deliveries flow back to Stock and Sales', match: ['exception', 'failed', 'triage', 'return'], template: 'Delivery exception triage', module: M.logistics },
    ],
  },
  {
    key: 'h2r', label: 'Hire to retire', icon: 'badge', color: '#c084fc',
    blurb: 'A person’s whole journey, with IT and Accounts in step.',
    steps: [
      { dept: 'mgmt', text: 'Department head requests a hire; approve if unbudgeted', match: ['hire', 'recruit', 'staff request'] },
      { dept: 'hr', text: 'Recruit, contract, create the employee record', match: ['recruit', 'staff request', 'onboard'], module: M.people },
      { dept: 'it', text: 'Issue accounts and devices', match: ['onboard', 'starter', 'access'], template: 'New starter onboarding', module: M.assets },
      { dept: 'fin', text: 'Add to payroll', match: ['onboard', 'payroll'], template: 'New starter onboarding' },
      { dept: 'hr', text: 'Reviews and leave', match: ['leave', 'review', 'performance'], module: M.people },
      { dept: 'hr', text: 'Exit: close record, remove access, final pay', match: ['leaver', 'offboard', 'exit'], template: 'Leaver offboarding' },
    ],
  },
  {
    key: 'i2r', label: 'Issue to resolution', icon: 'build_circle', color: '#fb923c',
    blurb: 'Log it once, route it to the owner, never solve it twice.',
    steps: [
      { dept: 'rec', text: 'A customer, employee or system raises an issue', match: ['issue', 'complaint', 'support request', 'ticket'], template: 'Issue to resolution', module: M.tickets },
      { dept: 'it', text: 'Logged once and routed to the owning department', match: ['issue to resolution', 'support request', 'triage'], template: 'Issue to resolution' },
      { dept: 'log', text: 'The owner resolves it, pulling others in', match: ['issue to resolution', 'exception', 'resolve'] },
      { dept: 'it', text: 'Repeatable fixes become an SOP / article', match: ['knowledge', 'sop', 'issue to resolution'], template: 'Issue to resolution', module: M.docs },
    ],
  },
];

/** Approval matrix. Thresholds are the company's placeholders until Management sets the final rand values. */
export const CORTEX_APPROVALS: CortexApproval[] = [
  { decision: 'Purchase order', requestedBy: 'Stock / any department', first: 'Department head', escalates: 'Accounts → Management', trigger: '> R20 000 / > R50 000 or over budget', template: 'Purchase request approval', match: ['purchase'] },
  { decision: 'Supplier payment', requestedBy: 'Creditors clerk', first: 'Financial manager', escalates: 'Management', trigger: 'Above set value, or new bank details', match: ['supplier payment', 'creditor'] },
  { decision: 'Customer credit limit', requestedBy: 'Sales', first: 'Accounts', escalates: 'Management', trigger: 'New account or > R100 000', template: 'Customer credit limit request', match: ['credit limit'] },
  { decision: 'Stock write-off / adjustment', requestedBy: 'Stock controller', first: 'Stock manager', escalates: 'Accounts → Management', trigger: '> R5 000 / > R25 000', template: 'Stock write-off approval', match: ['write-off', 'adjustment'] },
  { decision: 'New hire', requestedBy: 'Department head', first: 'HR', escalates: 'Management', trigger: 'Any unbudgeted position', match: ['hire', 'staff request', 'recruit'] },
  { decision: 'Leave', requestedBy: 'Employee', first: 'Line manager', escalates: 'Department head', trigger: 'Over policy limits', match: ['leave'] },
  { decision: 'New software / access', requestedBy: 'Any employee', first: 'IT', escalates: 'Management', trigger: 'New cost, or financial / HR data', match: ['access request', 'software', 'support request'] },
  { decision: 'AI agent action', requestedBy: 'Welly', first: 'Owning department', escalates: '—', trigger: 'Pays, sends externally, or changes master data', match: ['welly action', 'system action'] },
];

export const CORTEX_LAYERS: { key: CortexLayer; label: string; y: number }[] = [
  { key: 'gov', label: 'Governance', y: Y.gov },
  { key: 'dept', label: 'Departments', y: Y.dept },
  { key: 'core', label: 'The cortex', y: Y.core },
  { key: 'agent', label: 'AI agents · Welly', y: Y.agent },
  { key: 'asset', label: 'Assets & infrastructure', y: Y.asset },
];
