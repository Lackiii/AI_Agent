from __future__ import annotations

import base64
import re
import uuid
from pathlib import Path
from typing import Optional


def _decode_image_base64(image_base64: str) -> bytes:
    # Support both raw base64 and data URLs: "data:image/png;base64,...."
    if "base64," in image_base64:
        image_base64 = image_base64.split("base64,", 1)[1]
    image_b64_clean = re.sub(r"\s+", "", image_base64)
    return base64.b64decode(image_b64_clean)


def run_paddle_ocr(image_base64: str) -> str:
    """
    Optional OCR via PaddleOCR.
    If PaddleOCR/PaddlePaddle isn't installed in your backend environment, we return "" (interface still works).
    """
    try:
        from paddleocr import PaddleOCR  # type: ignore
    except Exception:
        return ""

    try:
        tmp_dir = Path(__file__).resolve().parents[2] / "backend_data" / "ocr_tmp"
        tmp_dir.mkdir(parents=True, exist_ok=True)

        tmp_id = str(uuid.uuid4())
        tmp_path = tmp_dir / f"{tmp_id}.png"

        img_bytes = _decode_image_base64(image_base64)
        tmp_path.write_bytes(img_bytes)

        ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        result = ocr.ocr(str(tmp_path), cls=True)

        # result: List[ [ [box, (text, conf)], ... ] ]
        lines: list[str] = []
        if result and isinstance(result, list):
            for group in result:
                if not isinstance(group, list):
                    continue
                for item in group:
                    # item: [box, (text, conf)]
                    if isinstance(item, (list, tuple)) and len(item) >= 2:
                        text_val = item[1][0] if isinstance(item[1], (list, tuple)) and item[1] else None
                        if text_val:
                            lines.append(str(text_val))

        return "\n".join(lines).strip()
    except Exception:
        return ""

