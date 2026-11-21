#!/bin/bash
# Times each OCR stage on the most recent uploaded pack, the way ExtractPackPagesAsync does it.
f=$(ls -t /app/documents/Finance/packs/2026/*.pdf 2>/dev/null | head -1)
[ -z "$f" ] && f=$(find /app -path '*finance/packs/2026/*.pdf' 2>/dev/null | head -1)
echo "file: $f"; ls -la "$f"; pdfinfo "$f" | grep -E 'Pages|Page size|Producer'
cd /tmp && rm -rf tb && mkdir tb && cd tb
echo "--- pdftoppm 300dpi gray"; time pdftoppm -png -gray -r 300 "$f" pg
ls -la pg*.png | awk '{print $5, $9}'
p=$(ls pg*.png | head -1)
echo "--- OSD (psm 0)";        time (OMP_THREAD_LIMIT=1 tesseract $p stdout --psm 0 -l osd >/dev/null 2>&1)
echo "--- TSV psm1";           time (OMP_THREAD_LIMIT=1 tesseract $p stdout --psm 1 -l eng --oem 1 tsv >/dev/null 2>&1)
echo "--- text psm3";          time (OMP_THREAD_LIMIT=1 tesseract $p stdout --psm 3 -l eng --oem 1 >/dev/null 2>&1)
echo "--- text psm11";         time (OMP_THREAD_LIMIT=1 tesseract $p stdout --psm 11 -l eng --oem 1 >/dev/null 2>&1)
echo "--- text psm6 (header)"; time (OMP_THREAD_LIMIT=1 tesseract $p stdout --psm 6 -l eng --oem 1 >/dev/null 2>&1)
echo "--- all pages parallel psm1 tsv"; time (for g in pg*.png; do OMP_THREAD_LIMIT=1 tesseract $g stdout --psm 1 -l eng --oem 1 tsv >/dev/null 2>&1 & done; wait)
echo "--- 4 threads one page psm1"; time (OMP_THREAD_LIMIT=4 tesseract $p stdout --psm 1 -l eng --oem 1 >/dev/null 2>&1)
nproc; cat /sys/fs/cgroup/cpu.max 2>/dev/null
