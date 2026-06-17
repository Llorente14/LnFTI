import re

YOLO_LABEL_TO_LNFTI_CATEGORY = {
    "backpack": "Tas",
    "handbag": "Tas",
    "suitcase": "Tas",
    "laptop": "Elektronik",
    "mouse": "Elektronik",
    "computer mouse": "Elektronik",
    "wireless mouse": "Elektronik",
    "optical mouse": "Elektronik",
    "gaming mouse": "Elektronik",
    "keyboard": "Elektronik",
    "cell phone": "Elektronik",
    "remote": "Elektronik",
    "bottle": "Botol & Wadah",
    "cup": "Botol & Wadah",
    "book": "Dokumen",
    "tie": "Aksesori",
    "umbrella": "Aksesori",
}


def normalize_yolo_label(label: str) -> str:
    normalized = re.sub(r"[_-]+", " ", label.strip().lower())
    return re.sub(r"\s+", " ", normalized)


def map_yolo_label_to_lnfti_category(label: str) -> str | None:
    return YOLO_LABEL_TO_LNFTI_CATEGORY.get(normalize_yolo_label(label))


def choose_top_category(labels_by_confidence: list[str]) -> str | None:
    for label in labels_by_confidence:
        category = map_yolo_label_to_lnfti_category(label)
        if category:
            return category

    return None
