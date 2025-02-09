from flask import Flask, jsonify,request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from models import db, Platform, Product, ScrapedData,LiveScrapedProduct,User
import re
import pytz
from flask_cors import CORS  # ✅ Import CORS
from playwright.async_api import async_playwright
from flask import Flask, request, jsonify
import asyncio
import random
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from sqlalchemy import cast, String
import bcrypt
from sqlalchemy import text

IST = pytz.timezone("Asia/Kolkata")

app = Flask(__name__)
CORS(app)  # ✅ Enable CORS

# ✅ Configure PostgreSQL (Update credentials)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://scraperuser:password@localhost/scraperdb'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# ✅ Initialize database & migration
db.init_app(app)
migrate = Migrate(app, db)

# ✅ Ensure tables exist
with app.app_context():
    db.create_all()

@app.route('/')
def home():
    return jsonify({"message": "Scraper Database is Ready!"})


@app.route('/scraped-data', methods=['GET'])
def get_scraped_data():
    try:
        data = ScrapedData.query.all()
        return jsonify([{
            "id": d.id,
            "product": d.product.name,
            "platform": d.platform.name,
            "scraped_name": d.scraped_name,
            "packaging_size": d.packaging_size,
            "discounted_price": d.discounted_price,
            "original_price": d.original_price,
            "pincode": d.pincode,  # ✅ Added pincode to response
            "scraped_at": d.scraped_at.strftime('%Y-%m-%d %H:%M:%S')
        } for d in data])
    except Exception as e:
        return jsonify({"error": str(e)}), 500  # ✅ Error handling



def parse_quantity(quantity_text):
    """Extract numerical quantity and unit, converting all values to kg."""
    quantity_text = quantity_text.lower().strip()
    
    # Extract all number and unit pairs
    matches = re.findall(r'(\d+)\s*(kg|g)?', quantity_text)
    
    if not matches:
        return None, None
    
    total_quantity = 0.0
    quantities = []
    
    for num, unit in matches:
        value = float(num)
        if unit == "kg" or ("kg" in quantity_text and not unit):
            quantities.append(value)
        elif unit == "g" or ("g" in quantity_text and not unit):
            quantities.append(value / 1000)
    
    # Handle multiplication expressions like "200 g x 2" or "2 kg x 2"
    multipliers = re.findall(r'\bx\s*(\d+)\b', quantity_text)
    if multipliers:
        multiplier = int(multipliers[-1])  # Take the last found multiplier
        total_quantity = sum(quantities) * multiplier
    else:
        total_quantity = sum(quantities)
    
    return total_quantity, "kg" if total_quantity else None

@app.route('/pincodes', methods=['GET'])
def get_pincodes():
    """Fetch all unique pincodes from the scraped data."""
    
    pincodes = db.session.query(ScrapedData.pincode).distinct().all()

    if not pincodes:
        return jsonify({"error": "No pincodes found"}), 404

    # Convert tuple list to a simple list of pincodes
    pincode_list = [pincode[0] for pincode in pincodes]

    return jsonify(pincode_list)


@app.route('/latest_scraped_entries/<product_id>', methods=['GET'])
def latest_scraped_entries(product_id):
    """Fetch all latest entries for a product filtered by pincode (if provided)."""
    pincode = request.args.get('pincode', None)
    product_type = request.args.get('product_type', 1)

    #print(product_id,pincode,product_type)

    # ✅ Step 1: Find the latest `scraped_at` timestamp for this product
  
    latest_scrape_time_query = db.session.query(
        db.func.max(ScrapedData.scraped_at)
    ).filter(ScrapedData.product_id == product_id)

    if pincode:
        latest_scrape_time_query = latest_scrape_time_query.filter(ScrapedData.pincode == pincode)

    latest_scrape_time = latest_scrape_time_query.scalar()

    if not latest_scrape_time:
        return jsonify({"error": "No data found for this product and pincode"}), 404

    product_id = str(product_id)  # Ensure it's a string

    if str(product_type) == '1':  # Make sure to compare as string or integer
        query = db.session.query(
            ScrapedData.scraped_name, Product.name, Product.category,
            ScrapedData.discounted_price, ScrapedData.original_price,
            ScrapedData.packaging_size, Platform.name, ScrapedData.pincode, ScrapedData.scraped_at, ScrapedData.image_url
        ).select_from(ScrapedData)  \
        .join(Product, cast(ScrapedData.product_id, String) == cast(Product.id, String)) \
        .join(Platform, ScrapedData.platform_id == Platform.id) \
        .filter(ScrapedData.product_id == str(product_id),  # Ensure product_id is passed as string
                ScrapedData.scraped_at == latest_scrape_time)
        #print("1",query)
    else:
        query = db.session.query(
            ScrapedData.scraped_name, LiveScrapedProduct.name,
            ScrapedData.discounted_price, ScrapedData.original_price,
            ScrapedData.packaging_size, Platform.name, ScrapedData.pincode, ScrapedData.scraped_at, ScrapedData.image_url
        ).select_from(ScrapedData)  \
        .join(LiveScrapedProduct, cast(ScrapedData.product_id, String) == cast(LiveScrapedProduct.id, String)) \
        .join(Platform, ScrapedData.platform_id == Platform.id) \
        .filter(ScrapedData.product_id == str(product_id),  # Ensure product_id is passed as string
                ScrapedData.scraped_at == latest_scrape_time)
        #print("2",query)


    #print(query)

    if pincode:
        query = query.filter(ScrapedData.pincode == pincode)

    latest_entries = query.all()

    # ✅ Step 3: Format results for JSON response
    table_data = []
    for entry in latest_entries:
        category=''
        if str(product_type) == '1':  # Make sure to compare as string or integer
            scraped_name, name, category, discounted_price, original_price, packaging_size, platform_name, pincode, scraped_at, image_url = entry
        else:
            scraped_name, name, discounted_price, original_price, packaging_size, platform_name, pincode, scraped_at, image_url = entry

        # Assuming parse_quantity is a function to extract quantity and unit from packaging_size
        quantity, unit = parse_quantity(packaging_size)  
        price_per_kg = round(discounted_price / quantity, 2) if quantity else 0
        discount_percent = round(((original_price - discounted_price) / original_price) * 100, 2) if original_price else 0

        table_data.append({
            "product_name": scraped_name,
            "platform": platform_name,
            "product": name,
            "product_category": category,
            "discounted_price": discounted_price,
            "original_price": original_price,
            "packaging_size": packaging_size,
            "price_per_kg": price_per_kg,
            "unit": unit,
            "discount_percent": discount_percent,
            "pincode": pincode,
            "scraped_at": scraped_at.strftime('%Y-%m-%d %H:%M:%S'),
            "image_url": image_url
        })
    #print(table_data)
    return jsonify(table_data)

@app.route('/products', methods=['GET'])
def get_products():
    """Fetch all product names and IDs"""
    search_query = request.args.get('search', None)

    if search_query:
        # Case-insensitive search
        products = Product.query.filter(Product.name.ilike(f"%{search_query}%")).all()
    else:
        products = Product.query.all()

    result = [{"id": p.id, "name": p.name} for p in products]
    
    return jsonify(result)



USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
]

# Define blacklisted words to filter irrelevant products
blacklist_terms = ["cookie", "flavored", "chocolate", "snack", "bar", "biscuits"]


def is_relevant_product(product_name, search_query, synonyms_dict=None, blacklist_terms=None):
    """
    Check if the product name contains all individual words in the search query.
    
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

    # Get all terms from the search query
    query_terms = search_query.split()

    # Expand synonyms for each term
    expanded_terms = []
    for term in query_terms:
        expanded_terms.append(term)
        if synonyms_dict and term in synonyms_dict:
            expanded_terms.extend(synonyms_dict[term])

    # Ensure all query terms (or their synonyms) appear somewhere in the product name
    if not all(any(exp_term in product_name for exp_term in [term] + synonyms_dict.get(term, [])) for term in query_terms):
        return False  # Reject if any word is missing

    # Check if product name contains any blacklisted terms
    if blacklist_terms and any(term in product_name for term in blacklist_terms):
        return False  # Reject product if it contains blacklisted words

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

async def scrape_blinkit(page, product, pincode, synonyms_dict, blacklist_terms, scrape_timestamp,new_product_id,category):
    """Scrape Blinkit for the given product and pincode and store it in the database."""
    results = []
    search_url = f"https://blinkit.com/s/?q={product.replace(' ', '%20')}"

    try:
        await page.goto(search_url, timeout=60000)
        await page.wait_for_selector('[data-test-id="plp-product"]', timeout=10000)
        products = await page.locator('[data-test-id="plp-product"]').all()

        with app.app_context():
            platform = Platform.query.filter_by(name="Blinkit").first()
            if not platform:
                platform = Platform(name="Blinkit", website_url="https://blinkit.com/")
                db.session.add(platform)
                db.session.commit()

            for product_element in products:
                try:
                    # Extract product name
                    name_element = product_element.locator('.Product__UpdatedTitle-sc-11dk8zk-9')
                    name = await name_element.text_content() if await name_element.count() > 0 else None

                    if not name:
                        continue  # Skip if no name found

                    if not is_relevant_product(name, product, synonyms_dict, blacklist_terms):
                        print(f"🚫 Skipping irrelevant product: {name}")
                        continue  # Skip if not relevant

                    # Extract prices
                    price_elements = await product_element.locator('.Product__UpdatedPriceAndAtcContainer-sc-11dk8zk-10 div div').all_text_contents()
                    discounted_price = float(price_elements[0].replace('₹', '').strip()) if price_elements else 0
                    original_price = float(price_elements[1].replace('₹', '').strip()) if len(price_elements) > 1 else discounted_price

                    # Extract quantity
                    quantity_element = product_element.locator('.plp-product__quantity--box')
                    quantity_text = await quantity_element.text_content() if await quantity_element.count() > 0 else ""

                    # Extract image URL
                    image_element = product_element.locator('.Imagestyles__ImageContainer-sc-1u3ccmn-0 img')
                    image_url = await image_element.get_attribute('src') if await image_element.count() > 0 else None

                    # Save data to the database
                    scraped_entry = ScrapedData(
                        product_id=new_product_id,
                        platform_id=platform.id,
                        scraped_name=name.strip(),
                        packaging_size=quantity_text.strip().lower(),
                        discounted_price=discounted_price,
                        original_price=original_price,
                        pincode=pincode,
                        scraped_at=scrape_timestamp,
                        image_url=image_url  # Save Image URL
                    )

                    quantity, unit = parse_quantity(quantity_text.strip().lower(),)
                    price_per_kg = round(discounted_price / quantity, 2) if quantity else 0
                    discount_percent = round(((original_price - discounted_price) / original_price) * 100, 2) if original_price else 0

                    db.session.add(scraped_entry)
                    results.append({
                        "platform": "Blinkit",
                        "product_name": name.strip(),
                        "packaging_size": quantity_text.strip().lower(),
                        "discounted_price": discounted_price,
                        "original_price": original_price,
                        "pincode": pincode,
                        "image_url": image_url,
                        "discount_percent": discount_percent,
                        "price_per_kg":price_per_kg,
                        "product": product,
                        "product_category":category,
                        "scraped_at":scrape_timestamp,
                        "unit":unit,
                        "product_id":new_product_id
                    })

                    #print(f"✅ Scraped & Stored: {name} | Price: ₹{discounted_price} | Image: {image_url}")

                except Exception as e:
                    print(f"❌ Error scraping Blinkit product: {e}")

            db.session.commit()
            print(f"✅ Blinkit data saved for {product} in {pincode}")

        return results

    except Exception as e:
        print(f"❌ Error scraping Blinkit {product} for {pincode}: {e}")
        return []

async def scrape_zepto(page, product, pincode, synonyms_dict,blacklist_terms, scrape_timestamp,new_product_id,category):
    """Scrape Zepto for the given product and pincode and store it in the database."""
    try:
        # Navigate to Zepto search page
        await page.goto("https://www.zeptonow.com/search", timeout=60000)

        # Type the product name and press Enter
        search_box = page.locator("input[placeholder='Search for over 5000 products']")
        await search_box.click()
        await search_box.fill("")
        await page.keyboard.type(product, delay=100)
        await page.keyboard.press("Enter")
        await page.wait_for_timeout(3000)  # Allow results to load

        results_selector = '[data-testid="product-card"]'
        no_results_selector = "text=No products found"

        results_found = await page.locator(results_selector).count()
        no_results_found = await page.locator(no_results_selector).count()

        if no_results_found > 0:
            print(f"⚠️ No products found for '{product}' in {pincode}. Skipping...")
            return []

        if results_found == 0:
            print(f"⏳ Waiting longer for '{product}' in {pincode}...")
            await page.wait_for_timeout(5000)
            results_found = await page.locator(results_selector).count()

            if results_found == 0:
                print(f"⚠️ Still no results for '{product}' in {pincode}. Skipping...")
                return []

        products = await page.locator(results_selector).all()
        results = []

        with app.app_context():
            platform = Platform.query.filter_by(name="Zepto").first()
            if not platform:
                platform = Platform(name="Zepto", website_url="https://www.zeptonow.com/search")
                db.session.add(platform)
                db.session.commit()


            for product_element in products:
                try:
                    # Extract product details
                    name = await product_element.locator('[data-testid="product-card-name"]').text_content(timeout=5000) or ""

                    if not is_relevant_product(name, product, synonyms_dict):
                        print(f"🚫 Skipping irrelevant product: {name}")
                        continue  # Skip irrelevant products

                    discounted_price_text = await product_element.locator('[data-testid="product-card-price"]').text_content(timeout=5000) or ""
                    
                    # Extract original price if available
                    original_price_text = discounted_price_text
                    original_price_locator = product_element.locator('p.line-through')
                    if await original_price_locator.count() > 0:
                        original_price_text = await original_price_locator.text_content(timeout=2000)

                    quantity_text = await product_element.locator('[data-testid="product-card-quantity"]').text_content(timeout=5000) or ""

                    # Get product image (if available)
                    all_images = await product_element.locator("img").all()
                    image_url = await all_images[0].get_attribute('src') if all_images else None

                    # Convert prices safely
                    def extract_price(text):
                        return float(text.replace('₹', '').strip()) if text and text.strip() else 0

                    discounted_price = extract_price(discounted_price_text)
                    original_price = extract_price(original_price_text)

                    # Save data to the database
                    scraped_entry = ScrapedData(
                        product_id=new_product_id,
                        platform_id=platform.id,
                        scraped_name=name.strip(),
                        packaging_size=quantity_text.strip().lower(),
                        discounted_price=discounted_price,
                        original_price=original_price,
                        pincode=pincode,
                        scraped_at=scrape_timestamp,
                        image_url=image_url
                    )

                    quantity, unit = parse_quantity(quantity_text.strip().lower(),)
                    price_per_kg = round(discounted_price / quantity, 2) if quantity else 0
                    discount_percent = round(((original_price - discounted_price) / original_price) * 100, 2) if original_price else 0

                    db.session.add(scraped_entry)
                    results.append({
                        "platform": "Zepto",
                        "product_name": name.strip(),
                        "packaging_size": quantity_text.strip().lower(),
                        "discounted_price": discounted_price,
                        "original_price": original_price,
                        "pincode": pincode,
                        "image_url": image_url,
                        "discount_percent": discount_percent,
                        "price_per_kg":price_per_kg,
                        "product": product,
                        "product_category":category,
                        "scraped_at":scrape_timestamp,
                        "unit":unit,
                        "product_id":new_product_id
                    })

                except Exception as e:
                    print(f"❌ Error scraping Zepto product: {e}")

            db.session.commit()
            print(f"✅ Zepto data saved for {product} in {pincode}")

        return results

    except Exception as e:
        print(f"❌ Error scraping Zepto {product} for {pincode}: {e}")
        return []

async def scrape_swiggy(page, product, pincode, synonyms_dict,blacklist_terms, scrape_timestamp,new_product_id,category):
    """Scrape Swiggy Instamart for the given product and pincode and store it in the database."""
    results = []

    try:
        # Step 1: Open Swiggy Instamart and search for the product
        await page.goto("https://www.swiggy.com/instamart", timeout=60000)
        await page.wait_for_selector('button[data-testid="search-container"]', timeout=5000)
        await page.locator('button[data-testid="search-container"]').click()
        await asyncio.sleep(1)

        await page.wait_for_selector('input[data-testid="search-page-header-search-bar-input"]', timeout=5000)
        search_input = page.locator('input[data-testid="search-page-header-search-bar-input"]')
        await search_input.fill(product)
        await search_input.press("Enter")
        await asyncio.sleep(3)  # Wait for results to load

        # Step 2: Ensure product list appears
        try:
            await page.wait_for_selector('div._3ZzU7', timeout=10000)
        except:
            print(f"⚠️ No results found for {product} in Swiggy Instamart ({pincode})")
            return []

        products = await page.locator("div.XjYJe").all()

        with app.app_context():
            # Ensure platform exists
            platform = Platform.query.filter_by(name="Swiggy").first()
            if not platform:
                platform = Platform(name="Swiggy", website_url="https://www.swiggy.com/instamart")
                db.session.add(platform)
                db.session.commit()

           
            scraped_entries = []  # Store entries in batch to reduce DB commits

            for product_element in products:
                try:
                    # Fetch the product name
                    name_locator = product_element.locator("div.novMV")
                    name = await name_locator.text_content() if await name_locator.count() > 0 else "Unknown"

                    if not is_relevant_product(name, product, synonyms_dict):
                        print(f"🚫 Skipping irrelevant product: {name}")
                        continue  # Skip this product if it's not relevant

                    # Fetch packaging size
                    quantity_locator = product_element.locator('div.sc-aXZVg.entQHA')
                    quantity_text = await quantity_locator.text_content() if await quantity_locator.count() > 0 else "N/A"

                    # Extract Discounted Price
                    discounted_price_locator = product_element.locator('div.sc-aXZVg.jLtxeJ')
                    has_discounted_price = await discounted_price_locator.count() > 0
                    discounted_price = await discounted_price_locator.get_attribute("aria-label") if has_discounted_price else None

                    # Extract Original Price (Strikethrough Price)
                    original_price_locator = product_element.locator('div[data-testid="itemOfferPrice"]')
                    has_original_price = await original_price_locator.count() > 0
                    original_price = await original_price_locator.get_attribute("aria-label") if has_original_price else discounted_price

                    await page.evaluate("window.scrollBy(0, 1000)")  # Scroll down to force loading
                    await asyncio.sleep(3)  # Give time for images to load

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
                        else:
                            image_url = None  # Fallback if no image found

                    # Convert prices safely
                    def convert_price(price):
                        try:
                            return float(price.replace('₹', '').strip()) if price and price.strip() else 0
                        except ValueError:
                            return 0

                    discounted_price = convert_price(discounted_price)
                    original_price = convert_price(original_price)

                    # If no discount exists, assign original price as the discounted price
                    final_discounted_price = discounted_price if discounted_price else original_price

                    # Append to batch for efficient insertion
                    scraped_entry = ScrapedData(
                        product_id=new_product_id,
                        platform_id=platform.id,
                        scraped_name=name.strip(),
                        packaging_size=quantity_text.strip().lower(),
                        discounted_price=final_discounted_price,
                        original_price=original_price,
                        pincode=pincode,
                        scraped_at=scrape_timestamp,
                        image_url=image_url  # Store image URL
                    )
                    quantity, unit = parse_quantity(quantity_text.strip().lower(),)
                    price_per_kg = round(final_discounted_price / quantity, 2) if quantity else 0
                    discount_percent = round(((original_price - final_discounted_price) / original_price) * 100, 2) if original_price else 0

                    db.session.add(scraped_entry)
                    results.append({
                        "platform": "Swiggy",
                        "product_name": name.strip(),
                        "packaging_size": quantity_text.strip().lower(),
                        "discounted_price": final_discounted_price,
                        "original_price": original_price,
                        "pincode": pincode,
                        "image_url": image_url,
                        "discount_percent": discount_percent,
                        "price_per_kg":price_per_kg,
                        "product": product,
                        "product_category":category,
                        "scraped_at":scrape_timestamp,
                        "unit":unit,
                        "product_id":new_product_id

                    })

                    #print(f"✅ Scraped: {name} | Price: ₹{final_discounted_price} | Image: {image_url}")

                except Exception as e:
                    print(f"⚠️ Error processing product: {str(e)}")

            # Bulk insert for better DB performance
            try:
                db.session.commit()
                print(f"✅ Swiggy Instamart Data saved for {product} in {pincode}")

            except IntegrityError as e:
                db.session.rollback()
                print(f"❌ Database Integrity Error: {e}")

        return results

    except Exception as e:
        print(f"❌ Error scraping Swiggy Instamart '{product}' for {pincode}: {e}")
        return []

async def scrape_all(product, pincode, synonyms_dict, blacklist_terms,category):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        scrape_timestamp = datetime.now(IST)
        # Create separate contexts for each platform to avoid conflicts
        context_blinkit = await browser.new_context(user_agent=random.choice(USER_AGENTS))
        context_zepto = await browser.new_context(user_agent=random.choice(USER_AGENTS))
        context_swiggy = await browser.new_context(user_agent=random.choice(USER_AGENTS))

        page_blinkit = await context_blinkit.new_page()
        page_zepto = await context_zepto.new_page()
        page_swiggy = await context_swiggy.new_page()
        

        # Set locations separately
        await set_location_blinkit(page_blinkit, pincode)
        await set_location_zepto(page_zepto, pincode)
        await set_location_swiggy(page_swiggy, pincode)

        new_product_id = LiveScrapedProduct.generate_custom_id()

            # Create a new entry in LiveScrapedProduct with the new ID
        product_entry = LiveScrapedProduct(
                    id=new_product_id,
                    name=product,
                    synonyms=synonyms_dict,
                    pincode=pincode,
                    scraped_at=scrape_timestamp,
                    category=category
                )
                
                # Add to the session and commit the changes
        db.session.add(product_entry)
        db.session.commit()

    

        # Run scraping in parallel
        results = []

        blinkit_result = await scrape_blinkit(page_blinkit, product, pincode, synonyms_dict, blacklist_terms,scrape_timestamp,new_product_id,category)
        results.extend(blinkit_result)

        #print(results)

        zepto_result = await scrape_zepto(page_zepto, product, pincode, synonyms_dict, blacklist_terms,scrape_timestamp,new_product_id,category)
        results.extend(zepto_result)
        #print(results)

        swiggy_result = await scrape_swiggy(page_swiggy, product, pincode, synonyms_dict, blacklist_terms,scrape_timestamp,new_product_id,category)
        results.extend(swiggy_result)

        db.session.execute(text("""
            UPDATE live_scraped_products
            SET
                swiggy_product_count = (
                    SELECT COUNT(*)
                    FROM scraped_data sd
                    WHERE sd.platform_id = (SELECT id FROM platforms WHERE name = 'Swiggy')
                    AND CAST(sd.product_id AS VARCHAR) = CAST(live_scraped_products.id AS VARCHAR)
                    AND sd.scraped_at = (
                        SELECT MAX(scraped_at)
                        FROM scraped_data
                        WHERE product_id = sd.product_id
                    )
                    AND sd.pincode = (
                        SELECT pincode
                        FROM scraped_data
                        WHERE product_id = sd.product_id
                        AND scraped_at = (
                            SELECT MAX(scraped_at)
                            FROM scraped_data
                            WHERE product_id = sd.product_id
                        )
                        LIMIT 1
                    )
                ),
                blinkit_product_count = (
                    SELECT COUNT(*)
                    FROM scraped_data sd
                    WHERE sd.platform_id = (SELECT id FROM platforms WHERE name = 'Blinkit')
                    AND CAST(sd.product_id AS VARCHAR) = CAST(live_scraped_products.id AS VARCHAR)
                    AND sd.scraped_at = (
                        SELECT MAX(scraped_at)
                        FROM scraped_data
                        WHERE product_id = sd.product_id
                    )
                    AND sd.pincode = (
                        SELECT pincode
                        FROM scraped_data
                        WHERE product_id = sd.product_id
                        AND scraped_at = (
                            SELECT MAX(scraped_at)
                            FROM scraped_data
                            WHERE product_id = sd.product_id
                        )
                        LIMIT 1
                    )
                ),
                zepto_product_count = (
                    SELECT COUNT(*)
                    FROM scraped_data sd
                    WHERE sd.platform_id = (SELECT id FROM platforms WHERE name = 'Zepto')
                    AND CAST(sd.product_id AS VARCHAR) = CAST(live_scraped_products.id AS VARCHAR)
                    AND sd.scraped_at = (
                        SELECT MAX(scraped_at)
                        FROM scraped_data
                        WHERE product_id = sd.product_id
                    )
                    AND sd.pincode = (
                        SELECT pincode
                        FROM scraped_data
                        WHERE product_id = sd.product_id
                        AND scraped_at = (
                            SELECT MAX(scraped_at)
                            FROM scraped_data
                            WHERE product_id = sd.product_id
                        )
                        LIMIT 1
                    )
                )
        """))

        db.session.commit()

        # Close browser properly
        await browser.close()
        return results

@app.route('/scrape', methods=['POST'])
def scrape():
    """API endpoint to scrape live data based on user input."""
    data = request.json
    product = data.get("product")
    pincode = data.get("pincode")
    category = data.get("category")
    synonyms_dict = data.get("synonyms", {})
    blacklist_terms = data.get("blacklist_terms", [])
    
    final_results = asyncio.run(scrape_all(product, pincode, synonyms_dict, blacklist_terms,category))
    #print(final_results)
    return jsonify(final_results)


@app.route('/live_product_history', methods=['GET'])
def live_product_history():
    """Fetch the list of live products that have been scraped."""
    
    # Query all live scraped products
    live_products = LiveScrapedProduct.query.all()
    
    if not live_products:
        return jsonify({"error": "No live products found"}), 404
    
    # Prepare the list of live products with their details
    product_list = []
    for product in live_products:
        product_list.append({
            "product_id": product.id,  # Custom ID like L1, L2, etc.
            "name": product.name,
            "synonyms": product.synonyms,
            "pincode": product.pincode,
            "scraped_at": product.scraped_at.strftime('%Y-%m-%d %H:%M:%S')  # Format datetime for response
        })
    
    return jsonify(product_list)


@app.route('/scraped_data_for_live_product/<product_id>', methods=['GET'])
def scraped_data_for_live_product(product_id):
    """Fetch scraped data for a selected live product based on product_id."""
    
    # Fetch all scraped data entries related to this live product
    scraped_data_entries = ScrapedData.query.filter_by(product_id=product_id).all()
    
    if not scraped_data_entries:
        return jsonify({"error": "No scraped data found for this product"}), 404
   
  
    # Prepare the scraped data details
    scraped_data_list = []
    for entry in scraped_data_entries:

        quantity, unit = parse_quantity(entry.packaging_size)  
        price_per_kg = round(entry.discounted_price / quantity, 2) if quantity else 0
        discount_percent = round(((entry.original_price - entry.discounted_price) / entry.original_price) * 100, 2) if entry.original_price else 0

        scraped_data_list.append({
            "product_name": entry.scraped_name,
            "product": entry.scraped_name,
            "platform": entry.platform.name, 
            "discounted_price": entry.discounted_price,
            "original_price": entry.original_price,
            "packaging_size": entry.packaging_size,
            "pincode": entry.pincode,
            "scraped_at": entry.scraped_at.strftime('%Y-%m-%d %H:%M:%S'),
            "image_url": entry.image_url,
            "price_per_kg": price_per_kg,
            "unit": unit,
            "discount_percent": discount_percent,
        })
    
    return jsonify(scraped_data_list)

@app.route('/product-popularity-data/<product_id>/<int:product_type>')
def product_popularity_data(product_id, product_type):
    # Querying the product based on product_type
    if product_type == 1:
        product = Product.query.filter_by(id=product_id).first()
    elif product_type == 2:
        product = LiveScrapedProduct.query.filter_by(id=product_id).first()
    else:
        return "Invalid product type", 400  # Bad request if product_type is invalid

    if not product:
        return "Product not found", 404  # Not found if product doesn't exist

    # Get the category for the selected product
    category = product.category

    # Query to get all products in the same category (excluding the selected product) from both tables
    if product_type == 1:
        products_in_category_product = Product.query.filter_by(category=category).all()
        products_in_category_livescrape = LiveScrapedProduct.query.filter_by(category=category).all()
    elif product_type == 2:
        products_in_category_product = Product.query.filter_by(category=category).all()
        products_in_category_livescrape = LiveScrapedProduct.query.filter_by(category=category).all()

    # Prepare data for the selected product
    product_counts = {
        'product_id': product.id,
        'product_name': product.name,
        'swiggy_count': product.swiggy_product_count or 0,
        'blinkit_count': product.blinkit_product_count or 0,
        'zepto_count': product.zepto_product_count or 0,
         'product_category': product.category
    }

    # Prepare counts for other products in the same category from both tables
    other_product_counts = []
    
    # Add products from Product table
    for p in products_in_category_product:
        if p.id != product.id:  # Skip the selected product
            other_product_counts.append({
                'product_id': p.id,
                'product_name': p.name,
                'swiggy_count': p.swiggy_product_count or 0,
                'blinkit_count': p.blinkit_product_count or 0,
                'zepto_count': p.zepto_product_count or 0,
               

            })
    
    # Add products from LiveScrapedProduct table
    for p in products_in_category_livescrape:
        if p.id != product.id:  # Skip the selected product
            other_product_counts.append({
                'product_id': p.id,
                'product_name': p.name,
                'swiggy_count': p.swiggy_product_count or 0,
                'blinkit_count': p.blinkit_product_count or 0,
                'zepto_count': p.zepto_product_count or 0,
            })

    # Return the data as JSON
    return jsonify({
        'selected_product': product_counts,
        'other_products_in_category': other_product_counts
    })


@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()  # This will parse the incoming JSON body
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    user = User.query.filter_by(username=username).first()
    
    if user and bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
        return jsonify({"message": "Login successful", "username": user.username}), 200
    else:
        return jsonify({"error": "Invalid username or password"}), 401

if __name__ == "__main__":
    app.run(debug=True)
