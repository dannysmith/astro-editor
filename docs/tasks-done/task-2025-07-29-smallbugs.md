# Task: Small Bugs

- The Command Palette behaves jankily when using the up and down arrows. If you move too quickly, it kind of resets itself somehow.It's fine when using the mouse.
- If I delete The JSON files in which we're storing preferences (see `docs/developer/preferences-system.md`) it still remembers the last project I had open when I load the app. I assume this is because some data is also being stored in local storage. It feels like we probably shouldn't be doing this now we are using files to persist this kind of data? Like I feel like that might lead to conflicts and problems, so let's just think about the most sensible way of handling this? Maybe local storage does make sense. I don't know?
