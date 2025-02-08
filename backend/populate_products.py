from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import db, Product
from config import DATABASE_URL

# Connect to the database
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# Product data with categories
products_data = [
    ("Jeera Rice", "Rice"),
    ("Sona Masuri Raw Rice", "Rice"),
    ("Kolam Rice", "Rice"),
    ("Kabuli Chana", "Pulses"),
    ("Green Moong (Whole)", "Pulses"),
    ("White Peas (Matar)", "Pulses"),
    ("Kashmiri Rajma Red (Kidney Beans)", "Pulses"),
    ("Urad Gola (White)", "Pulses"),
    ("Cumin Seeds (Jeera)", "Spices"),
    ("Shah Jeera", "Spices"),
    ("Black Seedless Raisins (Kishmish)", "Dried Fruits"),
    ("Californian Almonds", "Dried Fruits"),
    ("Californian Pistachio Roasted & Salted", "Dried Fruits"),
    ("Cashews Whole", "Dried Fruits"),
    ("Charoli (Chironji)", "Dried Fruits"),
    ("Medjool Dates", "Dates"),
    ("Khalas Dates", "Dates"),
    ("Kimia Dates", "Dates"),
    ("Ajwa Dates", "Dates"),
]

# Insert products into the database
for name, category in products_data:
    existing_product = session.query(Product).filter_by(name=name).first()
    if not existing_product:
        new_product = Product(name=name, category=category)
        session.add(new_product)

# Commit changes
session.commit()
session.close()

print("✅ Products added successfully to the database!")
