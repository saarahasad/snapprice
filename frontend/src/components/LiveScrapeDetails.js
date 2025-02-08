import React, { useState, useEffect } from "react";
import PricePerUnitChart from "./PricePerUnitChart";
import DiscountAnalysisChart from "./DiscountAnalysisChart";
import PriceComparisonChart from "./PriceComparisonChart";
import PackagingSizeChart from "./PackagingSizeChart";

const LiveScrapeDetails = ({ scrapedData }) => {
  const [activeTab, setActiveTab] = useState("table"); // Main tab (table/charts)
  const [activeChartTab, setActiveChartTab] = useState("priceComparison"); // Default chart tab
  const [productData, setProductData] = useState(scrapedData);

  // Use useEffect to update when scrapedData changes
  useEffect(() => {
    if (scrapedData) {
      setProductData(scrapedData); // Update productData when scrapedData changes
    }
  }, [scrapedData]); // Depend on scrapedData so it runs when scrapedData changes

  if (!productData || productData.length === 0) {
    return <p>No live-scraped data available.</p>;
  }

  console.log("scrapedData", productData); // Debug the data

  // Extract general product details from the first entry
  const generalProduct = productData[0]; // Assuming all entries are of the same product
  const scrapedAt = generalProduct?.scraped_at || "N/A";
  const productName = generalProduct?.product || "Unknown Product";
  const pincode = generalProduct?.pincode || "Unknown Pincode";

  // Chart Tabs
  const chartTabs = [
    {
      id: "priceComparison",
      label: "Price Comparison",
      component: <PriceComparisonChart productData={productData} />,
    },
    {
      id: "pricePerUnit",
      label: "Price Per Unit",
      component: <PricePerUnitChart productData={productData} />,
    },
    {
      id: "discountAnalysis",
      label: "Discount Analysis",
      component: <DiscountAnalysisChart productData={productData} />,
    },
    {
      id: "packagingSize",
      label: "Packaging Size",
      component: <PackagingSizeChart productData={productData} />,
    }, // ✅ New Chart Tab
  ];

  return (
    <div className="details-container">
      <div className="product-header">
        <div className="info-container">
          <div className="info-row">
            <div className="header-cell">Product:</div>
            <div className="data-cell" style={{ backgroundColor: "#f1ebeb" }}>
              <h3>{productName}</h3>
            </div>
          </div>
          <div className="info-row">
            <div className="header-cell">Pincode:</div>
            <div className="data-cell">{pincode}</div>
          </div>
          <div className="info-row">
            <div className="header-cell">Last Updated:</div>
            <div className="data-cell">
              {new Date(scrapedAt).toLocaleString("en-GB", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Tabs (Table / Charts) */}
      <div className="tabs">
        <button
          className={activeTab === "table" ? "active" : ""}
          onClick={() => setActiveTab("table")}
        >
          Scraped Product Listings
        </button>
        <button
          className={activeTab === "charts" ? "active" : ""}
          onClick={() => setActiveTab("charts")}
        >
          Market Insights
        </button>
      </div>

      {/* Table View */}
      {activeTab === "table" ? (
        <table>
          <thead>
            <tr>
              <th>Platform</th>
              <th>Image</th>
              <th>Name</th>
              <th>Original Price</th>
              <th>Discounted Price</th>
              <th>Discount %</th>
              <th>Packaging Size</th>
              <th>Unit</th>
              <th>Price Per Unit</th>
            </tr>
          </thead>
          <tbody>
            {productData.map((item, index) => (
              <tr key={index}>
                <td>
                  {(item.platform === "Swiggy Instamart") |
                  (item.platform === "Swiggy") ? (
                    <img
                      src="/images/instamartlogo.jpg"
                      alt="Swiggy"
                      width="80"
                      height="50"
                    />
                  ) : item.platform === "Blinkit" ? (
                    <img
                      src="/images/blinkitlogo.png"
                      alt="Blinkit"
                      width="60"
                      height="50"
                    />
                  ) : item.platform === "Zepto" ? (
                    <img
                      src="/images/zeptologo.png"
                      alt="Zepto"
                      width="60"
                      height="20"
                    />
                  ) : (
                    item.platform
                  )}
                </td>
                <td style={{ textAlign: "center" }}>
                  <img
                    src={
                      item.image_url ||
                      "https://t3.ftcdn.net/jpg/04/34/72/82/240_F_434728286_OWQQvAFoXZLdGHlObozsolNeuSxhpr84.jpg"
                    }
                    alt={item.product_name}
                    style={{
                      width: "100px",
                      height: "100px",
                      objectFit: "cover",
                      borderRadius: "5px",
                    }}
                  />
                </td>
                <td>{item.product_name}</td>
                <td>₹{item.original_price}</td>
                <td>₹{item.discounted_price}</td>
                <td>{item.discount_percent}%</td>
                <td>{item.packaging_size}</td>
                <td>{item.unit}</td>
                <td>₹{item.price_per_kg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // Charts View
        <div className="charts-container">
          {/* Nested Chart Tabs */}
          <div className="chart-tabs">
            {chartTabs.map((chart) => (
              <button
                key={chart.id}
                className={activeChartTab === chart.id ? "active" : ""}
                onClick={() => setActiveChartTab(chart.id)}
              >
                {chart.label}
              </button>
            ))}
          </div>

          {/* Render Active Chart */}
          <div className="chart-content">
            {chartTabs.find((chart) => chart.id === activeChartTab)?.component}
          </div>
        </div>
      )}
      <br />
      <br />
      <br />
    </div>
  );
};

export default LiveScrapeDetails;
