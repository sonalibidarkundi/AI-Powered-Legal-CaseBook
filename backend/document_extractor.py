"""
Legal CaseBook - Document Text Extractor (document_extractor.py)
-----------------------------------------------------------------
Provides robust, secure text extraction and content validation for legal filings:
- PDF (via PyMuPDF / fitz, preserving page markers [Page X])
- Word DOCX (via python-docx, extracting paragraphs and structured tables)
- TXT (via safe multi-encoding decoding: UTF-8, latin-1, cp1252)

Security & Integrity:
- Validates magic bytes / binary headers to prevent disguised executables.
- Validates file size (max 16MB) and detects zero-byte files.
- Scanned PDF Detection: if extracted text contains fewer than 50 characters,
  flags that OCR is required rather than dispatching empty text to Grok AI.
- Length bounding: truncates safely at 100,000 characters with an audit note.
"""

import os
import re
from typing import Dict, Any, Tuple

# Supported file limits
MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024  # 16 MB
MAX_EXTRACTED_CHARS = 100000  # ~25,000 words
MIN_EXTRACTED_CHARS = 40  # Minimum substantive characters


class DocumentExtractionError(Exception):
    """Base error for document processing failures."""
    def __init__(self, message: str, code: str = "EXTRACTION_FAILED"):
        super().__init__(message)
        self.code = code


class ScannedDocumentError(DocumentExtractionError):
    """Raised when a PDF contains only scanned imagery with insufficient extractable text."""
    def __init__(self, message: str = "Scanned or image-only PDF detected. Insufficient text extracted. OCR processing is required to read this document."):
        super().__init__(message, code="OCR_REQUIRED")


class UnsupportedFileTypeError(DocumentExtractionError):
    """Raised when file extension or magic bytes do not match supported types."""
    def __init__(self, message: str):
        super().__init__(message, code="UNSUPPORTED_FILE_TYPE")


class FileSizeLimitExceededError(DocumentExtractionError):
    """Raised when uploaded file exceeds maximum permitted size."""
    def __init__(self, message: str = "Uploaded file exceeds maximum permitted size of 16 MB."):
        super().__init__(message, code="FILE_TOO_LARGE")


def validate_file_header(file_path: str, ext: str) -> None:
    """
    Validates magic bytes against file extension to block disguised executables.
    Complies with ISO 32000-1 for PDF detection (allowing %PDF anywhere within the
    first 1024 bytes to accommodate UTF-8 BOM, scanner preambles, and PyMuPDF readers).
    """
    if not os.path.exists(file_path):
        raise DocumentExtractionError("Document file does not exist on storage.", code="FILE_NOT_FOUND")

    file_size = os.path.getsize(file_path)
    if file_size == 0:
        raise DocumentExtractionError("Document is empty (0 bytes).", code="EMPTY_FILE")
    if file_size > MAX_FILE_SIZE_BYTES:
        raise FileSizeLimitExceededError()

    with open(file_path, "rb") as f:
        header = f.read(1024)

    # Security check: always block PE/ELF executables regardless of extension
    if header.startswith(b"MZ") or header.startswith(b"\x7fELF"):
        raise UnsupportedFileTypeError("Executable binaries disguised as legal documents are strictly prohibited.")

    ext = ext.lower().strip()
    if ext == ".pdf":
        # 1. Standard check: %PDF signature anywhere in the first 1024 bytes (per PDF 1.7 / ISO 32000-1)
        is_pdf = b"%PDF" in header

        # 2. PyMuPDF engine verification: if fitz can open it, it is a valid PDF
        if not is_pdf:
            try:
                import fitz
                test_doc = fitz.open(file_path)
                if len(test_doc) > 0:
                    is_pdf = True
                test_doc.close()
            except Exception:
                is_pdf = False

        # 3. Graceful text detection: if user saved/named a plain text or markdown legal filing as .pdf
        if not is_pdf:
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as tf:
                    sample = tf.read(2048)
                if "\x00" not in sample and len(sample.strip()) >= MIN_EXTRACTED_CHARS:
                    # Valid text content saved as .pdf - allow through
                    return
            except Exception:
                pass

            raise UnsupportedFileTypeError(
                "File has a .pdf extension but lacks a valid PDF header (%PDF). "
                "Please ensure the file is an authentic PDF, or save and upload it as a Plain Text (.txt) or Word (.docx) document."
            )

    elif ext == ".docx":
        # Standard ZIP container magic bytes: PK\x03\x04
        if not header.startswith(b"PK\x03\x04"):
            raise UnsupportedFileTypeError("File has a .docx extension but is not a valid Word document archive.")
    elif ext == ".txt":
        # Check that it is not a binary PE/ELF executable
        if header.startswith(b"MZ") or header.startswith(b"\x7fELF"):
            raise UnsupportedFileTypeError("Executable binaries disguised as text files are strictly prohibited.")


def extract_from_pdf(file_path: str) -> Tuple[str, int]:
    """
    Extracts text page-by-page from a PDF using PyMuPDF (fitz), preserving page markers.
    Detects scanned image-only documents.
    Provides graceful fallback to text reader if file contains raw text.
    """
    import fitz  # PyMuPDF

    doc = None
    try:
        doc = fitz.open(file_path)
        total_pages = len(doc)
        if total_pages == 0:
            raise DocumentExtractionError("PDF contains no pages.", code="EMPTY_DOCUMENT")

        extracted_pages = []
        total_text_chars = 0

        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_text = page.get_text("text").strip()
            if page_text:
                total_text_chars += len(page_text)
                extracted_pages.append(f"--- [Page {page_idx + 1}] ---\n{page_text}")
            else:
                extracted_pages.append(f"--- [Page {page_idx + 1}] ---\n[No extractable text on this page]")

        combined_text = "\n\n".join(extracted_pages)

        # Scanned document detection: check substantive characters
        substantive_text = re.sub(r'\[Page \d+\]|---|\s+', '', combined_text)
        if len(substantive_text) < MIN_EXTRACTED_CHARS:
            raise ScannedDocumentError(
                "Scanned or image-only PDF detected. Insufficient text extracted. "
                "OCR processing is required to read this document."
            )

        return combined_text, total_pages
    except fitz.FileDataError:
        # Graceful fallback: If it's a plain text document saved with a .pdf extension
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as tf:
                txt_content = tf.read()
            if "\x00" not in txt_content and len(txt_content.strip()) >= MIN_EXTRACTED_CHARS:
                return txt_content.strip(), 1
        except Exception:
            pass
        raise DocumentExtractionError("Corrupt or password-protected PDF document.", code="CORRUPT_DOCUMENT")
    except ScannedDocumentError:
        raise
    except Exception as exc:
        # Graceful fallback: If it's a plain text document saved with a .pdf extension
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as tf:
                txt_content = tf.read()
            if "\x00" not in txt_content and len(txt_content.strip()) >= MIN_EXTRACTED_CHARS:
                return txt_content.strip(), 1
        except Exception:
            pass
        raise DocumentExtractionError(f"Error parsing PDF: {str(exc)}", code="EXTRACTION_FAILED")
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass


def extract_from_docx(file_path: str) -> Tuple[str, int]:
    """
    Extracts text from a DOCX file using python-docx.
    Extracts body paragraphs and structured table cells.
    """
    import docx

    try:
        doc = docx.Document(file_path)
        parts = []

        # 1. Paragraphs
        for p in doc.paragraphs:
            text = p.text.strip()
            if text:
                parts.append(text)

        # 2. Tables
        for table in doc.tables:
            table_rows = []
            for row in table.rows:
                row_cells = [cell.text.strip() for cell in row.cells]
                if any(row_cells):
                    table_rows.append(" | ".join(row_cells))
            if table_rows:
                parts.append("\n[Document Table]\n" + "\n".join(table_rows))

        combined_text = "\n\n".join(parts)
        if len(combined_text.strip()) < MIN_EXTRACTED_CHARS:
            raise DocumentExtractionError("DOCX file contains insufficient text for analysis.", code="EMPTY_DOCUMENT")

        return combined_text, 1
    except DocumentExtractionError:
        raise
    except Exception as exc:
        raise DocumentExtractionError(f"Error parsing Word document: {str(exc)}", code="EXTRACTION_FAILED")


def extract_from_txt(file_path: str) -> Tuple[str, int]:
    """
    Safely reads text file with multi-encoding fallback.
    """
    encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
    content = None

    for enc in encodings:
        try:
            with open(file_path, "r", encoding=enc) as f:
                content = f.read()
            break
        except (UnicodeDecodeError, UnicodeError):
            continue

    if content is None:
        raise DocumentExtractionError("Failed to decode text file with standard encodings.", code="DECODING_ERROR")

    clean_content = content.strip()
    if len(clean_content) < MIN_EXTRACTED_CHARS:
        raise DocumentExtractionError("Text document contains insufficient substantive content.", code="EMPTY_DOCUMENT")

    return clean_content, 1


def extract_document_text(file_path: str, original_filename: str) -> Dict[str, Any]:
    """
    Primary extraction entry point.
    Validates file integrity, selects extractor by extension, bounds text length.
    """
    _, ext = os.path.splitext(original_filename.lower())
    if ext not in [".pdf", ".docx", ".txt"]:
        raise UnsupportedFileTypeError(
            f"Unsupported document format '{ext}'. Only PDF (.pdf), Word (.docx), and Plain Text (.txt) files are supported."
        )

    # 1. Validate binary header
    validate_file_header(file_path, ext)

    # 2. Extract text according to format
    if ext == ".pdf":
        text, pages = extract_from_pdf(file_path)
    elif ext == ".docx":
        text, pages = extract_from_docx(file_path)
    elif ext == ".txt":
        text, pages = extract_from_txt(file_path)
    else:
        raise UnsupportedFileTypeError(f"Unsupported document extension: {ext}")

    # 3. Apply maximum text length bounds
    was_truncated = False
    if len(text) > MAX_EXTRACTED_CHARS:
        text = text[:MAX_EXTRACTED_CHARS] + "\n\n[Document truncated at 100,000 characters for legal analysis window]"
        was_truncated = True

    return {
        "text": text,
        "page_count": pages,
        "char_count": len(text),
        "file_type": ext.replace(".", "").upper(),
        "is_truncated": was_truncated
    }
