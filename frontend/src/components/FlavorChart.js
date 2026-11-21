import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from "chart.js";
import { formatRupee } from "../classifyListing";
import { benchmarkGroup, priceTone } from "../marketMath";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const FlavorChart = ({ groups, onSelect }) => {
  const priced = groups.filter((group) => group.median);
  if (!priced.length) return <p className="sp-muted">No comparable prices in this run.</p>;

  const benchmark = benchmarkGroup(groups);
  const toneColor = { base: "#2563eb", high: "#d97706", low: "#059669", near: "#64748b", empty: "#cbd5e1" };
  const data = {
    labels: priced.map((group) => group.label),
    datasets: [
      {
        data: priced.map((group) => Math.round(group.median)),
        backgroundColor: priced.map((group) => toneColor[priceTone(group.median, benchmark?.median, group.id, benchmark?.id)]),
        borderRadius: 6,
        barThickness: 22,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    onClick: (_event, elements) => {
      if (elements.length && onSelect) onSelect(priced[elements[0].index].id);
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => {
            const group = priced[context.dataIndex];
            return ` ${formatRupee(group.median)}/kg · ${group.count} listings`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: "#eef1f6" },
        ticks: {
          color: "#5c6b70",
          callback: (value) => formatRupee(value),
        },
      },
      y: {
        grid: { display: false },
        ticks: { color: "#172329", font: { size: 13 } },
      },
    },
  };

  return (
    <div className="sp-chart">
      <Bar data={data} options={options} />
    </div>
  );
};

export default FlavorChart;
