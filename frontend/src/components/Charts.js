import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import axios from "axios";

const Charts = ({ productId }) => {
  const [charts, setCharts] = useState({});

  useEffect(() => {
    if (productId) {
      const endpoints = [
        { key: "original_price", url: `/api/charts/original_price/${productId}` },
        { key: "discounted_price", url: `/api/charts/discounted_price/${productId}` },
        { key: "discount_percent", url: `/api/charts/discount_percent/${productId}` },
        { key: "price_per_kg", url: `/api/charts/price_per_kg/${productId}` }
      ];

      endpoints.forEach(({ key, url }) => {
        axios.get(url).then(response => {
          setCharts(prevCharts => ({
            ...prevCharts,
            [key]: "data:image/png;base64," + response.data.chart
          }));
        });
      });
    }
  }, [productId]);

  return (
    <div className="mt-4">
      {Object.entries(charts).map(([key, src]) => (
        <div key={key} className="mb-4">
          <h3 className="text-lg font-bold">{key.replace("_", " ").toUpperCase()}</h3>
          <img src={src} alt={key} className="w-full" />
        </div>
      ))}
    </div>
  );
};

export default Charts;
