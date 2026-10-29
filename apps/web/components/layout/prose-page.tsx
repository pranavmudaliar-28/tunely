/** Layout for text pages (About, Privacy, Terms, Contact, DMCA). */
export function ProsePage({
  title,
  updated,
  children,
}: {
  title: string;
  /** Shown as "Last updated …" on policy pages. */
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="flex max-w-[720px] flex-col gap-4 px-4 pt-8 pb-16 text-[15px] leading-relaxed sm:px-14 [&_a]:underline [&_a]:underline-offset-2 [&_h2]:pt-4 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-text-soft [&_ul]:text-text-soft [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
      <h1 className="text-[32px] font-bold tracking-[-0.02em]">{title}</h1>
      {updated && <p className="text-text-muted text-[13px]">Last updated {updated}</p>}
      {children}
    </article>
  );
}
