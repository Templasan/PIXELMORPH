/**
 * RF-034: what kind of photo this is, from the labels ML Kit reads in it, and the look that tends
 * to suit each kind. The labels are its general ones, in English, and each one votes by confidence.
 */
export type SceneKind = 'paisagem' | 'retrato' | 'comida' | 'animais' | 'urbano';

const VOTES: Record<SceneKind, readonly string[]> = {
  paisagem: ['Sky', 'Cloud', 'Mountain', 'Lake', 'River', 'Beach', 'Sea', 'Sunset', 'Forest', 'Tree', 'Waterfall', 'Field', 'Grass', 'Nature', 'Plant', 'Flower', 'Desert', 'Snow', 'Rock', 'Lighthouse', 'Iceberg', 'Horizon'],
  retrato: ['Person', 'Selfie', 'Smile', 'Beard', 'Hair', 'Eyelash', 'Fun', 'Skin', 'Fashion', 'Dress', 'Glasses', 'Moustache', 'Baby', 'Bride', 'Portrait'],
  comida: ['Food', 'Fruit', 'Vegetable', 'Bread', 'Cheeseburger', 'Pizza', 'Cake', 'Bento', 'Coffee', 'Dessert', 'Sushi', 'Cuisine', 'Meal', 'Wine', 'Pasta', 'Soup', 'Cookie', 'Plate', 'Lunch'],
  animais: ['Dog', 'Cat', 'Bird', 'Pet', 'Fish', 'Horse', 'Insect', 'Butterfly', 'Rabbit', 'Wildlife', 'Duck', 'Cattle', 'Bear', 'Monkey', 'Lizard', 'Animal', 'Turtle'],
  urbano: ['Building', 'Skyscraper', 'City', 'Car', 'Bridge', 'Road', 'Street', 'Tower', 'Train', 'Bus', 'Traffic', 'Bicycle', 'Factory', 'Downtown', 'Metropolis', 'Architecture', 'Taxi'],
};

/** A face this large in the picture makes it a portrait, whatever else is around it. */
const PORTRAIT_FACE_AREA = 0.04;
/** Votes under this say too little to name a scene. */
const MIN_SCORE = 0.5;

export interface SceneGuess {
  kind: SceneKind;
  /** The labels that voted for it, strongest first. */
  because: string[];
}

export function sceneOf(
  labels: readonly { text: string; confidence: number }[],
  faces: readonly { w: number; h: number }[] = []
): SceneGuess | null {
  const score = (kind: SceneKind) =>
    labels.filter((l) => VOTES[kind].includes(l.text)).reduce((sum, l) => sum + l.confidence, 0);
  const kinds = Object.keys(VOTES) as SceneKind[];
  const best = kinds.reduce((a, b) => (score(b) > score(a) ? b : a));
  const voters = (kind: SceneKind) =>
    labels
      .filter((l) => VOTES[kind].includes(l.text))
      .sort((a, b) => b.confidence - a.confidence)
      .map((l) => l.text);
  if (faces.some((f) => f.w * f.h >= PORTRAIT_FACE_AREA)) return { kind: 'retrato', because: voters('retrato') };
  return score(best) >= MIN_SCORE ? { kind: best, because: voters(best) } : null;
}

/** The suggested filter and adjustments for a kind of photo: a starting point, undoable in one step. */
export const SCENE_LOOKS: Record<SceneKind, { name: string; look: Record<string, number> }> = {
  paisagem: { name: 'Paisagem', look: { vibracao: 25, saturacao: 10, nitidez: 25, temperatura: 5 } },
  retrato: { name: 'Retrato', look: { vibracao: 8, temperatura: 8, exposicao: 0.15, saturacao: -5 } },
  comida: { name: 'Comida', look: { temperatura: 12, saturacao: 15, exposicao: 0.2, nitidez: 15 } },
  animais: { name: 'Animais', look: { nitidez: 30, vibracao: 15, exposicao: 0.1 } },
  urbano: { name: 'Urbano', look: { nitidez: 25, saturacao: -10, temperatura: -8 } },
};
