export const vegetarianBlocklist = [
  'chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'ham', 'bacon', 'anchovy', 'turkey', 'lamb', 'duck', 'mutton', 'veal', 'crab', 'lobster', 'sausage', 'pepperoni'
];
// ... (rest of the file)
export const isVegetarianIngredient = (value) => {
  if (!value) return true;
  const normalized = String(value).toLowerCase();
  return !vegetarianBlocklist.some(token => normalized.includes(token));
};

export const cleanIngredientLocally = (rawName) => {
  if (!rawName) return '';
  let name = String(rawName).toLowerCase().trim();
  name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  name = name.replace(/[\u2013\u2014•]/g, ' ');
  name = name.replace(/\d+/g, ' ');
  name = name.replace(/\b(?:organic|fresh|large|small|medium|extra|reduced fat|low fat|low-sodium|low sodium|unsalted|sliced|diced|chopped|shredded|minced|ground|boneless|skinless|prepared|peeled|packaged|package|pack|can|canned|jar|bottle|tube|stick|slice|pieces|piece|cup|cups|tablespoon|tablespoons|tbsp|teaspoon|teaspoons|tsp|grams|gram|g|kg|pounds|pound|lb|lbs|oz|ounces|fluid|fl oz|ml|ltr|liter|litre|pkg|ct|count)\b/g, ' ');
  name = name.replace(/[^a-z0-9\s]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  return name;
};

export const normalizeIngredientTokens = (value) => {
  const clean = cleanIngredientLocally(value);
  return Array.from(new Set(clean.split(/\s+/).filter(Boolean)));
};

export const formatIngredientMeasurement = (ingredientString, multiplier) => {
  const lower = String(ingredientString).toLowerCase();
  const nameOnly = ingredientString.replace(/^[0-9\/\.\s\-½⅓¼¾⅛]+/, '').trim();
  if (/\b(cup|cups|ml|l|liter|litre|milk|yogurt|broth|water)\b/.test(lower)) return `${1 * multiplier} cup ${nameOnly}`;
  if (/\b(tbsp|tablespoon|tablespoons|oil|sauce|vinegar|soy)\b/.test(lower)) return `${1 * multiplier} tbsp ${nameOnly}`;
  if (/\b(tsp|teaspoon|teaspoons|garlic|ginger|salt|pepper|spice|herb)\b/.test(lower)) return `${0.5 * multiplier} tsp ${nameOnly}`;
  if (/\b(flour|rice|lentil|sugar|pasta|beans)\b/.test(lower)) return `${1 * multiplier} cup ${nameOnly}`;
  if (/\b(onion|tomato|potato|carrot|apple)\b/.test(lower)) return `${1 * multiplier} medium ${nameOnly}`;
  if (/\b(paneer|tofu|cheese|yogurt)\b/.test(lower)) {
    const oz = Math.max(1, Math.round((100 * multiplier) / 28.35));
    return `${oz} oz ${nameOnly}`;
  }
  return `${1 * multiplier} each ${nameOnly}`;
};

export const getStaticRecipeSteps = (recipe) => {
  if (!recipe) return ['Follow the ingredient list to create the dish.'];
  const rawSteps = recipe.steps || recipe.instructions || recipe.step || [];
  let steps = [];
  if (Array.isArray(rawSteps)) {
    steps = rawSteps.map(step => String(step || '').trim()).filter(Boolean);
  } else {
    const textSteps = String(rawSteps || '').trim();
    if (textSteps.includes('\n')) steps = textSteps.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    else if (textSteps) steps = [textSteps];
  }
  if (steps && steps.length) return steps;
  const ingList = (recipe.cleanedIngredients || []).slice(0, 8).map(i => i.replace(/^[0-9\/\.\s\-½⅓¼¾⅛]+/, '').trim());
  const firstFew = ingList.length ? ingList.join(', ') : 'your ingredients';
  return [
    `Prep: gather ${firstFew}.`,
    'Combine the ingredients in a suitable pan or bowl.',
    'Cook or bake until ingredients are tender and flavors meld (approx. 10–25 minutes).',
    'Taste and adjust seasoning, then serve warm.'
  ];
};

export const parseRecipeIngredientMeasurements = (ingredientString, multiplier) => {
  if (!ingredientString) return '';
  const numericTokenMatch = ingredientString.match(/^([0-9\/\.\s\-½⅓¼¾⅛]+)/);
  if (numericTokenMatch) {
    const rawNumberString = numericTokenMatch[1].trim();
    let baseVal = parseFloat(rawNumberString);
    if (isNaN(baseVal)) {
      if (rawNumberString.includes('½')) baseVal = 0.5;
      else if (rawNumberString.includes('¼')) baseVal = 0.25;
      else if (rawNumberString.includes('¾')) baseVal = 0.75;
      else baseVal = 1.0; 
    }
    return `${baseVal * multiplier} ${ingredientString.substring(numericTokenMatch[0].length).trim()}`;
  }
  return formatIngredientMeasurement(ingredientString, multiplier);
};

export const recipeCategoryMatches = (recipe, patterns) => {
  const text = `${recipe.meal_type || ''} ${recipe.name || ''} ${(recipe.cleanedIngredients || []).join(' ')}`.toLowerCase();
  return patterns.some((pattern) => text.includes(pattern));
};

export const isRecipeVegan = (recipe) => {
  const nonVegan = ['egg', 'eggs', 'milk', 'butter', 'cheese', 'cream', 'yogurt', 'honey', 'gelatin', 'paneer', 'whey'];
  return !(recipe.cleanedIngredients || []).some((ing) => nonVegan.some((token) => ing.includes(token)));
};

export const isRecipeMeat = (recipe) => {
  const meatTokens = ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'bacon', 'sausage', 'ham', 'veal', 'duck', 'venison', 'mutton'];
  return (recipe.cleanedIngredients || []).some((ing) => meatTokens.some((token) => ing.includes(token)));
};

export const isRecipeFish = (recipe) => {
  const fishTokens = ['fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'anchovy', 'trout', 'cod', 'seafood'];
  return (recipe.cleanedIngredients || []).some((ing) => fishTokens.some((token) => ing.includes(token)));
};

export const isRecipeEgg = (recipe) => {
  return (recipe.cleanedIngredients || []).some((ing) => /(egg|eggs)/.test(ing));
};

const cuisineMatch = (recipe, ...areas) => {
  const c = (recipe.cuisine || '').toLowerCase();
  return areas.includes(c);
};

export const matchesRecipeFilter = (recipe, filter) => {
  switch (filter) {
    case 'vegetarian': return !isRecipeMeat(recipe) && !isRecipeFish(recipe);
    case 'vegan': return isRecipeVegan(recipe);
    case 'breakfast': return recipeCategoryMatches(recipe, ['breakfast', 'morning', 'brunch', 'pancake', 'waffle', 'oat', 'cereal', 'muffin', 'toast', 'smoothie bowl']);
    case 'lunch': return recipeCategoryMatches(recipe, ['lunch', 'sandwich', 'salad', 'bowl', 'soup', 'wrap', 'light meal', 'starter', 'side']);
    case 'dinner': return recipeCategoryMatches(recipe, ['dinner', 'supper', 'main', 'casserole', 'stew', 'pasta', 'beef', 'chicken', 'lamb', 'pork', 'seafood', 'biryani', 'curry', 'roast', 'baked', 'goat', 'miscellaneous']);
    case 'dessert': return recipeCategoryMatches(recipe, ['dessert', 'cake', 'pie', 'pudding', 'sweet', 'custard', 'ice cream', 'brownie', 'cookie', 'biscuit', 'tart', 'pastry', 'crepe', 'cheesecake']);
    case 'snack': return recipeCategoryMatches(recipe, ['snack', 'finger', 'appetizer', 'dip', 'nibble', 'side', 'starter', 'bread', 'fritter', 'antipasto']);
    case 'meat': return isRecipeMeat(recipe);
    case 'fish': return isRecipeFish(recipe);
    case 'egg': return isRecipeEgg(recipe);
    // Cuisine filters
    case 'indian': return cuisineMatch(recipe, 'indian');
    case 'chinese': return cuisineMatch(recipe, 'chinese');
    case 'mexican': return cuisineMatch(recipe, 'mexican');
    case 'japanese': return cuisineMatch(recipe, 'japanese');
    case 'korean': return cuisineMatch(recipe, 'korean') || recipeCategoryMatches(recipe, ['kimchi', 'bibimbap', 'japchae', 'bulgogi', 'tteok']);
    case 'jamaican': return cuisineMatch(recipe, 'jamaican');
    case 'latin': return cuisineMatch(recipe, 'mexican', 'spanish', 'portuguese', 'american');
    case 'african': return cuisineMatch(recipe, 'kenyan', 'moroccan', 'egyptian', 'tunisian');
    case 'mediterranean': return cuisineMatch(recipe, 'greek', 'italian', 'turkish', 'spanish', 'french', 'portuguese', 'moroccan');
    default: return true;
  }
};

/**
 * Subtle Haptic Feedback utility (Web Standard)
 */
export const triggerHaptic = (intensity = 10) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(intensity);
  }
};