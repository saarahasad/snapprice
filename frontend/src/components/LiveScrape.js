import React, { useState } from "react";
import axios from "axios";

const LiveScrape = ({
  onSelectProduct,
  onSelectPincode,
  onSelectProductType,
}) => {
  const [pincode, setPincode] = useState("");
  const [productName, setProductName] = useState("");
  const [synonyms, setSynonyms] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ScrapedData, setScrapedData] = useState(null);
  const [category, setCategory] = useState("Other");

  const categories = [
    "Dried Fruits",
    "Rice",
    "Pulses",
    "Nuts & Seeds",
    "Spices & Condiments",
    "Oils & Ghee",
    "Flours & Grains",
    "Sugars & Sweeteners",
    "Dairy Products",
    "Beverages",
    "Snacks & Namkeens",
    "Pickles & Chutneys",
    "Instant Foods",
    "Bakery & Breads",
    "Vegetables",
    "Fruits",
    "Meat & Seafood",
    "Frozen Foods",
    "Cereals & Breakfast Items",
    "Organic & Health Foods",
    "Other",
  ];

  const handleScrape = async () => {
    setLoading(true);
    try {
      const synonymsArray = synonyms.split(",").map((item) => item.trim());
      const synonyms_dict = { synonyms: synonymsArray };
      const response = await axios.post("http://127.0.0.1:5000/scrape", {
        pincode,
        product: productName,
        synonyms: synonyms_dict,
        category: category,
      });
      setScrapedData(response.data);
      onSelectProduct(response.data[0].product_id); // Passing the selected product to the parent
      onSelectPincode(pincode); // Passing the selected pincode to the parent
      onSelectProductType(2);
    } catch (error) {
      console.error("Error:", error);
      setError("An error occurred while scraping.");
    }
    setLoading(false);
  };

  return (
    <div className="live-scrape-container">
      <h3 className="sidebar-title">Scrape Live Data</h3>
      <br />

      <input
        type="text"
        placeholder="Enter Product Name (e.g., cashews)"
        value={productName}
        onChange={(e) => setProductName(e.target.value)}
      />

      <input
        type="text"
        placeholder="Enter Pincode (e.g., 560001)"
        value={pincode}
        onChange={(e) => setPincode(e.target.value)}
      />
      <input
        type="text"
        placeholder="Enter Synonyms (comma-separated)"
        value={synonyms}
        onChange={(e) => setSynonyms(e.target.value)}
      />

      <div className="select-container">
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">-- Choose a Category --</option>
          {categories.map((cat, index) => (
            <option key={index} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <button onClick={handleScrape} disabled={loading}>
        {loading ? "Scraping..." : "Scrape Data"}
      </button>

      {error && <p>{error}</p>}

      {loading && <div className="spinner" style={{ display: "block" }} />}
    </div>
  );
};

export default LiveScrape;
