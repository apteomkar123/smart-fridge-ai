# Hungry — Feature Status

A living document tracking what's shipped, what works, and what's blocked until the iOS app is ready.

---

## ✅ Ready & Available (Web App)

### Auth
- Email / password sign in and sign up
- Forgot password (email reset link)
- Sign in with Google (OAuth via Supabase — requires Google provider enabled in Supabase dashboard)
- Onboarding flow — 5-screen liquid-glass intro + preferences sheet (name, dietary restrictions, nutrition goal), written to Supabase on completion

### Pantry
- Add items manually
- Scan a grocery receipt via photo upload (AI parsing)
- Barcode lookup (Open Food Facts API)
- Edit item details inline
- Remove items
- Expiry date tracking
- Assign items to a personal or household pantry
- Quantity controls per item

### Recipes
- Recipe explorer powered by MealDB + Spoonacular + static recipes, sorted by pantry match %
- Search by name, ingredient, or filter keyword
- Filter by meal type, diet, and cuisine
- AI recipe generator — pick pantry items, generates a custom recipe
- Recipe detail modal with full ingredient list and steps
- Pantry match indicator per ingredient (green/amber dot)
- Add individual missing ingredients to shopping list
- Add ALL missing ingredients to shopping list in one tap
- Save recipe to My Saved Recipes
- Share recipe to a specific household
- Deep link sharing (unique URL per recipe)
- Convert recipe: Make Vegetarian / Make Vegan / Add Meat (local + AI)
- Proteinize — AI suggests a protein addition
- Ingredient substitution (AI-powered swap)
- Multiplier (1×, 2×, 4× servings)
- Estimated nutrition per serving
- Cooking Mode — full-screen step-by-step view
- Mark as Cooked (updates pantry)

### Shopping List
- Add items manually
- Items auto-grouped by aisle (Produce, Dairy, Meat, Bakery, etc.)
- Check off items
- Delete items
- Rename items inline (double-tap or pencil icon)
- Move items between personal list and household lists
- Personal Shopper mode — distraction-free shopping view

### Chef History
- Automatically logged when a recipe is marked as Cooked
- Add personal notes per entry
- Add photos per entry
- Delete individual photos
- Toggle public / private visibility
- Re-open the original recipe from history

### Analytics
- Nutrition overview — protein / carbs / fat breakdown with distribution bars
- AI Nutrition Coach — pick a macro goal, get ingredient and recipe suggestions
- Eco Score — tracks expiring/expired items and waste risk
- Spending tracker — pantry value, shopping list spend, budget vs. actual
- Set personal budget limit
- Set household budget limit
- Smart Meal Prep — AI generates a weekly batch-cooking plan grouped by shared ingredients
- Save / restore meal plans (persisted to localStorage + Supabase backup)

### Household
- Create a household with a generated invite code
- Join a household via invite code
- Switch between multiple households
- Set a household budget limit
- View household members (with Add Friend button for non-friends)
- Shared shopping list (household-scoped, real-time via Supabase)
- Shared saved recipes (household-scoped)

### Friends
- Friend codes (8-character code based on user ID)
- Add friends by code
- Search for friends by display name
- Send friend requests
- Accept / decline incoming friend requests
- View friends' public chef history feed
- Household members show an Add Friend button if not already connected

### Settings
- Update display name
- Set dietary restrictions
- Set nutrition goal
- Set age, weight, height
- Set personal budget limit
- Create / join / manage households
- Sign out

### Infrastructure
- Progressive Web App (PWA) — installable on home screen, offline support via service worker
- IndexedDB sync queue for offline mutations (pantry, shopping list)
- Supabase real-time backend
- Netlify serverless functions (AI recipe generation, receipt scanning)
- MealDB recipe cache (24h localStorage TTL)

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

*Last updated: 2026-05-29*
