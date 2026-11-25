/**
 * Empty-state illustrations (visual refresh): one small family of flat scenes drawn in the
 * module accent (--accent / --accent-soft) so they recolour per module and in dark mode.
 * 160×110 viewBox. Classes: .a = accent, .s = accent tint, .n = neutral, .l = line.
 */
export type IllustrationKey = 'inbox' | 'tiles' | 'relax' | 'kanban' | 'boxes' | 'chat' | 'search' | 'calendar' | 'docs' | 'done' | 'truck' | 'chart';

const ground = `<ellipse class="s" cx="80" cy="100" rx="58" ry="6"/>`;

export const ILLUSTRATIONS: Record<IllustrationKey, string> = {
  inbox: `${ground}
    <path class="n" d="M38 60 L52 34 H108 L122 60 V88 a4 4 0 0 1 -4 4 H42 a4 4 0 0 1 -4 -4 Z"/>
    <path class="s" d="M38 60 H62 l6 10 h24 l6 -10 H122 V88 a4 4 0 0 1 -4 4 H42 a4 4 0 0 1 -4 -4 Z"/>
    <path class="l" d="M38 60 H62 l6 10 h24 l6 -10 H122"/>
    <circle class="a" cx="118" cy="26" r="3"/><path class="a" d="M128 38 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z"/><circle class="a" cx="40" cy="30" r="2"/>`,
  tiles: `${ground}
    <rect class="n" x="34" y="20" width="76" height="66" rx="6"/>
    <rect class="s" x="42" y="28" width="28" height="22" rx="4"/><rect class="a" x="74" y="28" width="28" height="22" rx="4"/>
    <rect class="s" x="42" y="54" width="28" height="24" rx="4" stroke-dasharray="3 3"/><rect class="s" x="74" y="54" width="28" height="24" rx="4"/>
    <circle class="a" cx="126" cy="44" r="7"/><path class="a" d="M118 56 h16 l2 30 h-20 z"/>
    <path class="l" d="M120 62 l-26 8"/><rect class="a" x="86" y="64" width="16" height="12" rx="3" transform="rotate(-10 94 70)"/>`,
  relax: `${ground}
    <path class="n" d="M50 56 h48 v20 a18 18 0 0 1 -18 18 h-12 a18 18 0 0 1 -18 -18 z"/>
    <path class="l" d="M98 62 h6 a8 8 0 0 1 0 16 h-6" fill="none"/>
    <path class="a" d="M62 46 c-4 -6 4 -10 0 -16 M74 46 c-4 -6 4 -10 0 -16 M86 46 c-4 -6 4 -10 0 -16" fill="none" stroke-width="2.5" stroke-linecap="round"/>
    <circle class="a" cx="122" cy="34" r="12"/><path d="M116 34 l4 4 l8 -8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  kanban: `${ground}
    <rect class="n" x="26" y="20" width="108" height="70" rx="6"/>
    <rect class="s" x="34" y="28" width="28" height="6" rx="3"/><rect class="s" x="66" y="28" width="28" height="6" rx="3"/><rect class="s" x="98" y="28" width="28" height="6" rx="3"/>
    <rect class="a" x="34" y="40" width="28" height="16" rx="3"/><rect class="s" x="34" y="60" width="28" height="12" rx="3"/>
    <rect class="s" x="66" y="40" width="28" height="22" rx="3"/>
    <rect class="s" x="98" y="40" width="28" height="12" rx="3" stroke-dasharray="3 3"/>
    <path class="a" d="M128 70 l14 -14 l4 4 l-14 14 l-6 2 z"/>`,
  boxes: `${ground}
    <rect class="n" x="36" y="84" width="88" height="8" rx="2"/>
    <rect class="s" x="40" y="58" width="36" height="26" rx="3"/><rect class="a" x="80" y="58" width="36" height="26" rx="3"/>
    <rect class="s" x="60" y="30" width="36" height="26" rx="3"/>
    <path class="l" d="M58 58 v8 M98 58 v8 M78 30 v8"/>
    <path class="a" d="M118 26 l6 -6 m-2 12 h8 M110 18 v-6" stroke-width="2.5" stroke-linecap="round"/>`,
  chat: `${ground}
    <path class="s" d="M30 28 h60 a8 8 0 0 1 8 8 v24 a8 8 0 0 1 -8 8 H52 l-12 10 v-10 h-10 a8 8 0 0 1 -8 -8 V36 a8 8 0 0 1 8 -8 z"/>
    <path class="a" d="M74 50 h52 a8 8 0 0 1 8 8 v20 a8 8 0 0 1 -8 8 h-6 v10 l-12 -10 H74 a8 8 0 0 1 -8 -8 V58 a8 8 0 0 1 8 -8 z"/>
    <circle class="n" cx="46" cy="48" r="3"/><circle class="n" cx="58" cy="48" r="3"/><circle class="n" cx="70" cy="48" r="3"/>
    <path d="M84 68 h34 M84 76 h22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
  search: `${ground}
    <circle class="s" cx="72" cy="52" r="28"/><circle class="l" cx="72" cy="52" r="28" fill="none" stroke-width="5"/>
    <path class="a" d="M92 72 l22 22" stroke-width="9" stroke-linecap="round"/>
    <circle class="n" cx="63" cy="48" r="4"/><circle class="n" cx="81" cy="48" r="4"/>
    <path class="l" d="M64 64 q8 -5 16 0" fill="none"/><path class="a" d="M118 26 q0 -8 8 -8 q8 0 8 8 q0 6 -8 8 v4" fill="none" stroke-width="3" stroke-linecap="round"/><circle class="a" cx="126" cy="46" r="2"/>`,
  calendar: `${ground}
    <rect class="n" x="40" y="24" width="80" height="68" rx="8"/><rect class="a" x="40" y="24" width="80" height="16" rx="8"/>
    <path class="l" d="M58 18 v12 M102 18 v12"/>
    <rect class="s" x="50" y="48" width="12" height="10" rx="2"/><rect class="s" x="68" y="48" width="12" height="10" rx="2"/><rect class="a" x="86" y="48" width="12" height="10" rx="2"/>
    <rect class="s" x="50" y="64" width="12" height="10" rx="2"/><rect class="s" x="68" y="64" width="12" height="10" rx="2"/><rect class="s" x="86" y="64" width="12" height="10" rx="2"/>`,
  docs: `${ground}
    <rect class="s" x="46" y="26" width="52" height="64" rx="5" transform="rotate(-8 72 58)"/>
    <rect class="n" x="58" y="22" width="52" height="66" rx="5"/>
    <path class="l" d="M66 38 h34 M66 48 h34 M66 58 h22"/><rect class="a" x="66" y="66" width="20" height="12" rx="3"/>
    <circle class="a" cx="118" cy="30" r="3"/>`,
  done: `${ground}
    <circle class="s" cx="80" cy="54" r="34"/><circle class="a" cx="80" cy="54" r="22"/>
    <path class="check-draw" d="M70 54 l7 7 l14 -14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle class="a" cx="36" cy="30" r="3"/><circle class="a" cx="128" cy="36" r="2.5"/><path class="a" d="M124 76 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z"/>`,
  truck: `${ground}
    <rect class="a" x="28" y="40" width="64" height="40" rx="4"/><path class="n" d="M92 52 h20 l14 14 v14 H92 z"/>
    <path class="s" d="M98 56 h12 l9 9 H98 z"/>
    <circle class="l" cx="48" cy="84" r="8" fill="var(--color-surface)" stroke-width="4"/><circle class="l" cx="110" cy="84" r="8" fill="var(--color-surface)" stroke-width="4"/>
    <path class="s" d="M10 52 h12 M4 62 h18 M12 72 h10" stroke-width="3" stroke-linecap="round"/>`,
  chart: `${ground}
    <rect class="n" x="30" y="22" width="100" height="70" rx="6"/>
    <rect class="s" x="44" y="58" width="12" height="24" rx="2"/><rect class="s" x="62" y="46" width="12" height="36" rx="2"/>
    <rect class="a" x="80" y="36" width="12" height="46" rx="2"/><rect class="s" x="98" y="52" width="12" height="30" rx="2"/>
    <path class="l" d="M44 40 l18 -8 l18 6 l26 -12" fill="none"/>`,
};

/** Picks a scene from the empty state's icon when none is given. */
export function illustrationFor(icon: string | null | undefined): IllustrationKey {
  const i = (icon ?? '').toLowerCase();
  if (/search|filter|find|manage_search|travel_explore/.test(i)) return 'search';
  if (/chat|forum|message|sms|comment|question_answer/.test(i)) return 'chat';
  if (/task|check|done|verified|celebration|thumb_up|playlist_add_check/.test(i)) return 'relax';
  if (/dashboard|widgets|grid|apps|view_quilt|space_dashboard/.test(i)) return 'tiles';
  if (/kanban|view_column|board|view_week|assignment/.test(i)) return 'kanban';
  if (/inventory|box|package|warehouse|category|stock|pallet/.test(i)) return 'boxes';
  if (/event|calendar|today|date|schedule/.test(i)) return 'calendar';
  if (/description|folder|article|file|doc|receipt|picture_as_pdf|request_quote/.test(i)) return 'docs';
  if (/truck|shipping|local_shipping|route|delivery|directions_car/.test(i)) return 'truck';
  if (/chart|insights|trending|analytics|bar_chart|monitoring|query_stats/.test(i)) return 'chart';
  return 'inbox';
}
