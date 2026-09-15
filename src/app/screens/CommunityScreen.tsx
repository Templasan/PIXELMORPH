import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Icon, SideDrawer, Tabs } from '@core/ui';
import { colors, fontSize, monoFontFamily } from '@core/theme';
import { StarRating } from './community/StarRating';

type Props = NativeStackScreenProps<RootStackParamList, 'Community'>;

// TODO: replace with real posts fetched from the community backend.
const POSTS = [
  {
    id: 1,
    author: 'Marina Costa',
    initials: 'MC',
    title: 'Ensaio dourado — Praia do Rosa',
    img: 'photo-1507525428034-b723cf961d3e',
    meta: 'Sony A7IV · f/1.8 · ISO 400',
    rating: 4.6,
    comments: 12,
    audioNotes: 3,
    mainComment:
      'O céu ficou ótimo, mas a pele puxou muito para o magenta nas sombras — talvez um ajuste seletivo em laranja resolva.',
  },
  {
    id: 2,
    author: 'Rafael Duarte',
    initials: 'RD',
    title: 'Retrato urbano — São Paulo',
    img: 'photo-1531746020798-e6953c6e8e04',
    meta: 'Canon R5 · f/2.8 · ISO 800',
    rating: 4.2,
    comments: 8,
    audioNotes: 1,
    mainComment:
      'Nitidez dos olhos perfeita, mas o bokeh de fundo tem aberração cromática verde nas bordas — tenta a correção de lente automática.',
  },
  {
    id: 3,
    author: 'Camila Alves',
    initials: 'CA',
    title: 'Estrada costeira ao entardecer',
    img: 'photo-1504700610630-ac6aba3536d3',
    meta: 'Nikon Z6II · f/8 · ISO 100',
    rating: 4.8,
    comments: 24,
    audioNotes: 5,
    mainComment:
      'Composição impecável. Aplicaria um leve curve crush nas sombras para dar mais caráter cinematográfico ao tons laranja.',
  },
] as const;

type Post = (typeof POSTS)[number];

const TABS = ['EM ALTA', 'RECENTES', 'MINHAS EDIÇÕES', 'REVISÕES'] as const;
const POST_TABS = ['COMENTÁRIOS', 'ÁUDIO', 'AJUSTES USADOS'] as const;
type PostTab = (typeof POST_TABS)[number];

// TODO: replace with real comments for the selected post.
const EXTRA_COMMENTS = [
  {
    author: 'Camila Alves',
    initials: 'CA',
    text: 'Cor de pele ótima, mas o realce nas altas luzes perdeu textura nos brancos.',
    time: '5h',
  },
  {
    author: 'Pedro Lima',
    initials: 'PL',
    text: 'Exposição muito bem balanceada para a luz dura do pôr do sol.',
    time: '8h',
  },
];

// TODO: replace with the real adjustment stack used on this edit.
const USED_ADJUSTMENTS = [
  ['Temperatura', '+200 K'],
  ['Saturação', '+25'],
  ['Exposição', '+0,3 EV'],
  ['Contraste', '+15'],
  ['Nitidez', '+30'],
  ['Redução ruído', '+20'],
  ['Curvas', 'Curva S leve'],
];

function PostDetail({ post, onBack }: { post: Post; onBack: () => void }) {
  const [postTab, setPostTab] = useState<PostTab>('COMENTÁRIOS');
  const [comment, setComment] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.detailTopBar}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Icon name="chevronLeft" size={20} />
        </Pressable>
        <Text style={styles.detailTitle} numberOfLines={1}>
          {post.title}
        </Text>
        {/* TODO: real share sheet. */}
        <Icon name="share" size={18} />
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Image
          source={{
            uri: `https://images.unsplash.com/${post.img}?w=780&h=520&fit=crop&auto=format`,
          }}
          style={styles.detailImage}
        />

        <View style={styles.verifiedBadge}>
          <Icon name="shield" size={14} color={colors.ok} />
          <Text style={styles.verifiedAuthor}>{post.author}</Text>
          {/* TODO: real signature verification + post date. */}
          <Text style={styles.verifiedMeta}>· Assinatura verificada</Text>
        </View>

        <View style={styles.ratingRow}>
          <StarRating rating={post.rating} size={16} idPrefix={`detail-${post.id}`} />
          <Text style={styles.ratingValue}>{post.rating}</Text>
          <Text style={styles.ratingCount}>({post.comments + post.audioNotes} avaliações)</Text>
        </View>

        <Tabs tabs={POST_TABS} active={postTab} onChange={setPostTab} />

        {postTab === 'COMENTÁRIOS' && (
          <View>
            {[
              {
                author: post.author.split(' ')[0],
                initials: post.initials,
                text: post.mainComment,
                time: '2h',
              },
              ...EXTRA_COMMENTS,
            ].map((c) => (
              <View key={c.author + c.time} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{c.initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{c.author}</Text>
                    <Text style={styles.commentTime}>{c.time}</Text>
                  </View>
                  <Text style={styles.commentText}>{c.text}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {postTab === 'ÁUDIO' && (
          <View style={{ padding: 12, gap: 8 }}>
            {/* TODO: real audio playback + waveform for each voice annotation. */}
            {Array.from({ length: post.audioNotes }).map((_, i) => (
              <View key={i} style={styles.audioCard}>
                <Pressable style={styles.audioPlay}>
                  <Icon name="play" size={14} color={colors.acento} />
                </Pressable>
                <View style={styles.waveform}>
                  {Array.from({ length: 36 }).map((_, j) => (
                    <View
                      key={j}
                      style={[
                        styles.waveformBar,
                        { height: `${25 + Math.sin(j * 0.6 + i) * 65}%` },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.audioDuration}>0:{String(14 + i * 8).padStart(2, '0')}</Text>
              </View>
            ))}
          </View>
        )}

        {postTab === 'AJUSTES USADOS' && (
          <View>
            {USED_ADJUSTMENTS.map(([k, v]) => (
              <View key={k} style={styles.adjustmentRow}>
                <Text style={styles.adjustmentKey}>{k}</Text>
                <Text style={styles.adjustmentValue}>{v}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.commentBar}>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Adicionar comentário..."
          placeholderTextColor={colors.texto2}
          style={styles.commentInput}
        />
        {/* TODO: real voice-note recording. */}
        <Pressable hitSlop={6}>
          <Icon name="mic" size={20} />
        </Pressable>
        {/* TODO: submit the comment to the backend. */}
        <Pressable style={[styles.sendButton, comment && styles.sendButtonActive]}>
          <Icon name="share" size={14} color={comment ? colors.preto : colors.texto2} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export default function CommunityScreen({ navigation }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('EM ALTA');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  if (selectedPost) {
    return <PostDetail post={selectedPost} onBack={() => setSelectedPost(null)} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Pressable onPress={() => setDrawerOpen(true)} hitSlop={8}>
          <Icon name="menu" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>Comunidade</Text>
        {/* TODO: real search. */}
        <Icon name="search" size={20} />
      </View>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} scrollable />

      <ScrollView style={{ flex: 1 }}>
        {POSTS.map((post) => (
          <Pressable key={post.id} style={styles.postCard} onPress={() => setSelectedPost(post)}>
            <View style={styles.postAuthorRow}>
              <View style={styles.postAvatar}>
                <Text style={styles.postAvatarText}>{post.initials}</Text>
              </View>
              <View>
                <Text style={styles.postAuthor}>{post.author}</Text>
                <Text style={styles.postMeta}>{post.meta}</Text>
              </View>
              {/* TODO: open real media-info sheet for this post. */}
              <Pressable style={styles.postInfoButton} hitSlop={6}>
                <Icon name="info" size={16} color={colors.texto2} />
              </Pressable>
            </View>
            <Image
              source={{
                uri: `https://images.unsplash.com/${post.img}?w=780&h=440&fit=crop&auto=format`,
              }}
              style={styles.postImage}
            />
            <View style={styles.postStats}>
              <Text style={styles.postTitle}>{post.title}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <StarRating rating={post.rating} size={12} idPrefix={`post-${post.id}`} />
                  <Text style={styles.statValue}>{post.rating}</Text>
                </View>
                <View style={styles.statItem}>
                  <Icon name="messageCircle" size={14} color={colors.texto2} />
                  <Text style={styles.statText}>{post.comments}</Text>
                </View>
                <View style={styles.statItem}>
                  <Icon name="mic" size={14} color={colors.texto2} />
                  <Text style={styles.statText}>{post.audioNotes}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* TODO: real upload flow. */}
      <Pressable style={styles.fab}>
        <Icon name="upload" size={18} color={colors.branco} />
        <Text style={styles.fabText}>Enviar edição</Text>
      </Pressable>

      <SideDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        navigation={navigation}
        current="Community"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  topBar: {
    height: 56,
    backgroundColor: colors.barra,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
    elevation: 4,
  },
  topBarTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '500',
    color: colors.texto,
  },
  postCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  postAvatar: {
    width: 34,
    height: 34,
    backgroundColor: 'rgba(58,143,222,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatarText: {
    fontSize: fontSize.xs,
    color: colors.acento,
  },
  postAuthor: {
    fontSize: fontSize.sm,
    color: colors.texto,
    fontWeight: '500',
  },
  postMeta: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto2,
  },
  postInfoButton: {
    marginLeft: 'auto',
  },
  postImage: {
    width: '100%',
    aspectRatio: 390 / 220,
  },
  postStats: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  postTitle: {
    fontSize: fontSize.md,
    color: colors.texto,
    fontWeight: '500',
    marginBottom: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  statText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.acento,
    borderRadius: 24,
    elevation: 6,
  },
  fabText: {
    fontSize: fontSize.md,
    color: colors.branco,
    fontWeight: '500',
  },
  detailTopBar: {
    height: 48,
    backgroundColor: colors.barra,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  detailTitle: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.texto,
  },
  detailImage: {
    width: '100%',
    aspectRatio: 390 / 260,
  },
  verifiedBadge: {
    margin: 12,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(95,185,143,0.35)',
    backgroundColor: 'rgba(95,185,143,0.08)',
  },
  verifiedAuthor: {
    fontSize: fontSize.xs,
    color: colors.ok,
  },
  verifiedMeta: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  ratingValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.md,
    color: colors.texto,
  },
  ratingCount: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(58,143,222,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarText: {
    fontSize: fontSize.xs,
    color: colors.acento,
  },
  commentHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 3,
  },
  commentAuthor: {
    fontSize: fontSize.xs,
    color: colors.texto,
    fontWeight: '500',
  },
  commentTime: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto2,
  },
  commentText: {
    fontSize: fontSize.xs,
    color: colors.texto2,
    lineHeight: 18,
  },
  audioCard: {
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    paddingHorizontal: 10,
  },
  audioPlay: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.acento,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveform: {
    flex: 1,
    height: 28,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
  },
  waveformBar: {
    flex: 1,
    backgroundColor: colors.acento,
    opacity: 0.55,
  },
  audioDuration: {
    fontFamily: monoFontFamily,
    fontSize: 10,
    color: colors.texto2,
  },
  adjustmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.linha,
  },
  adjustmentKey: {
    fontSize: fontSize.xs,
    color: colors.texto2,
  },
  adjustmentValue: {
    fontFamily: monoFontFamily,
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  commentBar: {
    backgroundColor: colors.barra,
    borderTopWidth: 1,
    borderTopColor: colors.linha,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.painel,
    borderWidth: 1,
    borderColor: colors.linha,
    paddingVertical: 7,
    paddingHorizontal: 10,
    fontSize: fontSize.xs,
    color: colors.texto,
  },
  sendButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.linha,
  },
  sendButtonActive: {
    backgroundColor: colors.acento,
    borderColor: colors.acento,
  },
});
