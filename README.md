# Daylist

Daylist is a phone-first task list and weekly planner. It needs no account, backend, or build step.

## Run locally

Run `python3 -m http.server 8000 --directory public` from this repository and open <http://localhost:8000/>.

## Deploy and install

Push the repository to GitHub. Under **Settings → Pages → Build and deployment**, choose **GitHub Actions**. The workflow publishes `public/` on pushes to the default branch. You can also run it manually from the Actions tab on the default branch.

Visit the HTTPS Pages URL on your phone while online. Use your browser's **Install** or **Add to Home Screen** option. After the first successful online visit, the app shell is cached and tasks remain available offline.

## Plan and export

- Add tasks under **All tasks**. Higher importance values sort first. Tap **Date** to assign a day or return a task to **Unassigned**. Turning off Date also clears Time. Tap **Time** to schedule a specific time.
- In **Weekly plan**, tap the plus beside a day to assign an existing task or create a new one. An unfinished task with an expired date returns to **Unassigned** the next time the app checks the date.
- Set a repeat interval when creating a task. **Recurring** lets you edit, pause, or resume future occurrences. Occurrences for upcoming days are previewed in the week. Daylist adds due occurrences when you open or use the app. Occurrences missed while the app was closed show up under **Unassigned**. Pausing preserves tasks already saved.
- Completing a task records its completion time in **Trash**. You can restore or permanently delete tasks from there. Open an active task to delete it.
- **Export & share** downloads a CSV or opens your device's native share menu where supported. It also generates a copyable Gemini prompt for scheduled, unfinished tasks in the selected week, or the current week when outside the planner.
- Data stays in this browser's local storage. Export a CSV if you want a portable record before clearing browser data.

The deployment workflow versions the offline shell automatically. When an update is ready, tap **Update available · Reload** to use it. When testing offline updates locally, increment the cache version in `public/sw.js`.
