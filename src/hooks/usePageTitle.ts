import { useEffect } from 'react';

/**
 * Sets document.title to `${title} | SportsSimulate`, or just `SportsSimulate`
 * when no title is provided (e.g. while data is still loading).
 */
export function usePageTitle(title?: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} | SportsSimulate` : 'SportsSimulate';
  }, [title]);
}
