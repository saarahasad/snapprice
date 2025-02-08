from app import app  # Import the Flask app
from models import db, User

import bcrypt

def insert_user(username, password):
    # Hash the password before storing it
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Create new user instance
    new_user = User(username=username, password=hashed_password)

    # Insert into database
    with app.app_context():  # Ensure app context is available for db operations
        try:
            db.session.add(new_user)
            db.session.commit()
            print(f"User {username} created successfully!")
        except Exception as e:
            db.session.rollback()
            print(f"Error inserting user: {e}")

# Example usage:
insert_user('user3', 'password@1')
