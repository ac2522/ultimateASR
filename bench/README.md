# Benchmarks

Compare ultimateASR (sidecar JSON-RPC) against the original whisperLocal (direct
Python import) on the same audio + same model. Confirms the engine port is
byte-equivalent and measures the IPC overhead.

See `../ROADMAP.md` section 6 for the full plan.

## Audio corpus

Not committed (large binaries). Fetch one of:

- **Short (~10 s):** LibriSpeech test-clean
  https://www.openslr.org/resources/12/test-clean.tar.gz
  Use `test-clean/1089/134686/1089-134686-0000.flac` → convert to 16 kHz mono WAV.

- **Medium (~30 s):** any consecutive few utterances from the same LibriSpeech speaker.

- **Long (~5–15 min):** LibriVox chapter with matching transcript text. Trim to
  16 kHz mono PCM and store ground truth alongside.

Place under `bench/audio/{short,medium,long}.wav` and ground truth at
`bench/audio/{short,medium,long}.txt`.

## Running

```bash
pip install jiwer numpy
python bench/run.py --model ~/.whisper2text/models/ggml-base.bin \
    --audio-dir bench/audio --warm
```

Output: a CSV on stdout. `--warm` keeps a single sidecar alive across calls (fair
latency comparison); without it each call cold-starts.

## Acceptance

- ultimateASR text == whisperLocal text (bit-equal) on every clip
- engine-only latency within 5%
