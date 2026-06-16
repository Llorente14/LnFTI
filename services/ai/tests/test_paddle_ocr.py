from io import BytesIO

from PIL import Image

from app.core.config import Settings
from app.services.image_validation import ValidatedImage
from app.services.paddle_ocr import PaddleOcrTextExtractor, normalize_ocr_results


def make_validated_image() -> ValidatedImage:
    output = BytesIO()
    Image.new("RGB", (12, 8), color=(107, 18, 32)).save(output, format="JPEG")
    content = output.getvalue()
    return ValidatedImage(
        content=content,
        media_type="image/jpeg",
        format="JPEG",
        width=12,
        height=8,
        size_bytes=len(content),
    )


def test_normalization_filters_low_confidence_and_empty_lines() -> None:
    lines, full_text, average_confidence, truncated = normalize_ocr_results(
        [{"rec_texts": [" LOGITECH ", "   ", "M331", "weak"], "rec_scores": [0.96244, 0.99, 0.91864, 0.49]}],
        min_confidence=0.50,
        max_lines=30,
        max_text_chars=2000,
    )
    assert [line.text for line in lines] == ["LOGITECH", "M331"]
    assert [line.confidence for line in lines] == [0.9624, 0.9186]
    assert full_text == "LOGITECH\nM331"
    assert average_confidence == 0.9405
    assert truncated is False


def test_normalization_collapses_internal_whitespace() -> None:
    lines, full_text, _, _ = normalize_ocr_results(
        [{"rec_texts": ["  hello\t   world  "], "rec_scores": [0.75]}],
        min_confidence=0.50,
        max_lines=30,
        max_text_chars=2000,
    )
    assert lines[0].text == "hello world"
    assert full_text == "hello world"


def test_normalization_ignores_non_finite_confidence() -> None:
    lines, full_text, average_confidence, _ = normalize_ocr_results(
        [{"rec_texts": ["bad", "good"], "rec_scores": [float("nan"), 0.88]}],
        min_confidence=0.50,
        max_lines=30,
        max_text_chars=2000,
    )
    assert [line.text for line in lines] == ["good"]
    assert full_text == "good"
    assert average_confidence == 0.88


def test_non_string_text_values_are_ignored() -> None:
    lines, full_text, average_confidence, truncated = normalize_ocr_results(
        [{"rec_texts": [None, 123, " VALID "], "rec_scores": [0.99, 0.98, 0.97]}],
        min_confidence=0.50,
        max_lines=30,
        max_text_chars=2000,
    )
    assert [line.text for line in lines] == ["VALID"]
    assert full_text == "VALID"
    assert average_confidence == 0.97
    assert truncated is False


def test_no_recognized_text_normalizes_to_empty_result() -> None:
    lines, full_text, average_confidence, truncated = normalize_ocr_results(
        [{"rec_texts": [], "rec_scores": []}],
        min_confidence=0.50,
        max_lines=30,
        max_text_chars=2000,
    )
    assert lines == []
    assert full_text == ""
    assert average_confidence is None
    assert truncated is False


def test_empty_result_collection_normalizes_to_empty_result() -> None:
    lines, full_text, average_confidence, truncated = normalize_ocr_results(
        [],
        min_confidence=0.50,
        max_lines=30,
        max_text_chars=2000,
    )
    assert lines == []
    assert full_text == ""
    assert average_confidence is None
    assert truncated is False


def test_malformed_result_missing_fields_is_rejected() -> None:
    try:
        normalize_ocr_results(
            [{"unexpected": []}],
            min_confidence=0.50,
            max_lines=30,
            max_text_chars=2000,
        )
    except ValueError as exc:
        assert "recognition fields" in str(exc)
    else:
        raise AssertionError("Malformed OCR result should be rejected.")


def test_maximum_line_count_is_enforced() -> None:
    lines, full_text, average_confidence, truncated = normalize_ocr_results(
        [{"rec_texts": ["one", "two", "three"], "rec_scores": [0.9, 0.8, 0.7]}],
        min_confidence=0.50,
        max_lines=2,
        max_text_chars=2000,
    )
    assert [line.text for line in lines] == ["one", "two"]
    assert full_text == "one\ntwo"
    assert average_confidence == 0.85
    assert truncated is True


def test_maximum_text_length_is_enforced() -> None:
    lines, full_text, average_confidence, truncated = normalize_ocr_results(
        [{"rec_texts": ["alpha", "bravo", "charlie"], "rec_scores": [0.9, 0.8, 0.7]}],
        min_confidence=0.50,
        max_lines=30,
        max_text_chars=9,
    )
    assert [line.text for line in lines] == ["alpha", "bra"]
    assert full_text == "alpha\nbra"
    assert average_confidence == 0.85
    assert truncated is True


def test_result_object_json_payload_is_supported() -> None:
    class FakeResult:
        json = {"res": {"rec_texts": ["LOGITECH"], "rec_scores": [0.96]}}

    lines, full_text, average_confidence, truncated = normalize_ocr_results(
        [FakeResult()],
        min_confidence=0.50,
        max_lines=30,
        max_text_chars=2000,
    )
    assert lines[0].text == "LOGITECH"
    assert full_text == "LOGITECH"
    assert average_confidence == 0.96
    assert truncated is False


def test_pipeline_construction_uses_lightweight_disabled_modules() -> None:
    calls: list[dict] = []

    class FakePipeline:
        def predict(self, image):
            return [{"rec_texts": ["LOGITECH"], "rec_scores": [0.96]}]

    def fake_factory(**kwargs):
        calls.append(kwargs)
        return FakePipeline()

    extractor = PaddleOcrTextExtractor(Settings(), pipeline_factory=fake_factory)
    result = extractor.extract(make_validated_image())

    assert result.full_text == "LOGITECH"
    assert calls == [
        {
            "lang": "en",
            "device": "cpu",
            "text_detection_model_name": "PP-OCRv5_mobile_det",
            "text_recognition_model_name": "PP-OCRv5_mobile_rec",
            "use_doc_orientation_classify": False,
            "use_doc_unwarping": False,
            "use_textline_orientation": False,
        },
    ]
