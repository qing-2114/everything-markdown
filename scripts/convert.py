import argparse
import json
import sys
from pathlib import Path


def result(ok, **kwargs):
    print(json.dumps({"ok": ok, **kwargs}, ensure_ascii=False))


def convert(input_path, output_path):
    try:
        from markitdown import MarkItDown
    except Exception:
        result(
            False,
            errorCode="MARKITDOWN_UNAVAILABLE",
            message="MarkItDown 环境不可用，请先安装 requirements.txt 中的 Python 依赖。",
        )
        return 1

    source = Path(input_path)
    target = Path(output_path)

    if not source.exists():
        result(False, errorCode="INPUT_MISSING", message="源文件不存在，请重新选择文件。")
        return 1

    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        markdown = MarkItDown().convert_local(str(source))
        text_content = getattr(markdown, "text_content", None)
        if text_content is None:
            text_content = str(markdown)
        target.write_text(text_content, encoding="utf-8")
    except Exception as exc:
        result(False, errorCode="CONVERSION_FAILED", message=f"转换失败：{exc}")
        return 1

    result(True, outputPath=str(target))
    return 0


def main():
    parser = argparse.ArgumentParser(description="Convert a local file to Markdown with MarkItDown.")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    return convert(args.input, args.output)


if __name__ == "__main__":
    sys.exit(main())
