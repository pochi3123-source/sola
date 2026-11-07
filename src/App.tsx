import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import {
  NOTES,
  QUALITIES,
  ChordClip,
  ChordSketch,
  formatChordName,
  analyzeChord,
} from "./chordEngine";

const STORAGE_KEY = "kearu_chord_live_saved_v1";

export default function App() {
  const [title, setTitle] = useState("Floating Maj7 Sketch");
  const [keyRoot, setKeyRoot] = useState(0);
  const [bpm, setBpm] = useState(92);
  const [meter, setMeter] = useState(4);
  const [playMode, setPlayMode] = useState<"sustain" | "beat">("sustain");
  const [metronome, setMetronome] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [playingBeat, setPlayingBeat] = useState(-1);
  const [chords, setChords] = useState<ChordClip[]>([
    { root: 5, quality: "M7", bass: null, beats: 4 },
    { root: 7, quality: "7", bass: null, beats: 4 },
    { root: 4, quality: "m7", bass: null, beats: 4 },
    { root: 9, quality: "m7", bass: null, beats: 4 },
  ]);
  const [savedLibrary, setSavedLibrary] = useState<ChordSketch[]>([]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setSavedLibrary(JSON.parse(raw));
    });
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPlayingIndex(-1);
      setPlayingBeat(-1);
      return;
    }

    const curIdx = playingIndex >= 0 ? playingIndex : selectedIndex;
    const curBeat = playingBeat >= 0 ? playingBeat : 0;
    const currentChord = chords[curIdx];
    if (!currentChord) {
      setIsPlaying(false);
      return;
    }

    const secPerBeat = 60 / bpm;
    timerRef.current = setTimeout(() => {
      const nextBeat = curBeat + 1;
      if (nextBeat >= currentChord.beats) {
        const nextIdx = (curIdx + 1) % chords.length;
        setPlayingIndex(nextIdx);
        setSelectedIndex(nextIdx);
        setPlayingBeat(0);
      } else {
        setPlayingBeat(nextBeat);
      }
    }, secPerBeat * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, playingIndex, playingBeat, bpm, chords]);

  const activeChord = chords[selectedIndex];

  const updateSelectedChord = (patch: Partial<ChordClip>) => {
    setChords((prev) =>
      prev.map((c, idx) => (idx === selectedIndex ? { ...c, ...patch } : c))
    );
  };

  const transposeAll = (semi: number) => {
    setKeyRoot((k) => (k + semi + 12) % 12);
    setChords((prev) =>
      prev.map((c) => ({
        ...c,
        root: (c.root + semi + 12) % 12,
        bass: c.bass !== null ? (c.bass + semi + 12) % 12 : null,
      }))
    );
  };

  const copyProgressionText = async () => {
    const str = chords.map((c) => `${formatChordName(c)}(${c.beats})`).join(" → ");
    await Clipboard.setStringAsync(
      `${title} | Key: ${NOTES[keyRoot]} | ${bpm} BPM (${meter}/4)\n${str}`
    );
  };

  return (
    <SafeAreaView style={styles.shell}>
      {/* 1. ABLETON TRANSPORT BAR */}
      <View style={styles.transportBar}>
        <View style={styles.transportRow}>
          <View style={styles.brandBadge}>
            <View style={[styles.ledDot, isPlaying && styles.ledPlaying]} />
            <Text style={styles.brandText}>sola</Text>
          </View>
          <View style={styles.rowGap}>
            <TouchableOpacity
              style={[styles.abletonBtn, isPlaying && styles.greenActive]}
              onPress={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                } else {
                  setPlayingIndex(selectedIndex);
                  setPlayingBeat(0);
                  setIsPlaying(true);
                }
              }}
            >
              <Text style={[styles.btnText, isPlaying && styles.darkText]}>
                {isPlaying ? "▶ PLAYING" : "▶ PLAY"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.abletonBtn,
                playMode === "sustain" ? styles.amberActive : styles.cyanActive,
              ]}
              onPress={() =>
                setPlayMode((m) => (m === "sustain" ? "beat" : "sustain"))
              }
            >
              <Text style={[styles.btnText, styles.darkText]}>
                {playMode === "sustain" ? "― 伸ばす" : "・・ 刻む"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.abletonBtn, metronome && styles.yellowActive]}
              onPress={() => setMetronome((m) => !m)}
            >
              <Text style={[styles.btnText, metronome && styles.darkText]}>
                ●○ CLICK
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.transportRow}>
          <View style={styles.rowGap}>
            <TouchableOpacity
              style={styles.abletonBtn}
              onPress={() => setBpm((b) => Math.max(40, b - 2))}
            >
              <Text style={styles.btnText}>-</Text>
            </TouchableOpacity>
            <View style={styles.bpmBox}>
              <Text style={styles.bpmText}>{bpm} BPM</Text>
            </View>
            <TouchableOpacity
              style={styles.abletonBtn}
              onPress={() => setBpm((b) => Math.min(220, b + 2))}
            >
              <Text style={styles.btnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.abletonBtn}
            onPress={() => setMeter((m) => (m === 4 ? 3 : m === 3 ? 6 : 4))}
          >
            <Text style={styles.btnText}>{meter}/4</Text>
          </TouchableOpacity>

          <View style={styles.rowGap}>
            <TouchableOpacity
              style={styles.abletonBtn}
              onPress={() => transposeAll(-1)}
            >
              <Text style={styles.btnText}>-1</Text>
            </TouchableOpacity>
            <View style={styles.keyBox}>
              <Text style={styles.keyText}>KEY: {NOTES[keyRoot]}</Text>
            </View>
            <TouchableOpacity
              style={styles.abletonBtn}
              onPress={() => transposeAll(1)}
            >
              <Text style={styles.btnText}>+1</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 2. TRACK TITLE & SESSION CLIP GRID */}
      <View style={styles.sessionHeader}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Sketch Title..."
          placeholderTextColor="#666"
        />
        <TouchableOpacity style={[styles.abletonBtn, styles.amberActive]} onPress={copyProgressionText}>
          <Text style={[styles.btnText, styles.darkText]}>COPY TXT</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.sessionArea}>
        <View style={styles.clipGrid}>
          {chords.map((chord, idx) => {
            const { degLabel, func, color } = analyzeChord(chord, keyRoot);
            const isSel = idx === selectedIndex;
            const isPlay = isPlaying && idx === playingIndex;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.clipSlot,
                  { borderLeftColor: color, borderLeftWidth: 5 },
                  isSel && styles.clipSelected,
                  isPlay && styles.clipPlaying,
                ]}
                onPress={() => setSelectedIndex(idx)}
              >
                <View style={styles.clipTop}>
                  <Text style={styles.clipIndex}>▶ CLIP {idx + 1}</Text>
                  <Text style={[styles.degreeBadge, { color }]}>
                    {degLabel} ({func})
                  </Text>
                </View>
                <Text style={styles.clipChordName}>{formatChordName(chord)}</Text>
                <View style={styles.beatRow}>
                  <Text style={styles.beatLabel}>{chord.beats}拍</Text>
                  <View style={styles.ledStrip}>
                    {Array.from({ length: chord.beats }).map((_, b) => (
                      <View
                        key={b}
                        style={[
                          styles.beatLed,
                          isPlay && playingBeat === b && styles.beatLedActive,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.addClipSlot}
            onPress={() => {
              const next: ChordClip = {
                root: keyRoot,
                quality: "M7",
                bass: null,
                beats: meter,
              };
              setChords((prev) => [...prev, next]);
              setSelectedIndex(chords.length);
            }}
          >
            <Text style={styles.addClipText}>＋ ADD CLIP ({meter}拍)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 3. ABLETON DEVICE VIEW (CHORD PICKER) */}
      <View style={styles.deviceRack}>
        <View style={styles.rootGrid}>
          {NOTES.map((n, rIdx) => (
            <TouchableOpacity
              key={n}
              style={[
                styles.padBtn,
                activeChord?.root === rIdx && styles.amberActive,
              ]}
              onPress={() => updateSelectedChord({ root: rIdx })}
            >
              <Text
                style={[
                  styles.btnText,
                  activeChord?.root === rIdx && styles.darkText,
                ]}
              >
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.qualGrid}>
          {QUALITIES.map((q) => (
            <TouchableOpacity
              key={q.label}
              style={[
                styles.padBtn,
                activeChord?.quality === q.id && styles.cyanActive,
              ]}
              onPress={() => updateSelectedChord({ quality: q.id })}
            >
              <Text
                style={[
                  styles.btnText,
                  activeChord?.quality === q.id && styles.darkText,
                ]}
              >
                {q.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.rowGap}>
          {[1, 2, 3, 4, 6, 8].map((bVal) => (
            <TouchableOpacity
              key={bVal}
              style={[
                styles.padBtn,
                { flex: 1 },
                activeChord?.beats === bVal && styles.amberActive,
              ]}
              onPress={() => updateSelectedChord({ beats: bVal })}
            >
              <Text
                style={[
                  styles.btnText,
                  activeChord?.beats === bVal && styles.darkText,
                ]}
              >
                {bVal}拍
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: "#1E1E1E" },
  transportBar: {
    backgroundColor: "#181818",
    borderBottomWidth: 2,
    borderBottomColor: "#111111",
    padding: 8,
    gap: 6,
  },
  transportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 4 },
  brandBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  ledDot: { width: 8, height: 8, backgroundColor: "#444" },
  ledPlaying: { backgroundColor: "#00FF66" },
  brandText: { color: "#A0A0A0", fontSize: 11, fontWeight: "700" },
  abletonBtn: {
    backgroundColor: "#363636",
    borderWidth: 1,
    borderColor: "#111",
    paddingHorizontal: 8,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 2,
  },
  amberActive: { backgroundColor: "#FF9D00" },
  cyanActive: { backgroundColor: "#00D2FF" },
  yellowActive: { backgroundColor: "#FFD000" },
  greenActive: { backgroundColor: "#00FF66" },
  btnText: { color: "#E6E6E6", fontSize: 11, fontWeight: "700" },
  darkText: { color: "#111111" },
  bpmBox: {
    backgroundColor: "#121212",
    paddingHorizontal: 8,
    height: 28,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#111",
  },
  bpmText: { color: "#FF9D00", fontSize: 12, fontWeight: "700" },
  keyBox: {
    backgroundColor: "#121212",
    paddingHorizontal: 8,
    height: 28,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#111",
  },
  keyText: { color: "#00D2FF", fontSize: 12, fontWeight: "700" },
  sessionHeader: {
    flexDirection: "row",
    backgroundColor: "#282828",
    padding: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#111",
  },
  titleInput: {
    flex: 1,
    backgroundColor: "#161616",
    color: "#FFF",
    paddingHorizontal: 8,
    height: 28,
    fontSize: 12,
    fontWeight: "700",
  },
  sessionArea: { flex: 1, backgroundColor: "#1C1C1C", padding: 8 },
  clipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  clipSlot: {
    width: "48%",
    backgroundColor: "#323232",
    borderWidth: 1,
    borderColor: "#111",
    padding: 8,
    borderRadius: 2,
    minHeight: 72,
    justifyContent: "space-between",
  },
  clipSelected: { borderColor: "#FF9D00", borderWidth: 2 },
  clipPlaying: { backgroundColor: "#24382B", borderColor: "#00FF66", borderWidth: 2 },
  clipTop: { flexDirection: "row", justifyContent: "space-between" },
  clipIndex: { color: "#999", fontSize: 10, fontWeight: "700" },
  degreeBadge: { fontSize: 10, fontWeight: "700" },
  clipChordName: { color: "#FFF", fontSize: 20, fontWeight: "800", marginVertical: 2 },
  beatRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  beatLabel: { color: "#FF9D00", fontSize: 10, fontWeight: "700" },
  ledStrip: { flex: 1, flexDirection: "row", gap: 3 },
  beatLed: { flex: 1, height: 5, backgroundColor: "#181818" },
  beatLedActive: { backgroundColor: "#00FF66" },
  addClipSlot: {
    width: "48%",
    minHeight: 72,
    backgroundColor: "#242424",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#4A4A4A",
    justifyContent: "center",
    alignItems: "center",
  },
  addClipText: { color: "#999", fontSize: 11, fontWeight: "700" },
  deviceRack: {
    backgroundColor: "#2B2B2B",
    borderTopWidth: 2,
    borderTopColor: "#111",
    padding: 8,
    gap: 6,
  },
  rootGrid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  qualGrid: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  padBtn: {
    width: "15.8%",
    height: 30,
    backgroundColor: "#3A3A3A",
    borderWidth: 1,
    borderColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 2,
  },
});
