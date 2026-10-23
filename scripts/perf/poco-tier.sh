#!/bin/bash
# usage: measure_tier.sh <label>   (editor open, playhead where playback should start, paused)
# Phone measurement for the video editor tiers (owner's Poco). See docs/agent-briefing.md §8 first:
# only with the owner's OK in the session, install -r only, never their projects.
export MSYS_NO_PATHCONV=1
S=T4PVUC79WGS4FE8T
L=$1
FF=$(ls -d "$LOCALAPPDATA"/Microsoft/WinGet/Packages/Gyan.FFmpeg_*/ffmpeg-*/bin | head -1)
OUT=C:/testmedia/webcodecs/poco-$L
mkdir -p "$OUT"
PLAY="605 1785"

# --- playback: 10 s screen recording while playing, memory sampled meanwhile
adb -s $S shell input tap $PLAY
sleep 1
(adb -s $S shell screenrecord --time-limit 10 /sdcard/Download/pm-webcodecs-teste/rec.mp4 &)
peak=0; sum=0; n=0
for i in 1 2 3 4 5; do
  sleep 2
  app=$(adb -s $S shell dumpsys meminfo com.anonymous.pixelmorph | grep -m1 "TOTAL PSS" | awk '{print $3}')
  wv=$(adb -s $S shell "ps -A -o RSS,NAME | grep sandboxed_process | sort -n | tail -1" | awk '{print $1}')
  t=$(( (app + wv) / 1024 ))
  [ $t -gt $peak ] && peak=$t; sum=$((sum + t)); n=$((n + 1))
done
sleep 2
adb -s $S shell input tap $PLAY
adb -s $S pull /sdcard/Download/pm-webcodecs-teste/rec.mp4 "$OUT/play.mp4" >/dev/null
"$FF/ffmpeg.exe" -hide_banner -i "$OUT/play.mp4" -vf "crop=1220:686:0:736,mpdecimate=hi=768:lo=320:frac=0.33,showinfo" -f null - 2>&1 | grep -o "pts_time:[0-9.]*" | sed 's/pts_time://' > "$OUT/play.txt"
frames=$(wc -l < "$OUT/play.txt")
span=$(tail -1 "$OUT/play.txt")
gaps=$(awk 'NR>1{d=$1-p; if(d>0.05) g++; if(d>m) m=d} {p=$1} END{printf "%d gaps>50ms, max %.0f ms", g, m*1000}' "$OUT/play.txt")
echo "[$L] playback: $frames distinct video frames in ${span}s ($gaps); memory app PSS + WebView renderer: peak ${peak} MB, avg $((sum / n)) MB"

# --- seek: 5 taps on the ruler while recording; latency = ruler change -> last video change
(adb -s $S shell screenrecord --time-limit 14 /sdcard/Download/pm-webcodecs-teste/seek.mp4 &)
sleep 2
for x in 420 760 1050 560 900; do adb -s $S shell input tap $x 1950; sleep 2.2; done
sleep 2
adb -s $S pull /sdcard/Download/pm-webcodecs-teste/seek.mp4 "$OUT/seek.mp4" >/dev/null
ev() { "$FF/ffmpeg.exe" -hide_banner -i "$OUT/seek.mp4" -vf "crop=$1,mpdecimate=hi=768:lo=320:frac=0.33,showinfo" -f null - 2>&1 | grep -o "pts_time:[0-9.]*" | sed 's/pts_time://'; }
ev 1220:60:300:1900 > "$OUT/ruler.txt"
ev 1220:686:0:736 > "$OUT/video.txt"
# For each ruler change, the last video change before the next ruler change (frame settled).
awk 'FNR==NR{r[++nr]=$1; next} {v[++nv]=$1} END{
  for(i=2;i<=nr;i++){ s=r[i]; e=(i<nr)?r[i+1]:s+2.2; last=-1;
    for(j=1;j<=nv;j++) if(v[j]>s-0.1 && v[j]<e) last=v[j];
    if(last>=0) printf "%.0f ", (last-s)*1000; else printf "? " }
  print "" }' "$OUT/ruler.txt" "$OUT/video.txt" | sed "s/^/[$L] seek ms (ruler tap -> frame settled): /"
adb -s $S shell rm -f /sdcard/Download/pm-webcodecs-teste/rec.mp4 /sdcard/Download/pm-webcodecs-teste/seek.mp4
