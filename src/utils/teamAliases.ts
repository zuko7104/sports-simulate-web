import type { SeasonTeams } from '../types';

/**
 * Expand a freshly-fetched teams.json payload so that every known alias of
 * a team also resolves via a direct `teams.teams[name]` lookup.
 *
 * Different data files (schedules.json, older cached scrapes, etc.) don't
 * always agree on which name they use for the same team (e.g. "Portland St"
 * vs "Portland State", or "Kansas St" vs "Kansas State"). Rather than
 * updating every call site that indexes into `teams.teams` to search
 * aliases, we do it once here: each alias listed in a team's `aliases`
 * array gets inserted as its own key pointing at the same TeamMetadata
 * object, as long as that key isn't already used by a distinct real team.
 */
export function expandTeamAliases(data: SeasonTeams): SeasonTeams {
  const expanded = { ...data.teams };

  for (const meta of Object.values(data.teams)) {
    for (const alias of meta.aliases ?? []) {
      if (!(alias in expanded)) {
        expanded[alias] = meta;
      }
    }
  }

  return { ...data, teams: expanded };
}
