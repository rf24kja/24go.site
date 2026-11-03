"""Portable accepted-byte and legacy-helper contracts. No network/database access."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]

class Export(unittest.TestCase):
    def test_all_accepted_inputs(self):
        manifest = json.loads((Path(__file__).parent / 'accepted-source.json').read_text())
        for relative, digest in manifest['files'].items():
            with self.subTest(path=relative):
                actual = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
                self.assertIn(actual, {digest, manifest.get('git_files', {}).get(relative, digest)})

    def test_legacy_helper_defaults_to_tenant_ui_without_dependencies(self):
        helper = Path(__file__).parent / 'configure_oauth.py'
        result = subprocess.run([sys.executable, '-I', str(helper)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('https://www.24go.site/YT/settings', result.stderr)
        self.assertNotIn('Traceback', result.stderr)

if __name__ == '__main__':
    unittest.main(verbosity=2)
