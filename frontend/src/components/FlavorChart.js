import { formatRupee } from "../classifyListing";
import { benchmarkGroup, priceTone } from "../marketMath";

const TONE_COLOR = { base: "#2563eb", high: "#d97706", low: "#059669", near: "#64748b", empty: "#cbd5e1" };

const FlavorChart = ({ groups, onSelect }) => {
  const priced = groups.filter((group) => group.median);
  if (!priced.length) return <p className="sp-muted">No comparable prices in this run.</p>;

  const benchmark = benchmarkGroup(groups);
  const max = Math.max(...priced.map((group) => group.median));

  return (
    <div className="sp-bars" style={{ height: priced.length * 56 }}>
      {priced.map((group) => {
        const tone = priceTone(group.median, benchmark?.median, group.id, benchmark?.id);
        const width = Math.max(6, (group.median / max) * 68);
        return (
          <button
            key={group.id}
            type="button"
            className="sp-bar-row"
            onClick={() => onSelect && onSelect(group.id)}
          >
            <span className="sp-bar-name">{group.label}</span>
            <span className="sp-bar-track">
              <span className="sp-bar-fill" style={{ width: `${width}%`, background: TONE_COLOR[tone] }} />
              <span className="sp-bar-meta">
                {formatRupee(group.median)}
                <em>n={group.count}</em>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default FlavorChart;
