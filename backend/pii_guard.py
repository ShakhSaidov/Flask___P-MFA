import re
from typing import Dict, Tuple

EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")

# Finnish personal identity code (henkilotunnus): DDMMYY + century marker (+, -, A-F, U-Y) + 3 digits + checksum
FINNISH_HETU_RE = re.compile(
    r"\b\d{6}[+\-A-FU-Y]\d{3}[0-9A-FHJ-NPR-Y]\b",
    re.IGNORECASE,
)

# Matches international (+358...), spaced/hyphenated Finnish (040 123 4567, 09-1234567),
# or compact Finnish mobile/landline numbers (0401234567, 091234567) without crossing newlines.
PHONE_RE = re.compile(
    r"(?<!\w)(?:"
    r"\+\d[\d \t\-()]{6,}\d"
    r"|0\d{1,2}[ \t\-]\d[\d \t\-]{4,}\d"
    r"|0[1-9]\d{6,9}"
    r")(?!\w)"
)

YEAR_RANGE_RE = re.compile(r"^(?:19|20)\d{2}\-(?:19|20)\d{2}$")
HYPHEN_DATE_RE = re.compile(
    r"^(?:\d{1,2}-\d{1,2}-(?:19|20)\d{2}|(?:19|20)\d{2}-\d{1,2}-\d{1,2})$"
)


def mask_pii(text: str) -> Tuple[str, Dict[str, int]]:
    """Best-effort masking of obvious identifiers before model processing (not anonymisation)."""
    if not text:
        return "", {"total": 0, "emails": 0, "finnish_ids": 0, "phones": 0}

    cleaned, email_count = EMAIL_RE.subn("[EMAIL_REDACTED]", text)
    cleaned, hetu_count = FINNISH_HETU_RE.subn("[FINNISH_ID_REDACTED]", cleaned)

    phone_count = 0

    def _replace_phone(match: re.Match) -> str:
        nonlocal phone_count
        raw = match.group(0).strip()
        if YEAR_RANGE_RE.match(raw) or HYPHEN_DATE_RE.match(raw):
            return raw
        digits_only = re.sub(r"\D", "", raw)
        if len(digits_only) >= 7:
            phone_count += 1
            return "[PHONE_REDACTED]"
        return raw

    cleaned = PHONE_RE.sub(_replace_phone, cleaned)

    summary = {
        "total": email_count + hetu_count + phone_count,
        "emails": email_count,
        "finnish_ids": hetu_count,
        "phones": phone_count,
    }
    return cleaned, summary
