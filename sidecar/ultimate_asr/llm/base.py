from __future__ import annotations
from dataclasses import dataclass
from typing import Protocol


@dataclass
class LLMConfig:
    provider: str          # openai | anthropic | ollama | llamacpp
    model: str
    api_key: str = ""
    endpoint: str = ""
    system_prompt: str = ""
    max_tokens: int = 512
    timeout_s: float = 30.0


class LLMProvider(Protocol):
    def cleanup(self, text: str, *, system_prompt: str = "") -> str: ...


def get_provider(cfg: LLMConfig) -> LLMProvider:
    if cfg.provider == "openai":
        from .openai_provider import OpenAIProvider
        return OpenAIProvider(cfg)
    if cfg.provider == "anthropic":
        from .anthropic_provider import AnthropicProvider
        return AnthropicProvider(cfg)
    if cfg.provider == "ollama":
        from .ollama_provider import OllamaProvider
        return OllamaProvider(cfg)
    if cfg.provider == "llamacpp":
        from .llamacpp_provider import LlamaCppProvider
        return LlamaCppProvider(cfg)
    raise ValueError(f"Unknown LLM provider: {cfg.provider}")
