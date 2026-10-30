"""语音体检：分析最近 N 条 Breeze 语音，与基线对比质心/语速/音高波动。

用法：
  python checks/voice_analyze.py
  python checks/voice_analyze.py --dir "C:/Users/麾/.dsh/im-bridge/voice" --last 10
  python checks/voice_analyze.py --baseline E:/workspace/audio.cpp/compare/orig-b.wav
"""

import argparse
import glob
import json
import os
import sys
import wave

import numpy as np


def load_wav(path):
    with wave.open(path, 'rb') as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if sw == 2:
        x = np.frombuffer(raw, dtype=np.int16).astype(np.float64) / 32768.0
    elif sw == 4:
        x = np.frombuffer(raw, dtype=np.int32).astype(np.float64) / 2147483648.0
    else:
        raise SystemExit('unsupported sample width ' + str(sw))
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def analyze(path):
    x, sr = load_wav(path)
    frame, hop = 1024, 256
    freqs, rms = [], []
    for start in range(0, len(x) - frame, hop):
        seg = x[start:start + frame]
        r = float(np.sqrt(np.mean(seg ** 2)))
        rms.append(r)
        if r < 1e-3:
            continue
        seg = seg - seg.mean()
        ac = np.correlate(seg, seg, mode='full')[frame - 1:]
        ac /= (ac[0] + 1e-12)
        lo, hi = int(sr / 400), min(int(sr / 80), len(ac) - 2)
        if hi <= lo:
            continue
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.3:
            freqs.append(sr / lag)
    cents = []
    for start in range(0, len(x) - frame, frame // 2):
        seg = x[start:start + frame] * np.hanning(frame)
        mag = np.abs(np.fft.rfft(seg))
        if mag.sum() > 1e-9:
            fs = np.fft.rfftfreq(frame, 1.0 / sr)
            cents.append(float((fs * mag).sum() / mag.sum()))
    env = np.array(rms) / (max(rms) + 1e-12) if rms else np.array([])
    peaks = sum(1 for i in range(1, len(env) - 1) if env[i] > 0.35 and env[i] >= env[i - 1] and env[i] > env[i + 1])
    dur = len(x) / sr
    return {
        'file': os.path.basename(path),
        'duration_s': round(dur, 2),
        'f0_mean': round(float(np.mean(freqs)) if freqs else 0, 1),
        'f0_std': round(float(np.std(freqs)) if freqs else 0, 1),
        'centroid': round(float(np.mean(cents)) if cents else 0, 0),
        'syll_per_s': round(peaks / max(dur, 0.1), 2),
        'rms': round(float(np.mean(rms)) if rms else 0, 4),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dir', default=os.path.expanduser('~/.dsh/im-bridge/voice'))
    ap.add_argument('--last', type=int, default=8)
    ap.add_argument('--baseline', default='E:/workspace/audio.cpp/compare/orig-b.wav')
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.dir, 'c-*.wav')), key=os.path.getmtime)[-args.last:]
    if not files:
        print(json.dumps({'ok': False, 'error': '没有 c-*.wav'}, ensure_ascii=False))
        return 1

    base = analyze(args.baseline) if os.path.exists(args.baseline) else None
    rows = []
    for f in files:
        a = analyze(f)
        if base:
            a['d_centroid_pct'] = round(abs(a['centroid'] - base['centroid']) / max(base['centroid'], 1) * 100, 1)
            a['d_speed_pct'] = round(abs(a['syll_per_s'] - base['syll_per_s']) / max(base['syll_per_s'], 0.01) * 100, 1)
            a['verdict'] = 'OK' if a['d_centroid_pct'] < 15 and a['d_speed_pct'] < 30 else 'WARN'
        rows.append(a)

    warns = sum(1 for r in rows if r.get('verdict') == 'WARN')
    out = {'ok': warns == 0, 'baseline': base, 'samples': len(rows), 'warn': warns, 'rows': rows}
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return 0 if warns == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
