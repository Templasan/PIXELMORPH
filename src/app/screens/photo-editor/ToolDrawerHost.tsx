import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { SkImage, SkRuntimeEffect } from '@shopify/react-native-skia';
import { colors } from '@core/theme';
import type { PhotoEditorStore, RGBHistogram } from '@modules/photo-editor';
import { adjustmentUniforms } from '@modules/photo-editor/domain/adjustments';
import { AdjustDrawerHost, WithAdjustments } from './WithAdjustments';
import { GeometryDrawer } from './GeometryDrawer';
import { MasksDrawer } from './MasksDrawer';
import { RetouchDrawer } from './RetouchDrawer';
import { EffectsDrawer, type DoubleExposureImage } from './EffectsDrawer';
import { ElementsDrawer, type ShapeDraft, type TextDraft } from './ElementsDrawer';
import { AIDrawer } from './AIDrawer';
import { PresetsDrawer } from './PresetsDrawer';
import { PanoramaDrawer } from './PanoramaDrawer';

type Tool =
  | 'ajustes'
  | 'geometria'
  | 'mascaras'
  | 'retoque'
  | 'camadas'
  | 'efeitos'
  | 'elementos'
  | 'ia'
  | 'presets'
  | 'panorama'
  | null;

interface ToolDrawerHostProps {
  activeTool: Tool;
  editor: PhotoEditorStore;
  histogram: { compute: (uniforms: ReturnType<typeof adjustmentUniforms>) => RGBHistogram } | null;
  skiaImage: SkImage | null;
  adjustmentsEffect: SkRuntimeEffect | null;
  perspectiveEditMode: boolean;
  frameColor: string;
  frameGradientColor: string;
  lightEditMode: boolean;
  doubleExposureImage: DoubleExposureImage | null;
  overlayImage: { name: string; uri: string } | null;
  currentProjectId: string | undefined;
  textDraft: TextDraft;
  selectedLayerKind: string | undefined;
  shapeDraft: ShapeDraft;
  selectedPanoramaImages: { uri: string; id: string }[];
  panoramaOffsets: number[];
  panoramaOverlapWidth: number;
  isStitching: boolean;
  onSetAdjustmentField: (key: string, value: number) => void;
  onCommitAdjustment: (key: string, value: number, from: number) => void;
  onBakeAdjustments: () => void;
  onTogglePerspectiveEditMode: () => void;
  onApplyExif: () => void;
  onBakePerspective: () => void;
  onChangeTextDraft: (patch: Partial<TextDraft>) => void;
  onSubmitText: () => void;
  onChangeShapeDraft: (patch: Partial<ShapeDraft>) => void;
  onSubmitShape: () => void;
  onSubmitMeme: (top: string, bottom: string) => void;
  onAddSticker: (emoji: string) => void;
  onSubmitCollage: (
    layout: any,
    uris: string[],
    options: { spacing: number; borderWidth: number; borderColor: string }
  ) => Promise<void>;
  onChangeFrameColor: (color: string) => void;
  onChangeFrameGradientColor: (color: string) => void;
  onToggleLightEditMode: () => void;
  onPickDoubleExposureImage: (image: DoubleExposureImage) => void;
  onClearDoubleExposureImage: () => void;
  onPickOverlayImage: (image: { name: string; uri: string }) => void;
  onClearOverlayImage: () => void;
  onAddPanoramaImage: () => void;
  onRemovePanoramaImage: (id: string) => void;
  onPanoramaOffsetChange: (index: number, offset: number) => void;
  onPanoramaOverlapChange: (overlap: number) => void;
  onSubmitPanorama: () => void;
}

export const ToolDrawerHost = memo(function ToolDrawerHost({
  activeTool,
  editor,
  histogram,
  skiaImage,
  adjustmentsEffect,
  perspectiveEditMode,
  frameColor,
  frameGradientColor,
  lightEditMode,
  doubleExposureImage,
  overlayImage,
  currentProjectId,
  textDraft,
  selectedLayerKind,
  shapeDraft,
  selectedPanoramaImages,
  panoramaOffsets,
  panoramaOverlapWidth,
  isStitching,
  onSetAdjustmentField,
  onCommitAdjustment,
  onBakeAdjustments,
  onTogglePerspectiveEditMode,
  onApplyExif,
  onBakePerspective,
  onChangeTextDraft,
  onSubmitText,
  onChangeShapeDraft,
  onSubmitShape,
  onSubmitMeme,
  onAddSticker,
  onSubmitCollage,
  onChangeFrameColor,
  onChangeFrameGradientColor,
  onToggleLightEditMode,
  onPickDoubleExposureImage,
  onClearDoubleExposureImage,
  onPickOverlayImage,
  onClearOverlayImage,
  onAddPanoramaImage,
  onRemovePanoramaImage,
  onPanoramaOffsetChange,
  onPanoramaOverlapChange,
  onSubmitPanorama,
}: ToolDrawerHostProps) {
  if (!activeTool || activeTool === 'camadas') {
    return null;
  }

  return (
    <View style={styles.toolDrawer}>
      <View style={styles.drawerHandleRow}>
        <View style={styles.drawerHandle} />
      </View>
      <ScrollView style={{ flex: 1 }}>
        {activeTool === 'ajustes' && histogram && (
          <AdjustDrawerHost
            editor={editor}
            histogram={histogram}
            setField={onSetAdjustmentField}
            onCommit={onCommitAdjustment}
            onBake={onBakeAdjustments}
            skiaImage={skiaImage}
            adjustmentsEffect={adjustmentsEffect}
          />
        )}
        {activeTool === 'geometria' && (
          <WithAdjustments editor={editor}>
            {(adjustments) => (
              <GeometryDrawer
                adjustments={adjustments}
                setField={onSetAdjustmentField}
                onCommit={onCommitAdjustment}
                perspectiveEditMode={perspectiveEditMode}
                onTogglePerspectiveEditMode={onTogglePerspectiveEditMode}
                onApplyExif={onApplyExif}
                onBakePerspective={onBakePerspective}
              />
            )}
          </WithAdjustments>
        )}
        {activeTool === 'mascaras' && <MasksDrawer />}
        {activeTool === 'retoque' && <RetouchDrawer />}
        {activeTool === 'efeitos' && (
          <WithAdjustments editor={editor}>
            {(adjustments) => (
              <EffectsDrawer
                adjustments={adjustments}
                setField={onSetAdjustmentField}
                onCommit={onCommitAdjustment}
                frameColor={frameColor}
                onFrameColorChange={onChangeFrameColor}
                frameGradientColor={frameGradientColor}
                onFrameGradientColorChange={onChangeFrameGradientColor}
                lightEditMode={lightEditMode}
                onToggleLightEditMode={onToggleLightEditMode}
                doubleExposureImage={doubleExposureImage}
                onPickDoubleExposureImage={onPickDoubleExposureImage}
                onClearDoubleExposureImage={onClearDoubleExposureImage}
                overlayImage={overlayImage}
                onPickOverlayImage={onPickOverlayImage}
                onClearOverlayImage={onClearOverlayImage}
                currentProjectId={currentProjectId}
              />
            )}
          </WithAdjustments>
        )}
        {activeTool === 'elementos' && (
          <ElementsDrawer
            textDraft={textDraft}
            onChangeTextDraft={onChangeTextDraft}
            onSubmitText={onSubmitText}
            isEditingText={selectedLayerKind === 'text'}
            shapeDraft={shapeDraft}
            onChangeShapeDraft={onChangeShapeDraft}
            onSubmitShape={onSubmitShape}
            isEditingShape={selectedLayerKind === 'shape'}
            onSubmitMeme={onSubmitMeme}
            onAddSticker={onAddSticker}
            onSubmitCollage={onSubmitCollage}
          />
        )}
        {activeTool === 'ia' && <AIDrawer />}
        {activeTool === 'presets' && (
          <WithAdjustments editor={editor}>
            {(adjustments) => (
              <PresetsDrawer adjustments={adjustments} onApplyPreset={editor.applyAdjustments} />
            )}
          </WithAdjustments>
        )}
        {activeTool === 'panorama' && (
          <PanoramaDrawer
            selectedImages={selectedPanoramaImages}
            onAddImage={onAddPanoramaImage}
            onRemoveImage={onRemovePanoramaImage}
            onOffsetChange={onPanoramaOffsetChange}
            onOverlapChange={onPanoramaOverlapChange}
            onStitch={onSubmitPanorama}
            overlapWidth={panoramaOverlapWidth}
            offsets={panoramaOffsets}
            isStitching={isStitching}
          />
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  toolDrawer: {
    height: '45%',
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
  },
  drawerHandleRow: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  drawerHandle: {
    width: 32,
    height: 3,
    backgroundColor: colors.linha,
  },
});
