"""Phone parser — normalize, validate, and enrich phone numbers."""
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contact, User
from app.security import get_current_user

router = APIRouter(prefix="/api/v1/phone-parser", tags=["phone-parser"])

# Common country dial codes — covers 95%+ of contacts
_COUNTRY_CODES = {
    "7": "RU", "1": "US", "20": "EG", "27": "ZA", "30": "GR", "31": "NL",
    "32": "BE", "33": "FR", "34": "ES", "36": "HU", "39": "IT", "40": "RO",
    "41": "CH", "43": "AT", "44": "GB", "45": "DK", "46": "SE", "47": "NO",
    "48": "PL", "49": "DE", "51": "PE", "52": "MX", "53": "CU", "54": "AR",
    "55": "BR", "56": "CL", "57": "CO", "58": "VE", "60": "MY", "61": "AU",
    "62": "ID", "63": "PH", "64": "NZ", "65": "SG", "66": "TH", "81": "JP",
    "82": "KR", "84": "VN", "86": "CN", "90": "TR", "91": "IN", "92": "PK",
    "93": "AF", "94": "LK", "95": "MM", "98": "IR", "212": "MA", "213": "DZ",
    "216": "TN", "218": "LY", "220": "GM", "221": "SN", "222": "MR",
    "223": "ML", "224": "GN", "225": "CI", "226": "BF", "227": "NE",
    "228": "TG", "229": "BJ", "230": "MU", "231": "LR", "232": "SL",
    "233": "GH", "234": "NG", "235": "TD", "236": "CF", "237": "CM",
    "238": "CV", "239": "ST", "240": "GQ", "241": "GA", "242": "CG",
    "243": "CD", "244": "AO", "245": "GW", "246": "IO", "248": "SC",
    "249": "SD", "250": "RW", "251": "ET", "252": "SO", "253": "DJ",
    "254": "KE", "255": "TZ", "256": "UG", "257": "BI", "258": "MZ",
    "260": "ZM", "261": "MG", "262": "RE", "263": "ZW", "264": "NA",
    "265": "MW", "266": "LS", "267": "BW", "268": "SZ", "269": "KM",
    "290": "SH", "291": "ER", "297": "AW", "298": "FO", "299": "GL",
    "350": "GI", "351": "PT", "352": "LU", "353": "IE", "354": "IS",
    "355": "AL", "356": "MT", "357": "CY", "358": "FI", "359": "BG",
    "370": "LT", "371": "LV", "372": "EE", "373": "MD", "374": "AM",
    "375": "BY", "376": "AD", "377": "MC", "378": "SM", "380": "UA",
    "381": "RS", "382": "ME", "383": "XK", "385": "HR", "386": "SI",
    "387": "BA", "389": "MK", "420": "CZ", "421": "SK", "852": "HK",
    "853": "MO", "855": "KH", "856": "LA", "880": "BD", "886": "TW",
    "960": "MV", "961": "LB", "962": "JO", "963": "SY", "964": "IQ",
    "965": "KW", "966": "SA", "967": "YE", "968": "OM", "971": "AE",
    "972": "IL", "973": "BH", "974": "QA", "975": "BT", "976": "MN",
    "977": "NP", "992": "TJ", "993": "TM", "994": "AZ", "995": "GE",
    "996": "KG", "998": "UZ",
}


def _parse_phone(raw: str) -> dict:
    """Parse a phone string into structured data."""
    digits = re.sub(r"[^\d]", "", raw)
    if len(digits) < 7:
        return {"valid": False, "raw": raw, "error": "too_short"}

    # Strip leading +, spaces, dashes already removed by digit extraction
    # Normalize: if raw starts with 00, treat as international
    if raw.strip().startswith("00") and len(digits) > 10:
        digits = digits[2:]  # strip 00 prefix

    # Strip leading 0 for domestic numbers that aren't international
    country_code = None
    national = digits

    for code in sorted(_COUNTRY_CODES.keys(), key=len, reverse=True):
        if digits.startswith(code) and len(digits) > len(code):
            country_code = code
            national = digits[len(code):]
            break

    if country_code is None:
        # Assume local number — can't determine country
        national = digits.lstrip("0") if len(digits) > 10 else digits
        return {
            "valid": True,
            "raw": raw,
            "e164": f"+{digits}",
            "country_code": None,
            "country": None,
            "national": national,
            "formatted": raw.strip(),
        }

    cc = _COUNTRY_CODES.get(country_code, "??")
    formatted = f"+{country_code} {national}"
    e164 = f"+{country_code}{national}"

    return {
        "valid": True,
        "raw": raw,
        "e164": e164,
        "country_code": f"+{country_code}",
        "country": cc,
        "national": national,
        "formatted": formatted,
    }


class ParseRequest(BaseModel):
    phone: str = Field(..., min_length=1, max_length=30)


class ParseBatchRequest(BaseModel):
    phones: list[str] = Field(..., min_length=1, max_length=500)


@router.post("/parse")
async def parse_phone(body: ParseRequest):
    """Parse and normalize a single phone number."""
    return _parse_phone(body.phone)


@router.post("/parse-batch")
async def parse_batch(body: ParseBatchRequest):
    """Parse multiple phone numbers at once."""
    return {"results": [_parse_phone(p) for p in body.phones]}


@router.get("/contacts")
async def list_contacts(
    search: str | None = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List parsed contacts for the tenant."""
    q = select(Contact).where(Contact.tenant_id == current_user.tenant_id)
    if search:
        q = q.where(Contact.phone.ilike(f"%{search}%"))

    from sqlalchemy import func
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    result = await db.execute(
        q.order_by(Contact.created_at.desc()).limit(limit).offset(offset)
    )
    return {"items": result.scalars().all(), "total": total, "limit": limit, "offset": offset}


@router.post("/enrich")
async def enrich_contact(
    body: ParseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Parse phone and upsert into contacts table."""
    parsed = _parse_phone(body.phone)
    if not parsed["valid"]:
        raise HTTPException(400, parsed.get("error", "invalid_phone"))

    # Check existing
    existing = await db.execute(
        select(Contact).where(
            Contact.tenant_id == current_user.tenant_id,
            Contact.phone == parsed["e164"],
        )
    )
    contact = existing.scalar_one_or_none()
    if contact:
        return {"contact": contact, "parsed": parsed, "created": False}

    contact = Contact(
        tenant_id=current_user.tenant_id,
        phone=parsed["e164"],
        metadata_={"country": parsed["country"], "country_code": parsed["country_code"]},
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return {"contact": contact, "parsed": parsed, "created": True}
