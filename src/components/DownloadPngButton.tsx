interface DownloadPngButtonProps {
  downloading: boolean;
  onClick: () => void;
  className?: string;
}

export function DownloadPngButton({ downloading, onClick, className = '' }: DownloadPngButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={downloading}
      className={`text-xs px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 ${className}`}
    >
      {downloading ? 'Preparing…' : 'Download PNG'}
    </button>
  );
}
