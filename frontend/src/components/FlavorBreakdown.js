import { formatRupee } from "../classifyListing";
import { benchmarkGroup, priceTone } from "../marketMath";

const FlavorBreakdown = ({ report, flavorFilter, onFocusFlavor, onOpenListings, familyMismatch }) => {
  if (!report) return null;

  const comparable = report.classified.filter((row) => row.flavorId !== "mix").length;
  const benchmark = benchmarkGroup(report.groups);
  const priced = report.groups.filter((group) => group.count > 0 && group.low != null && group.high != null);
  const scaleMin = priced.length ? Math.min(...priced.map((group) => group.low)) : 0;
  const scaleMax = priced.length ? Math.max(...priced.map((group) => group.high)) : 0;
  const span = scaleMax - scaleMin || 1;
  const place = (value) => ((value - scaleMin) / span) * 100;

  return (
    <section className="flavor-breakdown">
      {familyMismatch && <p className="mismatch-note">{familyMismatch}</p>}

        <div className="breakdown-heading">
          <div>
            <h3>Price by flavor</h3>
            <p>
              {comparable} comparable {comparable === 1 ? "listing" : "listings"}
              {report.mixes.length > 0
                ? `. ${report.mixes.length} gift packs and mixes are left out so they do not distort the per-kilo price.`
                : "."}
            </p>
          </div>
          {flavorFilter !== "all" && flavorFilter !== "mix" && (
            <button type="button" className="text-btn" onClick={() => onFocusFlavor("all")}>
              Show every flavor
            </button>
          )}
        </div>

      <div className="flavor-grid">
        {report.groups.map((group) => {
          const active = flavorFilter === group.id;
          const tone = priceTone(group.median, benchmark?.median, group.id, benchmark?.id);
          const single = group.count > 0 && group.low === group.high;
          return (
            <article
              key={group.id}
              className={`flavor-card tone-${tone} ${active ? "active" : ""} ${group.count === 0 ? "empty" : ""}`}
              onClick={() => onFocusFlavor(group.id)}
            >
              <span className="flavor-card-top">
                <span className="flavor-card-name">{group.label}</span>
                <span className="flavor-card-count">
                  {group.count} {group.count === 1 ? "listing" : "listings"}
                </span>
              </span>
              {group.count === 0 ? (
                <p className="flavor-empty">{group.emptyHint}</p>
              ) : (
                <>
                  <span className="price-figure">{formatRupee(group.median)}<small>/kg</small></span>
                  <span className="sp-range" aria-hidden="true">
                    <span
                      className="sp-range-bar"
                      style={{ left: `${place(group.low)}%`, width: `${Math.max(place(group.high) - place(group.low), 1.5)}%` }}
                    />
                    <span className="sp-range-med" style={{ left: `${place(group.median)}%` }} />
                  </span>
                  <span className="price-range">
                    {single ? "Single listing" : `${formatRupee(group.low)} – ${formatRupee(group.high)} /kg`}
                  </span>
                  {group.cheapest && (
                    <span className="cheapest-line">
                      Lowest: {group.cheapest.displayName || group.cheapest.item.product_name}
                    </span>
                  )}
                  {group.premium.length > 0 && (
                    <span className="premium-line">
                      Includes {group.premium.join(" and ")}, which sit at the top of this range.
                    </span>
                  )}
                  <span className="platform-line">
                    {group.platforms.map((platform) => `${platform.name} ${platform.count}`).join(" · ")}
                  </span>
                  <button
                    type="button"
                    className="sp-view-link"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenListings(group.id);
                    }}
                  >
                    View {group.count} {group.count === 1 ? "listing" : "listings"} →
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>

      {report.mixes.length > 0 && (
        <button
          type="button"
          className={`mix-toggle ${flavorFilter === "mix" ? "active" : ""}`}
          onClick={() => onFocusFlavor(flavorFilter === "mix" ? "all" : "mix")}
        >
          {flavorFilter === "mix" ? "Back to flavor prices" : `Show ${report.mixes.length} mixes and gift packs`}
        </button>
      )}
    </section>
  );
};

export default FlavorBreakdown;
