import Image from 'next/image';

type BrandLogoProps = {
  className?: string;
  alt?: string;
  tone?: 'auto' | 'purple' | 'white';
  variant?: 'wordmark' | 'symbol';
  priority?: boolean;
};

const wordmark = {
  purple: '/branding/satrcrm-en-purple.svg',
  white: '/branding/satrcrm-en-white.svg',
};

const symbol = {
  purple: '/branding/icons/satrcrm-symbol-purple.svg',
  white: '/branding/icons/satrcrm-symbol-white.svg',
};

export function BrandLogo({
  className = '',
  alt = 'SatrCRM',
  tone = 'auto',
  variant = 'wordmark',
  priority = false,
}: BrandLogoProps) {
  const sources = variant === 'wordmark' ? wordmark : symbol;
  const dimensions = variant === 'wordmark'
    ? { width: 381, height: 96 }
    : { width: 100, height: 100 };

  if (tone !== 'auto') {
    return (
      <Image
        src={sources[tone]}
        alt={alt}
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <span className={`inline-flex shrink-0 ${className}`} role="img" aria-label={alt}>
      <Image
        src={sources.purple}
        alt=""
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className="dark:hidden"
        aria-hidden="true"
      />
      <Image
        src={sources.white}
        alt=""
        width={dimensions.width}
        height={dimensions.height}
        priority={priority}
        className="hidden dark:block"
        aria-hidden="true"
      />
    </span>
  );
}
