// seed-recipes.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://hlyiihiztwgtktqfkxkb.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseWlpaGl6dHdndGt0cWZreGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDI2MTMsImV4cCI6MjA5NTIxODYxM30.IzqAuhMUksmcvw60wMSwbKDapW8t4YLMrNT_DHD9eqw";
const supabase = createClient(supabaseUrl, supabaseKey);

const proteins = ['paneer', 'tofu', 'lentils', 'chickpeas', 'black beans', 'mushrooms', 'tempeh', 'seitan'];
const modifiers = ['spicy', 'garlic-infused', 'smoked', 'tandoori', 'wood-fired', 'creamy', 'tangy', 'crispy', 'honey-glazed', 'zesty'];
const formats = ['tacos', 'grain bowl', 'curry masala', 'artisan pizza', 'flatbread', 'burger', 'loaded fries', 'skillet breakfast', 'stir-fry', 'salad wrap'];
const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Brunch'];

// Formats call for specific logical baseline ingredients instead of generic ones
const formatIngredientsMap = {
  'tacos': ['corn tortillas', 'avocado lime crema', 'shredded cabbage', 'cilantro'],
  'grain bowl': ['quinoa', 'sweet potato cubes', 'tahini dressing', 'kale'],
  'curry masala': ['coconut milk', 'tomato gravy', 'ginger paste', 'garlic paste'],
  'artisan pizza': ['pizza dough', 'mozzarella', 'marinara sauce', 'fresh basil'],
  'flatbread': ['naan bread', 'pesto sauce', 'goat cheese', 'arugula'],
  'burger': ['brioche bun', 'pepper jack cheese', 'lettuce', 'sliced tomato'],
  'loaded fries': ['french fries', 'cheese sauce', 'jalapeños', 'red onions'],
  'skillet breakfast': ['eggs', 'hashbrowns', 'bell peppers', 'onions'],
  'stir-fry': ['rice noodles', 'soy sauce', 'broccoli florets', 'carrots'],
  'salad wrap': ['spinach tortilla', 'romaine lettuce', 'cucumber slice', 'ranch']
};

function generateRealisticRecipes() {
  const recipes = [];
  let idCounter = 1;

  while (recipes.length < 5000) {
    const protein = proteins[Math.floor(Math.random() * proteins.length)];
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    const format = formats[Math.floor(Math.random() * formats.length)];
    const mealType = mealTypes[Math.floor(Math.random() * mealTypes.length)];

    const name = `${modifier.charAt(0).toUpperCase() + modifier.slice(1)} ${protein.charAt(0).toUpperCase() + protein.slice(1)} ${format} #${idCounter}`;
    
    // Dynamically grab the exact matching format items
    const logicalBaseIngredients = formatIngredientsMap[format];
    
    // Construct the final array strictly using the specific protein and structural ingredients
    const ingredients = Array.from(new Set([protein, ...logicalBaseIngredients]));
    
    recipes.push({
      name,
      ingredients, 
      meal_type: mealType
    });

    idCounter++;
  }
  return recipes;
}

async function seedDatabase() {
  console.log("⚠️ Purging stale placeholder recipe records...");
  
  // Wipe the old table rows so the generic baseline items are completely gone
  const { error: purgeError } = await supabase.from('recipes').delete().neq('id', 0);
  if (purgeError) {
    console.error("❌ Failed to purge database:", purgeError.message);
    return;
  }
  
  console.log("⚡ Compiling 5,000 realigned, unique vegetarian recipe variations...");
  const completeDataset = generateRealisticRecipes();
  
  const BATCH_SIZE = 500;
  for (let i = 0; i < completeDataset.length; i += BATCH_SIZE) {
    const batch = completeDataset.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('recipes').insert(batch);
    
    if (error) {
      console.error(`❌ Batch save failure at index ${i}:`, error.message);
      break;
    }
    console.log(`📦 Synced recipes ${i + 1} to ${Math.min(i + BATCH_SIZE, completeDataset.length)} successfully.`);
  }
  console.log("🚀 Custom dynamic recipe catalog successfully written!");
}

seedDatabase();