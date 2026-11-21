import React, { useEffect, useState } from "react";
import axios from "axios";
import { FAMILIES } from "../classifyListing";

import CollectorDownload from "./CollectorDownload";

const COLLECTOR = "http://127.0.0.1:47123";
const DESK = "http://127.0.0.1:5001";

const MarketSearch = ({
  activeFamily,
  onFamily,
  onFocusFlavor,
  onScraped,
  embedded,
}) => {
  const family = FAMILIES.find((entry) => entry.id === activeFamily) || FAMILIES[0];
  const [query, setQuery] = useState(family.query);
  const [pincode, setPincode] = useState("560038");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsCollector, setNeedsCollector] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setQuery(family.query);
  }, [family.id, family.query]);

  const chooseFamily = (next) => {
    onFamily(next.id);
    setQuery(next.query);
    setError("");
    setNote("");
    onFocusFlavor("all");
  };

  const handleScrape = async () => {
    const product = query.trim();
    const pin = pincode.trim();
    if (!product || !/^\d{6}$/.test(pin)) {
      setError("Enter a product word and a 6-digit pincode.");
      return;
    }

    setLoading(true);
    setError("");
    setNeedsCollector(false);
    setNote("Stay on this page. Chrome on this computer is reading Blinkit, Zepto, and Instamart.");
    try {
      await axios.get(`${COLLECTOR}/health`, { timeout: 800 });
      const response = await axios.post(`${COLLECTOR}/scrape`, {
        pincode: pin,
        product,
        synonyms: family.synonyms,
        category: family.category,
        desk: DESK,
      }, { timeout: 300000 });
      const rows = Array.isArray(response.data) ? response.data : [];
      if (!rows.length || !rows[0].product_id) {
        setError("Nothing came back. Try the product word again.");
        setNote("");
        return;
      }
      setNote("");
      onScraped(rows[0].product_id, pin);
    } catch (err) {
      console.error(err);
      if (!err.response) {
        setNeedsCollector(true);
        setError("The collector is not running on this computer.");
      } else {
        setError(err.response?.data?.error || "The scrape did not finish.");
      }
      setNote("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="market-search">
      {!embedded && (
      <header className="desk-header">
        <div>
          <p className="desk-kicker">Current market prices</p>
          <h2>Compare a product</h2>
        </div>
        <p className="desk-lead">
          Search any product once. The desk lines up the shelf price, the pack, and the app.
        </p>
      </header>
      )}

      <div className="family-grid">
        {FAMILIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`family-card ${entry.id === family.id ? "active" : ""}`}
            onClick={() => chooseFamily(entry)}
          >
            <span className="family-name">{entry.name}</span>
            <span className="family-alias">Also listed as {entry.alsoCalled}</span>
          </button>
        ))}
      </div>

      <div className="search-panel">
        <p className="search-guidance">
          Only the word in this box is searched. The stores return the packs that use it.
        </p>

        <div className="search-fields">
          <label>
            Search word
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={family.query}
            />
          </label>
          <label>
            Pincode
            <input
              value={pincode}
              onChange={(event) => setPincode(event.target.value)}
              inputMode="numeric"
              placeholder="560038"
            />
          </label>
          <button type="button" className="scrape-btn" onClick={handleScrape} disabled={loading}>
            {loading ? "Checking prices…" : "Check current prices"}
          </button>
        </div>

        {note && <p className="scrape-status">{note}</p>}
        {needsCollector && <CollectorDownload />}
        {error && <p className="scrape-error">{error}</p>}
      </div>
    </section>
  );
};

export default MarketSearch;
