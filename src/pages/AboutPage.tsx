import { usePageTitle } from '../hooks/usePageTitle';

export function AboutPage() {
  usePageTitle('About');

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 prose-content">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">How SportsSimulate Works</h1>
        <p className="text-gray-600 dark:text-gray-400">
          What the probabilities on this site mean, and how they're calculated
        </p>
      </header>

      <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Monte Carlo simulation</h2>
          <p>
            Rather than predicting a single outcome, SportsSimulate replays each conference's remaining schedule
            tens of thousands of times, with every game's result drawn randomly according to a win probability
            estimate for that matchup. Counting how often a team ends up in a given scenario across all of those
            simulated seasons — winning the conference, making the championship game, finishing with a particular
            record — produces the percentages shown throughout the site. A "62% chance to make the CCG" means the
            team reached the championship game in roughly 62 out of every 100 simulated versions of the rest of
            the season.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Where the win probabilities come from</h2>
          <p>
            Each simulated game's outcome is drawn from a win probability derived from each team's current rating,
            based on results so far this season. Ratings are refreshed weekly as new games are played, so
            probabilities update throughout the season rather than being fixed at the preseason.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Tiebreakers</h2>
          <p>
            When simulated seasons end in a tie, the site applies each conference's actual published tiebreaker
            procedure (head-to-head record, common opponents, strength of schedule, and so on) to determine who
            advances. Some tiebreaker steps depend on things that can't be known in advance, like point
            differential in games not yet played — those cases show up as "uncertain" scenarios rather than a
            forced pick.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">What-If and Flowchart tools</h2>
          <p>
            The What-If Explorer and CCG Flowchart pages let you pick winners for upcoming games yourself and see
            how the championship probabilities shift in response, using the same underlying simulation data —
            useful for answering "what does this team need to happen to make the title game?"
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Limitations</h2>
          <p>
            These are statistical estimates, not predictions of what will actually happen — injuries, coaching
            changes, and plain old randomness in individual games mean any single week can look very different
            from the odds. Treat the numbers as a way to understand how much a given result matters, not as a
            guarantee.
          </p>
        </section>
      </div>
    </div>
  );
}
