import argparse
import json
import sys
from pathlib import Path


def result(ok, **kwargs):
    print(json.dumps({"ok": ok, **kwargs}, ensure_ascii=False))


def load_converter():
    try:
        from markitdown import MarkItDown
    except Exception:
        return None

    return MarkItDown()


def convert_with_converter(converter, input_path, output_path):
    source = Path(input_path)
    target = Path(output_path)

    if not source.exists():
        return {"inputPath": str(source), "ok": False, "errorCode": "INPUT_MISSING", "message": "源文件不存在，请重新选择文件。"}

    try:
        target.parent.mkdir(parents=True, exist_ok=True)
        markdown = converter.convert_local(str(source))
        text_content = getattr(markdown, "text_content", None)
        if text_content is None:
            text_content = str(markdown)
        target.write_text(text_content, encoding="utf-8")
    except Exception as exc:
        return {"inputPath": str(source), "ok": False, "errorCode": "CONVERSION_FAILED", "message": f"转换失败：{exc}"}

    return {"inputPath": str(source), "ok": True, "outputPath": str(target)}


def convert(input_path, output_path):
    converter = load_converter()
    if converter is None:
        result(
            False,
            errorCode="MARKITDOWN_UNAVAILABLE",
            message="MarkItDown 环境不可用，请先安装 requirements.txt 中的 Python 依赖。",
        )
        return 1

    item_result = convert_with_converter(converter, input_path, output_path)
    result(item_result["ok"], **{key: value for key, value in item_result.items() if key != "ok"})
    return 0 if item_result["ok"] else 1


def convert_jobs(jobs_json):
    try:
        jobs = json.loads(jobs_json)
    except json.JSONDecodeError:
        result(False, errorCode="INVALID_JOBS_JSON", message="批量转换任务不是有效 JSON。")
        return 1

    if not isinstance(jobs, list):
        result(False, errorCode="INVALID_JOBS_JSON", message="批量转换任务必须是数组。")
        return 1

    converter = load_converter()
    if converter is None:
        result(
            False,
            errorCode="MARKITDOWN_UNAVAILABLE",
            message="MarkItDown 环境不可用，请先安装 requirements.txt 中的 Python 依赖。",
            results=[
                {
                    "inputPath": str(job.get("input", "")),
                    "ok": False,
                    "errorCode": "MARKITDOWN_UNAVAILABLE",
                    "message": "MarkItDown 环境不可用，请先安装 requirements.txt 中的 Python 依赖。",
                }
                for job in jobs
                if isinstance(job, dict)
            ],
        )
        return 1

    results = []
    for job in jobs:
        if not isinstance(job, dict) or not job.get("input") or not job.get("output"):
            results.append(
                {
                    "inputPath": str(job.get("input", "")) if isinstance(job, dict) else "",
                    "ok": False,
                    "errorCode": "INVALID_JOB",
                    "message": "批量转换任务缺少输入或输出路径。",
                }
            )
            continue

        results.append(convert_with_converter(converter, job["input"], job["output"]))

    result(any(item["ok"] for item in results), results=results)
    return 0 if any(item["ok"] for item in results) else 1


def main():
    parser = argparse.ArgumentParser(description="Convert a local file to Markdown with MarkItDown.")
    parser.add_argument("--input")
    parser.add_argument("--output")
    parser.add_argument("--jobs-json")
    args = parser.parse_args()

    if args.jobs_json:
        return convert_jobs(args.jobs_json)

    if not args.input or not args.output:
        parser.error("the following arguments are required together: --input, --output")

    return convert(args.input, args.output)


if __name__ == "__main__":
    sys.exit(main())
