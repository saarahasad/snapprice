import { useMemo, useState } from "react";
import { formatPercent, formatRupee } from "../classifyListing";
import { benchmarkFromClassified, downloadListings, platformKey, priceTone } from "../marketMath";

const NUMBER_COLUMNS = [
  { key: "shelf", label: "Shelf price" },
  { key: "mrp", label: "MRP" },
  { key: "off", label: "Off" },
  { key: "kg", label: "₹/kg" },
];

function numberValue(row, key) {
  if (key === "shelf") return Number(row.item.discounted_price) || 0;
  if (key === "mrp") return Number(row.item.original_price) || 0;
  if (key === "off") return Number(row.item.discount_percent) || 0;
  return row.pricePerKg || 0;
}

const ListingsTable = ({ classified, flavorFilter, onFocusFlavor, filename, liveMark }) => {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [sortKey, setSortKey] = useState("kg");
  const [sortDir, setSortDir] = useState("asc");

  const flavors = useMemo(() => {
    const seen = [];
    classified.forEach((row) => {
      if (!seen.some((item) => item.id === row.flavorId)) {
        seen.push({ id: row.flavorId, label: row.flavorLabel });
      }
    });
    return seen;
  }, [classified]);

  const benchmark = benchmarkFromClassified(classified);

  const visible = classified
    .filter((row) => {
      if (flavorFilter === "mix") return row.flavorId === "mix";
      if (flavorFilter === "all") return row.flavorId !== "mix";
      return row.flavorId === flavorFilter;
    })
    .filter((row) => platform === "all" || platformKey(row.item.platform) === platform)
    .filter((row) => {
      const haystack = `${row.item.product_name} ${row.item.platform}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    })
    .sort((a, b) => {
      const diff = numberValue(a, sortKey) - numberValue(b, sortKey);
      return sortDir === "asc" ? diff : -diff;
    });

  const bestRows = new Set();
  const cheapestByFlavor = {};
  visible.forEach((row) => {
    if (!(row.pricePerKg > 0)) return;
    const current = cheapestByFlavor[row.flavorId];
    if (!current || row.pricePerKg < current.pricePerKg) cheapestByFlavor[row.flavorId] = row;
  });
  Object.values(cheapestByFlavor).forEach((row) => bestRows.add(row));

  const filtersOn = Boolean(query.trim()) || platform !== "all" || flavorFilter !== "all";
  const resetFilters = () => {
    setQuery("");
    setPlatform("all");
    onFocusFlavor("all");
  };
  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "off" ? "desc" : "asc");
  };

  return (
    <div className="sp-stack">
      <header className="sp-page-head">
        <div>
          <p className="sp-kicker">Evidence</p>
          <div className="sp-title-line">
            <h2>Shelf listings</h2>
            {liveMark}
          </div>
        </div>
        <p className="sp-lead">
          Every number on the overview comes from these rows. Filter a flavor, then export the set you want to send on.
        </p>
      </header>

      <div className="sp-filters">
        <label>
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Brand or product"
          />
        </label>
        <label>
          Flavor
          <select value={flavorFilter} onChange={(event) => onFocusFlavor(event.target.value)}>
            <option value="all">All flavors</option>
            {flavors.filter((flavor) => flavor.id !== "mix").map((flavor) => (
              <option key={flavor.id} value={flavor.id}>{flavor.label}</option>
            ))}
            <option value="mix">Mixes and gift packs</option>
          </select>
        </label>
        <label>
          Platform
          <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="all">All platforms</option>
            <option value="Blinkit">Blinkit</option>
            <option value="Zepto">Zepto</option>
            <option value="Instamart">Instamart</option>
          </select>
        </label>
        <button
          type="button"
          className="sp-btn sp-btn-ghost"
          onClick={() => downloadListings(visible, filename)}
          disabled={!visible.length}
        >
          Export {visible.length} {visible.length === 1 ? "row" : "rows"}
        </button>
      </div>

      <div className="sp-count-row">
        <p className="sp-count">{visible.length} of {classified.length} listings</p>
        {filtersOn && (
          <button type="button" className="sp-reset" onClick={resetFilters}>Reset filters</button>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="sp-empty">Nothing in this filter.</p>
      ) : (
        <div className="sp-table-wrap">
          <table className="sp-table sp-listings">
            <thead>
              <tr>
                <th className="sp-thumb-col" aria-label="Photo" />
                <th>Platform</th>
                <th>Flavor</th>
                <th>Product</th>
                <th>Pack size</th>
                {NUMBER_COLUMNS.map((column) => (
                  <th key={column.key} className="num">
                    <button type="button" className="sp-sort" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      {sortKey === column.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={`${row.item.product_name}-${index}`}>
                  <td>
                    <img
                      src={row.item.image_url || "/images/zeptologo.png"}
                      alt=""
                    />
                  </td>
                  <td><span className={`sp-plat-tag plat-${platformKey(row.item.platform).toLowerCase()}`}>{platformKey(row.item.platform)}</span></td>
                  <td><span className={`sp-pill tone-${priceTone(row.pricePerKg, benchmark?.median, row.flavorId, benchmark?.id)}`}>{row.flavorLabel}</span></td>
                  <td>
                    {row.displayName || row.item.product_name}
                    {row.varieties.length > 0 && <span className="sp-variety">{row.varieties.join(" · ")}</span>}
                  </td>
                  <td>{row.item.packaging_size}</td>
                  <td className="num">{formatRupee(row.item.discounted_price, 0)}</td>
                  <td className="num">{formatRupee(row.item.original_price, 0)}</td>
                  <td className="num">{formatPercent(row.item.discount_percent)}</td>
                  <td className={`num tone-${priceTone(row.pricePerKg, benchmark?.median, row.flavorId, benchmark?.id)}`}>
                    {row.pricePerKg ? formatRupee(row.pricePerKg) : "—"}
                    {bestRows.has(row) && <span className="sp-best">Best value</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ListingsTable;
