import React from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels"; // Importing the plugin

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels // Register the plugin
);

const PackagingSizeChart = ({ productData }) => {
  if (!productData || productData.length === 0)
    return <p>No data available.</p>;

  // Convert packaging size to numeric values (handles "500g", "1kg", etc.)
  const parsePackagingSize = (size) => {
    if (!size) return null;
    let value = parseFloat(size);
    return size.includes("kg") ? value : value / 1000; // Convert grams to kg
  };

  // Format packaging size for display
  const formatPackagingSize = (size) => {
    if (size < 1) {
      return `${(size * 1000).toFixed(0)}g`; // Convert to grams for sizes less than 1kg
    }
    return `${size}kg`; // Otherwise, keep it in kg
  };

  // Group prices and products by packaging size
  const sizeToPrices = {};
  const sizeToProducts = {}; // Store product names for each packaging size
  productData.forEach((item) => {
    let size = parsePackagingSize(item.packaging_size);
    if (size) {
      if (!sizeToPrices[size]) sizeToPrices[size] = [];
      sizeToPrices[size].push(item.price_per_kg);

      if (!sizeToProducts[size]) sizeToProducts[size] = [];
      sizeToProducts[size].push(item.product_name); // Store product names
    }
  });

  // Calculate average price per kg for each packaging size & remove invalid ones
  const packagingSizes = Object.keys(sizeToPrices)
    .filter((size) => sizeToPrices[size].some((price) => price > 0)) // Remove sizes where all prices are 0
    .sort((a, b) => a - b);

  const avgPrices = packagingSizes.map(
    (size) =>
      sizeToPrices[size].reduce((sum, price) => sum + price, 0) /
      sizeToPrices[size].length
  );

  // Find the most cost-effective packaging size
  const optimalPackageSize =
    packagingSizes[avgPrices.indexOf(Math.min(...avgPrices))];

  // Count occurrences for the Pie Chart
  const sizeDistribution = {};
  productData.forEach((item) => {
    let size = parsePackagingSize(item.packaging_size);
    if (size && item.price_per_kg > 0) sizeDistribution[size] = (sizeDistribution[size] || 0) + 1;
  });

  // Prepare data for Pie Chart
  const totalProducts = Object.values(sizeDistribution).reduce(
    (acc, val) => acc + val,
    0
  );

  // Define common colors
  const chartColors = [
    "#ff6384",
    "#36a2eb",
    "#ffcd56",
    "#4bc0c0",
    "#9966ff",
    "#ff9f40",
  ];

  const pieData = {
    labels: Object.keys(sizeDistribution).map((size) =>
      formatPackagingSize(size)
    ),
    datasets: [
      {
        data: Object.values(sizeDistribution).map((val) =>
          ((val / totalProducts) * 100).toFixed(2)
        ), // Convert to percentage
        backgroundColor: chartColors,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      tooltip: {
        callbacks: {
          label: (tooltipItem) => {
            const size = Object.keys(sizeDistribution)[tooltipItem.dataIndex];
            const products = sizeToProducts[size] || [];

            if (products.length === 0) {
              return `No Data`;
            }

            // Return product names in a list format using HTML for line breaks
            return [`Products:`, ...products.map((product) => `• ${product}`)];
          },
        },
      },
      datalabels: {
        color: "white", // Set text color to white
        font: {
          size: 16, // Increase the font size
          weight: "bold",
        },
        formatter: (value, context) => {
          const size = context.chart.data.labels[context.dataIndex]; // Get the size label
          return `${size} \n${value}%`; // Display size and percentage
        },
        align: "center",
        anchor: "center",
      },
    },
  };

  // Prepare data for Bar Chart
  const barData = {
    labels: packagingSizes.map((size) => formatPackagingSize(size)),
    datasets: [
      {
        label: "Avg. Price Per Unit (₹/kg)",
        data: avgPrices,
        backgroundColor: chartColors, // Use the same colors as Pie Chart
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: { display: true, text: "Packaging Size (kg)" },
      },
      y: {
        title: { display: true, text: "Avg. Price Per Unit (₹/kg)" },
        ticks: {
          beginAtZero: true,
          callback: (value) => value.toFixed(2), // ✅ Rounds numbers on Y-axis to 2 decimal places
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `₹${context.raw.toFixed(2)}/kg`, // ✅ Rounds tooltip values to 2 decimal places
        },
      },
      datalabels: {
        anchor: "end",
        align: "top",
        formatter: (value) => `₹${value.toFixed(2)}/kg`, // ✅ Rounds numbers displayed on bars to 2 decimal places
        color: "#000",
        font: {
          weight: "bold",
          size: 12,
        },
      },
    },
  };

  return (
    <div className="chart-container">
      <h2>Packaging Size vs. Price Per Unit</h2>
      <p className="chart-description">
        This <strong>bar chart</strong> shows how{" "}
        <strong>packaging size impacts price per unit</strong>. The{" "}
        <strong>optimal packaging size</strong> offering the lowest price per kg
        is <strong>{optimalPackageSize}kg</strong>.
      </p>
      <div className="charts-wrapper">
        <div
          className="chart chart-fixed"
          style={{
            height: "600px",
          }}
        >
          <h3>Price Per Unit by Packaging Size</h3>
          <Bar data={barData} options={barOptions} />
        </div>
        <br /> <br /> <br /> <br />

        <div className="chart chart-fixed" style={{ height: "600px" }}>
          <h3>Packaging Size Distribution</h3>
          <Pie data={pieData} options={pieOptions} />
        </div>
      </div>
      <br /> <br /> <br /> <br />
      {/* Table displaying Packaging Sizes and Brands */}
      <div className="table-container">
        <h3>Packaging Size and Brands</h3>
        <table className="package-size-table">
          <thead>
            <tr style={{ border: "2px solid #ddd" }}>
              {packagingSizes.map((size) => (
                <th key={size}>{formatPackagingSize(size)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ border: "2px solid #ddd" }}>
              {packagingSizes.map((size) => (
                <td
                  key={size}
                  style={{
                    border: "2px solid #ddd",
                    padding: "10px",
                  }}
                >
                  {sizeToProducts[size].map((product, index) => (
                    <div style={{ padding: "10px" }} key={index}>
                      {product}
                    </div>
                  ))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <br /> <br />
    </div>
  );
};



export default PackagingSizeChart;
