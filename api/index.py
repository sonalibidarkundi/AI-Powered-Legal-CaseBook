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


class VercelPathMiddleware:
    """
    WSGI Middleware for Vercel Serverless deployments.
    When Vercel rewrites /api/(.*) to /api/index, WSGI PATH_INFO may be overwritten
    with '/api/index' or '/'. This middleware restores the true requested path
    (e.g., '/api/auth/register') from Vercel's edge headers.
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = environ.get("HTTP_X_MATCHED_PATH")
        if matched_path and matched_path.startswith("/api") and matched_path not in ("/api/index", "/api/index.py"):
            environ["PATH_INFO"] = matched_path.split("?")[0]
        elif "RAW_URI" in environ and environ["RAW_URI"].startswith("/api"):
            environ["PATH_INFO"] = environ["RAW_URI"].split("?")[0]
        elif "REQUEST_URI" in environ and environ["REQUEST_URI"].startswith("/api"):
            environ["PATH_INFO"] = environ["REQUEST_URI"].split("?")[0]
        elif not environ.get("PATH_INFO", "").startswith("/api"):
            p = environ.get("PATH_INFO", "")
            if not p.startswith("/"):
                p = "/" + p
            environ["PATH_INFO"] = f"/api{p}"

        return self.wsgi_app(environ, start_response)


app.wsgi_app = VercelPathMiddleware(app.wsgi_app)
