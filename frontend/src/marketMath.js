import { formatRupee } from "./classifyListing";

export const PLATFORMS = ["Blinkit", "Zepto", "Instamart"];

export function platformKey(name) {
  const value = String(name || "");
  if (/blinkit/i.test(value)) return "Blinkit";
  if (/zepto/i.test(value)) return "Zepto";
  if (/swiggy|instamart/i.test(value)) return "Instamart";
  return value || "Other";
}

export function benchmarkGroup(groups) {
  const priced = (groups || []).filter((group) => group.count > 0 && group.median);
  const plain = priced.find((group) => group.id === "plain");
  if (plain) return plain;
  return [...priced].sort((a, b) => b.count - a.count)[0] || null;
}

export function benchmarkFromClassified(rows) {
  const buckets = new Map();
  (rows || []).forEach((row) => {
    if (row.flavorId === "mix" || !(row.pricePerKg > 0)) return;
    const bucket = buckets.get(row.flavorId) || { id: row.flavorId, label: row.flavorLabel, prices: [] };
    bucket.prices.push(row.pricePerKg);
    buckets.set(row.flavorId, bucket);
  });
  return benchmarkGroup(
    [...buckets.values()].map((bucket) => {
      const sorted = [...bucket.prices].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const medianValue = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      return { id: bucket.id, label: bucket.label, count: bucket.prices.length, median: medianValue };
    })
  );
}

export function priceTone(median, benchmarkMedian, id, benchmarkId = "plain") {
  if (!median) return "empty";
  if (!benchmarkMedian || id === benchmarkId) return "base";
  const gap = (median - benchmarkMedian) / benchmarkMedian;
  if (gap >= 0.08) return "high";
  if (gap <= -0.08) return "low";
  return "near";
}

export function relativeTime(value) {
  const date = new Date(String(value || "").replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "just now";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function formatStamp(value) {
  const date = new Date(String(value || "").replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value || "";
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function median(values) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function platformMatrix(report) {
  return report.groups
    .filter((group) => group.count > 0)
    .map((group) => {
      const cells = {};
      PLATFORMS.forEach((name) => {
        const prices = group.rows
          .filter((row) => platformKey(row.item.platform) === name)
          .map((row) => row.pricePerKg);
        cells[name] = { count: prices.length, median: median(prices) };
      });
      return {
        id: group.id,
        label: group.label,
        median: group.median,
        count: group.count,
        cells,
      };
    });
}

export function buildBrief(report) {
  const notes = [];
  const plain = report.groups.find((group) => group.id === "plain");
  const salted = report.groups.find((group) => group.id === "salted");

  if (plain?.median && salted?.median) {
    const gap = (salted.median - plain.median) / plain.median;
    const pct = Math.abs(Math.round(gap * 100));
    notes.push({
      kicker: "Flavor gap",
      title: gap >= 0 ? `Salted sits ${pct}% above plain` : `Salted sits ${pct}% below plain`,
      body: `Salted median ${formatRupee(salted.median)}/kg. Plain median ${formatRupee(plain.median)}/kg. One blended average would hide that difference.`,
    });
  }

  if (plain?.premium?.length && plain.median) {
    notes.push({
      kicker: "Variety",
      title: `${plain.premium.join(" and ")} stretch the plain range`,
      body: `They are still plain, and they pull the top of the range to ${formatRupee(plain.high)}/kg. The working benchmark is the median, ${formatRupee(plain.median)}/kg.`,
    });
  }

  const pricedTogether = platformMatrix(report).find(
    (row) => row.cells.Blinkit?.median && row.cells.Zepto?.median
  );
  if (pricedTogether) {
    const blinkit = pricedTogether.cells.Blinkit.median;
    const zepto = pricedTogether.cells.Zepto.median;
    const low = Math.min(blinkit, zepto);
    const high = Math.max(blinkit, zepto);
    const pct = Math.round(((high - low) / low) * 100);
    const cheaper = blinkit <= zepto ? "Blinkit" : "Zepto";
    const dearer = cheaper === "Blinkit" ? "Zepto" : "Blinkit";
    notes.push({
      kicker: "Platform",
      title:
        pct < 3
          ? `${pricedTogether.label} is priced together on Blinkit and Zepto`
          : `${cheaper} is ${pct}% under ${dearer} on ${pricedTogether.label.toLowerCase()}`,
      body: `Median ${pricedTogether.label.toLowerCase()} price is ${formatRupee(blinkit)}/kg on Blinkit and ${formatRupee(zepto)}/kg on Zepto.`,
    });
  }

  return notes.slice(0, 3);
}

export function priceMovement(current, previous) {
  if (!current || !previous) return [];
  const preferred = ["plain", "salted", "salt-pepper", "peri-peri", "masala", "cream-onion", "pudina", "cheese"];
  const rows = current.groups
    .filter((group) => group.median && group.count)
    .map((group) => {
      const before = previous.groups.find((item) => item.id === group.id);
      if (!before?.median) return null;
      const delta = (group.median - before.median) / before.median;
      let direction = "flat";
      if (Math.abs(delta) >= 0.01) direction = delta > 0 ? "up" : "down";
      return {
        id: group.id,
        label: group.label,
        from: before.median,
        to: group.median,
        delta,
        direction,
      };
    })
    .filter(Boolean);

  rows.sort((a, b) => {
    const ai = preferred.indexOf(a.id);
    const bi = preferred.indexOf(b.id);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return rows;
}

export function downloadListings(rows, filename) {
  const headers = [
    "Flavor",
    "Platform",
    "Product",
    "Pack",
    "Shelf price",
    "MRP",
    "Discount percent",
    "Price per kg",
    "Pincode",
  ];
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const item = row.item;
    lines.push(
      [
        row.flavorLabel,
        platformKey(item.platform),
        row.displayName || item.product_name,
        item.packaging_size,
        item.discounted_price,
        item.original_price,
        item.discount_percent,
        item.price_per_kg,
        item.pincode,
      ]
        .map(escape)
        .join(",")
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
