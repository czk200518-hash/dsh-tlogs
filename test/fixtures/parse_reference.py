#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""对拍参考侧：直接加载工作区的权威 Python 脚本，用它的函数解析测试夹具。

这是「数据层与 Python 脚本对拍」的 Python 一侧。它**不重新实现**任何解析逻辑，
而是把 `deepseek_python_20261007_a1f087.py` 当模块加载，调用其中的
`parse_biz_data` / `input_tokens` / `output_tokens`，因此对比的是真实参考实现。

用法：
    python parse_reference.py <参考脚本路径> <夹具 JSON> [更多夹具...]

输出：JSON 数组，每项形如
    {"file": ..., "agg": {五类}, "models": {模型: {五类}}, "input":..., "output":..., "total":...}
"""

import importlib.util
import json
import sys
import types
from pathlib import Path


def _ensure_requests_available() -> None:
    """参考脚本在 import 期会 `import requests`，缺失时会 input()+sys.exit(1)。

    本脚本只使用它的纯函数、绝不发网络请求，因此当 requests 未安装时注入一个
    惰性桩模块，让 import 成功而不触发任何 I/O。
    """
    if "requests" in sys.modules:
        return
    try:
        import requests  # noqa: F401
        return
    except ImportError:
        pass

    stub = types.ModuleType("requests")
    exc_mod = types.ModuleType("requests.exceptions")

    class RequestException(Exception):
        pass

    exc_mod.RequestException = RequestException  # type: ignore[attr-defined]
    stub.exceptions = exc_mod  # type: ignore[attr-defined]

    def _forbidden(*_args, **_kwargs):
        raise RuntimeError("golden parse must not perform network I/O")

    stub.get = _forbidden  # type: ignore[attr-defined]
    sys.modules["requests"] = stub
    sys.modules["requests.exceptions"] = exc_mod


def main() -> int:
    if len(sys.argv) < 3:
        print(__doc__, file=sys.stderr)
        return 2

    reference = Path(sys.argv[1]).resolve()
    fixtures = [Path(p).resolve() for p in sys.argv[2:]]

    _ensure_requests_available()

    spec = importlib.util.spec_from_file_location("deepseek_usage_reference", reference)
    if spec is None or spec.loader is None:
        print(f"无法加载参考脚本：{reference}", file=sys.stderr)
        return 1
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    results = []
    for fixture in fixtures:
        payload = json.loads(fixture.read_text(encoding="utf-8"))

        # 双层错误码都要检查（与参考脚本 main() 的用法一致）。
        if payload.get("code") != 0:
            raise SystemExit(f"{fixture.name}: 外层 code != 0")
        inner = payload.get("data") or {}
        if inner.get("biz_code") != 0:
            raise SystemExit(f"{fixture.name}: biz_code != 0")

        biz_data = inner.get("biz_data") or {}
        agg, models = module.parse_biz_data(biz_data)
        in_tok = module.input_tokens(agg)
        out_tok = module.output_tokens(agg)

        results.append(
            {
                "file": fixture.name,
                "agg": agg,
                "models": models,
                "input": in_tok,
                "output": out_tok,
                "total": in_tok + out_tok,
            }
        )

    # sort_keys 让输出稳定；ensure_ascii=False 便于人眼核对中文模型名。
    print(json.dumps(results, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
