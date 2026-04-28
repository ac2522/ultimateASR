#!/bin/sh
# Linux deb post-install: ensure the user can use evdev for the global hotkey
# fallback on Wayland. Best-effort; not required.
if getent group input >/dev/null 2>&1; then
  if [ -n "${SUDO_USER:-}" ]; then
    usermod -aG input "$SUDO_USER" 2>/dev/null || true
  fi
fi
exit 0
