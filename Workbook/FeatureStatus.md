# Hungry — Feature Status

A living document tracking what's shipped, what works, and what's blocked until the iOS app is ready.

---

## ✅ Ready & Available (Web App)

### Auth
- Email / password sign in and sign up
- Show/hide password toggle (eye icon) on password field
- Forgot password (email reset link)
- **Sign in with AppWare** — "Sync your AppWare apps!" tagline above button; redirects to SSO portal, returns with session token; browser back resets sign-in view correctly
- **Stay signed in** — Supabase client explicitly configured with `persistSession: true` + `autoRefreshToken: true`; session restored from localStorage on every page load so users never have to sign in again
- Google and Apple sign-in removed (replaced by AppWare SSO)
- Onboarding flow — 5-screen liquid-glass intro + preferences sheet (name, dietary restrictions, nutrition goal), written to Supabase on completion
- **Interactive Tutorial** — runs automatically on first login (after onboarding); 10-step walkthrough now covers all features (added Community Recipes, Friends & Profiles, Events); skip or dismiss marks it complete; Re-run Tutorial button in Settings; confetti on finish; intro text no longer has quotation marks

### Pantry
- Add items manually
- Scan a grocery receipt via photo upload (AI parsing)
- Barcode lookup (Open Food Facts API) — barcode input now uses a Plus button (like manual add) instead of a symbol bar
- Edit item details inline
- Remove items
- Expiry date tracking
- Assign items to a personal or household pantry — household picker dropdown when multiple households exist
- Quantity controls per item
- Pantry item names displayed in Title Case (regardless of how they were stored)

### Recipes
- Recipe modal header (title, star, share, X) is sticky — stays locked at top as user scrolls through ingredients and steps
- Recipe images shown at top of modal for MealDB recipes (strMealThumb) and Spoonacular recipes
- **Mood Food** — "How are you feeling?" mood selector (Tired / Post-Workout / Celebratory / Stressed / Adventurous) boosts matching recipes to the top of the explorer
- Recipe explorer powered by MealDB + Spoonacular + static recipes, sorted by pantry match %
- Search by name, ingredient, or filter keyword
- Filter by meal type, diet, and cuisine
- AI recipe generator — pick pantry items, generates a custom recipe
- **Custom Recipe Generator** — "Generate from Any Ingredients" card in the Recipes tab; type any ingredients (not just pantry) to get an AI-generated recipe respecting dietary restrictions
- Recipe detail modal with full ingredient list and steps
- Pantry match indicator per ingredient (green/amber dot)
- Add individual missing ingredients to shopping list
- Add ALL missing ingredients to shopping list in one tap (button at top of recipe card)
- Save recipe to My Saved Recipes or directly to a household (from both the modal and the recipe explorer cards)
- Share recipe to a specific household
- Deep link sharing (unique URL per recipe)
- Convert recipe: Make Vegetarian / Make Vegan / Add Meat (local + AI)
- Proteinize — AI suggests a protein addition
- Ingredient substitution (AI-powered swap)
- Multiplier (1×, 2×, 4× servings)
- Estimated nutrition per serving
- Cooking Mode — full-screen step-by-step view
- Mark as Cooked (updates pantry)

### Personal Shopper
- Store-specific aisle locations for 13+ stores (Trader Joe's, Whole Foods, Walmart, Target, Kroger, Wegmans, Publix, Sprouts, HEB, Costco, Aldi, Harris Teeter, Food Lion, Sam's Club)
- AI substitution suggestion now uses correct format ("If they don't have X, Y works really well instead") and respects dietary restrictions
- Substitution suggestion box styled as a centered pill with sparkle icon
- Full Kroger/Target grocery store API integration requires API keys (planned)

### Shopping List
- Add items manually — items are now stored with their original casing (Title Case), not lowercased
- Items auto-grouped by aisle (Produce, Dairy, Meat, Bakery, etc.)
- Check off items — **checked-off items are automatically added to pantry**
- Delete items
- **Mark All Done** — bulk-complete all pending shopping list items
- **Delete All** — clear the entire shopping list (with confirmation)
- Rename items inline (double-tap or pencil icon)
- Move items between personal list and household lists
- Personal Shopper mode — distraction-free shopping view
- AI swap suggestion in shopping list now respects user dietary restrictions in its prompt

### Chef History
- **Leftover Remix Engine** — "Remix Leftovers" button on each expanded history card; AI generates a new recipe repurposing the leftover ingredients from that cook
- Automatically logged when a recipe is marked as Cooked
- Collapsed card shows photo thumbnail, recipe name, date, meal type, notes preview
- Tap card to expand into a full chef history detail view — does NOT open the recipe modal
- Expanded view shows: recipe name, date + time cooked, "Cooked by [name]", ingredient preview pills, photos grid
- Add personal notes per entry (tap "My Thoughts" area to edit)
- Add photos per entry (from expanded card)
- Delete individual photos
- Toggle public / private visibility
- "View Full Recipe" button in expanded card opens the full recipe modal
- Recipe description saved alongside history entry when available

### Analytics
- **Taste Profile Heatmap** — new "Taste" tab in Analytics showing cuisines explored (bar chart + mastery badge), meal type breakdown, and gamification messages (World Traveler, Master Chef, etc.)
- Nutrition overview — protein / carbs / fat breakdown with distribution bars
- AI Nutrition Coach — pick a macro goal, get ingredient and recipe suggestions
- Eco Score — tracks expiring/expired items and waste risk
- Spending tracker — pantry value, shopping list spend, budget vs. actual
- Set personal budget limit
- Set household budget limit
- Smart Meal Prep — AI generates a weekly batch-cooking plan grouped by shared ingredients
- Save / restore meal plans (persisted to localStorage + Supabase backup)

### Household
- **Settle Up** — shows per-member cost split from household shopping list; Venmo deep-link and Splitwise link per member
- Household member list queries both `active_household_id` and `household_id` in parallel (deduped) — covers old and new schema
- Household shared recipes refresh automatically when a recipe is shared from any screen
- Shared shopping list fetched directly from Supabase per selected household (not relayed from active-household state)
- Create a household with a generated invite code (inline form — no need to go to Settings)
- Join a household via invite code (inline form)
- Switch between multiple households
- Add another household from the household page
- Set a household budget limit
- View household members (with Add Friend button for non-friends)
- Shared shopping list (household-scoped, real-time via Supabase)
- Shared saved recipes (household-scoped)
- Event / Potluck section removed from Household — use the dedicated Events tab instead

### Friends
- Friend codes — auto-generated 6-character alphanumeric code; created on first profile load if missing
- Add friends by code (input inside card, Send button stays inside on all screen sizes)
- Search for friends by display name
- Send friend requests
- Accept / decline incoming friend requests
- View friends' public chef history feed
- Household members show an Add Friend button if not already connected

### Profile (nav section)
- Public profile card: display name, email, cook count, dietary restrictions badges
- Per-feature public/private visibility toggles: Chef History, Saved Recipes, Taste Analytics, Food Photos, Comments & Notes, Created Recipes
- Privacy settings persisted to localStorage and synced to Supabase `profiles.hungry_settings.profile_privacy`
- **Preview Profile** — "Preview My Profile" button shows how other users see your public profile via UserProfileModal

### Settings
- Update display name
- Bio — saved to and loaded from Supabase auth metadata (bio now persists across sessions)
- Profile photo — upload now uses upsert to ensure row exists before writing avatar URL
- Set dietary restrictions
- Set nutrition goal
- Set age, weight, height
- Set personal budget limit
- Default shopping list destination (personal or a specific household)
- Default saved recipes destination (personal or a specific household)
- Re-run App Tutorial
- Invite Friends
- Sign out
- Household settings moved to the Household section

### Saved Recipes — Restaurants Tab
- **Restaurants sub-tab** in the Saved Recipes section — separate from personal saved recipes
- Save any restaurant dish you loved: dish name, restaurant name, location (optional), key ingredients (comma-separated), cuisine type, and vibe tags (Quick Eats, Cheap Eats, Date Night, Family, Healthy)
- Saved dishes persist to localStorage and sync to Supabase as `meal_type = 'Restaurant'` saved_recipe rows
- Filter by cuisine (10 categories) and vibe; search by dish or restaurant name
- Tap a saved dish to open it as a recipe card (shows how to recreate it at home with the listed ingredients)

### Community Recipes / Explore (top-level nav section)
- Category rows with horizontal scroll (limited to 8 cards): Trending, Healthy, Comfort Food, Breakfast, Seafood, Dessert, Beef, Asian, Indian, Mexican, Italian, American, High Protein, Quick & Easy
- **View More** — arrow + "View More" button at the end of each scroll row expands to a full grid; "View All" link in row header also expands; "Show Less" collapses back
- Each recipe card shows the dish photo and name (title-cased); tap to open full recipe card with ingredients and steps
- Search bar at top queries TheMealDB by name in real-time; results are title-cased
- Category data cached per-row for 6 hours in localStorage
- **Dietary filtering** — meat-heavy rows (Trending, Beef, High Protein) hidden for vegetarian/vegan users; Seafood hidden for vegan/vegetarian; recipes adapted via `locallyAdaptRecipe` when opened

### Friends
- Tapping a friend card (or a search result) opens their full profile modal
- Profile shows: avatar, cook count, cuisine mastery badges, Chef History feed (public entries), Favorites tab (saved recipes from Supabase)
- Tapping any recipe in the profile opens it as a full recipe card

### Events (formerly Potluck — renamed in nav)
- Create named events with auto-generated 8-character invite codes (generated client-side as fallback)
- Event creation includes optional date, time, and venue fields — date/time inputs show "Choose date" / "Choose time" placeholder text when empty
- Share event via URL (`?potluck=CODE`) — anyone with the link joins and can claim items
- Claim/unclaim items per event; host can delete items and the whole event
- Readiness progress bar; backed by `potluck_events` + `potluck_items` Supabase tables
- View Full Details card shows each attendee's dietary restrictions (pulled from their profile settings)
- RSVP view shows who's bringing what, unclaimed items, and the user's own dietary restrictions
- **Tappable claimer profiles**: claimed_by names in both the item list and the detail card open the claimer's full Hungry profile (UserProfileModal) when tapped; profile is fetched from Supabase and cached
- **Smart Suggestions**: per-event "✨ Smart Suggestions" button calls AI with event name + attendee dietary restrictions to generate 10 food/drink suggestions; tapping a suggestion pre-fills the add-item input; dietary restrictions respected but not overridden for minority-only restrictions
- **Recipe cards on item tap**: tapping an event item name opens its recipe card (matched from master recipe list) so all attendees know how to make it; ChefHat icon next to each item name indicates recipe availability

### Household Members
- Member cards now tappable (non-self) — opens UserProfileModal showing their saved recipes and chef history
- Shows dietary restrictions badges from hungry_settings inline on the card
- Shows presence status (e.g. "🛒 At the Store") inline
- Member query fetches hungry_settings and friend_code in addition to display_name

### Cooking Mode (Virtual Sous Chef)
- Voice navigation: "Next", "Back", "Repeat", "Stop", "Ingredients"
- **Voice substitution**: say "I don't have [ingredient]" or "substitute for [X]" → AI fetches a real-time substitution suggestion
- Ingredient panel toggle (tap list icon or say "Ingredients") shows full ingredient list during cooking
- Mic pulses red when active; screen stay-awake via Wake Lock API

### Profile Photos
- **AppWare Global Photo** — Upload in Settings → Profile Photos → "AppWare Global" tile; syncs to all apps via `profiles.avatar_url`
- **Hungry-specific Photo** — Upload in Settings → Profile Photos → "Hungry Photo" tile; shows only in Hungry; falls back to global photo if not set
- **Avatar in Header** — Header shows the Hungry photo (or global fallback) as a 36px rounded avatar next to the greeting

### AppWare Ecosystem Features
- **#1 Kitchen Concert** — when Cooking Mode opens, writes a `cooking_started` event to `cross_app_activity` with a genre seed mapped from recipe cuisine (Italian → classical, Indian → world-music, etc.) so Jukebox can queue a matching playlist
- **#3 Smart Grocery Split** — when a priced pantry item is moved to a household, automatically creates a `Groceries` transaction in Roomies and splits it among household members
- **#4 Potluck Planner** — "✨ Smart Suggestions" button in the Household → Potluck panel fetches each member's `hungry_settings.dietary_restrictions` and generates a filtered item suggestion list (vegan/vegetarian/meat-safe); also writes `potluck_created` signal to `cross_app_activity`
- **#5 AppWare Wrap** — new "🌐 Wrap" tab in Analytics dashboard; shows monthly cross-app stats: recipes cooked, chores done (Roomies), bills paid (Roomies), top cuisine, pantry value, and currently playing track (Jukebox `now_playing` table)
- **#6 Mood-Food Matching** — on app load, reads most recent `mood_signal` event from `cross_app_activity` (written by Jukebox) and pre-selects the matching mood in Recipe Explorer
- **#7 Who's Home? Shopping Alerts** — Household tab shows an amber banner when any household member has their Roomies presence set to "🛒 At the Store" (written by Hungry's Personal Shopper mode)
- **#10 Late-Night Snack Mode** — on app load, reads most recent `late_night_active` event from Jukebox (past 2 hours) and pre-selects "late_night" mood in Recipe Explorer
- **#11 Grocery Gig Status** — Personal Shopper sets Roomies `user_presence` to `status='Away', custom_text='🛒 At the Store'` on open; resets to `Available` when closed
- **#12 Soundtrack of My Life** — when a recipe is marked as Cooked, queries the Jukebox `now_playing` table and saves the current track (`track_title`, `artist`, `album`, `artwork_url`, `platform`) into `chef_history.soundtrack`
- **#14 Nutritional BPM (write side)** — when the Analytics page loads and the user's macro breakdown is below their stated goal (e.g. protein < 20g on High Protein goal), writes a `nutrition_shortfall` event to `cross_app_activity` so Jukebox can suggest a workout playlist and Roomies can surface high-effort chores first

### Infrastructure
- Progressive Web App (PWA) — installable on home screen, offline support via service worker
- IndexedDB sync queue for offline mutations (pantry, shopping list)
- Supabase real-time backend
- Netlify serverless functions (AI recipe generation, receipt scanning)
- MealDB recipe cache (24h localStorage TTL)

---

## ⏳ Deferred — Requires External API / Library

Features that were requested but cannot be built without a third-party dependency that is not yet integrated.

| Feature | Reason deferred |
|---|---|
| **World Cuisine Map (actual world map)** | The Taste Profile "🌍 Taste" tab currently shows a bar chart of cuisines cooked. The request is for an interactive world map where countries light up based on cuisines explored. This requires a geographic mapping library (Mapbox GL JS, Leaflet + world GeoJSON, or D3 choropleth) with country-to-cuisine mapping. Non-trivial to implement without a dedicated mapping dependency, and adds significant bundle size. |
| **Period Cycle Recipe Suggestions (Flo integration)** | Requested feature: suggest recipes and ingredients based on a user's menstrual cycle phase (e.g. iron-rich foods during menstruation, anti-inflammatory during PMS). The Flo Health app does not expose a public API or SDK for third-party integrations, so there is no way to read cycle data programmatically. A manual "cycle phase" selector in the app could approximate this without Flo, if desired. |
| **Household Member List not showing** | Client now uses three-tier fallback: (1) `household_members` FK join, (2) separate `profiles` fetch by ID, (3) old `active_household_id`/`household_id` column on profiles. If members still don't appear, run migration 005 and ensure the `household_members` RLS policy (`hm: members can view`) is applied in Supabase. |
| **Events table not set up** | Migration file created at `supabase/migrations/005_potluck_events.sql`. Run it in Supabase Dashboard → SQL Editor to create `potluck_events` and the updated `potluck_items` tables with correct RLS policies. |

---

## 🚧 Blocked — Requires iOS App

These features are intentionally deferred until a native iOS app exists. The reason is noted for each.

| Feature | Reason blocked |
|---|---|
| **Sign in with Apple** | Apple mandates that any app offering third-party OAuth (e.g. Google) must also offer Sign in with Apple — but only inside a native iOS app submitted to the App Store. The web OAuth flow works but Apple will not approve an App Store listing without a native `ASAuthorizationAppleIDButton`. Requires an Apple Developer account ($99/yr), an App ID with the Sign in with Apple capability, and Supabase Apple provider configuration. |
| **Geofencing / Pantry Proximity Alerts** | The planned feature: when a household member is detected near a grocery store (via GPS), all other members receive a notification — "Omkar is at Whole Foods. Anything to add to the list before they check out?" Web Geolocation API can get a one-off position but cannot run geofence monitoring in the background when the browser/PWA is not open. Requires native `CLLocationManager` with `CLCircularRegion` monitoring, which keeps running even when the app is backgrounded. Also depends on push notifications being working (see below). |
| **Haptic feedback** | The Web Vibration API is disabled on iOS Safari. The app calls `triggerHaptic()` on tab switches and other actions but it silently no-ops on iOS. True pattern haptics (`UIImpactFeedbackGenerator`, `UINotificationFeedbackGenerator`) require native Swift/RN code. |
| **Push notifications** | iOS blocks web push in installed PWAs on older versions; even on iOS 16.4+ with web push support, APNs delivery is unreliable without a native app. Full reliability requires a native app + APNs certificate configured in the backend. Also a hard dependency for geofencing alerts and expiry reminders to actually reach the user. |
| **Voice guidance in Cooking Mode ("Hungry, next step")** | `SpeechRecognition` is partially implemented in CookingMode but is unsupported in iOS WKWebView and unreliable in iOS Safari PWA. `SpeechSynthesis` (text-to-speech) also cuts out mid-sentence on iOS when the screen locks. Continuous hands-free listening requires native `SFSpeechRecognizer` + `AVAudioEngine`, and keeping the screen awake during cooking requires a native app (the Web Screen Wake Lock API is not honoured by iOS when the screen locks). |
| **Live Activities & Dynamic Island (Cooking Mode)** | When the user enters Cooking Mode, the plan is to show the current step, a timer, and the next ingredient on the Lock Screen and in the Dynamic Island so they never have to touch their phone with messy hands. This is an iOS 16.1+ exclusive feature (`ActivityKit`) with no web equivalent. |
| **Barcode scanning via camera (reliable)** | `html5-qrcode` is partially implemented but camera access in iOS PWA home screen mode is broken on many iOS versions. A native `AVCaptureSession` / `Vision` framework scanner is far more reliable and supports a much wider range of barcode formats. |
| **Home Screen & Lock Screen Widgets** | Requires native iOS WidgetKit extension — not possible on web. Planned widgets: expiring pantry items, today's recipe suggestion, shopping list item count. |
| **Siri Shortcuts** | Requires native SiriKit integration. Planned intents: "Hey Siri, what can I cook tonight?", "Add milk to Hungry", "Start cooking [recipe name]". |
| **Face ID / Touch ID biometric sign-in** | Requires native `LocalAuthentication` framework or a reliable WebAuthn platform authenticator. Web passkeys are partially supported but inconsistent across iOS versions. |
| **App Clips** | Native iOS feature — allows instant access to a subset of the app (e.g. scanning a receipt or joining a household) without requiring a full install. No web equivalent. |
| **Background pantry sync & expiry reminders** | iOS aggressively kills PWA background processes. Reliable background sync (e.g. checking for items expiring tomorrow and firing a reminder) requires a native app with `BackgroundTasks` framework and scheduled `BGAppRefreshTask`. |
| **NFC tag scanning** | Not accessible from iOS Safari / PWA. Planned use case: NFC stickers on fridge shelves or pantry bins that auto-open the correct pantry category when tapped. Requires native `CoreNFC`. |
| **Leftover Recon (camera-based meal identification)** | Planned feature: the user snaps a photo of a Tupperware container, the AI identifies it as "Leftover Pasta", asks for the date, and tracks it as a Prepared Meal in the pantry. Requires reliable camera access (blocked in iOS PWA — see barcode scanning above) and a vision AI pipeline. |
| **"Walk-in" continuous voice inventory** | The basic tap-to-talk voice input (say "2 bananas, 3 tomatoes") works on the web app. The planned "walk-in mode" goes further: the user walks through the house putting groceries away and speaks continuously without tapping anything — "Hungry, I'm adding two gallons of milk, a pack of blueberries, and some Greek yogurt" — and the pantry populates in bulk. This needs continuous `SpeechRecognition` running in the foreground without any interaction, which is completely blocked on iOS (Safari and PWA mode do not support `SpeechRecognition` at all). Requires native `SFSpeechRecognizer` + `AVAudioEngine` with always-on microphone permission. |
| **Screen stays awake during Cooking Mode** | `navigator.wakeLock.request('screen')` is already implemented in `CookingMode.jsx` to keep the display on while following a recipe. iOS Safari does not support the Screen Wake Lock API — the call silently fails and the screen dims and locks after 30 seconds, breaking the hands-free cooking experience entirely. Keeping the screen on requires native `UIApplication.shared.isIdleTimerDisabled = true` in Swift. |
| **Drag-and-drop pantry category sorting** | Pantry items already have `draggable`, `onDragStart`, `onDragOver`, and `onDrop` handlers in `PantryManager.jsx`, with a visible `GripVertical` handle icon and the label "drag to move between categories." The HTML5 Drag and Drop API does not fire touch events on iOS — drag handles are completely non-functional on any iOS device. Requires native `UIDragInteraction` / `UIDropInteraction` or a touch-based drag library wired into a native app. |

---

### Analytics
- **Taste Profile** — meal_type and cuisine are now split correctly when stored to chef history; combined values like "breakfast Indian" are parsed into separate meal_type and cuisine fields
- Saved recipe cuisine filter now correctly uses `r.cuisine` (not `r.meal_type`) for filtering

### Infrastructure
- PWA manifest icons separated into `"purpose": "any"` and `"purpose": "maskable"` to prevent iOS home screen icon showing a black background; `background_color` updated to `#6BAEE0`

---

### Interactive Tutorial (session 9 rewrite)
- 11-step spotlight tutorial auto-navigates to each feature tab as steps advance
- Pulsing ring + center dot + "HERE" label appear at a screen position matching the feature
- Step dots at the bottom let users jump to any step; Back/Next buttons + confetti on finish
- Tutorial card slides up from bottom with smooth cubic-bezier animation

### Taste Profile Heat Map
- 8-region world heat map (South Asia, East Asia, SE Asia, Middle East, Europe, Americas, Africa, Oceania) color-coded by dishes cooked — cool gray → hot deep blue
- Each region tile shows emoji icon, name, and cook count; heat legend below
- Per-cuisine bar chart and mastery badges retained alongside the map

### Shopping List — AI Smart Swap
- ✨ Sparkles button per unchecked item (appears when user has a nutrition goal set in Settings)
- Calls AI with item name + nutrition goal to suggest a healthier/better alternative
- Result appears inline below the item with a dismiss ×

### Personal Shopper — Can't Find It?
- ✨ Sparkles button per unchecked item in Personal Shopper mode
- AI suggests: (1) another store where the item is definitely available, (2) a specific substitution at the selected store
- Result appears as a violet callout below the item row with dismiss ×

### Personal Shopper — Store Map & Efficient Route
- List/Map toggle in the Personal Shopper header
- Map view shows a 4×3 grid floor-plan (Produce/Bakery at front, Dairy/Meat at back, center aisles in between)
- Sections with items to pick up are highlighted in blue with an item count badge; completed sections show in green
- Numbered route order (1–11) on each tile for the most efficient perimeter-first shopping path
- Efficient Route list below the map shows which sections to visit in order with item counts
- Aisle Guide section shows the exact aisle name for each category at the selected store

### Recipes — Images + Dietary Substitution Tags
- RecipeExplorer cards now show the recipe photo at the top (from MealDB/Spoonacular); static recipes without images show no image area
- If the user's dietary restrictions would require substitutions on a recipe, the card shows a green ✅ badge (e.g. "Vegan substitution made") instead of the photo
- RecipeModal hides the recipe image and shows a green substitution tag when the recipe has been adapted (auto or manual) for a dietary restriction
- Recipe explorer now shows up to 100 recipes (increased from 48)

---

## 🔗 Deferred — External Dependency Required

| Feature | Dependency | Notes |
|---|---|---|
| **Kroger / Harris Teeter product availability check** | Kroger Developer API key (free — sign up at `developer.kroger.com`) | Once Client ID + Secret provided, can check stock + price per item at the user's nearest store. Harris Teeter is a Kroger banner and uses the same API. |
| **Kroger store locator** | Same Kroger API key | Find the nearest Kroger-banner store by zip code. |
| **Per-aisle item location for any store** | No public API exists for any chain | All grocery chains (Walmart, Whole Foods, Trader Joe's, Costco, etc.) keep in-store map data proprietary. The current aisle guide (hardcoded per store) is the best possible without a private data agreement. |
| **Target in-store navigation** | Target API not available to third parties | Target's Redsky API is internal only. No developer program exists. |

*Last updated: 2026-05-30 (session 9)*
