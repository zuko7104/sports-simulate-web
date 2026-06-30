interface TeamLogoProps {
  team: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function TeamLogo({ team, size = 'md', className = '' }: TeamLogoProps) {
  const sizeClass = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size];

  const logoPath = `/assets/cfb/logos/${team.toLowerCase().replace(/ /g, '_')}.png`;

  return (
    <img
      src={logoPath}
      alt={team}
      className={`${sizeClass} object-contain ${className}`}
      onError={(e) => {
        // Fallback to a placeholder if logo doesn't exist
        (e.target as HTMLImageElement).src = '/assets/cfb/logos/placeholder.png';
      }}
    />
  );
}
