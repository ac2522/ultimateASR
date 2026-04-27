import httpx
from .base import LLMConfig


class LlamaCppProvider:
    """llama.cpp's HTTP server exposes an OpenAI-compatible /v1/chat/completions endpoint."""

    def __init__(self, cfg: LLMConfig):
        self._cfg = cfg
        self._client = httpx.Client(
            base_url=cfg.endpoint or "http://localhost:8080",
            timeout=cfg.timeout_s,
        )

    def cleanup(self, text: str, *, system_prompt: str = "") -> str:
        r = self._client.post("/v1/chat/completions", json={
            "model": self._cfg.model,
            "max_tokens": self._cfg.max_tokens,
            "messages": [
                {"role": "system", "content": system_prompt or self._cfg.system_prompt},
                {"role": "user", "content": text},
            ],
        })
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
