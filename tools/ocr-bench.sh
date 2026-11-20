#!/bin/bash
cd /tmp && rm -rf scan && mkdir scan && cd scan
for p in /app/uploads/maintenance/*.pdf; do
  n=$(pdfinfo "$p" 2>/dev/null | awk '/^Pages/{print $2}')
  if [ "${n:-0}" -ge 4 ]; then echo "using $p ($n pages)"; pdftoppm -png -gray -r 300 -l 6 "$p" pg; break; fi
done
echo "pages rendered: $(ls pg*.png | wc -l)"
echo SERIAL-psm1-300dpi
time (for f in pg*.png; do tesseract $f stdout --psm 1 -l eng --oem 1 >/dev/null 2>&1; done)
echo PARALLEL-psm3-300dpi
time (for f in pg*.png; do OMP_THREAD_LIMIT=1 tesseract $f stdout --psm 3 -l eng --oem 1 >/dev/null 2>&1 & done; wait)
