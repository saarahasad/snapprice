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

// Register Chart.js components & plugins
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

const PricePerUnitChart = ({ productData }) => {
  if (!productData || productData.length === 0) return <p>No data available</p>;

  // **Platform-based Colors**
  const platformColors = {
    Swiggy: "#d36300", // Darker Orange
    Blinkit: "#c2ab29", // Darker Yellow
    Zepto: "#3B006F", // Darker Purple
  };

  // **Sorting Data from Low to High**
  const sortedData = productData
    .map((item) => ({
      name: item.product_name,
      pricePerUnit: item.price_per_kg,
      platform: item.platform,
    }))
    .sort((a, b) => a.pricePerUnit - b.pricePerUnit); // **Sorts by price per unit (low to high)**

  // Extract sorted values
  const sortedProductNames = sortedData.map((item) => item.name);
  const sortedPrices = sortedData.map((item) => item.pricePerUnit);
  const sortedPlatforms = sortedData.map((item) => item.platform);

  return (
    <div
      className="chart"
      style={{
        height: `${Math.max(300, sortedData.length * 50)}px`,
      }}
    >
      <br />
      <h2>Price Per Unit Analysis</h2>
      <div className="chart-description">
        <p style={{ lineHeight: "1.5" }}>
          <strong>Each bar represents a product</strong> with its{" "}
          <strong>price per kg (₹/kg)</strong>, sorted from lowest to highest,
          with different colors indicating platforms: <strong>Swiggy</strong>{" "}
          (Dark Orange), <strong>Blinkit</strong> (Dark Yellow), and{" "}
          <strong>Zepto</strong> (Dark Purple), and the price displayed directly
          on each bar to help identify the most cost-effective option.
        </p>
      </div>

      <Bar
        data={{
          labels: sortedProductNames, // **Sorted labels**
          datasets: [
            {
              label: "Price Per Unit (₹/kg)",
              data: sortedPrices, // **Sorted prices**
              backgroundColor: function (context) {
                let index = context.index;
                let platform = sortedPlatforms[index];
                return platformColors[platform] || "black"; // Correctly assign colors
              },
            },
          ],
        }}
        options={{
          responsive: true,
          indexAxis: "y", // Converts to horizontal bar chart
          maintainAspectRatio: false, // Allows the chart to expand properly
          plugins: {
            legend: { display: false }, // Hide legend for cleaner look
            datalabels: {
              anchor: "center", // Position labels inside bars
              align: "right", // Align text inside bars
              color: "white", // **Ensures label text is WHITE**
              font: { weight: "bold", size: 12 }, // Bold & readable
              formatter: (value) => `₹${value.toFixed(2)}/kg`, // Format label text
            },
          },
          scales: {
            x: {
              title: { display: true, text: "Price Per Unit (₹/kg)" },
              ticks: { font: { size: 12 } },
            },
            y: {
              ticks: {
                font: { size: 11, weight: "bold" },
                color: function (context) {
                  let index = context.index;
                  let platform = sortedPlatforms[index];
                  return platformColors[platform] || "black"; // Correctly assign colors
                },
                callback: function (value, index) {
                  let label = sortedProductNames[index] || "";
                  return label.length > 40 ? label.match(/.{1,40}/g) : label; // Wrap long labels
                },
              },
            },
          },
        }}
      />
    </div>
  );
};

export default PricePerUnitChart;
