"""JSON cleanup helpers for model-generated structured output."""

import re


def repair_truncated_json(raw: str) -> str:
    """Try to repair markdown-wrapped or lightly truncated JSON text."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```\w*\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    stack: list[str] = []
    in_string = False
    escaped = False
    last_structure_pos = -1
    colon_pos = -1

    for i, char in enumerate(cleaned):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            last_structure_pos = i
        elif char == ":":
            colon_pos = i
        elif char in "{[":
            stack.append(char)
            last_structure_pos = i
            colon_pos = -1
        elif char == "}" and stack and stack[-1] == "{":
            stack.pop()
            last_structure_pos = i
            colon_pos = -1
        elif char == "]" and stack and stack[-1] == "[":
            stack.pop()
            last_structure_pos = i
            colon_pos = -1
        elif char in ",":
            last_structure_pos = i
            colon_pos = -1

    if in_string:
        cleaned += '"'
        if colon_pos > last_structure_pos:
            pass
        else:
            cleaned += ': null'

    while stack:
        opener = stack.pop()
        cleaned += "}" if opener == "{" else "]"

    return re.sub(r",\s*([}\]])", r"\1", cleaned)
