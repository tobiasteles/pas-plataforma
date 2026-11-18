import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent


class TestCli(unittest.TestCase):
    def test_pasta_inteira_atinge_metas(self):
        if not list((AQUI / "amostras").glob("*.pdf")):
            self.skipTest("sem PDFs de amostra")
        with tempfile.TemporaryDirectory() as tmp:
            r = subprocess.run([sys.executable, str(AQUI.parent / "processar_pasta.py"), str(AQUI / "amostras"), tmp, "--sem-imagens"],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertTrue((Path(tmp) / "resumo_qualidade.json").exists())


if __name__ == "__main__":
    unittest.main()
