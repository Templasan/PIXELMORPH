import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Slider, Switch } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { useStore } from '@core/state';
import type { Clip, VideoEditorStore } from '@modules/video-editor';
import {
  MAX_TEXT_SIZE,
  MIN_TEXT_SIZE,
  TEXT_ANIMATIONS,
  TEXT_FONTS,
  TEXT_OUTLINE_WIDTH,
  type ClipText,
  type TextAnimation,
} from '@modules/video-editor/domain/textCaption';
import { previewSession, previewSettings } from './previewSettings';
import { captionName } from './textEdit';

const TEXT_COLORS = [
  colors.branco,
  colors.preto,
  colors.acento,
  colors.perigo,
  colors.ok,
  colors.alerta,
];
const ANIM_MS_MAX = 2000;

type AnimKey = 'animIn' | 'animOut';

/** The text tab of a clip on the TXT track. Remount it per clip (key=clip id). */
export function TextClipTab({ editor, clip }: { editor: VideoEditorStore; clip: Clip }) {
  const engine = useStore(previewSettings, (s) => s.engine);
  const fallback = useStore(previewSession, (s) => s.fallback);
  const text = clip.text;
  const [draft, setDraft] = useState(text?.content ?? '');
  useEffect(() => setDraft(text?.content ?? ''), [text?.content]);

  // The text is drawn by the web engine only; the native preview and export ignore it.
  if (!text) return null;
  if (engine !== 'web' || fallback) {
    return (
      <Text style={styles.note}>
        O texto aparece no motor de vídeo novo (toque no selo de qualidade da prévia para ativar).
      </Text>
    );
  }

  const mapText = (fn: (t: ClipText) => ClipText) => (c: Clip) =>
    c.text ? { ...c, text: fn(c.text) } : c;
  // Discrete edits: one undo entry each.
  // Tapping a control does not blur the field on Android: dismissing the keyboard does, which
  // commits the typed text (onEndEditing) before this edit.
  const patch = (p: Partial<ClipText>) => {
    Keyboard.dismiss();
    editor.commitClip(mapText((t) => ({ ...t, ...p })));
  };
  const commitContent = () => {
    if (draft === text.content) return;
    editor.commitClip((c) =>
      c.text ? { ...c, name: captionName(draft), text: { ...c.text, content: draft } } : c
    );
  };
  const patchAnim = (key: AnimKey, p: Partial<{ type: TextAnimation; ms: number }>) => {
    Keyboard.dismiss();
    editor.commitClip(mapText((t) => ({ ...t, [key]: { ...t[key], ...p } })));
  };
  // Gestures (sliders): live while dragging, one undo entry at release.
  const liveAnimMs = (key: AnimKey, ms: number) =>
    editor.liveClip(mapText((t) => ({ ...t, [key]: { ...t[key], ms } })));

  const renderAnim = (key: AnimKey, title: string) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipRow}>
        {TEXT_ANIMATIONS.map((a) => {
          const active = text[key].type === a.id;
          return (
            <Pressable
              key={a.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => patchAnim(key, { type: a.id })}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Slider
        label="Duração"
        value={text[key].ms}
        min={0}
        max={ANIM_MS_MAX}
        step={50}
        unit=" ms"
        onChange={(v) => liveAnimMs(key, v)}
        onSlidingComplete={() => editor.endGesture()}
      />
    </View>
  );

  return (
    <View style={styles.section}>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        onEndEditing={commitContent}
        multiline
        placeholder="Digite o texto"
        placeholderTextColor={colors.texto2}
      />
      <View style={styles.chipRow}>
        {TEXT_FONTS.map((f) => (
          <Pressable
            key={f.family}
            style={[styles.chip, text.fontFamily === f.family && styles.chipActive]}
            onPress={() => patch({ fontFamily: f.family })}
          >
            <Text style={[styles.chipText, text.fontFamily === f.family && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.chipRow}>
        {TEXT_COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityLabel={`Cor ${c}`}
            onPress={() => patch({ color: c })}
            style={[styles.swatch, { backgroundColor: c }, text.color === c && styles.swatchActive]}
          />
        ))}
      </View>
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Switch label="Sombra" value={text.shadow} onChange={(v) => patch({ shadow: v })} />
        </View>
        <View style={{ flex: 1 }}>
          <Switch
            label="Contorno"
            value={text.strokeWidth > 0}
            onChange={(v) => patch({ strokeWidth: v ? TEXT_OUTLINE_WIDTH : 0 })}
          />
        </View>
      </View>
      <Slider
        label="Tamanho"
        value={Math.round(text.size * 100)}
        min={Math.round(MIN_TEXT_SIZE * 100)}
        max={Math.round(MAX_TEXT_SIZE * 100)}
        unit="%"
        onChange={(v) => editor.liveClip(mapText((t) => ({ ...t, size: v / 100 })))}
        onSlidingComplete={() => editor.endGesture()}
      />
      {renderAnim('animIn', 'Entrada')}
      {renderAnim('animOut', 'Saída')}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.linha,
    color: colors.texto,
    fontSize: fontSize.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  chipActive: {
    borderColor: colors.acento,
  },
  chipText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  chipTextActive: {
    color: colors.acento,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.linha,
  },
  swatchActive: {
    borderColor: colors.acento,
  },
  switchRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
