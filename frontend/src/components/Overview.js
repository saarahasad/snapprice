import { FAMILIES, formatRupee, toTitleCase } from "../classifyListing";
import { PLATFORMS, benchmarkGroup, buildBrief, formatStamp, platformKey, platformMatrix, priceMovement, priceTone } from "../marketMath";
import FlavorChart from "./FlavorChart";

const Overview = ({ report, run, previousReport, previousRun, onOpenFlavor, live, onRetry, retrying, retryError }) => {
  const family = FAMILIES.find((entry) => entry.id === report.baseId);
  const title = family ? family.name : toTitleCase(run?.name || "Market");
  const brief = buildBrief(report);
  const matrix = platformMatrix(report);
  const movement = priceMovement(report, previousReport);
  const comparable = report.classified.filter((row) => row.flavorId !== "mix");
  const present = new Set(comparable.map((row) => platformKey(row.item.platform)));
  const missing = PLATFORMS.filter((name) => !present.has(name));
  const benchmark = benchmarkGroup(report.groups);
  const tone = (median, id) => priceTone(median, benchmark?.median, id, benchmark?.id);
  const stamp = formatStamp(run?.scraped_at || comparable[0]?.item.scraped_at);

  return (
    <div className="sp-stack">
      <header className="sp-page-head">
        <div>
          <p className="sp-kicker">{run?.pincode} · {stamp}</p>
          <div className="sp-title-line">
            <h2>{title}</h2>
            {live}
          </div>
        </div>
        <p className="sp-lead">
          Shelf prices from Blinkit, Zepto, and Swiggy Instamart, compared per kilogram so a 100 g pack and a 500 g pack can sit on the same scale.
        </p>
      </header>

      <section className="sp-brief">
        {brief.map((note) => (
          <article key={note.kicker} className="sp-note">
            <p className="sp-kicker">{note.kicker}</p>
            <h3>{note.title}</h3>
            <p>{note.body}</p>
          </article>
        ))}
      </section>

      <section className="sp-kpis">
        <article>
          <p className="sp-kicker">Comparable listings</p>
          <strong>{comparable.length}</strong>
          <span>{report.mixes.length} mixes kept out of the averages</span>
        </article>
        <article>
          <p className="sp-kicker">Platforms in this run</p>
          <strong>{present.size}</strong>
          <span>{present.size ? [...present].join(", ") : "None yet"}</span>
        </article>
        <article>
          <p className="sp-kicker">{benchmark ? `Benchmark median (${benchmark.label})` : "Benchmark median"}</p>
          <strong>{benchmark ? formatRupee(benchmark.median) : "No prices"}</strong>
          <span>per kilogram</span>
        </article>
        <article>
          <p className="sp-kicker">Benchmark range</p>
          <strong>{benchmark ? `${formatRupee(benchmark.low)}–${formatRupee(benchmark.high)}` : "No prices"}</strong>
          <span>lowest to highest ₹/kg</span>
        </article>
      </section>

      {missing.length > 0 && (
        <div className="sp-warns">
          {missing.map((name) => (
            <article key={name} className="sp-warn">
              <div>
                <strong>{name} returned nothing</strong>
                <p>This run has no {name} prices{retryError ? `. ${retryError}` : "."}</p>
              </div>
              <button type="button" onClick={() => onRetry(name)} disabled={Boolean(retrying)}>
                {retrying === name ? `Retrying ${name}…` : `Retry ${name}`}
              </button>
            </article>
          ))}
        </div>
      )}

      <section className="sp-split">
        <article className="sp-panel">
          <div className="sp-panel-head">
            <h3>Median price by flavor</h3>
            <p>Click a bar to open those listings.</p>
          </div>
          <FlavorChart groups={report.groups} onSelect={onOpenFlavor} />
          <ul className="sp-legend">
            <li><i className="tone-base" /> {benchmark ? benchmark.label : "Benchmark"}, the benchmark</li>
            <li><i className="tone-high" /> At least 8% above</li>
            <li><i className="tone-low" /> At least 8% below</li>
            <li><i className="tone-near" /> Close to the benchmark</li>
          </ul>
        </article>
        <article className="sp-panel">
          <div className="sp-panel-head">
            <h3>Since the previous run</h3>
            <p>
              {previousRun
                ? `${previousRun.name}, ${previousRun.pincode}, ${formatStamp(previousRun.scraped_at)}`
                : "No earlier run of this product at this pincode."}
            </p>
          </div>
          {movement.length === 0 ? (
            <p className="sp-muted">A second run is what makes a price move visible. Refresh this product to start a comparison.</p>
          ) : (
            <ul className="sp-moves">
              {movement.map((move) => (
                <li key={move.id}>
                  <span>{move.label}</span>
                  <strong className={move.direction}>
                    {move.direction === "flat"
                      ? "Unchanged"
                      : `${move.direction === "up" ? "Up" : "Down"} ${Math.abs(Math.round(move.delta * 100))}%`}
                  </strong>
                  <em>
                    {formatRupee(move.from)} → {formatRupee(move.to)} /kg
                  </em>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="sp-panel">
        <div className="sp-panel-head">
          <h3>Same flavor, different app</h3>
          <p>Median ₹/kg. A dash means that platform had no listing in the flavor.</p>
        </div>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Flavor</th>
                <th className="num">Listings</th>
                {PLATFORMS.map((name) => (
                  <th key={name} className="num">{name}</th>
                ))}
                <th className="num">All platforms</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.id}>
                  <td><span className={`sp-pill tone-${tone(row.median, row.id)}`}>{row.label}</span></td>
                  <td className="num">{row.count}</td>
                  {PLATFORMS.map((name) => (
                    <td key={name} className="num">
                      {row.cells[name].median ? (
                        <div className={`sp-rate plat-${name.toLowerCase()}`}>
                          <span>{formatRupee(row.cells[name].median)}</span>
                          <span className="sp-cell-note">
                            {row.cells[name].count} {row.cells[name].count === 1 ? "listing" : "listings"}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  ))}
                  <td className="num">{formatRupee(row.median)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sp-panel">
        <div className="sp-panel-head">
          <h3>Cheapest pack in each flavor</h3>
          <p>The shelf price a buyer actually pays, next to the per-kilo rate.</p>
        </div>
        <div className="sp-table-wrap">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Flavor</th>
                <th>Platform</th>
                <th>Product</th>
                <th>Pack</th>
                <th className="num">Shelf price</th>
                <th className="num">₹/kg</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.filter((group) => group.cheapest).map((group) => (
                <tr key={group.id}>
                  <td><span className={`sp-pill tone-${tone(group.median, group.id)}`}>{group.label}</span></td>
                  <td><span className={`sp-plat-tag plat-${platformKey(group.cheapest.item.platform).toLowerCase()}`}>{platformKey(group.cheapest.item.platform)}</span></td>
                  <td>{group.cheapest.displayName || group.cheapest.item.product_name}</td>
                  <td>{group.cheapest.item.packaging_size}</td>
                  <td className="num">{formatRupee(group.cheapest.item.discounted_price, 0)}</td>
                  <td className="num">{formatRupee(group.cheapest.pricePerKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="sp-method">
        Medians ignore gift boxes and mixed dry-fruit packs, because those prices are not a nut price. Flavors are read from the product title, so “salt & pepper” stays separate from “salted”, and “salted” stays separate from plain.
      </p>
    </div>
  );
};

export default Overview;
