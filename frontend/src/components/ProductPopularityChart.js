import React, { useEffect, useState } from "react";
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

const ProductPopularityChart = ({ productId, productType ,productCategory}) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Construct the full API URL
    const apiUrl = `http://127.0.0.1:5000/product-popularity-data/${productId}/${productType}`;

    // Fetch the data from the API based on the productId and productType
    fetch(apiUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json(); // Parse the JSON response
      })
      .then((data) => {
        setChartData(data);
        setLoading(false);
      })
      .catch((error) => {
        setError(error.message);
        setLoading(false);
      });
  }, [productId, productType]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error}</p>;
  }

  if (!chartData) {
    return <p>No data available.</p>;
  }

  // Extract the selected product and other products from the response
  const { selected_product, other_products_in_category } = chartData;

  // Prepare data for the Pie Chart
  const totalProducts = other_products_in_category.reduce(
    (acc, product) =>
      acc + product.swiggy_count + product.blinkit_count + product.zepto_count,
    0
  );

  const pieData = {
    labels: [
      selected_product.product_name,
      ...other_products_in_category.map((p) => p.product_name),
    ],
    datasets: [
      {
        data: [
          selected_product.swiggy_count +
            selected_product.blinkit_count +
            selected_product.zepto_count,
          ...other_products_in_category.map(
            (p) => p.swiggy_count + p.blinkit_count + p.zepto_count
          ),
        ],
        backgroundColor: [
          "#ff6384",
          "#36a2eb",
          "#ffcd56",
          "#4bc0c0",
          "#9966ff",
          "#ff9f40",
        ],
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false, // Ensure it maintains aspect ratio
    plugins: {
      tooltip: {
        callbacks: {
          label: (tooltipItem) => {
            const product = tooltipItem.label;
            const productDetails =
              product === selected_product.product_name
                ? [
                    `Swiggy: ${selected_product.swiggy_count}`,
                    `Blinkit: ${selected_product.blinkit_count}`,
                    `Zepto: ${selected_product.zepto_count}`,
                  ]
                : [
                    `Swiggy: ${
                      other_products_in_category.find(
                        (p) => p.product_name === product
                      ).swiggy_count
                    }`,
                    `Blinkit: ${
                      other_products_in_category.find(
                        (p) => p.product_name === product
                      ).blinkit_count
                    }`,
                    `Zepto: ${
                      other_products_in_category.find(
                        (p) => p.product_name === product
                      ).zepto_count
                    }`,
                  ];
            return [product, ...productDetails];
          },
        },
      },
      datalabels: {
        color: "black",
        font: {
          size: 13,
          weight: "500",
          innerWidth:"20px",
        },
        formatter: (value, context) => {
          const product = context.chart.data.labels[context.dataIndex];
          return `${value}% \n${product} `;
        },
        align: "center",
        anchor: "center",
        overflow: 'ellipsis', // Truncates the label if it overflows
        clip: true, // Prevents labels from spilling outside the chart
        padding: 5, // Adds space between the chart and labels to prevent overlap
      },
    },
    elements: {
      arc: {
        borderWidth: 2, // Optional: to add border width to the slices if needed
      },
    },
    layout: {
      padding: {
        top: 20, // Adjust this padding to move chart elements if needed
        left: 20,
        right: 20,
        bottom: 20,
      },
    },
  };

  // Prepare data for the Bar Chart
  const barData = {
    labels: [
      selected_product.product_name,
      ...other_products_in_category.map((p) => p.product_name),
    ],
    datasets: [
      {
        label: "Number of Items",
        data: [
          selected_product.swiggy_count +
            selected_product.blinkit_count +
            selected_product.zepto_count,
          ...other_products_in_category.map(
            (p) => p.swiggy_count + p.blinkit_count + p.zepto_count
          ),
        ],
        backgroundColor: [
          "#ff6384",
          "#36a2eb",
          "#ffcd56",
          "#4bc0c0",
          "#9966ff",
          "#ff9f40",
        ],
      },
    ],
  };

  const barOptions = {
    responsive: true,
    scales: {
      x: {
        title: {
          display: true,
          text: "Products",
        },
      },
      y: {
        title: {
          display: true,
          text: "Number of Items",
        },
        ticks: {
          beginAtZero: true,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => `${context.raw} items`,
        },
      },
      datalabels: {
        color: "#000",
        font: {
          weight: "bold",
          size: 12,
        },
        formatter: (value) => `${value} items`,
      },
    },
  };

  return (
    <div className="chart-container">
      <h2>Product Popularity Chart</h2>
      <p className="chart-description">
        This <strong>bar chart</strong> and <strong>pie chart</strong> compare
        the number of items available for the selected product and other
        products in the <strong style={{backgroundColor:"maroon", padding:"10px", borderRadius:"10px", color:"white", textAlign:"center"}}>{selected_product.product_category}</strong> category.
      </p>
      <div className="charts-wrapper">
        <div
          className="chart chart-fixed"
          style={{
            height: "600px",
          }}
        >
          <h3>Product Popularity by Number of Items</h3>
          <Bar data={barData} options={barOptions} />
        </div>
        <div className="chart chart-fixed" style={{ height: "800px" }}>
          <h3>Product Popularity Distribution</h3>
          <Pie data={pieData} options={pieOptions} />
        </div>
      </div>
    </div>
  );
};

export default ProductPopularityChart;
