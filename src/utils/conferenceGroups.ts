// Grouping of conference/group codes into broad tiers for the conference
// switcher dropdown. teams.json doesn't carry an explicit tier field, so
// P4/G6 membership is hardcoded here (it changes rarely - realignment is a
// multi-year event) while everything else is derived from `has_simulation`
// and the code itself.

export type ConferenceGroup = 'p4' | 'g6' | 'independents' | 'fcs';

const P4_CODES = new Set(['ACC', 'B10', 'B12', 'SEC']);

// "Group of 6" - the other simulated FBS conferences, plus other
// non-simulated-but-FBS groups like the 2025 Pac-12 remnant (P12), which
// don't fit neatly into P4/independents/FCS.
const G6_CODES = new Set(['AAC', 'CUSA', 'MAC', 'MWC', 'SBC', 'P12']);

const FBS_INDEPENDENTS_CODE = 'FBS Independents';

export const GROUP_ORDER: ConferenceGroup[] = ['p4', 'g6', 'independents', 'fcs'];

export const GROUP_LABELS: Record<ConferenceGroup, string> = {
  p4: 'Power 4',
  g6: 'Group of 6',
  independents: 'FBS Independents',
  fcs: 'FCS',
};

export function conferenceGroup(code: string): ConferenceGroup {
  if (P4_CODES.has(code)) return 'p4';
  if (G6_CODES.has(code)) return 'g6';
  if (code === FBS_INDEPENDENTS_CODE) return 'independents';
  return 'fcs';
}
