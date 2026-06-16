from app.services.category_mapping import (
    choose_top_category,
    map_yolo_label_to_lnfti_category,
    normalize_yolo_label,
)


def test_mouse_maps_to_electronics() -> None:
    assert map_yolo_label_to_lnfti_category("mouse") == "Elektronik"


def test_mouse_aliases_are_normalized() -> None:
    aliases = [
        "Computer Mouse",
        "wireless_mouse",
        "optical-mouse",
        "  gaming   mouse  ",
    ]

    for label in aliases:
        assert map_yolo_label_to_lnfti_category(label) == "Elektronik"


def test_label_normalization_collapses_case_separators_and_whitespace() -> None:
    assert normalize_yolo_label("  WIRELESS_mouse  ") == "wireless mouse"
    assert normalize_yolo_label("cell-phone") == "cell phone"


def test_top_category_uses_first_mapped_detection_by_confidence_order() -> None:
    assert choose_top_category(["person", "wireless mouse", "backpack"]) == "Elektronik"
    assert choose_top_category(["person", "backpack", "mouse"]) == "Tas"


def test_unknown_detection_has_no_category_suggestion() -> None:
    assert map_yolo_label_to_lnfti_category("person") is None
    assert choose_top_category(["person", "chair"]) is None
