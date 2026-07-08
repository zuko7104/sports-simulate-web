import { ConferenceLogo } from './ConferenceLogo';
import type { ConferenceMetadata } from '../types';

interface ConferenceSelectorProps {
  conferences: string[];
  selected: string;
  onChange: (conference: string) => void;
  conferenceNames?: Record<string, ConferenceMetadata>;
}

export function ConferenceSelector({
  conferences,
  selected,
  onChange,
  conferenceNames,
}: ConferenceSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {conferences.map((conf) => {
        const meta = conferenceNames?.[conf];
        return (
          <button
            key={conf}
            onClick={() => onChange(conf)}
            aria-label={meta?.display_name ?? conf}
            title={meta?.display_name ?? conf}
            className={`p-1.5 rounded-lg transition-colors border-2 ${
              selected === conf
                ? 'border-blue-600 bg-blue-50 dark:bg-blue-950'
                : 'border-transparent bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            <ConferenceLogo conference={conf} meta={meta} size="sm" />
          </button>
        );
      })}
    </div>
  );
}
