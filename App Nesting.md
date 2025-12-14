This file is meant to serve as a reference for how App Nesting are supposed to function within the Atlas Launcher.

The Apps table contains a list of Apps as Records.
There is a field called "Parent" and a field called "Children". These are both Linked Record Fields that link to the Apps table. Airtable has a recent update that allows records that link to themselves to have an automatic "From" field that links the other side of the relationship automatically. The "Parent" and "Children" fields use this mechanic for crosslinking. This means that if you add Record A to the Parent field of Record B, Record A will automatically have Record B in its Children field.

In the Atlas Launcher, If an App does not have any children, then it should launch the normal way.
When an App is clicked on, if it has Children, we want to expand the app to show all the Apps in its Children field. Lets call this the expanded mode. 

When an App enters expanded mode, the app should move to the 1st position in whichever section it is currently in and hide all other apps (except for its children).
Then in a vertical list underneath that app, all of its child apps should display.
Child Apps should be shown in a different way than parent apps, with their icons set to half the Icon Size Setting, and their names shown to the right of the Icon instead of below it. When a Child App is clicked on, it should launch the Target URL of that Child App.

Child Apps should inherit their Parent Apps Properties, like Ownership, Owner, HideFrom, and PublicUsers.
However you should still be able to edit or delete these child apps (if you are their owner), but you'll only be able to edit the Icon, Name, and Target URL.

