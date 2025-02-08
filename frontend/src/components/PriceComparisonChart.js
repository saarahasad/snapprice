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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

const PriceComparisonChart = ({ productData }) => {
  if (!productData || productData.length === 0) return <p>No data available</p>;

  const productNames = productData.map((item) => item.product_name);
  const originalPrices = productData.map((item) => item.original_price);
  const discountedPrices = productData.map((item) => item.discounted_price);
  const platforms = productData.map((item) => item.platform);

  // Calculate the discount (Original Price - Discounted Price)
  const discounts = originalPrices.map((original, index) => original - discountedPrices[index]);

  const priceComparisonData = {
    labels: productNames,
    datasets: [
      {
        label: "Original Price",
        data: originalPrices,
        backgroundColor: "#EA738D", // Pink for Original Price
      },
     
      {
        label: "Discounted Price",
        data: discountedPrices,
        backgroundColor: "#89ABE3", // Maroon for Discounted Price
        // Set this dataset to stack on top of the original price
        stack: "stack1",
      },
      {
        label: "Discount",
        data: discounts,
        backgroundColor: "#4CAF50", // Green for Discount
        color:"black",
        // Set this dataset to stack on top of the original price
        stack: "stack1",
      },
    ],
  };

  const platformColors = {
    Swiggy: "#cc5500", // Dark Orange
    Blinkit: "#9A8700", // Dark Yellow
    Zepto: "#4B0082", // Dark Purple
  };

  const priceComparisonOptions = {
    responsive: true,
    indexAxis: "y",
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true },
      datalabels: {
        anchor: "center",
        align: "right",
        color: "black",
        font: { weight: "bold", size: 12 },
        formatter: (value) => `₹${value.toFixed(2)}`,
      },
    },
    scales: {
      x: { title: { display: true, text: "Price (₹)" } },
      y: {},
    },
  };

  return (
    <div
      className="chart"
      style={{
        height: `${Math.max(400, productData.length * 100 + 100)}px`,
      }} // ✅ Add 100px extra for the description
    >
      <h2>Price Comparison</h2>
      <div className="chart-description">
        <p style={{lineHeight:"1.5"}}>
          <strong>Each product has three bars</strong> representing its pricing:{" "}
          <strong>Pink Bar</strong> (Original Price),{" "}
          <strong>Green Bar</strong> (Discount), and{" "}
          <strong>Blue Bar</strong> (Discounted Price) helping compare
          pricing across different platforms.
        </p>
      </div>

      <Bar
        data={priceComparisonData}
        options={{
          ...priceComparisonOptions,
          maintainAspectRatio: false, // Prevents auto-squeezing
          plugins: {
            legend: { display: true }, // Hide legend for cleaner look
            datalabels: {
              anchor: "center", // Position labels at the end of bars
              align: "right", // Align text inside bars
              color: "black", // Label color (change if needed)
              font: { weight: "bold", size: 12 }, // Font styling
              formatter: (value) => `₹${value.toFixed(2)}`, // Format label text
            },
          },
          layout: {
            padding: { left: 0, right: 0, top: 10, bottom: 10 }, // Reduce padding to fit content
          },
          scales: {
            x: {
              title: { display: true, text: "Price (₹)" },
              ticks: {
                font: { size: 14, weight: "bold" }, // Reduce x-axis font size
              },
            },
            y: {
              ticks: {
                font: { size: 11, weight: "bold" }, // Reduce label size
                color: function (context) {
                  let index = context.index;
                  let platform = platforms[index];
                  return platformColors[platform] || "black"; // Correctly assign colors
                },
                callback: function (value, index) {
                  let label = productNames[index] || "";
                  return label.length > 40
                    ? label.match(/.{1,40}/g) // Break every 15 characters
                    : label;
                },
              },
            },
          },
        }}
      />
    </div>
  );
};

export default PriceComparisonChart;
