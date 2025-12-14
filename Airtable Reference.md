Atlas Base: Complete Schema and API Documentation for Apps and Users Tables
Base Information
Base ID: appL7Lq4VPcHgAewL
Base Name: Atlas
API Base URL: https://api.airtable.com/v0/appL7Lq4VPcHgAewL
Apps Table Schema
Table ID: tblr8L369WEh7mGYh
Table Name: Apps
Record Count: 8 records
Permissions: Create, Update, Delete enabled

Field Definitions
Field Name	Field ID	Data Type	Properties	Description
Name	fldN41qoRuE3Jbe6D	Single line text	Primary field	Application name identifier
Type	fldQ4oETBTtcC5qVe	Single select	Choices: web (selNX7ivtZ5EOV1Cw), win app (selbHeBqGFoXupRwS), mac app (selicwcchercMg0rA), chrome (selZ9HCVtmMpZt7k8)	Application platform type
Target	fld0YbsNSWDiMaO0h	Single line text	-	URL or executable path for the application
Enabled	fld1Bv8ukgCQLvNJb	Checkbox	-	Boolean flag indicating if app is active
Icon	fldfF4CSMX5GwlYnL	Attachment	-	Application icon image file
Groups	fldWwH8kmon5mgecK	Linked records	Links to Groups table (tblfNFAo9vJgud6Ca)	Associated app groups
Class	fld2FCJiBvy9lyhlx	Single select	Choices: Parent (selHhaFwHrD9A1vJB), Child (selyNpl8R3amij3TH)	Hierarchical classification
Parent	fldaEnNJPAD99piXc	Linked records	Self-reference to Apps table (tblr8L369WEh7mGYh)	Parent application reference
Children	fldi4KScXLiMCPko9	Linked records	Self-reference to Apps table (tblr8L369WEh7mGYh)	Child applications
Ownership	fldO6ZWEuutLhTxQU	Single select	Choices: Global (selZiQSSE5YAvQGXT), Public (selKiYgxvMTN7ULqO), Private (selYEJUoktPMFM87d)	Access scope level
Owner	fldhgCgBVIoWNCjZB	Linked records	Links to Users table (tblbpYp0Cza2JMKKR)	Application owner
HideFrom	fldz5X4t6KOKGmVix	Linked records	Links to Users table (tblbpYp0Cza2JMKKR)	Users who should not see this app
IconB64	fld9NOg5wFtWv4xtS	Long text	-	Base64 encoded icon data
PublicUsers	fldRIG0ppfaOYHhBg	Linked records	Links to Users table (tblbpYp0Cza2JMKKR)	Users with public access to this app
Users Table Schema
Table ID: tblbpYp0Cza2JMKKR
Table Name: Users
Record Count: 3 records
Permissions: Create, Update, Delete enabled

Field Definitions
Field Name	Field ID	Data Type	Properties	Description
Name	fldYrEz8jPNV5lC1R	Single line text	Primary field	User display name
OwnedApps	fldhtZe2GasjiArA4	Linked records	Links to Apps table (tblr8L369WEh7mGYh)	Applications owned by this user
UserSettings	fldL7pNypmH9BXKwD	Long text	-	JSON or text-based user configuration data
HideGlobal	fldpQemJatLdNvIlq	Linked records	Links to Apps table (tblr8L369WEh7mGYh)	Global apps this user wants hidden
PublicApps	fld1u5lcDos8Kk58u	Linked records	Links to Apps table (tblr8L369WEh7mGYh)	Public apps this user wants to access
API Authentication
All API requests require authentication using a Personal Access Token:

Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN Content-Type: application/json

Required Scopes: data.records:read and data.records:write

API Update Operations
Single Record Update
Update Apps Record
http PATCH https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblr8L369WEh7mGYh/{recordId} Authorization: Bearer YOUR_TOKEN Content-Type: application/json

{ "fields": { "Name": "Updated Application Name", "Type": "selNX7ivtZ5EOV1Cw", "Target": "https://example.com/app", "Enabled": true, "Class": "selHhaFwHrD9A1vJB", "Ownership": "selZiQSSE5YAvQGXT", "Groups": ["recGroupId1", "recGroupId2"], "Owner": ["recUserId1"], "HideFrom": ["recUserId2"], "IconB64": "base64_encoded_icon_data", "PublicUsers": ["recUserId3", "recUserId4"] } }

Update Users Record
http PATCH https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblbpYp0Cza2JMKKR/{recordId} Authorization: Bearer YOUR_TOKEN Content-Type: application/json

{ "fields": { "Name": "Updated User Name", "UserSettings": "{"theme": "dark", "language": "en"}", "OwnedApps": ["recAppId1", "recAppId2"], "HideGlobal": ["recAppId3"], "PublicApps": ["recAppId4", "recAppId5"] } }

Bulk Record Updates (Maximum 10 records per request)
Update Multiple Apps
http PATCH https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblr8L369WEh7mGYh Authorization: Bearer YOUR_TOKEN Content-Type: application/json

{ "records": [ { "id": "recAppId1", "fields": { "Enabled": false, "Type": "selZ9HCVtmMpZt7k8" } }, { "id": "recAppId2", "fields": { "Name": "Renamed Application", "Target": "https://newurl.com" } } ] }

Update Multiple Users
http PATCH https://api.airtable.com/v0/appL7Lq4VPcHgAewL/tblbpYp0Cza2JMKKR Authorization: Bearer YOUR_TOKEN Content-Type: application/json

{ "records": [ { "id": "recUserId1", "fields": { "UserSettings": "{"notifications": true}", "HideGlobal": ["recAppId1"] } }, { "id": "recUserId2", "fields": { "Name": "Updated Username" } } ] }

Field Value Specifications
Single Select Field Values
Always use the choice ID, not the display name:

Apps.Type:

"selNX7ivtZ5EOV1Cw" = web
"selbHeBqGFoXupRwS" = win app
"selicwcchercMg0rA" = mac app
"selZ9HCVtmMpZt7k8" = chrome
Apps.Class:

"selHhaFwHrD9A1vJB" = Parent
"selyNpl8R3amij3TH" = Child
Apps.Ownership:

"selZiQSSE5YAvQGXT" = Global
"selKiYgxvMTN7ULqO" = Public
"selYEJUoktPMFM87d" = Private
Linked Record Fields
Provide as arrays of record IDs: ["recId1", "recId2"]
Empty arrays [] will clear the field
Omitting the field leaves it unchanged
Checkbox Fields
Use boolean values: true or false
Attachment Fields
To preserve existing attachments, include their IDs
To add new attachments, provide URL and optional filename
To clear attachments, provide empty array []
Important API Considerations
Rate Limits: 5 requests per second per base
Record ID Format: Always starts with "rec" followed by 14 alphanumeric characters
Field Updates: Only include fields you want to modify; omitted fields remain unchanged
Validation: Invalid choice IDs or malformed record IDs will return 422 errors
Linked Records: Target records must exist in the linked table
Self-References: Apps.Parent and Apps.Children reference other records in the same Apps table
System Architecture Context
This base manages a hierarchical application system where:

Apps can have parent-child relationships
Users have granular control over app visibility
Ownership levels control default access (Global/Public/Private)
Groups provide additional organization layers
Settings are stored as JSON in long text fields
The schema supports complex access control patterns where global apps can be hidden per-user, public apps require explicit user assignment, and private apps are owner-controlled.