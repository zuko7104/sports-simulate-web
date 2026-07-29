/**
 * Encodes/decodes What-If Explorer game-winner selections into the `state`
 * query param: each game is a base-3 digit (0 = unselected, 1 = teamA won,
 * 2 = teamB won) in the game list's order, most-significant digit first;
 * the resulting base-3 number is written out as hex.
 */
export interface GameSlot {
  gameKey: string;
  teamA: string;
  teamB: string;
}

export function encodeGameWinnersState(games: GameSlot[], winners: Record<string, string>): string {
  let value = 0n;
  for (const game of games) {
    const winner = winners[game.gameKey];
    const digit = winner === game.teamA ? 1n : winner === game.teamB ? 2n : 0n;
    value = value * 3n + digit;
  }
  return value === 0n ? '' : value.toString(16);
}

export function decodeGameWinnersState(games: GameSlot[], hex: string | null): Record<string, string> {
  const winners: Record<string, string> = {};
  if (!hex) return winners;

  let value: bigint;
  try {
    value = BigInt(`0x${hex}`);
  } catch {
    return winners;
  }

  // Peel off base-3 digits from least- to most-significant, filling from the
  // end of the (fixed-length) game list so unselected leading games — whose
  // digits are 0 and vanish from the hex value — still line up correctly.
  const digits = new Array(games.length).fill(0);
  for (let i = games.length - 1; i >= 0 && value > 0n; i--) {
    digits[i] = Number(value % 3n);
    value /= 3n;
  }

  games.forEach((game, i) => {
    if (digits[i] === 1) winners[game.gameKey] = game.teamA;
    else if (digits[i] === 2) winners[game.gameKey] = game.teamB;
  });
  return winners;
}
