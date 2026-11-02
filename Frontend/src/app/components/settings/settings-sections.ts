import { SubPage, findSubPage } from '../../ui/sub-pages';

/** Admin settings sections, each at /settings/<slug>, in navigation order. */
export type SettingsSlug =
  | 'users' | 'clock-in' | 'email-accounts'
  | 'announcements' | 'gallery' | 'document-templates'
  | 'pod-uploader' | 'client-locations' | 'assets' | 'data-import'
  | 'logs' | 'database';

export interface SettingsSection extends SubPage<SettingsSlug> {
  group: string;
}

/** The sections, grouped so any one is a click away in the side navigation. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { group: 'People & access', slug: 'users', label: 'Users', icon: 'people', hint: 'Accounts, roles, departments and module permissions' },
  { group: 'People & access', slug: 'clock-in', label: 'Clock-in employees', icon: 'fingerprint', hint: 'Staff on the clock-in devices' },
  { group: 'People & access', slug: 'email-accounts', label: 'Email accounts', icon: 'email', hint: 'Company mailboxes and their passwords' },
  { group: 'Content', slug: 'announcements', label: 'Announcements', icon: 'campaign', hint: 'News shown to everyone on the intranet' },
  { group: 'Content', slug: 'gallery', label: 'Dashboard gallery', icon: 'photo_library', hint: 'Images for the dashboard slideshow' },
  { group: 'Content', slug: 'document-templates', label: 'Document templates', icon: 'auto_awesome', hint: 'Sage document layouts' },
  { group: 'Operations data', slug: 'pod-uploader', label: 'POD uploader', icon: 'fact_check', hint: 'Match proofs of delivery to invoices' },
  { group: 'Operations data', slug: 'client-locations', label: 'Client locations', icon: 'where_to_vote', hint: 'Verified delivery addresses and the maps key' },
  { group: 'Operations data', slug: 'assets', label: 'Assets', icon: 'inventory_2', hint: 'Company equipment and who has it' },
  { group: 'Operations data', slug: 'data-import', label: 'Data import', icon: 'upload_file', hint: 'Import invoices and other data from Excel or CSV' },
  { group: 'System', slug: 'logs', label: 'System logs', icon: 'history', hint: 'Activity and error logs' },
  { group: 'System', slug: 'database', label: 'Database & backup', icon: 'storage', hint: 'Backups, restores and database size' },
];

export function settingsSection(slug: string | null | undefined): SettingsSection | undefined {
  return findSubPage(SETTINGS_SECTIONS, slug);
}

export interface SettingsGroup {
  label: string;
  sections: SettingsSection[];
}

/** Sections under their group headings, keeping the order they're listed in. */
export function groupSections(sections: readonly SettingsSection[]): SettingsGroup[] {
  const groups: SettingsGroup[] = [];
  for (const s of sections) {
    let g = groups.find(x => x.label === s.group);
    if (!g) groups.push(g = { label: s.group, sections: [] });
    g.sections.push(s);
  }
  return groups;
}
