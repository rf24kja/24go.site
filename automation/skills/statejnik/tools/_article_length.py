"""24go.site-only minimum body policy, version 1. Stdlib for native CMS workers."""
import re
from html.parser import HTMLParser
import unicodedata

MIN_BODY_CHARS = 7000
POLICY = ('24go.site: each RU and EN main body must have at least 7000 visible Unicode '
          'characters after markup removal and whitespace collapse; frontmatter, hidden text, '
          'images, navigation and related/recommended article sections do not count. '
          'Do not pad; missing useful substance blocks acceptance/publication.')


class _Visible(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        hidden = (re.search(r'related|recommend|read-also', attrs.get('class', '') + ' ' + attrs.get('id', ''), re.I)
                  or tag in ('script', 'style', 'template', 'nav', 'aside', 'footer')
                  or 'hidden' in attrs or attrs.get('aria-hidden') == 'true'
                  or re.search(r'display\s*:\s*none|visibility\s*:\s*hidden', attrs.get('style', ''), re.I))
        if tag not in ('br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'source', 'area', 'embed'):
            self.stack.append((tag, bool(hidden) or any(x[1] for x in self.stack)))
        if tag in ('p', 'div', 'li', 'br', 'tr', 'h1', 'h2', 'h3', 'pre'):
            self.parts.append(' ')

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break
        if tag in ('p', 'div', 'li', 'tr', 'h1', 'h2', 'h3', 'pre'):
            self.parts.append(' ')

    def handle_data(self, data):
        if not any(x[1] for x in self.stack):
            self.parts.append(data)


def visible_body(text):
    if not isinstance(text, str):
        raise ValueError('Body must be text')
    text = re.sub(r'\A---[^\n]*\n.*?\n---(?:\n|$)', '', text, count=1, flags=re.S)
    # Recommendations are page chrome, not the article. Conservatively stop at that section.
    marker = r'(?:related(?: articles| posts)?|recommended(?: articles| posts)?|more articles|read also|see also|sources|references|другие статьи|источники|рекомендуем.*|читайте также.*|похожие статьи.*)'
    text = re.split(r'(?im)^\s*#{1,6}\s+' + marker + r'\s*$|<h[1-6][^>]*>\s*' + marker + r'\s*</h[1-6]>', text, maxsplit=1)[0]
    text = re.sub(r'(?m)^\s*\[[^\]]+\]:.*$', '', text)
    text = re.sub(r'!\[[^\]]*\]\([^\n]*?\)', '', text)
    text = re.sub(r'\[([^\]]+)\]\([^\n]*?\)', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\[[^\]]*\]', r'\1', text)
    text = re.sub(r'(?m)^\s*(?:```|~~~)[^\n]*$', '', text)
    text = re.sub(r'(?m)^\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)', '', text)
    text = re.sub(r'(?m)^\s*[:| -]{3,}\s*$', '', text)
    text = re.sub(r'[`*_~|]', '', text)
    parser = _Visible()
    parser.feed(text)
    parser.close()
    visible = ''.join(parser.parts)
    visible = ''.join(c for c in visible if unicodedata.category(c) != 'Cf')
    return ' '.join(visible.split())


def require_body_lengths(payload):
    counts = {loc: len(visible_body(payload.get('content_' + loc, ''))) for loc in ('ru', 'en')}
    for loc, count in counts.items():
        if count < MIN_BODY_CHARS:
            raise ValueError(f'24go.site {loc} body {count} < {MIN_BODY_CHARS} visible characters')
    return counts
