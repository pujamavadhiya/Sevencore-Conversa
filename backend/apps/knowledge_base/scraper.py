import re
import urllib.parse
from typing import Dict, Any
import requests
from bs4 import BeautifulSoup

def clean_extracted_text(text: str) -> str:
    """Collapses whitespace while preserving paragraph breaks."""
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    cleaned = "\n".join(chunk for chunk in chunks if chunk)
    # Remove excessive blank lines
    return re.sub(r'\n{3,}', '\n\n', cleaned)

def scrape_website_url(url: str, timeout_seconds: int = 15) -> Dict[str, Any]:
    """
    Fetches a webpage and extracts clean, readable text content suitable for LLM grounding.
    Strips scripts, styles, navigations, headers, and footers.
    """
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = f"https://{clean_url}"

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    }

    try:
        response = requests.get(clean_url, headers=headers, timeout=timeout_seconds, allow_redirects=True)
        response.raise_for_status()
    except Exception as e:
        raise ValueError(f"Unable to fetch URL {clean_url}: {str(e)}")

    content_type = response.headers.get("Content-Type", "").lower()
    if "text/html" not in content_type and "application/xhtml" not in content_type:
        # Fallback for plain text or markdown directly hosted
        raw_text = response.text[:20000]
        parsed_title = urllib.parse.urlparse(clean_url).netloc
        words = len(raw_text.split())
        return {
            "title": f"Site: {parsed_title}",
            "url": clean_url,
            "text": raw_text,
            "word_count": words,
            "char_count": len(raw_text),
            "summary": raw_text[:350],
        }

    soup = BeautifulSoup(response.text, "html.parser")

    # Extract page title
    title = ""
    if soup.title and soup.title.string:
        title = soup.title.string.strip()
    if not title:
        h1 = soup.find("h1")
        if h1:
            title = h1.get_text(strip=True)
    if not title:
        title = urllib.parse.urlparse(clean_url).netloc

    # Remove non-content elements
    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe", "svg", "form", "button"]):
        tag.decompose()

    # Find main article or body
    main_node = soup.find("main") or soup.find("article") or soup.find("body") or soup
    raw_text = clean_extracted_text(main_node.get_text(separator="\n"))

    # Cap text length for safe context handling (up to 25,000 chars)
    if len(raw_text) > 25000:
        raw_text = raw_text[:25000] + "\n...[Content truncated for length]"

    words = len(raw_text.split())
    if words < 10:
        raise ValueError(f"Page at {clean_url} returned insufficient text content ({words} words).")

    summary_preview = raw_text[:300].replace("\n", " ").strip()

    return {
        "title": title[:200],
        "url": clean_url,
        "text": raw_text,
        "word_count": words,
        "char_count": len(raw_text),
        "summary": summary_preview,
    }
