# Yard Layout Planner Repository Guide

Follow these steps to publish the planner on GitHub:

## 1. Prepare the repository locally
1. Ensure you are in the project directory:
   ```bash
   cd /path/to/your/project
   ```
2. Initialize Git if you have not already:
   ```bash
   git init
   ```
3. Configure your author details (only required once per machine):
   ```bash
   git config user.name "Your Name"
   git config user.email "you@example.com"
   ```

## 2. Review the project state
1. Check which files will be tracked:
   ```bash
   git status
   ```
2. Optionally, add a `.gitignore` file to exclude generated assets.

## 3. Commit your work
1. Stage the project files:
   ```bash
   git add index.html style.css script.js README.md
   ```
2. Create an initial commit:
   ```bash
   git commit -m "Initial commit"
   ```

## 4. Create a GitHub repository
1. Visit [https://github.com/new](https://github.com/new) and create a repository (without initializing with a README if you already have one locally).
2. Copy the repository's `git remote add` command from the Quick Setup instructions.

## 5. Connect and push
1. Add the remote (replace the URL with your repository's URL):
   ```bash
   git remote add origin git@github.com:username/repo.git
   ```
   or, if using HTTPS:
   ```bash
   git remote add origin https://github.com/username/repo.git
   ```
2. Push the local commit to GitHub:
   ```bash
   git push -u origin main
   ```
   If GitHub suggests `master` or another default branch name, use that instead of `main`.

## 6. Verify on GitHub
1. Refresh the new GitHub repository page to confirm the files are present.
2. Update the repository description or settings as needed.

## 7. Continue developing
- Repeat the `git add`, `git commit`, and `git push` cycle for subsequent changes.
- Create feature branches when collaborating to keep work organized.

## Troubleshooting tips
- If authentication fails, ensure your SSH keys or HTTPS credentials are configured.
- Run `git status` frequently to understand the repository state.
- Use `git log --oneline` to review commit history.
- If a push is rejected, fetch the latest remote changes (`git pull --rebase origin main`) and resolve conflicts before retrying.
