import httpx
from .base import LLMConfig


class OllamaProvider:
    def __init__(self, cfg: LLMConfig):
        self._cfg = cfg
        self._client = httpx.Client(
            base_url=cfg.endpoint or "http://localhost:11434",
            timeout=cfg.timeout_s,
        )

    def cleanup(self, text: str, *, system_prompt: str = "") -> str:
        r = self._client.post("/api/chat", json={
            "model": self._cfg.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt or self._cfg.system_prompt},
                {"role": "user", "content": text},
            ],
        })
        r.raise_for_status()
        return r.json()["message"]["content"].strip()
