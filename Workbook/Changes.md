DON'T FORGET ABOUT CLAUDE.MD

BUGS TO FIX. 
-------------

I emptied .gitignore, I wanted all files and dependencies to follow me from machine to machine.

Netlify build error: The build stops at sh: 1: vite: Permission denied while running npm run build, which means the Vite CLI was not present/executable in the Netlify build environment.
Your Netlify configuration includes the environment variable NPM_FLAGS (lines #L69-L74). If NPM_FLAGS is set to omit dev dependencies (e.g. --omit=dev or --production), the Vite CLI—listed only under devDependencies—won’t be installed. When the build script later tries to run vite build, the binary is missing, yielding the permission-denied error from the shell.

Nutrition information for all pantry items isn’t showing up. Run an Internet search for the items you can’t find nutritional info from. If scanned by barcode or receipt, also store what store the item was bought from.

The date and time blocks in the party section should say “choose date” and “choose time” if the user hasn’t made a selection yet.

When I try to create an event, nothing happens after I hit the create button

The recipes in the explore section are not being converted according to the user’s dietary restrictions

Personal shopper store select should be blank when the feature is first opened up

In the shopping list, when I tap the share to household button, the dropdown doesn’t go away when I tap outside of the dropdown

The app logo is still all messed up, fix it, take out the black background

The section titled "recipes" is now completely blank.

You also did not add this change:  Create a section on nav where users can set up their profile. Show each feature on the profile that could potentially be on their public profile, and they can choose whether they want each feature and each recipe and each photo and each comment to be public or private.

In settings, take out the household settings, and take out the thing that says profile on top. Move the create household settings to the household page. only add a create household and join household button on the household screen, the invite code and monthly budget settings are already on the household section.

Every single item in the pantry should have nutrtional info, look up the items to get proper information. 

FEATURES TO ADD:
-------------------

Take out the event feature from the household section, the event section takes care of that. Add the smart suggestions button to the party section. The smart suggestions should read what kind of event it is, and provide food suggestions based on the event as well as the invitees and hosts dietary restrictions. There can still be meat dishes if only one person is vegetarian, and that applies to all dietary restrictions. User will have the option to add the suggestion to the event item list and assign it someone. Upon tapping on an item from the event, it should pull up a recipe card for that item so all users know how to make their dishes.


Make a section where the user can add restaurant food if they really liked something. Ask them where they got it, location, and the name of the dish, and ingredients it’s something generic  like Chipotle. Then add that recipe under a separate tab in the saved recipes called “Restaurants”. The original section where the user has the option to add a restaurant dish should also have the restaurants around, categorized by cuisine, and different categories like quick eats, cheap eats, date night, etc.