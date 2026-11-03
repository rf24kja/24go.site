"""Dedicated fail-closed configuration. Legacy external_enabled remains readable."""
import json
import os
import re
from pathlib import Path
from dataclasses import dataclass
from cryptography.fernet import Fernet
from yt import Options
CALLBACK = 'https://www.24go.site/YT/callback'

@dataclass(frozen=True)
class Runtime:
    database_url: str
    cipher: Fernet
    options: Options


def validate_config(config):
    allowed = {'database_url', 'credential_key_file', 'client_id', 'client_secret_file', 'redirect_uri', 'external_enabled', 'posting_enabled', 'oauth_enabled', 'monitoring_enabled'}
    if not isinstance(config, dict) or set(config)-allowed:
        raise ValueError('configuration fields')
    for name in ('external_enabled', 'oauth_enabled', 'monitoring_enabled', 'posting_enabled'):
        if name in config and type(config[name]) is not bool:
            raise ValueError('gate must be boolean')
    if not isinstance(config.get('database_url'), str) or not config['database_url'].startswith(('postgresql://', 'postgresql+asyncpg://')):
        raise ValueError('PostgreSQL required')
    if not isinstance(config.get('credential_key_file'), str) or not Path(config['credential_key_file']).is_absolute():
        raise ValueError('dedicated key mount required')
    fields = [config.get(k, '') for k in ('client_id', 'client_secret_file', 'redirect_uri')]
    if any(fields):
        if not all(isinstance(v, str) and v for v in fields):
            raise ValueError('partial OAuth application')
        if not re.fullmatch(r'[A-Za-z0-9_-]+\.apps\.googleusercontent\.com', fields[0]) or not Path(fields[1]).is_absolute() or fields[2] != CALLBACK:
            raise ValueError('dedicated Web application / exact callback required')
    oauth = config.get('oauth_enabled', config.get('external_enabled', False))
    if (oauth or config.get('posting_enabled', False)) and not all(fields):
        raise ValueError('OAuth application required')
    return dict(external_enabled=config.get('external_enabled', False), oauth_enabled=oauth,
                monitoring_enabled=config.get('monitoring_enabled', config.get('external_enabled', False)),
                posting_enabled=config.get('posting_enabled', False))


def load_runtime():
    try:
        path = Path(os.environ['YT_CONFIG_FILE'])
        if not path.is_absolute():
            raise ValueError('absolute mount required')
        config = json.loads(path.read_text())
        gates = validate_config(config)
        cipher = Fernet(Path(config['credential_key_file']).read_bytes().strip())
        secret = ''
        if config.get('client_secret_file'):
            secret = Path(config['client_secret_file']).read_text().strip()
            if len(secret) < 16 or any(c.isspace() for c in secret):
                raise ValueError('invalid dedicated secret')
        return Runtime(config['database_url'], cipher, Options(**gates, client_id=config.get('client_id', ''), client_secret=secret, redirect_uri=config.get('redirect_uri', '')))
    except (OSError, ValueError, KeyError, TypeError):
        raise RuntimeError('Invalid YT configuration or dedicated secret mount') from None
