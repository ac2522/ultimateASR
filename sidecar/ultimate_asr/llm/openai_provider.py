from openai import OpenAI
from .base import LLMConfig


class OpenAIProvider:
    def __init__(self, cfg: LLMConfig):
        self._cfg = cfg
        self._client = OpenAI(api_key=cfg.api_key, base_url=cfg.endpoint or None)

    def cleanup(self, text: str, *, system_prompt: str = "") -> str:
        resp = self._client.chat.completions.create(
            model=self._cfg.model,
            timeout=self._cfg.timeout_s,
            max_tokens=self._cfg.max_tokens,
            messages=[
                {"role": "system", "content": system_prompt or self._cfg.system_prompt},
                {"role": "user", "content": text},
            ],
        )
        return resp.choices[0].message.content.strip()
