import React from "react";
import { Bar } from "react-chartjs-2";
import ChartDataLabels from "chartjs-plugin-datalabels";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register required components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

const DiscountAnalysisChart = ({ productData }) => {
  if (!productData || productData.length === 0) return <p>No data available</p>;

  // **Fix Discount Calculation (Ensuring it doesn't exceed 100%)**
  productData = productData.map((item) => ({
    ...item,
    discount_percent: Math.min(
      100,
      ((item.original_price - item.discounted_price) / item.original_price) *
        100
    ),
  }));

  // **Define Platform Colors**
  const platformColors = {
    Swiggy: "#d36300", // Darker Orange
    Blinkit: "#c2ab29", // Darker Yellow
    Zepto: "#3B006F", // Darker Purple
  };

  // **Step 1: Calculate Platform-Wide Average Discounts**
  const platformAverages = { Swiggy: 0, Blinkit: 0, Zepto: 0 };
  const platformCounts = { Swiggy: 0, Blinkit: 0, Zepto: 0 };

  productData.forEach(({ platform, discount_percent }) => {
    // Ensure platform is valid
    if (platform && platformAverages[platform] !== undefined) {
      platformAverages[platform] += discount_percent;
      platformCounts[platform] += 1;
    }
  });

  Object.keys(platformAverages).forEach((platform) => {
    platformAverages[platform] =
      platformCounts[platform] > 0
        ? platformAverages[platform] / platformCounts[platform]
        : 0;
  });

  // **Step 2: Identify Products Above-Average Discount Per Platform**
  const aboveAverageDiscounts = productData.filter(
    ({ platform, discount_percent }) =>
      platform && discount_percent > platformAverages[platform]
  );

  // **Step 3: Find the Brand with Highest & Lowest Discount Per Platform**
  const platformBrands = { Swiggy: [], Blinkit: [], Zepto: [] };

  productData.forEach(({ platform, product_name, discount_percent }) => {
    if (platform && platformBrands[platform]) {
      platformBrands[platform].push({ product_name, discount_percent });
    }
  });

  const brandDiscounts = {};
  Object.keys(platformBrands).forEach((platform) => {
    if (platformBrands[platform].length > 0) {
      brandDiscounts[platform] = {
        highest: platformBrands[platform].reduce((max, item) =>
          item.discount_percent > max.discount_percent ? item : max
        ),
        lowest: platformBrands[platform].reduce((min, item) =>
          item.discount_percent < min.discount_percent ? item : min
        ),
      };
    }
  });

  return (
    <>
      {/* 📊 Average Discount Percentage Per Platform */}
      <div
        className="chart"
        style={{
          height: "200px",
        }}
      >
        <h2>Average Discount Percentage by Platform</h2>
        <div className="chart-description">
          <p>
            {" "}
            Each bar represents the average discount percentage helping identify
            which platform offers higher discounts.
          </p>
        </div>

        <Bar
          data={{
            labels: ["Swiggy", "Blinkit", "Zepto"],
            datasets: [
              {
                label: "Average Discount (%)",
                data: [
                  parseFloat(platformAverages.Swiggy.toFixed(2)), // ✅ Rounded to 2 decimal places
                  parseFloat(platformAverages.Blinkit.toFixed(2)), // ✅ Rounded to 2 decimal places
                  parseFloat(platformAverages.Zepto.toFixed(2)), // ✅ Rounded to 2 decimal places
                ],
                backgroundColor: [
                  platformColors.Swiggy,
                  platformColors.Blinkit,
                  platformColors.Zepto,
                ],
              },
            ],
          }}
          options={{
            responsive: true,
            indexAxis: "y", // ✅ Converts to horizontal bar chart
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false }, // Hide legend for cleaner look
              datalabels: {
                anchor: "center", // Position labels inside bars
                align: "right", // Align text inside bars
                color: "white", // **Ensures label text is WHITE**
                font: { weight: "bold", size: 12 }, // Bold & readable
                formatter: (value) => `${value.toFixed(2)}%`, // Format label text
              },
              tooltip: {
                callbacks: {
                  label: function (tooltipItem) {
                    const value = Array.isArray(tooltipItem.raw)
                      ? tooltipItem.raw[0]
                      : tooltipItem.raw; // ✅ Ensure it's a number
                    return `${tooltipItem.dataset.label}: ${parseFloat(
                      value
                    ).toFixed(2)}%`; // ✅ Format to 2 decimals
                  },
                },
              },
            },
            scales: {
              x: {
                title: {
                  display: true,
                  text: "Average Discount (%)",
                  color: "white",
                }, // ✅ X-Axis title in white
                ticks: { beginAtZero: true },
              },
              y: {
                ticks: { font: { size: 14, weight: "bold" } },
              },
            },
          }}
        />
      </div>
      {/* 📊 Above-Average Discounts Chart */}
      <div
        className="chart"
        style={{
          marginTop: "200px",
          height: `${Math.max(300, aboveAverageDiscounts.length * 60)}px`,
        }}
      >
        {" "}
        <h2>Above-Average Discounts by Platform</h2>
        <div className="chart-description">
          <p>
            {" "}
            Shows products with <strong>
              higher-than-average discounts
            </strong>{" "}
            on Swiggy, Blinkit, and Zepto.
          </p>
        </div>
        <Bar
          data={{
            labels: aboveAverageDiscounts.map((p) => p.product_name),
            datasets: [
              {
                label: "Above-Average Discount (%)",
                data: aboveAverageDiscounts.map((p) => p.discount_percent),
                backgroundColor: aboveAverageDiscounts.map(
                  (p) => platformColors[p.platform] || "gray"
                ),
              },
            ],
          }}
          options={{
            responsive: true,
            indexAxis: "y",
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              datalabels: {
                anchor: "center", // Position labels inside bars
                align: "right", // Align text inside bars
                color: "white", // **Ensures label text is WHITE**
                font: { weight: "bold", size: 12 }, // Bold & readable
                formatter: (value) => `₹${value.toFixed(2)}/kg`, // Format label text
              },
              tooltip: {
                callbacks: {
                  label: function (tooltipItem) {
                    return `${
                      tooltipItem.dataset.label
                    }: ${tooltipItem.raw.toFixed(2)}%`;
                  },
                },
              },
            },
            scales: {
              x: {
                title: { display: true, text: "Discount Percentage" },
                ticks: { beginAtZero: true },
              },
              y: {
                ticks: {
                  font: { size: 13, weight: "bold" },
                  color: aboveAverageDiscounts.map(
                    (p) => platformColors[p.platform] || "gray"
                  ),
                },
              },
            },
          }}
        />
      </div>
      <br /> <br /> <br /> <br /> <br /> <br /> <br /> <br /> <br />
      {/* 📊 Best & Worst Discounted Brands by Platform */}
      <h3>Best & Worst Discounts by Platform</h3>
      {Object.keys(brandDiscounts).map((platform) => (
        <div key={platform} className="brand-discount-box">
          <h4>{platform}</h4>
          <p>
            🔥 <strong>Highest Discount:</strong>{" "}
            {brandDiscounts[platform].highest.product_name} (
            {brandDiscounts[platform].highest.discount_percent.toFixed(2)}%)
          </p>
          <p>
            ❄️ <strong>Lowest Discount:</strong>{" "}
            {brandDiscounts[platform].lowest.product_name} (
            {brandDiscounts[platform].lowest.discount_percent.toFixed(2)}%)
          </p>
        </div>
      ))}
      <br /> <br />
    </>
  );
};

export default DiscountAnalysisChart;
