export const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;

export interface ChordQuality {
  id: string;
  label: string;
  intervals: number[];
}

export const QUALITIES: ChordQuality[] = [
  { id: "", label: "Maj", intervals: [0, 4, 7] },
  { id: "m", label: "m", intervals: [0, 3, 7] },
  { id: "7", label: "7", intervals: [0, 4, 7, 10] },
  { id: "M7", label: "M7", intervals: [0, 4, 7, 11] },
  { id: "m7", label: "m7", intervals: [0, 3, 7, 10] },
  { id: "sus4", label: "sus4", intervals: [0, 5, 7] },
  { id: "add9", label: "add9", intervals: [0, 4, 7, 14] },
  { id: "dim", label: "dim", intervals: [0, 3, 6] },
  { id: "aug", label: "aug", intervals: [0, 4, 8] },
  { id: "m7b5", label: "m7b5", intervals: [0, 3, 6, 10] },
];

export const DEGREE_ROMANS = ["I", "bII", "II", "bIII", "III", "IV", "#IV", "V", "bVI", "VI", "bVII", "VII"];

export interface ChordClip {
  root: number;       // 0..11 (C..B)
  quality: string;    // '', 'm', '7', 'M7', 'm7', etc.
  bass: number | null;
  beats: number;      // 1, 2, 3, 4, 6, 8
}

export interface ChordSketch {
  id: string;
  title: string;
  updatedAt: string;
  keyRoot: number;
  bpm: number;
  meter: number;
  playMode: "sustain" | "beat";
  chords: ChordClip[];
}

export function formatChordName(chord: ChordClip): string {
  const rootName = NOTES[chord.root] ?? "C";
  const bassPart = chord.bass !== null && chord.bass !== undefined ? `/${NOTES[chord.bass]}` : "";
  return `${rootName}${chord.quality}${bassPart}`;
}

export function analyzeChord(chord: ChordClip, keyRoot: number): {
  degLabel: string;
  func: "T" | "SD" | "D" | "Sub";
  color: string;
} {
  const rel = (chord.root - keyRoot + 12) % 12;
  const romanBase = DEGREE_ROMANS[rel];
  const degLabel = `${romanBase}${chord.quality}`;

  if (rel === 0 || rel === 4 || rel === 9) {
    return { degLabel, func: "T", color: "#00D2FF" }; // Ableton Cyan
  }
  if (rel === 5 || rel === 2) {
    return { degLabel, func: "SD", color: "#FF9D00" }; // Ableton Amber
  }
  if (rel === 7 || rel === 11) {
    return { degLabel, func: "D", color: "#FF5252" }; // Ableton Coral
  }
  return { degLabel, func: "Sub", color: "#B388FF" };
}

export function getChordMidiNotes(chord: ChordClip): number[] {
  const qObj = QUALITIES.find((q) => q.id === chord.quality) ?? QUALITIES[0];
  let rootMidi = 60 + chord.root;
  if (rootMidi > 65) rootMidi -= 12;

  const bassRoot = chord.bass !== null && chord.bass !== undefined ? chord.bass : chord.root;
  let bassMidi = 48 + bassRoot;
  if (bassMidi > 55) bassMidi -= 12;

  const chordNotes = qObj.intervals.map((intv) => rootMidi + intv);
  return [bassMidi, ...chordNotes];
}

export function buildStandardMidiFile(
  chords: ChordClip[],
  bpm: number,
  meter: number,
  playMode: "sustain" | "beat"
): Uint8Array {
  const ppq = 480;
  const mpqn = Math.round(60000000 / bpm);

  function writeVarLen(val: number): number[] {
    const bytes: number[] = [];
    let v = val;
    bytes.unshift(v & 0x7f);
    while ((v >>= 7)) {
      bytes.unshift((v & 0x7f) | 0x80);
    }
    return bytes;
  }

  const trackEvents: number[] = [];
  trackEvents.push(0x00, 0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff);
  trackEvents.push(0x00, 0xff, 0x58, 0x04, meter, 0x02, 0x18, 0x08);
  trackEvents.push(0x00, 0xc0, 0x00);

  chords.forEach((chord) => {
    const notes = getChordMidiNotes(chord);
    if (playMode === "sustain") {
      const ticks = chord.beats * ppq;
      notes.forEach((n) => trackEvents.push(0x00, 0x90, n, 88));
      notes.forEach((n, idx) => {
        const delta = idx === 0 ? ticks : 0;
        trackEvents.push(...writeVarLen(delta), 0x80, n, 0x00);
      });
    } else {
      for (let b = 0; b < chord.beats; b++) {
        notes.forEach((n) => trackEvents.push(0x00, 0x90, n, b === 0 ? 92 : 76));
        notes.forEach((n, idx) => {
          const delta = idx === 0 ? ppq : 0;
          trackEvents.push(...writeVarLen(delta), 0x80, n, 0x00);
        });
      }
    }
  });

  trackEvents.push(0x00, 0xff, 0x2f, 0x00);
  const tLen = trackEvents.length;
  const header = [
    0x4d, 0x54, 0x68, 0x64,
    0x00, 0x00, 0x00, 0x06,
    0x00, 0x00,
    0x00, 0x01,
    (ppq >> 8) & 0xff, ppq & 0xff,
    0x4d, 0x54, 0x72, 0x6b,
    (tLen >> 24) & 0xff,
    (tLen >> 16) & 0xff,
    (tLen >> 8) & 0xff,
    tLen & 0xff,
  ];

  return new Uint8Array([...header, ...trackEvents]);
}
