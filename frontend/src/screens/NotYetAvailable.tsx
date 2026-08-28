interface NotYetAvailableProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly needs: readonly string[];
  readonly onBack: () => void;
}

/**
 * Placeholder for steps 3 and 4.
 *
 * The engine does not yet export validation results, weekly aggregates, recent
 * averages or weeks of cover, so there is nothing real to render. This screen
 * names the missing contract instead of inventing numbers.
 */
export function NotYetAvailable({ eyebrow, title, needs, onBack }: NotYetAvailableProps) {
  return (
    <>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="title">{title}</h1>
      <p className="lede">
        This step is waiting on the domain engine. The interface is deliberately empty rather than
        showing placeholder figures that could be mistaken for real results.
      </p>

      <section className="card pending">
        <h2 className="card-title">Waiting on these engine exports</h2>
        <ul className="pending__list">
          {needs.map((need) => (
            <li key={need}><code>{need}</code></li>
          ))}
        </ul>
        <p className="card-sub">
          Once these land in <code>contracts.ts</code> and <code>index.ts</code>, this screen can be
          built against them without changing steps 1 and 2.
        </p>
      </section>

      <div className="footer-row">
        <button type="button" className="btn--link" onClick={onBack}>← Back</button>
      </div>
    </>
  );
}
