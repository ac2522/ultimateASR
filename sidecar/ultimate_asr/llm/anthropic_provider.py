from anthropic import Anthropic
from .base import LLMConfig


class AnthropicProvider:
    def __init__(self, cfg: LLMConfig):
        self._cfg = cfg
        self._client = Anthropic(api_key=cfg.api_key, base_url=cfg.endpoint or None)

    def cleanup(self, text: str, *, system_prompt: str = "") -> str:
        resp = self._client.messages.create(
            model=self._cfg.model,
            max_tokens=self._cfg.max_tokens,
            system=system_prompt or self._cfg.system_prompt,
            messages=[{"role": "user", "content": text}],
        )
        return "".join(block.text for block in resp.content if hasattr(block, "text")).strip()
