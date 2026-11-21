from flask import Flask, jsonify,request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from models import db, Platform, Product, ScrapedData,LiveScrapedProduct,User,Pincode
import re
import pytz
from flask_cors import CORS  # ✅ Import CORS
from playwright.async_api import async_playwright
from flask import Flask, request, jsonify
import asyncio
from datetime import datetime
from site_scraper import (
    launch_browser,
    new_context,
    set_location_blinkit as apply_blinkit_location,
    set_location_zepto as apply_zepto_location,
    set_location_swiggy as apply_swiggy_location,
    fetch_blinkit_products,
    fetch_zepto_products,
    fetch_swiggy_products,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy import cast, String
import bcrypt
from sqlalchemy import text
IST = pytz.timezone("Asia/Kolkata")

app = Flask(__name__)
CORS(app)  # ✅ Enable CORS

# ✅ Configure PostgreSQL (Update credentials)
app.config['SQLALCHEMY_DATABASE_URI'] = "postgresql://scraperuser:password@localhost/scraperdb"
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
    """Extract the pack weight in kilograms.

    "2 x 20 g" is 40 g. The count is not treated as a second weight, and a
    bare "1" in "1 pack" is ignored.
    """
    text = (quantity_text or "").lower().replace("×", "x")
    text = re.split(r"\bor\b", text)[0]
    total_grams = 0.0

    counted = re.findall(r"(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g)\b", text)
    weighed = re.findall(r"(\d+(?:\.\d+)?)\s*(kg|g)\s*x\s*(\d+)\b", text)
    text = re.sub(r"(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g)\b", " ", text)
    text = re.sub(r"(\d+(?:\.\d+)?)\s*(kg|g)\s*x\s*(\d+)\b", " ", text)
    plain = re.findall(r"(\d+(?:\.\d+)?)\s*(kg|g)\b", text)

    def grams(amount, unit, count=1):
        weight = float(amount) * (1000 if unit == "kg" else 1)
        return weight * int(count)

    for count, amount, unit in counted:
        total_grams += grams(amount, unit, count)
    for amount, unit, count in weighed:
        total_grams += grams(amount, unit, count)
    for amount, unit in plain:
        total_grams += grams(amount, unit)

    if total_grams <= 0:
        return None, None
    return total_grams / 1000.0, "kg"

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
    if not product_name or not search_query:
        return False

    product_name = product_name.lower().strip()
    search_query = search_query.lower().strip()
    synonyms_dict = synonyms_dict or {}

    # "salt and pepper cashews" should match "Salt & Pepper Cashews".
    # Flavor words stay; filler words do not have to appear in the title.
    stopwords = {
        "and", "&", "n", "of", "the", "with", "a", "for",
        "flavored", "flavoured", "flavour", "flavor", "flavours", "flavors",
    }
    query_terms = [term for term in search_query.split() if term not in stopwords]
    if not query_terms:
        return False

    # Expand synonyms for each term
    expanded_terms = []
    for term in query_terms:
        expanded_terms.append(term)
        if synonyms_dict and term in synonyms_dict:
            expanded_terms.extend(synonyms_dict[term])

    def term_variants(term):
        variants = [term]
        # "almonds" should still match a title that says "Almond".
        if len(term) > 3 and term.endswith("s"):
            variants.append(term[:-1])
        variants.extend(synonyms_dict.get(term, []))
        return variants

    # Ensure all query terms (or their synonyms) appear somewhere in the product name
    if not all(any(variant in product_name for variant in term_variants(term)) for term in query_terms):
        return False  # Reject if any word is missing

    # Check if product name contains any blacklisted terms
    if blacklist_terms and any(term in product_name for term in blacklist_terms):
        return False  # Reject product if it contains blacklisted words

    return True  # Product is relevant

def _image_url(url):
    if url and len(url) > 500:
        return url[:500]
    return url


def _save_product(platform, new_product_id, name, quantity_text, discounted_price, original_price, pincode, scrape_timestamp, image_url, product, category):
    """Persist one scraped row and build the API payload for it."""
    quantity_text = (quantity_text or "").strip().lower()
    image_url = _image_url(image_url)
    original_price = original_price or discounted_price
    entry = ScrapedData(
        product_id=new_product_id,
        platform_id=platform.id,
        scraped_name=name.strip(),
        packaging_size=quantity_text,
        discounted_price=discounted_price,
        original_price=original_price,
        pincode=pincode,
        scraped_at=scrape_timestamp,
        image_url=image_url,
    )
    quantity, unit = parse_quantity(quantity_text)
    price_per_kg = round(discounted_price / quantity, 2) if quantity else 0
    discount_percent = round(((original_price - discounted_price) / original_price) * 100, 2) if original_price else 0
    row = {
        "platform": platform.name,
        "product_name": name.strip(),
        "packaging_size": quantity_text,
        "discounted_price": discounted_price,
        "original_price": original_price,
        "pincode": pincode,
        "image_url": image_url,
        "discount_percent": discount_percent,
        "price_per_kg": price_per_kg,
        "product": product,
        "product_category": category,
        "scraped_at": scrape_timestamp,
        "unit": unit,
        "product_id": new_product_id,
    }
    return entry, row


async def set_location_blinkit(page, pincode):
    """Set the Blinkit location by entering the pincode."""
    await apply_blinkit_location(page, pincode)


async def set_location_swiggy(page, pincode):
    """Set the Swiggy Instamart location by entering the pincode."""
    try:
        await apply_swiggy_location(page, pincode)
    except Exception as e:
        print(f"❌ Error setting Swiggy location for {pincode}: {e}")


async def set_location_zepto(page, pincode):
    """Set the Zepto location by entering the pincode."""
    await apply_zepto_location(page, pincode)

async def scrape_blinkit(page, product, pincode, synonyms_dict, blacklist_terms, scrape_timestamp,new_product_id,category):
    """Scrape Blinkit for the given product and pincode and store it in the database."""
    results = []
    try:
        products = await fetch_blinkit_products(page, product)
        with app.app_context():
            platform = Platform.query.filter_by(name="Blinkit").first()
            if not platform:
                platform = Platform(name="Blinkit", website_url="https://blinkit.com/")
                db.session.add(platform)
                db.session.commit()

            for item in products:
                try:
                    name = item["name"]
                    if not is_relevant_product(name, product, synonyms_dict, blacklist_terms):
                        print(f"Skipping irrelevant product: {name}")
                        continue
                    entry, row = _save_product(
                        platform, new_product_id, name, item["quantity"],
                        item["discounted_price"], item["original_price"],
                        pincode, scrape_timestamp, item["image_url"], product, category,
                    )
                    db.session.add(entry)
                    results.append(row)
                except Exception as e:
                    print(f"Error scraping Blinkit product: {e}")

            db.session.commit()
            print(f"Blinkit data saved for {product} in {pincode}")
        return results
    except Exception as e:
        print(f"Error scraping Blinkit {product} for {pincode}: {e}")
        return []


async def scrape_zepto(page, product, pincode, synonyms_dict,blacklist_terms, scrape_timestamp,new_product_id,category):
    """Scrape Zepto for the given product and pincode and store it in the database."""
    results = []
    try:
        products = await fetch_zepto_products(page, product)
        with app.app_context():
            platform = Platform.query.filter_by(name="Zepto").first()
            if not platform:
                platform = Platform(name="Zepto", website_url="https://www.zepto.com/")
                db.session.add(platform)
                db.session.commit()

            for item in products:
                try:
                    name = item["name"]
                    if not is_relevant_product(name, product, synonyms_dict, blacklist_terms):
                        print(f"Skipping irrelevant product: {name}")
                        continue
                    entry, row = _save_product(
                        platform, new_product_id, name, item["quantity"],
                        item["discounted_price"], item["original_price"],
                        pincode, scrape_timestamp, item["image_url"], product, category,
                    )
                    db.session.add(entry)
                    results.append(row)
                except Exception as e:
                    print(f"Error scraping Zepto product: {e}")

            db.session.commit()
            print(f"Zepto data saved for {product} in {pincode}")
        return results
    except Exception as e:
        print(f"Error scraping Zepto {product} for {pincode}: {e}")
        return []


async def scrape_swiggy(page, product, pincode, synonyms_dict,blacklist_terms, scrape_timestamp,new_product_id,category):
    """Scrape Swiggy Instamart for the given product and pincode and store it in the database."""
    results = []
    try:
        products = await fetch_swiggy_products(page, product)
        with app.app_context():
            platform = Platform.query.filter_by(name="Swiggy").first()
            if not platform:
                platform = Platform(name="Swiggy", website_url="https://www.swiggy.com/instamart")
                db.session.add(platform)
                db.session.commit()

            for item in products:
                try:
                    name = item["name"]
                    if not is_relevant_product(name, product, synonyms_dict, blacklist_terms):
                        print(f"Skipping irrelevant product: {name}")
                        continue
                    entry, row = _save_product(
                        platform, new_product_id, name, item["quantity"],
                        item["discounted_price"], item["original_price"],
                        pincode, scrape_timestamp, item["image_url"], product, category,
                    )
                    db.session.add(entry)
                    results.append(row)
                except Exception as e:
                    print(f"Error processing Swiggy product: {e}")

            try:
                db.session.commit()
                print(f"Swiggy Instamart data saved for {product} in {pincode}")
            except IntegrityError as e:
                db.session.rollback()
                print(f"Database Integrity Error: {e}")
        return results
    except Exception as e:
        print(f"Error scraping Swiggy Instamart '{product}' for {pincode}: {e}")
        return []

def _platform_selected(platforms, *names):
    if not platforms:
        return True
    wanted = {str(name).strip().lower() for name in platforms}
    return any(name.lower() in wanted for name in names)


def _drop_platform_slice(product_id, platform_name, scraped_at):
    platform = Platform.query.filter_by(name=platform_name).first()
    if not platform or scraped_at is None:
        return
    ScrapedData.query.filter(
        ScrapedData.product_id == str(product_id),
        ScrapedData.platform_id == platform.id,
        ScrapedData.scraped_at == scraped_at,
    ).delete(synchronize_session=False)
    db.session.commit()


async def scrape_all(product, pincode, synonyms_dict, blacklist_terms, category, platforms=None, product_id=None):
    async with async_playwright() as playwright:
        browser = await launch_browser(playwright)
        try:
            scrape_timestamp = datetime.now(IST)
            # Separate contexts so one site's cookies cannot leak into another.
            if product_id:
                existing = LiveScrapedProduct.query.get(str(product_id))
                if existing is None:
                    raise ValueError(f"Unknown run {product_id}")
                new_product_id = existing.id
                scrape_timestamp = existing.scraped_at or scrape_timestamp
            else:
                new_product_id = LiveScrapedProduct.generate_custom_id()
                product_entry = LiveScrapedProduct(
                    id=new_product_id,
                    name=product,
                    synonyms=synonyms_dict,
                    pincode=pincode,
                    scraped_at=scrape_timestamp,
                    category=category,
                )
                db.session.add(product_entry)
                db.session.commit()

            results = []

            if _platform_selected(platforms, "Blinkit"):
                context_blinkit = await new_context(browser)
                page_blinkit = await context_blinkit.new_page()
                await set_location_blinkit(page_blinkit, pincode)
                results.extend(await scrape_blinkit(
                    page_blinkit, product, pincode, synonyms_dict, blacklist_terms,
                    scrape_timestamp, new_product_id, category,
                ))

            if _platform_selected(platforms, "Zepto"):
                context_zepto = await new_context(browser)
                page_zepto = await context_zepto.new_page()
                await set_location_zepto(page_zepto, pincode)
                results.extend(await scrape_zepto(
                    page_zepto, product, pincode, synonyms_dict, blacklist_terms,
                    scrape_timestamp, new_product_id, category,
                ))

            # Swiggy's search has to run immediately after its location is confirmed.
            if _platform_selected(platforms, "Instamart", "Swiggy"):
                if product_id:
                    _drop_platform_slice(new_product_id, "Swiggy", scrape_timestamp)
                context_swiggy = await new_context(browser)
                page_swiggy = await context_swiggy.new_page()
                await set_location_swiggy(page_swiggy, pincode)
                results.extend(await scrape_swiggy(
                    page_swiggy, product, pincode, synonyms_dict, blacklist_terms,
                    scrape_timestamp, new_product_id, category,
                ))

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
            return results
        finally:
            await browser.close()


@app.route('/scrape', methods=['POST'])
def scrape():
    """API endpoint to scrape live data based on user input."""
    data = request.json
    product = data.get("product")
    pincode = data.get("pincode")
    category = data.get("category")
    synonyms_dict = data.get("synonyms", {})
    blacklist_terms = data.get("blacklist_terms", [])
    platforms = data.get("platforms")
    product_id = data.get("product_id")

    try:
        final_results = asyncio.run(scrape_all(
            product, pincode, synonyms_dict, blacklist_terms, category, platforms, product_id,
        ))
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404

    print("Executed and Returned.")
    return jsonify(final_results)


@app.route('/live_product_history', methods=['GET'])
def live_product_history():
    """Fetch the list of live products that have been scraped."""
    
    # Query all live scraped products
    live_products = LiveScrapedProduct.query.order_by(LiveScrapedProduct.scraped_at.desc()).all()
    
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
