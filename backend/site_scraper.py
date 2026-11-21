"""Location and product collection for Blinkit, Zepto, and Swiggy Instamart.

These sites block headless Chromium (Cloudflare / AWS WAF) and ship new
class names often, so this module drives installed Google Chrome and reads
search APIs or stable attributes instead of the old styled-component classes.
"""
import asyncio
import re
from urllib.parse import quote

from playwright.async_api import async_playwright

STEALTH_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
window.chrome = window.chrome || { runtime: {} };
"""

BLINKIT_DOM_JS = """
() => {
  const titles = [...document.querySelectorAll('div.tw-text-300.tw-font-semibold.tw-line-clamp-2')];
  return titles.map(title => {
    const block = title.closest('div.tw-flex.tw-w-full.tw-flex-col') || title.parentElement;
    const qty = block.querySelector('div.tw-text-200.tw-font-medium');
    const sale = block.querySelector('div.tw-text-200.tw-font-semibold');
    const mrp = block.querySelector('div.tw-line-through');
    const root = block.parentElement || block;
    const img = root.querySelector('img');
    return {
      name: (title.innerText || '').trim(),
      quantity: qty ? qty.innerText.trim() : '',
      discounted_price: sale ? sale.innerText.trim() : '',
      original_price: mrp ? mrp.innerText.trim() : '',
      image_url: img ? img.src : null,
    };
  }).filter(item => item.name);
}
"""

ZEPTO_DOM_JS = """
() => [...document.querySelectorAll('[data-testid="product-card"]')].map(card => {
  const slot = (id) => {
    const el = card.querySelector(`[data-slot-id="${id}"]`);
    return el ? el.innerText.trim() : '';
  };
  const legacy = (id) => {
    const el = card.querySelector(`[data-testid="${id}"]`);
    return el ? el.innerText.trim() : '';
  };
  const priceEl = card.querySelector(
    '[data-slot-id="EdlpPrice"], [data-slot-id="Price"], [data-slot-id="SellingPrice"], [data-testid="product-card-price"]'
  );
  const img = card.querySelector('img');
  return {
    name: slot('ProductName') || legacy('product-card-name'),
    quantity: slot('PackSize') || legacy('product-card-quantity'),
    price_text: priceEl ? priceEl.innerText : '',
    image_url: img ? img.src : null,
  };
}).filter(item => item.name);
"""

SWIGGY_DOM_JS = """
() => {
  const buttons = [...document.querySelectorAll('[data-testid="buttonpair-add"], [aria-label="Add item to cart"]')];
  const out = [];
  const seen = new Set();
  for (const btn of buttons) {
    let best = null;
    let node = btn.parentElement;
    for (let i = 0; i < 8 && node; i++) {
      const text = (node.innerText || '').trim();
      const lines = text.split('\\n').map(s => s.trim()).filter(Boolean);
      if (lines.length >= 2 && lines.length <= 10 && text.length < 280) {
        best = node;
        break;
      }
      node = node.parentElement;
    }
    if (!best) continue;
    const text = best.innerText.trim();
    if (seen.has(text)) continue;
    seen.add(text);
    const img = best.querySelector('img');
    out.push({ text, image_url: img ? (img.currentSrc || img.src) : null });
  }
  return out;
}
"""


def money(value):
    """Parse a rupee amount from an int, float, or string such as '₹1,299'."""
    if value is None or value == "":
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = re.sub(r"[^\d.]", "", str(value))
    if not text or text == ".":
        return 0.0
    try:
        return float(text)
    except ValueError:
        return 0.0


def _with_prices(name, quantity, discounted, original, image_url):
    discounted = money(discounted)
    original = money(original) or discounted
    if original < discounted:
        original = discounted
    return {
        "name": (name or "").strip(),
        "quantity": (quantity or "").strip(),
        "discounted_price": discounted,
        "original_price": original,
        "image_url": image_url,
    }


def parse_blinkit_payload(payload):
    """Pull unique cart items out of Blinkit's layout/search JSON."""
    found = {}

    def walk(node):
        if isinstance(node, dict):
            item = node.get("cart_item")
            if isinstance(item, dict) and item.get("product_name"):
                found[item.get("product_id") or item.get("product_name")] = item
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload)
    products = []
    for item in found.values():
        products.append(_with_prices(
            item.get("product_name"),
            item.get("unit") or "",
            item.get("price"),
            item.get("mrp"),
            item.get("image_url"),
        ))
    return products


def parse_swiggy_text(text, image_url):
    """Turn a product-card's visible lines into name, pack size, and prices."""
    lines = [line.strip() for line in (text or "").splitlines() if line.strip()]
    cleaned = []
    for line in lines:
        if re.search(r"\bmins?\b", line, re.I):
            continue
        if re.search(r"\d+\s*%?\s*off", line, re.I):
            continue
        if line.lower() in {"add", "see all"}:
            continue
        cleaned.append(line)

    name = None
    quantity = ""
    prices = []
    for line in cleaned:
        if re.fullmatch(r"₹?\s*[\d,]+(?:\.\d+)?", line):
            prices.append(money(line))
            continue
        if re.search(r"\d", line) and re.search(
            r"\b(g|kg|mg|ml|l|ltr|litre|liter|pack|pc|pcs|piece|pieces|unit)\b",
            line,
            re.I,
        ):
            if not quantity:
                quantity = line
            continue
        if name is None:
            name = line

    if not name:
        return None
    discounted = prices[0] if prices else 0
    original = prices[1] if len(prices) > 1 else discounted
    if len(prices) > 1 and prices[0] > prices[1]:
        original, discounted = prices[0], prices[1]
    return _with_prices(name, quantity, discounted, original, image_url)


async def launch_browser(playwright):
    """Open real Chrome. Headless mode is rejected by Blinkit and Zepto."""
    # A real window is required, but it stays off to the side. The prices
    # are shown on the SnapPrice page, so nobody has to watch this window.
    args = [
        "--disable-blink-features=AutomationControlled",
        "--window-position=-2400,-2400",
        "--window-size=1400,900",
    ]
    errors = []
    for kwargs in (
        {"channel": "chrome", "headless": False, "args": args},
        {"headless": False, "args": args},
    ):
        try:
            browser = await playwright.chromium.launch(**kwargs)
            print(f"Browser launched ({'Google Chrome' if kwargs.get('channel') else 'Playwright Chromium'})")
            return browser
        except Exception as exc:
            errors.append(str(exc))
    raise RuntimeError("Could not launch a browser: " + " | ".join(errors))


async def new_context(browser):
    context = await browser.new_context(
        viewport={"width": 1400, "height": 900},
        locale="en-IN",
        timezone_id="Asia/Kolkata",
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
    )
    await context.add_init_script(STEALTH_JS)
    return context


async def set_location_blinkit(page, pincode):
    await page.goto("https://blinkit.com/", timeout=60000, wait_until="domcontentloaded")
    locality = page.locator("input[name='select-locality']")
    try:
        await locality.first.wait_for(state="visible", timeout=8000)
    except Exception:
        title = page.locator("[class*='LocationBar__Title']")
        if await title.count():
            await title.first.click()
        await locality.first.wait_for(state="visible", timeout=8000)

    await locality.first.click()
    await locality.first.fill("")
    await locality.first.type(str(pincode), delay=60)
    suggestion = page.locator("[class*='LocationSearchList']")
    await suggestion.first.wait_for(state="visible", timeout=10000)
    await suggestion.first.click()
    await page.wait_for_timeout(2500)
    print(f"Blinkit location set for pincode: {pincode}")


async def fetch_blinkit_products(page, query):
    captured = []

    async def on_response(response):
        if "/v1/layout/search" in response.url and response.status == 200:
            try:
                captured.append(await response.json())
            except Exception:
                pass

    page.on("response", on_response)
    try:
        await page.goto(
            f"https://blinkit.com/s/?q={quote(query)}",
            timeout=60000,
            wait_until="domcontentloaded",
        )
        for _ in range(24):
            if captured:
                break
            await asyncio.sleep(0.5)
    finally:
        try:
            page.remove_listener("response", on_response)
        except Exception:
            pass

    products = []
    seen = set()
    for payload in captured:
        for item in parse_blinkit_payload(payload):
            if item["name"] in seen:
                continue
            seen.add(item["name"])
            products.append(item)

    if not products:
        for raw in await page.evaluate(BLINKIT_DOM_JS):
            item = _with_prices(
                raw.get("name"),
                raw.get("quantity"),
                raw.get("discounted_price"),
                raw.get("original_price"),
                raw.get("image_url"),
            )
            if item["name"] and item["name"] not in seen:
                seen.add(item["name"])
                products.append(item)
    print(f"Blinkit returned {len(products)} products for '{query}'")
    return products


async def set_location_zepto(page, pincode):
    await page.goto("https://www.zepto.com/", timeout=60000, wait_until="domcontentloaded")
    button = page.locator("button[aria-label='Select Location']")
    try:
        await button.first.wait_for(state="visible", timeout=30000)
    except Exception:
        button = page.locator("[data-testid='user-address']")
        await button.first.wait_for(state="visible", timeout=8000)
    await button.first.click()

    address = page.locator("input[placeholder='Search a new address']")
    await address.first.wait_for(state="visible", timeout=10000)
    await address.first.fill(str(pincode))
    item = page.locator("[data-testid='address-search-item']")
    await item.first.wait_for(state="visible", timeout=10000)
    await item.first.click()

    confirm = page.locator("[data-testid='location-confirm-btn']")
    try:
        if await confirm.count():
            await confirm.first.click(timeout=4000)
    except Exception:
        pass
    await page.wait_for_timeout(2000)
    print(f"Zepto location set for pincode: {pincode}")


def parse_zepto_payload(payload):
    """Zepto search JSON stores prices in paise."""
    products = []
    seen = set()

    def walk(node):
        if isinstance(node, dict):
            product_response = node.get("productResponse")
            product = product_response.get("product") if isinstance(product_response, dict) else None
            if isinstance(product, dict) and product.get("name"):
                variant = product_response.get("productVariant") or {}
                image_url = None
                images = variant.get("images") or []
                if images and isinstance(images[0], dict) and images[0].get("path"):
                    image_url = "https://cdn.zeptonow.com/production/" + images[0]["path"]
                key = product_response.get("id") or product["name"]
                if key not in seen:
                    seen.add(key)
                    selling = product_response.get("discountedSellingPrice") or product_response.get("sellingPrice") or 0
                    mrp = product_response.get("mrp") or selling
                    products.append(_with_prices(
                        product["name"],
                        variant.get("formattedPacksize") or "",
                        selling / 100,
                        mrp / 100,
                        image_url,
                    ))
                return
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload)
    return products


async def fetch_zepto_products(page, query):
    captured = []

    async def on_response(response):
        if "search-federator-service/api/v1/search" in response.url and response.status == 200:
            try:
                captured.append(await response.json())
            except Exception:
                pass

    page.on("response", on_response)
    try:
        await page.goto(
            f"https://www.zepto.com/search?query={quote(query)}",
            timeout=60000,
            wait_until="domcontentloaded",
        )
        for _ in range(24):
            if captured:
                break
            await asyncio.sleep(0.5)
    finally:
        try:
            page.remove_listener("response", on_response)
        except Exception:
            pass

    products = []
    seen = set()
    for payload in captured:
        for item in parse_zepto_payload(payload):
            if item["name"] in seen:
                continue
            seen.add(item["name"])
            products.append(item)
    print(f"Zepto returned {len(products)} products for '{query}'")
    return products


async def _park_window(page):
    """Hide Chrome once the page is ready. Minimizing too early skips the location dialog."""
    try:
        session = await page.context.new_cdp_session(page)
        info = await session.send("Browser.getWindowForTarget")
        await session.send("Browser.setWindowBounds", {
            "windowId": info["windowId"],
            "bounds": {"windowState": "minimized"},
        })
    except Exception:
        pass


async def _open_swiggy_area_search(page):
    """Open the area box. Instamart reloads once, so the dialog arrives a few seconds late."""
    box = page.locator("input[placeholder*='area'], input[placeholder*='street']")
    target = page.locator('[data-testid="search-location"]')
    for _ in range(24):
        try:
            if await box.count() and await box.first.is_visible():
                return box
            if await target.count():
                await target.first.click(force=True)
                try:
                    await box.first.wait_for(state="visible", timeout=3000)
                    return box
                except Exception:
                    pass
        except Exception:
            pass
        await page.wait_for_timeout(500)
    raise TimeoutError("Swiggy location search did not open")


async def set_location_swiggy(page, pincode):
    await page.goto(
        "https://www.swiggy.com/instamart",
        timeout=60000,
        wait_until="domcontentloaded",
    )
    box = await _open_swiggy_area_search(page)
    await _park_window(page)
    await box.first.fill(str(pincode))
    suggestion = page.locator("div._11n32")
    await suggestion.first.wait_for(state="visible", timeout=8000)
    # The first row is the bare pincode and does not select a store.
    picked = suggestion.first
    for index in range(await suggestion.count()):
        label = await suggestion.nth(index).inner_text()
        if "," in label:
            picked = suggestion.nth(index)
            break
    await picked.click(force=True)

    confirm = page.get_by_role("button", name="Confirm Location")
    await confirm.first.wait_for(state="visible", timeout=8000)
    await confirm.first.click()

    pin = str(pincode)
    for _ in range(12):
        text = (await page.locator("body").inner_text()).lower()
        if "log in with phone" in text or "log in to continue" in text:
            raise RuntimeError("Instamart asked for a phone login before a store was selected")
        if "delivery to" in text and pin in text:
            print(f"Swiggy location set for pincode: {pincode}")
            return
        await page.wait_for_timeout(400)
    raise TimeoutError(f"Swiggy did not keep pincode {pincode}")


def parse_swiggy_payload(payload):
    products = []
    seen = set()

    def walk(node):
        if isinstance(node, dict):
            variations = node.get("variations")
            if node.get("displayName") and isinstance(variations, list) and variations:
                variant = variations[0] if isinstance(variations[0], dict) else {}
                price = variant.get("price") or {}
                offer = (price.get("offerPrice") or {}).get("units")
                mrp = (price.get("mrp") or {}).get("units") or offer
                images = variant.get("imageIds") or []
                image_url = None
                if images:
                    image_url = "https://instamart-media-assets.swiggy.com/swiggy/image/upload/" + images[0]
                key = node.get("productId") or node["displayName"]
                if key not in seen:
                    seen.add(key)
                    products.append(_with_prices(
                        node["displayName"],
                        variant.get("quantityDescription") or "",
                        offer,
                        mrp,
                        image_url,
                    ))
                return
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    walk(payload)
    return products


async def fetch_swiggy_products(page, query):
    captured = []

    async def on_response(response):
        # Ignore the empty search-landing call. Results include offset= and products.
        url = response.url
        if "/api/instamart/search/v2?" not in url or "offset=" not in url or response.status != 200:
            return
        try:
            items = parse_swiggy_payload(await response.json())
        except Exception:
            return
        if items:
            captured.append(items)

    page.on("response", on_response)
    try:
        search = page.locator('button[data-testid="search-container"]')
        if await search.count() == 0:
            await page.goto(
                "https://www.swiggy.com/instamart",
                timeout=60000,
                wait_until="domcontentloaded",
            )
            await page.wait_for_timeout(2000)
        await search.first.click(force=True, timeout=10000)
        box = page.locator('input[data-testid="search-page-header-search-bar-input"]')
        await box.first.wait_for(state="visible", timeout=8000)
        wall = (await page.locator("body").inner_text()).lower()
        if "log in with phone" in wall or "log in to continue" in wall:
            raise RuntimeError("Instamart showed the phone login instead of search results")
        await page.wait_for_timeout(500)
        await box.first.fill(query)
        await box.first.press("Enter")
        for _ in range(24):
            if captured:
                break
            await asyncio.sleep(0.5)
    finally:
        try:
            page.remove_listener("response", on_response)
        except Exception:
            pass

    products = []
    seen = set()
    for batch in captured:
        for item in batch:
            if item["name"] in seen:
                continue
            seen.add(item["name"])
            products.append(item)

    if not products:
        blocks = await page.evaluate(SWIGGY_DOM_JS)
        for block in blocks:
            item = parse_swiggy_text(block.get("text"), block.get("image_url"))
            if not item or not item["name"] or item["name"] in seen:
                continue
            seen.add(item["name"])
            products.append(item)

    print(f"Swiggy returned {len(products)} products for '{query}'")
    return products


async def open_browser():
    manager = async_playwright()
    playwright = await manager.start()
    browser = await launch_browser(playwright)
    return manager, playwright, browser
