// Data types matching the JSON export format

export interface TeamProbabilities {
  ccg_probability: number;
  record_probabilities: Record<string, number>;
  conference_record_probabilities: Record<string, number>;
  ccg_probability_by_record: Record<string, number>;
  ccg_probability_by_conference_record: Record<string, number>;
}

export interface ConferenceProbabilities {
  conference: string;
  simulation_date: string;
  iterations: number;
  teams: Record<string, TeamProbabilities>;
}

export interface CCGMatchup {
  team_a: string;
  team_b: string;
  probability: number;
}

export interface CCGMatchups {
  conference: string;
  matchups: CCGMatchup[];
}

export interface WhatIfScenario {
  game_outcomes: Record<string, string>;
  ccg_probabilities: Record<string, number>;
  top_ccg_matchups: {
    teams: [string, string];
    probability: number;
  }[];
}

export interface EveryOutcome {
  conference: string;
  remaining_games: [string, string][];
  game_probabilities: Record<string, number>;  // game_key -> probability of team1 winning
  game_dates: Record<string, string>;  // game_key -> date string (YYYY-MM-DD)
  scenarios: Record<string, WhatIfScenario>;
}

export interface TeamMetadata {
  display_name: string;
  logo_url: string;
  primary_color: string;
  conference: string;
}

export interface ConferenceMetadata {
  display_name: string;
  teams: string[];
}

export interface SeasonTeams {
  season: string;
  teams: Record<string, TeamMetadata>;
  conferences: Record<string, ConferenceMetadata>;
}

export interface SeasonInfo {
  latest_date: string;
  dates: string[];
}

export interface SportInfo {
  name: string;
  current_season: string;
  seasons: Record<string, SeasonInfo>;
}

export interface DataIndex {
  sports: Record<string, SportInfo>;
}

// Schedule types
export interface GameResult {
  date: string;
  opponent: string;
  is_home: boolean;
  neutral: boolean;
  is_conference: boolean;
  is_complete: boolean;
  // For completed games
  won?: boolean;
  score?: string;
  points_for?: number;
  points_against?: number;
  // For upcoming games
  win_probability?: number;
}

export interface TeamSchedule {
  conference: string;
  wins: number;
  losses: number;
  games: GameResult[];
}

export interface Schedules {
  teams: Record<string, TeamSchedule>;
}

// Week Impact types
export interface GameImpact {
  away_team: string;
  home_team: string;
  ccg_prob_if_away_wins: number;
  ccg_prob_if_home_wins: number;
  impact_if_away_wins: number;
  impact_if_home_wins: number;
}

export interface ClinchingScenario {
  winners: string[];
  probability: number;
}

export interface TeamWeekImpact {
  current_ccg_probability: number;
  game_impacts: GameImpact[];
  clinching_scenarios: ClinchingScenario[];
  best_outcome: {
    winners: string[];
    probability: number;
    ccg_probability: number;
  } | null;
  best_realistic_outcome: {
    winners: string[];
    probability: number;
    ccg_probability: number;
  } | null;
}

export interface WeekImpact {
  conference: string;
  games: { away_team: string; home_team: string }[];
  teams: Record<string, TeamWeekImpact>;
}

// Tiebreaker types
export interface TiebreakerMatchup {
  team_a: string;
  team_b: string;
  probability: number;
}

export interface TiebreakerScenario {
  probability: number;
  teams_by_losses: Record<string, string[]>;
  ccg_matchups: TiebreakerMatchup[];
  team_ccg_probabilities: Record<string, number>;
}

export interface TiebreakerData {
  conference: string;
  total_scenarios: number;
  scenarios: TiebreakerScenario[];
}

// Loss scenario types
export interface LossScenario {
  losses_to: string[];
  ccg_probability: number;
  occurrence_probability: number;
}

export interface TeamLossScenarios {
  scenarios: LossScenario[];
}

export interface LossScenarioData {
  conference: string;
  teams: Record<string, TeamLossScenarios>;
}

// Timeline types
export interface TeamTimelineEntry {
  date: string;
  ccg_probability: number;
}

export interface TimelineData {
  conference: string;
  dates: string[];
  teams: Record<string, TeamTimelineEntry[]>;
}

// Client-side tiebreaker resolution types

/** A completed game result for tiebreaker resolution */
export interface ResolvedGame {
  opponent: string;
  won: boolean;
  pointsFor?: number;
  pointsAgainst?: number;
  neutral: boolean;
  isConference: boolean;
}

/** A team's full record for client-side tiebreaker resolution */
export interface TeamRecord {
  name: string;
  conference: string;
  games: ResolvedGame[];
}

/** Conference state built from schedule data + user selections */
export interface ConferenceState {
  name: string;
  teamNames: Set<string>;
  teams: Map<string, TeamRecord>;
}

/** A single step in the tiebreaker resolution process */
export interface TiebreakerLogStep {
  /** Which seed is being determined (1 or 2) */
  seed: number;
  /** Name of the tiebreaker step */
  stepName: string;
  /** Teams entering this step */
  teamsEntering: string[];
  /** Per-team detail values (e.g. win pct, record, etc.) */
  details: Record<string, string>;
  /** Whether this step broke the tie (separated teams into tiers) */
  resolved: boolean;
  /** The winning team(s) after this step, if resolved */
  advancingTeams?: string[];
  /** Teams eliminated in this step */
  eliminatedTeams?: string[];
}

/** Log of seeding decisions for one seed */
export interface SeedingLog {
  seed: number;
  teamName: string;
  /** How the seed was determined */
  method: 'outright' | 'tiebreaker';
  /** If outright, no steps needed. If tiebreaker, shows each step */
  steps: TiebreakerLogStep[];
}

/** Result of client-side tiebreaker resolution */
export interface TiebreakerResult {
  /** The two CCG participants, or null if games are unresolved */
  ccgParticipants: [string, string] | null;
  /** Whether a coin flip / random draw was needed */
  usedRandomDraw: boolean;
  /** Final conference standings: array of tiers (tied groups), best first */
  standings: string[][];
  /** Detailed log of how each seed was determined */
  seedingLog?: SeedingLog[];
}
