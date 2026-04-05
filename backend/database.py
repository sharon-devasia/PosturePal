from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Get variables from .env
USER     = os.getenv("user")
PASSWORD = os.getenv("password")
HOST     = os.getenv("host")
PORT     = os.getenv("port")
DBNAME   = os.getenv("dbname")

# Build connection string
DATABASE_URL = (
    f"postgresql+psycopg2://{USER}:{PASSWORD}"
    f"@{HOST}:{PORT}/{DBNAME}?sslmode=require"
)

# Create engine
engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(
    autocommit = False,
    autoflush  = False,
    bind       = engine
)

# Base class for all models
Base = declarative_base()

# Test connection
try:
    with engine.connect() as connection:
        print("Database connected successfully")
except Exception as e:
    print(f"Database connection failed: {e}")

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()