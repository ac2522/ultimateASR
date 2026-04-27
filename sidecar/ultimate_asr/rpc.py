"""Line-delimited JSON-RPC 2.0 dispatcher running over stdin/stdout."""
from __future__ import annotations
import json, sys, traceback
from typing import Any, Callable, IO


class RpcError(Exception):
    def __init__(self, code: int, message: str, data: Any = None):
        self.code, self.message, self.data = code, message, data


class Dispatcher:
    def __init__(self) -> None:
        self._handlers: dict[str, Callable[..., Any]] = {}

    def register(self, name: str, handler: Callable[..., Any]) -> None:
        self._handlers[name] = handler

    def dispatch(self, msg: dict) -> dict | None:
        msg_id = msg.get("id")
        method = msg.get("method")
        params = msg.get("params") or {}
        is_notification = msg_id is None

        handler = self._handlers.get(method)
        if handler is None:
            if is_notification:
                return None
            return {"id": msg_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}

        try:
            result = handler(**params) if isinstance(params, dict) else handler(params)
        except RpcError as e:
            if is_notification:
                return None
            return {"id": msg_id, "error": {"code": e.code, "message": e.message, "data": e.data}}
        except Exception as e:
            if is_notification:
                return None
            return {"id": msg_id, "error": {"code": -32603, "message": str(e), "data": traceback.format_exc()}}

        if is_notification:
            return None
        return {"id": msg_id, "result": result}

    def run(self, stdin: IO[str] = sys.stdin, stdout: IO[str] = sys.stdout) -> None:
        for line in stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                stdout.write(json.dumps({"id": None, "error": {"code": -32700, "message": "Parse error"}}) + "\n")
                stdout.flush()
                continue
            resp = self.dispatch(msg)
            if resp is not None:
                stdout.write(json.dumps(resp) + "\n")
                stdout.flush()
