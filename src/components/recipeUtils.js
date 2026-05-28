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

// Word-boundary patterns prevent false positives: "graham" won't match "ham", "butternut" won't match "butter"
const MEAT_PATTERN = /\b(chicken|beef|pork|lamb|turkey|bacon|sausage|ham|veal|duck|venison|mutton|meat|meatball|pepperoni|salami|anchovy|prawn|brisket|chorizo|lard|suet|gelatin)\b/;
const FISH_PATTERN = /\b(fish|salmon|tuna|shrimp|crab|lobster|anchovy|trout|cod|seafood|tilapia|halibut|sardine|prawn|mussel|clam|oyster|scallop|squid|calamari|eel)\b/;
// Plant milks/creams are excluded from the non-vegan check
const PLANT_BASE = /\b(oat|coconut|soy|almond|rice|cashew|hemp|macadamia|hazelnut)\b/;
const NON_VEGAN_PATTERN = /\b(egg|eggs|milk|butter|cheese|cream|yogurt|honey|gelatin|paneer|whey|lard|suet|casein|lactose|rennet)\b/;

export const isRecipeVegan = (recipe) => {
  return !(recipe.cleanedIngredients || []).some((ing) => {
    if (!NON_VEGAN_PATTERN.test(ing)) return false;
    // Allow plant-based milk/cream (oat milk, coconut cream, etc.)
    if (PLANT_BASE.test(ing) && /\b(milk|cream)\b/.test(ing)) return false;
    return true;
  });
};

export const isRecipeMeat = (recipe) => {
  return (recipe.cleanedIngredients || []).some((ing) => {
    // Broth/stock/powder are not whole-protein ingredients — many veggie recipes use chicken broth
    if (/\b(broth|stock|powder|extract|flavor|flavour)\b/.test(ing)) return false;
    return MEAT_PATTERN.test(ing);
  });
};

export const isRecipeFish = (recipe) => {
  return (recipe.cleanedIngredients || []).some((ing) => {
    if (/\b(broth|stock|powder|extract|flavor|flavour)\b/.test(ing)) return false;
    return FISH_PATTERN.test(ing);
  });
};

export const isRecipeEgg = (recipe) => {
  return (recipe.cleanedIngredients || []).some((ing) => /(egg|eggs)/.test(ing));
};

const cuisineMatch = (recipe, ...areas) => {
  // Check both cuisine field and meal_type (saved recipes embed cuisine in meal_type)
  const c = ((recipe.cuisine || '') + ' ' + (recipe.meal_type || '')).toLowerCase();
  return areas.some(a => c.includes(a));
};

export const matchesRecipeFilter = (recipe, filter) => {
  switch (filter) {
    case 'vegetarian':
      if (/\bvegetarian\b/i.test(recipe.meal_type || '')) return true;
      return !isRecipeMeat(recipe) && !isRecipeFish(recipe);
    case 'vegan':
      if (/\bvegan\b/i.test(recipe.meal_type || '')) return true;
      return isRecipeVegan(recipe) && !isRecipeMeat(recipe) && !isRecipeFish(recipe);
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
 * Estimate nutrition (per 100g) for a named ingredient using a static lookup.
 * Returns { kcal, protein, carbs, fat } or null if unknown.
 */
export const estimateNutrition = (itemName) => {
  const n = (itemName || '').toLowerCase();
  if (/\b(chicken breast)\b/.test(n)) return { kcal: 165, protein: 31, carbs: 0, fat: 3.6 };
  if (/\b(chicken|poultry)\b/.test(n)) return { kcal: 215, protein: 27, carbs: 0, fat: 12 };
  if (/\b(beef|steak|brisket)\b/.test(n)) return { kcal: 250, protein: 26, carbs: 0, fat: 17 };
  if (/\b(pork|bacon|ham|sausage)\b/.test(n)) return { kcal: 290, protein: 22, carbs: 1, fat: 22 };
  if (/\b(salmon)\b/.test(n)) return { kcal: 208, protein: 20, carbs: 0, fat: 13 };
  if (/\b(tuna)\b/.test(n)) return { kcal: 144, protein: 30, carbs: 0, fat: 3 };
  if (/\b(shrimp|prawn|seafood|fish)\b/.test(n)) return { kcal: 99, protein: 24, carbs: 0, fat: 1 };
  if (/\b(egg|eggs)\b/.test(n)) return { kcal: 155, protein: 13, carbs: 1, fat: 11 };
  if (/\b(oat milk|soy milk|almond milk|coconut milk)\b/.test(n)) return { kcal: 45, protein: 1, carbs: 7, fat: 1.5 };
  if (/\b(milk)\b/.test(n)) return { kcal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 };
  if (/\b(yogurt)\b/.test(n)) return { kcal: 59, protein: 3.5, carbs: 5, fat: 3.3 };
  if (/\b(butter|ghee)\b/.test(n)) return { kcal: 717, protein: 0.9, carbs: 0, fat: 81 };
  if (/\b(cream cheese)\b/.test(n)) return { kcal: 350, protein: 6, carbs: 4, fat: 35 };
  if (/\b(cheese|mozzarella|cheddar|parmesan)\b/.test(n)) return { kcal: 402, protein: 25, carbs: 1.3, fat: 33 };
  if (/\b(paneer|tofu)\b/.test(n)) return { kcal: 265, protein: 18, carbs: 3, fat: 20 };
  if (/\b(rice)\b/.test(n)) return { kcal: 365, protein: 7, carbs: 80, fat: 0.7 };
  if (/\b(pasta|noodle|spaghetti)\b/.test(n)) return { kcal: 371, protein: 13, carbs: 74, fat: 1.5 };
  if (/\b(flour|wheat)\b/.test(n)) return { kcal: 364, protein: 10, carbs: 76, fat: 1 };
  if (/\b(bread|toast|bagel|bun|roll)\b/.test(n)) return { kcal: 265, protein: 9, carbs: 49, fat: 3.2 };
  if (/\b(oat|oatmeal|cereal)\b/.test(n)) return { kcal: 389, protein: 17, carbs: 66, fat: 7 };
  if (/\b(potato|yam)\b/.test(n)) return { kcal: 77, protein: 2, carbs: 17, fat: 0.1 };
  if (/\b(sweet potato)\b/.test(n)) return { kcal: 86, protein: 1.6, carbs: 20, fat: 0.1 };
  if (/\b(tomato)\b/.test(n)) return { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 };
  if (/\b(onion|shallot)\b/.test(n)) return { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1 };
  if (/\b(garlic)\b/.test(n)) return { kcal: 149, protein: 6.4, carbs: 33, fat: 0.5 };
  if (/\b(ginger)\b/.test(n)) return { kcal: 80, protein: 1.8, carbs: 18, fat: 0.8 };
  if (/\b(spinach|kale|chard|arugula)\b/.test(n)) return { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 };
  if (/\b(lettuce|cabbage)\b/.test(n)) return { kcal: 15, protein: 1.4, carbs: 2.9, fat: 0.2 };
  if (/\b(broccoli|cauliflower|bok choy)\b/.test(n)) return { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4 };
  if (/\b(carrot)\b/.test(n)) return { kcal: 41, protein: 0.9, carbs: 9.6, fat: 0.2 };
  if (/\b(bell pepper|capsicum|pepper)\b/.test(n)) return { kcal: 31, protein: 1, carbs: 6, fat: 0.3 };
  if (/\b(mushroom)\b/.test(n)) return { kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3 };
  if (/\b(corn|maize)\b/.test(n)) return { kcal: 86, protein: 3.2, carbs: 19, fat: 1.2 };
  if (/\b(pea|green pea)\b/.test(n)) return { kcal: 81, protein: 5.4, carbs: 14, fat: 0.4 };
  if (/\b(zucchini|courgette|eggplant|aubergine|okra)\b/.test(n)) return { kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.2 };
  if (/\b(cucumber)\b/.test(n)) return { kcal: 16, protein: 0.7, carbs: 3.6, fat: 0.1 };
  if (/\b(celery)\b/.test(n)) return { kcal: 16, protein: 0.7, carbs: 3, fat: 0.2 };
  if (/\b(apple|pear)\b/.test(n)) return { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 };
  if (/\b(banana)\b/.test(n)) return { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 };
  if (/\b(orange|lemon|lime|citrus)\b/.test(n)) return { kcal: 47, protein: 0.9, carbs: 12, fat: 0.1 };
  if (/\b(mango|papaya)\b/.test(n)) return { kcal: 60, protein: 0.8, carbs: 15, fat: 0.4 };
  if (/\b(strawberry|blueberry|raspberry|berry)\b/.test(n)) return { kcal: 52, protein: 0.7, carbs: 12, fat: 0.3 };
  if (/\b(grape)\b/.test(n)) return { kcal: 69, protein: 0.7, carbs: 18, fat: 0.2 };
  if (/\b(avocado)\b/.test(n)) return { kcal: 160, protein: 2, carbs: 9, fat: 15 };
  if (/\b(coconut)\b/.test(n)) return { kcal: 354, protein: 3.3, carbs: 15, fat: 33 };
  if (/\b(lentil|chickpea|dal)\b/.test(n)) return { kcal: 116, protein: 9, carbs: 20, fat: 0.4 };
  if (/\b(black bean|kidney bean|white bean|bean)\b/.test(n)) return { kcal: 127, protein: 8.7, carbs: 23, fat: 0.5 };
  if (/\b(quinoa)\b/.test(n)) return { kcal: 368, protein: 14, carbs: 64, fat: 6 };
  if (/\b(almond|cashew|walnut|pecan|pistachio)\b/.test(n)) return { kcal: 580, protein: 21, carbs: 22, fat: 50 };
  if (/\b(peanut|peanut butter)\b/.test(n)) return { kcal: 567, protein: 26, carbs: 16, fat: 49 };
  if (/\b(olive oil|vegetable oil|canola oil|oil)\b/.test(n)) return { kcal: 884, protein: 0, carbs: 0, fat: 100 };
  if (/\b(sugar|brown sugar|caster sugar)\b/.test(n)) return { kcal: 387, protein: 0, carbs: 100, fat: 0 };
  if (/\b(honey|maple syrup|agave)\b/.test(n)) return { kcal: 304, protein: 0.3, carbs: 82, fat: 0 };
  if (/\b(chocolate|cocoa|cacao)\b/.test(n)) return { kcal: 546, protein: 5, carbs: 60, fat: 31 };
  if (/\b(soy sauce|tamari)\b/.test(n)) return { kcal: 53, protein: 8, carbs: 5, fat: 0.1 };
  if (/\b(tomato sauce|tomato paste|ketchup)\b/.test(n)) return { kcal: 82, protein: 3, carbs: 18, fat: 0.5 };
  if (/\b(broth|stock|bouillon)\b/.test(n)) return { kcal: 15, protein: 1, carbs: 1, fat: 0.5 };
  return null;
};

/**
 * Estimate typical shelf-life expiry date based on ingredient name.
 * Returns ISO date string (YYYY-MM-DD).
 */
export const getEstimatedExpiry = (itemName) => {
  const n = (itemName || '').toLowerCase();
  const today = new Date();
  const addDays = (d) => { const dt = new Date(today); dt.setDate(dt.getDate() + d); return dt.toISOString().split('T')[0]; };

  if (/\b(chicken|beef|pork|lamb|turkey|mince|steak|ground meat|fresh fish|shrimp|prawn)\b/.test(n)) return addDays(2);
  if (/\b(avocado)\b/.test(n)) return addDays(3);
  if (/\b(milk|cream|sour cream|heavy cream)\b/.test(n)) return addDays(7);
  if (/\b(yogurt|kefir)\b/.test(n)) return addDays(14);
  if (/\b(egg|eggs)\b/.test(n)) return addDays(28);
  if (/\b(butter)\b/.test(n)) return addDays(30);
  if (/\b(cheese|mozzarella|brie|ricotta|cottage)\b/.test(n)) return addDays(14);
  if (/\b(cheddar|parmesan|gouda|hard cheese)\b/.test(n)) return addDays(30);
  if (/\b(bread|toast|bun|bagel|loaf|roll)\b/.test(n)) return addDays(5);
  if (/\b(strawberry|blueberry|raspberry|berry|grape)\b/.test(n)) return addDays(4);
  if (/\b(banana)\b/.test(n)) return addDays(5);
  if (/\b(apple|pear|orange|mango|peach|plum|kiwi|fig)\b/.test(n)) return addDays(7);
  if (/\b(lemon|lime)\b/.test(n)) return addDays(14);
  if (/\b(spinach|lettuce|kale|herb|cilantro|parsley|basil|mint|arugula)\b/.test(n)) return addDays(5);
  if (/\b(broccoli|cauliflower|green bean|asparagus|zucchini|cucumber|celery)\b/.test(n)) return addDays(7);
  if (/\b(tomato|bell pepper|mushroom|eggplant)\b/.test(n)) return addDays(7);
  if (/\b(carrot|potato|onion|garlic|yam|beetroot|cabbage|squash)\b/.test(n)) return addDays(21);
  if (/\b(juice|smoothie)\b/.test(n)) return addDays(7);
  if (/\b(soda|sparkling|water|beverage|drink)\b/.test(n)) return addDays(180);
  if (/\b(frozen|ice cream|gelato)\b/.test(n)) return addDays(180);
  if (/\b(canned|can|jar|pickle|preserved|sauce|ketchup|mayo|mustard|condiment)\b/.test(n)) return addDays(180);
  if (/\b(pasta|rice|flour|sugar|oat|cereal|grain|lentil|bean|chickpea|quinoa|couscous)\b/.test(n)) return addDays(365);
  if (/\b(oil|vinegar|soy sauce|hot sauce|spice|salt|pepper|seasoning)\b/.test(n)) return addDays(365);
  if (/\b(chip|crisp|cracker|cookie|biscuit|candy|chocolate|snack|nut|almond|cashew)\b/.test(n)) return addDays(60);
  if (/\b(coffee|tea)\b/.test(n)) return addDays(180);
  if (/\b(ghee|clarified butter)\b/.test(n)) return addDays(90);
  return addDays(14); // default 2 weeks
};

/**
 * Fuzzy token match: handles singular/plural (egg↔eggs, tomato↔tomatoes, berry↔berries)
 */
export const fuzzyTokenMatch = (token, tokenSet) => {
  if (tokenSet.has(token)) return true;
  if (token.endsWith('ies') && token.length > 5 && tokenSet.has(token.slice(0, -3) + 'y')) return true;
  if (token.endsWith('ves') && token.length > 5 && tokenSet.has(token.slice(0, -3) + 'f')) return true;
  if (token.endsWith('es') && token.length > 4 && tokenSet.has(token.slice(0, -2))) return true;
  if (token.endsWith('s') && token.length > 3 && tokenSet.has(token.slice(0, -1))) return true;
  if (tokenSet.has(token + 's')) return true;
  if (tokenSet.has(token + 'es')) return true;
  return false;
};

/**
 * Subtle Haptic Feedback utility (Web Standard)
 */
export const triggerHaptic = (intensity = 10) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(intensity);
  }
};