meeting notes from  walk

- making sure app blocking doesn't fully block important notifications
  - apple dnd block all notifications except for [specific contacts]; do the same but with specific apps instead

- bad business model; losing money or giving money away for free
  - make sure there's not that many people abusing the funds model
  - general edge cases or unit cases that must be addressed:
    - open the phone, set up a session, and leave it to gain passive income
      - if its truly a 10% return, that's just giving money away
      - it's not that hard to not use your phone; it's more about making sure there's meaningful minutes away from phone (afp)
      - niyah should be able to capture that goal & reward users for doing that
    - why can't i just set it up with $500, set it up on my phone for two hours, and get the $50 back, then immediately withdraw?
    - losing money very easily, and it's extremely abusable
    - need to find different business models that are sustainable, eliminating avenues for abuse (i would say minimizing but it's probably better to instead not even allow that avenue to be possible)
  - some ideas i had for guarenteeing the business model so its not just passively losing money, but also still being enough risk and novel to keep users engaged and maintain retention
  - a: keep the current solo staked mode, but gate it behind aa) monthly subscription ($20/month + other cosmetics) ab) referral program (invite friends to join and get rewarded) ac) changing from real money to creating digital points that can later be redeemed for real money (100 blobs --> $1.00) or something like that; users can redeem for real/cash or paying for specific services like a gift card, ad) require at least 10 group challenges with unique, new people before allowing the solo staked mode to be used; thereby guaranteeing that the solo staked mode is profitable since each group mode takes a rake of potentially 3% or 5%. This would mean guarenteed profit (via rake or transaction fees)
    - u = num of users per challenge = 2-5 varying users
    - u_stakes = $ amount each user contributes
    - RAKE% (constant) (3% or 5%?)
    - m = min number of group challenges (10? 15?)
    - p? = probability of success (not sure if i need this)
    - P = profit
    - P = RAKE% * p? * ( m * u[1 - 5] * u_stakes[$10 - $500] )
    - GROUP (+) -> PROFIT = RAKE% * PROBABILITY_OF_SUCCESS * (MIN_GROUP_CHALLENGES)
      - P = R * P? (M * U * U_STAKES)
    - SOLO  (-) -> LOSS   = PROBABILITY_OF_SUCCESS * (MIN_GROUP_CHALLENGES * USER (1) * USER_STAKES ($10 - $500))
      - P = P? (U(1) * U_STAKES)

    - ex 1: general staked model (min profit given prerequisites to start any staked session)
      - RAKE% = 5%, m = 10, (not sure if i need this -> p? = 0.8), u = 2, u_stakes = $10
      - P = 0.05 * ( 10 * 2 * 10 ) = $4 profit before opening solo staked or something? 
    - ex 2: after fininshing gated group sessions, allow for solo staked modes that let users EARN 
      - RAKE% = 5%, m = 10, (not sure if i need this -> p? = 0.8), u = 2, u_stakes = $10
      - P = 0.00 * ( 10 * 2 * 10 ) = $4 profit? 

  - i'm still unsure how the math for this is going to work, but lmk if the model above or examples above make sense and/or are accurate
  - the larger idea i'm getting from this is that to keep things simple, we just do a simple math model to calculate profit based on the number of users, stakes, and other factors, and then display that profit to the user before they start a staked session
    - need to guarentee some minimum profit to keep from bleeding money
  - possible wanting to remove the 3 buttons -> switch to single action button that is fluid and folds solo staked into group mode if a user tries to start a group session without any other friends -> automatically a solo staked
  - so two modes
    - zen mode -> really good app blocker, completely free, better than flagship apps like Opal, BRICK (physical ones), etc.
    - staked mode -> paid mode that lets users earn money by staking on group sessions, and unlocks solo staked mode if a user tries to start a group session without any other friends and has completed at least 10 grouped sessions?




- group sessions mode + setup to start a session via the 3 buttons are not the "sticky" workflow for users; there's too much button fatigue that needs to be reduced via bottom right action button that folds into either one of those 3 modes?


- in addition, having a strong, very strong anticheat is crucial; people could probably very easily just set on their phone and forget; which is the point and our app rewards that, but it may not be sustainable? 
- the anticheat idea i had in mind was simply having a strong kyc that verifies the user's identity and prevents fraud or cheating by having a "universal user"
  - this entails having Stripe properly setup to require SSN and stuff like that (very high friction, kinda want to avoid this but may have to happen if larger vision is with debit cards + hysa)
  - what if i just this up with current phone, buy new phone, and let that older phone passively earn money via schedules? 
  - waht if i just buy an old cheap phone, set this up, and then let it sit idle?
  - how do we minimize or prevent the common idea of "just get another phone" or something to game the system?



===
Some additional notes 
- upon evey new app opening, I always get the Terms & Prvacy screen, the "youre' all set" screen, and the stay in the loop screen, even if i've done it during onboarding before, it's stil coming again and again; can you please resolve this so it really only is visible once during onboarding and when a user wants to change those settings, it'd just be in the profile settings
- Could we also fix that Get started screen on the onboarding sign in / get started
- Still no notification from a screen; I see the back to it and the Open Niyah button:
  - Clicking Back to it -> just goes to back to homescreen
  - Clicking Open Niyah -> also just goes to homescreen, when it should instead trigger a push notification saying "click here to stop (session|earning, depending on staked or not)" -> after clicking the push notification, it should take the user to the ongoing timer / schedule that is currently running
    - IN addition, the process for setting up a schedule -> starting a sesssion and stopping it via a easy, quick green toggle switch, rather than something that has some friction, involving a set stake amount + estimated profit or something; and tying it well with the home screen
  - In addition, with all of these, the profile tab seems to be very outdated. instead of having the blob maker always there on the profile tab, hide it all under a bottom screen popup or something that is only shown when the user clicks a pencil / edit icon on the profile blob; once that opens, the custom blob maker should instead look like this:
    - [insert figma mockup]


- also make sure to do a deep dive on ALL visible screen to make sure things are within the content view and not position WAY to high up or WAY to low; keep it consistent everywhere alongside some general padding so that even modals and stuff that pop up from the bottom and don't follow the same positioning via a regular popup you'd see for a regular header text in a screen; ie they're positioned consistently with the content view and not way off to the top/side or way off the bottom
