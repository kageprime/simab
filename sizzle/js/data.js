export const COLORS = {
  oceanDeep: '#0c4a6e',
  seaBlue: '#0284c7',
  sky: '#7dd3fc',
  foodGold: '#f59e0b',
  sizzle: '#ea580c',
  pepper: '#dc2626',
  palmOil: '#fef3c7',
  ink: '#1c1917',
  cream: '#fffaf0',
  white: '#ffffff',
  green: '#22c55e',
  purple: '#a21caf',
  ember: '#f97316',
  frost: '#38bdf8',
  ghost: '#a78bfa',
  pink: '#ec4899',
  brown: '#78350f',
  wood: '#92400e',
  brick: '#b45309',
  steel: '#64748b',
};

export const INGREDIENT_PRICES = {
  beef: 50,
  rice: 30,
  tomato: 20,
  pepper: 25,
  oil: 20,
  melonSeeds: 30,
  palmOil: 40,
  leaf: 15,
  crayfish: 35,
};

export const INGREDIENT_NAMES = {
  beef: 'Beef',
  rice: 'Rice',
  tomato: 'Tomato',
  pepper: 'Ata Rodo',
  oil: 'Groundnut Oil',
  melonSeeds: 'Egusi Seeds',
  palmOil: 'Palm Oil',
  leaf: 'Ugu Leaves',
  crayfish: 'Crayfish',
};

export const RECIPES = {
  suya: {
    id: 'suya',
    name: 'Suya Skewers',
    icon: '🥩',
    ingredients: { beef: 1, pepper: 1, oil: 1 },
    basePrice: 150,
    station: 'grill',
    prepTime: 3,
    color: COLORS.pepper,
    description: 'Spicy grilled meat skewers',
  },
  jollof: {
    id: 'jollof',
    name: 'Jollof Rice',
    icon: '🍚',
    ingredients: { rice: 2, tomato: 1, pepper: 1, oil: 1 },
    basePrice: 200,
    station: 'pot',
    prepTime: 5,
    color: COLORS.foodGold,
    description: 'One-pot tomato rice, party style',
  },
  egusi: {
    id: 'egusi',
    name: 'Egusi Soup',
    icon: '🍲',
    ingredients: { melonSeeds: 2, palmOil: 1, leaf: 1, crayfish: 1 },
    basePrice: 250,
    station: 'pot',
    prepTime: 4,
    color: COLORS.green,
    description: 'Rich melon seed soup with leaves',
  },
};

export const CUSTOMER_TYPES = [
  { id: 'tunde', name: 'Tunde', favDish: 'suya', patience: 60, tipMult: 1.3, icon: '🧑🏽‍🍳', portraitColor: COLORS.sizzle },
  { id: 'amara', name: 'Amara', favDish: 'jollof', patience: 90, tipMult: 1.0, icon: '🧭', portraitColor: COLORS.seaBlue },
  { id: 'mama_nk', name: 'Mama Nk', favDish: 'egusi', patience: 50, tipMult: 1.5, icon: '👩🏾', portraitColor: COLORS.pepper },
  { id: 'chidi', name: 'Chidi', favDish: 'suya', patience: 70, tipMult: 1.1, icon: '🕺', portraitColor: COLORS.foodGold },
  { id: 'nneka', name: 'Nneka', favDish: 'jollof', patience: 80, tipMult: 1.2, icon: '💁🏾‍♀️', portraitColor: COLORS.green },
  { id: 'emeka', name: 'Emeka', favDish: 'egusi', patience: 55, tipMult: 1.4, icon: '🧔🏾', portraitColor: COLORS.brown },
  { id: 'ada', name: 'Ada', favDish: 'suya', patience: 75, tipMult: 1.0, icon: '👩🏾‍🦱', portraitColor: COLORS.purple },
  { id: 'olusegun', name: 'Olusegun', favDish: 'jollof', patience: 65, tipMult: 1.15, icon: '👴🏾', portraitColor: COLORS.wood },
  { id: 'ife', name: 'Ife', favDish: 'egusi', patience: 85, tipMult: 0.9, icon: '👩🏾‍🦰', portraitColor: COLORS.ember },
  { id: 'kola', name: 'Kola', favDish: 'suya', patience: 45, tipMult: 1.6, icon: '🧑🏾‍🦲', portraitColor: COLORS.ink },
];

export function createGameState() {
  return {
    money: 500,
    day: 1,
    phase: 'dawn',

    inventory: {
      beef: 5,
      rice: 5,
      tomato: 3,
      pepper: 4,
      oil: 3,
      melonSeeds: 2,
      palmOil: 2,
      leaf: 2,
      crayfish: 3,
    },

    preparedDishes: [],
    customersToday: [],
    customersServed: 0,
    customersLost: 0,

    dayRevenue: 0,
    dayTips: 0,
    dishesServed: 0,

    activeMinigame: null,
    minigameResult: null,

    sceneParams: {},
  };
}

export function getCustomerTypes(count) {
  const shuffled = [...CUSTOMER_TYPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map((t, i) => ({
    ...t,
    id: `${t.id}_${i}`,
    patience: t.patience + Math.floor(Math.random() * 20 - 10),
    hasOrdered: false,
    hasBeenServed: false,
    seatedAt: null,
    order: null,
    patienceRemaining: 0,
    state: 'waiting',
  }));
}
