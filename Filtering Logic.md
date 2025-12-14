This is a reference for how to handle filtering apps in the main page.

THIS IS NOT MEANT TO REPRESENT THE EXACT FILTERING OR QUERY FORMULAS TO USE JUST AS A REFERENCE TO THE UNDERLYING LOGIC.

The format of the logic below is Airtable formula syntax, but with Brackets indicating a current cached record.
I.E. [User] is a cached copy of the currently selected User's record from the Users table.
[User{Name}] would represent the value of the {Name} field from that cached record.

DATABASE QUERIES:
When the app is querying the Airtable base for a list of Apps, use this filtering Logic:


IF(OR({Ownership} = "Global", {Ownership} = "Public"), 
    TRUE(),
    IF({Owner} = [User{RecordID}],
        TRUE(),
        FALSE()
))

MAIN APP GRID FILTER:
SWITCH({Ownership},
    "Global",
        IF(FIND({RecordID}, [User{Hide Global}]),
            FALSE(),
            TRUE()
        ),
    "Public",
        IF(FIND([User{RecordID}], {Owner}),
            TRUE(),
            IF(FIND({RecordID}, [User{Public Apps}]),
                TRUE(),
                FALSE()
            )
        ),
    "Private",
        TRUE(),
    FALSE()
)