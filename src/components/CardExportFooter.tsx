import { forwardRef, type ReactNode } from 'react';

interface CardExportFooterProps {
  dataDate?: string | null;
  note?: ReactNode;
}

/**
 * "Data from {date}" footer shown on every exportable card. The trailing
 * "SportsSimulate.com" brand mention is only made visible for the duration
 * of a PNG capture (see useExportableCard's brandRef) - it stays hidden
 * during normal browsing.
 */
export const CardExportFooter = forwardRef<HTMLSpanElement, CardExportFooterProps>(function CardExportFooter(
  { dataDate, note },
  brandRef
) {
  if (!dataDate) return null;
  return (
    <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
      {note && <>{note} • </>}
      Data from {dataDate}
      <span ref={brandRef} style={{ display: 'none' }}>
        {' '}• SportsSimulate.com
      </span>
    </p>
  );
});
