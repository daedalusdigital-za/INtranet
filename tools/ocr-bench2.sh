#!/bin/bash
# Stage timings for tesseract on the page images already rendered into /tmp/tb by ocr-bench.sh
cd /tmp/tb || exit 1
t() { local s=$(date +%s%N); "$@" >/dev/null 2>&1; echo "$(( ($(date +%s%N)-s)/1000000 )) ms"; }
export OMP_THREAD_LIMIT=1
echo -n "osd psm0      : "; t tesseract pg-1.png stdout --psm 0 -l osd
echo -n "tsv psm1      : "; t tesseract pg-1.png stdout --psm 1 -l eng --oem 1 tsv
echo -n "text psm3     : "; t tesseract pg-1.png stdout --psm 3 -l eng --oem 1
echo -n "text psm11    : "; t tesseract pg-1.png stdout --psm 11 -l eng --oem 1
echo -n "text psm6     : "; t tesseract pg-1.png stdout --psm 6 -l eng --oem 1
echo -n "5 pages par.  : "; s=$(date +%s%N); for g in pg*.png; do tesseract $g stdout --psm 1 -l eng --oem 1 tsv >/dev/null 2>&1 & done; wait; echo "$(( ($(date +%s%N)-s)/1000000 )) ms"
unset OMP_THREAD_LIMIT
echo -n "psm1 4threads : "; OMP_THREAD_LIMIT=4 t tesseract pg-1.png stdout --psm 1 -l eng --oem 1
