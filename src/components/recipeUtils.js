const MINOR_WORDS = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'in', 'of', 'up', 'as', 'with', 'from', 'into']);

export const toTitleCase = (str) => {
  if (!str) return '';
  return String(str).toLowerCase().split(' ').map((word, i) => {
    if (!word) return word;
    return (i === 0 || !MINOR_WORDS.has(word))
      ? word.charAt(0).toUpperCase() + word.slice(1)
      : word;
  }).join(' ');
};

export const vegetarianBlocklist = [
  'chicken', 'beef', 'pork', 'fish', 'shrimp', 'salmon', 'ham', 'bacon', 'anchovy', 'turkey', 'lamb', 'duck', 'mutton', 'veal', 'crab', 'lobster', 'sausage', 'pepperoni'
];

// ─── Local dietary substitution ───────────────────────────────────────────────

// Cuisine-aware meat substitutes: Indian → paneer, Asian → tofu, Latin/other → legumes
const _meatSub = (cuisine) => {
  const c = (cuisine || '').toLowerCase();
  if (/indian|pakistan|bangladeshi|sri lan/.test(c)) return 'paneer';
  if (/chinese|japanese|korean|thai|vietnamese|asian/.test(c)) return 'firm tofu';
  if (/mexican|latin|caribbean/.test(c)) return 'black beans';
  if (/italian|french|spanish|greek|mediterranean/.test(c)) return 'mushrooms';
  return 'tofu';
};

// Each entry: [searchPattern, getDietSub(cuisine)]
const _SUB_RULES = {
  vegetarian: [
    [/\b(chicken|poultry)\b/gi,  (c) => _meatSub(c)],
    [/\b(beef|steak|brisket)\b/gi, (c) => _meatSub(c)],
    [/\b(pork belly|pork)\b/gi,  (c) => ['italian','french'].some(x => (c||'').includes(x)) ? 'mushrooms' : 'jackfruit'],
    [/\b(lamb|mutton|veal|venison)\b/gi, (c) => _meatSub(c)],
    [/\b(turkey|duck)\b/gi,      () => 'tofu'],
    [/\b(mince|ground meat|ground beef)\b/gi, (c) => /indian|pak/.test(c||'') ? 'soya mince' : 'lentils'],
    [/\b(bacon|pancetta|lardons?|lard)\b/gi, () => 'smoked paprika tofu strips'],
    [/\b(ham|prosciutto|salami|pepperoni|chorizo|sausage)\b/gi, () => 'vegetarian sausage'],
    [/\b(anchov(y|ies))\b/gi,    () => 'capers'],
    [/\b(fish fillets?|white fish|cod|tilapia|sea bass)\b/gi, () => 'firm tofu'],
    [/\b(salmon|tuna|trout|mackerel|haddock)\b/gi, () => 'smoked tofu'],
    [/\b(shrimp|prawn|scallop|mussel|clam|oyster|crab|lobster|seafood)\b/gi, () => 'tofu cubes'],
  ],
  vegan: [
    [/\b(butter|ghee)\b/gi,      () => 'vegan butter'],
    [/\b(milk)\b/gi,             () => 'oat milk'],
    [/\b(heavy cream|double cream|whipping cream)\b/gi, () => 'coconut cream'],
    [/\b(sour cream)\b/gi,       () => 'coconut yogurt'],
    [/\b(cream cheese)\b/gi,     () => 'vegan cream cheese'],
    [/\b(cream)\b/gi,            () => 'coconut cream'],
    [/\b(yogurt|yoghurt)\b/gi,   () => 'coconut yogurt'],
    [/\b(parmesan|pecorino)\b/gi,() => 'nutritional yeast'],
    [/\b(mozzarella|cheddar|brie|ricotta|feta|cheese)\b/gi, () => 'vegan cheese'],
    [/\b(paneer)\b/gi,           () => 'firm tofu'],
    [/\b(eggs?)\b/gi,            () => 'flax egg (1 tbsp ground flax + 3 tbsp water)'],
    [/\b(honey)\b/gi,            () => 'maple syrup'],
    [/\b(gelatin)\b/gi,          () => 'agar agar'],
  ],
  'gluten-free': [
    [/\b(all.purpose flour|plain flour|wheat flour|flour)\b/gi, () => 'rice flour'],
    [/\b(pasta|spaghetti|penne|rigatoni|linguine|tagliatelle)\b/gi, () => 'gluten-free pasta'],
    [/\b(noodles?|ramen noodles|egg noodles)\b/gi, () => 'rice noodles'],
    [/\b(soy sauce)\b/gi,        () => 'tamari (gluten-free soy sauce)'],
    [/\b(bread crumbs?|panko|breadcrumbs?)\b/gi, () => 'gluten-free breadcrumbs'],
    [/\b(barley|rye|spelt|bulgur|couscous|semolina)\b/gi, () => 'quinoa'],
  ],
  'dairy-free': [
    [/\b(butter|ghee)\b/gi,      () => 'vegan butter'],
    [/\b(milk)\b/gi,             () => 'oat milk'],
    [/\b(heavy cream|double cream|whipping cream)\b/gi, () => 'coconut cream'],
    [/\b(sour cream)\b/gi,       () => 'coconut yogurt'],
    [/\b(cream cheese)\b/gi,     () => 'dairy-free cream cheese'],
    [/\b(cream)\b/gi,            () => 'coconut cream'],
    [/\b(yogurt|yoghurt)\b/gi,   () => 'coconut yogurt'],
    [/\b(parmesan|pecorino)\b/gi,() => 'nutritional yeast'],
    [/\b(mozzarella|cheddar|brie|ricotta|feta|cheese)\b/gi, () => 'dairy-free cheese'],
    [/\b(paneer)\b/gi,           () => 'firm tofu'],
  ],
  halal: [
    [/\b(pork belly|pork)\b/gi,  () => 'chicken'],
    [/\b(bacon|pancetta|lardons?|lard)\b/gi, () => 'turkey bacon'],
    [/\b(ham|prosciutto|salami|pepperoni|chorizo)\b/gi, () => 'halal beef sausage'],
    [/\b(wine)\b/gi,             () => 'grape juice'],
    [/\b(beer|ale|stout)\b/gi,   () => 'broth'],
  ],
  kosher: [
    [/\b(pork belly|pork)\b/gi,  () => 'beef'],
    [/\b(bacon|pancetta|lard)\b/gi, () => 'beef facon strips'],
    [/\b(ham|prosciutto)\b/gi,   () => 'turkey breast'],
    [/\b(shrimp|prawn|lobster|crab|scallop|mussel|oyster|clam|shellfish)\b/gi, () => 'white fish'],
    [/\b(butter)\b/gi,           () => 'olive oil'], // meat + dairy separation
  ],
};

export const locallyAdaptRecipe = (recipe, targetDiet) => {
  const diet = targetDiet.toLowerCase();
  // Vegan includes all vegetarian subs too
  const rules = diet === 'vegan'
    ? [...(_SUB_RULES.vegetarian || []), ...(_SUB_RULES.vegan || [])]
    : (_SUB_RULES[diet] || []);

  if (!rules.length) return recipe;

  const cuisine = recipe.cuisine || recipe.meal_type || '';
  const substitutionLog = [];

  // Extract the leading quantity/measurement from an ingredient string
  const _extractQty = (s) => {
    const m = s.match(/^([\d\/\.\s\-½⅓¼¾⅛]+(?:cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|ounces?|g|kg|lb|lbs|mls?|l|piece|pieces|slice|slices|bunch|cloves?|can|jar|head|sprigs?|\s)*)/i);
    return m ? m[0].trimEnd() : '';
  };

  const adaptIngredient = (ing) => {
    for (const [pattern, getSub] of rules) {
      if (!pattern.test(ing)) continue;
      const sub = getSub(cuisine);
      // If the pattern matches a whole-protein word, replace the ENTIRE ingredient
      // (preserving only the leading quantity) to avoid "boneless skinless mushroom breasts"
      const qty = _extractQty(ing);
      const result = qty ? `${qty} ${sub}` : toTitleCase(sub);
      substitutionLog.push({ from: ing, to: result });
      return result;
    }
    return ing;
  };

  const updatedIngredients = (recipe.ingredients || []).map(adaptIngredient);

  // Update step text to reference new ingredient names
  const updatedSteps = (recipe.steps || []).map(step => {
    let s = step;
    for (const [pattern, getSub] of rules) {
      s = s.replace(pattern, getSub(cuisine));
    }
    return s;
  });

  const adapted = {
    ...recipe,
    id: `adapted-local-${recipe.id}`,
    name: `${recipe.name} (${targetDiet})`,
    ingredients: updatedIngredients,
    cleanedIngredients: updatedIngredients.map(cleanIngredientLocally).filter(Boolean),
    steps: updatedSteps,
    _adapted: true,
    _adaptedFor: targetDiet,
    _substitutions: substitutionLog,
  };

  return adapted;
};

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
  name = name.replace(/\b(?:organic|fresh|large|small|medium|extra|reduced fat|low fat|low-sodium|low sodium|unsalted|sliced|diced|chopped|shredded|minced|ground|boneless|skinless|prepared|peeled|packaged|package|pack|can|canned|jar|bottle|tube|stick|slice|pieces|piece|cups?|tablespoons?|tbsps?|teaspoons?|tsps?|grams?|g|kg|pounds?|lb|lbs|oz|ounces?|fluid|fl oz|mls?|ltrs?|liters?|litres?|pkg|ct|count)\b/g, ' ');
  // Strip any leading unit words that may remain after digit removal (e.g. "tbsp olive oil")
  name = name.replace(/^(?:tbsps?|tsps?|tablespoons?|teaspoons?|cups?|oz|ounces?|g|kg|lb|lbs|mls?|fl)\s+/, '');
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
  if (/\b(cups?|mls?|l|liter|litres?|milk|yogurt|broth|water)\b/.test(lower)) return `${1 * multiplier} cup ${nameOnly}`;
  if (/\b(tbsps?|tablespoons?|oil|sauce|vinegar|soy)\b/.test(lower)) return `${1 * multiplier} tbsp ${nameOnly}`;
  if (/\b(tsps?|teaspoons?|garlic|ginger|salt|pepper|spice|herb)\b/.test(lower)) return `${0.5 * multiplier} tsp ${nameOnly}`;
  if (/\b(flour|rice|lentil|sugar|pasta|beans)\b/.test(lower)) return `${1 * multiplier} cup ${nameOnly}`;
  if (/\b(onion|tomato|potato|carrot|apple)\b/.test(lower)) return `${1 * multiplier} medium ${nameOnly}`;
  if (/\b(paneer|tofu|cheese|yogurt)\b/.test(lower)) {
    const oz = Math.max(1, Math.round((100 * multiplier) / 28.35));
    return `${oz} oz ${nameOnly}`;
  }
  return `${1 * multiplier} each ${nameOnly}`;
};

// Strip parenthetical notes from ingredient names: "maple syrup (optional)" → "maple syrup"
export const stripIngredientNotes = (ing) =>
  String(ing || '')
    .replace(/\s*\([^)]*\)/g, '')   // remove (anything in parens)
    .replace(/\s*,?\s*optional\b.*/i, '')  // remove ", optional..." suffix
    .replace(/\s*,?\s*to taste\b.*/i, '')  // remove ", to taste"
    .replace(/\s*,?\s*or to taste\b.*/i, '')
    .trim();

// Cooking-method-only words that should never appear as standalone ingredients after splitting
const _COOKING_METHOD_ONLY = /^(boiled?|mashed?|fried|baked|grilled?|steamed?|saut[eé]ed?|roasted?|cooked?|drained?|rinsed?|peeled?|sliced?|diced?|chopped?|minced?|grated?|shredded?|beaten?|softened?|melted?|toasted?)(\s+and\s+\w+)?$/i;

const _cleanStep = (s) => String(s || '')
  .replace(/\r\n?/g, '\n')
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
  .replace(/[■▪▶►→•·□▪� ]/g, '')
  .trim();

// Strip leading "Step N:" / "1." / "1)" prefixes from a step string
const _stripStepPrefix = (s) =>
  s.replace(/^(?:step\s*)?\d+[\.\:\)]\s*/i, '').trim();

const _isValidStep = (s) => {
  if (!s || s.length < 8) return false;
  if (/^step\s*\d+[\.\:]?\s*$/i.test(s)) return false; // "Step 1" / "Step 1:" alone
  if (/^[\d\s\.\:\-\(\)■•·]+$/.test(s)) return false;   // just numbers/punctuation
  return true;
};

// Split a long paragraph into sentence-sized steps
const _splitLongStep = (s) => {
  if (s.length <= 350) return [s];
  // Split on ". " followed by a capital letter, or on numbered sub-steps
  const parts = s.split(/(?<=\.)\s+(?=[A-Z])|(?=\d+\.\s+[A-Z])/g)
    .map(p => p.trim())
    .filter(p => p.length >= 8);
  return parts.length > 1 ? parts : [s];
};

export const getStaticRecipeSteps = (recipe) => {
  if (!recipe) return ['Follow the ingredient list to create the dish.'];
  const rawSteps = recipe.steps || recipe.instructions || recipe.step || [];
  let steps = [];
  if (Array.isArray(rawSteps)) {
    steps = rawSteps
      .map(_cleanStep)
      .map(_stripStepPrefix)
      .filter(_isValidStep)
      .flatMap(_splitLongStep);
  } else {
    const textSteps = _cleanStep(String(rawSteps || ''));
    if (textSteps.includes('\n')) {
      steps = textSteps.split(/\n+/)
        .map(_cleanStep)
        .map(_stripStepPrefix)
        .filter(_isValidStep)
        .flatMap(_splitLongStep);
    } else if (textSteps && _isValidStep(textSteps)) {
      steps = _splitLongStep(textSteps);
    }
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
const MEAT_PATTERN = /\b(chicken|beef|pork|lamb|turkey|bacon|sausage|ham|veal|duck|venison|mutton|meat|meatball|mincemeat|mince|pepperoni|salami|brisket|chorizo|lard|suet|gelatin)\b/;
const FISH_PATTERN = /\b(fishs?|salmons?|tunas?|shrimps?|crabs?|lobsters?|anchovies|anchovy|trouts?|cods?|seafood|tilapias?|halibuts?|sardines?|prawns?|mussels?|clams?|oysters?|scallops?|squids?|calamari|eels?|mackerels?|herrings?|catfish|swordfish|snappers?|bass|groupers?|haddocks?|mahi|pollocks?|carps?|kingfish|pomfret|hilsa|breams?|perch|plaice|flounders?|sole|turbot|monkfish|sea bass|red snapper|barramundi|whitefish|cockles?|whelks?|abalone|octopus|langoustine|crawfish|crayfish|octopi|calamares?|whitebait|sprats?|pilchard|kippers?|roe|caviar|surimi|fishmeal)\b/;
// Plant milks/creams are excluded from the non-vegan check
const PLANT_BASE = /\b(oat|coconut|soy|almond|rice|cashew|hemp|macadamia|hazelnut)\b/;
const NON_VEGAN_PATTERN = /\b(egg|eggs|milk|butter|cheese|cream|yogurt|honey|gelatin|paneer|whey|lard|suet|casein|lactose|rennet)\b/;

const GLUTEN_PATTERN = /\b(wheat|flour|bread|pasta|rye|barley|spelt|semolina|couscous|bulgur|malt|noodle|crouton|breadcrumb|orzo|udon|soba|batter|dumpling|pita|panko)\b/;
const DAIRY_PATTERN = /\b(milk|cheese|butter|cream|yogurt|paneer|ghee|curd|whey|kefir|mozzarella|cheddar|parmesan|brie|ricotta|cottage|sour cream|custard|lactose|casein|rennet)\b/;
const NUT_PATTERN = /\b(almond|cashew|walnut|peanut|pistachio|hazelnut|pecan|macadamia|brazil nut|pine nut|chestnut|praline)\b/;
const PORK_PATTERN = /\b(pork|ham|bacon|sausage|salami|pepperoni|chorizo|lard|prosciutto|pancetta)\b/;
const SHELLFISH_PATTERN = /\b(shrimp|crab|lobster|prawn|mussel|clam|oyster|scallop|crayfish)\b/;

export const isRecipeVegan = (recipe) => {
  const ings = recipe.cleanedIngredients || [];
  // Fish and seafood are not vegan
  if (ings.some(ing => {
    if (/\b(broth|stock|powder|extract|flavor|flavour)\b/.test(ing)) return false;
    return FISH_PATTERN.test(ing);
  })) return false;
  return !ings.some((ing) => {
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

export const isRecipeGluten = (recipe) =>
  (recipe.cleanedIngredients || []).some(ing => GLUTEN_PATTERN.test(ing));

export const isRecipeDairy = (recipe) =>
  (recipe.cleanedIngredients || []).some(ing => {
    if (!DAIRY_PATTERN.test(ing)) return false;
    if (PLANT_BASE.test(ing) && /\b(milk|cream)\b/.test(ing)) return false;
    return true;
  });

export const isRecipeNut = (recipe) =>
  (recipe.cleanedIngredients || []).some(ing => NUT_PATTERN.test(ing));

export const isRecipePork = (recipe) =>
  (recipe.cleanedIngredients || []).some(ing => PORK_PATTERN.test(ing));

export const isRecipeShellfish = (recipe) =>
  (recipe.cleanedIngredients || []).some(ing => SHELLFISH_PATTERN.test(ing));

const cuisineMatch = (recipe, ...areas) => {
  // Check both cuisine field and meal_type (saved recipes embed cuisine in meal_type)
  const c = ((recipe.cuisine || '') + ' ' + (recipe.meal_type || '')).toLowerCase();
  return areas.some(a => c.includes(a));
};

export const matchesRecipeFilter = (recipe, filter) => {
  switch (filter) {
    case 'vegetarian':
      return !isRecipeMeat(recipe) && !isRecipeFish(recipe);
    case 'vegan':
      return isRecipeVegan(recipe) && !isRecipeMeat(recipe) && !isRecipeFish(recipe);
    case 'gluten-free': return !isRecipeGluten(recipe);
    case 'dairy-free': return !isRecipeDairy(recipe);
    case 'nut-free': return !isRecipeNut(recipe);
    case 'halal': return !isRecipePork(recipe);
    case 'kosher': return !isRecipePork(recipe) && !isRecipeShellfish(recipe);
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

const _nutritionCache = new Map();
const _categoryCache = new Map();

const _estimateNutritionImpl = (n) => {
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
  // Additional common items
  if (/\b(vinegar|balsamic)\b/.test(n)) return { kcal: 18, protein: 0, carbs: 3, fat: 0 };
  if (/\b(mustard)\b/.test(n)) return { kcal: 66, protein: 4, carbs: 6, fat: 4 };
  if (/\b(mayo|mayonnaise)\b/.test(n)) return { kcal: 680, protein: 1, carbs: 1, fat: 75 };
  if (/\b(hot sauce|sriracha|tabasco)\b/.test(n)) return { kcal: 35, protein: 1, carbs: 7, fat: 0.5 };
  if (/\b(jam|jelly|marmalade|preserves)\b/.test(n)) return { kcal: 250, protein: 0.5, carbs: 65, fat: 0 };
  if (/\b(pickle|pickled)\b/.test(n)) return { kcal: 12, protein: 0.6, carbs: 2.6, fat: 0.2 };
  if (/\b(cereal|granola|muesli)\b/.test(n)) return { kcal: 370, protein: 8, carbs: 72, fat: 5 };
  if (/\b(tortilla|wrap|pita|naan)\b/.test(n)) return { kcal: 300, protein: 8, carbs: 55, fat: 5 };
  if (/\b(cracker|crisp|chip|popcorn)\b/.test(n)) return { kcal: 450, protein: 7, carbs: 68, fat: 18 };
  if (/\b(waffle|pancake|crepe)\b/.test(n)) return { kcal: 227, protein: 6, carbs: 30, fat: 10 };
  if (/\b(ice cream|gelato|sorbet)\b/.test(n)) return { kcal: 207, protein: 3.5, carbs: 24, fat: 11 };
  if (/\b(cake|pie|tart|brownie|cookie|muffin)\b/.test(n)) return { kcal: 380, protein: 5, carbs: 55, fat: 16 };
  if (/\b(soup)\b/.test(n)) return { kcal: 50, protein: 3, carbs: 8, fat: 1 };
  if (/\b(salad dressing|ranch|caesar|vinaigrette)\b/.test(n)) return { kcal: 300, protein: 1, carbs: 8, fat: 30 };
  if (/\b(tahini|hummus)\b/.test(n)) return { kcal: 595, protein: 17, carbs: 21, fat: 53 };
  if (/\b(miso)\b/.test(n)) return { kcal: 200, protein: 12, carbs: 27, fat: 6 };
  if (/\b(curry paste|curry powder|turmeric|cumin|coriander|paprika|cinnamon|cardamom|clove|nutmeg|oregano|thyme|rosemary|basil|bay)\b/.test(n)) return { kcal: 325, protein: 13, carbs: 55, fat: 10 };
  if (/\b(baking powder|baking soda|yeast)\b/.test(n)) return { kcal: 53, protein: 0, carbs: 28, fat: 0 };
  if (/\b(cornstarch|cornflour|arrowroot)\b/.test(n)) return { kcal: 381, protein: 0.3, carbs: 91, fat: 0.1 };
  if (/\b(gelatin|agar)\b/.test(n)) return { kcal: 335, protein: 85, carbs: 0, fat: 0 };
  if (/\b(protein powder|whey protein|casein)\b/.test(n)) return { kcal: 380, protein: 80, carbs: 5, fat: 5 };
  if (/\b(energy drink|sports drink|gatorade)\b/.test(n)) return { kcal: 45, protein: 0, carbs: 11, fat: 0 };
  if (/\b(frozen)\b/.test(n)) return { kcal: 120, protein: 5, carbs: 18, fat: 3 };
  if (/\b(canned|tinned)\b/.test(n)) return { kcal: 100, protein: 5, carbs: 15, fat: 2 };
  // Universal fallback: generic food estimate
  return { kcal: 150, protein: 4, carbs: 20, fat: 5 };
};

/**
 * Estimate nutrition (per 100g) for a named ingredient using a static lookup.
 * Returns { kcal, protein, carbs, fat } or null if unknown.
 * Results are cached per ingredient name for the lifetime of the session.
 */
export const estimateNutrition = (itemName) => {
  const n = (itemName || '').toLowerCase();
  if (_nutritionCache.has(n)) return _nutritionCache.get(n);
  const result = _estimateNutritionImpl(n);
  _nutritionCache.set(n, result);
  return result;
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

export const CATEGORY_ICONS = {
  'Proteins': '🫘',
  'Dairy & Eggs': '🥛',
  'Fruits': '🍎',
  'Vegetables': '🥦',
  'Beverages': '☕',
  'Snacks': '🍿',
  'Frozen': '🧊',
  'Sauces': '🫙',
  'Spices': '🌶️',
  'General': '📦',
};

export const CATEGORY_ORDER = ['Proteins', 'Dairy & Eggs', 'Fruits', 'Vegetables', 'Beverages', 'Snacks', 'Frozen', 'Sauces', 'Spices', 'General'];

// Frozen checked FIRST — "Frozen Chicken" must be Frozen, not Proteins
// Snacks checked before Vegetables — "potato chips" must be Snacks not Vegetables
// Spices/Sauces checked before Vegetables — "chili powder" must be Spices, not Vegetables
// Patterns use s? / es? / ies endings to match plural forms (bananas, apples, tomatoes, etc.)
const _categorizeItemImpl = (n) => {
  if (/\b(frozen|ice creams?|gelatos?|popsicles?|sorbets?)\b/.test(n)) return 'Frozen';
  if (/\b(chickens?|beefs?|pork|lambs?|turkeys?|fishs?|salmons?|tunas?|shrimps?|crabs?|lobsters?|bacons?|sausages?|hams?|muttons?|ducks?|seafood|steaks?|minces?|pepperonis?|anchovies|anchovy|venisons?|veals?|salamis?|meats?|prawns?)\b/.test(n)) return 'Proteins';
  if (/\b(milks?|cheeses?|butters?|yogurts?|creams?|eggs?|paneer|ghee|curd|whey|kefir|mozzarella|cheddars?|parmesan|brie|ricotas?|ricotta|cottage|sour cream|dairy)\b/.test(n)) return 'Dairy & Eggs';
  if (/\b(apples?|bananas?|oranges?|mangoes?|mangos?|grapes?|strawberr(?:y|ies)|blueberr(?:y|ies)|raspberr(?:y|ies)|blackberr(?:y|ies)|lemons?|limes?|pears?|peaches?|plums?|cherr(?:y|ies)|watermelons?|melons?|pineapples?|kiwis?|avocados?|figs?|dates?|papayas?|guavas?|coconuts?|pomegranates?|passion fruits?|lychees?|mandarins?|tangerines?|clementines?|grapefruit)\b/.test(n)) return 'Fruits';
  if (/\b(waters?|juices?|sodas?|teas?|coffees?|beers?|wines?|spirits?|whiskeys?|vodkas?|rums?|gins?|drinks?|beverages?|smoothies?|shakes?|colas?|lemonades?|kombuchas?|sparkling)\b/.test(n)) return 'Beverages';
  if (/\b(chips?|crisps?|crackers?|cookies?|biscuits?|candies?|candy|chocolates?|popcorns?|pretzels?|almonds?|cashews?|walnuts?|peanuts?|pistachios?|trail mix|granola|protein bars?|rice cakes?|snacks?|nuts?)\b/.test(n)) return 'Snacks';
  if (/\b(ketchups?|mustards?|mayo|mayonnaise|hot sauce|soy sauce|oyster sauce|fish sauce|teriyaki|worcestershire|hoisin|tahini|sriracha|pesto|harissa|miso|tomato paste|tamarind|vinegar|aioli|ranch|pasta sauce|marinara|alfredo|bbq sauce|barbecue sauce|coconut aminos|chili sauce|salsa|dressings?|relish|chutney|olive oil|vegetable oil|sesame oil|coconut oil|canola oil)\b/.test(n)) return 'Sauces';
  if (/\b(cumin|coriander powder|turmeric|paprika|cardamom|cinnamon|cloves?|oregano|thyme|rosemary|allspice|nutmeg|saffron|cayenne|fenugreek|sumac|caraway|star anise|bay leaves?|garam masala|mixed spice|five.?spice|ras el hanout|berbere|za.?atar|italian seasoning|curry powder|chili powder|chili flakes?|red pepper flakes?|black pepper|white pepper|mustard seeds?|fennel seeds?|coriander seeds?|cumin seeds?|onion powder|garlic powder|celery salt|smoked paprika|chaat masala|biryani masala|tandoori masala|peri.?peri|jerk seasoning|old bay|seasoning|spice mix)\b/.test(n)) return 'Spices';
  if (/\b(carrots?|potatoes?|tomatoes?|onions?|garlic|spinach|broccoli|cauliflower|lettuces?|cabbages?|cucumbers?|peppers?|celery|kale|zucchinis?|eggplants?|aubergines?|mushrooms?|corns?|peas?|beans?|lentils?|asparagus|beetroots?|radishes?|radish|leeks?|okra|squash|yams?|ginger|chilis?|chillies?|capsicums?|chard|arugula|herbs?|cilantro|parsley|basil|mint|scallions?|shallots?|artichokes?|turnips?|parsnips?|fennel|bok choy|watercress|endive)\b/.test(n)) return 'Vegetables';
  return 'General';
};

export const categorizeItem = (itemName) => {
  const n = (itemName || '').toLowerCase();
  if (_categoryCache.has(n)) return _categoryCache.get(n);
  const result = _categorizeItemImpl(n);
  _categoryCache.set(n, result);
  return result;
};