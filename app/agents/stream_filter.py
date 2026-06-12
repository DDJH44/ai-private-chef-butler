"""Streaming filters used by the recipe agent."""

import re

_THINK_BLOCK_RE = re.compile(
    r"<\|?\s*(?:think|thinking|reasoning|response)\s*\|?\s*>[\s\S]*?"
    r"<\|?\s*/\s*(?:think|thinking|reasoning|response)\s*\|?\s*>",
    re.IGNORECASE,
)
_THINK_OPEN_RE = re.compile(
    r"<\|?\s*(?:think|thinking|reasoning|response)\s*\|?\s*>",
    re.IGNORECASE,
)
_THINK_CLOSE_RE = re.compile(
    r"<\|?\s*/\s*(?:think|thinking|reasoning|response)\s*\|?\s*>",
    re.IGNORECASE,
)
_THINK_PREFIXES = ("<|", "<think", "<thinking", "<reasoning", "<response", "</", "</|")


def filter_thinking(content: str) -> str:
    """Remove complete model reasoning blocks from a text response."""
    return _THINK_BLOCK_RE.sub("", content).lstrip()


def safe_cut(text: str) -> int:
    """Return a prefix length that does not split a possible reasoning tag."""
    cut = len(text)
    lowered = text.lower()
    for prefix in _THINK_PREFIXES:
        for n in range(len(prefix), 0, -1):
            if lowered.endswith(prefix[:n]):
                candidate = len(text) - n
                if candidate < cut:
                    cut = candidate
                break

    lt_pos = text.rfind("<")
    if lt_pos >= 0:
        remaining = len(text) - lt_pos
        if remaining < 20 and lt_pos < cut:
            cut = lt_pos
    return max(cut, 0)


class ThinkFilter:
    """Stateful stream filter that removes reasoning blocks across chunks."""

    def __init__(self):
        self._buf = ""
        self._in_think = False

    def feed(self, chunk: str) -> str:
        self._buf += chunk
        out_parts: list[str] = []

        while self._buf:
            if self._in_think:
                match = _THINK_CLOSE_RE.search(self._buf)
                if match:
                    self._buf = self._buf[match.end():]
                    self._in_think = False
                else:
                    break
            else:
                match = _THINK_OPEN_RE.search(self._buf)
                if match:
                    out_parts.append(self._buf[:match.start()])
                    self._buf = self._buf[match.end():]
                    self._in_think = True
                else:
                    cut = safe_cut(self._buf)
                    out_parts.append(self._buf[:cut])
                    self._buf = self._buf[cut:]
                    break

        return "".join(out_parts)

    def flush(self) -> str:
        if self._in_think:
            self._buf = ""
            self._in_think = False
            return ""
        rest = self._buf
        self._buf = ""
        return rest
