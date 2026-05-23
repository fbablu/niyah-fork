# Manual QA of Niyah

Includes what it SHOULD do vs what it ACTUALLY does, and general quirks and bugs from opening and closing the app.


## Onboarding 



### Design parts (mostly art, will take some time in Figma )


#### Screen 1 - Welcome to Niyah
- [ ] initial screen is good, but Characters could be more interactive;
  - [ ] Currently they just slightly bounce, blink, and vibrate. Instead, after clicking for a few times, maybe they each do something interative?
  - [ ] Maybe limit groups to the amount of characters that we have, so for groups, do up to 6 blobs and user gets to pick which blob they want first OR we can do at the very end, with inspiration from https://www.blobmaker.app/, have it generate a blob for them; then user selects which color they want + premium versions get different patterns or textures or they can unlock them as they improve and grow? 
  - [ ] Secondary screen is good, just the SVG portion is not interactive yet, and swiping from Screen 1 to Screen 2 is choppy and not as smooth as expected. Also, svg components need to align better such that they snap into place when swiped to the next screen AND fit properly within the phone screen content view area. 
  - [ ] 


### Competitors and how they do it: 
#### Useful things

## [OPAL](https://www.figma.com/design/GXxiG7IYSw0o6WGc9UHwzn/Niyah?node-id=267-534&t=TPRUU1PqFHpN9jNY-1)
- insights from founder [here](https://fortune.com/2025/11/19/opal-founder-ceo-kenneth-schlenker-warning-labels-for-social-media-addiction-doomscrolling/)

PRIVACY
- for privacy informaton, instead of the smaller text and Terms of Service + Privacy Policy, they have a 'Learn More' and then a small modal popup with things they DONT see 
  - UI is much better than what I had, which was just small text that nobody wants to read 
  - NOTE: They don't see the detailed Screen Time, and includes a [Read More](https://opalapp.com/help/what-do-you-do-with-my-data)
- Same sign in with Apple or Email
  - I want to keep only Sign in with Apple or Google or Phone number
- Sign in with Phone number entry field is higher up, so keyboard does not cover it
- Validate with phone number screen can't exit except for back arrow. My main issue is needing to move the entry field up so it can't be covered by the keyboard
- Verification code says: XXXX is your verification code for Opal --> need to do the same
