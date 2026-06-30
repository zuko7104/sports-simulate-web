interface ConferenceSelectorProps {
  conferences: string[];
  selected: string;
  onChange: (conference: string) => void;
  conferenceNames?: Record<string, { display_name: string }>;
}

export function ConferenceSelector({
  conferences,
  selected,
  onChange,
  conferenceNames,
}: ConferenceSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {conferences.map((conf) => (
        <button
          key={conf}
          onClick={() => onChange(conf)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selected === conf
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {conferenceNames?.[conf]?.display_name ?? conf}
        </button>
      ))}
    </div>
  );
}
