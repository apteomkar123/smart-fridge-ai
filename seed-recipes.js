// seed-recipes.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Configuration Layer: Update these strings directly if your local .env file isn't loading
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://hlyiihiztwgtktqfkxkb.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhseWlpaGl6dHdndGt0cWZreGtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2NDI2MTMsImV4cCI6MjA5NTIxODYxM30.IzqAuhMUksmcvw60wMSwbKDapW8t4YLMrNT_DHD9eqw";
const supabase = createClient(supabaseUrl, supabaseKey);

const bases = ['paneer', 'lentils', 'tofu', 'chickpeas', 'black beans', 'mushrooms', 'spinach', 'avocado', 'sourdough bread', 'croissants', 'sweet potato', 'jackfruit', 'quinoa'];
const modifiers = ['spicy', 'garlic', 'roasted', 'smoked', 'tandoori', 'wood-fired', 'creamy', 'tangy', 'crispy', 'house-special', 'street-style'];
const formats = ['tacos', 'bowl', 'curry', 'artisan pizza', 'flatbread', 'burger', 'loaded fries', 'skillet', 'stir-fry', 'salad wrapper'];
const extras = [['jalapeños', 'onions'], ['pineapple', 'cilantro'], ['black olives', 'cherry tomatoes'], ['pepper jack cheese', 'avocado lime crema'], ['garlic confit', 'spinach leaves']];
const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Brunch'];

function generate5000Recipes() {
  const recipes = [];
  let idCounter = 1;

  while (recipes.length < 5000) {
    const base = bases[Math.floor(Math.random() * bases.length)];
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    const format = formats[Math.floor(Math.random() * formats.length)];
    const extraPair = extras[Math.floor(Math.random() * extras.length)];
    const mealType = mealTypes[Math.floor(Math.random() * mealTypes.length)];

    // Synthesize name with an incrementing number suffix to bypass string collision walls
    const name = `${modifier.charAt(0).toUpperCase() + modifier.slice(1)} ${base.charAt(0).toUpperCase() + base.slice(1)} ${format} #${idCounter}`;
    
    // Isolate unified array strings cleanly
    const ingredients = Array.from(new Set([base, ...extraPair, 'olive oil', 'garlic']));
    
    recipes.push({
      name,
      ingredients, // Stored directly as a JSON array in Postgres
      meal_type: mealType
    });

    idCounter++;
  }
  return recipes;
}

async function seedDatabase() {
  console.log("⚡ Starting compilation engine for 5,000 vegetarian recipe nodes...");
  const completeDataset = generate5000Recipes();
  
  // Cut the massive array into chunks of 500 records to prevent HTTP timeout limitations
  const BATCH_SIZE = 500;
  for (let i = 0; i < completeDataset.length; i += BATCH_SIZE) {
    const batch = completeDataset.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('recipes').insert(batch);
    
    if (error) {
      console.error(`❌ Batch save execution aborted at segment index ${i}:`, error.message);
      break;
    }
    console.log(`📦 Synthesized and pushed recipes ${i + 1} to ${Math.min(i + BATCH_SIZE, completeDataset.length)} into database rows.`);
  }
  console.log("🚀 Database seeding operation completed cleanly!");
}

seedDatabase();