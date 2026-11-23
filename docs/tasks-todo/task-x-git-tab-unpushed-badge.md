# Task: Show unpushed commits outside the Git tab

The Git tab shows how many commits are waiting to be pushed, but only while it's open, and git runs only while it's showing. A writer who commits and switches back to the Frontmatter tab can forget to push. A count badge on the Git tab's icon while there are unpushed commits is the smallest step.

Whether this is needed is one of the questions from using the Git panel (`task-1-git-panel-experiment.md`): is the tab enough for "don't forget to push"?

## Things to work out

- **Keeping it current without the tab open:** the tab's git reads and watcher stop while it's hidden (`<Activity>`), on purpose. A badge needs the ahead count anyway: a cheap `rev-list --count @{upstream}..HEAD` on project open, after AE's own commits and pushes, and on window focus, rather than the whole tab's state.
- **Only when the experimental switch is on,** like everything else git.
- **What it counts:** commits to push only, not changes to commit, which would make it permanently lit for most writers.
