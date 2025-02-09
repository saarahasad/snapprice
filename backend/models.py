from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import pytz
from sqlalchemy.sql import func
from sqlalchemy import func, cast, Integer


db = SQLAlchemy()

class Platform(db.Model):
    __tablename__ = 'platforms'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    website_url = db.Column(db.String(255), nullable=True)

class Product(db.Model):
    __tablename__ = 'products'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False)
    category = db.Column(db.String(100), nullable=True)
    swiggy_product_count = db.Column(db.Integer, nullable=True)
    blinkit_product_count = db.Column(db.Integer, nullable=True)
    zepto_product_count = db.Column(db.Integer, nullable=True)


class LiveScrapedProduct(db.Model):
    __tablename__ = 'live_scraped_products'
    id = db.Column(db.String(10), primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    synonyms = db.Column(db.JSON, nullable=True)  
    pincode = db.Column(db.String(10), nullable=False) 
    scraped_at = db.Column(db.DateTime, default=lambda: datetime.now(IST))  # ✅ Use IST time
    category = db.Column(db.String(100), nullable=True)
    swiggy_product_count = db.Column(db.Integer, nullable=True)
    blinkit_product_count = db.Column(db.Integer, nullable=True)
    zepto_product_count = db.Column(db.Integer, nullable=True)

    def __repr__(self):
        return f"<LiveScrapedProduct(id={self.id}, name={self.name}, scraped_at={self.scraped_at})>"

    @staticmethod
    def generate_custom_id():
        
        # Extract numeric part using SQLAlchemy func.substring
        last_entry = db.session.query(
            func.max(cast(func.substring(LiveScrapedProduct.id, 2), Integer))
        ).scalar()
        
        if last_entry is not None:
            new_id_number = last_entry + 1
        else:
            new_id_number = 1  # Start from L1 if no existing records

        return f"L{new_id_number}"




IST = pytz.timezone("Asia/Kolkata")  # ✅ Define IST timezone

class Pincode(db.Model):  # ✅ New table for pincodes
    __tablename__ = 'pincodes'
    id = db.Column(db.Integer, primary_key=True)
    pincode = db.Column(db.String(10), unique=True, nullable=False)

class ScrapedData(db.Model):
    __tablename__ = 'scraped_data'
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.String(50), nullable=False)
    platform_id = db.Column(db.Integer, db.ForeignKey('platforms.id'), nullable=False)
    scraped_name = db.Column(db.String(255), nullable=True)
    packaging_size = db.Column(db.String(50), nullable=True)
    discounted_price = db.Column(db.Float, nullable=False)
    original_price = db.Column(db.Float, nullable=True)
    pincode = db.Column(db.String(10), nullable=False)  # ✅ Store Pincode
    scraped_at = db.Column(db.DateTime, default=lambda: datetime.now(IST))  # ✅ Use IST
    image_url = db.Column(db.String(500), nullable=True)  # ✅ Store image URL

    platform = db.relationship('Platform', backref=db.backref('scraped_entries', lazy=True))


class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(255), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

    def __repr__(self):
        return f'<User {self.username}>'