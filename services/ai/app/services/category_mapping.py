YOLO_LABEL_TO_LNFTI_CATEGORY = {
    "backpack": "Tas",
    "handbag": "Tas",
    "suitcase": "Tas",
    "laptop": "Elektronik",
    "mouse": "Elektronik",
    "keyboard": "Elektronik",
    "cell phone": "Elektronik",
    "remote": "Elektronik",
    "bottle": "Botol & Wadah",
    "cup": "Botol & Wadah",
    "book": "Dokumen",
    "tie": "Aksesori",
    "umbrella": "Aksesori",
}


def map_yolo_label_to_lnfti_category(label: str) -> str | None:
    return YOLO_LABEL_TO_LNFTI_CATEGORY.get(label.strip().lower())


def choose_top_category(labels_by_confidence: list[str]) -> str | None:
    for label in labels_by_confidence:
        category = map_yolo_label_to_lnfti_category(label)
        if category:
            return category

    return None
