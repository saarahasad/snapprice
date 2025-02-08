from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import db, Pincode  # Import the Pincode model
from config import DATABASE_URL

# Connect to the database
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

# List of pincodes to insert
pincode_data = ["560001", "560025", "560032", "560064", "560012"]

# Insert pincodes into the database
for pincode in pincode_data:
    existing_pincode = session.query(Pincode).filter_by(pincode=pincode).first()
    if not existing_pincode:
        new_pincode = Pincode(pincode=pincode)
        session.add(new_pincode)
        print(f"✅ Added new pincode: {pincode}")
    else:
        print(f"⚠️ Pincode already exists: {pincode}")

# Commit changes
session.commit()
session.close()

print("✅ Pincodes insertion completed!")
