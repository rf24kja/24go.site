"""Stable contact projection shared by list consumers."""
def contact_payload(contact):
    tags = contact.tags or []
    return {
        "id": contact.id,
        "phone": contact.phone,
        "name": contact.name,
        "wa_jid": contact.wa_jid,
        "has_tg": contact.has_tg,
        "has_viber": contact.has_viber,
        "tags": tags,
        "created_at": contact.created_at,
        "country": None,
        "quality_score": None,
        "last_mailing": {"date": contact.last_mailing_at, "platform": None, "message": None} if contact.last_mailing_at else None,
        "platforms": {
            "telegram": {"exists": bool(contact.has_tg), "username": contact.tg_username},
            "vkontakte": {"exists": "has_vk" in tags},
            "whatsapp": {"exists": bool(contact.wa_jid)},
            "viber": {"exists": bool(contact.has_viber)},
        },
    }
