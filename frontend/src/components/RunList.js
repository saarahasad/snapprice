import { useMemo, useState } from "react";
import { FAMILIES, familyIdFromText, toTitleCase } from "../classifyListing";
import { relativeTime } from "../marketMath";

function productLabel(run) {
  const family = FAMILIES.find((entry) => entry.id === familyIdFromText(run.name));
  return family ? family.name : toTitleCase(run.name);
}

function groupRuns(runs) {
  const groups = [];
  runs.forEach((run) => {
    const label = productLabel(run);
    let group = groups.find((item) => item.label === label);
    if (!group) {
      group = { label, pins: [] };
      groups.push(group);
    }
    let pin = group.pins.find((item) => item.pincode === run.pincode);
    if (!pin) {
      pin = { pincode: run.pincode, latest: run, earlier: [] };
      group.pins.push(pin);
    } else {
      pin.earlier.push(run);
    }
  });
  return groups;
}

const RunList = ({ runs, runId, onSelect }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState({});
  const groups = useMemo(() => groupRuns(runs), [runs]);
  const needle = query.trim().toLowerCase();
  const visible = groups.filter((group) => {
    if (!needle) return true;
    if (group.label.toLowerCase().includes(needle)) return true;
    return group.pins.some((pin) => String(pin.pincode).includes(needle));
  });

  return (
    <nav className="sp-runs" aria-label="Saved price runs">
      <p className="sp-kicker">Runs</p>
      <input
        className="sp-run-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products"
        aria-label="Search products"
      />
      {runs.length === 0 ? (
        <p className="sp-muted">No runs yet. Refresh a product to start a file.</p>
      ) : visible.length === 0 ? (
        <p className="sp-muted">No product matches that search.</p>
      ) : (
        visible.map((group) => {
          const earlier = group.pins.flatMap((pin) => pin.earlier);
          const expanded = open[group.label] || earlier.some((run) => run.product_id === runId);
          const newest = group.pins[0]?.latest;
          return (
            <section key={group.label} className="sp-run-group">
              <strong>{group.label}</strong>
              <div className="sp-pin-row">
                {group.pins.map((pin) => {
                  const selected = pin.latest.product_id === runId || pin.earlier.some((run) => run.product_id === runId);
                  return (
                    <button
                      key={pin.pincode}
                      type="button"
                      className={`sp-pin ${selected ? "active" : ""}`}
                      onClick={() => onSelect(pin.latest)}
                    >
                      {pin.pincode}
                    </button>
                  );
                })}
              </div>
              {newest && <time className="sp-run-when">{relativeTime(newest.scraped_at)}</time>}
              {earlier.length > 0 && (
                <button
                  type="button"
                  className="sp-earlier"
                  aria-expanded={expanded}
                  onClick={() => setOpen((current) => ({ ...current, [group.label]: !expanded }))}
                >
                  {earlier.length} earlier {earlier.length === 1 ? "run" : "runs"}
                </button>
              )}
              {expanded && earlier.map((run) => (
                <button
                  key={run.product_id}
                  type="button"
                  className={`sp-earlier-run ${run.product_id === runId ? "active" : ""}`}
                  onClick={() => onSelect(run)}
                >
                  {run.pincode} · {relativeTime(run.scraped_at)}
                </button>
              ))}
            </section>
          );
        })
      )}
    </nav>
  );
};

export default RunList;
