#!/bin/bash
# usage: set_tier.sh <Alta|Média|Baixa>  — picks the tier in the quality menu, back to 0 s, paused.
S=T4PVUC79WGS4FE8T
c() { adb -s $S exec-out uiautomator dump /dev/tty | grep -o "<node[^>]*text=\"$1\"[^>]*>" | head -1 | grep -o 'bounds="[^"]*"' | sed -E 's/bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]"/\1 \2 \3 \4/' | awk '{print int(($1+$3)/2), int(($2+$4)/2)}'; }
badge=$(adb -s $S exec-out uiautomator dump /dev/tty | grep -o '<node[^>]*text="3840×2160[^"]*"[^>]*>' | grep -o 'bounds="[^"]*"' | sed -E 's/bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]"/\1 \2 \3 \4/' | awk '{print int(($1+$3)/2), int(($2+$4)/2)}')
adb -s $S shell input tap $badge
sleep 2
adb -s $S shell input tap $(c "$1")
sleep 1
adb -s $S shell input keyevent 4
sleep 1
# Jump to the start (|<) and let the tier's sources open.
adb -s $S shell input tap 328 1785
sleep 12
adb -s $S exec-out uiautomator dump /dev/tty | grep -o 'text="3840×2160[^"]*"\|text="00:00:00:00"' | tr '\n' ' '
echo
