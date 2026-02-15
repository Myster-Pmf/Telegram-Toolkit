import sqlite3
import os
from pathlib import Path

# Adjust path based on config or common location
db_path = Path("data/telegram_toolkit.db")

if db_path.exists():
    print(f"Connecting to {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check users table
    cursor.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    if "is_pinned" not in columns:
        print("Adding is_pinned to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_pinned BOOLEAN DEFAULT 0")
    else:
        print("is_pinned already exists in users table")
        
    # Check user_profiles table
    cursor.execute("PRAGMA table_info(user_profiles)")
    columns = [row[1] for row in cursor.fetchall()]
    if "is_pinned" not in columns:
        print("Adding is_pinned to user_profiles table...")
        cursor.execute("ALTER TABLE user_profiles ADD COLUMN is_pinned BOOLEAN DEFAULT 0")
    else:
        print("is_pinned already exists in user_profiles table")
        
    conn.commit()
    conn.close()
    print("Migration complete!")
else:
    print(f"Error: Database not found at {db_path}")
