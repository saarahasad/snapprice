import asyncio
import random
from playwright.async_api import async_playwright
from flask import Flask
from models import db, Platform, Product, ScrapedData,Pincode
from config import DATABASE_URL
import pytz
from datetime import datetime
from sqlalchemy.exc import IntegrityError
import re

IST = pytz.timezone("Asia/Kolkata")


app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
]

def fetch_pincodes():
    """Fetch pincodes from the database within Flask app context."""
    with app.app_context():  #  Ensures correct application context
        return [p.pincode for p in Pincode.query.all()]

#  Now fetching pincodes works correctly
PINCODES = fetch_pincodes()

#for pincode in PINCODES[:10]:  # Example loop
    #print(f"Processing pincode: {pincode}")

synonyms_dict = {
    "cashews": ["cashew", "kaju", "cashew nuts", "whole cashews"],
    "jeera rice": ["jeera rice", "cumin rice"],
    "peanuts": ["peanut", "groundnut", "roasted peanuts"],
    "almonds": ["almond", "badam", "whole almonds"]
}

# Define blacklisted words to avoid unwanted products
blacklist_terms = ["cookie", "flavored", "chocolate", "snack", "bar", "biscuits"]

def is_relevant_product(product_name, search_query, synonyms_dict=None, blacklist_terms=None):
    """
    Check if the product name contains the full search phrase or all individual words in the query.
    
    Parameters:
    - product_name (str): The name of the scraped product.
    - search_query (str): The original search term.
    - synonyms_dict (dict, optional): Dictionary of synonyms for various search terms.
    - blacklist_terms (list, optional): List of words that should cause the product to be rejected.

    Returns:
    - bool: True if the product is relevant, False otherwise.
    """

    # Normalize text (convert to lowercase and strip extra spaces)
    product_name = product_name.lower().strip()
    search_query = search_query.lower().strip()

    # Get relevant terms: include search query and synonyms
    valid_terms = [search_query]
    if synonyms_dict and search_query in synonyms_dict:
        valid_terms.extend(synonyms_dict[search_query])

    # Check if the full phrase matches
    if any(term in product_name for term in valid_terms):
        phrase_match = True
    else:
        phrase_match = False

    # If phrase match fails, check if all words are in product name (AND condition)
    words = search_query.split()
    word_match = all(word in product_name for word in words)

    # Final decision: pass if either phrase match or all words match
    if not (phrase_match or word_match):
        return False  # Skip product if neither condition matches

    # Check if product name contains blacklisted terms
    if blacklist_terms and any(term in product_name for term in blacklist_terms):
        return False  # Skip product if it contains blacklisted words

    return True  # Product is relevant


###  Function to set location for Blinkit ###
async def set_location_blinkit(page, pincode):
    """Set the Blinkit location by entering the pincode."""
    await page.goto("https://blinkit.com/", timeout=60000)

    try:
        #  Try waiting for the input field quickly (short timeout)
        await page.wait_for_selector("input[name='select-locality']", timeout=3000)
    except:
        #  If input field is not found, click on the location bar
        try:
            await page.locator("div.LocationBar__Title-sc-x8ezho-8").click()
            await page.wait_for_selector("input[name='select-locality']", timeout=5000)  # Wait again after clicking
        except:
            print("❌ Unable to open location selection!")

    for digit in pincode:
        await page.type("input[name='select-locality']", digit, delay=300)

    await page.wait_for_selector(".LocationSearchList__LocationListContainer-sc-93rfr7-0", timeout=10000)
    await page.locator(".LocationSearchList__LocationListContainer-sc-93rfr7-0").first.click()

    await asyncio.sleep(2)  # Wait to ensure location is set
    print(f"✅ Blinkit location set for pincode: {pincode}")


async def scrape_products_blinkit(page, product, platform_name, pincode, scrape_timestamp):
    """Scrape product data from Blinkit and store it in the database."""
    search_url = f"https://blinkit.com/s/?q={product.replace(' ', '%20')}"

    try:
        await page.goto(search_url, timeout=60000)
        await page.wait_for_selector('[data-test-id="plp-product"]', timeout=10000)

        products = await page.locator('[data-test-id="plp-product"]').all()

        with app.app_context():
            platform = Platform.query.filter_by(name=platform_name).first()
            if not platform:
                platform = Platform(name=platform_name, website_url="https://blinkit.com/")
                db.session.add(platform)
                db.session.commit()

            product_entry = Product.query.filter_by(name=product).first()
            if not product_entry:
                product_entry = Product(name=product)
                db.session.add(product_entry)
                db.session.commit()

            for product_element in products:
                try:
                    #  Extract product details
                    name = await product_element.locator('.Product__UpdatedTitle-sc-11dk8zk-9').text_content() or ""
                    if not is_relevant_product(name, product, synonyms_dict, blacklist_terms):
                        print(f"🚫 Skipping irrelevant product: {name}")
                        continue  # Skip this product if it's not relevant
                    
                    price_elements = await product_element.locator('.Product__UpdatedPriceAndAtcContainer-sc-11dk8zk-10 div div').all_text_contents()
                    quantity_text = await product_element.locator('.plp-product__quantity--box').text_content() or ""

                    #  First, locate the image (NO `await` here)
                    image_element = product_element.locator('.Imagestyles__ImageContainer-sc-1u3ccmn-0 img')

                    #  Then, use `await` only when calling `get_attribute()`
                    image_url = await image_element.get_attribute('src') if await image_element.count() > 0 else None


                    #  Convert prices safely
                    discounted_price = float(price_elements[0].replace('₹', '').strip()) if price_elements else 0
                    original_price = float(price_elements[1].replace('₹', '').strip()) if len(price_elements) > 1 else discounted_price

                    #  Save data to the database
                    scraped_entry = ScrapedData(
                        product_id=product_entry.id,
                        platform_id=platform.id,
                        scraped_name=name.strip(),
                        packaging_size=quantity_text.strip().lower(),
                        discounted_price=discounted_price,
                        original_price=original_price,
                        pincode=pincode,
                        scraped_at=scrape_timestamp,
                        image_url=image_url  #  Save Image URL
                    )
                    db.session.add(scraped_entry)

                    #print(f"✅ Scraped: {name} | Price: ₹{discounted_price} | Image: {image_url}")

                except Exception as e:
                    print(f"❌ Error scraping Blinkit product: {e}")

            db.session.commit()
            print(f"✅ Blinkit Data saved for {product} in {pincode}")

    except Exception as e:
        print(f"❌ Error scraping Blinkit {product} for {pincode}: {e}")


async def set_location_swiggy(page, pincode):
    """Set the Swiggy location by entering the pincode."""
    try:

        await page.goto("https://www.swiggy.com/instamart", timeout=60000)

        await asyncio.sleep(3) 
        
        popup_visible = await page.locator('div[data-testid="search-location"]').is_visible()

        if not popup_visible:
                    print("ℹ️ Popup is not visible, clicking on 'Delivery to' button...")
                    await page.locator('div[data-testid="address-bar"]').click()
                    await asyncio.sleep(2)  # Allow popup to open

        await page.locator('div[data-testid="search-location"]').click()

        await page.fill('input[placeholder="Search for area, street name…"]', pincode)
        await asyncio.sleep(2)  # Allow search results to populate

        await page.wait_for_selector('div._11n32', timeout=5000)
        await page.locator('div._11n32').first.click()

        await page.wait_for_selector('div._2xPHa._2qogK', timeout=5000)
        await page.locator('div._2xPHa._2qogK').click()

        await asyncio.sleep(2)  # Wait to ensure location is set
        print(f"✅ Swiggy Location set for pincode: {pincode}")

    except Exception as e:
        print(f"❌ Error setting Swiggy location for {pincode}: {e}")


async def scrape_products_swiggy(page, product, platform_name, pincode, scrape_timestamp):
    """Scrape product data from Swiggy Instamart and store it in the database."""

    try:
        #  Step 1: Open Swiggy Instamart and search for the product
        await page.goto("https://www.swiggy.com/instamart", timeout=60000)

        await page.wait_for_selector('button[data-testid="search-container"]', timeout=5000)
        await page.locator('button[data-testid="search-container"]').click()
        await asyncio.sleep(1)

        await page.wait_for_selector('input[data-testid="search-page-header-search-bar-input"]', timeout=5000)
        search_input = page.locator('input[data-testid="search-page-header-search-bar-input"]')
        await search_input.fill(product)
        await search_input.press("Enter")
        await asyncio.sleep(3)  # Wait for results to load

        #  Step 2: Ensure product list appears
        try:
            await page.wait_for_selector('div._3ZzU7', timeout=10000)
        except:
            print(f"⚠️ No results found for {product} in Swiggy Instamart ({pincode})")
            return

        products = await page.locator("div.XjYJe").all()
        #print(f"✅ Found {len(products)} products for {product}")

        #  Step 3: Store data in the database
        with app.app_context():
            # Ensure platform exists
            platform = Platform.query.filter_by(name=platform_name).first()
            if not platform:
                platform = Platform(name=platform_name, website_url="https://www.swiggy.com/instamart")
                db.session.add(platform)
                db.session.commit()

            # Ensure product entry exists
            product_entry = Product.query.filter_by(name=product).first()
            if not product_entry:
                product_entry = Product(name=product)
                db.session.add(product_entry)
                db.session.commit()

            scraped_entries = []  # Store entries in batch to reduce DB commits

            for product_element in products:  # Process first 10 products only
                try:
                    #  Fetch the product name
                    name_locator = product_element.locator("div.novMV")
                    name = await name_locator.text_content() if await name_locator.count() > 0 else "Unknown"

                    if not is_relevant_product(name, product, synonyms_dict, blacklist_terms):
                        print(f"🚫 Skipping irrelevant product: {name}")
                        continue  # Skip this product if it's not relevant

                    #  Fetch packaging size
                    quantity_locator = product_element.locator('div.sc-aXZVg.entQHA')
                    quantity_text = await quantity_locator.text_content() if await quantity_locator.count() > 0 else "N/A"

                    #  Extract Discounted Price
                    discounted_price_locator = product_element.locator('div.sc-aXZVg.jLtxeJ')
                    has_discounted_price = await discounted_price_locator.count() > 0
                    discounted_price = await discounted_price_locator.get_attribute("aria-label") if has_discounted_price else None

                    #  Extract Original Price (Strikethrough Price)
                    original_price_locator = product_element.locator('div[data-testid="itemOfferPrice"]')
                    has_original_price = await original_price_locator.count() > 0
                    original_price = await original_price_locator.get_attribute("aria-label") if has_original_price else discounted_price
                    
                    await page.evaluate("window.scrollBy(0, 1000)")  # Scroll down to force loading
                    await asyncio.sleep(3)  # Give time for images to load

                    
                    #  Extract Product Image
                   # image_locator = product_element.locator("img")
                   # image_url = await image_locator.get_attribute("src") if await image_locator.count() > 0 else None
                    # Extract Product Image (Filter out small icons and badges)
                    image_locator = product_element.locator("img")
                    image_count = await image_locator.count()

                    if image_count > 0:
                        image_url = await image_locator.first.get_attribute("src") or await image_locator.first.get_attribute("data-src")
                    else:
                        # Check if image is stored in a background-image style
                        bg_image_locator = product_element.locator("div[style*='background-image']")
                        if await bg_image_locator.count() > 0:
                            style = await bg_image_locator.first.get_attribute("style")
                            image_url = re.search(r'url\(["\']?(.*?)["\']?\)', style).group(1) if style else None

                    if image_count > 0:
                        image_url = await image_locator.first.get_attribute("src")  # Fetch the first valid product image
                    else:
                        image_url = None  # Fallback if no image found

                    #  Convert prices safely
                    def convert_price(price):
                        return float(price) if price and price.isdigit() else 0

                    discounted_price = convert_price(discounted_price)
                    original_price = convert_price(original_price)

                    #  If no discount exists, assign original price as the discounted price
                    final_discounted_price = discounted_price if discounted_price else original_price

                    #  Append to batch for efficient insertion
                    scraped_entries.append(ScrapedData(
                        product_id=product_entry.id,
                        platform_id=platform.id,
                        scraped_name=name.strip(),
                        packaging_size=quantity_text.strip().lower(),
                        discounted_price=final_discounted_price,
                        original_price=original_price,
                        pincode=pincode,
                        scraped_at=scrape_timestamp,
                        image_url=image_url  #  Store image URL
                    ))

                   # print(f"✅ Swiggy Instamart Data saved: {name} - ₹{final_discounted_price} | Image: {image_url}")

                except Exception as e:
                    print(f"⚠️ Error processing product: {str(e)}")

            #  Bulk insert for better DB performance
            try:
                db.session.bulk_save_objects(scraped_entries)
                db.session.commit()
                print(f"✅ Swiggy Instamart Data saved for {product} in {pincode}")

            except IntegrityError as e:
                db.session.rollback()
                print(f"❌ Database Integrity Error: {e}")

    except Exception as e:
        print(f"❌ Error scraping Swiggy Instamart '{product}' for {pincode}: {e}")


async def set_location_zepto(page, pincode):
    """Set the Zepto location using the same session."""
    await page.goto("https://www.zeptonow.com/search", timeout=60000)

    #  Click the "Select Location" button
    await page.wait_for_selector("button[aria-label='Select Location']", timeout=10000)
    await page.click("button[aria-label='Select Location']")

    #  Enter pincode
    await page.wait_for_selector("input[placeholder='Search a new address']", timeout=10000)
    await page.fill("input[placeholder='Search a new address']", pincode)

    #  Select the first address from the dropdown
    await page.wait_for_selector("[data-testid='address-search-item']", timeout=10000)
    await page.click("[data-testid='address-search-item']:first-child")

    #  Click "Confirm & Continue"
    await page.wait_for_selector("[data-testid='location-confirm-btn']", timeout=10000)
    await page.click("[data-testid='location-confirm-btn']")

    await asyncio.sleep(2)  #  Wait to ensure location is set
    print(f"✅ Zepto location set for pincode: {pincode}")


async def scrape_products_zepto(page, product, platform_name, pincode, scrape_timestamp):
    """Scrape product data from Zepto and store it in the database."""
    try:
        #  Navigate to Zepto search page
        await page.goto("https://www.zeptonow.com/search", timeout=60000)

        #  Type the product name and press Enter
        search_box = page.locator("input[placeholder='Search for over 5000 products']")
        await search_box.click()
        await search_box.fill("")
        await page.keyboard.type(product, delay=100)
        await page.keyboard.press("Enter")  
        await page.wait_for_timeout(3000)  # Small delay to allow results to load

        results_selector = '[data-testid="product-card"]'
        no_results_selector = "text=No products found"

        results_found = await page.locator(results_selector).count()
        no_results_found = await page.locator(no_results_selector).count()

        if no_results_found > 0:
            print(f"⚠️ No products found for '{product}' in {pincode}. Skipping...")
            return

        if results_found == 0:
            print(f"⏳ Waiting longer for '{product}' in {pincode}...")
            await page.wait_for_timeout(5000)
            results_found = await page.locator(results_selector).count()

            if results_found == 0:
                print(f"⚠️ Still no results for '{product}' in {pincode}. Skipping...")
                return

        products = await page.locator(results_selector).all()

        with app.app_context():
            platform = Platform.query.filter_by(name=platform_name).first()
            if not platform:
                platform = Platform(name=platform_name, website_url="https://www.zeptonow.com/search")
                db.session.add(platform)
                db.session.commit()

            product_entry = Product.query.filter_by(name=product).first()
            if not product_entry:
                product_entry = Product(name=product)
                db.session.add(product_entry)
                db.session.commit()

            for product_element in products:
                try:
                    #  Extract product details
                    name = await product_element.locator('[data-testid="product-card-name"]').text_content(timeout=5000) or ""

                    if not is_relevant_product(name, product, synonyms_dict, blacklist_terms):
                        print(f"🚫 Skipping irrelevant product: {name}")
                        continue  # Skip this product if it's not relevant

                    discounted_price_text = await product_element.locator('[data-testid="product-card-price"]').text_content(timeout=5000) or ""
                    
                    #  Extract original price (if available)
                    original_price_text = discounted_price_text  
                    original_price_locator = product_element.locator('p.line-through')
                    if await original_price_locator.count() > 0:
                        original_price_text = await original_price_locator.text_content(timeout=2000)

                    quantity_text = await product_element.locator('[data-testid="product-card-quantity"]').text_content(timeout=5000) or ""

                    all_images = await product_element.locator("img").all()

                    #  Ensure at least one image exists
                    if all_images:
                        image_url = await all_images[0].get_attribute('src')  #  Get the first image (Main Product Image)
                    else:
                        image_url = None  #  If no image found, set to None


                    #  Convert prices safely
                    def extract_price(text):
                        return float(text.replace('₹', '').strip()) if text and text.strip() else 0

                    discounted_price = extract_price(discounted_price_text)
                    original_price = extract_price(original_price_text)

                    #  Save data to the database
                    scraped_entry = ScrapedData(
                        product_id=product_entry.id,
                        platform_id=platform.id,
                        scraped_name=name.strip(),
                        packaging_size=quantity_text.strip().lower(),
                        discounted_price=discounted_price,
                        original_price=original_price,
                        pincode=pincode,
                        scraped_at=scrape_timestamp,
                        image_url=image_url  #  Save Image URL
                    )

                    db.session.add(scraped_entry)
                    #print(f"✅ Scraped: {name} | Price: ₹{discounted_price} | Image: {image_url}")

                except Exception as e:
                    print(f"❌ Error scraping product: {e}")

            db.session.commit()
            print(f"✅ Zepto Data saved for {product} in {pincode}")

    except Exception as e:
        print(f"❌ Error scraping Zepto {product} for {pincode}: {e}")

###  Main function to run both scrapers ###
async def run_scraper():
    """Run Playwright scrapers for both Blinkit & Zepto across multiple pincodes."""
    scrape_timestamp = datetime.now(IST)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(user_agent=random.choice(USER_AGENTS))
        page = await context.new_page()

        for pincode in PINCODES:
            await set_location_blinkit(page, pincode)
            await set_location_zepto(page, pincode)
            await set_location_swiggy(page, pincode)

            with app.app_context():
                products = [p.name for p in Product.query.all()]

            for product in products:
                await scrape_products_swiggy(page, product, "Swiggy", pincode,scrape_timestamp)
                await scrape_products_blinkit(page, product, "Blinkit", pincode,scrape_timestamp)
                await scrape_products_zepto(page, product, "Zepto", pincode,scrape_timestamp)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_scraper())
