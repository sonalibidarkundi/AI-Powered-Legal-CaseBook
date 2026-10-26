"""
api/index.py
Serverless entrypoint for Vercel deployment of Legal CaseBook.
"""

import os
import sys

# Add backend directory and project root to Python search path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# Set Vercel environment flag
os.environ["VERCEL"] = "1"

# Import Flask app
from app import app
