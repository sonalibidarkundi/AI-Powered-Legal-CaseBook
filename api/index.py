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

import urllib.parse

# Import Flask app
from app import app


class VercelPathMiddleware:
    """
    WSGI Middleware for Vercel Serverless deployments.
    Restores the exact API route from:
    1. Vercel rewrite query parameter (?path=$1)
    2. Edge headers (HTTP_X_MATCHED_PATH, RAW_URI, REQUEST_URI)
    3. WSGI PATH_INFO normalization
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        qs = environ.get("QUERY_STRING", "")
        params = urllib.parse.parse_qs(qs)

        # 1. Path captured from Vercel rewrite ?path=$1
        if "path" in params:
            subpath = params["path"][0] if params["path"] else ""
            del params["path"]
            environ["QUERY_STRING"] = urllib.parse.urlencode(params, doseq=True)
            if not subpath.startswith("/"):
                subpath = "/" + subpath
            if not subpath.startswith("/api"):
                subpath = "/api" + subpath
            environ["PATH_INFO"] = subpath
        # 2. Edge headers
        elif "HTTP_X_MATCHED_PATH" in environ and environ["HTTP_X_MATCHED_PATH"].startswith("/api") and environ["HTTP_X_MATCHED_PATH"] not in ("/api/index", "/api/index.py"):
            environ["PATH_INFO"] = environ["HTTP_X_MATCHED_PATH"].split("?")[0]
        elif "RAW_URI" in environ and environ["RAW_URI"].startswith("/api"):
            environ["PATH_INFO"] = environ["RAW_URI"].split("?")[0]
        elif "REQUEST_URI" in environ and environ["REQUEST_URI"].startswith("/api"):
            environ["PATH_INFO"] = environ["REQUEST_URI"].split("?")[0]
        # 3. Path prefix normalization
        elif not environ.get("PATH_INFO", "").startswith("/api"):
            p = environ.get("PATH_INFO", "")
            if not p.startswith("/"):
                p = "/" + p
            environ["PATH_INFO"] = f"/api{p}"

        return self.wsgi_app(environ, start_response)


app.wsgi_app = VercelPathMiddleware(app.wsgi_app)

