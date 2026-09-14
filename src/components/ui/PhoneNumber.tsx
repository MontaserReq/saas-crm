export function PhoneNumber({ value, href, className = '' }: { value?: string | null; href?: string; className?: string }) {
  if (!value) return null;
  const numbers = value.split(/[,;/\n]+/).map((number) => number.trim()).filter(Boolean);
  return (
    <span dir="ltr" className={`inline-flex flex-wrap gap-x-2 gap-y-1 text-left ${className}`}>
      {numbers.map((number, index) => {
        const link = href && numbers.length === 1 ? href : `tel:${number.replace(/[^+\d]/g, '')}`;
        return <span key={`${number}-${index}`} className="whitespace-nowrap">{link ? <a href={link} className="hover:underline">{number}</a> : number}</span>;
      })}
    </span>
  );
}
