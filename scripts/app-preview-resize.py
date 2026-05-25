#!/usr/bin/env python3

from PIL import Image
import argparse
import re
import sys
from pathlib import Path

TARGET_WIDTH = 1242
TARGET_HEIGHT = 2688
DEFAULT_INPUT_DIR = Path("assets/app_preview_sources")
DEFAULT_OUTPUT_DIR = Path("assets/app_preview")
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg"}


def resize_exact(img):
    return img.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)


def resize_fit_crop(img):
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    target_ratio = TARGET_WIDTH / TARGET_HEIGHT

    if src_ratio > target_ratio:
        # image too wide → fit height, crop width
        new_h = TARGET_HEIGHT
        new_w = int(new_h * src_ratio)
    else:
        # image too tall → fit width, crop height
        new_w = TARGET_WIDTH
        new_h = int(new_w / src_ratio)

    img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    left = (new_w - TARGET_WIDTH) // 2
    top = (new_h - TARGET_HEIGHT) // 2
    right = left + TARGET_WIDTH
    bottom = top + TARGET_HEIGHT

    return img.crop((left, top, right, bottom))


def process_image(input_path, output_path, mode):
    img = Image.open(input_path)

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    if mode == "exact":
        out = resize_exact(img)
    else:
        out = resize_fit_crop(img)

    out.save(output_path, quality=95)
    print(f"Saved: {output_path}")


def safe_snake_case_filename(input_path):
    stem = input_path.stem.lower()
    safe_stem = re.sub(r"[^a-z0-9]+", "_", stem).strip("_")

    if not safe_stem:
        safe_stem = "image"

    return f"{safe_stem}{input_path.suffix.lower()}"


def process_directory(input_dir, output_dir, mode):
    output_dir.mkdir(parents=True, exist_ok=True)

    input_paths = sorted(
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )

    if not input_paths:
        print(f"No supported images found in {input_dir}")
        sys.exit(1)

    for input_path in input_paths:
        output_path = output_dir / safe_snake_case_filename(input_path)
        process_image(input_path, output_path, mode)


def main():
    parser = argparse.ArgumentParser(
        description="Resize image to App Store preview size (1242x2688)"
    )
    parser.add_argument(
        "input",
        nargs="?",
        default=str(DEFAULT_INPUT_DIR),
        help="Input image or directory",
    )
    parser.add_argument(
        "output",
        nargs="?",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Output image or directory",
    )
    parser.add_argument(
        "--mode",
        choices=["crop", "exact"],
        default="crop",
        help="crop = preserve aspect ratio (recommended), exact = force resize",
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    if not input_path.exists():
        print("Input file not found")
        sys.exit(1)

    if input_path.is_dir():
        process_directory(input_path, output_path, args.mode)
        return

    if output_path.is_dir():
        output_path.mkdir(parents=True, exist_ok=True)
        output_path = output_path / safe_snake_case_filename(input_path)

    process_image(input_path, output_path, args.mode)


if __name__ == "__main__":
    main()
