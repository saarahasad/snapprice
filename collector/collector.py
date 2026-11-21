"""Runs on the asker's computer. Chrome opens here, then the rows are sent to Pricebench."""

import asyncio
from flask import Flask, jsonify, request
from flask_cors import CORS
from playwright.async_api import async_playwright
import requests
from site_scraper import (
    fetch_blinkit_products,
    fetch_swiggy_products,
    fetch_zepto_products,
    launch_browser,
    new_context,
    set_location_blinkit,
    set_location_swiggy,
    set_location_zepto,
)

app = Flask(__name__)
CORS(app)
DESK = "http://127.0.0.1:5001"


async def _one(browser, name, locate, fetch, product, pincode):
    context = await new_context(browser)
    page = await context.new_page()
    try:
        await locate(page, pincode)
        items = await fetch(page, product)
        return {"platform": name, "items": items}
    finally:
        await context.close()


async def collect(product, pincode):
    async with async_playwright() as playwright:
        browser = await launch_browser(playwright)
        batches = []
        try:
            for name, locate, fetch in (
                ("Blinkit", set_location_blinkit, fetch_blinkit_products),
                ("Zepto", set_location_zepto, fetch_zepto_products),
                ("Swiggy", set_location_swiggy, fetch_swiggy_products),
            ):
                try:
                    batches.append(await _one(browser, name, locate, fetch, product, pincode))
                except Exception as exc:
                    print(f"{name} did not finish: {exc}")
        finally:
            await browser.close()
        return batches


@app.get("/health")
def health():
    return jsonify({"ok": True})


@app.post("/scrape")
def scrape():
    data = request.get_json(silent=True) or {}
    product = (data.get("product") or "").strip()
    pincode = str(data.get("pincode") or "").strip()
    if not product or not pincode:
        return jsonify({"error": "Product and pincode are required."}), 400
    desk = (data.get("desk") or DESK).rstrip("/")
    try:
        batches = asyncio.run(collect(product, pincode))
    except Exception as exc:
        return jsonify({"error": f"Chrome could not collect prices. {exc}"}), 500
    try:
        saved = requests.post(
            f"{desk}/ingest",
            json={
                "product": product,
                "pincode": pincode,
                "category": data.get("category"),
                "synonyms": data.get("synonyms") or {},
                "blacklist_terms": data.get("blacklist_terms") or [],
                "batches": batches,
            },
            timeout=120,
        )
        saved.raise_for_status()
    except requests.RequestException as exc:
        return jsonify({"error": f"Prices were collected but the desk did not save them. {exc}"}), 502
    return saved.json()


if __name__ == "__main__":
    print("Pricebench Collector is running. Leave this window open, then use the website.")
    app.run(host="127.0.0.1", port=47123, debug=False)
