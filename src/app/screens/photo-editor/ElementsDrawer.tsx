import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Slider, Tabs } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import type { ShapeKind } from '@modules/photo-editor/layers';

const TABS = ['Texto', 'Formas', 'Adesivos', 'Meme', 'Colagem'] as const;
type ElementsTab = (typeof TABS)[number];

const SHAPES: { label: string; kind: ShapeKind }[] = [
  { label: 'Círculo', kind: 'circle' },
  { label: 'Retângulo', kind: 'rect' },
  { label: 'Linha', kind: 'line' },
  { label: 'Seta', kind: 'arrow' },
];

// RF-008: real, distinct Android system font families (via Skia's system FontMgr) — no
// bundled font files needed, unlike the Google Fonts names this drawer used to show.
export const TEXT_FONTS = [
  { label: 'Padrão', family: 'sans-serif' },
  { label: 'Condensada', family: 'sans-serif-condensed' },
  { label: 'Serifada', family: 'serif' },
  { label: 'Monoespaçada', family: 'monospace' },
  { label: 'Negrito extra', family: 'sans-serif-black' },
];
const TEXT_COLORS = [colors.texto, colors.acento, colors.perigo, colors.ok, colors.alerta];

// RF-046: stickers are just emoji glyphs — the system font already renders them, so they
// reuse the exact same real text-layer pipeline as any other overlaid text.
const STICKERS = ['👍', '😂', '🔥', '❤️', '😮', '🎉'];

export interface TextDraft {
  content: string;
  fontFamily: string;
  color: string;
  shadow: boolean;
  strokeWidth: number;
  entrada: number;
  saida: number;
}

export interface ShapeDraft {
  kind: ShapeKind;
  color: string;
  strokeWidth: number;
}

interface ElementsDrawerProps {
  textDraft: TextDraft;
  onChangeTextDraft: (patch: Partial<TextDraft>) => void;
  onSubmitText: () => void;
  isEditingText: boolean;
  shapeDraft: ShapeDraft;
  onChangeShapeDraft: (patch: Partial<ShapeDraft>) => void;
  onSubmitShape: () => void;
  isEditingShape: boolean;
  onSubmitMeme: (top: string, bottom: string) => void;
  onAddSticker: (emoji: string) => void;
}

/**
 * Elementos drawer. TODO: collage (RF-011) is still a placeholder — Texto (RF-008), Formas
 * (RF-044), Meme and Adesivos (RF-046) all draw for real, onto the Skia canvas in
 * PhotoEditorScreen (memes/stickers reuse the same text-layer pipeline as Texto).
 */
export function ElementsDrawer({
  textDraft,
  onChangeTextDraft,
  onSubmitText,
  isEditingText,
  shapeDraft,
  onChangeShapeDraft,
  onSubmitShape,
  isEditingShape,
  onSubmitMeme,
  onAddSticker,
}: ElementsDrawerProps) {
  const [tab, setTab] = useState<ElementsTab>('Texto');
  const [memeTop, setMemeTop] = useState('');
  const [memeBottom, setMemeBottom] = useState('');

  return (
    <View>
      <Tabs tabs={TABS} active={tab} onChange={setTab} scrollable />
      {tab === 'Texto' && (
        <View style={{ padding: 12 }}>
          <TextInput
            style={styles.contentInput}
            value={textDraft.content}
            onChangeText={(content) => onChangeTextDraft({ content })}
            placeholder="Digite o texto"
            placeholderTextColor={colors.texto2}
          />
          <View style={styles.fontRow}>
            {TEXT_FONTS.map((f) => (
              <Pressable
                key={f.family}
                style={[
                  styles.fontChip,
                  textDraft.fontFamily === f.family && styles.fontChipActive,
                ]}
                onPress={() => onChangeTextDraft({ fontFamily: f.family })}
              >
                <Text
                  style={[
                    styles.fontChipText,
                    textDraft.fontFamily === f.family && styles.fontChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.colorRow}>
            {TEXT_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  textDraft.color === c && styles.colorSwatchActive,
                ]}
                onPress={() => onChangeTextDraft({ color: c })}
              />
            ))}
          </View>
          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggleChip, textDraft.shadow && styles.toggleChipActive]}
              onPress={() => onChangeTextDraft({ shadow: !textDraft.shadow })}
            >
              <Text style={[styles.fontChipText, textDraft.shadow && styles.fontChipTextActive]}>
                Sombra
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggleChip, textDraft.strokeWidth > 0 && styles.toggleChipActive]}
              onPress={() => onChangeTextDraft({ strokeWidth: textDraft.strokeWidth > 0 ? 0 : 2 })}
            >
              <Text
                style={[
                  styles.fontChipText,
                  textDraft.strokeWidth > 0 && styles.fontChipTextActive,
                ]}
              >
                Contorno
              </Text>
            </Pressable>
          </View>
          <Text style={styles.sectionLabel}>Animação (vídeo)</Text>
          <Slider
            label="Entrada"
            value={textDraft.entrada}
            min={0}
            max={100}
            onChange={(v) => onChangeTextDraft({ entrada: v })}
          />
          <Slider
            label="Saída"
            value={textDraft.saida}
            min={0}
            max={100}
            onChange={(v) => onChangeTextDraft({ saida: v })}
          />
          <Pressable
            style={[styles.submitButton, !textDraft.content.trim() && styles.submitButtonDisabled]}
            onPress={onSubmitText}
            disabled={!textDraft.content.trim()}
          >
            <Text style={styles.submitButtonText}>
              {isEditingText ? 'APLICAR' : 'ADICIONAR AO CANVAS'}
            </Text>
          </Pressable>
        </View>
      )}
      {tab === 'Formas' && (
        <View style={{ padding: 12 }}>
          <View style={styles.fontRow}>
            {SHAPES.map((s) => (
              <Pressable
                key={s.kind}
                style={[styles.fontChip, shapeDraft.kind === s.kind && styles.fontChipActive]}
                onPress={() => onChangeShapeDraft({ kind: s.kind })}
              >
                <Text
                  style={[
                    styles.fontChipText,
                    shapeDraft.kind === s.kind && styles.fontChipTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.colorRow}>
            {TEXT_COLORS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c },
                  shapeDraft.color === c && styles.colorSwatchActive,
                ]}
                onPress={() => onChangeShapeDraft({ color: c })}
              />
            ))}
          </View>
          <Slider
            label="Espessura"
            value={shapeDraft.strokeWidth}
            min={1}
            max={20}
            onChange={(v) => onChangeShapeDraft({ strokeWidth: v })}
          />
          <Pressable style={styles.submitButton} onPress={onSubmitShape}>
            <Text style={styles.submitButtonText}>
              {isEditingShape ? 'APLICAR' : 'ADICIONAR AO CANVAS'}
            </Text>
          </Pressable>
        </View>
      )}
      {tab === 'Adesivos' && (
        <View style={styles.stickerGrid}>
          {STICKERS.map((emoji) => (
            <Pressable key={emoji} style={styles.stickerCell} onPress={() => onAddSticker(emoji)}>
              <Text style={styles.stickerEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {tab === 'Meme' && (
        <View style={{ padding: 12 }}>
          <TextInput
            style={styles.contentInput}
            value={memeTop}
            onChangeText={setMemeTop}
            placeholder="Texto de cima"
            placeholderTextColor={colors.texto2}
          />
          <TextInput
            style={styles.contentInput}
            value={memeBottom}
            onChangeText={setMemeBottom}
            placeholder="Texto de baixo"
            placeholderTextColor={colors.texto2}
          />
          <Pressable
            style={[
              styles.submitButton,
              !memeTop.trim() && !memeBottom.trim() && styles.submitButtonDisabled,
            ]}
            onPress={() => {
              onSubmitMeme(memeTop, memeBottom);
              setMemeTop('');
              setMemeBottom('');
            }}
            disabled={!memeTop.trim() && !memeBottom.trim()}
          >
            <Text style={styles.submitButtonText}>CRIAR MEME</Text>
          </Pressable>
        </View>
      )}
      {tab === 'Colagem' && (
        <View style={styles.collageGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.collageCard}>
              <View style={[styles.collageCell, i % 2 === 0 && styles.collageCellTall]} />
              <View style={styles.collageCell} />
              {i % 2 !== 0 && <View style={styles.collageCell} />}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contentInput: {
    borderWidth: 1,
    borderColor: colors.linha,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.texto,
    fontSize: fontSize.sm,
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  toggleChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  toggleChipActive: {
    borderColor: colors.acento,
  },
  submitButton: {
    height: 40,
    backgroundColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#0D2036',
  },
  fontRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  fontChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  fontChipActive: {
    borderColor: colors.acento,
  },
  fontChipText: {
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  fontChipTextActive: {
    color: colors.acento,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  colorSwatchActive: {
    borderColor: colors.texto,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    marginBottom: 6,
  },
  collageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  collageCard: {
    width: '30%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: colors.linha,
    backgroundColor: colors.faixa,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    padding: 4,
  },
  collageCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.linha,
  },
  collageCellTall: {
    minHeight: '100%',
  },
  placeholderText: {
    padding: 16,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
  },
  stickerCell: {
    width: 56,
    height: 56,
    borderWidth: 1,
    borderColor: colors.linha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickerEmoji: {
    fontSize: 28,
  },
});
