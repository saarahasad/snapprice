import React, { useEffect, useState } from "react";
import axios from "axios";
import { FAMILIES } from "../classifyListing";

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
    setNote("Stay on this page. Blinkit, Zepto, and Instamart are being read now. The prices will show up here in about a minute. You do not need to open another window.");
    try {
      const response = await axios.post("http://127.0.0.1:5001/scrape", {
        pincode: pin,
        product,
        synonyms: family.synonyms,
        category: family.category,
      });
      const rows = Array.isArray(response.data) ? response.data : [];
      if (!rows.length || !rows[0].product_id) {
        setError("Nothing came back. Search the base word — almonds, cashews, or makhana — so flavored and plain packs are both included.");
        setNote("");
        return;
      }
      setNote("");
      onScraped(rows[0].product_id, pin);
    } catch (err) {
      console.error(err);
      setError("The scrape did not finish. Check that the API on port 5001 is running, then try again.");
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
          <h2>Find the nut, then split it by flavor</h2>
        </div>
        <p className="desk-lead">
          Salt & pepper cashew is a different price from plain cashew. Peri peri makhana is a different price from plain makhana. Search the nut once, then read each flavor on its own.
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
          Only the word in this box is searched. The stores return every pack that uses it, plain and flavored. After the run, Flavors separates those prices. Nothing else on this form is sent.
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
        {error && <p className="scrape-error">{error}</p>}
      </div>
    </section>
  );
};

export default MarketSearch;
