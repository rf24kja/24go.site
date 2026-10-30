"""Deterministic, fail-closed prose edits; never reconstruct code with a model."""
import re


def protected_parts(text):
    front = ''
    if text.startswith('---\n'):
        end = text.find('\n---\n', 4)
        if end < 0:
            raise ValueError('Unclosed frontmatter')
        front = text[:end + 5]
    fences = []
    block = []
    marker = None
    for line in text.splitlines(keepends=True):
        match = re.match(r'^ {0,3}(`{3,}|~{3,})', line)
        if marker is None and match:
            marker = match.group(1)
            block = [line]
        elif marker is not None:
            block.append(line)
            if re.fullmatch(r' {0,3}' + re.escape(marker[0]) + '{' + str(len(marker)) + r',}[ \t]*(?:\r?\n)?', line):
                fences.append(''.join(block))
                marker = None
    if marker is not None:
        raise ValueError('Unclosed code fence')
    return (front, fences,
            re.findall(r'(?<!`)`[^`\n]+`(?!`)', text),
            re.findall(r'https?://[^\s<>"\)]+', text),
            re.findall(r'(?m)^#{1,6}[ \t]+.*$', text),
            re.findall(r'(?is)<pre\b.*?</pre>|<code\b.*?</code>', text))


def apply_editor_edits(originals, response):
    if not isinstance(response, dict) or set(response) != {'edits_ru', 'edits_en'}:
        raise ValueError('Expected bilingual edit plan')
    result = {}
    for locale in ('ru', 'en'):
        text = originals[locale]
        protected = protected_parts(text)
        edits = response['edits_' + locale]
        if not isinstance(edits, list) or len(edits) > 40:
            raise ValueError('Too many or invalid edits')
        for edit in edits:
            if not isinstance(edit, dict) or set(edit) != {'old', 'new'}:
                raise ValueError('Invalid edit schema')
            old, new = edit['old'], edit['new']
            if (not isinstance(old, str) or not isinstance(new, str) or
                    not old.strip() or not new.strip() or max(len(old), len(new)) > 4000):
                raise ValueError('Empty or oversized edit')
            if text.count(old) != 1:
                raise ValueError('Edit must match exactly once')
            text = text.replace(old, new, 1)
            if protected_parts(text) != protected:
                raise ValueError('Edit changes protected code, metadata, headings or links')
        result[locale] = text
    return result
