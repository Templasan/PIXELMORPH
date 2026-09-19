import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, Slider, Tabs } from '@core/ui';
import { colors, fontSize } from '@core/theme';
import { createProjectsModule } from '@modules/projects';
import type { Project } from '@modules/projects';
import {
  BLEND_MODE_LABELS,
  FRAME_STYLES,
  LIGHT_TYPES,
  OVERLAY_TEXTURE_NAMES,
} from '@modules/photo-editor/effects';

const TABS = ['Retrô', 'Molduras', 'Iluminação', 'Dupla exposição', 'Overlays'] as const;
type EffectsTab = (typeof TABS)[number];

const SWATCHES = ['#111111', '#FFFFFF', '#E5484D', '#F5A623', '#F5D90A', '#30A46C', '#3B82F6'];

export interface DoubleExposureImage {
  projectId: string;
  name: string;
  uri: string;
}

interface EffectsAdjustmentsLike {
  retroAging: number;
  retroAgingBlend: number;
  retroGrain: number;
  retroGrainBlend: number;
  retroVignette: number;
  retroVignetteBlend: number;
  frameStyle: number;
  frameThickness: number;
  frameRadius: number;
  lightType: number;
  lightIntensity: number;
  doubleExposureBlend: number;
  doubleExposureOpacity: number;
  overlayType: number;
  overlayIntensity: number;
  overlayOpacity: number;
  [key: string]: number;
}

interface EffectsDrawerProps {
  adjustments: EffectsAdjustmentsLike;
  setField: (field: string, value: number) => void;
  onCommit: (field: string, value: number, previousValue: number) => void;
  frameColor: string;
  onFrameColorChange: (color: string) => void;
  frameGradientColor: string;
  onFrameGradientColorChange: (color: string) => void;
  lightEditMode: boolean;
  onToggleLightEditMode: () => void;
  doubleExposureImage: DoubleExposureImage | null;
  onPickDoubleExposureImage: (image: DoubleExposureImage) => void;
  onClearDoubleExposureImage: () => void;
  currentProjectId?: string;
}

/** Efeitos drawer: RF-041/060/068/075/028 — every control here drives a real GPU pass. */
export function EffectsDrawer({
  adjustments,
  setField,
  onCommit,
  frameColor,
  onFrameColorChange,
  frameGradientColor,
  onFrameGradientColorChange,
  lightEditMode,
  onToggleLightEditMode,
  doubleExposureImage,
  onPickDoubleExposureImage,
  onClearDoubleExposureImage,
  currentProjectId,
}: EffectsDrawerProps) {
  const [tab, setTab] = useState<EffectsTab>('Retrô');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    if (!pickerOpen || projects !== null) return;
    const { listProjects } = createProjectsModule();
    listProjects
      .execute()
      .then((all) => setProjects(all.filter((p) => p.id !== currentProjectId && p.thumbnailUri)))
      .catch(() => setProjects([]));
  }, [pickerOpen, projects, currentProjectId]);

  const slider = (label: string, field: string, opts: { min: number; max: number }) => (
    <Slider
      label={label}
      value={adjustments[field]}
      min={opts.min}
      max={opts.max}
      onChange={(v) => setField(field, v)}
      onSlidingComplete={(v, from) => onCommit(field, v, from)}
    />
  );

  const chipRow = useCallback(
    (names: readonly string[], field: string, value: number) => (
      <View style={styles.chipRow}>
        {names.map((name, i) => {
          const active = value === i;
          return (
            <Pressable
              key={name}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onCommit(field, i, value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
    ),
    [onCommit]
  );

  return (
    <View>
      <Tabs tabs={TABS} active={tab} onChange={setTab} scrollable />

      {tab === 'Retrô' && (
        <View style={{ paddingTop: 8 }}>
          <Text style={styles.groupLabel}>Envelhecimento</Text>
          {slider('Intensidade', 'retroAging', { min: 0, max: 100 })}
          {slider('Mesclagem', 'retroAgingBlend', { min: 0, max: 100 })}
          <Text style={styles.groupLabel}>Granulado</Text>
          {slider('Intensidade', 'retroGrain', { min: 0, max: 100 })}
          {slider('Mesclagem', 'retroGrainBlend', { min: 0, max: 100 })}
          <Text style={styles.groupLabel}>Vinheta</Text>
          {slider('Intensidade', 'retroVignette', { min: 0, max: 100 })}
          {slider('Mesclagem', 'retroVignetteBlend', { min: 0, max: 100 })}
        </View>
      )}

      {tab === 'Molduras' && (
        <View style={{ paddingTop: 8 }}>
          {chipRow(FRAME_STYLES, 'frameStyle', adjustments.frameStyle)}
          {adjustments.frameStyle > 0 && (
            <>
              {slider('Espessura', 'frameThickness', { min: 0, max: 100 })}
              {adjustments.frameStyle === 2 && slider('Raio', 'frameRadius', { min: 0, max: 100 })}
              <Text style={styles.groupLabel}>Cor</Text>
              <View style={styles.swatchRow}>
                {SWATCHES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => onFrameColorChange(c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      frameColor === c && styles.swatchActive,
                    ]}
                  />
                ))}
              </View>
              {adjustments.frameStyle === 4 && (
                <>
                  <Text style={styles.groupLabel}>Cor do degradê</Text>
                  <View style={styles.swatchRow}>
                    {SWATCHES.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => onFrameGradientColorChange(c)}
                        style={[
                          styles.swatch,
                          { backgroundColor: c },
                          frameGradientColor === c && styles.swatchActive,
                        ]}
                      />
                    ))}
                  </View>
                </>
              )}
            </>
          )}
        </View>
      )}

      {tab === 'Iluminação' && (
        <View style={{ paddingTop: 8 }}>
          {chipRow(LIGHT_TYPES, 'lightType', adjustments.lightType)}
          {slider('Intensidade', 'lightIntensity', { min: 0, max: 100 })}
          <View style={styles.positionSection}>
            <Pressable
              style={[styles.positionButton, lightEditMode && styles.positionButtonActive]}
              onPress={onToggleLightEditMode}
            >
              <Icon name="sun" size={14} color={lightEditMode ? colors.acento : colors.texto2} />
              <Text
                style={[
                  styles.positionButtonText,
                  lightEditMode && styles.positionButtonTextActive,
                ]}
              >
                {lightEditMode ? 'Posicionando luz' : 'Posicionar luz'}
              </Text>
            </Pressable>
          </View>
          {lightEditMode && (
            <Text style={styles.hintText}>Arraste o ponto na foto para posicionar a luz.</Text>
          )}
        </View>
      )}

      {tab === 'Dupla exposição' && (
        <View style={{ paddingTop: 8 }}>
          {doubleExposureImage ? (
            <View style={styles.pickedRow}>
              <Image source={{ uri: doubleExposureImage.uri }} style={styles.pickedThumb} />
              <Text style={styles.pickedName} numberOfLines={1}>
                {doubleExposureImage.name}
              </Text>
              <Pressable onPress={onClearDoubleExposureImage} hitSlop={6}>
                <Icon name="x" size={14} color={colors.texto2} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.pickButton} onPress={() => setPickerOpen((v) => !v)}>
              <Icon name="image" size={14} color={colors.texto2} />
              <Text style={styles.pickButtonText}>Escolher imagem do projeto</Text>
            </Pressable>
          )}
          {pickerOpen && !doubleExposureImage && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.projectRow}
            >
              {projects === null && <Text style={styles.hintText}>Carregando projetos…</Text>}
              {projects !== null && projects.length === 0 && (
                <Text style={styles.hintText}>Nenhum outro projeto com foto disponível.</Text>
              )}
              {projects?.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.projectItem}
                  onPress={() => {
                    onPickDoubleExposureImage({
                      projectId: p.id,
                      name: p.name,
                      uri: p.thumbnailUri as string,
                    });
                    setPickerOpen(false);
                  }}
                >
                  <Image source={{ uri: p.thumbnailUri }} style={styles.projectThumb} />
                  <Text style={styles.projectName} numberOfLines={1}>
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {doubleExposureImage && (
            <>
              {chipRow(BLEND_MODE_LABELS, 'doubleExposureBlend', adjustments.doubleExposureBlend)}
              {slider('Opacidade', 'doubleExposureOpacity', { min: 0, max: 100 })}
            </>
          )}
        </View>
      )}

      {tab === 'Overlays' && (
        <View style={{ paddingTop: 8 }}>
          <Text style={styles.groupLabel}>Repositório interno</Text>
          {chipRow(OVERLAY_TEXTURE_NAMES, 'overlayType', adjustments.overlayType)}
          {adjustments.overlayType > 0 && (
            <>
              {slider('Intensidade', 'overlayIntensity', { min: 0, max: 100 })}
              {slider('Opacidade', 'overlayOpacity', { min: 0, max: 100 })}
            </>
          )}
          <View style={styles.disabledRow}>
            <Icon name="image" size={14} color={colors.linha} />
            <View style={{ flex: 1 }}>
              <Text style={styles.disabledRowText}>Galeria do dispositivo</Text>
              <Text style={styles.disabledRowCaption}>
                Requer o módulo de acesso à galeria, ainda não instalado neste build.
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.texto2,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  chipActive: {
    borderColor: colors.acento,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  chipTextActive: {
    color: colors.acento,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  swatchActive: {
    borderColor: colors.acento,
    borderWidth: 2,
  },
  positionSection: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  positionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  positionButtonActive: {
    borderColor: colors.acento,
  },
  positionButtonText: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  positionButtonTextActive: {
    color: colors.acento,
  },
  hintText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  pickButtonText: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  pickedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    paddingVertical: 6,
  },
  pickedThumb: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  pickedName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  projectRow: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  projectItem: {
    alignItems: 'center',
    gap: 4,
    width: 64,
  },
  projectThumb: {
    width: 64,
    height: 48,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  projectName: {
    fontSize: 9,
    color: colors.texto2,
    textAlign: 'center',
  },
  disabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  disabledRowText: {
    fontSize: fontSize.sm,
    color: colors.texto2,
  },
  disabledRowCaption: {
    fontSize: 9,
    color: colors.linha,
    marginTop: 2,
  },
});
