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
    1. Vercel rewrite query parameter (?path=:path* or ?match=:match*)
    2. Edge headers (HTTP_X_MATCHED_PATH, HTTP_X_VERCEL_FORWARDED_FOR_PATH, HTTP_X_FORWARDED_URI, etc.)
    3. WSGI PATH_INFO normalization
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        qs = environ.get("QUERY_STRING", "")
        params = urllib.parse.parse_qs(qs)

        # 1. Path captured from Vercel rewrite ?path=:path* or ?match=:match*
        captured_path = None
        for key in ("path", "match"):
            if key in params:
                raw_val = params[key][0] if params[key] else ""
                # Ignore unexpanded template tokens
                if raw_val != "$1":
                    captured_path = raw_val
                del params[key]
                environ["QUERY_STRING"] = urllib.parse.urlencode(params, doseq=True)
                break

        if captured_path is not None:
            subpath = captured_path.strip()
            if not subpath.startswith("/"):
                subpath = "/" + subpath
            if not subpath.startswith("/api"):
                subpath = "/api" + subpath
            environ["PATH_INFO"] = subpath.rstrip("/") if subpath != "/api" else "/api"
        # 2. Edge headers
        else:
            edge_path = None
            for hdr in (
                "HTTP_X_MATCHED_PATH",
                "HTTP_X_VERCEL_FORWARDED_FOR_PATH",
                "HTTP_X_FORWARDED_URI",
                "HTTP_X_ORIGINAL_URI",
                "RAW_URI",
                "REQUEST_URI",
            ):
                val = environ.get(hdr)
                if val and val.startswith("/api"):
                    cleaned = val.split("?")[0].rstrip("/")
                    if cleaned not in ("/api/index", "/api/index.py"):
                        edge_path = cleaned
                        break

            if edge_path:
                environ["PATH_INFO"] = edge_path
            # 3. Path prefix normalization
            elif not environ.get("PATH_INFO", "").startswith("/api"):
                p = environ.get("PATH_INFO", "").strip()
                if not p.startswith("/"):
                    p = "/" + p
                environ["PATH_INFO"] = f"/api{p}".rstrip("/") if p != "/" else "/api"
            elif environ.get("PATH_INFO") in ("/api/index", "/api/index.py"):
                environ["PATH_INFO"] = "/api"

        return self.wsgi_app(environ, start_response)


app.wsgi_app = VercelPathMiddleware(app.wsgi_app)

