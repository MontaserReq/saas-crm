export function PhoneNumber({ value, href, className = '' }: { value?: string | null; href?: string; className?: string }) {
  if (!value) return null;
  return <span dir="ltr" className={`inline-block text-left whitespace-nowrap ${className}`}>{href ? <a href={href} className="hover:underline">{value}</a> : value}</span>;
}
