import { TeamLogo } from './TeamLogo';
import type { LossScenario, SeasonTeams } from '../types';

interface LossScenariosProps {
  teamName: string;
  scenarios: LossScenario[];
  teams: SeasonTeams;
  teamColor?: string;
  conference?: string;
  currentLossOpponents?: string[];
}

function formatPercent(value: number): string {
  if (value < 0.001) return '<0.1%';
  return `${(value * 100).toFixed(1)}%`;
}

export function LossScenarios({ teamName, scenarios, teamColor = '#3b82f6', currentLossOpponents = [] }: LossScenariosProps) {
  if (!scenarios || scenarios.length === 0) return null;

  const currentLossSet = new Set(currentLossOpponents);
  const currentLossCount = currentLossOpponents.length;

  // Group by number of losses
  const byLossCount = new Map<number, LossScenario[]>();
  for (const scenario of scenarios) {
    const count = scenario.losses_to.length;
    if (!byLossCount.has(count)) byLossCount.set(count, []);
    byLossCount.get(count)!.push(scenario);
  }

  // Calculate aggregate CCG probability per loss count (weighted by occurrence)
  function aggregateCcgProb(group: LossScenario[]): number {
    const totalOccurrence = group.reduce((sum, s) => sum + s.occurrence_probability, 0);
    if (totalOccurrence === 0) return 0;
    return group.reduce((sum, s) => sum + s.ccg_probability * s.occurrence_probability, 0) / totalOccurrence;
  }

  function aggregateOccurrenceProb(group: LossScenario[]): number {
    return group.reduce((sum, s) => sum + s.occurrence_probability, 0);
  }

  const renderRow = (
    key: string | number,
    label: React.ReactNode,
    ccgProb: number,
    occurrenceProb: number,
    bold: boolean = false,
  ) => {
    const barWidth = ccgProb * 100;
    return (
      <div key={key} className={`flex items-center gap-2 ${bold ? 'mt-3 first:mt-0' : ''}`}>
        <div className={`w-28 flex flex-wrap gap-0.5 justify-end shrink-0 ${bold ? 'font-semibold text-sm text-gray-700' : ''}`}>
          {label}
        </div>
        <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden relative">
          <div
            className="h-full rounded transition-all duration-300"
            style={{
              width: `${barWidth}%`,
              backgroundColor: teamColor,
              opacity: bold ? 0.85 : 0.7,
            }}
          />
          <span className="absolute inset-y-0 flex items-center pl-2 text-xs font-mono font-semibold text-white"
            style={{ textShadow: '0 0 3px rgba(0,0,0,0.7), 0 0 6px rgba(0,0,0,0.4)' }}
          >
            {formatPercent(ccgProb)}
          </span>
        </div>
        <span className="text-xs text-gray-400 w-20 text-right font-mono shrink-0">
          {formatPercent(occurrenceProb)}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-1.5 overflow-hidden">
      <p className="text-sm text-gray-600 mb-2">
        CCG probability given specific future losses
      </p>

      {/* Column headings */}
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide pb-1 border-b border-gray-200">
        <div className="w-28 text-right shrink-0">Future Losses</div>
        <div className="flex-1 flex items-center justify-center gap-1"><TeamLogo team={teamName} size="xs" /> CCG Probability</div>
        <div className="w-20 text-right shrink-0">Likelihood</div>
      </div>

      {[...byLossCount.entries()].sort(([a], [b]) => a - b).map(([lossCount, lossScenariosGroup]) => {
        const sorted = lossScenariosGroup.sort((a, b) => b.ccg_probability - a.ccg_probability);
        const moreLosses = lossCount - currentLossCount;
        const lossLabel = moreLosses <= 0
          ? 'Win out'
          : `Any ${moreLosses} loss${moreLosses > 1 ? 'es' : ''}`;
        const showAggregate = sorted.length > 1;
        const aggCcgProb = aggregateCcgProb(sorted);
        const allSame = aggCcgProb >= 0.9999;

        return (
          <div key={lossCount} className="space-y-1.5">
            {showAggregate && renderRow(
              `agg-${lossCount}`,
              <span>{lossLabel}</span>,
              aggCcgProb,
              aggregateOccurrenceProb(sorted),
              true,
            )}
            {!(showAggregate && allSame) && sorted.map((scenario, i) => {
              const futureLosses = scenario.losses_to.filter(opp => !currentLossSet.has(opp));
              return renderRow(
                i,
                futureLosses.length === 0 ? (
                  <span>Win out</span>
                ) : (
                  futureLosses.map(opp => (
                    <TeamLogo key={opp} team={opp} size="xs" />
                  ))
                ),
                scenario.ccg_probability,
                scenario.occurrence_probability,
                futureLosses.length === 0,
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
