import { FAMILIES, familyIdFromText, toTitleCase } from "../classifyListing";
import { formatStamp } from "../marketMath";

const RunList = ({ runs, runId, onSelect }) => (
  <nav className="sp-runs" aria-label="Saved price runs">
    <p className="sp-kicker">Runs</p>
    {runs.length === 0 ? (
      <p className="sp-muted">No runs yet. Refresh a product to start a file.</p>
    ) : (
      <ul>
        {runs.map((run) => {
          const family = FAMILIES.find((entry) => entry.id === familyIdFromText(run.name));
          const label = family ? family.name : toTitleCase(run.name);
          return (
            <li key={run.product_id}>
              <button
                type="button"
                className={run.product_id === runId ? "active" : ""}
                onClick={() => onSelect(run)}
              >
                <strong>{label}</strong>
                <span>{run.pincode}</span>
                <time>{formatStamp(run.scraped_at)}</time>
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </nav>
);

export default RunList;
