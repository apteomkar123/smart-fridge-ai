# Hungry: Comprehensive Interactive Tutorial Specification

## 🎯 Objective
Implement a step-by-step interactive walkthrough that triggers automatically for first-time users (after onboarding preferences are saved). The tutorial must use the "Liquid Glass" design system, utilizing `framer-motion` for pulsing highlights and `backdrop-blur-3xl` for callout overlays.

## 💬 The Hook
**Intro Message:** "Everyone skips tutorials, but you won't want to skip this one. You can do a lot with this app."

---

## 🛠 Tutorial Phases & Feature Coverage

### 1. The Smart Pantry (Pantry Tab)
- **Highlight:** The "Add" action group (Barcode, Receipt, Manual).
- **Guidance:** 
  - **Scanning:** "Snap receipts or scan barcodes. Our AI parses quantities, calculates expiry dates, and fetches nutritional facts automatically."
  - **Organization:** "Group items by category (Proteins, Dairy, Spices) and toggle between Personal and Household stock."
  - **Details:** "Tap any item to see its Eco-Score, edit quantities with the stepper, or check its value."

### 2. Culinary Intelligence (Recipe Explorer)
- **Highlight:** Mood Food selector and AI Chef Hat.
- **Guidance:**
  - **Mood Food:** "Feeling 'Adventurous' or 'Tired'? Pick a mood to filter recipes that match your energy."
  - **AI Generator:** "Pick specific ingredients you need to use up, and the AI will invent a custom recipe."
  - **Matching:** "Green and amber dots show exactly what you have in stock. No more 'oops, I'm out of eggs'."

### 3. Recipe Mastery (Inside a Recipe Card)
- **Highlight:** Sticky Header, Adaptation Buttons, and "Add All Missing."
- **Guidance:**
  - **Adaptations:** "One tap to 'Make Vegetarian', 'Make Vegan', or 'Proteinize' (AI adds high-protein ingredients)."
  - **Shopping Logic:** "Tap 'Add All Missing' at the top to instantly populate your shopping list with exactly what you're short on."
  - **Cooking Mode:** "Hit 'Start Cooking' for the Virtual Sous Chef. Use voice commands like 'Next Step', 'Ingredients', or 'Substitute for Milk' for hands-free guidance."
  - **Mark Cooked:** "Once finished, tap 'Cooked!' to automatically subtract ingredients from your pantry and log the meal to your history."

### 4. Personal Shopper (Shopping Tab)
- **Highlight:** The "Personal Shopper" mode and Aisle grouping.
- **Guidance:**
  - **Aisle Logic:** "Items are auto-grouped by aisle (Produce, Snacks, etc.) for 13+ major stores like Trader Joe's and Walmart."
  - **Household Sync:** "Swipe items to move them between your personal list and shared household lists."

### 5. Social & Household (Household & Friends Tabs)
- **Highlight:** Settle Up, Potluck, and Friend Feed.
- **Guidance:**
  - **Settle Up:** "View shared costs and send Venmo/Splitwise requests with one tap."
  - **Potluck:** "Create events, share codes, and watch the progress bar fill as friends claim items."
  - **Friends:** "Search by Friend Code and view the public cooking feed to see what your circle is whipping up."

### 6. Analytics & The Remix (Analytics & History)
- **Highlight:** Taste Heatmap and Leftover Remix.
- **Guidance:**
  - **Taste Profile:** "View your 'mastery' of world cuisines (Indian, Italian, etc.) and earn badges like 'Master Chef'."
  - **Nutrition Coach:** "Set macro goals and let the AI suggest specific ingredients to hit your targets."
  - **Remix Engine:** "In your History, tap 'Remix Leftovers' on a past meal. The AI will invent a *new* recipe to use up what's left in the fridge."

---

## 🏗 Implementation Instructions for Claude Code

### 1. Database & State
Update the `public.profiles` table to track tutorial completion.
**SQL Query to run in Supabase:**
```sql
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_completed_tutorial BOOLEAN DEFAULT FALSE;
```

### 2. Frontend Logic
- **Trigger:** Check `profile.has_completed_tutorial` in `UserContext.jsx`. If false, mount the `TutorialOverlay`.
- **Component:** Create a `TutorialOverlay.jsx` that wraps the app. Use `framer-motion`'s `AnimatePresence`.
- **Style:** 
  - Use a pulsing `#6BAEE0` (Hungry Blue) ring for highlights.
  - Tooltips should use `backdrop-blur-3xl` and the `Yellowtail` font for headers.

### 3. Final Step
- On the last step, fire a `canvas-confetti` celebration.
- Call `supabase.from('profiles').update({ has_completed_tutorial: true }).eq('id', user.id)` to persist state.

---

## ✅ Feature Checklist for Tutorial Logic
- [x] AI Recipe Generation & Ingredient Selection
- [x] Receipt/Barcode Scanning (Pantry)
- [x] Recipe Adaptations (Veg/Vegan/Proteinize)
- [x] Virtual Sous Chef (Voice Navigation & Substitutions)
- [x] Personal Shopper (Store-specific Aisle Tracking)
- [x] Settle Up (Venmo/Splitwise)
- [x] Potluck Event Management
- [x] Taste Profile Heatmap & Mastery Badges
- [x] AI Nutrition Coach (Macro Goals)
- [x] Leftover Remix Engine (from History)
- [x] Mark as Cooked (Inventory Subtraction)
```
