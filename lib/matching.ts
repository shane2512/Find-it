export type ReportType = 'lost' | 'found';

export type Coordinates = {
  lat: number;
  lng: number;
};

export type ItemCandidate = {
  id: string;
  user_id: string;
  type: ReportType;
  title: string;
  description: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  status: string;
};

export const MIN_MATCH_SCORE = 55;

const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'from',
  'this',
  'that',
  'have',
  'lost',
  'found',
  'item',
  'black',
  'white',
]);

const KEYWORD_WEIGHTS: Record<string, number> = {
  wallet: 8,
  purse: 8,
  phone: 8,
  iphone: 10,
  samsung: 10,
  keys: 8,
  keychain: 8,
  bag: 8,
  backpack: 10,
  id: 8,
  card: 6,
  license: 10,
  passport: 12,
};

const tokenize = (value: string): string[] => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
};

const overlapSize = (a: Set<string>, b: Set<string>): number => {
  let count = 0;

  a.forEach((token) => {
    if (b.has(token)) {
      count += 1;
    }
  });

  return count;
};

const getDistanceKm = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
};

export const calculateMatchScore = (
  draft: {
    type: ReportType;
    title: string;
    description: string;
    category: string;
    coords: Coordinates | null;
  },
  candidate: ItemCandidate
): number => {
  if (candidate.type === draft.type || candidate.status !== 'open') {
    return 0;
  }

  let score = 0;

  const draftTitle = draft.title.toLowerCase().trim();
  const candidateTitle = candidate.title.toLowerCase().trim();

  if ((candidate.category || '').toLowerCase() === draft.category.toLowerCase()) {
    score += 32;
  }

  if (draftTitle && candidateTitle) {
    if (draftTitle === candidateTitle) {
      score += 30;
    } else if (draftTitle.includes(candidateTitle) || candidateTitle.includes(draftTitle)) {
      score += 18;
    }
  }

  const draftTitleTokens = new Set(tokenize(draft.title));
  const candidateTitleTokens = new Set(tokenize(candidate.title));
  const draftAllTokens = new Set(tokenize(`${draft.title} ${draft.description}`));
  const candidateAllTokens = new Set(tokenize(`${candidate.title} ${candidate.description || ''}`));

  const titleOverlap = overlapSize(draftTitleTokens, candidateTitleTokens);
  const fullOverlap = overlapSize(draftAllTokens, candidateAllTokens);

  score += Math.min(22, titleOverlap * 7);
  score += Math.min(18, fullOverlap * 4);

  draftAllTokens.forEach((token) => {
    const weight = KEYWORD_WEIGHTS[token];
    if (weight && candidateAllTokens.has(token)) {
      score += weight;
    }
  });

  if (
    draft.coords &&
    typeof candidate.lat === 'number' &&
    typeof candidate.lng === 'number'
  ) {
    const distanceKm = getDistanceKm(draft.coords.lat, draft.coords.lng, candidate.lat, candidate.lng);

    if (distanceKm <= 0.3) {
      score += 22;
    } else if (distanceKm <= 1) {
      score += 14;
    } else if (distanceKm <= 2) {
      score += 8;
    } else if (distanceKm <= 5) {
      score += 4;
    }
  }

  return Math.min(100, score);
};
