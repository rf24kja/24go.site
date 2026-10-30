"""Pure stdlib HTML to Telegraph Node conversion; no transport or configuration."""
from html.parser import HTMLParser
from urllib.parse import urlsplit

TAGS = set('a aside b blockquote br code em figcaption figure h3 h4 hr i iframe img li ol p pre s strong u ul video'.split())
VOID = {'br', 'hr', 'img'}
BLOCKED = {'script', 'style', 'object', 'embed', 'template', 'svg', 'math', 'form'}


def safe_url(value):
    if not value or any(ord(c) <= 32 or ord(c) == 127 for c in value):
        return False
    try:
        parsed = urlsplit(value)
        return parsed.scheme in ('http', 'https') and bool(parsed.hostname) and not parsed.username and not parsed.password
    except ValueError:
        return False


class NodeParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.nodes = []
        self.stack = [(None, self.nodes)]
        self.blocked = []

    def handle_starttag(self, tag, attrs):
        if self.blocked:
            if tag not in VOID:
                self.blocked.append(tag)
            return
        if tag in BLOCKED:
            self.blocked.append(tag)
            return
        mapped = {'h1': 'h3', 'h2': 'h3', 'h5': 'h4', 'h6': 'h4'}.get(tag, tag)
        children = self.stack[-1][1]
        if mapped in TAGS:
            node = {'tag': mapped}
            allowed = 'href' if mapped == 'a' else 'src' if mapped in {'img', 'iframe', 'video'} else None
            clean = {k: v for k, v in attrs if k == allowed and safe_url(v)}
            if clean:
                node['attrs'] = clean
            children.append(node)
            if mapped not in VOID:
                children = node.setdefault('children', [])
        if tag not in VOID:
            self.stack.append((tag, children))

    def handle_endtag(self, tag):
        if self.blocked:
            if tag in self.blocked:
                self.blocked = self.blocked[:self.blocked.index(tag)]
            return
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_data(self, data):
        if not self.blocked:
            self.stack[-1][1].append(data)


def html_to_telegraph_nodes(html):
    parser = NodeParser()
    parser.feed(html)
    parser.close()
    return parser.nodes


# Official API says "up to 64 KB" without defining KB. Use the smaller decimal
# interpretation, measuring the exact JSON field bytes, not Markdown or the form.
CONTENT_MAX_BYTES = 64000


def serialize_nodes(nodes):
    import json
    return json.dumps(nodes, ensure_ascii=False, separators=(',', ':'))


def markdown_nodes(markdown, render):
    """Keep complete line-delimited fences opaque to the legacy prose renderer."""
    import re
    from html import escape
    output, prose, code = [], [], None
    fence = None
    for line in markdown.splitlines():
        match = re.fullmatch(r' {0,3}(`{3,}|~{3,})(.*)', line)
        if code is None:
            if match and (match[1][0] != '`' or '`' not in match[2]):
                output.extend(html_to_telegraph_nodes(render('\n'.join(prose))))
                prose = []
                fence, code = match[1], []
            else:
                prose.append(line)
        elif match and match[1][0] == fence[0] and len(match[1]) >= len(fence) and not match[2].strip():
            output.extend(html_to_telegraph_nodes('<pre><code>' + escape('\n'.join(code)) + '</code></pre>'))
            code = None
        else:
            code.append(line)
    output.extend(html_to_telegraph_nodes(render('\n'.join(prose))))
    return output, code is None


def telegraph_content(markdown, original_url, render):
    """Prefer the full article; otherwise explicitly link a code-free preview."""
    nodes, complete = markdown_nodes(markdown, render)
    footer = []
    if safe_url(original_url):
        footer = [{'tag': 'p', 'children': [
            'Полный оригинал: ', {'tag': 'a', 'attrs': {'href': original_url},
                                  'children': [original_url]}]}]
    full = serialize_nodes(nodes + footer)
    if complete and len(full.encode('utf-8')) <= CONTENT_MAX_BYTES:
        return full
    if not footer:
        raise ValueError('Telegraph preview requires a safe original URL')
    notice = {'tag': 'p', 'children': [
        'Краткий анонс, не полная статья. Полный текст и все примеры кода доступны по ссылке на оригинал.']}
    preview = [notice]

    def prose_only(node):
        return isinstance(node, str) or (
            node.get('tag') not in {'code', 'pre', 'iframe', 'video', 'img'}
            and all(prose_only(child) for child in node.get('children', [])))

    # Whole paragraphs only; never slice text, sentences, lists or code examples.
    for node in nodes:
        if not isinstance(node, dict) or node.get('tag') != 'p' or not prose_only(node):
            continue
        trial = preview + [node] + footer
        if len(serialize_nodes(trial).encode('utf-8')) > 8000:
            break
        preview.append(node)
        if len(preview) == 4:
            break
    result = serialize_nodes(preview + footer)
    if len(result.encode('utf-8')) > CONTENT_MAX_BYTES:
        raise ValueError('Telegraph original URL exceeds content budget')
    return result
