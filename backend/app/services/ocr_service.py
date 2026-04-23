from __future__ import annotations

import base64
import importlib.util
import os
import re
import uuid
from pathlib import Path
from typing import Optional

# Paddle CPU backend compatibility:
# Some paddlepaddle builds hit PIR/OneDNN runtime errors on certain ops.
# These flags are read at import/runtime; set them as early as possible.
os.environ["FLAGS_use_mkldnn"] = "0"
os.environ["FLAGS_enable_mkldnn"] = "0"
os.environ["FLAGS_enable_onednn"] = "0"
os.environ["FLAGS_enable_pir_api"] = "0"
os.environ["PADDLE_PIR_MODE"] = "0"
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"


def _patch_analysis_config_compat() -> None:
    """
    Compatibility shim for paddle builds that don't expose
    AnalysisConfig.set_optimization_level().
    """
    try:
        from paddle.base import libpaddle  # type: ignore

        config_cls = getattr(libpaddle, "AnalysisConfig", None)
        if config_cls and not hasattr(config_cls, "set_optimization_level"):
            setattr(config_cls, "set_optimization_level", lambda self, *_args, **_kwargs: None)
    except Exception:
        # Best effort patch; OCR flow will still report concrete errors later.
        pass


def _decode_image_base64(image_base64: str) -> bytes:
    # Support both raw base64 and data URLs: "data:image/png;base64,...."
    if "base64," in image_base64:
        image_base64 = image_base64.split("base64,", 1)[1]
    image_b64_clean = re.sub(r"\s+", "", image_base64)
    return base64.b64decode(image_b64_clean)


def _ocr_force_disabled() -> bool:
    return os.getenv("DISABLE_PADDLEOCR", "").strip().lower() in {"1", "true", "yes", "on"}


def get_ocr_engine_status() -> dict:
    if _ocr_force_disabled():
        return {"available": False, "engine": "PaddleOCR", "error": "disabled by DISABLE_PADDLEOCR"}
    has_paddleocr = importlib.util.find_spec("paddleocr") is not None
    has_paddle = importlib.util.find_spec("paddle") is not None
    if has_paddleocr and has_paddle:
        return {"available": True, "engine": "PaddleOCR"}
    missing = []
    if not has_paddleocr:
        missing.append("paddleocr")
    if not has_paddle:
        missing.append("paddlepaddle")
    return {"available": False, "engine": "PaddleOCR", "error": f"missing package: {', '.join(missing)}"}


def run_paddle_ocr(image_base64: str) -> dict:
    """
    Optional OCR via PaddleOCR.
    If PaddleOCR/PaddlePaddle isn't installed in your backend environment, we return "" (interface still works).
    """
    if _ocr_force_disabled():
        return {"text": "", "status": "engine_unavailable", "error": "PaddleOCR disabled by environment"}
    try:
        _patch_analysis_config_compat()
        from paddleocr import PaddleOCR  # type: ignore
    except Exception:
        return {"text": "", "status": "engine_unavailable", "error": "PaddleOCR not installed"}

    try:
        tmp_dir = Path(__file__).resolve().parents[2] / "backend_data" / "ocr_tmp"
        tmp_dir.mkdir(parents=True, exist_ok=True)

        tmp_id = str(uuid.uuid4())
        tmp_path = tmp_dir / f"{tmp_id}.png"

        img_bytes = _decode_image_base64(image_base64)
        tmp_path.write_bytes(img_bytes)

        # PaddleOCR init args differ across versions.
        # Some versions don't accept `show_log`.
        try:
            ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        except Exception as e:
            # Some PaddleOCR versions raise non-TypeError for unknown kwargs.
            msg = str(e)
            if "Unknown argument" in msg or "show_log" in msg or "unexpected keyword argument" in msg:
                ocr = PaddleOCR(use_angle_cls=True, lang="ch")
            else:
                raise
        # Some PaddleOCR versions don't accept `cls` in ocr().
        try:
            result = ocr.ocr(str(tmp_path), cls=True)
        except Exception as e:
            msg = str(e)
            if "cls" in msg and ("unexpected keyword argument" in msg or "got an unexpected keyword argument" in msg):
                result = ocr.ocr(str(tmp_path))
            else:
                raise

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

        text = "\n".join(lines).strip()
        if text:
            return {"text": text, "status": "ok"}
        return {"text": "", "status": "no_text"}
    except Exception as e:
        err = str(e)
        if "ConvertPirAttribute2RuntimeAttribute" in err:
            return {
                "text": "",
                "status": "ocr_error",
                "error": "Paddle 运行时不兼容（PIR/OneDNN）。请安装 paddlepaddle==2.6.2 并重启后端。",
            }
        return {"text": "", "status": "ocr_error", "error": err}

