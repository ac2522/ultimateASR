import io
import json
import pytest
from ultimate_asr.rpc import Dispatcher, RpcError


def test_dispatch_known_method():
    d = Dispatcher()
    d.register("ping", lambda **kw: {"pong": True})
    resp = d.dispatch({"id": 1, "method": "ping", "params": {}})
    assert resp == {"id": 1, "result": {"pong": True}}


def test_dispatch_unknown_method():
    d = Dispatcher()
    resp = d.dispatch({"id": 2, "method": "missing", "params": {}})
    assert resp["id"] == 2
    assert resp["error"]["code"] == -32601


def test_dispatch_handler_exception_returns_internal_error():
    d = Dispatcher()
    d.register("boom", lambda **kw: (_ for _ in ()).throw(RuntimeError("boom!")))
    resp = d.dispatch({"id": 3, "method": "boom", "params": {}})
    assert resp["error"]["code"] == -32603
    assert "boom!" in resp["error"]["message"]


def test_run_loop_processes_lines():
    inp = io.StringIO('{"id":1,"method":"ping","params":{}}\n{"id":2,"method":"ping","params":{}}\n')
    out = io.StringIO()
    d = Dispatcher()
    d.register("ping", lambda **kw: "ok")
    d.run(inp, out)
    lines = [json.loads(line) for line in out.getvalue().strip().split("\n")]
    assert [r["id"] for r in lines] == [1, 2]
    assert all(r["result"] == "ok" for r in lines)


def test_notification_no_id_no_response():
    d = Dispatcher()
    d.register("ping", lambda **kw: "ok")
    resp = d.dispatch({"method": "ping", "params": {}})
    assert resp is None
