Great. This appears to be working for now.
Moving on now to updating apps.
When an shortcut is created, right now it is local only.
We need to get rid of local apps completely. All apps should be synce to and pulled from the Airtable base, though they should still be locally cached.

If you'll recall, we have three Ownership states that each app can be in.
Global, Public, and Private.

Global: These apps are visible to everyone, though users can choose to explicitly hide them by adding their user record to the "Hide Global" field of the App record.
Global applies only to apps created from Airtable. Users cannot set the apps created in the Launcher to Global.

Public: These apps are visible to anyone who turns on the "Show Public Apps" toggle (user setting). These can be created from the Launcher, but have to be manually set as public in the Edit Pane in order to have that setting.

Private: This is the default state of apps created in the Launcher. They can be seen only by the user that created them.