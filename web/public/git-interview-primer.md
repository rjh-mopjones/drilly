---
type: interview-prep
---

# Git Interview Primer — 332 Questions

Comprehensive Q+A primer for software-engineer / DevOps Git interviews. Eighth entry in the DevOps track — sister note to the Linux, Kubernetes, Observability, Terraform, Docker, CI/CD, and Networking primers. Everything from the object model up: the three trees, commits & branches, merging & rebasing, remotes, undoing changes, the reflog, interactive rebase, cherry-pick & bisect, conflicts, branching strategies, pull requests, tags, internals, submodules & big repos, history rewriting & recovery, config & hooks, Git in CI, and the definitive "I did X — how do I fix it" recovery playbook.

Each answer is interview-shaped: opinionated, concrete, real `git` commands, small commit-graph sketches, failure modes, and the data-loss / shared-history dangers called out. Modern Git; engineer/DevOps framing.

1. [[#Git Fundamentals & the Object Model]]
2. [[#The Three Trees & Basic Workflow]]
3. [[#Commits & History]]
4. [[#Branches & Refs]]
5. [[#Merging]]
6. [[#Rebasing]]
7. [[#Remotes & Collaboration]]
8. [[#Undoing Changes]]
9. [[#Stashing & the Reflog]]
10. [[#Interactive Rebase & History Rewriting]]
11. [[#Cherry-pick, Bisect & Advanced Tools]]
12. [[#Merge Conflicts in Depth]]
13. [[#Branching Strategies & Workflows]]
14. [[#Pull Requests & Code Review]]
15. [[#Tags & Releases]]
16. [[#Git Internals Deep Dive]]
17. [[#Submodules, Subtrees & Large Repos]]
18. [[#Rewriting History & Recovery]]
19. [[#Configuration, Hooks & Attributes]]
20. [[#Git in CI/CD & at Scale]]
21. [[#Scenario & Troubleshooting Playbooks]]

---

## Git Fundamentals & the Object Model

### Summary

**What this topic covers**

The foundation everything else in Git stands on: what Git actually *is* and how it stores your project under the hood. Three concern areas live here: (1) the **distribution model** — why Git is a *distributed* version control system, how that differs from centralized systems like SVN and CVS, and why it won; (2) the **storage model** — Git stores **snapshots, not diffs**, everything is **content-addressed** by the hash of its content, and the whole repo is a graph of four object types; and (3) the **object model + `.git` internals** — blobs, trees, commits, and tags, how a commit reaches every file through its tree, how commit hashes are computed, and why history is effectively immutable. The 16 questions in this topic are the mental model that makes branching, merging, rebasing, and recovery *make sense* rather than being magic incantations. Get this right and the rest of Git stops being a pile of memorized commands.

**Mental model**

Think of Git as a **content-addressable key-value store** with a version-control UI bolted on top. At the bottom is an object database: you hand it content, it hashes that content (SHA-1, migrating to SHA-256), and stores the object under that hash. Identical content always produces the same hash, so Git deduplicates automatically and the hash doubles as an integrity check. On top of that store sit four object types that reference each other by hash: a **blob** is a file's bytes, a **tree** is a directory (a list of names → blob/tree hashes), and a **commit** points at one tree (the whole project state) plus its parent commit(s). Because each commit names its parents, commits form a **directed acyclic graph (DAG)** — history is a graph, not a line. And because an object's hash is derived from its content *including* the hashes it references, changing anything deep in history changes every hash above it. That's why history is tamper-evident and why "rewriting history" really means "writing new objects."

**Key terms**

- **Distributed VCS** — every clone is a full repository with the complete history, not a thin checkout of a central server.
- **Snapshot** — a commit records the *complete state* of the tree, not a delta from the previous commit.
- **Content-addressable** — objects are stored and retrieved by the hash of their content; same content = same key.
- **SHA-1 / SHA-256** — the hash functions Git uses as object IDs; new repos can opt into SHA-256.
- **Blob** — an object holding a file's raw contents (no name, no metadata).
- **Tree** — an object representing a directory: entries of (mode, name, hash) pointing at blobs and subtrees.
- **Commit** — an object pointing at one tree + parent commit(s) + author/committer + message + timestamps.
- **Tag object** — an annotated tag: a named, optionally signed pointer to another object with its own message.
- **Ref** — a file under `.git/refs` (or in `packed-refs`) containing a commit SHA; branches and tags are refs.
- **HEAD** — a pointer to the current branch (or directly to a commit = detached HEAD).
- **Porcelain vs plumbing** — high-level user commands (`git commit`, `git log`) vs low-level internals (`git hash-object`, `git cat-file`).
- **DAG** — directed acyclic graph; the shape of commit history via parent pointers.

**Why interviewers ask this**

This is the single best discriminator between someone who *uses* Git and someone who *understands* it. Junior candidates describe Git as "commits are diffs" or "GitHub is Git" and get stuck the moment something goes sideways. Senior candidates can explain that a commit is a snapshot referencing a tree, that a branch is just a 41-byte file, and that a "lost" commit still exists in the object database until garbage collection — which is *why* the reflog can recover it. Interviewers probe the object model because it predicts how you'll behave in a crisis: reset, rebase, cherry-pick, and recovery all become obvious once you see the DAG of immutable objects, and terrifying if you don't. If you can draw the blob/tree/commit relationship on a whiteboard, most Git interview questions answer themselves.

**Common confusions**

- "Git stores diffs between commits" — no. Each commit is a full snapshot; Git *deduplicates* unchanged files by hash and only packs diffs later for disk efficiency (packfiles), which is an optimization, not the model.
- "A commit stores the files that changed" — a commit's tree references *every* file in the project at that moment, changed or not.
- "GitHub / GitLab is Git" — those are hosting platforms; Git is the underlying distributed tool and works fully offline with no server.
- "The SHA is random / assigned by the server" — it's a deterministic hash of the object's content, computed locally.
- "Rewriting history edits commits in place" — commits are immutable; rewriting creates *new* objects with new hashes and moves refs to them.
- "Git and SVN are basically the same with different commands" — SVN has one central history and per-file diffs; Git gives every clone the whole DAG.

**What follows from this topic**

Everything. The object model here directly sets up **The Three Trees & Basic Workflow** (the index is a listing of blobs; `add` writes blobs and updates trees) and **Commits & History** (a commit is one of these objects; the DAG is why `HEAD~3` and ranges work). Branching and merging are just moving refs and creating commits with extra parents. Reset, rebase, and reflog recovery all reduce to "move a pointer" or "write new objects and re-point a ref." If any later topic feels like magic, the confusion almost always traces back to the object model — come back here.

### Q1. What is Git, and how is it different from a centralized version control system like SVN?

Git is a **distributed version control system (DVCS)**: it tracks changes to files over time and lets many people collaborate on the same project, but crucially every `clone` is a *complete* repository — full history, all branches, everything — not a thin working copy of a central server.

In a **centralized** system (SVN, CVS, Perforce), there's one authoritative server that holds the history. Your checkout is just the latest files (plus some bookkeeping); nearly every operation — commit, log, diff against an old revision, branch — talks to the server over the network.

| | Centralized (SVN/CVS) | Distributed (Git) |
|---|---|---|
| History location | On the central server | In *every* clone |
| Commit | Goes straight to the server | Local; push later |
| Offline work | Very limited | Full: commit, branch, log, diff |
| Single point of failure | The server | None (any clone can reseed) |
| Branching | Heavyweight, server-side | Cheap, local, instant |

The practical upshot: with Git you commit, branch, diff, and browse history on a plane with no wifi, then `push` when you're back online. There's no single machine whose loss destroys the project — any full clone can become the new "origin."

### Q2. What does "distributed" actually buy you, and why did Git win?

Four concrete wins:

- **Offline, fast, local operations.** Commits, diffs, log, blame, branch switches all hit the local object database — no round trip. This is *why* Git feels instant compared to SVN.
- **No single point of failure.** Every developer's clone is a full backup of history. Lose the server and you re-push from any clone.
- **Cheap branching and merging.** A branch is a 41-byte file (a SHA plus newline). Branching is free, so workflows built on many short-lived branches (feature branches, PRs) became practical.
- **Decoupled collaboration.** You control when work becomes shared. Commit freely in private, curate, then push. Multiple remotes (fork + upstream) fall out naturally.

Git won partly on technical merit (speed, the snapshot model, cheap branches) and partly on ecosystem timing: it was built for the Linux kernel's distributed, high-volume workflow, and GitHub then made the branch-and-pull-request model the default way open source and companies collaborate. The distributed model turned out to match how software is actually built.

### Q3. Explain "snapshots, not diffs." How does Git store commits?

Most people assume version control stores a base version plus a chain of diffs (that's the SVN mental model). Git doesn't. **Each commit references a complete snapshot** of the project — a tree that names every file's content at that moment.

The trick that makes this cheap is **content addressing**. Git stores each file's contents as a blob keyed by the hash of those contents. If a file didn't change between commits, its blob hash is identical, so both commits' trees just point at the *same* blob — no duplication. Only changed files produce new blobs.

```bash
# Two commits where README.md is unchanged both point at
# the identical blob hash for README.md; no copy is made.
git cat-file -p HEAD^{tree}   # list the tree of the current commit
```

So "snapshot" doesn't mean "store a full copy of every file every time." It means *conceptually* each commit is the whole state, while physically Git deduplicates unchanged content by hash. Later, `git gc` compresses objects into **packfiles** that *do* store deltas between similar objects — but that's a storage optimization underneath the model, not the model itself. The model you reason about is: commit → tree → the entire project.

### Q4. What does "content-addressable storage" mean in Git?

It means every object is stored under a key that is the **hash of the object's own content**. You don't choose the key; Git computes it. Same bytes in → same hash out → same key.

```bash
echo -n 'hello' | git hash-object --stdin
# -> b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0  (deterministic)
```

Three consequences fall out for free:

- **Automatic deduplication.** Two identical files anywhere in history share one blob.
- **Integrity / tamper-evidence.** If a single byte of an object is corrupted or altered, its hash no longer matches its key — Git detects it. And because a commit's hash depends on its tree's hash, which depends on its blobs' hashes, the top-level commit SHA effectively signs the entire snapshot beneath it.
- **Stable identity.** A commit means the same thing on every machine because its ID is derived from its content, not assigned by a server.

Git historically uses **SHA-1** for these keys and is migrating to **SHA-256** (you can init a repo with `--object-format=sha256`) to stay ahead of collision concerns; the object model is identical either way.

### Q5. Describe Git's object model. What are the four object types?

Everything in a Git repository is one of four immutable, content-addressed objects:

- **Blob** — the raw contents of a file. Just bytes; no filename, no permissions, no history. Two files with identical content share one blob.
- **Tree** — a directory listing. Each entry is `(mode, type, hash, name)`, pointing at a blob (a file) or another tree (a subdirectory). A tree captures the structure and names that blobs lack.
- **Commit** — points at exactly **one tree** (the full project snapshot), plus **parent commit(s)**, an **author** and **committer** (name/email/timestamp), and a **message**.
- **Tag object** — an annotated tag: a named pointer to another object (usually a commit) with its own message and optional GPG/SSH signature.

```
commit  ── tree ──┬── blob   (README.md)
   │              ├── blob   (main.go)
   │              └── tree ──── blob  (src/util.go)
   └── parent → (previous commit)
```

The key insight: a commit doesn't list files directly. It names *one* tree, and that tree (recursively) reaches **every** file and directory in the project. Follow the tree from any commit and you can reconstruct the exact working state at that point in time.

### Q6. Walk me through how a commit reaches every file in the project.

A commit holds a single pointer: the hash of its **root tree**. From there it's a recursive walk:

1. The commit points at the root tree.
2. The root tree lists the top-level entries — some are blobs (files at the repo root), some are subtrees (directories).
3. Each subtree lists *its* entries — more blobs and subtrees.
4. Recurse until you've resolved every blob.

```
HEAD (commit) → root tree
                 ├── README.md      → blob a1b2…
                 ├── go.mod         → blob c3d4…
                 └── cmd/           → tree e5f6…
                       └── main.go  → blob 7890…
```

So the entire project state is a Merkle tree rooted at the commit. This is why a commit is a true snapshot: one hash at the top transitively names every file. It's also why an unchanged directory across commits costs nothing — both commits' trees point at the identical subtree hash.

### Q7. How is a commit hash computed, and why does changing anything change it?

A commit object is a small text blob: it contains the **tree hash**, the **parent hash(es)**, the **author** and **committer** lines (name, email, timestamp), and the **commit message**. Git prepends a header (`commit <size>\0`) and hashes the whole thing:

```
commit <byte-length>\0
tree <tree-sha>
parent <parent-sha>
author alice <alice@example.com> 1700000000 +0000
committer alice <alice@example.com> 1700000000 +0000

Fix login redirect
```

Hash that byte-for-byte and you get the commit's SHA. Because the SHA is a hash of *all* of that:

- Change a file → its blob hash changes → the tree hash changes → the commit hash changes.
- Change the message, author, date, or the parent pointer → the commit hash changes.

And critically, since each commit embeds its **parent's** hash, altering any commit changes *every descendant's* hash too — the whole chain above it is rewritten. That cascading property is what makes Git history tamper-evident and is the mechanical reason "editing old history" produces an entirely new set of commits.

### Q8. Why is Git history described as immutable / append-only?

Because objects are content-addressed and never modified in place. You can't "edit" commit `abc123` — its hash *is* its content, so any change produces a different object with a different hash. The old object still sits in the database.

What feels like editing history (`commit --amend`, `rebase`, `filter-repo`) actually **writes new objects** and then **moves a ref** to point at them. The original commits aren't altered; they're just no longer referenced by a branch.

```
before:  A---B---C   main
after amend of C:
         A---B---C   (orphaned, still in object DB)
              \
               C'    main   ← branch now points here
```

Two important corollaries: (1) the "lost" commits linger in the object database (findable via `git reflog`) until garbage collection eventually prunes unreachable objects; (2) rewriting shared history is dangerous precisely because everyone else still references the *old* hashes — their history and yours diverge. Immutability is the safety property that makes recovery possible and rewriting risky.

### Q9. What's inside the `.git` directory?

`.git` *is* the repository — delete it and you're left with an ordinary folder of files. A quick tour of what matters:

- **`objects/`** — the object database: all blobs, trees, commits, and tags, stored loose (by hash) or bundled into **packfiles** (`objects/pack/`).
- **`refs/`** — the refs: `refs/heads/` (local branches), `refs/tags/` (tags), `refs/remotes/` (remote-tracking branches). Each file just contains a commit SHA.
- **`HEAD`** — usually a symref like `ref: refs/heads/main` telling Git which branch you're on (or a raw SHA when detached).
- **`index`** — the staging area: a binary file listing the blobs and paths that make up the *next* commit.
- **`config`** — repo-local configuration (remotes, branch tracking, user overrides).
- **`packed-refs`** — refs packed into one file for efficiency.
- **`logs/`** — the reflog: a history of where `HEAD` and each branch have pointed (the recovery safety net).
- **`hooks/`** — sample and active hook scripts (pre-commit, pre-push, etc.).

```bash
git cat-file -p HEAD          # inspect the commit HEAD points to
cat .git/HEAD                 # -> ref: refs/heads/main
cat .git/refs/heads/main      # -> a commit SHA (that's all a branch is)
```

### Q10. What's the difference between porcelain and plumbing commands?

Git ships two layers of commands:

- **Porcelain** — the friendly, high-level commands you use daily: `git add`, `git commit`, `git status`, `git log`, `git merge`, `git rebase`. Their output is human-oriented and may change between versions.
- **Plumbing** — low-level commands that operate directly on the object database and are meant for scripting: `git hash-object`, `git cat-file`, `git rev-parse`, `git update-ref`, `git write-tree`, `git ls-tree`. Stable, script-friendly output.

The porcelain commands are built *on top of* the plumbing. `git commit` ultimately writes blobs (`hash-object`), builds a tree (`write-tree`), creates a commit object (`commit-tree`), and moves a ref (`update-ref`).

Why interviewers bring it up: reaching for plumbing (`git cat-file -p`, `git rev-parse HEAD`) in an answer signals you understand the machine, not just the buttons. And many porcelain commands accept `--porcelain` flags (e.g. `git status --porcelain`) that give *stable* machine-readable output for scripts — a useful distinction.

### Q11. How do you inspect Git objects directly with `cat-file` and `hash-object`?

`git hash-object` computes (and optionally stores) the SHA of content; `git cat-file` reads objects back out. Together they let you poke at the raw database.

```bash
# Compute the blob hash of a file (and store it in the object DB)
git hash-object -w README.md          # -> <blob-sha>

# What type is an object?
git cat-file -t HEAD                  # -> commit

# Pretty-print an object's contents
git cat-file -p HEAD                  # commit: tree/parent/author/message
git cat-file -p HEAD^{tree}           # the root tree: modes, hashes, names
git cat-file -p <blob-sha>            # a file's contents
```

A useful drill in an interview: `git cat-file -p HEAD` shows the commit points at a tree and a parent; `git cat-file -p <that-tree>` shows entries pointing at blobs and subtrees; `git cat-file -p <a-blob>` shows the file bytes. Walking that chain live proves you understand commit → tree → blob rather than just reciting it.

### Q12. What's the difference between Git and a hosting platform like GitHub?

Git is the **tool** — a distributed VCS that runs entirely on your machine, needs no server, and works offline. GitHub, GitLab, Bitbucket, and Gitea are **hosting platforms** built *around* Git: they host a clone that acts as a shared `origin` and add collaboration features Git itself doesn't have.

What the platform adds on top of plain Git: pull/merge requests, code review UI, issues, CI/CD pipelines, access control, web browsing, and a canonical place to `push` to.

What's pure Git, no platform required: commits, branches, merges, tags, history, `push`/`pull`/`fetch` between *any* two repos (even two folders on the same disk, or over SSH).

```bash
# A "remote" can just be another local directory — no GitHub involved
git clone /path/to/other/repo
git remote add upstream git@github.com:acme/project.git
```

Conflating the two is a classic junior tell. You can use Git for a lifetime with no GitHub account; GitHub is one (very popular) place to host the shared copy.

### Q13. What's a Git ref, and how does it relate to HEAD?

A **ref** is just a named pointer to a commit — physically a small file whose contents are a commit SHA. Branches (`refs/heads/main`), tags (`refs/tags/v1.0`), and remote-tracking branches (`refs/remotes/origin/main`) are all refs.

```bash
cat .git/refs/heads/main     # -> a 40-char SHA. That's the whole branch.
```

**HEAD** is a special ref that answers "where am I right now?" Normally it's a *symbolic* ref pointing at a branch:

```bash
cat .git/HEAD                # -> ref: refs/heads/main
```

So `HEAD → refs/heads/main → <commit SHA>`. When you commit, Git writes a new commit and updates `refs/heads/main` to point at it; HEAD follows because it points at the branch. When you `checkout` a specific commit instead of a branch, HEAD points *directly* at a commit — that's **detached HEAD**. Understanding that refs are trivial files is what makes branching feel cheap: creating a branch just writes one file containing a SHA.

### Q14. What is the commit DAG?

Commits form a **directed acyclic graph**. Each commit points *backward* to its parent(s); "directed" = edges have a direction (child → parent), "acyclic" = you can never loop back to yourself (a commit's hash depends on its parents', so a cycle is impossible).

- A commit with **one parent** = an ordinary commit.
- A commit with **two or more parents** = a merge commit.
- A commit with **zero parents** = a root commit (the first in a repo, or a new orphan branch).

```
A---B---C---F   main
     \     /
      D---E      feature   (F merges E → two parents)
```

Branches and tags are just refs pointing at nodes in this graph; HEAD marks where you are. Almost every Git operation is a graph operation: `log` walks parent edges, `merge` finds a common ancestor and creates a node with two parents, `rebase` copies a subgraph onto a new base, `HEAD~2` walks two parent edges back. Once you see history as this graph rather than a straight line, branching and merging stop being confusing.

### Q15. Why is Git so fast for most operations?

Because almost everything is **local and precomputed**. Unlike a centralized VCS where `log`, `diff`, and `blame` hit a server, in Git the entire history lives in `.git` on your disk, so those operations are file reads, not network calls.

Specific reasons:

- **Local object database.** History, branches, and diffs are all resolved from local objects — no round trip.
- **Content addressing enables cheap comparison.** To know whether two trees/files differ, Git compares hashes; identical hash → identical content, no byte comparison needed.
- **Snapshots + dedup.** Switching branches or diffing commits is mostly pointer-following and hash comparison, not reconstructing files from a long diff chain.
- **Packfiles + delta compression.** Storage stays compact and cache-friendly, so even large histories fit in memory well.
- **Cheap refs.** A branch is a one-line file; creating, deleting, and switching branches barely touches disk.

Only operations that inherently need the network — `fetch`, `pull`, `push`, `clone` — pay a network cost. Everything else is designed to be a local, hash-driven operation.

### Q16. How do you configure your Git identity, and why does it matter?

Every commit records an **author** and **committer** with a name, email, and timestamp. Git needs to know who you are before it will let you commit:

```bash
git config --global user.name  "alice"
git config --global user.email "alice@example.com"

# Repo-local override (e.g. a work email for one project):
git config user.email "alice@acme.com"
```

`--global` writes to `~/.gitconfig` (applies everywhere); omitting it writes to `.git/config` for just the current repo, which takes precedence. There's also a system-level config for all users on the machine — locality wins: repo > global > system.

Why it matters in practice:

- The identity is **baked into every commit's hash** — change your email and future commits get different SHAs than they would have.
- On public repos, that email is visible in history forever. Use a provider noreply address (e.g. `<id>+<user>@users.noreply.github.com`) to avoid leaking a personal inbox.
- Hosting platforms match commits to accounts by the commit email; a mismatched email means your commits don't link to your profile.

Getting identity wrong is easy to fix going forward but painful retroactively (it requires history rewriting), so set it before your first commit.

## The Three Trees & Basic Workflow

### Summary

**What this topic covers**

The day-to-day mechanics of turning edited files into commits — and the one concept that trips up more beginners than any other: the **staging area**. Three concern areas: (1) the **three trees** — the working directory, the index (staging area), and HEAD, and how `add` and `commit` move data between them; (2) the **core verbs** — `add`, `commit`, `status`, `diff`, `restore`, `rm`, `mv`, and their most useful flags; and (3) **crafting clean commits** — why staging exists, `git add -p` for hunk-level staging, amending the last commit, and safely undoing changes at each stage. The 16 questions here take you from "what's the difference between `git diff` and `git diff --staged`" to "walk me through building a focused commit out of a messy working tree." This is the workflow you run dozens of times a day; understanding the three trees makes every `status` output instantly readable.

**Mental model**

Picture three "trees" (states of your project) and data flowing between them:

```
working directory  --(git add)-->  index / staging area  --(git commit)-->  HEAD
      (edits)                        (proposed next commit)     (last commit / DAG)
```

The **working directory** is your actual files on disk — what your editor sees. The **index** (a.k.a. staging area or cache) is a *proposed next commit*: a listing of blobs and paths that `commit` will freeze. **HEAD** is the last commit — the snapshot you started from. Editing a file changes only the working directory. `git add` copies that version into the index. `git commit` turns the index into a new commit and moves HEAD (and the branch) to it. The genius — and the initial confusion — is that middle tree: staging lets you commit *some* of your changes and hold back the rest. Every `git status` line is just describing how these three trees differ: index vs HEAD = "changes to be committed"; working dir vs index = "changes not staged."

**Key terms**

- **Working directory** — your files on disk, where edits happen; can hold changes not yet staged.
- **Index / staging area / cache** — the proposed next commit; a listing of blobs + paths.
- **HEAD** — the commit you're based on; the third tree, effectively the last commit.
- **Tracked** — a file Git already knows about (in HEAD or the index).
- **Untracked** — a file in the working dir that Git isn't following yet.
- **Ignored** — an untracked file matched by `.gitignore`; deliberately not shown/staged.
- **Staged change** — a difference present in the index but not yet committed.
- **`git add -p`** — interactively stage individual *hunks* rather than whole files.
- **`--amend`** — replace the last commit with a new one (new SHA) incorporating the current index.
- **`git restore`** — modern command to discard working changes or unstage (splits the old overloaded `checkout`/`reset`).
- **`--cached`** — operate on the index only (e.g. `rm --cached` untracks without deleting the file).

**Why interviewers ask this**

The staging area is the concept that separates people who *type* Git commands from people who *understand* the workflow. A junior candidate commits everything with `git commit -am "wip"` and can't explain what the index is for. A senior candidate uses `git add -p` to carve a noisy working tree into two or three focused commits, knows exactly what `git diff` versus `git diff --staged` compares, and can unstage or discard changes without fear. Interviewers also probe the undo commands (`restore`, `restore --staged`) because that's where beginners cause data loss — knowing which operations are safe and which are destructive is a real-world competence signal. If you can read a `git status -sb` output aloud and explain each column, you've demonstrated fluency most candidates lack.

**Common confusions**

- "`git add` saves my changes" — it stages them; nothing is *saved* to history until `git commit`.
- "`git diff` shows all my changes" — plain `git diff` shows only working-dir-vs-index (unstaged). Staged changes need `--staged`.
- "Staging is a pointless extra step" — it's the feature that lets you commit part of your work and review before recording.
- "`git commit -a` commits everything" — it auto-stages *tracked, modified* files only; brand-new untracked files are still skipped.
- "`git rm --cached` deletes the file" — it removes it from tracking/index but leaves it on disk.
- "Discarding working changes is undoable" — `git restore <file>` (old `checkout --`) throws away uncommitted edits with no reflog to recover them.

**What follows from this topic**

This is where the object model from **Git Fundamentals** becomes hands-on: the index is literally a list of blob hashes, and `commit` writes the tree/commit objects described there. The clean-commit habits here (staging hunks, amending) feed directly into **Commits & History**, where good atomic commits make `log`, `blame`, `bisect`, and `revert` powerful. The undo commands previewed here (`restore`, `restore --staged`) are the gentle cousins of `reset` and `revert`, which the history-rewriting topics cover in full. Master the three trees and the scarier commands become "just moving pointers between these same three states."

### Q1. What are the three trees in Git?

Git's core workflow revolves around three "trees" — three views of your project that a normal commit moves data between:

```
working directory  →  index (staging area)  →  HEAD
```

- **Working directory** — the actual files on your disk. This is what you edit; it can contain changes that aren't staged or committed.
- **Index / staging area** — a proposed *next* commit. It's a snapshot (a list of blobs + paths) of what will be recorded when you run `git commit`. Also called the "cache."
- **HEAD** — a pointer to the **last commit** on your current branch: the snapshot you started from, the baseline.

The everyday flow: you edit files (changing the working directory), `git add` copies selected changes into the index, and `git commit` records the index as a new commit — updating HEAD. Almost every `status`/`diff`/`reset`/`restore` question is really "which two of these three trees am I comparing or moving?" Holding this picture in your head makes the rest of Git's basic commands self-explanatory.

### Q2. What is the staging area (index) and why does it exist?

The **staging area** is the middle tree: a place to assemble your *next* commit before you record it. Physically it's `.git/index`, a listing of the file paths and blob hashes that `git commit` will freeze into a snapshot.

Why not just commit the working directory directly? Because the index gives you a **review-and-curate step**:

- **Focused commits.** Stage only the changes that belong together, even if your working tree has three unrelated fixes in it. One logical change per commit.
- **Partial staging.** With `git add -p` you can stage *some hunks* of a file and leave others unstaged.
- **A final review.** `git diff --staged` shows exactly what you're about to commit — a last chance to catch a stray debug line.

```
edit files ──add──▶ [index: the next commit] ──commit──▶ history
             ▲
        stage only what belongs together
```

Some VCSs skip this and commit the whole working copy. Git's separate staging step is what makes clean, atomic commits practical — a habit that pays off in review, `blame`, `bisect`, and `revert` later.

### Q3. Walk me through the lifecycle of a file in Git.

A file moves through a small state machine:

```
untracked ──git add──▶ staged ──git commit──▶ committed
                                                  │
                                            (edit file)
                                                  ▼
                                              modified ──git add──▶ staged ──▶ …
```

- **Untracked** — a brand-new file Git isn't following. It appears under "Untracked files" in `git status`.
- **Staged** — after `git add`, the current content is in the index, queued for the next commit.
- **Committed / unmodified** — after `git commit`, the file matches HEAD; Git considers it clean.
- **Modified** — you edit a tracked file; now the working dir differs from the index/HEAD, and it shows as "changes not staged."

You cycle between modified → staged → committed as you work. A file can even be *partially* staged: some hunks in the index, others still only in the working directory — in which case it shows up in *both* the staged and unstaged sections of `git status`. Understanding these states makes `git status` output obvious.

### Q4. What's the difference between `git diff`, `git diff --staged`, and `git diff HEAD`?

They differ in *which two of the three trees* they compare — this is one of the most common interview questions:

| Command | Compares | Shows you |
|---|---|---|
| `git diff` | working dir ↔ index | Unstaged changes (edits you haven't `add`ed) |
| `git diff --staged` (`--cached`) | index ↔ HEAD | Staged changes (what the next commit will contain) |
| `git diff HEAD` | working dir + index ↔ HEAD | *All* changes since the last commit, staged or not |

```
                git diff HEAD
        ┌──────────────────────────────┐
   HEAD ── git diff --staged ── index ── git diff ── working dir
```

So: you edited a file and staged it → `git diff` shows *nothing* (working matches index), while `git diff --staged` shows your change. Edit it again after staging → `git diff` shows the new edit, `git diff --staged` shows the earlier staged version, and `git diff HEAD` shows both combined. Knowing which command to reach for — "what am I about to commit?" is `--staged`; "what have I not staged yet?" is plain `git diff` — is a fluency signal.

### Q5. What does `git status` tell you, and what's the `-sb` short format?

`git status` describes how the three trees differ, in three buckets: **changes to be committed** (index vs HEAD — staged), **changes not staged for commit** (working dir vs index — unstaged), and **untracked files**. It also tells you the current branch and how it compares to its upstream.

The default output is verbose. `git status -sb` gives a compact, script-and-glance-friendly view:

```bash
git status -sb
```

Reading the short format: the branch line comes first (branch name and ahead/behind vs upstream). Then each file gets a **two-column** status code — **left column = index (staged) state, right column = working-tree (unstaged) state**:

- ` M` — modified, not staged (change only in working dir)
- `M ` — modified and staged
- `MM` — staged, then modified again (both)
- `A ` — newly added (staged)
- `??` — untracked

That left/right = staged/unstaged mapping is the whole trick. Once you internalize it, `git status -sb` is faster to read than the long form.

### Q6. What does `git add` do, and what is `git add -p`?

`git add` copies the current content of a file from the **working directory into the index** — staging it for the next commit. It doesn't save anything to history; it just says "include this version in the next commit."

```bash
git add file.go            # stage one file
git add src/               # stage a directory
git add .                  # stage everything under the current dir
git add -A                 # stage all changes incl. deletions, repo-wide
```

The power tool is **`git add -p`** (patch mode). Instead of staging whole files, it walks you through each **hunk** (a contiguous block of changes) and asks whether to stage it:

```bash
git add -p
# y = stage this hunk, n = skip, s = split into smaller hunks,
# e = edit the hunk manually, q = quit
```

This is the killer feature for clean commits: you can have a bug fix and an unrelated refactor tangled in the same file and stage *only* the bug-fix hunks, commit that, then stage and commit the rest. It's how senior engineers turn a messy working tree into a series of atomic, reviewable commits.

### Q7. What does `git commit` do, and what do `-a`, `-m`, and `--amend` mean?

`git commit` takes whatever is in the **index** and records it as a **new commit object**, then advances HEAD (and the current branch) to point at it. The working directory isn't consulted for *what* to commit — only the index is.

Common flags:

- **`-m "message"`** — supply the commit message inline instead of opening an editor.
- **`-a`** — auto-stage *tracked, modified* files before committing (a shortcut past `git add`). **Caveat:** it does **not** stage brand-new untracked files — those still need an explicit `git add`.
- **`--amend`** — replace the last commit with a new one that includes the current index (and lets you edit the message). Useful for "oops, forgot a file" or fixing a typo in the message.

```bash
git commit -m "Add rate limiter"
git commit -am "Fix typo"        # stage tracked changes + commit
git commit --amend               # rewrite the previous commit
```

Remember `--amend` creates a **new commit with a new SHA** — the old one is orphaned. That's fine locally but dangerous if the original was already pushed (see the history-rewriting rules).

### Q8. What's the difference between tracked, untracked, and ignored files?

- **Tracked** — files Git already knows about: they're in HEAD, in the index, or both. Git watches these for modifications.
- **Untracked** — files present in your working directory that Git isn't following. They've never been `git add`ed. `git status` lists them under "Untracked files."
- **Ignored** — a *subset* of untracked files matched by a pattern in `.gitignore` (or `.git/info/exclude`). Git deliberately hides these from status and won't stage them by accident — think `node_modules/`, build output, `.env`.

```bash
git status --ignored     # also show ignored files
git check-ignore -v path # explain WHICH rule ignores a path
```

The important nuance: **`.gitignore` only affects untracked files.** If a file is already tracked, adding it to `.gitignore` does nothing — Git keeps versioning it. To stop tracking an already-committed file you must `git rm --cached` it first, then ignore it. That gotcha (e.g. accidentally committing a config file, then wondering why ignoring it doesn't help) is a frequent interview and real-world trap.

### Q9. How do `git rm` and `git mv` work, and what does `--cached` do?

`git rm` removes a file **and** stages the deletion; `git mv` renames a file and stages the rename (Git detects renames by content anyway, but `git mv` is convenient).

```bash
git rm secret.txt          # delete from disk AND stage removal
git mv old.txt new.txt     # rename + stage the rename
```

The crucial flag is **`--cached`**: it removes a file from the **index (tracking)** but leaves it **on disk**:

```bash
git rm --cached .env       # stop tracking .env, keep the file locally
```

This is exactly what you do when you accidentally committed something that should have been ignored — a secrets file, build output, an IDE folder. `git rm --cached` untracks it, then you add it to `.gitignore` so it stays out. Contrast with plain `git rm`, which would also delete it from your working directory. (Note: `--cached` only stops *future* tracking; the file still exists in past history — purging it from history entirely needs `git filter-repo`.)

### Q10. I staged a file by mistake. How do I unstage it without losing my changes?

You want to move the change *out of the index* but keep it in your working directory. The modern command is `git restore --staged`:

```bash
git restore --staged file.go     # unstage; working-dir edits are untouched
```

The older, still-common equivalent is:

```bash
git reset HEAD file.go           # same effect: unstage, keep working changes
```

Both take the file's entry in the index back to its HEAD version while leaving your working-directory edits alone — so after running either, `git status` shows the change as "not staged" instead of "to be committed." Nothing is lost; you've only changed which tree the change lives in.

This is safe precisely because it only touches the **index**, not the working directory. Contrast it with `git restore file.go` (no `--staged`), which *does* touch the working directory and discards edits — see the next question.

### Q11. I want to throw away my uncommitted changes to a file. How, and what's the risk?

To discard working-directory edits and reset a file back to what's staged (or to HEAD), use `git restore`:

```bash
git restore file.go              # discard unstaged edits (revert to index)
git restore --source=HEAD file.go  # discard back to the last commit
```

The older form is `git checkout -- file.go`. Same effect.

**The risk: this is destructive and effectively unrecoverable.** Uncommitted changes were never written to the object database, so there's no commit and no reflog entry to recover them from — once you `restore`, those edits are gone. Compare this to `restore --staged`, which is safe because it only shuffles the index.

Rule of thumb: anything that discards *uncommitted working-directory* changes (`restore`, `checkout --`, `reset --hard`, `clean -fd`) has no undo. If you're not sure you want to lose the work, stash it first (`git stash`) instead of restoring — a stash *is* recoverable.

### Q12. How do you fix the last commit — say you forgot to add a file or made a typo in the message?

Use `git commit --amend`. It replaces the most recent commit with a new one that folds in whatever is currently staged, and optionally lets you rewrite the message.

Forgot to include a file:

```bash
git add forgotten.go
git commit --amend --no-edit     # keep the same message, add the file
```

Typo in the message:

```bash
git commit --amend -m "Add rate limiter to login endpoint"
```

Under the hood `--amend` doesn't edit the old commit — it creates a **brand-new commit with a new SHA** (same parent) and moves the branch to it; the original is orphaned but still recoverable via reflog for a while.

**The one rule:** don't amend a commit you've already pushed to a shared branch. Since the SHA changes, your history diverges from everyone else's, and they'll get conflicts or be tempted to force-push. Amend freely on local, unpushed commits.

### Q13. How do you view a file as it existed in a past commit without checking it out?

Use `git show <revision>:<path>` to print the file's contents at that revision straight to stdout — no branch switching, no touching your working directory:

```bash
git show HEAD:config/app.yaml         # the file at the last commit
git show HEAD~3:src/main.go           # three commits back
git show feature/login:README.md      # as it is on another branch
git show a1b2c3d:path/to/file.txt     # at a specific commit
```

This is perfect for "what did this file look like before that refactor?" or grabbing an old version to compare or copy a snippet, without disturbing your current state. You can redirect it to a file if you want a copy:

```bash
git show HEAD~5:app.py > /tmp/old-app.py
```

Related: `git diff HEAD~3 -- src/main.go` shows how that file changed over the last three commits, and `git log -p -- <path>` shows its full change history. `git show` is the quick "peek at one version" tool.

### Q14. Walk me through crafting a clean, focused commit from a messy working tree.

Suppose you fixed a bug *and* did an unrelated refactor in the same session, touching several files. You want two separate, coherent commits.

```bash
# 1. See the lay of the land
git status -sb
git diff                      # review everything unstaged

# 2. Stage only the bug-fix hunks, reviewing each
git add -p                    # answer y/n per hunk; s to split

# 3. Verify EXACTLY what you're about to commit
git diff --staged

# 4. Commit just the bug fix
git commit -m "Fix off-by-one in pagination"

# 5. Now stage and commit the refactor separately
git add -p                    # or git add <files>
git commit -m "Extract PageBuilder helper"
```

The workflow hinges on the staging area: `git add -p` lets you pick hunks, and `git diff --staged` is your pre-commit review. The payoff comes later — atomic commits make code review readable, `git bisect` able to pinpoint the exact breaking change, and `git revert` able to undo one logical change without collateral. "I just commit everything with `-am`" is the answer that flags a junior; this is the senior answer.

### Q15. Can you make an empty commit, and why would you?

Yes — `git commit --allow-empty` records a commit with no file changes (its tree is identical to its parent's):

```bash
git commit --allow-empty -m "Trigger CI redeploy"
```

Why it's occasionally useful:

- **Trigger CI/CD.** Many pipelines run on new commits; an empty commit re-runs the pipeline without altering code.
- **Mark a milestone or annotate history** — e.g. a "release" marker, though a tag is usually better.
- **Start a repo** with an initial empty commit so the first *real* commit has a parent to rebase/amend against cleanly.

By default Git refuses to commit when nothing is staged (to protect you from no-op commits), which is why the `--allow-empty` flag is required. It's a niche tool, but knowing it exists — and that a commit is just a tree pointer, so an "empty" one is perfectly valid — shows you understand the model. Relatedly, `--allow-empty-message` lets you commit with no message, another guard you can override when scripting.

### Q16. Why is committing a two-step process — `git add` then `git commit`?

Because the two steps do genuinely different things, and separating them is the feature, not friction:

- **`git add`** selects *what* goes into the next commit (working dir → index). It's the "compose" step.
- **`git commit`** freezes that selection into permanent history (index → new commit). It's the "record" step.

If Git committed the whole working directory in one shot (as some simpler tools do), you'd lose the ability to:

- **Commit only part of your work** — the staging area lets you record a focused subset and hold the rest back.
- **Review before recording** — `git diff --staged` shows precisely what's about to be committed.
- **Split one messy session into several clean commits** via `git add -p`.

You *can* collapse it when you don't need that control: `git commit -am "msg"` stages tracked changes and commits in one go. But the two-step design exists so that "what I'm working on" (working dir) and "what I'm about to record" (index) are separate ideas. That separation is exactly what makes clean, atomic commits — and everything they enable downstream — possible.

## Commits & History

### Summary

**What this topic covers**

Commits as first-class objects and how to read, reference, and reason about the history they form. Three concern areas: (1) **the anatomy of a commit** — what it points at, the author-vs-committer distinction, and how parent pointers build the DAG; (2) **navigating history** — `git log` and its power flags, `git show`, `git blame`, and the full grammar of *referencing* commits (`HEAD`, `HEAD~3`, `HEAD^2`, SHAs, ranges `A..B` vs `A...B`); and (3) **the craft of history** — writing good commit messages (50/72, imperative mood, Conventional Commits), atomic commits, amending, and signing. The 16 questions here move from "what is a commit" to "explain the difference between `HEAD~` and `HEAD^`" and "how do I find the commit that introduced this string." Good history is a product you build deliberately; these are the tools and conventions that make it navigable years later.

**Mental model**

A commit is a small immutable object that pins down three things: **a tree** (the full snapshot), **its parent(s)** (position in the DAG), and **metadata** (author, committer, message, timestamps). Its SHA is the hash of all of that. So "history" is not a log file Git appends to — it's a graph you traverse by following parent pointers, and the branch refs are just bookmarks into that graph. Everything you do to *read* history is a graph walk: `git log` walks parents from a starting ref; a range `A..B` means "commits reachable from B but not A." Everything you do to *reference* a commit is a way of naming a node: by SHA, by ref name, or by navigating relative to one (`~` walks first-parent ancestry, `^` selects among parents). Writing history well — atomic commits, clear messages — is about making that graph legible to the humans (including future you) who'll walk it during review, `blame`, and `bisect`.

**Key terms**

- **Commit object** — tree + parent(s) + author + committer + message + timestamps, identified by its SHA.
- **Author vs committer** — who *wrote* the change vs who *created this commit object*; they diverge on rebase/amend/cherry-pick/applied patches.
- **Parent pointer** — reference from a commit to its predecessor(s); defines the DAG.
- **Merge commit** — a commit with two or more parents.
- **Root commit** — a commit with zero parents.
- **`HEAD~n`** — the nth ancestor following *first parents* only.
- **`HEAD^n`** — the nth *parent* of a commit (matters at merges).
- **Range `A..B`** — commits reachable from B but not A (double-dot).
- **Range `A...B`** — commits in either but not both (symmetric difference, triple-dot).
- **Pickaxe (`-S`/`-G`)** — `git log` search for when a string/pattern was added or removed.
- **Conventional Commits** — `type(scope): subject` message convention that machines can parse.
- **`git blame`** — annotate each line with the commit that last changed it.

**Why interviewers ask this**

History fluency is a proxy for how you'll operate on a real team. A candidate who writes `git commit -m "stuff"` and only knows `git log` will struggle to debug a regression or review a PR. A senior candidate reaches for `git log -S"functionName"` to find when a symbol appeared, `git log --oneline --graph --all` to understand branch topology, `git blame` (with its caveats) to find context, and writes messages that explain *why*. Interviewers also probe referencing syntax (`HEAD~` vs `HEAD^`, `A..B` vs `A...B`) because it reveals whether you truly picture the DAG or just memorize commands. And the author/committer and amend questions test whether you understand that commits are immutable objects — the through-line of every Git topic.

**Common confusions**

- "`HEAD~` and `HEAD^` are the same" — they coincide on linear history but differ at merges: `~` walks first-parent ancestry, `^` picks *which* parent.
- "The author is whoever committed it" — author is preserved across rebase/cherry-pick; the *committer* is who ran the command that created this object.
- "`A..B` and `A...B` mean the same range" — double-dot is asymmetric (in B, not A); triple-dot is the symmetric difference.
- "Amending edits a commit" — it creates a new commit with a new SHA; the old one is orphaned.
- "Commit messages are just a formality" — they're the primary documentation surface for `blame`, `log`, review, and changelogs.
- "`git blame` tells you who wrote the logic" — it tells you who *last touched the line*; a reformat or move can obscure the real author (mitigated by `-w`, `-C`, `--ignore-rev`).

**What follows from this topic**

The referencing grammar here (`HEAD~`, `^`, ranges) is the vocabulary that reset, rebase, cherry-pick, and revert all speak — you can't safely `git rebase -i HEAD~4` without it. The author/committer and amend material connects straight to the history-rewriting topics and the golden rule about not rewriting shared history. Atomic-commit discipline, seeded in **The Three Trees**, pays off here in `bisect` and `revert`. And `git log`'s graph view is how you'll make sense of branching and merging topology. In short, this topic is the *reading and referencing* layer that every *modifying* Git operation builds on.

### Q1. What is a commit, really?

A commit is an **immutable object** in Git's database that captures a point in history. It records exactly:

- **One tree** — the complete snapshot of the project at that moment (which, recursively, names every file).
- **Parent commit(s)** — zero for a root commit, one for an ordinary commit, two or more for a merge.
- **Author** — who wrote the change, with a timestamp.
- **Committer** — who created *this commit object*, with a timestamp.
- **A message** — the human explanation.

```bash
git cat-file -p HEAD
# tree   9f2c…      ← the snapshot
# parent 4a7b…      ← previous commit
# author    alice <alice@example.com> 1700000000 +0000
# committer alice <alice@example.com> 1700000000 +0000
#
# Add rate limiter to login endpoint
```

The commit's **SHA is the hash of all of the above**, which is why it uniquely identifies not just the change but the entire state and lineage. A commit is *not* a diff — the diff you see in `git show` is *computed* by comparing the commit's tree to its parent's tree on the fly. Internalizing "a commit points at a full tree plus parents" is the key that unlocks branching, merging, and rebasing.

### Q2. What's the difference between the author and the committer?

Every commit carries **two** identities and **two** timestamps:

- **Author** — who originally wrote the change, and when.
- **Committer** — who created this particular commit object, and when.

For a normal `git commit`, they're the same person at the same time, so nobody notices. They **diverge** whenever a commit is *recreated*:

- **`git rebase`** — replays your commits onto a new base, creating new commit objects. The **author** (and author date) is preserved; the **committer** becomes you, now.
- **`git cherry-pick`** — copies someone's commit onto your branch: their authorship stays, you become the committer.
- **Applied patches** (`git am`, mailing-list workflow like the Linux kernel) — the patch author is the author; the maintainer who applies it is the committer.
- **`git commit --amend`** — keeps the original author by default but updates the committer.

```bash
git log --format='%an authored, %cn committed' -1
```

This split matters for attribution and for understanding why a rebased commit shows an old author date but a fresh committer date. It's a favorite interview question precisely because most people only ever see them equal.

### Q3. How do parent pointers form the commit DAG?

Each commit stores the SHA(s) of its **parent(s)** — the commit(s) it was built on top of. Those backward references, across all commits, form a **directed acyclic graph**:

- **One parent** — an ordinary commit in a line of work.
- **Two (or more) parents** — a **merge commit**, joining two lines of history.
- **Zero parents** — a **root commit** (the first commit, or a fresh orphan branch).

```
A---B---C-------F   main
     \         /
      D---E---/       feature   (F = merge of C and E)
```

Here F has two parents (C and E). Branches (`main`, `feature`) are just refs pointing at nodes; they don't *own* commits, they *point* at the tip and the graph is walked backward from there.

"Directed" = edges point child→parent. "Acyclic" = there can be no cycle, because a commit's SHA is computed from its parents' SHAs — you'd need a commit's hash before creating it to loop back. This graph is the substrate every Git operation walks: `log` follows parents, `merge` finds a common ancestor, `rebase` copies a chain onto a new parent.

### Q4. What makes a good commit message?

A good message explains **why** the change exists, formatted so tools and humans can both use it. The widely-followed **50/72** convention:

```
Add rate limiter to login endpoint

Brute-force attempts were saturating the auth service. This adds a
per-IP token bucket (100 req/min) in front of /login, returning 429
when exceeded. Chose in-memory over Redis for now — single instance.

Refs: ENG-482
```

The rules:

- **Subject ≤ ~50 chars**, capitalized, no trailing period, in the **imperative mood** ("Add", "Fix", "Refactor" — as if completing "This commit will…").
- **Blank line** between subject and body (tools rely on it to separate the two).
- **Body wrapped at ~72 chars**, explaining **why** and any trade-offs — *not* restating the diff, which the reader can already see.

Why it matters: the subject is what `git log --oneline`, `blame`, PR titles, and generated changelogs display. The body is the context future-you needs when `git bisect` lands on this commit at 2am. Messages are the single most durable documentation you write — code shows *what*, the message explains *why*.

### Q5. What are Conventional Commits and why use them?

**Conventional Commits** is a lightweight message convention that puts a machine-parseable prefix on the subject line:

```
<type>(<optional scope>): <subject>

feat(auth): add per-IP rate limiter to login
fix(api): handle null user in session lookup
docs(readme): document env vars
refactor(parser): extract token scanner
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`. A `!` after the type (or a `BREAKING CHANGE:` footer) flags a breaking change.

Why teams adopt it:

- **Automated versioning & changelogs.** Tools (semantic-release, Changesets) read the types to decide the next semver bump (`fix` → patch, `feat` → minor, breaking → major) and to generate release notes.
- **Scannable history.** `git log --oneline` becomes instantly categorizable.
- **Enforceable in CI.** A commit-lint check keeps everyone consistent.

The trade-off is a bit of ceremony, but on a team shipping releases it pays for itself in automation. Even without tooling, the discipline of naming the *type* of each change tends to produce more atomic commits.

### Q6. Show me the `git log` flags you actually use.

`git log` walks the DAG from a starting point; its flags reshape what and how much you see:

```bash
git log --oneline                 # one compact line per commit (short SHA + subject)
git log --oneline --graph --all   # ASCII branch topology across ALL refs
git log --stat                    # which files changed + insertion/deletion counts
git log -p                        # full patch (diff) for each commit
git log --author="alice"          # filter by author
git log --since="2 weeks ago"     # filter by date (also --until)
git log -5                        # last 5 commits
git log -- path/to/file           # only commits touching that path
git log --follow -- file.go       # …and keep following across renames
```

Two I lean on constantly:

- `git log --oneline --graph --all` to *see* the branch structure — merges, where feature branches diverged, what's ahead of what.
- `git log -p -- <file>` to read the full evolution of a single file.

Being able to name the right flag for "show me what changed in these files" (`--stat`), "who and when" (`--author`, `--since`), or "the actual diffs" (`-p`) is a fluency signal.

### Q7. How do you find the commit that introduced or removed a specific piece of code?

Use the **pickaxe** options of `git log`. They search *changes*, not just current content:

```bash
git log -S"rateLimiter"           # commits that changed the NUMBER of
                                  # occurrences of the string (added/removed)
git log -S"rateLimiter" -p        # …and show the diffs
git log -G"rate.?limiter"         # commits whose diff matches this REGEX
```

- **`-S<string>`** ("pickaxe") finds commits where the count of that literal string changed — i.e. where it was *introduced or deleted*. Perfect for "when did this function first appear?" or "what removed this config key?"
- **`-G<regex>`** matches any commit whose *diff text* matches the pattern — broader; it catches lines that merely mention the pattern, even if the count didn't change.

Contrast with `git log --grep=<pattern>`, which searches commit *messages*, not code. And `git log -L :funcName:file.c` traces the entire history of a single function.

This is one of the highest-leverage Git skills for debugging: instead of eyeballing history, you ask Git exactly when a string or symbol entered the codebase, and jump straight to the commit (and its message explaining *why*).

### Q8. How do you reference commits — SHAs, HEAD, and relative refs?

Git accepts many ways to name a commit; the common ones:

- **Full or abbreviated SHA** — `a1b2c3d4…` or just `a1b2c3d` (Git resolves the shortest unambiguous prefix).
- **`HEAD`** — the current commit (where you are).
- **Branch/tag names** — `main`, `feature/login`, `v1.2.0` resolve to the commit they point at.
- **`HEAD~n`** — walk *n* commits back along **first parents**: `HEAD~3` is three back.
- **`HEAD^`** — the first parent; **`HEAD^2`** the second parent (only meaningful at a merge).
- **`@{...}` reflog syntax** — `HEAD@{2}` is where HEAD was two moves ago; `main@{yesterday}` where `main` pointed yesterday.

```bash
git show HEAD~2        # the commit two before HEAD
git diff HEAD~3 HEAD   # everything that changed in the last 3 commits
git show v1.2.0        # the tagged commit
git reset --hard HEAD@{1}   # undo the last ref move via reflog
```

You can also combine them: `HEAD~2^2` means "two back, then the second parent." This grammar is the language reset, rebase, revert, and cherry-pick all use — knowing it is prerequisite to using them safely.

### Q9. What's the difference between `HEAD~` and `HEAD^`?

They answer different questions, and only *look* the same on linear history:

- **`HEAD^` (caret)** selects a **parent** — *which* parent. `HEAD^` = `HEAD^1` = first parent; `HEAD^2` = second parent (exists only on merge commits).
- **`HEAD~` (tilde)** walks **generations** back along **first-parent** ancestry. `HEAD~2` = "two commits back," equivalent to `HEAD^^`.

So on a straight line they coincide: `HEAD~1` = `HEAD^1` = the previous commit. They diverge at a **merge commit**:

```
      C   (merge: parents = B and X)
     / \
...-B   X-...

C^1  = B   (first parent)
C^2  = X   (second parent)
C~1  = B   (one generation back = first parent)
C~2  = A   (two back, following first parents: C→B→A)
```

Rule of thumb: **`~` counts steps up the first-parent line; `^` picks among a commit's parents.** You combine them for precision — `HEAD~2^2` means "go back two on the first-parent line, then take the second parent of *that* commit." Getting this right is exactly the kind of thing that separates people who picture the DAG from people who guess.

### Q10. Explain the difference between `A..B` and `A...B` ranges.

Both name *sets* of commits for `log` and `diff`, but they mean different things:

- **`A..B` (double-dot)** — commits reachable from **B but not A**. Asymmetric. "What's in B that isn't in A yet."
- **`A...B` (triple-dot)** — commits reachable from **either but not both** (the symmetric difference). Plus, `git log A...B` can show the merge base.

```
      D---E---F   feature
     /
A---B---C         main

main..feature   → D E F        (in feature, not main)
feature..main   → C            (in main, not feature)
main...feature  → C D E F      (in one or the other, not both)
```

Practical uses:

```bash
git log main..feature      # commits I'd be merging INTO main
git log --oneline @{u}..   # my local commits not yet pushed (@{u}=upstream)
git diff main...feature    # diff of feature vs the MERGE BASE (what a PR shows)
```

Note the `diff` twist: `git diff A..B` compares the two endpoints directly, while `git diff A...B` compares B against the *merge base* of A and B — which is why triple-dot diff matches what a pull request displays. Mixing these up is a common source of "why does my diff look wrong."

### Q11. What does `git show` do?

`git show` displays a single object in full — most often a commit, where it prints the commit's metadata **and** the diff it introduced (its tree vs its parent's):

```bash
git show                 # the HEAD commit: message + diff
git show a1b2c3d         # a specific commit
git show HEAD~3          # a commit by relative ref
git show v1.2.0          # an annotated tag (tag message + tagged commit)
git show HEAD:src/app.go # a FILE at that commit (not a diff — the contents)
git show --stat HEAD     # just the changed-files summary, no full diff
```

It's the quick "what exactly was in this commit?" tool — for review, for understanding what a SHA from `blame` or `log` actually changed, or (with the `<rev>:<path>` form) to dump a file's contents at a past revision without checking it out. For a merge commit, `git show` by default shows a combined diff (only the conflict-relevant parts); `git show -m` splits it per-parent. It complements `git log` (many commits, overview) by zooming into one.

### Q12. What does `git commit --amend` do to the object graph, and when is it unsafe?

`--amend` replaces the most recent commit. Mechanically, it builds a **new commit object** — same parent, new tree (folding in the current index), possibly a new message — and moves the branch ref to it. The **original commit is orphaned** (unreferenced, recoverable via reflog until GC), and the new one has a **different SHA**.

```
before:  A---B---C   main   (HEAD)
amend C:
         A---B---C       (orphaned)
              \
               C'  main   ← branch now points here; C' has a new SHA
```

So amending doesn't "edit" anything — it rewrites the tip. That's perfectly safe **locally**, before you've shared the commit.

**It's unsafe once the commit is pushed.** Because `C'` has a different SHA than the `C` your teammates already have, your branch and theirs diverge. Pushing requires a force (`--force-with-lease`), and anyone who pulled the old `C` gets conflicts or ends up rewriting their own history. The golden rule: **amend (and rewrite generally) only commits that haven't left your machine.** For a pushed commit, prefer a new follow-up commit or `git revert`.

### Q13. Why do atomic, focused commits matter?

An **atomic commit** captures exactly one logical change — nothing more, nothing less. The discipline pays off across several tools:

- **Review.** A reviewer can understand one coherent change at a time instead of untangling three concerns mashed together. Smaller, focused diffs get better review.
- **`git bisect`.** Bisect binary-searches history to find the commit that introduced a bug. If each commit is one change, the culprit commit *tells you exactly what broke*; if commits bundle ten unrelated changes, you've narrowed it to a haystack.
- **`git revert`.** You can cleanly undo one feature without collateral damage — only possible if that feature is isolated in its own commit(s).
- **`blame` / history.** Line-level history stays meaningful when each commit has a single purpose and a message that explains it.

```bash
git add -p          # stage hunks to keep each commit focused
git commit -m "Fix off-by-one in pagination"
git commit -m "Rename PageBuilder for clarity"   # separate concern, separate commit
```

The habit — enabled by the staging area — is what makes history a debugging and review asset rather than a write-only log.

### Q14. How and why do you sign commits?

Commit signing cryptographically proves *who* created a commit, closing the gap that author/committer fields are just free-text you can set to anyone.

```bash
# GPG (classic) or SSH (simpler, uses your existing SSH key)
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true    # sign every commit

git commit -S -m "Release v2.0"            # sign a single commit explicitly
git log --show-signature                   # view signatures
git verify-commit HEAD                     # verify one
```

Why it matters:

- **Anti-impersonation.** Anyone can `git config user.email someone@else.com` and commit as them. A signature can't be forged without the private key.
- **The "Verified" badge.** Hosting platforms show a Verified badge when the signature matches a key registered to the account — a trust signal for reviewers.
- **Supply-chain integrity.** Signed tags/commits let downstream consumers verify releases weren't tampered with.

Many organizations require signed commits on protected branches. The mechanism doesn't change the object model — the signature is stored in the commit object header — but it adds a verifiable identity layer on top of it.

### Q15. What does `git blame` tell you, and what are its limits?

`git blame` annotates each line of a file with the **commit, author, and date that last modified that line**:

```bash
git blame src/app.go
git blame -L 40,60 src/app.go    # only lines 40–60
```

It's the go-to for "why is this line here / who has context on it?" — you find the commit, then read its message and PR.

**But it tells you who *last touched* the line, not who wrote the logic.** Common ways it misleads, and the fixes:

- A whitespace/reformat pass claims every line → use **`git blame -w`** to ignore whitespace changes.
- Code moved from another file → **`git blame -C`** detects moved/copied lines and blames their original.
- A mass rename or lint sweep obscures real history → record that commit in `.git-blame-ignore-revs` and use **`--ignore-rev` / `--ignore-revs-file`** so blame skips past it.

```bash
git blame -w -C --ignore-revs-file .git-blame-ignore-revs app.go
```

So blame is a *starting point* for archaeology, not ground truth about authorship. Pair it with `git log -L :func:file` to trace a function's full evolution when a single blame line isn't enough.

### Q16. How is viewing history for a range different from viewing a whole branch?

`git log <branch>` starts at that branch tip and walks *all* its ancestors — the entire history reachable from it. A **range** narrows that to a slice of the DAG:

```bash
git log main                 # every commit reachable from main (full history)
git log main..feature        # only commits in feature that aren't in main
git log HEAD~5..HEAD         # just the last 5 commits
git log v1.0..v2.0           # everything shipped between two releases
git log @{u}..               # your local commits not yet pushed (upstream..HEAD)
```

The difference matters constantly in real work:

- **"What am I about to merge/push?"** → `main..feature` or `@{u}..`, not the whole branch.
- **"What changed between releases?"** → `v1.0..v2.0` for changelog generation, instead of the entire project history.
- **Scoping review or a changelog** to just the new work rather than everything since the dawn of the repo.

Under the hood it's set arithmetic on reachability: a plain branch name = "everything reachable from here," while `A..B` = "reachable from B minus reachable from A." Reaching for a range instead of dumping the full log — and picking `..` vs `...` correctly (see Q10) — is what makes `git log` a precision tool rather than a firehose.
## Branches & Refs

### Summary

**What this topic covers**

The single most important mental unlock in Git: a **branch is not a container of commits — it's a 41-byte file that holds one commit SHA**. Once that clicks, half of Git stops being scary. This topic covers what refs actually are (files under `.git/refs` or `packed-refs`), the three families of refs (`refs/heads/*` local branches, `refs/tags/*` tags, `refs/remotes/*` remote-tracking branches), how **HEAD** works as a symbolic ref that points at your current branch, how a commit advances the current branch pointer, **detached HEAD** and how to get out of it, creating/switching/listing/deleting/renaming branches, **remote-tracking** vs **local tracking (upstream)** branches and how `git status` computes ahead/behind, and how "lost" commits survive in the reflog until garbage collection. The 16 questions run from "how do I make a branch" to "I committed on a detached HEAD and switched away — recover it."

**Mental model**

Picture the commit history as an immutable, append-only graph of snapshots — each commit is a node pointing back at its parent(s). That graph is the truth; it never moves. **Branches and tags are just sticky notes you place on nodes.** A branch is a movable sticky note: when you commit while "on" it, Git writes the new commit and then peels the note off the old commit and sticks it on the new one — the pointer advances, the graph grows. `HEAD` is a special sticky note that usually doesn't point at a commit directly; it points at *another* sticky note (your current branch) and says "this is where the next commit attaches." Creating a branch is just writing one small file — that's why Git branching is O(1) and instant, versus SVN where a "branch" copies a whole directory tree. Deleting a branch just removes the sticky note; the commits underneath are still in the object database, unreachable but recoverable from the reflog until garbage collection sweeps them. Everything else — switching, merging, rebasing — is moving sticky notes around on a graph that itself never changes.

**Key terms**

- **ref** — a named pointer to an object, stored as a file containing a SHA (e.g. `.git/refs/heads/main`) or in `.git/packed-refs`.
- **branch** — a movable ref under `refs/heads/*` pointing at the tip commit of a line of work.
- **HEAD** — a symbolic ref naming your current branch (`ref: refs/heads/main`); determines where the next commit attaches.
- **symbolic ref** — a ref that points at another ref rather than a SHA; HEAD is the main one.
- **detached HEAD** — HEAD pointing directly at a commit SHA instead of a branch; new commits aren't held by any branch.
- **remote-tracking branch** — a local read-only ref (`refs/remotes/origin/main`) recording where the remote's branch was at last fetch.
- **tracking / upstream branch** — the remote-tracking branch a local branch is paired with; enables bare `git push`/`pull` and ahead/behind counts.
- **`@{upstream}` / `@{u}`** — shorthand for the current branch's configured upstream.
- **fast pointer math** — `HEAD~2`, `HEAD^`: ancestor navigation. `~` walks first-parent N steps; `^` selects a parent.
- **reflog** — a per-ref log of every position HEAD/branches have held; the recovery net for "lost" commits.
- **orphan branch** — a branch created with no parent history (`--orphan`), starting a disconnected root.

**Why interviewers ask this**

Because the "branch is a pointer" model is the fastest way to tell whether someone *understands* Git or has memorised a command list. A junior describes branches as copies or folders and gets nervous around detached HEAD. A senior says "a branch is a ref, HEAD points at it, committing advances it" and can then reason about *any* branch operation from first principles — including recovery. Detached HEAD in particular is a great filter: candidates who panic about "losing" commits don't understand the reflog; candidates who calmly say "grab the SHA from the reflog and make a branch" have internalised that commits are immutable and reachable objects. The remote-tracking vs upstream distinction separates people who've collaborated on real teams from people who've only worked solo, because ahead/behind confusion is a daily collaboration reality.

**Common confusions**

- "Branches are heavy — creating one copies the code." No — a branch is one small file with a SHA; creation is instant and O(1).
- "`origin/main` is the remote branch." No — it's a *local* read-only snapshot of where the remote was at your last `fetch`; it goes stale until you fetch again.
- "Detached HEAD means my commits are gone." No — they exist in the object DB and are in the reflog; you just have no branch pointing at them yet.
- "HEAD points at a commit." Usually not — HEAD points at a *branch* (symbolic ref); it only points at a commit when detached.
- "`git branch foo` switches me to foo." No — it only creates the ref; use `git switch foo` (or `git switch -c foo` to create and switch).
- "Deleting a branch deletes its commits." Only the pointer goes; unreachable commits linger until GC and are reflog-recoverable meanwhile.

**What follows from this topic**

Everything downstream is pointer manipulation. **Merging** moves a branch pointer forward (fast-forward) or writes a new 2-parent commit; **rebasing** rewrites commits and re-points the branch at the new tip; **reset** literally just moves a branch pointer to a chosen commit. If branches-as-pointers is solid, those topics become "which pointer moves where, and does history get rewritten?" The remote-tracking model here feeds directly into the **Remotes / fetch-pull-push** topic, and the reflog thread runs straight into **Undoing changes & recovery**.

### Q1. What actually is a branch in Git?

A branch is a **movable pointer to a commit** — concretely, a file under `.git/refs/heads/` (or an entry in `.git/packed-refs`) that contains a single 40-character commit SHA and a newline. That's it. Forty-one bytes.

```bash
cat .git/refs/heads/main
# 3f7a1c9e2b... (one commit SHA)
```

Because a branch is just a pointer, creating one is O(1) — Git writes one small file, no matter how large the repository or its history. This is the deep contrast with older VCS like SVN, where a "branch" was a server-side copy of a directory tree. In Git, branching is so cheap that the idiomatic workflow is "branch for every tiny thing."

When you commit while on a branch, Git creates the commit object and then **rewrites that pointer file** to the new commit's SHA. The branch "moves forward." Nothing about the commits themselves is stored "in" the branch.

### Q2. What is HEAD, and how is it different from a branch?

**HEAD is a symbolic ref that names your current branch.** It answers "where does the next commit attach, and what does my working tree reflect?" Normally it doesn't hold a commit SHA — it holds a *reference to a branch*:

```bash
cat .git/HEAD
# ref: refs/heads/main
```

So there's a two-hop chain: `HEAD → refs/heads/main → <commit SHA>`. When you `git commit`, Git follows HEAD to `main`, writes the new commit, and advances `main`. When you `git switch feature`, Git rewrites `HEAD` to `ref: refs/heads/feature` and updates the working tree to match that branch's tip.

The exception is **detached HEAD**, where `HEAD` holds a commit SHA directly (no branch in the middle) — covered below.

### Q3. What are refs, and where does Git store them?

A **ref** is a human-readable name pointing at an object (almost always a commit). They live as plain files under `.git/refs/`, or compacted into `.git/packed-refs` for performance. Three families:

| Ref namespace | Holds | Example |
|---|---|---|
| `refs/heads/*` | Local branches | `refs/heads/main` |
| `refs/tags/*` | Tags | `refs/tags/v1.2.0` |
| `refs/remotes/*` | Remote-tracking branches | `refs/remotes/origin/main` |

```bash
git show-ref            # list all refs and their SHAs
cat .git/packed-refs    # refs compacted into one file
```

The point: branches, tags, and remote-tracking branches are all the *same kind of thing* — a name pointing at a SHA. What differs is the namespace and the rules Git applies (tags are meant to be immutable; remote-tracking refs are updated only by fetch).

### Q4. How do I create and switch branches?

```bash
git branch feature/login        # create ref, do NOT switch
git switch feature/login        # switch to an existing branch
git switch -c feature/login     # create AND switch (modern)
git checkout -b feature/login   # create AND switch (older, still works)
```

`git branch <name>` only writes the pointer at your current commit — a common gotcha is expecting it to switch you too; it doesn't. Prefer `git switch` for changing branches and `git switch -c` for create-and-switch: `switch` was introduced precisely to split the overloaded `checkout` (which also restores files) into clearer verbs.

### Q5. What happens to the branch pointer when I commit?

Git advances it. Concretely: it writes the new commit object (whose parent is the current tip), then rewrites the current branch's ref file to point at the new commit.

```text
before:   A---B        (main, HEAD)
commit C
after:    A---B---C     (main, HEAD)
```

HEAD still points at `main`; `main` now points at `C`. The old commit `B` is untouched and immutable — it's simply no longer the branch tip. This is why "moving a branch" and "committing" are the same underlying operation: both rewrite a 41-byte pointer file.

### Q6. What is a detached HEAD, and how do I end up in one?

You're in detached HEAD when **HEAD points directly at a commit SHA instead of at a branch**. You get there by checking out something that isn't a branch:

```bash
git switch --detach 3f7a1c9   # explicit
git checkout 3f7a1c9          # a raw SHA
git checkout v1.2.0           # a tag
git checkout origin/main      # a remote-tracking branch
```

It's not an error — it's useful for inspecting or building on a specific historical point. Git warns you because **new commits made here aren't held by any branch**. If you commit and then switch away without creating a branch, the only thing pointing at those commits is the reflog.

```text
A---B---C        main
     \
      X---Y      HEAD (detached — no branch holds X, Y)
```

### Q7. I committed on a detached HEAD, then switched to main. Are my commits lost?

No — they're **unreachable, not deleted**. The commit objects are still in the object database, and the reflog remembers exactly where HEAD was.

```bash
git reflog                       # find the SHA of your last detached commit (e.g. Y)
git switch -c recovered 9a3f21c  # create a branch pointing at it
```

Now a branch holds `X---Y` and they're safe. Unreachable objects survive until `git gc` prunes them (default: at least 2 weeks via `gc.reflogExpireUnreachable`), so you have a wide recovery window. The lesson interviewers want: **commits are immutable content-addressed objects; "losing" work is almost always just "no ref points at it yet."**

### Q8. Explain remote-tracking branches vs local tracking branches.

Two different things people conflate:

- **Remote-tracking branch** (`origin/main`, in `refs/remotes/origin/main`) — a *local, read-only* pointer recording where the remote's `main` was **at your last fetch**. You don't commit to it; `git fetch` updates it. It's a cached snapshot, and it goes stale between fetches.
- **Tracking / upstream branch** — a *local* branch (`refs/heads/main`) configured to pair with a remote-tracking branch as its **upstream**. That pairing is what lets bare `git push`/`git pull` know where to go and lets `git status` say "ahead 2, behind 1."

```bash
git branch -vv            # shows each local branch and its [upstream] + ahead/behind
git branch --set-upstream-to=origin/main   # pair current branch with an upstream
echo @{upstream} / @{u}   # shorthand for the configured upstream
```

### Q9. How does `git status` compute "ahead 2, behind 1"?

It compares your current branch against its configured upstream (the remote-tracking branch), counting commits each side has that the other doesn't:

- **ahead N** — N commits on your local branch not yet on the upstream (need to push).
- **behind M** — M commits on the upstream not yet on your local branch (need to pull/merge/rebase).

```text
        o---o---o     origin/main (behind: 1)
       /
...---x
       \
        o---o         main (ahead: 2)
```

Critical caveat: these numbers are only as fresh as your **last fetch**, because they compare against the *remote-tracking* branch, which is a cached snapshot. If someone pushed since your last fetch, `git status` still shows stale numbers — run `git fetch` first for the truth.

### Q10. How do I list, delete, and rename branches?

```bash
git branch                 # list local branches (* marks current)
git branch -a              # include remote-tracking branches
git branch -vv             # show tips + upstream + ahead/behind

git branch -d old-feature  # delete — SAFE: refuses if unmerged
git branch -D old-feature  # delete — FORCE: even if unmerged (can orphan commits)

git branch -m new-name     # rename current branch
git branch -m old new      # rename a specific branch

git branch --merged        # branches already merged into HEAD (safe to prune)
git branch --no-merged     # branches with unmerged work
```

`-d` protects you: it refuses to delete a branch whose commits aren't reachable from somewhere else, so you don't silently orphan work. `-D` overrides that — use it knowingly (the commits still go to the reflog).

### Q11. If I delete a branch, what happens to its commits?

Deleting a branch removes **only the pointer**. The commits stay in the object database. If no other ref (branch, tag) and no reachable history includes them, they become **unreachable** — but they're not gone:

1. They remain recoverable via the **reflog** (`git reflog`, or `git reflog show <branch>` before deletion) and `git fsck --lost-found`.
2. They're physically pruned only when `git gc` runs and their reflog entries have expired (typically ≥ 2 weeks for unreachable objects).

```bash
git reflog                       # find the deleted branch's last SHA
git branch recovered <sha>       # re-anchor it
```

So `git branch -D` is far less destructive than it feels — it's a "remove sticky note," not a "shred the pages."

### Q12. Why is branching so cheap in Git compared to older VCS?

Because a branch is a pointer, not a copy. Creating a branch writes one ~41-byte ref file regardless of repo size — no files are duplicated, because all branches share the same immutable, content-addressed object database. Two branches that share history literally point into the same commit objects; only the tips differ.

Contrast SVN, where branching historically meant a server-side copy of a directory path, and merging tracked which revisions had been ported. Git's model — snapshots deduplicated by hash, branches as movable labels — makes "branch per feature, per experiment, per bugfix" the natural workflow rather than a heavyweight ceremony.

### Q13. What are `HEAD~`, `HEAD^`, and how do ancestor refs work?

They're navigation shortcuts relative to a commit:

- `HEAD^` — the **first parent** of HEAD. `HEAD^2` — the *second* parent (only meaningful on merge commits).
- `HEAD~` / `HEAD~1` — one step back along the **first-parent** line. `HEAD~3` — three first-parent steps back.

```text
A---B---C---D   (D = HEAD)
HEAD~1 = C
HEAD~2 = B
HEAD^  = C   (first parent of D)
```

Where they diverge is at merges: `^` chooses *which parent*, `~` walks *how far* up the first-parent chain. So on a merge commit `M` with parents `P1 P2`: `M^1` (= `M~1`) is `P1`, and `M^2` is `P2`. You'll use these constantly: `git reset HEAD~1`, `git rebase -i HEAD~3`, `git show HEAD^`.

### Q14. What is a symbolic ref, and how does it relate to HEAD?

A **symbolic ref** points at *another ref* rather than at a commit SHA. HEAD is the canonical example — its normal content is `ref: refs/heads/main`, not a SHA. This indirection is what makes "the current branch" a first-class concept: committing follows the symbolic ref to find which branch to advance.

```bash
git symbolic-ref HEAD                  # prints: refs/heads/main
git symbolic-ref HEAD refs/heads/dev   # repoint HEAD (like switching, minus tree update)
```

`refs/remotes/origin/HEAD` is another symbolic ref — it records the remote's default branch (what you get from a bare `git clone`). Detaching HEAD replaces the symbolic form with a direct SHA.

### Q15. What is an orphan branch and when would you use one?

An **orphan branch** starts with **no parent history** — a fresh root commit, disconnected from every existing line.

```bash
git switch --orphan gh-pages
# working tree keeps files, but staging starts empty and there's no parent
git rm -rf .          # usually you clear it out first
git commit -m "Initial gh-pages root"
```

Real uses: a `gh-pages` docs site that shouldn't carry your source history; a separate root for generated artifacts; or scrubbing a repo down to a clean single-commit history. Because it has no common ancestor with `main`, merging the two would be an unrelated-histories merge (needs `--allow-unrelated-histories`), which is usually not what you want — orphan branches are meant to stay independent.

### Q16. What is the default branch, and does `main` vs `master` matter technically?

Technically, nothing special distinguishes the default branch — it's an ordinary branch that happens to be the one HEAD points at in a fresh clone (recorded via `refs/remotes/origin/HEAD`). Git has no built-in "master" magic; the name is pure convention.

Since ~2020 the community and Git itself moved the default from `master` to `main`. You set your local default for new repos with:

```bash
git config --global init.defaultBranch main
```

Renaming an existing default is just a branch rename plus updating the remote's default and everyone's upstreams:

```bash
git branch -m master main
git push -u origin main
# then update the default branch in the hosting UI, delete origin/master
```

The only "gotcha" is coordination — CI configs, protected-branch rules, and open PRs reference the name, so it's a team operation, not a purely technical one.

## Merging

### Summary

**What this topic covers**

How Git integrates divergent lines of work back together. The two shapes: a **fast-forward** (the branch just slides its pointer forward when nothing has diverged — no merge commit) and a **3-way merge** (both sides advanced, so Git computes a merge commit with two parents by combining the two tips against their common ancestor). Then the messy reality: **merge conflicts** — why they happen, how to read the `<<<<<<< ======= >>>>>>>` markers, how to resolve and finish (or `--abort`), the `ours`/`theirs` strategies and `-X` options, `--squash` merges, octopus merges, and the crucial distinction between **textual** conflicts (all Git can detect) and **semantic** conflicts (a clean merge that's still logically broken — only tests catch these). The 17 questions span "what does merge actually do" through "walk me through resolving this three-way conflict" to "why did a clean merge break the build."

**Mental model**

Merging is Git answering: "given a common ancestor and two descendants, what's the combined state?" Start from the **merge base** — the best common ancestor of the two branch tips. Git does a three-way diff: base→ours and base→theirs. Anywhere only *one* side changed, take that change automatically. Anywhere *both* sides changed the *same region* differently, Git can't decide — that's a conflict, and it hands you the file with markers to resolve by hand. If one branch is a direct ancestor of the other (no divergence), there's nothing to combine: Git just **fast-forwards** the pointer, no new commit. Otherwise it records a **merge commit** with *two parents*, tying the histories together permanently. The key realisation for interviews: Git merges **content textually**, per-hunk. It has no idea what your code *means*. A merge with zero conflicts can still be semantically wrong — one side renamed a function, the other added a caller of the old name; both hunks apply cleanly, and the build breaks. Conflicts are the *visible* failures; semantic breakage is the invisible one that tests exist to catch.

**Key terms**

- **merge** — combining two lines of development, usually recording a commit that has both tips as parents.
- **merge base** — the best common ancestor of the two branches; the "base" in three-way merge.
- **fast-forward (ff)** — when the target hasn't diverged, Git moves its pointer to the source tip; no merge commit.
- **`--no-ff`** — force a merge commit even when a fast-forward was possible (keeps a visible topic-branch bubble).
- **`--ff-only`** — refuse the merge unless it can fast-forward (fails rather than creating a merge commit).
- **three-way merge** — combining two tips against their merge base to produce a two-parent merge commit.
- **merge commit** — a commit with 2+ parents recording an integration point.
- **conflict** — overlapping edits Git can't auto-resolve; marked in-file, staged when fixed.
- **conflict markers** — `<<<<<<< ours`, `=======`, `>>>>>>> theirs` (and the base region with diff3).
- **`ours` / `theirs`** — the two sides of a conflict; also strategy/`-X` options that auto-pick one side.
- **`--squash`** — collapse a branch's changes into staged edits with no merge commit or parent link.
- **semantic conflict** — a textually clean merge that's logically broken; only tests/compilation reveal it.

**Why interviewers ask this**

Merging is where solo Git ends and *team* Git begins, so it's a direct proxy for "have you actually collaborated?" Junior signal: fear of conflicts, deleting the whole file and re-pasting, not understanding why a merge commit appeared. Senior signal: explaining the three-way algorithm, reading conflict markers fluently, knowing when to `--abort` vs push through, and — the real tell — recognising that a *clean* merge can still be *wrong*. Interviewers also probe the fast-forward vs `--no-ff` question because it reveals whether you understand your team's history policy (linear vs merge-bubble) rather than just running `git merge` blindly. The `-X theirs` / `--squash` questions separate people who know the sharp tools from people who reach for them reflexively and lose changes.

**Common confusions**

- "A merge always creates a merge commit." No — a fast-forward merge creates none; the pointer just advances.
- "Conflicts mean I did something wrong." No — they're a normal signal that both sides edited the same region; Git is asking you to decide.
- "`ours`/`theirs` are obvious." During a *merge*, "ours" is the branch you're on; during a *rebase* they flip, because rebase replays your commits onto their base — a classic trap.
- "`-X theirs` resolves this one file." No — it applies "prefer their side" to *every* conflict in the whole merge; easy to silently drop your own changes.
- "No conflicts means the merge is correct." No — Git only detects *textual* overlap; semantic breakage passes silently. Run the tests.
- "`--squash` is just a tidy merge." No — it produces staged changes with *no* merge commit and *no* parent link, so history won't show the branch was merged.

**What follows from this topic**

Merging is the "preserve true history" half of integration; **Rebasing** is the "rewrite for a linear history" half — the two topics are best understood as a pair, and the merge-vs-rebase decision table lives in both. The conflict-resolution mechanics here reappear almost identically during rebase (just replayed per-commit), so getting comfortable with markers and `--abort` now pays off there. The fast-forward concept connects forward to the **PR / trunk-based workflow** topic, where "rebase then merge `--ff-only`" is a common house style.

### Q1. What does `git merge` actually do?

It integrates the changes from one branch into your current branch and, in the general case, records a **merge commit** that has **two parents** — the tip you were on and the tip you merged in — tying the two histories together at that point.

```bash
git switch main
git merge feature/login
```

Mechanically Git finds the **merge base** (common ancestor), computes what changed on each side since that base, and combines them. If the two sides touched different things, it's automatic. If they touched the same region differently, you get a conflict to resolve. If the branches never diverged, it doesn't create a commit at all — it fast-forwards (next question).

### Q2. What is a fast-forward merge?

When your current branch is a **direct ancestor** of the branch you're merging — i.e. it hasn't advanced since they diverged — there's nothing to combine. Git just slides the current branch's pointer forward to the target tip. **No merge commit is created.**

```text
before:   A---B           main (HEAD)
               \
                C---D      feature

after ff: A---B---C---D    main, feature   (main just moved to D)
```

```bash
git switch main
git merge feature      # fast-forwards if main hasn't moved
```

The history stays perfectly linear — it looks as if you'd committed `C` and `D` on `main` directly. The downside: the fact that `C` and `D` came from a feature branch disappears from the graph, which is exactly what `--no-ff` exists to preserve.

### Q3. What's the difference between `--ff-only` and `--no-ff`?

They're the two ways to take control of the fast-forward decision:

| Flag | Behaviour | Use when |
|---|---|---|
| (default) | Fast-forward if possible, else make a merge commit | General use |
| `--ff-only` | *Only* fast-forward; abort if a merge commit would be needed | Enforcing linear history; safe `pull` |
| `--no-ff` | *Always* create a merge commit, even if ff was possible | Preserve a visible feature-branch bubble |

```bash
git merge --ff-only feature   # fails loudly rather than diverging
git merge --no-ff  feature     # forces a merge commit "Merge branch 'feature'"
```

This is a **team policy** question. `--no-ff` keeps every feature grouped under one merge commit (easy to see and revert as a unit) at the cost of a bushier graph. `--ff-only` (often paired with rebase) keeps history flat and linear. Neither is "correct" — interviewers want you to articulate the tradeoff, not pick dogmatically.

### Q4. Explain the three-way merge algorithm.

When *both* branches have new commits since they split, Git can't fast-forward. It performs a **three-way merge** using three inputs:

1. **Base** — the merge base (best common ancestor).
2. **Ours** — the tip of the current branch.
3. **Theirs** — the tip of the branch being merged.

```text
        o---o        feature (theirs)
       /
...---B              (B = merge base)
       \
        o---o        main (ours, HEAD)
```

Git diffs base→ours and base→theirs. For each region: if only one side changed it, take that change; if both changed it identically, take it once; if both changed it *differently*, that's a **conflict**. The result is recorded as a merge commit with parents `ours` and `theirs`. "Three-way" refers to those three snapshots — using the base is what lets Git tell "someone added this line" apart from "someone deleted that line," which a naive two-way diff couldn't.

### Q5. Why do merge conflicts happen?

A conflict occurs when Git can't unambiguously combine the two sides. The common cases:

- **Same-region edits** — both branches changed the *same lines* of the same file to different content.
- **Add/add** — both branches created a new file at the same path with different content.
- **Edit/delete** — one side modified a file the other side deleted.
- **Rename/edit collisions** and mode changes, less commonly.

Crucially, Git conflicts on **overlapping regions**, not "same file." Two branches can edit the same file heavily and merge cleanly if their edits are in different hunks. Conflicts are the algorithm honestly reporting "I have two different answers for this exact spot and no rule to choose" — they're expected in active collaboration, not a failure.

### Q6. Walk me through resolving a merge conflict.

```bash
git merge feature
# CONFLICT (content): Merge conflict in src/auth.js
git status                  # lists "Unmerged paths"
```

Open the file and read the markers:

```text
<<<<<<< HEAD        (ours — current branch)
const timeout = 30;
=======
const timeout = 60;
>>>>>>> feature     (theirs — merged branch)
```

1. **Decide the correct result** — keep ours, keep theirs, or write a blend. Delete all three marker lines, leaving only the intended content.
2. **Stage it**: `git add src/auth.js` — this tells Git the path is resolved.
3. **Repeat** for every conflicted file (`git status` tracks them down).
4. **Finish**: `git commit` — Git pre-fills the merge message. Done.

If you get in over your head: `git merge --abort` returns you to the pre-merge state, no harm done. And run the tests before committing — a hand-resolved merge can compile but be logically wrong.

### Q7. In a conflict, what do "ours" and "theirs" mean — and why is it confusing?

- During a **merge**: **ours** = the branch you're currently on (`HEAD`); **theirs** = the branch you're merging *in*.
- During a **rebase**: they **flip**. Rebase replays *your* commits onto *their* base, so at conflict time "ours" is the branch you're replaying onto (the upstream) and "theirs" is your commit being reapplied.

This reversal trips up nearly everyone, because it feels backwards during a rebase. The safe habit: don't rely on the words — look at the actual content in the markers and pick the right code. If you do use `-X ours`/`-X theirs`, mentally confirm which operation you're in first.

### Q8. What is `git merge --abort`?

It cancels an in-progress merge and restores your branch and working tree to exactly the state before you ran `git merge` — as if you never started.

```bash
git merge feature
# ...conflicts everywhere, you decide to bail
git merge --abort
```

Use it when the conflict surface is bigger or messier than expected, when you realise you're merging the wrong branch, or when you'd rather re-approach (e.g. rebase first, or merge in a different order). It relies on the recorded pre-merge state, so it's reliable as long as you haven't already committed the merge. (The rebase equivalent is `git rebase --abort`.)

### Q9. What are the `ours` and `theirs` merge strategies, and how do they differ from `-X ours`/`-X theirs`?

Two different levels, and mixing them up loses data:

- **`-s ours`** (strategy) — record a merge that keeps **our** tree *entirely*, discarding all of the other branch's content, while still adding it as a parent. Used to mark a branch as "merged/superseded" without taking its changes.
- **`-X ours` / `-X theirs`** (strategy *option* to the default `recursive`/`ort` strategy) — do a normal three-way merge, but on **conflicting hunks only**, auto-pick our (or their) side. Non-conflicting changes from both sides are still merged in.

```bash
git merge -s ours old-branch      # keep our tree, ignore theirs entirely
git merge -X theirs feature       # normal merge; on conflicts, prefer theirs
```

The trap: `-X theirs` applies to *every* conflict in the whole merge, so it can silently drop legitimate changes of yours. It's a bulk auto-resolver, not a per-file choice — reach for it only when you genuinely want one side to win every tie.

### Q10. What's the difference between `git merge` and `git merge --squash`?

| | `git merge feature` | `git merge --squash feature` |
|---|---|---|
| Merge commit? | Yes (or ff) | No |
| Parent link to feature? | Yes | **No** |
| Result | Histories tied together | Feature's changes as *staged edits* |
| You then run | Nothing / it commits | `git commit` yourself |

```bash
git merge --squash feature
git commit -m "Add login feature"   # one flat commit, no branch link
```

`--squash` collapses everything the feature did into your working index as a single set of changes; you author one new ordinary commit on the current branch. Because there's **no parent pointer** to the feature, the graph won't record that the branch was ever merged — `--merged` won't list it, and you can't revert it as a single merge. It's great for landing a messy topic branch as one clean commit, bad if you need the integration point preserved.

### Q11. What is an octopus merge?

A merge of **more than two branches in a single commit** — the resulting merge commit has three or more parents.

```bash
git merge feature-a feature-b feature-c
```

Git's default strategy can do this as long as **no conflicts** arise; the moment two of the branches conflict, the octopus strategy refuses and you fall back to merging them one at a time. In practice octopus merges are rare and mostly cosmetic (e.g. integration branches that batch several trivially-independent topics). Interviewers ask mainly to check you know a merge commit can have *N* parents, not just two — reinforcing that "merge commit = commit with 2+ parents."

### Q12. Textual vs semantic conflicts — what's the difference and why does it matter?

- **Textual conflict** — overlapping edits to the same lines; Git *detects* these and stops with markers.
- **Semantic conflict** — the merge applies with **zero textual conflicts** but the combined code is **logically broken**.

Classic example: branch A renames `getUser()` to `fetchUser()` and updates all its callers; branch B, in parallel, adds a new call to `getUser()`. Both hunks apply cleanly — different lines, no overlap — so Git reports success. But the merged code calls a function that no longer exists. It compiles-or-fails only when you build it.

The lesson: **Git merges text, not meaning.** A clean merge is necessary but not sufficient. This is the entire justification for CI running the test suite on the *merge result*, not just on each branch — semantic conflicts are invisible to Git and only tests, type-checkers, or compilation catch them.

### Q13. What does "Already up to date" mean when I merge?

It means the branch you're merging in is **already fully reachable** from your current branch — every one of its commits is already in your history — so there's nothing to integrate.

```bash
git merge feature
# Already up to date.
```

Common causes: you already merged it; or it's *behind* you and you meant to merge the other direction; or you forgot to `git fetch` and are merging a stale local view. If you *expected* changes, fetch first (`git fetch`) so your remote-tracking branches are current, then re-check with `git log --oneline main..feature` to see what (if anything) `feature` has that you don't.

### Q14. How do I inspect and revert merges after the fact?

```bash
git log --merges                 # show only merge commits
git log --oneline --graph        # visualise the branch topology
git show <merge-sha>             # see a merge commit's combined diff
```

To undo an already-committed merge you have two paths:

- **Not yet shared** — `git reset --hard HEAD~1` moves the branch back before the merge (rewrites history; fine locally).
- **Already pushed** — `git revert -m 1 <merge-sha>`. The `-m 1` says "keep the first parent's line as mainline and undo the merged-in side." Reverting a merge is safe on shared history because it adds a *new* commit rather than rewriting.

A well-known wrinkle: after reverting a merge, re-merging the same branch won't re-introduce the changes (Git thinks they're already present); you typically revert the revert or rebase the branch. Worth naming to show depth.

### Q15. How do you keep merge history clean on a team?

A few habits interviewers like to hear:

- **Integrate frequently** — long-lived branches accumulate conflicts and semantic drift; merge/rebase from `main` often to keep divergence small.
- **Pick a house policy and enforce it** — either `--no-ff` merges (feature bubbles you can revert as a unit) or rebase-then-`--ff-only` (flat linear history). Consistency beats the specific choice.
- **Keep merge commits meaningful** — don't litter history with "Merge branch 'main' into feature" noise; `git pull --rebase` avoids those.
- **Run tests on the merge result**, not just the branch, to catch semantic conflicts.
- **Small PRs** — smaller diffs conflict less and review faster.

### Q16. When would you choose merge over rebase (quick preview)?

Use **merge** when you want to **preserve the true history** — the fact that a feature branch existed and when it was integrated — and when the branch is **shared**, because merging never rewrites commits and is therefore always safe on public branches. Merge is also the right call for integrating long-lived release branches where the merge commit is a meaningful record.

```text
merge:   ...---o---o-------M      main   (M ties in the feature, 2 parents)
                  \       /
                   o---o          feature
```

Reach for **rebase** instead when you want a **clean, linear history** and the commits are **still private** (un-pushed or your own PR branch). The full comparison lives in the Rebasing topic — the one-line rule is: *merge preserves history and is safe on shared branches; rebase rewrites history for cleanliness and must stay off shared branches.*

### Q17. Give me the full merge-vs-rebase comparison.

| Aspect | Merge | Rebase |
|---|---|---|
| History | Preserves true topology (branches + merge commits) | Rewrites into a linear sequence |
| Commit SHAs | Unchanged | **New** SHAs (commits recreated) |
| Extra commit | Adds a merge commit (unless ff) | None — commits are replayed |
| Safe on shared branches? | **Yes** | **No** — violates the golden rule |
| Readability | Bushier graph, but honest | Clean, linear, easy `git log` / bisect |
| Conflict handling | Resolve once, at the merge | May resolve per replayed commit (rerere helps) |
| Traceability | "This came from a feature branch" is visible | That context is flattened away |
| Best for | Shared/long-lived branches, release integration | Local cleanup before sharing, linear-history teams |

The synthesis interviewers want: they're **not** competitors — mature teams use both. Rebase your *own local* work to tidy it before opening a PR; **merge** to integrate *shared* branches. The dividing line is the **golden rule of rebasing**: never rewrite commits that others may have based work on. (Full detail in the Rebasing topic.)

## Rebasing

### Summary

**What this topic covers**

Rebasing — the operation people fear until they understand it, then use daily. The core truth: **rebase does not move commits, it recreates them.** It replays your branch's commits one at a time onto a new base, producing **brand-new commits with new SHAs**, and re-points the branch at the new tip; the originals become unreachable (but reflog-recoverable). This topic covers the full **rebase vs merge** debate and comparison, `git rebase main` from a feature branch, the **golden rule** (never rebase commits that have left your machine and that others may have built on), per-commit **conflict resolution** during a rebase (`--continue`/`--skip`/`--abort`, and `rerere`), **`git pull --rebase`** for linear pulls, the powerful **`--onto`** for transplanting commit ranges, force-pushing safely with **`--force-with-lease`**, `--rebase-merges`, autosquash, the "rebase then merge `--ff`" PR workflow, and recovering from rebase disasters. 17 questions from "what does rebase actually do" to "I rebased and force-pushed over a teammate's work — fix it."

**Mental model**

Think of your feature branch as a **stack of patches** sitting on top of an old base. Merging says "tie my stack and the new mainline together with a knot (a merge commit)." Rebasing says "lift my stack off the old base and **re-apply each patch, in order, onto the new base**" — as if you'd started your work from the latest `main` all along. The consequence people miss: because a commit's identity (its SHA) is a hash of its content *and its parent*, changing the parent necessarily produces a **different commit**. Rebase therefore *rewrites* history — the old commits still exist in the object DB, orphaned, until GC. That single fact generates every rule about rebasing: it's why the result is a clean linear history (great for reading and `git bisect`), why conflicts can recur per commit (each patch reapplies against a slightly different context), and — above all — why you **must not** rebase commits others already have. Rewriting shared history means everyone else is now building on commits that, from your rewritten branch's view, no longer exist.

**Key terms**

- **rebase** — replay a branch's commits onto a new base, creating new commits and moving the branch pointer.
- **replay** — reapply each commit's *changes* as a fresh commit on top of the new base.
- **base / new base** — the commit your branch is (re)founded on; rebasing changes it.
- **golden rule** — never rebase/rewrite commits that have been pushed and that others may have based work on.
- **`git pull --rebase`** — fetch, then rebase local commits onto the updated upstream instead of a merge commit.
- **`--onto <newbase> <upstream> <branch>`** — transplant a *range* of commits onto an arbitrary base.
- **`--continue` / `--skip` / `--abort`** — after a conflict: proceed, drop this commit, or cancel the whole rebase.
- **rerere** — "reuse recorded resolution"; Git remembers how you resolved a conflict and re-applies it.
- **`--force-with-lease`** — safe force-push that refuses if the remote moved since you last fetched.
- **`--rebase-merges`** — rebase while preserving the branch's merge-commit structure.
- **autosquash** — auto-order `fixup!`/`squash!` commits during interactive rebase.
- **unreachable commit** — the pre-rebase originals; recoverable via reflog until GC.

**Why interviewers ask this**

Rebase is the single best discriminator between "uses Git" and "understands Git." The must-hit insight is that rebase **creates new commits** — candidates who say "it moves my commits" don't grasp the object model, and everything downstream (why SHAs change, why force-push is needed, why the golden rule exists) collapses without it. The golden rule is a professionalism check: rewriting shared history is how you ruin a teammate's afternoon, so knowing *when not to* rebase matters as much as knowing how. Senior signal is the recovery story — "I force-pushed over someone's work, here's how I restore it from the reflog / `--force-with-lease`" — plus fluency with `--onto` and `pull --rebase`. Interviewers also use merge-vs-rebase to see whether you hold a *nuanced* position (use both, context-dependent) rather than a tribal one.

**Common confusions**

- "Rebase moves my commits." No — it **copies** them into new commits with new SHAs; the originals are orphaned.
- "Rebase and merge produce the same result, just prettier." The *tree* can match, but the *history* differs fundamentally — linear vs branching, new SHAs vs preserved.
- "I can rebase anything as long as I'm careful." No — the golden rule is about *who else has the commits*, not care; shared history is off-limits regardless of skill.
- "Force-push is the same as `--force-with-lease`." No — plain `--force` clobbers unconditionally; `--force-with-lease` refuses if the remote advanced, protecting teammates' pushes.
- "A conflict during rebase means start over." No — resolve, `git add`, `git rebase --continue`; only `--abort` restarts.
- "`git pull` and `git pull --rebase` are interchangeable." They differ in history shape: merge commit vs linear replay.

**What follows from this topic**

Rebasing is the "rewrite for cleanliness" counterpart to **Merging**'s "preserve true history" — read them as a pair; the comparison table appears in both. The conflict mechanics here are the merge mechanics replayed per-commit, so the Merging topic's marker-reading skills transfer directly. **Interactive rebase** (squash/reword/reorder/drop) is its own topic and the natural next step — this topic is the non-interactive foundation. And the reflog/recovery thread runs into **Undoing changes & recovery**, since every "rebase disaster" is fixed the same way: find the pre-rebase SHA in the reflog and reset back to it.

### Q1. What does `git rebase` actually do to the object graph?

It **replays your commits onto a new base as brand-new commits** — it does *not* relocate existing commits. Walk through it: Git finds the commits unique to your branch, sets the branch aside, moves to the new base, then reapplies each commit's *changes* in order, creating a **new commit with a new SHA** each time (because a SHA hashes the content *and the parent*, and the parent changed). Finally it moves the branch pointer to the last new commit. The originals are now **unreachable** — still in the object database, orphaned, recoverable from the reflog until GC.

```text
before:            A---B---C        main
                        \
                         D---E       feature

git switch feature; git rebase main:

after:             A---B---C            main
                            \
                             D'---E'     feature   (D',E' are NEW commits)
```

`D'` and `E'` carry the same changes and messages as `D`/`E` but have different SHAs and a different parent. That "new commits" fact is the root of everything else about rebase.

### Q2. Rebase vs merge — what's the real difference?

Both integrate changes; they differ in **what they do to history**.

- **Merge** preserves the true topology: it adds a **merge commit** with two parents and leaves every original commit's SHA intact. History honestly shows the branch existed and when it was integrated. Always safe on shared branches.
- **Rebase** rewrites: it **recreates** your commits on a new base for a **linear** history with no merge bubbles. Cleaner to read and to `git bisect`, but the commits are new (new SHAs), so it must not touch shared history.

```text
merge:   A---B---C-------M     main
                  \     /
                   D---E       feature

rebase:  A---B---C---D'---E'   feature (linear on top of C)
```

Neither is universally right. Rule of thumb: **rebase private/local work to tidy it; merge to integrate shared branches.** The full table is in Q17 of the Merging topic and Q3 below.

### Q3. Give me the merge-vs-rebase decision table.

| Situation | Prefer |
|---|---|
| Branch already pushed / shared with others | **Merge** (rebasing rewrites shared history) |
| Local, un-pushed cleanup before opening a PR | **Rebase** |
| Team wants linear, bisectable history | **Rebase** (then ff-merge) |
| Team wants to see integration points / feature bubbles | **Merge** (`--no-ff`) |
| Integrating a long-lived release branch | **Merge** |
| Pulling upstream changes into a short local branch | **`pull --rebase`** |
| You've based work on the commits and pushed them | **Merge** — never rebase |

The one-liner: **rebase for a clean local history, merge for safe shared integration.** Mature teams do both; the boundary is the golden rule.

### Q4. How do I rebase my feature branch onto the latest main?

```bash
git switch feature
git fetch origin              # update main first
git rebase origin/main        # replay feature's commits on top of latest main
```

Now your feature commits sit on top of the current `main` as if you'd just started them — a clean, linear branch with no merge commit. Resolve any conflicts per commit as they arise (next question). If the branch was already pushed, finishing means a **`--force-with-lease`** push, because you've rewritten its commits:

```bash
git push --force-with-lease
```

This is the everyday "keep my PR up to date with main" flow, and the linear result makes the eventual review and merge cleaner than repeated `merge main` commits would.

### Q5. What is the golden rule of rebasing?

**Never rebase commits that have left your machine and that others may have based work on.** Concretely: don't rebase commits that are pushed to a shared branch (like `main` or a branch a colleague pulled).

Why: rebase **replaces** commits with new ones. If a teammate already has the originals and has built on them, your rewrite makes their base "disappear." When they next pull, Git sees two divergent histories, and reconciling it forces painful conflicts and often duplicated commits — you've effectively yanked the floor out from under them.

The safe exception is **your own** un-pushed work, or a **PR branch that's yours alone**, where rewriting is expected — you clean it up and push with `--force-with-lease`. The rule isn't "rebasing is dangerous"; it's "rewriting **shared** history is dangerous." Private history, rewrite freely.

### Q6. How do I resolve conflicts during a rebase?

Conflicts replay **per commit** — each replayed commit can independently conflict against the evolving new base.

```bash
git rebase origin/main
# CONFLICT in src/auth.js  (while applying commit D)
# ...edit the file, remove the <<<<<<< markers, choose the right result...
git add src/auth.js
git rebase --continue        # apply the next commit
```

At each stop you have three choices:

- **`git rebase --continue`** — after staging your resolution, proceed to the next commit.
- **`git rebase --skip`** — drop the commit currently being applied (e.g. it's now redundant).
- **`git rebase --abort`** — cancel entirely and restore the branch to its pre-rebase state.

Note the "ours/theirs" flip during rebase (ours = the base you're replaying onto, theirs = your commit) — read the content, not the labels.

### Q7. Why do I hit the *same* conflict repeatedly during a rebase, and how does rerere help?

Because rebase reapplies each of your commits in turn, a spot that conflicts in commit `D` can conflict *again* when the very next commit `E` touches the same region — you resolve "the same" clash multiple times as each patch lands. Long branches with overlapping edits make this painful.

**`rerere`** ("reuse recorded resolution") fixes it: Git records how you resolved a given conflict and, if it sees the *identical* conflict again, replays your resolution automatically.

```bash
git config --global rerere.enabled true
```

After enabling, the first time you resolve a conflict Git memorises it; subsequent identical conflicts (during this rebase, or a later re-do of it) get auto-resolved. It's a big quality-of-life win for repeated rebases and merge-heavy workflows.

### Q8. What is `git pull --rebase` and when should I use it?

Default `git pull` is `fetch` + **merge**, which — when you have local commits and the upstream advanced — creates a **merge commit** just to reconcile. `git pull --rebase` is `fetch` + **rebase**: it replays *your* local commits on top of the fetched upstream, keeping history **linear** and avoiding those noisy "Merge branch 'main'" commits.

```bash
git pull --rebase
# or make it the default:
git config --global pull.rebase true
git config --global branch.autoSetupRebase always
```

Use it for the common case of "I have a couple of local commits, someone else pushed, I want to catch up." Caveat: it rewrites *your local un-pushed* commits (fine) — it never rewrites the shared upstream, so it doesn't violate the golden rule. Many teams set `pull.rebase true` globally for exactly this cleanliness.

### Q9. What does `git rebase --onto` do?

`--onto` lets you **transplant a specific range of commits onto an arbitrary new base** — the precise, surgical form of rebase. The shape is:

```bash
git rebase --onto <newbase> <upstream> <branch>
```

It takes the commits in `<branch>` that are *not* in `<upstream>` and replays them onto `<newbase>`. The classic use: you branched `feature` off the *wrong* parent (say `wip`) and want it based on `main` instead, without dragging `wip`'s commits along.

```text
before:  main---o
              \
       wip----o---o
                   \
            feature o---o

git rebase --onto main wip feature

after:   main---o---o'---o'    feature   (only feature's own commits, now on main)
```

`<upstream>` here (`wip`) defines the *lower cut* — "start replaying after these" — and `<newbase>` (`main`) is where they land. It's the tool for moving a feature off a mistaken parent or extracting a sub-range of commits.

### Q10. I rebased and lost commits — how do I get them back?

The pre-rebase commits are **unreachable, not deleted**, and the reflog remembers exactly where your branch was before the rebase:

```bash
git reflog
# ... 9a3f21c HEAD@{4}: rebase (start): checkout origin/main
#     b2c1d0e HEAD@{5}: commit: the state BEFORE the rebase   <- this one
git reset --hard b2c1d0e     # restore the branch to its pre-rebase tip
```

`HEAD@{n}` also works directly (`git reset --hard HEAD@{5}`). Because rebase orphans the originals rather than destroying them, and reflog entries persist for weeks before GC, recovery is reliable. This is *the* reason to stay calm about rebasing your own work: the safety net is always there.

### Q11. Why does rebasing make `git bisect` and code review nicer?

Because it produces **linear, self-contained, logically-ordered commits** with no merge bubbles.

- **`git bisect`** does binary search over history to find the commit that introduced a bug. A linear chain of clean commits bisects cleanly; a graph tangled with merge commits and half-finished intermediate states muddies the search (a merge commit may not even build). Rebased history means every step is a coherent snapshot to test.
- **Review** reads top-to-bottom as a tidy story — "add model, add service, add endpoint, add tests" — instead of interleaved WIP commits and "merge main" noise. Reviewers follow intent, not plumbing.

That readability is the main *positive* argument for rebasing, weighed against the cost of rewriting history.

### Q12. What's the difference between `--force` and `--force-with-lease` when pushing after a rebase?

After rebasing a pushed branch you *must* force-push (the remote's history diverged from your rewritten one). The choice is *how*:

- **`git push --force`** — overwrite the remote branch **unconditionally**. If a teammate pushed after your last fetch, you silently **destroy their commits**.
- **`git push --force-with-lease`** — overwrite **only if** the remote is still where you last saw it. If someone pushed in the meantime, Git **refuses**, protecting their work.

```bash
git push --force-with-lease
```

Always prefer `--force-with-lease`. It gives you the rewrite you need on your own branch while catching the exact "I clobbered a teammate" disaster that plain `--force` causes. Treat unqualified `--force` on any shared-ish branch as a code smell.

### Q13. I force-pushed after a rebase and clobbered a teammate's commits — how do I recover?

Stay calm; the commits almost certainly still exist somewhere.

1. **On the teammate's machine** — their local branch still has the originals. They (or you, via their clone) can find them: `git reflog` / `git log`, note the SHA, and push it back (or open a fresh branch from it).
2. **On the server** — many hosts keep reflogs or a recovery window; the ref's prior SHA may be retrievable via the platform (e.g. the branch's activity/audit log) and re-pushed.
3. **From CI or any other clone** — any environment that fetched before your force-push still holds the objects; fetch from there.

Then reconcile: create a branch at the recovered SHA, merge/cherry-pick the lost commits back, and re-push (with `--force-with-lease`). The prevention lesson to state explicitly: **use `--force-with-lease`, and don't rewrite shared branches** — this whole incident is the golden rule being violated.

### Q14. What is `git rebase --rebase-merges`?

By default, rebasing **flattens** your history — it replays individual commits and *discards* any merge commits in the range, so a branch that had internal merges comes out linear. `--rebase-merges` instead **recreates the merge structure** on the new base, preserving the branch topology you built.

```bash
git rebase --rebase-merges origin/main
```

Use it when your feature branch deliberately contains meaningful merges (e.g. you integrated a sub-topic) and you want to move the whole shape onto a newer base without losing those integration points. It replaced the older `--preserve-merges`. It's an advanced option — most day-to-day rebases *want* the flattening — but it's the right tool when the merge structure itself carries meaning.

### Q15. What is autosquash and how does it speed up cleanup?

Autosquash automates folding "fix a previous commit" commits into their targets during an interactive rebase. You mark a fixup while committing:

```bash
git commit --fixup=<sha>     # message becomes "fixup! <original subject>"
# ...later...
git rebase -i --autosquash origin/main
```

With `--autosquash`, Git automatically **reorders** each `fixup!`/`squash!` commit to sit right after its target and pre-marks it `fixup`/`squash` in the todo list — so you just save and the corrections melt into the right commits. Enable it permanently with `git config --global rebase.autosquash true`. It's the clean way to address review feedback: commit small `--fixup` corrections as you go, then one autosquash rebase produces a tidy final history. (This overlaps with the Interactive Rebase topic, where the todo-list editing lives.)

### Q16. Explain the "rebase then merge --ff" PR workflow.

A common house style for keeping `main` perfectly linear:

1. Develop on `feature`, committing freely.
2. Before merging, **rebase onto latest main** so the feature sits directly on top of `main`'s tip:
   ```bash
   git fetch origin && git rebase origin/main
   git push --force-with-lease
   ```
3. Merge with **fast-forward only** — since the feature is now a direct descendant of `main`, no merge commit is needed:
   ```bash
   git switch main
   git merge --ff-only feature
   ```

The payoff: `main`'s history is a single straight line of feature commits, no merge bubbles, trivially bisectable and readable. Many Git hosts implement this as a "Rebase and merge" button. The tradeoff is the usual one — you lose the explicit "this was a PR" merge marker, and contributors must keep rebasing, which means force-pushing their own branches.

### Q17. What are common rebase disasters and how do you recover?

| Disaster | Cause | Recovery |
|---|---|---|
| Lost commits after a rebase | Rebase orphaned the originals | `git reflog` → `git reset --hard HEAD@{n}` |
| Clobbered a teammate's push | Rebased shared history + `git push --force` | Recover SHA from their clone/CI/server reflog; re-push; use `--force-with-lease` next time |
| Endless repeated conflicts | Overlapping edits replayed per commit | Enable `rerere`; consider squashing first, or merge instead |
| Rebase went sideways mid-way | Wrong base / too ambitious | `git rebase --abort` to restore the starting state |
| Duplicated commits after pull | Rebased commits others already merged | Reset to the pre-rebase point; merge instead of rebase |

The unifying insight: **almost every rebase disaster is recoverable because rebase only ever orphans commits — it never deletes them.** The reflog is the universal escape hatch (`git reset --hard HEAD@{n}`), and mid-operation `git rebase --abort` undoes a rebase in progress. Prevention is cheaper than recovery: obey the golden rule and always force-push with `--force-with-lease`.
## Remotes & Collaboration

### Summary

**What this topic covers**

How your local repository talks to the rest of the world. Git is *distributed* — every clone is a complete repository with full history — so "the server" is not special; it is just another repo you happen to sync with. This topic covers what a **remote** is (a named URL pointing at another copy of the repo), **cloning**, and the four verbs that move data between repos: **`git fetch`** (download, don't touch your work), **`git pull`** (fetch + integrate), **`git push`** (upload), and the remote-tracking branches (`origin/main`) that cache the remote's state locally. It covers the *safety and social* side too: why a push gets rejected as "non-fast-forward", why `--force` clobbers teammates and `--force-with-lease` protects them, and the two dominant collaboration models — shared-repo-with-branches vs fork-and-pull-request. The 16 questions run from "what is `origin`" to "recover from a force-push that clobbered a teammate". Get the fetch-vs-pull distinction crisp; it is the single most common remote question.

**Mental model**

Picture three repos, not two. There is *the remote* (a bare repo on a server), *your local repo*, and — living inside your local repo — a set of **remote-tracking branches** like `origin/main` that are a read-only snapshot of what the remote looked like the last time you talked to it. Nothing crosses the network except when you explicitly `fetch`, `pull`, `push`, or `clone`. `fetch` updates your `origin/*` snapshot and downloads the objects behind it; it never changes your working branches, so it is always safe. Integrating that fetched work into your own branch — via merge or rebase — is a *separate, local* step. `pull` just bundles those two steps (`fetch` then `merge`/`rebase`) into one command, which is why experienced engineers often prefer `fetch` + look + integrate: you see what arrived before it rewrites your branch. A push is the mirror image: you upload commits so the remote's branch fast-forwards to include them.

**Key terms**

- **remote** — a named alias for another repo's URL (`origin` by convention). `git remote -v` lists them.
- **origin** — the conventional name for the remote you cloned from; nothing magic, just a default.
- **clone** — copy an entire repo (all objects + history), set up `origin`, create remote-tracking branches, and check out the default branch.
- **fetch** — download new objects and update remote-tracking branches; does NOT touch your working branches. Non-destructive.
- **pull** — `fetch` + integrate (`merge` by default, or `rebase` with `--rebase`) into the current branch.
- **push** — upload local commits and move the remote branch to point at them.
- **remote-tracking branch** — `origin/main`: a local, read-only cache of the remote branch's position at last fetch.
- **upstream / tracking branch** — the remote branch your local branch is linked to; drives ahead/behind counts and bare `git pull`/`push`.
- **fast-forward** — moving a branch pointer straight forward with no merge commit, possible only when there is nothing to reconcile.
- **fork** — a server-side copy of someone else's repo under your account; the basis of the pull-request OSS workflow.
- **--force-with-lease** — a safer force-push that refuses if the remote moved since your last fetch.

**Why interviewers ask this**

Remotes separate people who have only ever `git pull`ed on a solo project from people who have collaborated on a team. The tell is the fetch-vs-pull answer: a junior says "they both get changes"; a senior explains that `fetch` is non-destructive and `pull` mutates your current branch, and knows when they want the split. The force-push question is a values question as much as a knowledge one — do you reach for `--force` (clobbers teammates) or `--force-with-lease` (respects them)? And "rejected non-fast-forward" is the single most common real-world Git error; explaining *why* it happens (the remote has commits you don't) proves you understand that a branch is a pointer and pushing must fast-forward.

**Common confusions**

- "`origin` is a special/magic name" — no, it is just the default alias `clone` picks; you can rename it or have many remotes.
- "`git pull` and `git fetch` are the same" — `fetch` never changes your branch; `pull` merges/rebases into it.
- "`origin/main` is my branch" — it is a read-only cache of the remote; you don't commit onto it, `fetch` updates it.
- "Force-push is how you fix a rejected push" — usually the opposite; the fix is fetch + integrate, then a normal push.
- "`--force` and `--force-with-lease` are interchangeable" — the lease variant refuses to overwrite work you haven't seen; plain `--force` is blind.
- "A fork is a Git feature" — forking is a GitHub/GitLab server operation; Git itself just sees another remote.

**What follows from this topic**

Remotes are where the Undoing Changes topic gets its sharpest rule: once a commit is *pushed*, prefer `revert` over history rewrites, and never plain-force a shared branch. The tracking relationship here feeds branching and merge/rebase workflows; the fork + `upstream` pattern is the foundation for the pull-request and open-source collaboration topics. And the reflog (a later topic) is what saves you when a force-push goes wrong.

### Q1. What is a "remote" in Git, and what is `origin`?

A **remote** is a named reference to another copy of the repository — almost always a URL (HTTPS or SSH). It is a bookmark so you don't retype the URL on every `fetch`/`push`.

**`origin`** is just the conventional name Git gives to the remote you cloned from. There is nothing special about the word; you could rename it. You can have as many remotes as you like (e.g. `origin` = your fork, `upstream` = the canonical repo).

```bash
git remote -v                 # list remotes + their fetch/push URLs
git remote add upstream <url> # add a second remote named "upstream"
git remote rename origin old  # rename
git remote remove old         # delete
git remote show origin        # detailed view: URLs, tracked branches, ahead/behind
```

Because Git is distributed, a remote is not "the server" in any privileged sense — it is just another full repo you happen to sync with.

### Q2. What does `git clone` actually do?

`git clone <url>` does several things in one shot:

1. Creates a new directory and initializes a repo in it.
2. Downloads **all objects and the full history** (every commit, tree, blob) — a clone is a complete repo, not a shallow snapshot.
3. Adds the source as a remote named **`origin`**.
4. Creates **remote-tracking branches** for the remote's branches (`origin/main`, `origin/dev`, …).
5. Checks out the default branch (e.g. `main`) and sets it to *track* `origin/main`.

```bash
git clone <url>                 # full clone
git clone --depth 1 <url>       # shallow: only the latest commit (CI, faster)
git clone --branch dev <url>    # check out a specific branch
```

The key interview point: because you get the whole history, you can commit, branch, diff, and view log entirely offline. Only `fetch`/`pull`/`push` need the network.

### Q3. What is the difference between `git fetch` and `git pull`?

This is the most common remotes question. Get it crisp.

| | `git fetch` | `git pull` |
|---|---|---|
| Network | Downloads new objects | Downloads new objects |
| Updates `origin/*` | Yes | Yes |
| Touches your branch | **No** | **Yes** — merges or rebases into it |
| Working directory | Unchanged | Can change / conflict |
| Safe / reversible | Always | Can create merge commits or conflicts |

**`git fetch`** downloads new commits and updates your remote-tracking branches (like `origin/main`) but leaves *your* branches and working directory untouched. It is always safe.

**`git pull`** is `fetch` **plus** an integration step — by default a `merge` of `origin/main` into your current branch (or a `rebase` with `--rebase`).

```bash
git fetch origin              # download, review before integrating
git log HEAD..origin/main     # see what fetch brought in
git merge origin/main         # then integrate deliberately
# vs the one-shot:
git pull                      # fetch + merge
git pull --rebase             # fetch + rebase (linear history)
git pull --ff-only            # only fast-forward; refuse if a merge is needed
```

Many engineers prefer `fetch` then review then integrate, precisely because `pull` mutates your branch before you've seen what arrived.

### Q4. What does `git push` do, and what does "rejected — non-fast-forward" mean?

`git push` uploads your local commits and moves the remote branch pointer to include them.

```bash
git push origin main
git push -u origin feature/login   # -u sets upstream so future push/pull need no args
```

A **"rejected: non-fast-forward"** error means the remote branch has commits you don't have locally — your push would require the remote to *move backward or sideways*, discarding those commits. Git refuses.

```
remote: A---B---C   (origin/main — someone pushed C)
local:  A---B---D   (your main — you committed D)
```

Your `D` can't fast-forward `origin/main` because `C` is in the way. The correct fix is **not** `--force` (that would delete `C`). Instead:

```bash
git fetch origin
git rebase origin/main    # replay D on top of C  → A-B-C-D'
# or: git merge origin/main
git push                  # now fast-forwards cleanly
```

### Q5. What is a remote-tracking branch (like `origin/main`)?

`origin/main` is a **local, read-only pointer** that records where the remote's `main` was *the last time you fetched*. It lives in your repo (under `refs/remotes/origin/`), not on the server.

- You do **not** commit onto it or check it out to work — if you do, you land in detached HEAD.
- It only moves when you `fetch`/`pull` (updating the cache) or `push` (after the remote accepts).
- It is what lets Git compute "ahead 2, behind 3": it compares your branch to this cached snapshot.

```bash
git branch -r                 # list remote-tracking branches
git log origin/main           # inspect the last-fetched remote state
git checkout -b fix origin/main   # start a new local branch from it
```

Think of it as your best *offline* guess of the remote's state — accurate as of your last fetch, possibly stale after.

### Q6. What is an upstream (tracking) branch and how do you set it?

An **upstream** is the remote branch your local branch is linked to. Once linked, bare `git push`/`git pull` know where to go, and `git status` shows "ahead N / behind M".

```bash
git push -u origin feature/login   # push AND set upstream in one go
git branch --set-upstream-to=origin/main   # link an existing branch
git branch -vv                     # show each branch's upstream + ahead/behind
git status                         # "Your branch is ahead of 'origin/main' by 2 commits"
```

**Ahead** = local commits not yet pushed. **Behind** = remote commits not yet pulled. "Ahead 2, behind 3" means you both diverged — you'll need to merge or rebase before pushing.

### Q7. What is the difference between `git push --force` and `--force-with-lease`?

Both overwrite the remote branch with your version, discarding remote commits that aren't in your history. The difference is safety.

- **`--force`** — blind. It overwrites the remote no matter what, even if a teammate pushed something you've never seen. Their commit is gone from the branch.
- **`--force-with-lease`** — checks first. It refuses the push if the remote branch has moved since your last fetch — i.e. if there's work you haven't seen. Only if the remote is exactly where you expect does it overwrite.

```bash
git push --force-with-lease origin feature/login
```

The golden rule: after a rebase or amend on a branch *only you* use, force-push with **`--force-with-lease`**. Never plain-`--force` a shared branch. The lease turns "I clobbered my teammate's commit" into a harmless rejection. (Note: always `fetch` right before, or a stale lease can still let a blind overwrite through if your remote-tracking ref is up to date but you fetched *their* work into it.)

### Q8. Walk me through the two main collaboration models.

**Shared-repository (team/company):** everyone has push access to one repo. You branch, push your branch, open a merge request, get review, merge to `main`. Simple, tight-knit.

```bash
git checkout -b feature/login
# ... work ...
git push -u origin feature/login   # open a PR/MR from this branch
```

**Fork + pull request (open source):** you don't have write access to the canonical repo, so you **fork** it (a server-side copy under your account), clone your fork, add the original as `upstream`, push branches to *your* fork, and open a PR asking the maintainers to pull.

```bash
git clone <your-fork-url>            # origin = your fork
git remote add upstream <orig-url>   # upstream = canonical repo
git fetch upstream                   # keep in sync
git rebase upstream/main             # update your branch onto latest
git push origin feature/login        # push to YOUR fork, then open PR
```

Shared-repo trusts contributors with write access; fork-and-PR lets anyone contribute without it. Both funnel through review before landing on `main`.

### Q9. How do you keep a fork in sync with the original ("upstream") repo?

Add the canonical repo as a second remote called `upstream`, then fetch and rebase (or merge) onto it periodically.

```bash
git remote add upstream <original-repo-url>   # one time
git fetch upstream                            # get its latest
git checkout main
git merge upstream/main        # or: git rebase upstream/main
git push origin main           # update your fork's main
```

`origin` stays your fork (where you push); `upstream` is read-only-for-you (where you pull the latest). Rebasing feature branches onto `upstream/main` before opening a PR keeps them mergeable and gives maintainers a clean, conflict-free diff.

### Q10. How do you push a new branch, and delete a remote branch?

```bash
# create locally, publish, and set upstream in one command:
git push -u origin feature/login

# delete a remote branch (two equivalent forms):
git push origin --delete feature/login
git push origin :feature/login       # older "push nothing to that ref" syntax
```

Deleting the remote branch does **not** delete your local copy — do that separately with `git branch -d feature/login`. On most hosts, merging a PR offers to delete the remote branch for you.

### Q11. My teammate deleted a branch on the server, but I still see it in `git branch -r`. How do I clean that up?

Deleted-on-remote branches leave **stale remote-tracking references** in your repo until you prune them. `fetch` alone adds new refs but doesn't remove gone ones by default.

```bash
git fetch --prune              # fetch AND delete stale origin/* refs
git remote prune origin        # prune only, no fetch
git fetch -p                    # shorthand
```

You can make pruning automatic:

```bash
git config --global fetch.prune true
```

This only touches remote-tracking refs (`origin/*`); your local branches are never pruned by these commands.

### Q12. What transport protocols can remotes use, and how does authentication work?

The two you'll meet in interviews:

- **HTTPS** (`https://host/acme/repo.git`) — works everywhere, easy through firewalls. Auth via a **credential helper** caching a username + **Personal Access Token** (PATs replaced passwords on most hosts).
- **SSH** (`git@host:acme/repo.git`) — auth via an SSH key pair; you register the public key with the host. No token typing per push.

```bash
git config --global credential.helper osxkeychain   # cache HTTPS creds (macOS)
git remote set-url origin git@host:acme/repo.git     # switch HTTPS → SSH
```

Also worth knowing: **deploy keys** (a single-repo SSH key, often read-only, for CI/servers) and that PATs/keys should be scoped minimally and rotated. There are also `git://` (unauthenticated, insecure — rare now) and local `file://` remotes.

### Q13. How can a repo have multiple remotes, and why would you want that?

A branch can be pushed/pulled to any number of remotes. Common reasons:

- **Fork workflow** — `origin` = your fork, `upstream` = canonical repo.
- **Mirroring** — push to both GitHub and an internal GitLab for redundancy.
- **Migrating hosts** — add the new host as a remote and push everything across.

```bash
git remote add upstream <url>
git remote add backup <other-url>
git push backup main
git fetch --all                 # fetch from every remote at once
```

Each remote maintains its own set of remote-tracking branches (`origin/main`, `upstream/main`, …), so you can compare them: `git log upstream/main..origin/main`.

### Q14. What is the difference between `git remote update`, `git fetch`, and `git fetch --all`?

- **`git fetch`** — fetches from a single remote (default `origin`, or the current branch's upstream remote).
- **`git fetch --all`** — fetches from *every* configured remote.
- **`git remote update`** — older command that also fetches from all remotes (roughly equivalent to `fetch --all`).

```bash
git fetch                # just origin
git fetch upstream       # just upstream
git fetch --all --prune  # all remotes, and drop stale refs
```

All are non-destructive: they only update remote-tracking branches. Nothing here touches your working branches or files.

### Q15. What does it mean to "mirror" a repository, and when would you use `git clone --mirror`?

A **mirror** is a bare clone that copies *all* refs (branches, tags, notes, and remote refs) and keeps them exactly in sync — no working directory, nothing checked out.

```bash
git clone --mirror <src-url>
cd repo.git
git remote set-url --push origin <dest-url>
git push --mirror                 # push every ref to the new host
```

Use it to **migrate a repo between hosts** or maintain a backup/read replica. Unlike a normal clone, `--mirror` maps refs one-to-one and `push --mirror` will *delete* refs on the destination that no longer exist on the source — so it's a true mirror, not an additive copy. That deletion behavior is exactly why you don't point `--mirror` pushes at a shared repo people are working in.

### Q16. Walk me through a typical clone → branch → push → pull-request flow.

```bash
# 1. Get the repo
git clone <url>
cd repo

# 2. Branch off the latest main
git checkout main
git pull --ff-only              # ensure up to date
git checkout -b feature/login

# 3. Work and commit
git add -p
git commit -m "Add login form"

# 4. Publish the branch (sets upstream)
git push -u origin feature/login

# 5. Open a PR/MR in the host UI (origin's branch → main)

# 6. Address review; someone merged other work into main meanwhile:
git fetch origin
git rebase origin/main          # replay your commits on the latest main
git push --force-with-lease     # update your branch safely after rebase

# 7. PR approved → merge (often "Squash and merge") → delete branch
git checkout main
git pull --ff-only
git branch -d feature/login
```

The two senior touches: `--ff-only` so a stale local `main` never silently creates a merge commit, and `--force-with-lease` after the rebase so you never clobber a teammate.

## Undoing Changes

### Summary

**What this topic covers**

The commands for taking things back — and the judgment about *which* one is safe *when*. This is one of the most heavily tested areas in Git interviews because it's where people get burned in real life. The core of it is a three-way distinction that candidates constantly blur: **`git reset`** moves the branch pointer (and optionally the index and working directory) — it *rewrites where the branch points*, so it's for **local, un-pushed** work; **`git revert`** creates a *new* commit that undoes an old one **without changing history** — the safe move on **shared/pushed** branches; and **`git restore`/`git checkout`** change files in the working directory or index **without moving the branch** at all. The 17 questions drill the three `reset` modes (`--soft`/`--mixed`/`--hard`) with a comparison table, the everyday recipes (unstage a file, undo the last commit but keep changes, discard edits, amend), the dangerous ones (`reset --hard`, `git clean -fd`), reverting merges, and — crucially — recovering when you overshoot, via the reflog.

**Mental model**

Git has three trees you're always shuffling data between: the **working directory** (your files), the **index/staging area** (what `commit` will snapshot), and **HEAD** (the last commit on the current branch). Every undo command is really "which of these three do I want to change?" `reset` operates on the *branch pointer and, optionally, index and working dir*, moving them backward. `restore`/`checkout` operate on *files* (working dir and/or index) and leave the branch pointer alone. `revert` operates *forward* — it doesn't move anything backward; it adds a new commit whose content is the inverse of a prior one. The other axis is **have you pushed?** If a commit is still private, rewriting history with `reset`/`amend`/`rebase` is fine. Once it's shared, rewriting it yanks the ground out from under everyone who pulled it — so you *add* an undoing commit with `revert` instead. Master those two axes (which tree / pushed or not) and every undo command falls into place.

**Key terms**

- **reset** — move the current branch pointer; `--soft`/`--mixed`/`--hard` decide whether index and working dir move too.
- **--soft** — move HEAD only; index and working dir untouched (changes stay staged).
- **--mixed** (default) — move HEAD and reset the index; working dir untouched (changes become unstaged edits).
- **--hard** — move HEAD, reset index AND working dir; uncommitted changes are **discarded**.
- **revert** — create a new commit that applies the inverse of a target commit; history is preserved.
- **restore** — modern command to restore files in the working dir and/or index (`--staged` to unstage).
- **checkout (files)** — legacy way to discard working-dir changes / switch files; `switch`/`restore` split its roles.
- **amend** — replace the last commit with a new one (`git commit --amend`); rewrites that commit's hash.
- **clean** — delete *untracked* files/dirs (`git clean -fd`); not undoable via reset.
- **reflog** — the log of where HEAD has been; how you recover after an overshot reset/amend/rebase.
- **HEAD~1 / HEAD^** — the commit before HEAD (its first parent).

**Why interviewers ask this**

Undoing is where confident-sounding candidates reveal whether they actually understand Git's model or just memorized commands. The signature question — "difference between `reset` and `revert`?" — separates people who know *revert is safe on shared history and reset is not* from people who'll one day force-push a rewritten `main` and take down the team. The `reset --soft/--mixed/--hard` breakdown tests whether you understand the three trees. And the scenario questions ("I committed to the wrong branch", "I `reset --hard` and lost work", "I need to undo a pushed commit") test judgment under pressure — the exact judgment that prevents a two-hour outage. A senior answer always flags the data-loss and shared-history hazards *before* running the command.

**Common confusions**

- "`reset` and `revert` do the same thing" — `reset` moves the pointer back (rewrites history); `revert` adds a new inverse commit (preserves history).
- "`reset --hard` is how you unstage" — no, that *deletes your edits*; use `git restore --staged` (or `reset` with no `--hard`) to unstage.
- "`reset --hard` loses work forever" — the commits are usually still in the reflog for ~90 days; `reset --hard` on *uncommitted* work, though, is genuinely gone.
- "`git checkout file` is safe" — it silently discards your working-dir edits to that file. Data loss, no confirmation.
- "`git clean` can be undone with reset" — no; `clean` deletes *untracked* files that were never in Git, so there's nothing to recover.
- "You can `revert` a merge like any commit" — you must pick a parent with `-m`, and reverting a merge has a re-merge gotcha (see the merge revert question).

**What follows from this topic**

This topic's shared-vs-private rule is the same golden rule that governs rebase and force-push in the Remotes and Rebase topics — rewriting is fine privately, dangerous publicly. `reset --hard origin/main` ties back to remote-tracking branches. And every "I overshot" recovery here routes through the **reflog**, which the Stashing & the Reflog topic covers in full — the reason you can be bold with local undo is that the reflog almost always has your back.

### Q1. What is the difference between `git reset`, `git revert`, and `git restore`/`git checkout`?

They answer three different questions.

| Command | What it moves | History | Use on |
|---|---|---|---|
| `git reset` | The **branch pointer** (± index/working dir) | Rewrites (moves back) | **Local, un-pushed** commits |
| `git revert` | Nothing back — adds a **new commit** | Preserves (adds forward) | **Shared/pushed** commits |
| `git restore` / `checkout` | **Files** in working dir/index | Unchanged | Discarding edits / unstaging |

- **`reset`** — "move `main` back to an earlier commit." Good for cleaning up local history before pushing. Dangerous on shared branches.
- **`revert`** — "make a new commit that undoes commit X." History stays intact, so it's safe after you've pushed. Everyone just gets one more commit.
- **`restore`/`checkout`** — "change my files, leave the branch alone." Unstage, or throw away working-directory edits.

The decision tree: *Have I pushed?* If yes → `revert`. If no and I want to move the branch → `reset`. If I just want to fix files → `restore`.

### Q2. Explain the three modes of `git reset`: `--soft`, `--mixed`, and `--hard`.

All three move HEAD (the branch pointer). They differ in what *else* they reset.

| Mode | Moves HEAD | Resets index | Resets working dir | Net effect |
|---|---|---|---|---|
| `--soft` | Yes | No | No | Changes stay **staged** |
| `--mixed` (default) | Yes | Yes | No | Changes become **unstaged edits** |
| `--hard` | Yes | Yes | Yes | Changes **discarded** (data loss) |

```bash
git reset --soft HEAD~1    # uncommit, keep everything staged (great for squashing)
git reset --mixed HEAD~1   # uncommit + unstage, keep the edits in your files
git reset HEAD~1           # same as --mixed (the default)
git reset --hard HEAD~1    # uncommit AND throw away the changes entirely
```

Mental picture: `--soft` peels back only the commit; `--mixed` peels back the commit and the staging; `--hard` peels back the commit, the staging, *and* your file edits. Only `--hard` loses uncommitted work.

### Q3. I committed too early. How do I undo the last commit but keep my changes?

Use a **soft** (or mixed) reset — never `--hard`.

```bash
git reset --soft HEAD~1    # commit undone; all changes still staged, ready to re-commit
git reset HEAD~1           # commit undone; changes now unstaged (mixed, the default)
```

`--soft` leaves everything exactly as it was the instant before you committed, just staged. `--mixed` is the same but unstages, so you can `add -p` selectively. Pick `--soft` if you'll just re-commit, `--mixed` if you want to re-split the changes.

If you only need to fix the *message* or add one more file, `git commit --amend` is cleaner than a reset.

### Q4. How do I unstage a file I've `git add`ed but not committed?

You want to move it out of the index while keeping your edits. Modern and legacy forms:

```bash
git restore --staged file.txt    # modern (Git 2.23+)
git reset HEAD file.txt          # classic equivalent
```

Both leave your working-directory edits intact — they only undo the staging. `git status` even prints the `restore --staged` hint under "Changes to be committed". Note this does *not* discard your changes; it just un-adds them.

### Q5. How do I discard uncommitted changes to a file in my working directory?

This *does* lose data — the edits are thrown away with no confirmation.

```bash
git restore file.txt             # modern: discard working-dir edits to file
git checkout -- file.txt         # legacy equivalent
git restore .                    # discard ALL working-dir edits (careful)
```

If the file is also staged, `git restore file.txt` only reverts the working copy; add `--staged --worktree` to reset both:

```bash
git restore --staged --worktree file.txt   # unstage AND discard edits
```

There is no reflog for uncommitted working-directory changes, so once discarded they're gone. Consider `git stash` instead if you might want them back.

### Q6. A bad commit is already pushed to a shared branch. How do I undo it safely?

Use **`git revert`**, not `reset`. Reverting creates a *new* commit that applies the inverse changes, so history stays intact and nobody's clone breaks.

```bash
git revert <bad-sha>     # opens an editor for the auto-generated message
git push                 # normal push, no force needed
```

```
A---B---C---D          before  (D is bad, already pushed)
A---B---C---D---D'      after   (D' undoes D; history preserved)
```

Because you *added* a commit rather than *rewriting* one, everyone who pulls just gets `D'` on top — no forced updates, no "your history diverged" pain. This is the golden rule: **rewrite private history, revert public history.**

### Q7. What's the difference between `git commit --amend` and a soft reset?

Both let you redo the last commit, but at different granularity.

**`git commit --amend`** — replaces the last commit in place. Great for fixing the message or adding a forgotten file:

```bash
git commit --amend -m "Better message"     # reword
git add forgotten.txt && git commit --amend --no-edit   # add a file, keep message
```

**`git reset --soft HEAD~1`** — removes the commit entirely, leaving its changes staged, so you can re-commit however you like (split it, combine it, re-order).

Amend is a scalpel for the single last commit; soft reset is for restructuring. Both **rewrite the commit's hash**, so if you've already pushed, you'd need `--force-with-lease` — which means don't do either on a shared branch.

### Q8. How do I remove a file from the last commit without losing the file?

Two moves: unstage it from the commit, then amend.

```bash
git reset --soft HEAD~1          # uncommit, keep everything staged
git restore --staged secret.env  # unstage just that file
git commit -c ORIG_HEAD          # re-commit the rest, reusing the old message
```

Or, more directly, remove it from the index and amend:

```bash
git rm --cached secret.env       # stop tracking it, keep it on disk
git commit --amend --no-edit     # rewrite the last commit without it
```

`--cached` is the key flag — it drops the file from Git but leaves it in your working directory. (If the file was a secret, also add it to `.gitignore`, and remember it's still in older commits — you'd need `filter-repo` to purge history.)

### Q9. How do I get back a single file as it was in an earlier commit?

Restore just that path from a chosen commit, without moving your branch or touching other files.

```bash
git restore --source=HEAD~2 file.txt   # file as of 2 commits ago (modern)
git checkout HEAD~2 -- file.txt        # legacy equivalent
git restore --source=<sha> file.txt    # from any specific commit
```

This overwrites your working copy of `file.txt` with the old version and (with `--staged` too) stages it. Your branch pointer and every other file stay put — it's a targeted file recovery, not a history rewind.

### Q10. What does `git clean` do, and why is it dangerous?

`git clean` deletes **untracked** files — files Git has never recorded. Because they were never committed, **there is nothing in the reflog to recover them**; deletion is permanent.

```bash
git clean -n         # DRY RUN — always do this first; lists what would be deleted
git clean -f         # delete untracked files
git clean -fd        # also delete untracked directories
git clean -fdx       # also delete ignored files (build artifacts, node_modules…)
```

Always run `-n` (or `-i` for interactive) before `-f`. Unlike `reset --hard` (which only affects *tracked* files and whose commits survive in the reflog), `clean` reaches files Git has no record of — so once they're gone, they're gone. This is the most genuinely irreversible undo command in Git.

### Q11. How do you revert a merge commit, and what's the gotcha?

A merge commit has two parents, so `git revert` can't guess which side to undo — you must name the *mainline* parent with `-m`.

```bash
git revert -m 1 <merge-sha>    # -m 1 = keep parent 1 (usually the branch you merged INTO)
```

`-m 1` means "treat the first parent (e.g. `main`) as the mainline and undo the changes the *other* branch brought in."

**The gotcha:** reverting a merge undoes its *changes* but the merge itself still happened in history. If you later try to merge that same feature branch again, Git thinks those commits are already merged and **won't re-introduce them** — because the branch's tip is still an ancestor. To actually re-land the feature you must **revert the revert** (or rebase the branch onto a fresh base) before re-merging. This surprises people constantly, so call it out in the interview.

### Q12. How do I undo several commits at once, or revert a range?

**Revert a range** (creates one inverse commit per commit, preserving history):

```bash
git revert --no-commit HEAD~3..HEAD   # stage the inverse of the last 3 commits
git commit -m "Revert last 3 commits" # bundle into one revert commit
```

**Reset multiple local commits** (rewrites history — only if un-pushed):

```bash
git reset --soft HEAD~3    # drop last 3 commits, keep all their changes staged
git reset --hard HEAD~3    # drop last 3 commits AND their changes (data loss)
```

`HEAD~3..HEAD` means "the three commits ending at HEAD." Use `revert` for a range on shared history; use `reset` only when the commits are still private.

### Q13. How do I reset my branch to exactly match the remote?

When your local branch has diverged and you want to throw away local commits and match `origin`:

```bash
git fetch origin
git reset --hard origin/main    # local main becomes identical to origin/main
```

This **discards all local commits and uncommitted changes** on the branch — a `--hard` reset to the remote-tracking ref. Fetch first so `origin/main` is current, or you'll reset to a stale snapshot.

If you only want to drop uncommitted work but keep your local commits, use `git restore` / `git stash` instead. And remember any local commits you blow away here are still recoverable from the reflog for a while.

### Q14. When should I use `reset` vs `revert`? Give me the rule.

The single rule: **`reset` for private history, `revert` for public history.**

- If the commits are **only in your local repo** (never pushed), `reset` is fine — you're cleaning up before anyone sees it.
- If the commits are **already pushed / shared**, use `revert` — it adds an undoing commit instead of rewriting what others have pulled.

```bash
# private cleanup:
git reset --soft HEAD~1

# public, already-pushed mistake:
git revert <sha>
```

Rewriting shared history (`reset` + force-push) forces every teammate to reconcile diverged branches and can silently drop their work — the classic way to break a team's morning. When in doubt, `revert`.

### Q15. I ran `git reset --hard` and lost commits I needed. Can I get them back?

Almost certainly yes — the commits are unreachable but not gone. Git keeps them for ~90 days and the **reflog** still points at them.

```bash
git reflog                      # find the SHA the branch was at BEFORE the reset
# e.g.  abc1234 HEAD@{1}: commit: the work you lost
git reset --hard abc1234        # move the branch back to it
# or, non-destructively:
git branch recover abc1234      # save it on a new branch first
```

The reflog records every position HEAD has held, so the pre-reset commit is right there under `HEAD@{1}`. This is why `reset --hard` on *committed* work is recoverable — but note it does **not** save *uncommitted* changes that the `--hard` wiped; those were never committed, so there's no reflog entry.

### Q16. What is `git reflog` and why is it the ultimate undo?

`git reflog` is a local log of **every place HEAD has pointed** — every commit, reset, rebase, checkout, merge, and amend. Even commits that are no longer reachable from any branch appear here.

```bash
git reflog
# abc1234 HEAD@{0}: reset: moving to HEAD~3
# def5678 HEAD@{1}: commit: feature work
# ...
git reset --hard HEAD@{1}       # jump back to where you were one action ago
```

It's the ultimate undo because most "I destroyed my history" operations (bad reset, botched rebase, wrong amend, deleted branch) leave the old commits intact but unreferenced — and the reflog is the reference that survives. As long as you *committed* the work, it's findable here for weeks. The Stashing & the Reflog topic goes deeper; the takeaway: you almost never truly lose committed work in Git.

### Q17. Walk me through recovering a commit after a botched rebase.

A rebase rewrites commits, so if it goes wrong the *original* commits are still in the reflog under their old hashes.

```bash
# 1. See where you were before the rebase started:
git reflog
# 3a9f1c2 HEAD@{5}: rebase (start): checkout main
# 7b2e4d8 HEAD@{6}: commit: my good work   <-- pre-rebase tip

# 2. Fastest fix — reset the branch back to the pre-rebase state:
git reset --hard HEAD@{6}

# 3. Or recover just the lost commits onto your current branch:
git cherry-pick 7b2e4d8
```

The `rebase (start)` line marks the boundary — the entry just before it is your original branch tip. Reset to it and it's as if the rebase never happened. This safety net is exactly why you can attempt a rebase without fear: the reflog remembers the "before".

## Stashing & the Reflog

### Summary

**What this topic covers**

Two features that feel unrelated but are both about *not losing in-progress work*: the **stash** (a place to shelve uncommitted changes so you can get a clean working directory) and the **reflog** (Git's flight recorder that lets you recover almost anything you thought you destroyed). Stashing answers "I'm mid-change and need to switch branches / pull / test something clean — park this for a minute." The reflog answers "I did something reckless — a bad reset, rebase, amend, or branch delete — and my commits are gone." The 15 questions cover the full stash workflow (`push`/`list`/`pop`/`apply`/`drop`, messages, including untracked files, partial and path-scoped stashes, moving a stash to another branch, `stash branch`, conflicts, the stash stack) and then the reflog as the safety net: how it records every HEAD movement, the `HEAD@{n}` and time-based syntax, recovering lost commits, how it differs from `git log`, and the "I think I lost my commits — get them back" walkthrough that ties the whole undo story together.

**Mental model**

For the **stash**, picture a stack of drawers off to the side of your desk. `git stash` sweeps your uncommitted changes (staged + unstaged tracked edits) into the top drawer and gives you a clean desk — the working directory now matches HEAD. Under the hood it's actually a couple of *commits* stored off in a special ref (`refs/stash`), which is why it can carry a full snapshot. `pop` takes the top drawer's contents back out and throws the drawer away; `apply` takes them out but keeps the drawer. For the **reflog**, the model is: a branch is a pointer, and *every time that pointer moves, Git writes down where it was*. `git log` shows you the ancestry graph reachable from where you are *now*; the reflog shows you the *history of where you've been*, including commits no branch points to anymore. That's the crucial difference — reachability. A "lost" commit after a bad reset is unreachable from any branch, so `log` can't see it, but the reflog still holds its SHA, and any SHA Git still has objects for can be recovered. This is why the mantra holds: if you committed it, you almost never truly lose it.

**Key terms**

- **stash** — a saved snapshot of uncommitted changes stored off to the side, clearing your working directory.
- **stash push** — create a stash (`git stash` or `git stash push -m "msg"`).
- **pop** — apply the top stash and remove it from the stack (`git stash pop`).
- **apply** — apply a stash but keep it on the stack (`git stash apply`).
- **stash stack** — stashes are numbered `stash@{0}` (newest), `stash@{1}`, … LIFO.
- **`-u` / `-a`** — include untracked (`-u`) or untracked + ignored (`-a`) files in a stash.
- **stash branch** — create a new branch from a stash's base commit and apply it there.
- **reflog** — a per-ref log of every position HEAD (or a branch) has held.
- **HEAD@{n}** — the position HEAD was at *n* moves ago; `HEAD@{1}` = one action back.
- **`@{time}`** — time-based reflog syntax, e.g. `main@{yesterday}`, `HEAD@{2.hours.ago}`.
- **dangling / unreachable commit** — a commit no branch or tag points to; findable via reflog or `fsck`.
- **gc / expiry** — garbage collection eventually deletes unreachable objects (reflog entries default ~90 days).

**Why interviewers ask this**

Stashing is a fluency check — do you actually work in Git day to day? Everyone who's juggled branches has stashed; the follow-ups (pop vs apply, including untracked files, why a WIP commit is often *better* than a stash) reveal depth. The reflog is where the real signal is: a candidate who reaches for `git reflog` when asked "I `reset --hard`'d and lost a day's work — what now?" has internalized Git's object model and won't panic-recreate work by hand. It's the difference between someone who treats Git as a fragile black box and someone who understands that commits are immutable snapshots that stick around until GC. The best answers connect the two: "make a WIP commit rather than a long-lived stash, because a commit is in the reflog and a stash is easier to lose."

**Common confusions**

- "Stashes are per-branch" — no, the stash stack is global to the repo; you can pop a stash onto a different branch.
- "`pop` and `apply` are the same" — `pop` removes the stash after applying; `apply` leaves it on the stack.
- "`git stash` saves untracked files" — by default it does **not**; you need `-u` (or `-a` for ignored too).
- "The reflog is on the server / shared" — it's **local only**; a fresh clone has an empty reflog.
- "`git log` will show my lost commit" — no; `log` only shows reachable commits, `reflog` shows where HEAD has been.
- "A bad rebase/reset destroys commits" — it makes them *unreachable*, not deleted; the reflog holds them until GC.
- "Reflog keeps things forever" — unreachable entries expire (default ~90 days, 30 for unreachable) and GC prunes them.

**What follows from this topic**

The reflog is the safety net the entire Undoing Changes topic leans on — every "I overshot my reset/rebase" recovery lands here. The stash-vs-WIP-commit debate connects to branching discipline. And the "commits are immutable and stick around until GC" insight underpins why force-pushing (Remotes) is recoverable for the person who did it, and why rewriting history (Rebase) isn't as scary *locally* as it first seems — as long as you know the reflog has your back.

### Q1. What is `git stash` and when would you use it?

`git stash` shelves your **uncommitted** changes (staged and unstaged edits to tracked files) and reverts your working directory to a clean state matching HEAD. The changes aren't lost — they're saved on a stack you can reapply later.

```bash
git stash               # shelve changes, clean the working dir
git stash pop           # bring them back
```

Classic uses:

- You're mid-change and need to **switch branches** to fix something urgent.
- You need a **clean working dir to `git pull`** (a merge that would otherwise conflict with local edits).
- You want to **test the committed state** without your work-in-progress in the way.

It's the "hold this thought" button — park messy changes, do the clean thing, then unshelve.

### Q2. What's the difference between `git stash pop` and `git stash apply`?

Both reapply a stashed change to your working directory. The difference is what happens to the stash afterward.

- **`git stash pop`** — apply the stash **and delete it** from the stack (apply + drop).
- **`git stash apply`** — apply the stash but **keep it** on the stack.

```bash
git stash apply stash@{0}   # try it out; stash still saved
git stash pop               # apply the top stash and remove it
```

Use `apply` when you might want the same stash on multiple branches, or when you're unsure it'll apply cleanly and want a safety copy. Use `pop` for the common case: unshelve and move on. One gotcha — if `pop` hits a **conflict**, it applies what it can but does **not** drop the stash, so you don't lose it.

### Q3. How do I stash with a message, list my stashes, and inspect one?

```bash
git stash push -m "half-done login validation"   # named stash
git stash list                                   # show the stack
# stash@{0}: On feature/login: half-done login validation
# stash@{1}: WIP on main: 3a9f1c2 Fix header
git stash show stash@{0}       # summary of files changed
git stash show -p stash@{0}    # full diff of that stash
```

`git stash` alone auto-generates a `WIP on <branch>` message, which is useless when you have several. Always `push -m "..."` so `stash list` reads like a todo list rather than a pile of identical WIPs.

### Q4. Does `git stash` include untracked or ignored files? How do I stash them?

By default, **no** — plain `git stash` only shelves tracked files (modified/staged). Brand-new untracked files stay in your working directory and can trip up a "clean" branch switch.

```bash
git stash              # tracked changes only (untracked files left behind)
git stash -u           # include UNTRACKED files too (--include-untracked)
git stash -a           # include untracked AND ignored files (--all)
```

This surprises people who stash, switch branches, and find their new file "followed" them — because it was never stashed. Reach for `-u` when your change includes new files. Use `-a` sparingly; it sweeps in build artifacts and other ignored junk.

### Q5. How do I stash only some files, or interactively pick hunks?

**Specific paths:**

```bash
git stash push -m "just the CSS" styles.css components/
```

**Interactive, hunk by hunk** (like `add -p`):

```bash
git stash push -p      # prompts y/n per hunk; stash only what you choose
```

Path-scoped and `--patch` stashes let you split a messy working directory — shelve the experimental half, keep working on the rest. Everything not selected stays in your working directory.

### Q6. Can I apply a stash to a different branch than the one I created it on?

Yes — the stash stack is **global to the repo**, not tied to a branch. You can stash on `main`, switch to `feature/login`, and pop it there.

```bash
git stash                 # on main
git switch feature/login
git stash pop             # applies here instead
```

This is genuinely useful: "oops, I started this work on the wrong branch." Stash, switch to the right branch, pop. The only catch is that if the two branches have diverged a lot, applying may conflict — Git does a normal 3-way merge of the stashed changes against wherever you are now.

### Q7. What does `git stash branch` do?

`git stash branch <name>` creates a **new branch starting from the commit the stash was made on**, checks it out, and applies (and drops) the stash there.

```bash
git stash branch feature/recovered stash@{0}
```

Why it exists: if you stashed a while ago and the branch has since moved on, a plain `pop` might conflict because the base has changed. `stash branch` sidesteps that by rewinding to the *original* base commit, so the stash applies cleanly, then hands you a fresh branch to continue on. It's the clean way to turn a forgotten stash into real work.

### Q8. My `git stash pop` produced a merge conflict. What happens and what do I do?

`pop` applies the stash as a 3-way merge, so if the underlying files changed since you stashed, you get **conflict markers** just like a merge conflict. Crucially, **`pop` does not drop the stash when it conflicts** — so your saved copy is safe.

```bash
git stash pop
# CONFLICT (content): Merge conflict in app.js
# resolve markers in app.js ...
git add app.js
# stash is still in the list because pop didn't complete cleanly:
git stash drop            # remove it once you're happy the merge is correct
```

Resolve the markers, `git add` the files, and — because the stash wasn't auto-dropped — manually `git stash drop` once you've confirmed everything's correct. Don't drop it until you're sure.

### Q9. How do I clean up stashes — drop one or clear them all?

```bash
git stash drop stash@{1}   # delete a specific stash
git stash drop             # delete the most recent (stash@{0})
git stash clear            # delete ALL stashes (irreversible-ish)
```

`clear` wipes the whole stack. There's no `stash list` history afterward — though because stashes are commit objects, a just-dropped stash's SHA can sometimes still be fished out of `git fsck --lost-found` before GC. Don't rely on that; treat `clear` as permanent.

### Q10. When should I stash vs. just make a WIP commit — and why is a commit often better?

**Stash** for short-lived, "park it for two minutes" interruptions — switch branch, pull, run a quick test, come back.

**A throwaway WIP commit** is often **safer and better** for anything longer:

```bash
git commit -am "WIP: do not push"   # then continue; later:
git reset --soft HEAD~1             # un-commit and keep changes when ready
```

Why a WIP commit wins:

- A commit is a **first-class object in the reflog** — recoverable for ~90 days. A stash is a single ref that's easy to lose track of, accidentally `clear`, or forget.
- Stashes don't stack meaningfully in your history; they pile into an opaque `stash list`.
- A WIP commit is tied to its branch and travels with it; a stash floats globally and can be popped onto the wrong branch.

The rule of thumb: minutes → stash; hours or "I might forget about this" → WIP commit.

### Q11. How does the stash stack work — what are `stash@{0}` and `stash@{1}`?

Stashes form a **LIFO stack**. Each `git stash` pushes onto the top:

- `stash@{0}` — the **newest** stash.
- `stash@{1}` — the one before it, and so on.

```bash
git stash list
# stash@{0}: On main: latest WIP
# stash@{1}: On main: earlier WIP
git stash apply stash@{1}   # target a specific one by index
git stash pop stash@{1}     # pop a non-top stash (indexes then renumber)
```

Popping or dropping a middle stash renumbers the rest. Because the indices shift, always `stash list` first and name a message when you push, so you're not guessing which `{n}` is which.

### Q12. What is `git reflog` and how does it differ from `git log`?

`git reflog` is a **local record of every position HEAD has held** — every commit, checkout, reset, rebase, merge, and amend, newest first.

```bash
git reflog
# 7b2e4d8 HEAD@{0}: commit: add tests
# 3a9f1c2 HEAD@{1}: reset: moving to HEAD~1
# c4d5e6f HEAD@{2}: checkout: moving from main to feature/login
```

The difference from `git log`:

| | `git log` | `git reflog` |
|---|---|---|
| Shows | Commit **ancestry** reachable from a ref | **History of HEAD movements** |
| Sees unreachable commits? | No | **Yes** |
| Scope | Shared (part of history) | **Local only** — not cloned/pushed |
| Ordering | By commit graph | By when you did the action |

The killer distinction: `log` only shows commits **reachable** from where you are now, so a commit orphaned by a bad reset vanishes from `log` — but the reflog still has its SHA. That's what makes recovery possible.

### Q13. Explain the `HEAD@{n}` and time-based reflog syntax.

Reflog entries can be addressed two ways:

**By count** — `HEAD@{n}` is where HEAD was *n* moves ago:

```bash
git reset --hard HEAD@{1}   # undo the last thing that moved HEAD
git show HEAD@{2}           # inspect the commit HEAD was at 2 actions back
```

**By time** — Git parses human-ish time expressions per ref:

```bash
git show HEAD@{2.hours.ago}
git diff main@{yesterday} main    # what changed on main since yesterday
git checkout main@{one.week.ago}
```

You can also do this per-branch: `git reflog show feature/login` and then `feature/login@{3}`. The time syntax is great for "what did this branch look like before I messed with it this morning."

### Q14. I did a `git reset --hard` (or deleted a branch) and lost commits. Walk me through recovering them.

Stay calm — the commits are unreachable, not deleted. Recover in three steps.

```bash
# 1. Find the lost commit's SHA in the reflog:
git reflog
# 9f8e7d6 HEAD@{2}: commit: the work I lost   <-- there it is

# 2a. Simplest: move the branch back to it:
git reset --hard 9f8e7d6

# 2b. Safer: put it on a new branch first, then inspect:
git branch recover 9f8e7d6
git switch recover

# 2c. Or graft just that commit onto your current branch:
git cherry-pick 9f8e7d6
```

For a **deleted branch**, its last commit still shows in the reflog (or via `git fsck --lost-found`); `git checkout -b <name> <sha>` resurrects it. The whole recovery hinges on one fact: Git doesn't delete commit objects immediately — the reflog keeps a pointer to them until garbage collection, typically ~90 days out.

### Q15. How long does the reflog keep things, and what's `git fsck --lost-found` for?

Reflog entries expire on a schedule, after which `git gc` can prune the now-unreferenced objects:

- **Reachable reflog entries** — default expiry **90 days** (`gc.reflogExpire`).
- **Unreachable entries** — default **30 days** (`gc.reflogExpireUnreachable`).

Until then, lost commits are recoverable. If a commit has fallen out of the reflog but hasn't been GC'd yet, `fsck` can still find it:

```bash
git fsck --lost-found        # list dangling commits/blobs with no ref
git fsck --unreachable       # everything not reachable from any ref
```

`fsck` walks the object database directly rather than the reflog, so it surfaces **dangling commits** the reflog no longer lists — a last-resort net when the normal reflog recovery has already expired. The practical takeaway: you have weeks, not forever, so recover sooner rather than later — but you almost never truly lose *committed* work in Git.
## Interactive Rebase & History Rewriting

### Summary

**What this topic covers**

The craft of curating commit history before you share it: `git rebase -i` and its whole vocabulary of todo-list commands. Three concern areas live here: (1) the **todo-list model** — how interactive rebase drops you into an editor listing commits oldest-first, each prefixed with a command you edit (`pick`, `reword`, `edit`, `squash`, `fixup`, `drop`), and how Git then replays them one at a time; (2) the **core operations** — squashing a messy feature branch down to a few logical commits, splitting a fat commit into pieces, reordering, rewording messages, and folding "oops" fixes with `--fixup`/`--autosquash`; and (3) the **safety discipline** — the golden rule (only rewrite local/un-pushed history), force-push-with-lease for your own PR branch, and recovering a botched rebase via the reflog. The 16 questions here take you from "what does `pick` mean" to "I mangled a 12-commit rebase, get me back". This is the topic that separates people who *live* in Git from people who only `commit` and `push`.

**Mental model**

Interactive rebase is not magic — it's a **scripted replay**. When you run `git rebase -i HEAD~5`, Git rewinds your branch to the base commit, then walks a todo list you author, re-creating each commit in order. Because a commit's SHA is a hash of its content *plus its parent*, changing anything — the message, the diff, the order, the parent — mints a **brand-new commit** with a new SHA. The old commits don't vanish immediately; they linger in the reflog, which is your undo button. So think of interactive rebase as: "rewind to base, then re-apply these changes however I've re-scripted them." Every line in the todo editor is one instruction for one commit. `pick` replays it unchanged; `squash`/`fixup` merge it into the line above; `edit` pauses the replay so you can amend; `drop` skips it. Reordering the *lines* reorders the *commits*. Because you're rewriting, the cardinal constraint is: never do this to commits other people have already pulled.

**Key terms**

- **interactive rebase** — `git rebase -i <base>`; opens a todo list of commits to replay from `<base>` to `HEAD`.
- **todo list** — the editor buffer listing commits oldest-first, each with a command keyword you can change.
- **pick** — keep the commit as-is (the default for every line).
- **reword** — keep the commit's changes but stop to edit its message.
- **edit** — stop *at* this commit with it applied, so you can `--amend`, split, or run commands before continuing.
- **squash** — combine this commit into the previous one, opening an editor to merge both messages.
- **fixup** — like squash but *discard* this commit's message; the clean way to fold "fix typo" commits.
- **drop** — remove the commit entirely (or just delete its line).
- **exec** — run an arbitrary shell command (e.g. tests) at that point in the replay; a non-zero exit pauses the rebase.
- **--autosquash** — auto-arrange `fixup!`/`squash!` commits (made with `commit --fixup`/`--squash`) next to their targets.
- **--force-with-lease** — a safer force-push that refuses if the remote moved since you last fetched.
- **reflog** — Git's log of where HEAD has pointed; the recovery net for any rewrite gone wrong.

**Why interviewers ask this**

Interactive rebase is the clearest tell of Git fluency. A junior candidate knows `commit` and `push`; a mid-level candidate can `rebase -i` to squash before a PR; a senior candidate can *split* a commit, reorder to make each commit independently revertable, mark fixups with `--autosquash`, and — critically — recover when it goes wrong. Interviewers probe this because rewriting history is exactly where people cause real damage: a careless `--force` clobbers a teammate's work, or a botched rebase seemingly "loses" a day of commits. They want to hear the **golden rule** unprompted ("only rewrite un-pushed history"), the reach for `--force-with-lease` over `--force`, and calm confidence that the reflog makes almost everything recoverable. Getting this right signals you can be trusted with the shared history other people depend on.

**Common confusions**

- "Rebase deletes my old commits" — no; it creates new ones and leaves the originals in the reflog for ~90 days.
- "squash and fixup are the same" — both combine upward, but `squash` keeps this commit's message (you edit the merged text), `fixup` throws it away.
- "The todo list is newest-first" — it's **oldest-first**, the opposite of `git log`. Reordering lines reorders commits in that direction.
- "I can rebase `main` to tidy it after merging" — never rewrite a shared branch; you'll diverge from everyone who pulled it.
- "`--force` and `--force-with-lease` are interchangeable" — plain `--force` overwrites blindly; `--force-with-lease` aborts if someone else pushed, saving you from clobbering their commits.
- "`edit` lets me change the message" — `edit` pauses to change *content*; use `reword` for just the message.

**What follows from this topic**

Interactive rebase is the engine behind several later workflows. Dropping a leaked secret from history (its own topic) is an interactive rebase or `filter-repo` operation. The Cherry-pick, Bisect & Advanced Tools topic assumes the same "commits are cheap, atomic, and content-addressed" mindset that makes rebasing safe. And every conflict you hit mid-rebase feeds straight into Merge Conflicts in Depth — especially the ours/theirs flip that trips people up during a rebase. If the object model (a commit = tree + parent + metadata, hashed) still feels fuzzy, revisit it; interactive rebase only makes sense once you see commits as immutable snapshots you're re-minting.

### Q1. What is `git rebase -i` and when would you use it?

`git rebase -i <base>` (interactive rebase) is the tool for **curating commit history before you share it**. It opens an editor listing every commit from `<base>` up to `HEAD`, letting you reorder, combine, edit, reword, or drop them, then replays the result.

```bash
git rebase -i HEAD~5      # curate the last 5 commits
git rebase -i main        # curate everything on this branch since it left main
git rebase -i <sha>       # curate everything after that commit
```

Primary use case: **clean up a messy feature branch before opening a PR**. A branch full of "wip", "fix", "oops typo" becomes a handful of logical, reviewable commits. Reviewers read intent, not your keystroke-by-keystroke history.

The one rule that governs all of it: only do this to **local, un-pushed** commits (or your own PR branch that nobody else builds on). Rewriting shared history diverges everyone who pulled it.

### Q2. Walk me through the interactive rebase todo list and its commands.

Running `git rebase -i HEAD~3` opens something like:

```
pick a1b2c3d Add login form
pick d4e5f6a Fix validation bug
pick 7g8h9i0 wip

# Commands:
# p, pick   = use commit
# r, reword = use commit, but edit the commit message
# e, edit   = use commit, but stop for amending
# s, squash = use commit, but meld into previous commit
# f, fixup  = like squash, but discard this commit's log message
# d, drop   = remove commit
# x, exec   = run command (the rest of the line) using shell
```

Key facts: the list is **oldest at the top** (opposite of `git log`). You edit the keyword at the start of each line, save, and close. Git then replays top-to-bottom. Deleting a line entirely is the same as `drop`. Reordering the lines reorders the commits.

### Q3. How do I squash multiple commits into one?

The most common cleanup. Say the last four commits are one logical change split into "wip" fragments:

```bash
git rebase -i HEAD~4
```

Keep the first as `pick`, mark the rest `squash` (or `fixup` to discard their messages):

```
pick   a1b2c3d Implement payment flow
squash d4e5f6a wip
fixup  7g8h9i0 fix typo
squash 0j1k2l3 handle edge case
```

Save. Git combines all four into one commit and — because of the `squash` lines — opens an editor to compose the final message (the `fixup` line contributes nothing to the message). You end with a single clean commit:

```
A---B---C---D   (before)   →   A---E   (after: E = B+C+D squashed)
```

Use `fixup` for every line if you just want the first commit's message verbatim.

### Q4. How do I split one commit into several?

Mark it `edit`; Git pauses with that commit applied. Then **uncommit** it and re-stage in pieces:

```bash
git rebase -i HEAD~3
# change the target line's command to: edit

# rebase stops at that commit. Undo it but keep the changes unstaged:
git reset HEAD~

# now stage and commit in logical chunks:
git add auth.js
git commit -m "Add auth module"
git add tests/
git commit -m "Add auth tests"

git rebase --continue
```

`git reset HEAD~` moves the branch pointer back one commit while leaving all the changes in your working tree (a mixed reset). From there you stage selectively — `git add -p` is invaluable for splitting a single file's changes — and make as many commits as you want before continuing.

### Q5. What's the difference between `squash` and `fixup`?

Both **meld the commit into the one above it**. The difference is what happens to the message:

| | `squash` | `fixup` |
|---|---|---|
| Combines into previous | Yes | Yes |
| This commit's message | Kept — editor opens to merge both | Discarded silently |
| Editor stop | Yes | No |
| Typical use | Two real commits that should be one | Folding a "fix typo" into its parent |

`fixup` is the clean way to absorb correction commits. If commit B is "add feature" and commit C is "oops, fix bug in feature", `fixup` C into B and it's as if the bug was never there — no "fix bug" noise in history.

### Q6. How does `--autosquash` work with `commit --fixup`?

`--autosquash` automates the arranging step. As you work, when you spot a bug in an earlier commit, don't write "fix bug in X" — instead:

```bash
git commit --fixup=a1b2c3d      # marks this as "fixup! <subject of a1b2c3d>"
git commit --squash=a1b2c3d     # or --squash to keep/merge the message
```

This creates a commit whose subject is `fixup! Add login form`. Later:

```bash
git rebase -i --autosquash HEAD~10
```

Git automatically moves each `fixup!`/`squash!` commit directly *below* its target and pre-sets the `fixup`/`squash` command. You just save and close — no manual reordering. Set `git config --global rebase.autosquash true` to make it the default for every interactive rebase.

### Q7. How do I reorder commits or reword commit messages?

**Reorder** — swap the lines in the todo list. Their order in the file is their order in history:

```
pick d4e5f6a Add tests      ← moved up
pick a1b2c3d Add feature
```

Now "Add tests" replays first. (Beware: if the reordered commits touch the same lines, you may hit conflicts.)

**Reword** — change the command to `reword`:

```
reword a1b2c3d Add feature
```

Git replays the commit unchanged but opens an editor for its message. Use this for many messages at once — mark several lines `reword` and Git stops at each in turn. For just the *most recent* commit's message, skip the rebase entirely: `git commit --amend`.

### Q8. What is `git commit --amend` and how does it relate to rebase?

`git commit --amend` is the **single-commit special case** of history rewriting — it rewrites *only the last commit*:

```bash
git commit --amend                  # edit message and/or add staged changes
git commit --amend --no-edit        # fold staged changes in, keep the message
git commit --amend -m "New message" # just change the message
```

It replaces `HEAD` with a new commit (new SHA) combining the old commit plus whatever's currently staged. Think of it as `rebase -i HEAD~1` with `reword` or `edit` — same underlying operation, quicker for the common case of "I forgot to add a file" or "typo in my last message". Same golden rule applies: only amend commits you haven't pushed (or force-push-with-lease your own PR branch after).

### Q9. What is the golden rule of rebasing and why does it matter?

**Never rewrite history that others have based work on.** Concretely: don't rebase or amend commits that have been pushed to a shared branch (`main`, `develop`) that teammates pull from.

Why it matters: rewriting creates *new* commits with new SHAs. If Alice pushed commits and Bob pulled them, then Alice rebases and force-pushes, the history Bob has no longer matches the remote. Bob's next pull creates a tangled mess — duplicated commits, spurious merge conflicts, and a real risk of losing work.

The safe zone is **your own un-pushed commits** and **your own PR branch** that nobody else builds on. Rewriting those freely — squashing, reordering, amending — is not just allowed, it's good hygiene. When you do rewrite a pushed PR branch, use `--force-with-lease`, never plain `--force`.

### Q10. How do I handle conflicts during an interactive rebase?

Rebase replays commits one at a time, so conflicts surface **per step**. Git pauses at the offending commit:

```bash
# rebase stops with a conflict
git status                 # see conflicted files
# edit files to resolve, then:
git add <resolved-files>
git rebase --continue      # move on to the next commit

git rebase --skip          # discard the current commit and continue
git rebase --abort         # bail out entirely, back to the pre-rebase state
```

Key mindset: you resolve conflicts commit-by-commit, not all at once. This can mean resolving the "same" conflict repeatedly across several commits — which is exactly what `rerere` (reuse recorded resolution) helps with. If it all goes sideways, `git rebase --abort` returns you cleanly to where you started; nothing is lost.

Watch the ours/theirs meaning during a rebase — it's flipped relative to a merge (covered in Merge Conflicts in Depth).

### Q11. Why curate history at all? Isn't more detail better?

Because **commits are documentation and tooling inputs**, not a keystroke log. A clean history pays off constantly:

- **Readable** — a reviewer reads five logical commits, not forty "wip" fragments.
- **Bisectable** — `git bisect` binary-searches history to find a bug; that only works if each commit builds and is a coherent step. Atomic commits make bisect powerful.
- **Revertable** — `git revert <sha>` cleanly undoes one logical change only if that change lives in one commit, not smeared across ten.
- **Reviewable** — small, focused commits let reviewers reason about one concern at a time.
- **`git blame`-friendly** — "why is this line here" leads to a meaningful commit message, not "fix".

The raw process of how you got there (dead ends, typos, "actually revert that") is noise nobody needs. Curate before you share; leave your working mess in the reflog.

### Q12. I botched an interactive rebase. How do I recover?

The **reflog** is your time machine. It records every position HEAD has held, including where your branch was *before* the rebase:

```bash
git reflog
# 3f2a1b0 HEAD@{0}: rebase (finish): returning to refs/heads/feature
# a1b2c3d HEAD@{5}: rebase (start): checkout main
# 9x8y7z6 HEAD@{6}: commit: the good state before I started   ← this one
```

Find the entry just before `rebase (start)` and reset to it:

```bash
git reset --hard HEAD@{6}
# or by SHA:
git reset --hard 9x8y7z6
```

Your branch is back exactly as it was pre-rebase. This works even if the rebase "lost" commits — they're unreachable but not deleted (garbage-collected only after ~90 days). The reflog is why you should rebase without fear: almost nothing is truly unrecoverable.

### Q13. What is the `exec` command in a rebase todo list good for?

`exec` (or `x`) runs a shell command **between commits** during the replay. If the command exits non-zero, the rebase pauses so you can fix things. This turns rebase into a history *validator*:

```
pick a1b2c3d Add parser
exec npm test
pick d4e5f6a Add serializer
exec npm test
```

Now Git runs the test suite after each commit and stops at the first one that fails the tests — letting you find and fix a commit that broke the build somewhere in your branch. To run a command after *every* commit without editing each line:

```bash
git rebase -i --exec "npm test" HEAD~5
```

Great for guaranteeing every commit in a PR is green (a prerequisite for reliable `git bisect`).

### Q14. What is `--force-with-lease` and why prefer it over `--force`?

After rebasing a branch you've already pushed, a normal `git push` is rejected — the remote's history diverged. You must force. The question is *how safely*:

```bash
git push --force               # overwrites the remote branch, no questions asked
git push --force-with-lease     # overwrites ONLY if the remote is where you last saw it
```

`--force-with-lease` checks that the remote branch still points where your last `fetch` recorded. If a teammate pushed in the meantime, the lease is broken and the push is **rejected** — protecting their commits from being clobbered. Plain `--force` would silently destroy them.

Rule of thumb: on any branch, always reach for `--force-with-lease`. It has the same effect as `--force` when you're the only one pushing, and saves you the day someone else isn't.

### Q15. What is autostash and how does it help during rebase?

If you have uncommitted changes and try to rebase, Git refuses — it won't replay commits over a dirty tree. Autostash automates the stash/unstash dance:

```bash
git rebase -i --autostash main
# or make it permanent:
git config --global rebase.autostash true
```

With autostash on, Git automatically stashes your working-tree changes before the rebase and re-applies them (pops the stash) when it finishes. You keep your in-progress work without manually running `git stash` and `git stash pop` around every rebase. If applying the stash back conflicts, Git tells you and leaves the stash safe for manual recovery.

### Q16. How do I keep merge commits when rebasing? What is `--rebase-merges`?

A plain rebase **flattens** history — it replays individual commits and discards merge commits, so any branch structure inside your work is lost. When you want to preserve that topology (e.g. a feature branch that itself merged sub-branches), use:

```bash
git rebase --rebase-merges main
```

This recreates the merge commits as part of the replay, keeping the branching shape intact rather than linearizing everything into a single line. It's the modern replacement for the old `--preserve-merges` (now removed). Most of the time you *want* the flattening — linear history is easier to read and bisect — so reach for `--rebase-merges` only when the merge structure is meaningful and worth keeping.

## Cherry-pick, Bisect & Advanced Tools

### Summary

**What this topic covers**

The specialist power tools that turn Git from a place-to-store-code into an investigative and surgical instrument. Three clusters live here: (1) **moving commits** — `git cherry-pick` to replay a specific commit's change onto another branch (backporting a fix, grabbing one commit, recovering lost work); (2) **finding the guilty commit** — `git bisect` binary-searching history to pinpoint which commit introduced a bug, and automating it with `git bisect run`; and (3) **archaeology** — `git blame` for line-level attribution, `git log` pickaxe search (`-S`/`-G`), `git log -L` to trace a function, `git grep`, `git shortlog`, `git describe`, `git range-diff`, and `git notes`. The 15 questions here answer the real on-the-job questions: "which commit broke the build?", "who wrote this line and why?", "when did this code disappear?", "backport just this fix to the release branch". This is where atomic, well-messaged commits stop being aesthetic and start paying dividends.

**Mental model**

Think of history as a **searchable, addressable database of changes**, and these tools as its query engine. Each commit is an immutable, content-addressed snapshot with a parent — which means you can pluck one out (`cherry-pick`), binary-search across them (`bisect`), attribute any line to the commit that last touched it (`blame`), or scan the whole timeline for when a string appeared or vanished (pickaxe). The unifying insight: because commits are atomic and hashed, Git can reason about *which change* did *what*, not just *what the code is now*. `cherry-pick` takes the **diff** a commit introduced and re-applies it as a new commit elsewhere (new SHA, new parent — same change). `bisect` exploits the ordered parent-chain to find a bug in `log₂(n)` tests instead of `n`. `blame` walks backwards from HEAD asking "when did this exact line last change?". Everything here rewards a clean history: atomic commits make bisect surgical and blame meaningful; a wall of "wip" commits makes both useless.

**Key terms**

- **cherry-pick** — apply the change introduced by a specific commit onto the current branch as a *new* commit (same diff, new SHA/parent).
- **backport** — cherry-picking a fix from a development branch onto an older release/maintenance branch.
- **bisect** — binary search over the commit history to find the commit that introduced a regression.
- **`bisect run`** — automate bisect with a script whose exit code marks each commit good (0) or bad (non-zero).
- **blame** — line-by-line attribution: which commit and author last modified each line.
- **pickaxe (`-S`/`-G`)** — `git log` search for commits that added or removed a given string/regex.
- **`log -L`** — trace the change history of a specific function or line range over time.
- **range-diff** — compare two versions of a branch (e.g. before/after a rebase) commit-by-commit.
- **`.git-blame-ignore-revs`** — a file listing bulk-reformat commits so `blame` skips them.
- **git describe** — a human-readable name for a commit derived from the nearest tag (`v1.2-14-gabc123`).
- **shortlog** — commits grouped and counted by author; the basis of release-note summaries.
- **notes** — metadata attached to a commit without rewriting it (`git notes add`).

**Why interviewers ask this**

These tools separate people who *use* Git from people who *investigate* with it. Anyone can commit; a strong engineer, handed "production broke sometime this week", reaches for `git bisect run` and finds the exact commit in minutes rather than eyeballing a hundred diffs. Interviewers ask about cherry-pick to check you understand it creates a *new* commit (and the duplicate-commit downside versus merging), and to see if you know the backport workflow. They ask about bisect to test whether you think algorithmically about debugging — binary search over history is a beautiful, underused technique. And blame/pickaxe questions reveal whether you can do code archaeology: reconstructing *why* a line exists, not just *what* it does. Senior signal is knowing the limits too: blame lies after a reformat, cherry-pick duplicates commits, bisect needs every commit to build.

**Common confusions**

- "Cherry-pick moves the commit" — it *copies* the change as a new commit; the original stays put with its own SHA.
- "Cherry-picking then merging later is fine" — the cherry-picked commit and the original are different SHAs, so a later merge can produce duplicate-looking changes or conflicts.
- "Bisect needs me to manually check each commit" — `git bisect run <script>` automates the whole search via exit codes.
- "Blame shows who *wrote* the logic" — it shows who *last touched* the line; a whitespace reformat or move can make the real author invisible (mitigate with `-w`, `-C`, `.git-blame-ignore-revs`).
- "`git log --grep` searches the code" — `--grep` searches commit *messages*; use `-S`/`-G` (pickaxe) to search the code changes themselves.
- "Bisect breaks if some commits don't build" — mark those with `git bisect skip`; it works around untestable commits.

**What follows from this topic**

These tools lean on everything the primer builds. Cherry-pick is a mini-rebase — it replays a diff and can conflict, feeding straight into Merge Conflicts in Depth (same `--continue`/`--abort` rhythm, same resolution skills). Bisect's power depends on the clean, atomic, buildable commits produced by the Interactive Rebase topic — curate history and bisect rewards you. Blame's accuracy depends on separating reformatting from logic changes, another rebase-hygiene payoff. And when you find the guilty commit via bisect, your next move is often `git revert` (safe, shared-history undo) or a `cherry-pick` of the fix onto a release branch — closing the loop between *finding* a problem and *fixing* it across branches.

### Q1. What does `git cherry-pick` do and when would you use it?

`git cherry-pick <sha>` takes the **change introduced by one specific commit** and re-applies it onto your current branch as a **new commit** — same diff, but a new SHA and a new parent.

```bash
git checkout release/1.4
git cherry-pick a1b2c3d      # apply that fix onto the release branch
```

```
main:     A---B---C---D        (D = the bug fix)
release:  A---E---F            
                   \
                    F---D'     (D' = cherry-picked copy of D, new SHA)
```

Common use cases:
- **Backport a fix** — a bug is fixed on `main` (commit D); apply just that fix to an older `release/1.4` branch without dragging along everything else on `main`.
- **Grab one commit** from a colleague's branch without merging the whole thing.
- **Recover a commit** you accidentally dropped — find it in the reflog and cherry-pick it back.

### Q2. What are the downsides of cherry-picking versus merging?

The core issue: **cherry-pick duplicates the change**. The picked commit `D'` has the same diff as the original `D` but a *different SHA*. Git now sees two distinct commits that make the same change.

Consequences:
- If you later **merge** the two branches, Git may not realize `D` and `D'` are "the same" change. Usually its 3-way merge notices the identical content and merges cleanly, but if there was any intervening drift you can get **duplicate commits** in history or spurious conflicts.
- History no longer cleanly reflects "this change happened once"; it happened twice under two SHAs.

Prefer **merge/rebase** when you want to integrate a whole line of work and preserve the shared ancestry. Use **cherry-pick** for genuinely selective transplants (backports, one-off grabs) where merging the whole branch would bring too much along. Record provenance with `-x` (next question) to make the duplication traceable.

### Q3. What do the `-x`, `-n`, and range options to cherry-pick do?

```bash
git cherry-pick -x a1b2c3d       # append "(cherry picked from commit a1b2c3d)" to the message
git cherry-pick -n a1b2c3d       # apply the change but DON'T commit (stage only)
git cherry-pick A..B             # pick a RANGE: every commit after A up to and including B
git cherry-pick A^..B            # include A itself in the range
```

- **`-x`** records the origin SHA in the new commit's message — invaluable for backports so anyone can trace where the fix came from. Standard practice on release branches.
- **`-n`** (`--no-commit`) applies the diff to your working tree and index but stops before committing, so you can combine several picks or tweak them into one commit.
- **Ranges** let you transplant a sequence of commits at once. `A..B` is exclusive of `A` (Git's usual range semantics); use `A^..B` when you want `A` included too.

### Q4. A cherry-pick hit a conflict. How do I handle it?

Same rhythm as any conflict-producing operation — cherry-pick applies a diff, and if the target code has drifted, it conflicts:

```bash
git cherry-pick a1b2c3d
# CONFLICT in payment.js
git status                 # see what conflicted
# edit the file to resolve, remove conflict markers
git add payment.js
git cherry-pick --continue # finish making the new commit

git cherry-pick --abort    # give up, restore pre-pick state
git cherry-pick --skip     # skip this commit (relevant mid-range)
```

You resolve exactly as you would a merge conflict, then `--add` and `--continue`. If you're picking a range and one commit conflicts irreparably, `--skip` moves past it. `--abort` cleanly rewinds everything.

### Q5. What is `git bisect` and how does it work?

`git bisect` **binary-searches your history to find the commit that introduced a bug**. Instead of checking commits one by one, it halves the search space each step — `log₂(n)` tests instead of `n`.

```bash
git bisect start
git bisect bad                 # current HEAD is broken
git bisect good v1.2.0         # this old tag was known-good
# Git checks out the MIDPOINT commit between good and bad
# ... you test it ...
git bisect good                # this midpoint works → bug is newer
# ... Git checks out a new midpoint, you test again ...
git bisect bad                 # this one's broken → bug is older/here
# ... converges ...
# "abc123 is the first bad commit"
git bisect reset               # return to where you started
```

Over 1000 commits, bisect finds the culprit in ~10 tests. Each step you just answer "does the bug exist here?" and Git narrows the range until one commit remains — the one that flipped good to bad.

### Q6. How do I automate bisect with `git bisect run`?

The killer feature. Instead of manually testing each midpoint, hand bisect a **script whose exit code** decides: `0` = good, non-zero (1–127, except 125) = bad. Git runs it at every step and converges unattended:

```bash
git bisect start
git bisect bad
git bisect good v1.2.0
git bisect run npm test           # or ./test.sh, pytest, make check…
# Git checks out each midpoint, runs the command, reads the exit code,
# and reports "abc123 is the first bad commit" — hands-free.
git bisect reset
```

Write a script that reproduces *just* the failure (e.g. runs the one failing test, or greps output for the bug). Return `exit 125` for commits that can't be tested (won't build) so bisect skips them. This turns "somewhere in 500 commits, something broke" into a coffee-break-length automated search — the single most impressive Git trick to demo in an interview.

### Q7. What if some commits in the bisect range don't build or can't be tested?

Use `git bisect skip`. Some midpoints Git picks might be broken for unrelated reasons (won't compile, missing dependency) — you can't get a clean good/bad answer:

```bash
git bisect skip                # skip the current commit, Git picks a nearby one
git bisect skip v1.3..v1.4     # skip a whole range
```

Bisect works around skipped commits by testing neighbours. If too many around the boundary are skipped it may report a small set of candidates rather than a single commit. In automated mode, have your script `exit 125` — the special "cannot test / skip" code — for un-buildable commits, and `bisect run` handles it automatically. This is another reason atomic, individually-buildable commits matter: fewer skips, sharper results.

### Q8. What is `git blame` and what are its most useful options?

`git blame <file>` shows, for **every line**, the commit, author, and date that **last modified it** — the "who and when did this line get this way" tool.

```bash
git blame app.js
git blame -L 40,60 app.js       # only lines 40–60
git blame -w app.js             # ignore whitespace-only changes
git blame -C app.js             # detect lines COPIED from other files
git blame -M app.js             # detect lines MOVED within the file
git blame <sha> -- app.js       # blame the file as it was at a past revision
```

The senior-level options fight blame's biggest weakness — it attributes the *last touch*, not the original author:
- **`-w`** skips whitespace/reformat commits so the real change shows.
- **`-M`/`-C`** follow lines that were moved or copied, so a refactor that relocated code doesn't hide its true origin.
- **blame at a revision** lets you ask "who owned this line before last month's rewrite?".

Workflow: find a suspicious line, `blame` it, read the commit message for *why*, follow up in that commit's full diff.

### Q9. Blame shows a giant reformatting commit for every line. How do I see the real history?

This is blame's classic failure mode: someone ran a formatter or bulk-renamed, and now *every* line blames that one mechanical commit instead of the author who wrote the logic.

Fixes:
- **`git blame -w`** ignores whitespace-only changes, seeing past pure-formatting edits.
- **`.git-blame-ignore-revs`** — list the SHAs of bulk-reformat commits in this file, then tell Git (or GitHub) to skip them:

```bash
# .git-blame-ignore-revs
# The great prettier reformat of 2026
a1b2c3d4e5f6...
git config blame.ignoreRevsFile .git-blame-ignore-revs
git blame app.js               # now skips those revs automatically
```

GitHub's blame UI honors `.git-blame-ignore-revs` too. The broader lesson: **commit reformatting separately** from logic changes, and record the reformat SHA here, so blame stays meaningful forever.

### Q10. How do I find when a piece of code was added or removed? (the pickaxe)

Use `git log`'s **pickaxe** — `-S` and `-G` — to search the *content of changes*, not messages:

```bash
git log -S "processPayment" -- src/       # commits that changed the COUNT of "processPayment"
git log -S "processPayment" -p            # …with the diffs shown
git log -G "process.*Payment"             # commits whose diff matches this REGEX
```

- **`-S <string>`** finds commits where the number of occurrences of the string changed — i.e. where it was **added or removed**. Perfect for "when did this function first appear?" or "which commit deleted this config key?".
- **`-G <regex>`** finds commits whose diff *contains* a line matching the regex (broader — catches modifications, not just add/remove).

Contrast with `git log --grep="fix payment"`, which searches commit *messages*. Pickaxe searches the code itself — the tool for tracing the life and death of a specific line.

### Q11. How do I trace the entire history of a single function?

`git log -L` follows a line range or a function through time, showing each diff that touched it:

```bash
git log -L 40,60:app.js                    # history of lines 40–60 of app.js
git log -L :processPayment:payment.js      # history of the processPayment function
```

The `:funcname:file` form uses Git's function-detection to track a named function even as it moves within the file, printing every commit that modified it along with the diff. This is far more targeted than reading the whole file's log — you see the *evolution of one function*: when it was born, every change since, and by whom. Combine with `git log -L` plus the pickaxe when you're reconstructing why a specific behavior changed.

### Q12. What `git diff` and `git range-diff` tricks are worth knowing?

```bash
git diff --stat                    # summary: files changed, insertions/deletions
git diff --word-diff               # highlight changed WORDS, not whole lines
git diff main..feature             # what feature changed relative to main
git diff main...feature            # changes on feature since it diverged (from merge-base)
git diff HEAD~3 HEAD -- app.js     # one file across a range
git range-diff main old-feature new-feature   # compare two versions of a branch
```

The standout is **`git range-diff`**: after you rebase or amend a branch, it compares the *old* series of commits against the *new* series, commit-by-commit, showing what actually changed between the two versions. Indispensable when a reviewer asks "what did you change since my last review?" on a force-pushed PR — it answers precisely, ignoring the noise of the rebase itself. `--word-diff` is great for prose/config where line-diffs are too coarse.

### Q13. What do `git grep`, `git shortlog`, and `git describe` do?

Three sharp utilities:

**`git grep`** — search the *tracked tree* (or any revision) fast, respecting `.gitignore`, far quicker than plain `grep -r`:

```bash
git grep "TODO"                    # search working tree
git grep "processPayment" v1.2.0   # search the code as of a tag
git grep -n "apiKey"               # with line numbers
```

**`git shortlog`** — group commits by author, great for **release notes**:

```bash
git shortlog -sn v1.2.0..HEAD      # commit counts per author since v1.2.0
git shortlog v1.2.0..HEAD          # commits grouped under each author's name
```

**`git describe`** — a human-readable name for any commit, derived from the nearest tag:

```bash
git describe                       # → v1.2.0-14-gabc1234 (14 commits past v1.2.0, at abc1234)
```

The output means "14 commits after tag v1.2.0, at SHA abc1234" — perfect for build version strings.

### Q14. What are `git notes` and when are they useful?

`git notes` attach **extra metadata to a commit without rewriting it** — the SHA stays the same, so it's safe on shared history where amending isn't.

```bash
git notes add -m "Reviewed-by: alice; backported to release/1.4" a1b2c3d
git log --show-notes               # display notes alongside commits
```

Because the commit's message is fixed once pushed, notes give you a mutable side-channel: review sign-offs, backport tracking, CI results, or links to tickets, all layered onto an immutable commit. They live in a separate `refs/notes/*` namespace and must be pushed/fetched explicitly (they don't travel with a normal `git push` by default), which is why they're niche — but when you need to annotate history you can't rewrite, notes are the answer.

### Q15. Walk me through finding which commit broke the build.

Concrete workflow combining the topic's tools:

```bash
# 1. Confirm HEAD is broken and find a known-good point.
npm test                          # fails
git bisect start
git bisect bad                    # HEAD is broken
git bisect good v1.2.0            # last release passed CI

# 2. Automate the search with the failing test as the oracle.
git bisect run npm test
# Git binary-searches, running the tests at each midpoint...
# → "9f8e7d6 is the first bad commit"

# 3. Inspect the culprit.
git show 9f8e7d6                  # read the diff and message
git bisect reset                  # return to your branch

# 4. Fix forward or backport.
git revert 9f8e7d6                # safe undo on shared history
# or, if the fix lives elsewhere:
git cherry-pick <fix-sha>
```

The pitch: instead of eyeballing 200 diffs, bisect finds the exact commit in ~8 automated test runs. Then `git show` tells you *what* changed, and you either `revert` it or `cherry-pick` the real fix — closing the loop from detection to resolution. This only works cleanly when commits are atomic and individually buildable, which is why history hygiene matters.

## Merge Conflicts in Depth

### Summary

**What this topic covers**

The one Git skill everyone eventually needs and most people do nervously: resolving merge conflicts correctly. Three concern areas live here: (1) **why conflicts happen** — Git's 3-way merge, the merge-base (common ancestor), and the specific situations that produce a conflict versus the far larger set of changes Git merges automatically; (2) **reading and resolving** — decoding the `<<<<<<< ======= >>>>>>>` markers, the enormously helpful `diff3`/`zdiff3` style that also shows the *base*, editing to the intended combined result (not blindly picking a side), and marking resolved with `git add`; and (3) **the tooling and the traps** — the ours/theirs meaning *flipping* between merge and rebase, `checkout --ours/--theirs`, `-X ours/theirs` strategy options, `merge --abort`, `git mergetool`, and `rerere` (reuse recorded resolution). The 15 questions cover the full range from "what does `<<<<<<<` mean" to "walk me through this nasty rename/delete conflict". This is applied, hands-dirty Git.

**Mental model**

A merge conflict is **not an error — it's Git asking a question it can't answer**. Git's 3-way merge takes three inputs: your branch tip (**ours**), the other branch tip (**theirs**), and their **merge-base** (the most recent common ancestor). For every region of every file, Git compares each side against the base. If only *one* side changed a region, Git takes that change silently. If *both* sides changed the *same* region *differently*, Git can't know which you want — so it marks a **conflict** and hands it to you. That's the whole model: conflicts are exactly the overlaps where automatic reasoning is impossible. Critically, Git merges *textually*, line by line — it has no idea what the code *means*, so a "clean" merge can still be semantically broken (two functions that individually merged but now interact wrongly). Your job resolving a conflict is to reconstruct the **intended combined result** — usually *both* changes, integrated — not to pick a winner. The base (shown by `diff3`/`zdiff3`) reveals *what each side was trying to do*, which is the key to resolving intent rather than guessing.

**Key terms**

- **3-way merge** — combining two branch tips using their common ancestor (merge-base) as the reference point.
- **merge-base** — the most recent commit both branches share; the "base" of the three-way comparison.
- **conflict** — a region both sides changed differently, or an add/add, modify/delete, etc.; Git can't auto-resolve it.
- **conflict markers** — `<<<<<<< HEAD` (ours) / `=======` / `>>>>>>> branch` (theirs) delimiting the two versions.
- **ours** — your current branch's version (but see: its meaning flips in a rebase).
- **theirs** — the incoming branch's version (also flips in a rebase).
- **diff3 / zdiff3** — a conflict style that adds `||||||| base` showing the common ancestor between the two sides.
- **`checkout --ours/--theirs`** — take one whole side's version of a conflicted file wholesale.
- **`-X ours/theirs`** — a merge *strategy option* auto-favoring one side for conflicting hunks only.
- **`merge --abort`** — cancel the in-progress merge and restore the pre-merge state.
- **rerere** — "reuse recorded resolution"; Git remembers how you resolved a conflict and re-applies it if it recurs.
- **mergetool** — launches a configured 3-way visual merge tool to resolve conflicts.

**Why interviewers ask this**

Conflict resolution is where confidence and correctness are both tested, and it's a daily reality on any team. Interviewers want to see that you don't panic — that a conflict is routine, not a crisis. The deep signal comes from a few specifics. Do you know that resolving means producing the *intended* result, usually keeping *both* changes, rather than blindly taking one side? Do you understand *why* the conflict happened (same region, both sides, diverging from the base)? Can you explain the notorious **ours/theirs flip** during a rebase — the single most common source of "I took the wrong side" disasters? Do you reach for `diff3`/`zdiff3` to see intent? And critically, do you know that a **textually clean resolution can be semantically wrong**, so you verify with a build and tests? A candidate who says "I just accept theirs and move on" is a red flag; one who reconstructs intent and verifies is a keeper.

**Common confusions**

- "A conflict means I did something wrong" — no; it's the normal outcome of two people editing the same lines. It's expected.
- "I should just pick one side" — usually wrong; you typically want *both* changes integrated. Blindly taking a side silently drops work.
- "ours/theirs always means my branch/their branch" — during a **rebase** the meaning **flips**: "ours" is the branch you're rebasing *onto*, "theirs" is your commits being replayed.
- "If it merged without conflict, it's correct" — textual cleanliness ≠ semantic correctness; run the tests.
- "`git checkout --theirs` is safe" — it discards *all* of your side for that file, not just the conflicting parts; often loses work.
- "Removing the markers is enough" — you must remove *every* marker AND `git add` the file; a leftover `=======` compiles as garbage.

**What follows from this topic**

Everything here connects backward and forward. The ours/theirs flip is why the Interactive Rebase topic warns you to watch conflict direction mid-rebase — same skill, trickier framing. The `--abort` escape hatch mirrors `rebase --abort` and `cherry-pick --abort` — one consistent "bail out cleanly" pattern across all conflict-producing operations. Cherry-pick conflicts (from the Advanced Tools topic) resolve with these exact techniques. And `rerere` pays off most during repeated rebases, tying back to history curation. The deepest thread is the reminder that Git merges *text*, not *meaning*: it's why atomic commits, small PRs, frequent integration, and a green test suite (that catches the semantic conflicts merge can't) are the real defenses. Master this topic and Git stops being scary.

### Q1. Why do merge conflicts happen?

Git performs a **3-way merge**: it compares your branch (**ours**) and the incoming branch (**theirs**) against their **merge-base** (most recent common ancestor). For each region of each file:

- If only *one* side changed it → Git takes that change automatically.
- If *both* sides changed the *same region differently* → **conflict**. Git can't know which you meant.

```
        A---B---C   feature (theirs)
       /
  ...-O            O = merge-base
       \
        D---E---F   main (ours)
```

Git auto-merges every non-overlapping change. A conflict is specifically the *overlap* — the same lines edited on both branches in incompatible ways. Beyond content overlaps, conflicts also arise from **add/add** (both branches created the same file differently), **modify/delete** (one side edited a file the other deleted), and **rename** clashes. The mental takeaway: conflicts mark exactly the spots where automatic reasoning is impossible — everything else Git handles silently.

### Q2. How do I read conflict markers?

Git inserts three markers into the conflicted region:

```
<<<<<<< HEAD
const timeout = 3000;        // your version (ours / current branch)
=======
const timeout = 5000;        // the incoming version (theirs / merged branch)
>>>>>>> feature/login
```

- `<<<<<<< HEAD` to `=======` — **your** side (the current branch you're on, "ours").
- `=======` to `>>>>>>> feature/login` — **their** side (the branch being merged in, "theirs").
- The label after `>>>>>>>` tells you *which* branch the incoming change came from.

Everything between the markers is what Git couldn't reconcile. To resolve, you edit this region into the final intended code and **delete all three markers**. The surrounding file (outside the markers) Git already merged for you — only the marked regions need your decision.

### Q3. What is diff3/zdiff3 conflict style and why is it better?

The default markers show only the two *results*, not *why* they differ. `diff3` (and its cleaner cousin `zdiff3`) add a third section showing the **merge-base** — the common ancestor both sides started from:

```
<<<<<<< HEAD
const timeout = 3000;
||||||| base
const timeout = 1000;
=======
const timeout = 5000;
>>>>>>> feature/login
```

Now you can see the **intent** of each side: the base was `1000`; ours raised it to `3000`, theirs to `5000`. That context is hugely clarifying — you understand *what each side was trying to do* rather than guessing from two bare values. Enable it:

```bash
git config --global merge.conflictStyle zdiff3
```

`zdiff3` is the modern default choice — it's like `diff3` but zealously trims common lines from the conflict region, keeping it tighter. Turning this on is one of the highest-value Git config changes you can make.

### Q4. Walk me through resolving a conflict from start to finish.

```bash
git merge feature/login
# Auto-merging config.js
# CONFLICT (content): Merge conflict in config.js
# Automatic merge failed; fix conflicts and then commit the result.

git status                 # lists "Unmerged paths" — the conflicted files
```

Then, for each conflicted file:

1. **Open it**, find the `<<<<<<<` regions.
2. **Edit to the intended combined result** — usually integrate *both* changes, not pick one. Use the `||||||| base` context to understand each side's intent.
3. **Remove every marker** (`<<<<<<<`, `|||||||`, `=======`, `>>>>>>>`).
4. **Stage it** to mark it resolved:

```bash
git add config.js
```

5. Repeat for all files, then finish:

```bash
git commit             # for a merge (uses the prepared merge message)
# or, mid-rebase / mid-cherry-pick:
git rebase --continue
```

6. **Verify** — build and run tests. A textually-clean resolution can still be semantically wrong (Q14).

### Q5. What's the difference between "ours" and "theirs" — and why does it flip in a rebase?

This is the single most confused point in Git, and a favorite interview trap:

| | **ours** | **theirs** |
|---|---|---|
| During a **merge** | your current branch | the branch you're merging in |
| During a **rebase** | the branch you're rebasing **onto** | your commits being replayed |

Why it flips: a **merge** keeps you on your branch and pulls the other in — so "ours" is naturally yours. A **rebase** replays *your* commits on top of the target branch. Under the hood Git checks out the target and re-applies your commits as if they were the incoming changes — so "ours" becomes the *target* branch, and "theirs" becomes *your own* work.

Practical consequence: during `git rebase main`, if you reflexively run `git checkout --ours <file>` thinking "keep my changes", you'll actually keep *main's* version and **discard your own**. Always pause and remember which operation you're in.

### Q6. What do `git checkout --ours/--theirs` and `-X ours/theirs` do, and when are they dangerous?

Two different mechanisms:

**`git checkout --ours/--theirs <file>`** — during a conflict, take **one entire side's** version of that file, wholesale:

```bash
git checkout --theirs package-lock.json   # accept their whole file
git add package-lock.json
```

**`-X ours/-X theirs`** — a merge *strategy option* that auto-resolves **only the conflicting hunks** in favor of one side, keeping non-conflicting changes from both:

```bash
git merge -X theirs feature/login    # on conflicts, prefer theirs; keep both elsewhere
```

The danger: both **silently discard** the losing side's changes. `checkout --theirs` throws away *all* of your edits to that file, not just the conflicting lines — easy to lose work you didn't mean to. They're safe for files where one side is authoritative (regenerated lockfiles, generated code) but reckless for hand-written logic, where you should resolve by hand. And remember the ours/theirs flip if you're mid-rebase.

### Q7. How do I abort a merge or rebase that's gone wrong?

Every conflict-producing operation has a clean escape hatch that restores the pre-operation state:

```bash
git merge --abort          # cancel the in-progress merge
git rebase --abort         # cancel the in-progress rebase
git cherry-pick --abort    # cancel the in-progress cherry-pick
```

`git merge --abort` returns your working tree and branch exactly to where they were before you ran `git merge` — no half-merged mess. Use it the moment you realize you're not ready, took the wrong branch, or the conflict is bigger than expected. It's completely safe: nothing is committed, nothing is lost.

**Aborting vs resolving**: abort when you want to *stop and rethink* (wrong approach, need to prep more first); resolve when you're committed to finishing. There's no penalty for aborting and retrying — many engineers abort, do a bit of prep (pull latest, rebase smaller), and re-attempt with fewer conflicts.

### Q8. What is `git rerere` and how does it save time?

`rerere` = **reuse recorded resolution**. When enabled, Git **records how you resolved each conflict**, and if it sees the *exact same conflict* again, it **re-applies your resolution automatically**:

```bash
git config --global rerere.enabled true
```

Where it shines: **repeated rebases**. If you're rebasing a long-lived branch onto a fast-moving `main` day after day, you'd otherwise re-resolve the same conflicts every time. With `rerere`, you resolve once; every subsequent rebase auto-applies that resolution. Same benefit when you merge, back out the merge to keep working, and later re-merge — Git remembers.

```
first rebase:   conflict → you resolve → rerere records it
next rebase:    same conflict → rerere replays your resolution automatically
```

You still review and `git add` the auto-resolved result, but the tedious re-typing vanishes. It's a quiet, high-value setting for anyone who rebases often.

### Q9. What are the different types of merge conflicts?

Beyond the classic "both edited the same lines", several structural conflicts exist:

- **Content conflict** — both sides edited the same region of a file differently. The common case.
- **Add/add** — both branches created a *new* file at the same path with different content. Git can't pick.
- **Modify/delete** — one side edited a file, the other *deleted* it. Git asks: keep the edited version or honor the deletion?
- **Rename/rename** — both sides renamed the same file to *different* names. Which name wins?
- **Rename/delete** — one side renamed a file, the other deleted the original. Keep the rename or the deletion?

```bash
# modify/delete looks like:
# CONFLICT (modify/delete): app.js deleted in feature/x and modified in HEAD.
git rm app.js              # honor the deletion, or
git add app.js             # keep your modified version
```

These structural conflicts don't have `<<<<<<<` markers inside a file — Git reports them in `git status` and you resolve by choosing to `git add` (keep) or `git rm` (delete) the path.

### Q10. How do I reduce the number and pain of merge conflicts?

Conflicts are a function of *how much divergence accumulates*. Strategies:

- **Small, short-lived PRs** — the less time a branch lives and the smaller it is, the less chance of overlap.
- **Integrate frequently** — regularly `git pull --rebase` or merge `main` into your branch so you resolve small conflicts often instead of one giant conflict at the end.
- **Separate formatting from logic** — never mix a reformat with a feature; bulk-reformat commits conflict with everything and pollute blame.
- **Communicate** — if two people must touch the same file, coordinate so you're not editing the same region blindly.
- **Modular code** — well-factored code means people touch *different* files, reducing overlap.
- **Consistent tooling** — shared formatter/linter config so machines don't reformat each other's lines.

The single biggest lever is **frequent integration**: a branch that rebases on `main` daily hits tiny conflicts; a branch that lives three weeks hits a monster.

### Q11. How do binary files behave in a conflict?

Binaries (images, compiled assets, PDFs) **can't be line-merged** — Git has no concept of "combining" two versions of a PNG. On a conflict, you must **pick one whole side**:

```bash
# CONFLICT (content): Merge conflict in logo.png
git checkout --ours logo.png      # keep your version, or
git checkout --theirs logo.png    # keep theirs
git add logo.png
```

There's no middle ground — you choose ours or theirs in full, then stage. If you genuinely need *both* changes to a binary, you have to regenerate the asset manually outside Git and commit the result. This is a good argument for keeping large/binary assets out of Git (or in Git LFS) and for regenerating build artifacts rather than committing them — binary conflicts are always a pick-a-side situation, never a merge.

### Q12. What is a semantic conflict, and why doesn't Git catch it?

A **semantic conflict** is when a merge is **textually clean but logically broken**. Git merges *text*, not *meaning* — it has no idea what the code does.

Classic example: on your branch you rename a function `getUser` → `fetchUser` and update every call site. On another branch, a teammate adds a *new* call to `getUser()`. Both branches touch *different lines*, so Git merges with **no conflict** — but the result calls `getUser()`, which no longer exists. It compiles-as-text but breaks at build/runtime.

```
your branch:   renamed getUser → fetchUser everywhere
their branch:  added a new getUser() call
merge result:  clean merge, but getUser() is now undefined → broken
```

Git can't catch this because it only reasons about lines. The defense is **your test suite and compiler** — run them after every merge. This is *the* reason "it merged cleanly" never means "it works". Tests catch what merge can't.

### Q13. What tools help me resolve conflicts beyond editing markers by hand?

Two categories:

**`git mergetool`** — launches a configured **3-way visual merge tool** showing base, ours, and theirs side by side:

```bash
git mergetool                       # opens your configured tool per conflicted file
git config --global merge.tool vimdiff   # or meld, kdiff3, vscode…
```

**IDE 3-way merge views** — VS Code, JetBrains, etc. render the conflict as a panel with "Accept Current / Accept Incoming / Accept Both" buttons and a live preview of the result. For complex conflicts, seeing the three versions aligned is far easier than parsing markers in a plain editor.

**Inspecting during a conflict**:

```bash
git diff                     # shows the conflict hunks (combined diff)
git log --merge              # lists the commits from each side that touched the conflicted files
git log --merge -p           # …with their diffs, to understand each side's intent
```

`git log --merge` is underused — it shows exactly which commits on each branch caused the conflict, so you can read the reasoning behind both sides.

### Q14. Why must I verify a resolution with a build and tests?

Because **a resolution with zero conflict markers left can still be wrong** — in two ways:

1. **Bad manual merge** — you kept one side when you needed both, or mis-integrated the two changes. The markers are gone, the file parses, but the logic is subtly incorrect.
2. **Semantic conflict** (Q12) — the merge was textually clean everywhere, but two independently-fine changes interact wrongly.

Git's job ends at producing text without markers; it makes **no guarantee about correctness**. So the resolution isn't "done" when the markers are gone — it's done when:

```bash
git add <files>
# BEFORE committing/continuing:
npm run build && npm test        # or your project's build + test
git commit                       # only once green
```

Treat "compiles and tests pass" as the real definition of resolved. Committing a merge without running tests is how "it merged fine" turns into a broken `main` an hour later.

### Q15. Walk me through resolving a nasty conflict end to end.

Scenario: rebasing a week-old `feature/checkout` onto a fast-moving `main`, hitting conflicts in `payment.js`.

```bash
# 1. Turn on the good conflict style first (once, globally).
git config --global merge.conflictStyle zdiff3
git config --global rerere.enabled true

# 2. Start the rebase.
git rebase main
# CONFLICT (content): Merge conflict in payment.js
```

```bash
# 3. Understand it. Remember: mid-rebase, "ours" = main, "theirs" = my commits.
git status
git log --merge -p -- payment.js    # what each side changed and why
```

Open `payment.js`, use the `||||||| base` section to see intent, and **integrate both changes** — main's new retry logic plus my new currency handling — rather than picking a side.

```bash
# 4. Mark resolved and continue.
git add payment.js
git rebase --continue               # rerere records this resolution

# 5. If the same conflict recurs on the next commit, rerere auto-applies it.
# 6. Verify — textually clean ≠ correct.
npm run build && npm test

# 7. If it all goes wrong, bail cleanly.
git rebase --abort
```

The senior habits on display: `zdiff3` + `rerere` set up front, reading `log --merge` for intent, integrating both sides, watching the ours/theirs flip, and verifying with tests before trusting the result.
## Branching Strategies & Workflows

### Summary

**What this topic covers**

How teams organise work in Git so that many people can build in parallel without stepping on each other — and how the branching model decides what ships and when. This topic has 16 questions spanning the classic named workflows (**GitFlow**, **GitHub Flow**, **GitLab Flow**), **trunk-based development** and why modern high-performers favour it, the long-lived-vs-short-lived branch tradeoff, **feature flags** to decouple merge from release, release and hotfix branches, fork-based workflows for open source, naming conventions, and how the strategy interacts with CI/CD, code review, and protected branches. A branching strategy is not academic: it is the single biggest lever on how fast a team integrates, how often main is releasable, and how much "merge hell" it suffers. Get this right and the rest of your Git practice falls into place; get it wrong and every merge becomes a negotiation.

**Mental model**

A branch in Git is just a movable pointer to a commit — cheap to create, cheap to delete. So a branching *strategy* is not about the mechanics of branches; it is a **team agreement** about three things: (1) how long branches live before they merge, (2) what the "source of truth" branch is and how protected it is, and (3) how a merge becomes a release. Every named workflow is a different answer to those three questions. The core tension underneath all of them is **integration frequency vs isolation**. Long-lived branches give each stream of work isolation but pay for it later with a giant, conflict-ridden merge (integration debt). Short-lived branches — the trunk-based extreme — force you to integrate constantly, which is uncomfortable at first but keeps every merge small. The DORA research is unambiguous that frequent integration to a single trunk correlates with elite delivery performance. So the modern default reads as: **trunk-based + short-lived branches + feature flags + strong CI**, and everything else (GitFlow's develop/release/hotfix ceremony) is a heavier process you adopt only when a specific constraint — scheduled releases, multiple supported versions — demands it.

**Key terms**

- **Trunk** — the single long-lived integration branch (usually `main`) that everyone converges on.
- **GitFlow** — a heavyweight model with `main`, `develop`, and `feature/*`, `release/*`, `hotfix/*` branches.
- **GitHub Flow** — one long-lived `main`; short-lived feature branches merged via PR then deployed.
- **GitLab Flow** — GitHub Flow plus environment/release branches (e.g. `production`, `staging`).
- **Trunk-based development** — commit to `main` or branches that live under a day, hiding incomplete work behind flags.
- **Feature flag** — a runtime toggle that lets you merge incomplete code to main "dark" (off) and release later.
- **Release branch** — a branch cut from trunk to stabilise a version while trunk moves on.
- **Hotfix branch** — a short branch off the released version to patch production fast, then merge back.
- **Fork-based workflow** — contributors fork the repo, branch in their fork, and open PRs upstream (OSS default).
- **Merge hell / integration debt** — the accumulated conflict/rework cost of branches that diverge from trunk for too long.
- **Protected branch** — a branch with rules (required reviews, passing CI, no direct push) enforced by the host.
- **Cherry-pick** — copying a single commit onto another branch, used for backporting fixes.

**Why interviewers ask this**

Branching strategy is where a candidate reveals whether they've actually worked on a team or only on solo projects. Juniors describe the mechanics ("you make a branch, then you merge it"); seniors describe *tradeoffs* and *failure modes* ("GitFlow's develop branch drifts from main and release branches rot; here's when it's still worth the ceremony"). Interviewers want to hear that you understand why trunk-based development plus feature flags is the modern default for continuous delivery, that you can articulate the merge-hell cost of long-lived branches, and that you can choose a strategy for a *context* — a two-person startup, a regulated enterprise shipping quarterly, an OSS project with anonymous contributors, a monorepo — rather than dogmatically applying one. The senior signal is connecting the branching model to the surrounding machinery: CI keeping trunk green, protected branches enforcing the policy, and feature flags decoupling deploy from release.

**Common confusions**

- "GitFlow is the professional/standard way" — GitFlow was designed for scheduled, versioned desktop-software releases; for continuous web delivery it is usually too heavy, and its author has said as much.
- "Trunk-based means no branches at all" — it means *short-lived* branches (hours to a day) or direct commits, not zero branches.
- "Feature flags are only for A/B testing" — their bigger role is decoupling *merge* from *release* so you can integrate incomplete work safely.
- "More/longer branches give more safety" — long-lived branches trade near-term isolation for a painful, risky integration later.
- "The branching model and the merge method are the same choice" — they're orthogonal; you pick a strategy *and* a merge policy (merge commit / squash / rebase).
- "Every deploy needs its own environment branch" — modern practice promotes a single built artifact through environments rather than merging code between environment branches.

**What follows from this topic**

Branching strategy is the frame that the next two topics fill in. **Pull Requests & Code Review** is how a short-lived branch actually re-joins the trunk — the review gate, the merge options, and the protected-branch rules that enforce your chosen model. **Tags & Releases** is how a commit on trunk (or a release branch) becomes a versioned, shippable release. And the whole thing rests on the earlier merge/rebase and reset/revert mechanics: your branching model dictates how often you merge vs rebase and how you recover when an integration goes wrong.

### Q1. What is a branching strategy and why does a team need one?

A branching strategy is a **team-wide agreement** about how you use branches: how long they live, what the source-of-truth branch is, how work re-joins it, and how a merge turns into a release. Git itself is unopinionated — branches are just movable pointers — so without a convention every developer invents their own and integration becomes chaos.

It matters because it directly controls three things a team cares about:

- **Coordination** — parallel work without constant collisions.
- **Stability** — keeping a known-releasable branch green at all times.
- **Velocity** — how quickly work integrates and ships.

The strategy is really a dial between **stability and speed**. Too much process (heavy branching, long stabilisation) protects stability but slows delivery; too little risks a broken main. The right point depends on context — a startup, a regulated bank, and an OSS project want very different settings.

### Q2. Walk me through GitFlow and when it actually fits.

GitFlow uses two long-lived branches plus three families of supporting branches:

- **`main`** — production; every commit is a tagged release.
- **`develop`** — the integration branch for the next release.
- **`feature/*`** — branched off `develop`, merged back into `develop`.
- **`release/*`** — branched off `develop` to stabilise a version (bugfixes, version bump), then merged to both `main` and `develop`.
- **`hotfix/*`** — branched off `main` to patch production, then merged to both `main` and `develop`.

```bash
git checkout develop
git checkout -b feature/login          # work
git checkout develop && git merge feature/login
git checkout -b release/1.4.0          # stabilise
git checkout main && git merge release/1.4.0 && git tag v1.4.0
```

**When it fits**: scheduled/versioned releases, multiple versions in support at once, or a shippable product (installers, mobile with slow review) where you genuinely need a stabilisation window. **Why it's fallen out of favour**: for continuous web delivery the ceremony is overhead — `develop` drifts from `main`, release branches rot, and the constant double-merging is friction. Its own author later noted it was never meant for continuous-delivery web apps.

### Q3. Explain GitHub Flow and why it suits continuous deployment.

GitHub Flow is deliberately minimal:

1. `main` is the single long-lived branch and is always deployable.
2. Cut a **short-lived feature branch** off `main`.
3. Push, open a **pull request**, get review + passing CI.
4. **Merge to `main`** and **deploy** (often automatically).
5. Delete the branch.

```
main ─●─────────────●──   (always deployable)
       \           /
        ●───●───●     feature/checkout
```

There is no `develop`, no `release/*`, no `hotfix/*` — a hotfix is just another short branch off `main`. This maps perfectly onto continuous deployment: because `main` is always releasable and branches are short, you can ship on every merge. It's the default for most web teams and OSS projects. The tradeoff: it assumes strong CI and the discipline to keep `main` green, and it has no built-in story for supporting multiple released versions simultaneously — for that you add release branches (which is essentially GitLab Flow).

### Q4. What does GitLab Flow add on top of GitHub Flow?

GitLab Flow keeps GitHub Flow's short-lived feature branches but adds **environment or release branches** to give you an explicit promotion path.

- **Environment branches**: `main` → `staging` → `production`. Code is *promoted* by merging forward from `main` into downstream branches, so what's in `production` is a known subset of `main`.
- **Release branches**: for versioned software, cut `release/1.2` and cherry-pick fixes into it.

It's a **middle ground**: simpler than GitFlow (no `develop`, no mandatory release branch for every cycle), but with more structure than raw GitHub Flow for teams that need a controlled path to production or must maintain versions. The key rule is that changes flow **downstream** (main → staging → production) and fixes are cherry-picked upstream-first to avoid environments diverging.

### Q5. What is trunk-based development and why do high-performing teams favour it?

Trunk-based development means everyone integrates into a single branch (`main`, the "trunk") **continuously** — either committing directly or via branches that live **less than a day**. Incomplete work is hidden behind **feature flags** rather than isolated on a long branch.

```
main ─●─●─●─●─●─●─●─●─   everyone merges here, many times a day
        \_/   \_/         branches live hours, not weeks
```

Why elite teams favour it (this is a **DORA** finding): frequent integration keeps every merge tiny, so conflicts are trivial and integration debt never accumulates. It's the branching model that actually enables **continuous integration** in the literal sense — the codebase is integrated all the time, not "integrated" once a sprint. It ties directly to the CI/CD primer: trunk-based development *requires* fast, reliable CI on every commit and a culture of keeping trunk green, and it pays back with the highest deploy frequency and lowest change-failure rates.

Its cost is discipline: small commits, feature flags, comprehensive automated tests, and a team that fixes a red trunk immediately.

### Q6. Long-lived vs short-lived branches — what's the tradeoff?

| | Long-lived branch | Short-lived branch |
|---|---|---|
| Isolation | High — work is insulated | Low — you integrate constantly |
| Integration cost | Deferred and **large** (merge hell) | Continuous and **tiny** |
| Conflict risk | High — branch diverges from trunk | Low — barely diverges |
| Feedback | Late — CI/review sees a big change | Early — small reviewable chunks |
| Discipline needed | Less upfront | More (flags, small commits) |

The trap with long-lived branches is **integration debt**: while your branch sits for two weeks, `main` moves on, and the eventual merge is a big, risky, conflict-heavy event ("merge hell"). Short-lived branches pay a small, constant integration tax instead of one giant bill. The senior take: prefer short-lived branches, and if a piece of work is genuinely large, don't hold it on a branch — **merge it incrementally behind a feature flag**.

### Q7. How do feature flags let you decouple merging from releasing?

A feature flag is a runtime conditional that gates code paths:

```python
if flags.enabled("new_checkout"):
    new_checkout()
else:
    old_checkout()
```

Because the new code is *off* by default, you can **merge it to `main` while it's still incomplete** ("ship dark") without exposing it to users. This breaks the assumption that "merged = released": merge is now a code-integration event, release is a separate flag-flip.

That decoupling is what makes trunk-based development work at scale — a half-built feature can live on trunk safely, so nobody needs a long-lived branch. It also gives you **progressive rollout** (enable for 1% → 10% → 100%), instant **kill-switch** rollback (flip the flag, no redeploy), and A/B testing. The cost is flag hygiene: flags are tech debt and must be removed once a feature is fully rolled out, or the codebase fills with dead conditionals.

### Q8. How do release branches and maintaining old versions work?

A release branch is cut from trunk to **stabilise a specific version** while the trunk keeps moving:

```bash
git checkout -b release/2.3 main
git tag v2.3.0
# later, a critical fix lands on main; backport it:
git checkout release/2.3
git cherry-pick <sha-of-fix-on-main>
git tag v2.3.1
```

You need this when you **support multiple versions at once** — e.g. customers on 2.3 who can't upgrade to 3.0 yet still need security patches. The pattern is **fix-forward, then backport**: land the fix on `main` first, then `cherry-pick` it onto each supported release branch, so nothing is lost when those branches are eventually retired. Teams doing pure continuous deployment of a single web app usually *don't* need release branches at all — there's only ever one live version.

### Q9. Walk me through a hotfix workflow.

A hotfix patches production **immediately**, bypassing the normal feature queue, then feeds the fix back so it isn't lost.

In GitHub Flow / trunk-based, a hotfix is just a fast short-lived branch off `main`:

```bash
git checkout -b hotfix/payment-npe main
# minimal fix + test
git commit -am "Fix NPE in payment flow"
# PR, fast review, merge, deploy, tag
git tag v2.3.1
```

In GitFlow it's more formal: branch `hotfix/*` off `main`, then merge into **both** `main` (to ship) **and** `develop` (so the next release keeps the fix). If you support old versions, you also cherry-pick it onto the relevant `release/*` branches. The two non-negotiables: keep the change **minimal** (only the fix), and **merge it back** everywhere the bug lives so it doesn't reappear in the next release.

### Q10. Describe the fork-based workflow used in open source.

In OSS the contributor usually can't push to the main repo, so:

1. **Fork** the upstream repo to your own account.
2. Clone your fork; add upstream as a remote.
3. Branch, commit, push to **your fork**.
4. Open a **PR from your fork's branch** to upstream.

```bash
git clone git@github.com:alice/acme.git
git remote add upstream git@github.com:acme/acme.git
git checkout -b fix/typo
git push origin fix/typo          # origin = your fork
```

Keeping the fork current is the recurring chore — sync from upstream regularly to avoid drift:

```bash
git fetch upstream
git rebase upstream/main          # or merge
git push --force-with-lease origin main
```

This contrasts with the **shared-repo** model teams use internally, where everyone has push access and branches live directly on `origin` — no fork needed. Forks add a trust boundary: maintainers review outside contributions before they can touch the canonical repo.

### Q11. What branch naming conventions do teams use and why?

A common convention is `type/short-description`, sometimes with a ticket ID:

- `feature/login-sso`
- `bugfix/cart-total-rounding`
- `hotfix/payment-npe`
- `release/2.4`
- `chore/bump-deps`
- `feature/PROJ-123-add-webhooks`

Why bother: prefixes make branches **scannable and sortable**, let tooling/CI match on patterns (e.g. run release pipelines only on `release/*`), and communicate intent at a glance. Some teams derive the branch name from the issue tracker so the branch, PR, and ticket are linked automatically. The specific scheme matters less than **consistency** — pick one and enforce it, ideally via a template or a lightweight hook.

### Q12. How does the branching strategy interact with CI/CD, code review, and protected branches?

They're one system. The branching model decides *where* work integrates; the other three **enforce and automate** it:

- **CI** runs on every push/PR. Trunk-based development is only safe *because* CI catches breakage on every small merge — the strategy assumes the automation.
- **Code review** via PRs is the human gate on a short-lived branch before it joins trunk. Short branches make reviews small and fast; long branches produce giant, unreviewable diffs.
- **Protected branches** codify the policy on the host: require passing CI, require N approvals, forbid direct pushes to `main`, require the branch be up to date. This is what actually *prevents* someone from bypassing the strategy.

So "trunk-based + PRs + protected main + green CI" is a coherent stack: the branching model sets the intent, and CI/review/protection make it real. A strategy without these controls is just a suggestion.

### Q13. Environment branches vs promoting one artifact through environments — which is better?

Two ways to get code from dev to prod:

- **Environment branches**: `staging` and `production` branches; you *merge code* forward to deploy. Simple to visualise but the environments can diverge, and you're rebuilding per branch — the thing tested in staging isn't bit-for-bit the thing in prod.
- **Artifact promotion**: build **one** immutable artifact (container image, bundle) once, then **promote that same artifact** through environments via config. What you tested is exactly what ships.

Modern CD strongly prefers **artifact promotion**: "build once, deploy many", with environment differences expressed as configuration, not as divergent branches. Environment branches (the GitLab Flow style) are a reasonable stepping stone, but the moment you care about "is prod running exactly what we tested?", promote a single build artifact instead of merging between branches.

### Q14. How would you choose a branching strategy for a given team or context?

Match the model to the constraints, not to fashion:

- **Two-person startup, ship constantly** → GitHub Flow or trunk-based; minimal ceremony, `main` always deployable.
- **High-performing web team at scale** → trunk-based + feature flags + strong CI; maximum integration frequency.
- **Enterprise with quarterly, versioned releases** → GitFlow or GitLab Flow with release branches; you need stabilisation windows and multi-version support.
- **Regulated (finance/health)** → whatever your model, layer on protected branches, required reviews (CODEOWNERS), signed commits, and an audit trail; approvals must be enforced, not trusted.
- **Open source** → fork-and-PR; maintainers gate outside contributions.
- **Monorepo** → trunk-based almost always; long-lived branches across a huge shared tree are unmanageable.

The reasoning an interviewer wants: state the constraints (release cadence, number of supported versions, team size, compliance), then derive the branching model from them. "It depends" is the right instinct, but back it with the *specific* dependencies.

### Q15. How does branching work in a monorepo?

A monorepo (many projects in one repo) pushes you hard toward **trunk-based development**. Long-lived branches are especially toxic here: a branch that diverges across a huge, shared tree collides with everyone else's work, and merging it is enormous. So the norm is: everyone commits to a single trunk, branches are very short-lived, and incomplete work hides behind feature flags.

Two supporting practices make this scale:

- **Sparse checkout / partial clone** so developers only materialise the subtree they work on, not the entire repo.
- **Affected-target CI** — build/test only the projects touched by a change (Bazel, Nx, Turborepo), because running everything on every commit is infeasible.

Google's monorepo is the canonical example: essentially all engineers on one trunk with rigorous automated testing gating each commit. The lesson: monorepo + trunk-based + fine-grained CI, not per-team long-lived branches.

### Q16. Does the merge policy (merge commit vs squash vs rebase) depend on the strategy?

Yes — the branching model and the merge method are chosen together.

| Merge policy | History effect | Fits |
|---|---|---|
| **Merge commit** | Preserves every branch commit + a merge bubble | GitFlow; teams that want full audit history |
| **Squash and merge** | Collapses the whole branch into one commit on main | GitHub Flow / trunk-based; keeps `main` linear and each PR = one commit |
| **Rebase and merge** | Replays the branch's commits onto main, no merge bubble | Teams wanting linear history *and* individual commits preserved |

Trunk-based / GitHub Flow teams usually pick **squash** — each short-lived branch becomes a single clean commit on `main`, giving a linear, bisect-friendly history. GitFlow leans on **merge commits** because the branch structure (feature → develop → release → main) *is* the history it wants to record.

Whatever you pick, avoiding **merge hell** is mostly upstream of the merge button: keep branches short and integrate often. And remember the golden rule — rebasing rewrites commits, so only rebase your **own unpushed** branch, never shared history.

## Pull Requests & Code Review

### Summary

**What this topic covers**

The pull request is the unit of collaboration on modern Git hosts — the wrapper around a branch that adds review, discussion, and automated checks before code joins the trunk. This topic has 15 questions covering what a PR (GitHub) or MR (GitLab) actually is, the full PR lifecycle from branch to merge, the fork-and-PR model for open source vs shared-repo branches for teams, the three merge options (merge commit, squash, rebase) and their history effects, **branch protection rules** and **CODEOWNERS**, what good code review looks like, keeping a PR up to date (merge vs rebase and the force-push-with-lease that follows), resolving feedback with fixup commits and autosquash, stacked PRs, and the merge queue. If branching strategy decides *where* work integrates, the PR is *how* a short-lived branch re-joins the trunk safely — the quality gate, knowledge-sharing mechanism, and audit trail rolled into one.

**Mental model**

A pull request is not a Git feature — it's a **host feature** (GitHub, GitLab, Bitbucket) built on top of a plain Git concept: "I have commits on branch X; please integrate them into branch Y." What the host adds is everything *around* that request: a diff view, threaded comments, required approvals, automated status checks (CI), and a merge button that can enforce policy. So think of a PR as a **gate with three jobs**: (1) *correctness* — CI and reviewers catch bugs before they reach `main`; (2) *knowledge sharing* — review spreads understanding of the change across the team; (3) *audit trail* — a permanent record of what changed, why, who approved it, and what checks passed. The mechanics (which merge button, how you keep the branch current) are downstream of that. The healthiest PRs are **small and short-lived**, which is exactly why the PR model pairs with trunk-based / GitHub Flow branching: tiny branches produce tiny, reviewable PRs that merge fast and keep `main` green.

**Key terms**

- **Pull request (PR)** — GitHub/Bitbucket term for a request to merge one branch into another, with review + checks.
- **Merge request (MR)** — GitLab's name for the same thing.
- **Merge commit** — merging by creating a commit with two parents, preserving all branch commits + a merge bubble.
- **Squash and merge** — collapsing all of a PR's commits into a single commit on the target branch.
- **Rebase and merge** — replaying the PR's commits onto the target with no merge commit (linear history).
- **Branch protection rule** — host-enforced policy on a branch (required reviews, passing CI, no direct push, etc.).
- **CODEOWNERS** — a file mapping paths to owners who are auto-requested for review when those paths change.
- **Draft PR** — a work-in-progress PR opened for early CI/visibility but not yet ready to merge.
- **Fixup commit + autosquash** — `git commit --fixup` + `rebase -i --autosquash` to fold review fixes into the right commit.
- **Force-with-lease** — a safer force-push that refuses if the remote moved unexpectedly.
- **Stacked PRs** — a chain of dependent PRs, each built on the previous branch.
- **Merge queue** — a host feature that serialises merges, testing each against latest `main` to keep it green.

**Why interviewers ask this**

PRs are where day-to-day engineering collaboration actually happens, so this topic reveals working habits more than raw Git knowledge. Juniors know how to open a PR; seniors have opinions about **how to make review effective** — small PRs, descriptive descriptions, reviewing for correctness and design while leaving style to linters, fast turnaround so nobody is blocked. Interviewers also probe the mechanics that trip people up: what squash-vs-rebase-vs-merge does to history, how to keep a PR current without clobbering teammates, and what branch protection actually enforces. The senior signal is treating the PR as a *system* — connecting it to CI (required checks), branching strategy (short-lived branches), and governance (CODEOWNERS, protected `main`, audit trail) — rather than as a button you click at the end.

**Common confusions**

- "A PR is a Git command" — it isn't; it's a host abstraction over a branch merge. Plain Git has no "pull request".
- "Squash, rebase, and merge-commit all do the same thing" — they produce very different histories; the choice is deliberate.
- "You should review style in PRs" — style belongs to linters/formatters; humans should review correctness, design, and readability.
- "Bigger PRs are more efficient" — large PRs get shallow reviews and merge slowly; small PRs get better scrutiny.
- "Merging main into your branch and rebasing onto main are the same" — both update the branch, but rebase rewrites your commits and needs a force-push.
- "Approving a PR means the code is correct" — approval plus green CI raises confidence; neither guarantees correctness.

**What follows from this topic**

The PR is the merge event that the **Branching Strategies** topic set up — a short-lived branch re-joining trunk under review. The merge options here (squash/rebase/merge commit) are the same policy choice that topic raised, viewed from the button. And once a PR merges to `main`, **Tags & Releases** takes over: a merged commit gets tagged and turned into a versioned release. Underneath all of it sit the core mechanics from earlier topics — merge vs rebase, force-with-lease, and the golden rule about not rewriting shared history — which is exactly what "keeping a PR up to date" exercises.

### Q1. What is a pull request and how does it differ from a plain git merge?

A **pull request** (PR on GitHub/Bitbucket, **merge request/MR** on GitLab) is a request to merge one branch into another, **wrapped with review, discussion, and automated checks**. It's a feature of the *hosting platform*, not of Git itself — plain Git has no concept of a PR.

The difference from a raw `git merge`:

- `git merge feature` just integrates the branch locally, immediately, with no gate.
- A PR opens a **collaboration surface** first: a diff view, threaded comments, required approvals, and CI status checks. Only when those pass does the host perform the underlying merge.

So a PR is essentially "here are my commits on `feature`; please review and integrate them into `main`", plus all the governance around that decision. It exists to add a **quality gate, knowledge sharing, and an audit trail** to what would otherwise be an unreviewed merge.

### Q2. Walk me through the full lifecycle of a pull request.

```bash
git checkout -b feature/webhooks main
# ... work, commit ...
git push -u origin feature/webhooks     # push the branch
```

1. **Open the PR** on the host, `feature/webhooks` → `main`, with a clear title and description.
2. **CI runs** automatically — tests, lint, build — reporting status checks on the PR.
3. **Review** — teammates comment; you discuss, address feedback with new/fixup commits and push again (CI re-runs).
4. **Approve** — required reviewers sign off once checks are green.
5. **Merge** — via merge commit, squash, or rebase, subject to branch protection.
6. **Delete the branch** — it's short-lived; its job is done.
7. Optionally the merge triggers **deploy** (continuous deployment).

The whole loop should be *fast and small*: a tight PR moves through this in hours, not days, which is why keeping branches short matters.

### Q3. Fork-and-PR vs shared-repo branches — when do you use each?

**Fork-and-PR** (open source): contributors don't have push access, so they **fork** the repo, branch in their fork, and open a PR from the fork to upstream. The maintainer reviews across a trust boundary before anything touches the canonical repo.

```bash
git remote add upstream git@github.com:acme/app.git
git fetch upstream && git rebase upstream/main   # keep fork synced
```

**Shared-repo branches** (internal teams): everyone has push access, so branches live directly on `origin` and PRs go branch → `main` in the *same* repo. No fork needed.

Use fork-and-PR when you **don't trust or don't want to grant write access** to all contributors (public OSS). Use shared-repo branches for a trusted internal team — it's simpler, avoids fork-sync overhead, and lets CI/secrets run on the branch (forks often have restricted secret access for security reasons).

### Q4. Explain the three merge options — merge commit, squash, rebase — and their effects on history.

| Option | What it does | History |
|---|---|---|
| **Merge commit** | Creates a commit with two parents joining the branch to main | Full — every branch commit + a merge bubble |
| **Squash and merge** | Collapses all PR commits into **one** new commit on main | Clean, linear; intermediate commits lost |
| **Rebase and merge** | Replays each PR commit onto main, no merge commit | Linear; individual commits preserved |

```
Merge commit:   main ─●─────────M   (M has 2 parents)
                       \       /
                        ●─●─●

Squash:         main ─●─────────S   (S = whole PR as one commit)

Rebase:         main ─●─●'─●'─●'     (commits replayed onto main)
```

- **Merge commit** keeps the truest record but clutters history with bubbles; good when the branch structure matters (GitFlow).
- **Squash** is the **most popular default** — one tidy commit per PR, linear `main`, easy to revert or bisect; you lose the intermediate commits (usually fine, since they're WIP).
- **Rebase** gives linear history while keeping meaningful individual commits — but rewrites SHAs and can be confusing.

### Q5. What are branch protection rules and which ones matter?

Branch protection rules are host-enforced policies on a branch (usually `main`) that a PR must satisfy before merging. The common ones:

- **Require pull request review** — no direct pushes; changes must go through a PR.
- **Require N approvals** — e.g. at least one or two reviewers sign off.
- **Require status checks to pass** — CI (tests, lint, build) must be green.
- **Require branch to be up to date** — the PR must include the latest `main` before merging.
- **Required reviewers / CODEOWNERS** — specific owners must approve touched paths.
- **Dismiss stale approvals** — new commits invalidate prior approvals.
- **Require linear history** — forbid merge commits (forces squash/rebase).
- **Require signed commits** — commits must be GPG/SSH signed.
- **No direct pushes to `main`** / restrict who can push.

These are what actually *enforce* your branching strategy and connect it to CI — without them, "always review, always green" is just a hope. In regulated environments the approval + signed-commit + audit-trail combination is often a compliance requirement.

### Q6. What is a CODEOWNERS file and how is it used?

`CODEOWNERS` is a file (in the repo root or `.github/`) that maps **file paths to owners**. When a PR touches a matched path, the host **automatically requests review** from those owners, and — combined with branch protection — can *require* their approval before merge.

```
# path            owners
*.tsx             @acme/frontend
/infra/           @acme/platform
/payments/        @alice @bob
*                 @acme/maintainers   # fallback
```

It solves two problems: **routing** (the right experts see changes to their area automatically) and **governance** (critical directories can't be changed without their owners' sign-off). Later matches override earlier ones, so order matters. It's the standard way large teams keep review load targeted instead of spamming everyone on every PR.

### Q7. What does good code review look like?

The habits that make review effective:

- **Small PRs.** A 50-line PR gets a real review; a 2,000-line PR gets a rubber stamp. Keep changes focused.
- **Descriptive PR description.** What changed, *why*, how to test, screenshots for UI, linked issue. The description is the reviewer's map.
- **Review for correctness, design, and readability — not style.** Style (spacing, quotes, import order) belongs to **linters and formatters**, run in CI. Humans should spend attention on logic bugs, edge cases, architecture, and clarity.
- **Fast turnaround.** A PR blocked for two days blocks a teammate. Review promptly; a quick "looks good, one nit" beats a slow perfect review.
- **Use draft PRs** for early feedback before it's ready.
- **Be kind and specific.** Ask questions, suggest, explain the why; praise good solutions.

The senior framing: review is a **conversation to raise quality and share knowledge**, not a gatekeeping ritual. Automate everything mechanical so humans review what only humans can.

### Q8. How do you keep a PR up to date with main — merge or rebase?

Two ways to pull the latest `main` into your branch:

**Merge main in** — a merge commit that brings `main`'s changes onto your branch:
```bash
git checkout feature/x
git merge origin/main
```
Non-destructive, no force-push needed, but adds "Merge main into feature" commits that clutter the PR.

**Rebase onto main** — replay your commits on top of the latest `main`:
```bash
git fetch origin
git rebase origin/main
git push --force-with-lease           # required: rebase rewrote your commits
```
Cleaner, linear history — but it **rewrites your branch's commits**, so you must force-push, and you should use `--force-with-lease` (not `--force`) so the push aborts if a teammate pushed to the branch meanwhile.

Rule of thumb: **merge** when the branch is shared with others (avoid rewriting their base); **rebase** for your own solo PR branch to keep history clean. Never rebase a branch other people have already built on.

### Q9. How do you resolve review feedback cleanly?

Two acceptable approaches:

**New commits** — just add commits addressing the feedback and push. Simplest; reviewers can see exactly what changed since their last look. The PR gets squashed on merge anyway, so intermediate commits don't matter.

**Fixup + autosquash** — attach fixes to the original commit they belong to, for a clean pre-merge history:
```bash
git commit --fixup <sha-of-original-commit>
# ... after approval ...
git rebase -i --autosquash origin/main   # folds fixups into their targets
git push --force-with-lease
```

Choose by merge policy: if the repo **squashes on merge**, don't bother — just push new commits, since they all collapse into one. If the repo **rebase-merges** and cares about clean per-commit history, use fixup + autosquash. Either way, don't force-push in a way that erases a teammate's review context mid-review without telling them.

### Q10. What are stacked PRs and when are they useful?

Stacked (or dependent) PRs are a **chain of branches**, each built on the previous one, opened as separate PRs:

```
main ── PR1 (branch A) ── PR2 (branch B on A) ── PR3 (branch C on B)
```

Instead of one giant PR, you split a large feature into a sequence of small, individually reviewable PRs where each depends on the one below it. PR1 targets `main`, PR2 targets `branch A`, PR3 targets `branch B`.

They're useful when a change is genuinely large but you still want **small reviews** — reviewers approve each layer independently, and you merge bottom-up. The cost is coordination: when PR1 merges, you have to rebase the rest of the stack onto `main`. Tools like Graphite, `git-town`, or Gerrit's change chains automate the restacking. It's a power-user pattern to preserve reviewability without one unreviewable mega-PR.

### Q11. What is a merge queue and what problem does it solve?

A merge queue **serialises merges** into `main` so it stays green. The problem it solves: two PRs each pass CI *against an older `main`*, but they conflict semantically once both land — so `main` breaks even though both PRs were "green". This is the "each PR passed but together they fail" race.

The queue fixes it by taking approved PRs one at a time, **rebasing/testing each against the latest `main` before merging**:

```
Queue: [PR-A] → test on latest main → merge
       [PR-B] → test on (main+A)    → merge
```

If a PR fails when tested against the updated `main`, it's kicked out instead of breaking `main`. This is essential on busy repos where many PRs merge per hour. It's a recap from the CI/CD world: the merge queue is how you keep continuous integration *actually* continuous without a broken trunk. The tradeoff is throughput — merges are serialised — which hosts mitigate by batching and testing several queued PRs together.

### Q12. Why do pull requests exist at all — what value do they add?

Three durable reasons, even for a team that could just push to `main`:

- **Quality gate** — required CI checks + human review catch bugs, regressions, and bad designs *before* they reach the trunk. This is the correctness function.
- **Knowledge sharing** — review spreads understanding of the change beyond its author, reduces bus-factor, and mentors juniors. The codebase stays collectively owned.
- **Audit trail** — every change has a permanent record: what changed, the discussion, who approved, which checks passed. In regulated contexts this is a compliance necessity; everywhere else it's invaluable for archaeology ("why did we do this?").

A senior candidate adds the nuance that PRs have a *cost* (latency, potential bottleneck) and that the goal is to keep them **small and fast** so the value outweighs the friction — not to turn review into ceremony.

### Q13. What is a draft PR and why open one early?

A **draft** (or WIP) PR is a pull request explicitly marked not-ready-to-merge — the merge button is disabled until you mark it ready.

You open one early to:

- **Run CI** on your work-in-progress and get fast feedback on tests/build.
- **Share visibility** — teammates can see the direction and comment before you've polished it, avoiding wasted effort on the wrong approach.
- **Signal status** — "this is in progress, don't merge, but feel free to look."

It's a lightweight way to get **early feedback and early CI** without pretending the work is done. When it's ready, you "mark as ready for review", required reviewers get requested, and it enters the normal flow. Good for de-risking a large or uncertain change before you've invested in finishing it.

### Q14. How do you link issues to PRs and why does it matter?

Most hosts auto-link and auto-close issues from PR text using keywords in the description or commit messages:

```
Closes #142
Fixes #98, resolves #201
```

When the PR merges to the default branch, those issues close automatically, and the issue and PR are cross-referenced in the UI.

Why it matters: it stitches together the **audit trail** — a reader can jump from a line of code → the PR that changed it → the issue that motivated it → the discussion and requirements. It keeps the tracker honest (issues close when the work actually ships) and gives future maintainers the *why* behind a change, not just the *what*. It's a small habit that pays off massively during incident investigation and archaeology.

### Q15. Walk me through a good end-to-end PR workflow.

```bash
git checkout -b feature/rate-limit main   # short-lived branch off trunk
# small, focused change + tests
git push -u origin feature/rate-limit
```

1. **Open a PR** with a clear title, a description explaining *why*, how to test, and `Closes #123`. Mark **draft** if still cooking.
2. **CI runs** — tests, lint, build — as required status checks.
3. **CODEOWNERS** auto-requests the right reviewers; you mark ready.
4. **Review loop** — address feedback with new (or fixup) commits; push; CI re-runs; reviewers approve.
5. **Keep it current** — rebase onto latest `main` (`--force-with-lease`) or merge `main` in if the branch is shared; branch protection requires it be up to date and green.
6. **Merge** — squash (the common default) for a single clean commit on `main`; the **merge queue** validates it against latest `main`.
7. **Auto-actions** — the linked issue closes, the branch is deleted, and (in CD) a deploy or release pipeline triggers.

The whole thing is small, reviewed, green, traceable, and fast — the PR did its three jobs: quality gate, knowledge sharing, audit trail.

## Tags & Releases

### Summary

**What this topic covers**

Tags are how you put a permanent, human-meaningful name on a specific commit — almost always to mark a release. This topic has 15 questions covering what a tag is, the crucial distinction between **lightweight** and **annotated** tags, creating/listing/deleting tags, the fact that **tags are not pushed by default**, tagging old commits, **semantic versioning** conventions, **signing** tags for supply-chain trust, `git describe` for build versioning, the difference between a raw Git tag and a **GitHub/GitLab Release**, release automation from Conventional Commits, how a tag push triggers a release pipeline, the immutability rule ("don't move a published tag"), tags vs branches, and the detached-HEAD you land in when you check one out. If branching and PRs are about integrating work, tags are about **freezing a point in history and shipping it** — the boundary between "code on main" and "a version customers run".

**Mental model**

Start from what a tag *is* at the object level. A **branch** and a **lightweight tag** are both just a ref — a file containing a commit SHA. The only difference: a branch **moves** as you commit; a tag is meant to **stay put**. An **annotated tag** is more — it's a real Git **object** (like a commit or a blob) that wraps the target SHA with a tagger name, date, message, and optionally a cryptographic signature. So there are two mental buckets: a lightweight tag is a sticky note pointing at a commit; an annotated tag is a signed, dated certificate that points at a commit. For anything you publish — a release — you want the certificate. On top of the raw Git tag, hosts layer a **Release**: the tag plus release notes, changelog, and attached binaries. The tag is the immutable anchor in history; the Release is the human-facing package built on that anchor. The golden rule that flows from immutability: **once a tag is published, never move it** — people and build systems trust that `v1.2.0` always means the exact same commit.

**Key terms**

- **Tag** — a named ref pointing at a specific commit, marking a point in history (usually a release).
- **Lightweight tag** — just a ref/pointer to a commit; no extra metadata (like a branch that never moves).
- **Annotated tag** — a full tag *object* with tagger, date, message, and optional GPG/SSH signature; preferred for releases.
- **Semantic versioning (SemVer)** — `vMAJOR.MINOR.PATCH` with optional pre-release/build metadata.
- **Signed tag** — an annotated tag with a GPG/SSH signature, verifiable with `git tag -v` for supply-chain trust.
- **`git describe`** — produces a readable name from the nearest tag + commits-since + short SHA (e.g. `v1.2.0-14-gabc123`).
- **Release (GitHub/GitLab)** — a host feature built *on* a tag: release notes, changelog, attached artifacts.
- **Detached HEAD** — the state you're in after `git checkout <tag>`: HEAD points at a commit, not a branch.
- **`--tags`** — push all tags; tags are otherwise **not** pushed with a normal `git push`.
- **Conventional Commits** — a commit-message convention that drives automated version bumps and changelogs.
- **Retagging** — moving a published tag to a new commit; dangerous and strongly discouraged.
- **`v`-prefix** — the convention of prefixing version tags with `v` (`v1.2.0`).

**Why interviewers ask this**

Tags are where release engineering meets Git, so this topic separates people who've actually *shipped* from people who've only committed. The lightweight-vs-annotated question is a reliable filter: a candidate who knows annotated tags are real objects with metadata and signatures — and that they're the right choice for releases — has thought about releases seriously. Interviewers also probe operational gotchas that bite teams: tags don't push by default (so "I tagged the release but CI didn't fire"), the danger of retagging a published version, and the difference between a Git tag and a host Release. The senior signal is connecting tags to the wider pipeline — SemVer discipline, signing for supply-chain integrity, `git describe` for build stamps, and a tag push as the trigger for an automated release pipeline.

**Common confusions**

- "A tag and a branch are the same" — both are refs, but a branch *moves* with new commits; a tag is meant to stay fixed.
- "Lightweight and annotated tags are interchangeable" — only annotated tags carry metadata and can be signed; releases should be annotated.
- "`git push` pushes my tags" — it doesn't; you must `git push origin <tag>` or `--tags` explicitly.
- "A GitHub Release is the same as a Git tag" — the Release is a host layer (notes + artifacts) *on top of* the underlying tag.
- "I can just move a tag to fix a release" — moving a published tag breaks everyone who fetched the old one; cut a new version instead.
- "Checking out a tag puts me on a branch" — it puts you in **detached HEAD**; commits there belong to no branch.

**What follows from this topic**

Tags are the payoff of the previous two topics. **Branching Strategies** decides *which commit* on trunk or a release branch becomes a version; the **PR** merges that commit to `main`; and the tag freezes it and kicks off the release. Tag-triggered pipelines tie straight back to the CI/CD world — pushing `v1.2.0` is what launches the build-and-publish workflow. And the immutability of a published tag echoes the golden rule that runs through the whole primer: once history is shared, don't rewrite it — a tag is history's most public promise.

### Q1. What is a tag in Git?

A tag is a **named pointer to a specific commit** — a way to put a permanent, human-readable label on a point in history. In practice tags almost always mark **releases**: `v1.0.0`, `v2.3.1`.

At the mechanical level, a tag is a **ref** — a small file under `.git/refs/tags/` containing a commit SHA (or, for annotated tags, pointing at a tag object that points at the commit). The defining property is that a tag is meant to be **fixed**: unlike a branch, which advances as you add commits, a tag stays pinned to the exact commit you put it on.

```bash
git tag                     # list tags
git tag v1.0.0              # tag the current commit (HEAD)
git show v1.0.0             # see what it points at
```

That fixedness is the whole point — `v1.0.0` should mean the same commit forever, so anyone can check out exactly what shipped.

### Q2. Explain the difference between lightweight and annotated tags.

| | Lightweight tag | Annotated tag |
|---|---|---|
| What it is | Just a ref → commit SHA | A full **tag object** in the database |
| Metadata | None | Tagger name, email, date, message |
| Signable | No | Yes (GPG/SSH) |
| Shows in `git describe` | Only with `--tags` | Yes, by default |
| Command | `git tag v1.0` | `git tag -a v1.0 -m "..."` |
| Use for | Temporary/local markers | **Releases** |

```bash
git tag v1.0.0                          # lightweight — like a sticky note
git tag -a v1.0.0 -m "First release"    # annotated — a dated, signable object
```

A **lightweight** tag is nothing more than a name for a commit — like a branch that never moves, with no extra information. An **annotated** tag is a real object storing *who* tagged it, *when*, *why* (message), and optionally a *signature*. For anything you publish you want annotated: it records provenance, can be cryptographically verified, and behaves correctly with `git describe`.

### Q3. Why are annotated tags preferred for releases?

Because a release is a thing you want to be **traceable and trustworthy**, and annotated tags carry the information that makes it so:

- **Metadata** — tagger, date, and a message ("Release 1.2.0 — adds webhooks") are stored in the tag object, giving a permanent record of who cut the release and why.
- **Signable** — only annotated tags can be GPG/SSH-signed, so consumers can verify the release genuinely came from you (`git tag -v v1.2.0`). This is the basis of supply-chain trust.
- **`git describe` friendly** — annotated tags are what `describe` uses by default to produce version strings, so builds off a release are named correctly.

A lightweight tag has none of this — it's just a name, with no author, date, message, or signature. Fine for a throwaway local bookmark; wrong for something the world depends on. The rule: **lightweight for local/temporary, annotated for anything published.**

### Q4. How do you create, list, and delete tags?

```bash
# create
git tag v1.2.0                       # lightweight on HEAD
git tag -a v1.2.0 -m "Release 1.2.0" # annotated on HEAD

# list
git tag                              # all tags
git tag -l "v1.*"                    # filter by pattern
git tag --sort=-v:refname            # sort by version, newest first

# inspect
git show v1.2.0                      # tag message + commit it points to

# delete (local)
git tag -d v1.2.0
```

Listing supports glob patterns (`-l "v1.*"`) and version-aware sorting (`--sort=v:refname`), which matters once you have dozens of releases. Deleting a *local* tag is just `-d`; deleting a tag that's already on the remote is a separate step (covered next) because tags don't sync automatically. Creating a tag defaults to `HEAD` unless you name a specific commit.

### Q5. Why do I need to push tags separately, and how?

Because **tags are not included in a normal `git push`.** A plain `push` sends branch commits, not tags — so a freshly created tag stays local until you push it explicitly. This is the classic "I tagged the release but the release pipeline never fired" bug.

```bash
git push origin v1.2.0        # push one specific tag
git push origin --tags        # push all local tags
git push --follow-tags        # push branch + annotated tags reachable from it
```

To delete a tag on the remote (deleting locally isn't enough):

```bash
git push origin --delete v1.2.0
# or the older refspec form:
git push origin :refs/tags/v1.2.0
```

`--follow-tags` is a nice middle ground for release work: it pushes your commits plus the *annotated* tags that point into them, without dragging along every stray lightweight tag. The takeaway: **creating a tag is local; publishing it is a deliberate, separate act.**

### Q6. How do you tag a commit that isn't the current HEAD?

Pass the target commit's SHA (or any ref) to `git tag`:

```bash
git tag -a v1.0.0 9fceb02 -m "Backdated 1.0 release"
git tag v0.9.0 HEAD~5                     # 5 commits back
git tag -a v1.1.0 origin/main -m "..."    # any ref works
```

This is common when you realise you forgot to tag a release at the time it shipped — you find the commit that actually went out and tag it retroactively. The tag object still records the *current* date as the tagging time (for annotated tags), but it points at the historical commit. Use `git log --oneline` or `git show <sha>` first to confirm you're tagging exactly the commit that shipped, since the whole value of the tag is pointing at the right one.

### Q7. How does semantic versioning apply to tags?

Semantic Versioning (SemVer) gives tags a meaningful, machine-parseable structure: **`MAJOR.MINOR.PATCH`**, conventionally with a `v` prefix.

- **MAJOR** — incompatible/breaking API changes (`1.x` → `2.0.0`).
- **MINOR** — new, backward-compatible functionality (`1.2` → `1.3.0`).
- **PATCH** — backward-compatible bug fixes (`1.2.0` → `1.2.1`).

Extensions:
- **Pre-release**: `v1.3.0-rc.1`, `v2.0.0-beta.2` — a hyphen and identifiers; sorts *before* the final release.
- **Build metadata**: `v1.3.0+build.42` — a plus sign; ignored for precedence.

```bash
git tag -a v2.0.0-rc.1 -m "Release candidate"
git tag --sort=-v:refname          # version-aware sort respects SemVer
```

The **`v`-prefix** (`v1.2.0`) is a widespread convention that makes version tags visually distinct and easy to match in tooling. SemVer's payoff is that consumers can reason about upgrade risk from the number alone — a patch bump is safe, a major bump means "read the migration guide".

### Q8. How and why do you sign tags?

You sign a tag so consumers can **cryptographically verify it came from you** — the foundation of supply-chain trust for releases.

```bash
git tag -s v1.2.0 -m "Signed release 1.2.0"    # GPG-sign (or SSH if configured)
git tag -v v1.2.0                               # verify the signature
```

`-s` creates an annotated tag with a GPG (or SSH, via `gpg.format=ssh`) signature embedded in the tag object. Anyone who fetches it can run `git tag -v` to confirm the signature matches a trusted key — proving the tag wasn't forged or tampered with. Hosts show a "Verified" badge on signed tags/releases.

Why it matters: if an attacker can push a malicious tag pretending to be your `v1.2.0`, downstream builds pull compromised code. Signing makes that detectable. It's increasingly expected for security-sensitive projects and is why annotated tags (the only signable kind) are the right default for releases. Requiring signed tags can also be enforced via branch/tag protection rules.

### Q9. What is `git describe` and what is it for?

`git describe` turns a commit into a **human-readable version string** based on the nearest annotated tag:

```bash
$ git describe
v1.2.0-14-gabc1234
```

Read that as: the nearest tag is `v1.2.0`, you are **14 commits** past it, and the current commit's short SHA is `abc1234` (the `g` prefix means "git"). If you're exactly on a tag, it just prints the tag name.

Its main use is **build/version stamping**: CI embeds `git describe` output into a binary or `--version` string so any build — even an untagged dev build between releases — has a precise, traceable identifier. You can immediately tell how far a build is from a known release and exactly which commit it came from.

```bash
git describe --tags        # also consider lightweight tags
git describe --always      # fall back to a bare SHA if no tag
git describe --dirty       # append "-dirty" if the working tree has changes
```

### Q10. What's the difference between a Git tag and a GitHub/GitLab Release?

A **Git tag** is a low-level ref in the repository — a name pointing at a commit. A **Release** (GitHub, GitLab) is a **host feature built on top of a tag** that adds a human-facing package:

| Git tag | GitHub/GitLab Release |
|---|---|
| A ref/object in the repo | A host UI object tied to a tag |
| Points at a commit | Adds **release notes / changelog** |
| No attachments | Can attach **binaries/artifacts** (installers, archives) |
| Created with `git tag` | Created in the UI/API, referencing a tag |

So the tag is the **immutable anchor in history**; the Release is the **story and the downloads** wrapped around it — release notes, an auto-generated changelog, and compiled artifacts users can download without building from source. Creating a Release will create the underlying tag if it doesn't exist. Modern hosts also **auto-generate release notes** from merged PRs since the last release, turning the tag into a polished, shippable package.

### Q11. How is release tagging automated from commit messages?

Tools like **semantic-release** and **release-please** automate the entire cut-a-release step by reading **Conventional Commits**:

```
feat: add webhook support        → MINOR bump
fix: correct rounding error      → PATCH bump
feat!: drop Node 16 support      → MAJOR bump (the ! / BREAKING CHANGE)
```

On merge to `main`, the tool scans commits since the last tag, computes the next SemVer number from the commit *types*, generates a changelog, creates the **annotated tag**, and publishes a **Release** — all without a human choosing the version. `feat` → minor, `fix` → patch, `BREAKING CHANGE`/`!` → major.

This is a direct recap-tie to the CI/CD primer: the automation runs *in* the pipeline, so the version, tag, changelog, and release are a byproduct of merging well-formatted commits. The payoff is consistency (no human misjudges the bump) and traceability (every release maps to specific commits). The prerequisite is discipline: the whole thing only works if the team writes Conventional Commit messages.

### Q12. How does pushing a tag trigger a release pipeline?

CI systems can watch for **tag pushes** and run a dedicated pipeline only when a version tag appears — this is the standard "tag to release" pattern.

```yaml
# GitHub Actions
on:
  push:
    tags:
      - 'v*'        # run only when a tag like v1.2.0 is pushed
```

So the flow is: merge to `main` → decide to release → create an annotated tag → **push the tag** → the tag-triggered pipeline builds, tests, signs, and publishes the artifacts / creates the Release. The tag is the **explicit release signal**, separate from the every-commit CI that runs on `main`.

This is exactly why "tags don't push by default" is such a common gotcha here: if you tag locally but forget `git push origin v1.2.0`, the release pipeline never fires and nothing ships. In this model the tag is both a historical marker *and* the trigger — one action records the version and launches the release.

### Q13. Why must you never move a published tag?

Because a tag is a **promise that a name maps to an exact commit**, and people and machines rely on it:

- Teammates who fetched `v1.2.0` have one commit; if you retag it to a different commit, their `v1.2.0` and the remote's now silently disagree.
- Build systems, package managers, and Docker images pinned to `v1.2.0` will pull *different code* than before — a reproducibility and security nightmare.
- Anyone who verified a signed `v1.2.0` now has a tag whose meaning changed under them.

Git even resists it: a `git pull` won't fast-forward a moved tag; consumers must force-update, and many won't notice they need to. The correct fix for a bad release is **never retag** — cut a **new version** (`v1.2.1`) with the correction. The only defensible time to delete/replace a tag is within seconds of creating it, before anyone has fetched it. Once published, treat a tag as **immutable**. Tag protection rules can enforce this at the host level.

### Q14. Tags vs branches — what's the real difference?

Both are **refs** — files containing a commit SHA — but their *intent and behaviour* differ:

| | Branch | Tag |
|---|---|---|
| Moves? | **Yes** — advances with each commit | **No** — pinned to one commit |
| Purpose | A line of ongoing development | A fixed marker (usually a release) |
| Checkout | Puts you *on* the branch | Puts you in **detached HEAD** |
| Types | One kind | Lightweight or annotated |

The key insight: when you commit on a branch, the branch ref moves forward to the new commit — that's its whole job. A tag is meant to **stay put** so `v1.0.0` always means the same commit. A lightweight tag is literally "a branch that doesn't move." That's why you develop *on* branches and *mark* points with tags — one tracks a moving frontier, the other freezes a moment.

### Q15. Walk me through cutting a release, and what happens when you check out a tag.

A typical "cut a release" flow:

```bash
git checkout main
git pull                                   # be on the exact commit to ship
git tag -a v1.4.0 -m "Release 1.4.0"       # annotated (signable) tag
# or signed:  git tag -s v1.4.0 -m "..."
git push origin v1.4.0                      # publish it — triggers release CI
```

Then the pipeline builds/tests/signs artifacts and the host creates a **Release** with notes and downloads (often auto-generated from PRs since `v1.3.0`).

**Checking out a tag** puts you in **detached HEAD** — HEAD points directly at the tagged commit, not at any branch:

```bash
git checkout v1.4.0
# "You are in 'detached HEAD' state..."
```

You can inspect and build here, but any commits you make belong to **no branch** and will be lost once you move away (recoverable only via reflog). If you need to work from a release — say, to start a hotfix — create a branch from the tag first:

```bash
git checkout -b hotfix/1.4.1 v1.4.0
```

That's the safe pattern: tags are read-only anchors; branch off them before doing work.
## Git Internals Deep Dive

### Summary

**What this topic covers**

The layer beneath every Git command: the **content-addressable object database** that actually stores your project. Three concern areas live here: (1) the **four object types** — blob, tree, commit, tag — and how they compose into a full snapshot; (2) **content-addressing** — every object is hashed by SHA (SHA-1 today, migrating to SHA-256), which gives Git deduplication, integrity, and immutability for free; and (3) **storage & maintenance** — loose objects vs packfiles, delta compression at storage time, refs and HEAD as plain files, the index, and garbage collection. The 16 questions in this topic turn "Git stores snapshots not diffs" from a slogan into something you can defend at a whiteboard, including the apparent contradiction that packfiles *do* use deltas. Master this and the rest of the primer (rebase, reset, reflog, filter-repo) stops being magic — it's all just moving pointers and re-hashing objects.

**Mental model**

Think of `.git` as a tiny content-addressed key-value store plus some pointers. The store lives in `.git/objects`: you hand it bytes, it hands you back a SHA (the key); hand it the SHA later and it returns the exact bytes. Everything Git tracks is one of four object types in that store. A **commit** is a snapshot: it points at exactly one **tree** (your whole project root at that moment), plus parent commit SHA(s), author/committer, and a message. A tree points at **blobs** (file contents) and sub-trees (subdirectories). Because the key is a hash of the content, two identical files anywhere in history are stored once. Change one byte and you get a new blob → a new tree for its directory → new trees up to the root → a new commit SHA. That cascade is why a commit hash pins the entire snapshot and why history is tamper-evident: you can't alter an old commit without every descendant's SHA changing. On top of the object store sit **refs** — files like `.git/refs/heads/main` that just contain a commit SHA. A branch is a movable pointer; HEAD points at the current branch. That's the whole architecture.

**Key terms**

- **blob** — raw file contents, zlib-compressed. No filename, no metadata — just bytes keyed by their hash.
- **tree** — a directory listing: rows of `mode type SHA name` pointing at blobs and sub-trees.
- **commit** — a snapshot: one root tree SHA + parent commit SHA(s) + author + committer + message.
- **tag object** — an annotated tag: points at an object (usually a commit) + tagger + message; stored as its own object.
- **content-addressing** — the object's key is the SHA of `header + content`; identical content → identical key → stored once.
- **SHA-1 → SHA-256** — the hash algorithm; Git is migrating to SHA-256 for collision resistance.
- **loose object** — a single object in its own zlib-compressed file under `.git/objects/xx/`.
- **packfile** — many objects compressed together into one `.pack` (+ `.idx`), using delta compression between similar objects.
- **ref** — a file containing a SHA (branch, tag, remote-tracking). `HEAD` is a symbolic ref pointing at the current branch.
- **index** — the staging area: a binary file (`.git/index`) listing the next commit's tree.
- **reachability** — an object is reachable if you can walk to it from a ref or HEAD; unreachable objects are GC candidates.
- **DAG** — the directed acyclic graph of commits linked by parent pointers.

**Why interviewers ask this**

This is the topic that separates people who *use* Git from people who *understand* it. (1) **Depth signal** — anyone can run `git commit`; explaining that a commit is a tree-pointer plus parent-pointers, hashed, shows you've read past the porcelain. (2) **Debugging capability** — engineers who understand the object graph can recover "lost" work, reason about why a rebase changed every downstream SHA, and diagnose repo bloat; those who don't are stuck. (3) **The snapshots-vs-diffs question** is a classic trap: the naive answer ("Git stores diffs") is wrong at the data-model level but right at the *storage* level (packfile deltas). A senior candidate holds both ideas at once and explains where the boundary is. Getting that nuance right is a strong senior tell.

**Common confusions**

- "Git stores diffs between commits" — no; each commit references a tree = the *complete* state. Deltas exist only in packfiles as a storage optimization, not in the data model.
- "A blob knows its filename" — it doesn't. The name lives in the *tree* that points at the blob. Move a file with identical content and the blob is reused.
- "The SHA is a hash of the file" — it's a hash of `type + length + content` (the object header + content), which is why `git hash-object` and a plain `sha1sum` disagree.
- "Deleting a branch deletes the commits" — it only removes a pointer; the commits become *unreachable* but survive until GC prunes them past the reflog grace period.
- "`git gc` is dangerous / deletes my work" — it only prunes *unreachable* objects older than the expiry window; anything on a branch, tag, or in the reflog is safe.
- "Amending or rebasing edits a commit in place" — objects are immutable; you always get a *new* commit with a new SHA and the branch pointer is moved to it.

**What follows from this topic**

Once you see commits as immutable, content-addressed snapshots linked into a DAG, the rest of Git is corollaries. Rewriting History & Recovery is "make new objects, move pointers, and rely on the reflog because the old objects linger until GC." Branching and rebase are "move/replay pointers in the DAG." Submodules, Subtrees & Large Repos is largely about what happens to the object database at scale — packfiles, partial clone, and Git LFS all manage object storage. If the object model is fuzzy, those topics feel like memorized incantations; once it's solid, they're derivable.

### Q1. What are the four object types in Git's object database?

Everything Git stores is one of four immutable, content-addressed objects:

- **blob** — the raw contents of a file. No filename, no permissions, no timestamp — just the bytes. Two files with identical content share one blob.
- **tree** — a directory. A list of entries, each `mode type SHA name`, pointing at blobs (files) and other trees (subdirectories). This is where filenames live.
- **commit** — a snapshot. Points at exactly one root **tree**, one or more **parent** commit SHAs, plus author, committer, timestamps, and the message.
- **tag** — an *annotated* tag object: points at another object (usually a commit) with a tagger, date, and message. (Lightweight tags are just refs, not objects.)

They compose bottom-up: blobs → trees → commit → (optionally) tag. A commit + its reachable trees + blobs *is* the complete project at that point in time.

```bash
git cat-file -t <sha>   # print the type: blob | tree | commit | tag
git cat-file -p <sha>   # pretty-print the content
```

### Q2. How do blobs, trees, and commits compose into a snapshot?

A commit points at one **root tree**. That tree lists the top-level files (as blobs) and directories (as sub-trees). Each sub-tree lists its own files and directories, recursively, down to every blob. Walk the whole thing and you have the entire working tree at that commit — a full snapshot, not a delta.

```
commit 9a3f...
  └─ tree 4b8c...            (project root)
       ├─ blob e69d...  README.md
       ├─ blob a1b2...  package.json
       └─ tree 7c1a...  src/
            ├─ blob 55ef...  index.js
            └─ blob 90cd...  util.js
```

Because directories are just trees pointing at content by hash, an unchanged subdirectory across two commits is the *same tree object*, reused. Only the path from the changed file up to the root gets new objects.

### Q3. If Git stores snapshots, why do we say identical content is stored once?

Because storage is keyed by **content hash**, not by path or commit. The object's key is the SHA of its bytes, so the same bytes always map to the same key — and the store keeps one copy.

- Two files with identical content → one blob, referenced by two tree entries.
- A file unchanged across 100 commits → one blob, referenced by 100 trees.
- An unchanged directory → the same tree object reused across commits.

So "snapshot per commit" and "content stored once" aren't in tension: each commit *references* a full tree, but the trees and blobs are deduplicated by hash. A new commit only creates new objects for what actually changed plus the trees on the path to the root.

### Q4. How does content-addressable storage work — what exactly gets hashed?

Git prepends a header to the content, then hashes the whole thing:

```
<type> <byte-length>\0<content>
```

That string (e.g. `blob 11\0hello world`) is hashed with SHA-1 to produce the object ID, then the object is zlib-compressed and written to `.git/objects/`. This is why `git hash-object` and `sha1sum` on the raw file give different results — Git hashes the *header + content*, not the bare bytes.

```bash
echo -n 'hello world' | git hash-object --stdin   # 95d09f2b10159347eece71399a7e2e907ea3df4f
printf 'blob 11\0hello world' | sha1sum            # same hash — proving the header formula
```

Content-addressing gives three properties at once: **deduplication** (same content → same key), **integrity** (re-hash and compare to detect corruption), and **immutability** (change any byte → different key → a different object).

### Q5. Why does content-addressing make history tamper-evident and immutable?

Because a commit's hash depends on its content, which *includes* its tree SHA and its parent SHA(s). To alter anything about an old commit — a file, the message, the author — you change its content, so its SHA changes. But the next commit stored the *old* SHA as its parent, so now that child is inconsistent unless you also rewrite it, which changes *its* SHA, and so on down to the branch tip.

```
A ← B ← C ← D   (each arrow = "parent is")
```

Tamper with `B` and you must rewrite `B C D`, producing entirely new SHAs. That's exactly what a history rewrite (rebase, `filter-repo`) does — and why everyone downstream must re-clone. It also means a commit SHA is a cryptographic fingerprint of *all* history reachable from it: if two people have the same commit SHA, they provably have the same tree and the same ancestry. SHA-256 migration hardens this against deliberate collisions.

### Q6. How do you inspect Git objects from the command line?

```bash
git cat-file -t <sha>          # type of an object
git cat-file -p <sha>          # pretty-printed content
git cat-file -s <sha>          # size in bytes

git rev-parse HEAD             # resolve a ref/name to a full SHA
git rev-parse HEAD:src/app.js  # resolve a path in a commit to its blob SHA

git ls-tree HEAD               # list the root tree of HEAD (mode type sha name)
git ls-tree -r HEAD            # recurse into subdirectories

echo -n 'hi' | git hash-object --stdin      # compute an object's SHA
git hash-object -w file.txt                 # ...and write it into the object store
```

A useful drill: `git cat-file -p HEAD` shows the commit (its tree + parents); `git cat-file -p <that-tree>` shows the directory; `git cat-file -p <a-blob>` shows a file. You've just walked the object graph by hand.

### Q7. What are refs and HEAD, really?

**Refs are files containing a SHA.** A branch `main` is literally `.git/refs/heads/main`, whose contents are the 40-char SHA of the tip commit. "Moving a branch" means writing a new SHA into that file. That's why branching is O(1) and cheap.

**HEAD** is a *symbolic* ref: `.git/HEAD` usually contains `ref: refs/heads/main`, i.e. "I'm on branch main." Commit while on a branch and Git updates the branch file, then HEAD still points at the branch. **Detached HEAD** means `.git/HEAD` contains a raw SHA instead of a `ref:` line — you're on a commit, not a branch.

```bash
cat .git/HEAD                  # ref: refs/heads/main
cat .git/refs/heads/main       # the tip SHA
git symbolic-ref HEAD          # refs/heads/main
```

For efficiency Git also stores many refs together in `.git/packed-refs` (a single file) rather than thousands of tiny loose files.

### Q8. What's the difference between loose objects and packfiles?

**Loose objects** — every new object starts as its own file: zlib-compressed, stored at `.git/objects/ab/cdef...` (first two hex chars = directory). Simple, but wasteful at scale (millions of tiny files, no cross-object compression).

**Packfiles** — `git gc`/`git repack` bundle many objects into a single `.pack` file with a companion `.idx` index for O(log n) lookup. Inside a packfile Git uses **delta compression**: similar objects (e.g. successive versions of the same file) are stored as one full base plus small deltas against it. This is dramatically smaller.

```bash
git gc                    # pack loose objects, prune, optimize
git verify-pack -v .git/objects/pack/pack-*.idx   # inspect pack contents & deltas
```

Key point: deltas are a **storage-time** optimization inside packfiles. They are *not* the data model — logically every object is still a full, independent snapshot addressed by hash.

### Q9. Git "stores snapshots, not diffs" — so why do packfiles use deltas?

Because "snapshots vs diffs" is a statement about the **data model**, while delta compression is about **physical storage**. They operate at different layers:

- **Data model** — each commit references a tree that captures the *complete* state. There is no "diff from the previous commit" recorded anywhere; Git computes diffs on demand for display. Contrast with older VCS (RCS, older SVN) that stored per-file deltas as the source of truth.
- **Storage layer** — when packing, Git notices many objects are similar and stores some as deltas against a chosen base to save space. This is invisible to the model: unpack the delta and you get the full object back, hash and all.

So the honest answer is: *conceptually* snapshots, *physically* deltas-in-packfiles. Git gets the reasoning simplicity of snapshots and the disk efficiency of deltas without the model ever depending on diffs.

### Q10. What is garbage collection in Git, and what makes an object unreachable?

`git gc` does housekeeping: packs loose objects into packfiles, coalesces packed-refs, expires reflog entries, and **prunes unreachable objects** older than a grace window (default ~2 weeks, `gc.pruneExpire`).

An object is **reachable** if you can walk to it from any ref (branch, tag, remote-tracking ref, stash) or from HEAD or the reflog. Anything you can't reach — e.g. commits orphaned by a `reset --hard`, a deleted branch's tip, or a rebased-away commit — is **unreachable** and eventually collectible.

```bash
git gc                         # normal maintenance
git gc --prune=now             # prune immediately (skips the grace window — riskier)
git fsck --unreachable         # list unreachable objects
git fsck --lost-found          # dump dangling commits/blobs for recovery
```

The reflog is what keeps "unreachable" from meaning "immediately gone" — it holds references to recent tips, giving you a recovery window before GC actually deletes anything.

### Q11. What is the index (staging area) at the file level?

The index is a single **binary file** at `.git/index`. It's a sorted list of entries — path, blob SHA, mode, and cached stat data (size, mtime, inode) — that describes the tree your *next* commit will record. It sits between the working directory and HEAD (the "three trees").

- `git add` writes the working-tree version of a file into the object store as a blob and updates that file's index entry to point at it.
- `git commit` turns the current index into a tree (or reuses existing trees), creates a commit pointing at it, and moves the branch.
- The cached stat data lets `git status` skip re-hashing unchanged files — it compares stat info first, which is why status is fast.

```bash
git ls-files --stage           # dump index entries: mode sha stage path
git status                     # working dir vs index vs HEAD
```

### Q12. Take me on a tour of the .git directory.

```
.git/
  HEAD          symbolic ref → current branch (or a raw SHA if detached)
  index         the staging area (binary)
  config        repo-local config (remotes, user, options)
  objects/      the object database
    ab/cdef...  loose objects (zlib-compressed)
    pack/       *.pack + *.idx packfiles
  refs/
    heads/      local branches (each file = one SHA)
    tags/       tags
    remotes/    remote-tracking branches (e.g. origin/main)
  packed-refs   many refs collapsed into one file
  logs/         reflogs — history of where HEAD and each branch pointed
  hooks/        client-side hook scripts (pre-commit, etc.)
  info/, description, COMMIT_EDITMSG, ORIG_HEAD ...
```

Almost everything here is a plain file. That's why most Git operations — `log`, `diff`, `branch`, `checkout` — are fast **local file reads** with no network: the entire history lives in `objects/` and the pointers live in `refs/`.

### Q13. Why are most Git operations local and fast?

Because a clone is a **full copy** of the repository — the entire object database and all refs — sitting on your disk. Commands that other VCS need a server for are local file reads here:

- `git log`, `git diff`, `git blame` — walk objects already in `.git/objects`.
- `git branch`, `git checkout`, `git commit` — read/write small ref files and add objects locally.
- `git status` — compares working dir, index, and HEAD, using cached stat data to avoid re-hashing.

Only `fetch`, `pull`, `push`, and `clone` touch the network. This is the practical payoff of Git being a **distributed** VCS: you can commit, branch, diff, and browse full history on a plane with no connection. The trade-off is that every clone carries the full history, which is what motivates shallow/partial clone and LFS for very large repos (see the Large Repos topic).

### Q14. How does deleting a branch differ from deleting its commits?

Deleting a branch (`git branch -d`/`-D`) only removes the **ref file** — the pointer. The commits it pointed at still exist in the object database; they're just now potentially **unreachable** if no other ref or HEAD reaches them.

```
A---B---C   (main)
     \
      D---E   (feature)   ← delete "feature"
```

After deleting `feature`, commits `D` and `E` are unreachable *if nothing else points at them*. But:

- They stay in `.git/objects` until GC prunes them past the grace window.
- The branch's last tip is recorded in the **reflog** (`git reflog`), so you can recover it: find `E`'s SHA and `git branch feature <sha>`.

So a branch delete is reversible for a while — the data lingers. Only `git gc` (after the reflog expires) actually reclaims the space.

### Q15. How do commit-graph and generation numbers speed Git up?

Walking the commit DAG for operations like `git log --graph`, merge-base finding, or `--contains` can be slow on huge histories because it means parsing many commit objects. The **commit-graph** file (`.git/objects/info/commit-graph`) is an auxiliary cache that stores commit metadata (parents, tree, dates) in a compact, fast-to-read binary form, plus **generation numbers** — each commit's distance from a root.

Generation numbers let Git prune graph walks: to test ancestry or find a merge base, it can skip commits whose generation number proves they can't be relevant, instead of walking every parent. This turns some operations from O(history) into something far cheaper.

```bash
git commit-graph write --reachable    # build/refresh it (often automatic via gc)
git config fetch.writeCommitGraph true
```

It's pure acceleration — no change to the object model, just a cache. Related perf features: `fsmonitor` (filesystem-watch for fast status) and `scalar`/partial clone for very large repos.

### Q16. Walk me through resolving a commit down to a single file's content.

Given a commit SHA, you walk the object graph one hop at a time:

```bash
# 1. The commit points at a root tree (and parents).
git cat-file -p HEAD
#   tree 4b8c...
#   parent 1f2e...
#   author ...

# 2. Read the root tree — it lists top-level entries.
git cat-file -p 4b8c...
#   100644 blob e69d...  README.md
#   040000 tree 7c1a...  src

# 3. Descend into the subdirectory tree.
git cat-file -p 7c1a...
#   100644 blob 55ef...  index.js

# 4. Read the blob — the actual file bytes.
git cat-file -p 55ef...
```

Git gives you a shortcut for the whole walk:

```bash
git rev-parse HEAD:src/index.js   # → 55ef...  (resolves the path to its blob)
git cat-file -p HEAD:src/index.js # → the file contents at that commit
```

Doing it by hand once — commit → tree → sub-tree → blob — is the single best way to internalize that Git is just a graph of content-addressed objects.

## Submodules, Subtrees & Large Repos

### Summary

**What this topic covers**

How Git handles *composition* (embedding one repo in another) and *scale* (repos too big for Git's defaults). Three concern areas: (1) **submodules** — pinning an external repo inside yours by commit SHA, and the operational friction that comes with it; (2) **subtrees** — merging another repo's contents into a subdirectory of yours with no extra metadata for consumers; and (3) **large-repo strategy** — monorepo vs polyrepo, and the toolbox for keeping big repos fast: shallow clone, partial clone, sparse-checkout, Git LFS, commit-graph, fsmonitor, and Scalar. The 15 questions here are the "we outgrew a simple repo" conversation: how do you vendor a dependency, structure many projects, and stop a repo from getting slow or bloated. It builds directly on the object-database internals — every technique here is really about *which objects get fetched, stored, or checked out*.

**Mental model**

Two axes. First, **composition**: when project A needs project B's code, you have three options ordered by coupling. A **package manager** (npm, Cargo, Maven) is loosest — B is a versioned artifact, A just declares a dependency; prefer this by default. A **submodule** sits in the middle — A stores a *pointer* (B's commit SHA) and B's history stays separate; good when you need source-level pinning and B evolves independently. A **subtree** is tightest for consumers but heaviest in history — B's files are *copied into* A's tree and its history merged in, so anyone cloning A just gets the files, no extra commands. Second, **scale**: Git assumes you fetch and check out *everything*. That breaks down with huge history, giant files, or millions of files. The fixes each attack one dimension — shallow clone drops old *history*, partial clone drops *blobs* until needed, sparse-checkout drops *paths* from the working tree, and LFS moves *big binaries* out of the main object store. Pick the tool by which dimension is hurting.

**Key terms**

- **submodule** — a nested repo pinned at a specific commit; the parent records a **gitlink** (the SHA) plus a `.gitmodules` file with its URL and path.
- **gitlink** — the special tree entry (mode `160000`) that stores a submodule's commit SHA instead of a blob/tree.
- **.gitmodules** — tracked config file mapping submodule paths to their repo URLs.
- **subtree** — another repo merged into a subdirectory of yours; its files live directly in your tree.
- **monorepo** — one repository holding many projects/services.
- **polyrepo** — many repositories, typically one per project/service.
- **shallow clone** — `--depth N`, fetching only the most recent N commits of history.
- **partial clone** — `--filter=blob:none` (etc.), fetching commits/trees now and blobs lazily on demand.
- **sparse-checkout** — materializing only a subset of paths in the working tree.
- **Git LFS** — Large File Storage; stores big binaries in a side store, keeping a small text **pointer** in the repo.
- **.gitattributes** — per-path config; used to route file patterns through LFS (`filter=lfs`).
- **Scalar / fsmonitor** — Microsoft's large-repo manager and a filesystem watcher that speeds up `git status`.

**Why interviewers ask this**

Because it's where architecture meets Git. (1) **Judgment signal** — "submodule, subtree, or package?" has no single right answer; a good candidate reasons about coupling, who consumes the code, and operational cost rather than reciting one favorite. (2) **Scale awareness** — knowing *why* Git slows on big repos (every clone gets all history and all blobs) and which lever fixes which symptom shows you've operated real repos, not just toy ones. (3) **The LFS / big-binary question** catches a common mistake: committing large binaries directly, which bloats every clone forever because history is immutable. Senior engineers know to keep binaries out or in LFS from day one, and know that fixing it after the fact means rewriting history.

**Common confusions**

- "A submodule stores a copy of the other repo" — it stores a *pointer* (a commit SHA). The contents come from a separate clone under the hood; forget `--recurse-submodules` and you get empty directories.
- "Submodules auto-update with the parent" — they don't. A submodule stays pinned until someone explicitly moves the pointer and commits it.
- "Subtree and submodule are basically the same" — opposite trade-offs: submodule = pointer + separate history + extra clone steps; subtree = copied-in files + merged history + zero extra steps for consumers.
- "Just commit the big binary, disk is cheap" — every clone downloads *every version* of it forever; the repo bloats permanently until you rewrite history.
- "Shallow and partial clone are the same" — shallow drops old *commits*; partial keeps all commits but defers *blobs*. Different dimensions.
- "Monorepo means one giant merge conflict" — with proper tooling (sparse-checkout, Nx/Bazel/Turborepo, CI targeting changed projects) big monorepos scale; the challenge is tooling, not merges.

**What follows from this topic**

Everything here is the object database under pressure. Shallow/partial clone and LFS are decisions about *which objects to fetch and store* — pure Git Internals applied. Removing an accidentally-committed large file requires the history-rewrite machinery from Rewriting History & Recovery (a new commit that deletes it doesn't shrink the repo — the blob is in every prior commit). And the monorepo-vs-polyrepo choice interacts with branching strategy and CI. Treat this topic as "internals at scale": if you're solid on objects, packfiles, and reachability, these are applied engineering decisions rather than new concepts.

### Q1. What is a Git submodule and when would you use one?

A submodule embeds one repository inside another at a **pinned commit**. The parent repo doesn't store the submodule's files as blobs; it stores a **gitlink** — a tree entry (mode `160000`) holding the submodule's commit SHA — plus a tracked `.gitmodules` file mapping the path to the submodule's URL.

```bash
git submodule add https://example.com/acme/libfoo.git vendor/libfoo
# creates .gitmodules and a gitlink at vendor/libfoo pointing at libfoo's current commit
```

Use a submodule when you want to **vendor a dependency at source level, pinned and separately versioned**: shared internal library, a plugin, a spec repo consumed by several projects. You get exact reproducibility (the parent records the precise commit) while the submodule keeps its own independent history and can be developed in isolation. The cost is workflow friction (next question). In many cases a package/artifact dependency is simpler — reach for a submodule only when you specifically need the source pinned in-tree.

### Q2. What are the main pain points with submodules?

- **Extra clone step** — a fresh `git clone` leaves submodule directories *empty*. You must run `git submodule update --init --recursive` (or clone with `--recurse-submodules`). Forgetting this is the #1 "why is the folder empty?" bug.
- **Detached HEAD inside the submodule** — `submodule update` checks out a raw commit, so the submodule is in detached HEAD. Edit without first `git checkout main` inside it and your commits are easy to lose.
- **Two-step updates** — to bump the dependency you commit inside the submodule, push it, then go to the parent and commit the moved pointer. Easy to forget half of it, leaving teammates on a stale pin.
- **Easy to forget entirely** — pulls don't update submodules unless you pass `--recurse-submodules` (or set `submodule.recurse=true`).

```bash
git clone --recurse-submodules <url>
git submodule update --init --recursive
git config submodule.recurse true          # make pull/checkout recurse by default
```

None of this is fatal, but it's why teams often prefer a package manager or subtree.

### Q3. What is git subtree and how does it differ from a submodule?

`git subtree` merges another repo's history **into a subdirectory** of yours. The other project's files then live directly in your tree — there's no pointer, no `.gitmodules`, no special step for anyone who clones you.

```bash
git subtree add   --prefix=vendor/libfoo https://example.com/acme/libfoo.git main --squash
git subtree pull  --prefix=vendor/libfoo https://example.com/acme/libfoo.git main --squash
git subtree push  --prefix=vendor/libfoo https://example.com/acme/libfoo.git main
```

| | Submodule | Subtree |
|---|---|---|
| What's stored | A pointer (commit SHA) + `.gitmodules` | The actual files, merged in |
| Clone experience | Needs `--recurse-submodules`/`update` | Just works — files are there |
| History | Kept separate | Merged into your history (heavier) |
| Update workflow | Commit in sub, then bump pointer | `subtree pull`/`push --prefix` |
| Contributing upstream | Natural (it's a real repo) | Harder (`subtree push` splits it out) |
| Best for | Pinned, independently-versioned source | Vendoring that must be frictionless for consumers |

Rule of thumb: submodule when the embedded repo is actively co-developed and pinning matters; subtree when you want consumers to see plain files with zero extra commands.

### Q4. Submodule vs subtree vs package manager — how do you choose?

Order by coupling, and default to the loosest that works:

- **Package manager (npm/Cargo/Maven/pip)** — the default. The dependency is a versioned, published artifact; your repo just declares `libfoo@^2.1`. Clean separation, semantic versioning, no repo-in-repo mechanics. Choose this unless you specifically need source in-tree.
- **Submodule** — when you need the *source* pinned at an exact commit and the dependency has its own release/history you don't control or want to track precisely (internal shared lib, a forked upstream). Cost: clone/update friction.
- **Subtree** — when you want the source in-tree *and* a frictionless experience for everyone who clones (no submodule steps), and you're okay with heavier history and clumsier upstream contribution.

Practical guidance: if there's a real package registry for it, use it. Submodule/subtree are for cases where publishing an artifact isn't practical or you need in-repo source with exact pinning.

### Q5. Monorepo vs polyrepo — what are the trade-offs?

**Monorepo** — many projects in one repo.

- Pros: **atomic cross-project changes** (one commit/PR spans API + client + shared lib), shared tooling and config, easy code sharing and discoverability, one source of truth, simpler large-scale refactors.
- Cons: repo grows huge (needs the scaling tools below), CI must be smart about only building affected projects, access control is coarse-grained, and tight coupling can creep in without discipline.

**Polyrepo** — one repo per project/service.

- Pros: clear ownership boundaries, independent versioning/release cadence, smaller/faster clones, natural access control per repo.
- Cons: cross-cutting changes span many PRs (no atomicity), dependency/version drift between repos, duplicated tooling, harder discoverability.

Google, Meta, and Microsoft run massive monorepos precisely because atomic changes and shared tooling outweigh the scale cost *once you invest in tooling*. Smaller orgs often do fine with polyrepo. The deciding factors are how coupled your projects are and whether you'll invest in monorepo tooling (Nx, Bazel, Turborepo).

### Q6. Why does Git slow down on very large repositories?

Three independent dimensions, each with its own cause:

- **Deep history** — millions of commits make graph walks (`log`, blame, merge-base) and full clones expensive. Mitigations: commit-graph cache, shallow clone.
- **Many files** — a huge working tree makes `git status` slow because Git stats every file. Mitigations: fsmonitor (watch the filesystem instead of scanning), sparse-checkout (don't materialize most files).
- **Large blobs** — big binaries bloat the object database, and since history is immutable, *every version ever committed* ships in every clone forever. Mitigations: Git LFS, or don't commit binaries at all.

Understanding which dimension hurts tells you which lever to pull. A repo can be fine on two axes and painful on the third — e.g. a small codebase that someone committed a 2 GB dataset into has a blob problem, not a history or file-count problem.

### Q7. What is a shallow clone and when do you use one?

A shallow clone fetches only the most recent commits, truncating history:

```bash
git clone --depth 1 https://example.com/acme/app.git        # just the tip
git fetch --depth 1                                          # keep it shallow on update
git fetch --unshallow                                        # later, backfill full history
```

The classic use is **CI/CD**: a build only needs the current source, not 10 years of history, so `--depth 1` slashes clone time and bandwidth. Also handy for quickly grabbing a huge repo you only want to read.

Caveats: shallow clones limit operations that need history — `git log` is truncated, `git blame` and `merge-base` may be incomplete, and some servers restrict pushing from shallow clones. It drops *commits* (the history dimension); if your problem is big *files*, shallow clone won't help — you want LFS or partial clone.

### Q8. What is a partial clone and how does it differ from shallow?

A **partial clone** keeps *all* commit history but defers downloading *file contents* (blobs) until you actually need them:

```bash
git clone --filter=blob:none https://example.com/acme/app.git   # commits+trees now, blobs on demand
git clone --filter=blob:limit=1m <url>                          # skip blobs over 1 MB
```

When you check out a commit or run `git blame`, Git lazily fetches the missing blobs from the server. Contrast with shallow clone, which drops old *commits* but downloads all blobs for the ones it keeps. Different dimensions:

- **Shallow** — full blobs, truncated history. Good when you don't need old commits.
- **Partial** — full history, lazy blobs. Good when history matters but you don't want to download every file version up front — ideal for big monorepos, especially with sparse-checkout so you only ever hydrate the paths you touch.

Partial clone is the more flexible modern option for large repos where you still need to walk history.

### Q9. What is sparse-checkout and why is it essential for big monorepos?

Sparse-checkout materializes only a **subset of paths** in your working tree, even though the repo tracks everything. In a monorepo with 500 projects, you check out just the two you work on.

```bash
git sparse-checkout init --cone
git sparse-checkout set apps/web libs/shared     # only these paths appear on disk
git sparse-checkout list
```

The index still knows about all files, but Git skips writing the excluded ones to disk, so `status`, `checkout`, and builds only touch your slice. Combined with **partial clone** (`--filter=blob:none`), you never even download the blobs for paths you don't check out — the two together are what make a multi-gigabyte monorepo usable on a laptop. "Cone" mode restricts patterns to directory prefixes, which keeps performance predictable versus arbitrary gitignore-style patterns.

### Q10. What is Git LFS and what problem does it solve?

**Git LFS (Large File Storage)** keeps large binaries out of the main object database. Matching files are replaced in the repo by a tiny **text pointer** (an OID + size); the real bytes live in a separate LFS store and are fetched on checkout.

```bash
git lfs install
git lfs track "*.psd" "*.mp4" "*.bin"    # writes rules into .gitattributes
git add .gitattributes design/hero.psd
git commit -m "Add hero asset via LFS"
```

The problem it solves: Git history is immutable and every clone gets every version of every file *forever*. Commit a 200 MB binary and edit it ten times, and every clone downloads ~2 GB of dead weight permanently. LFS breaks that by versioning only small pointers in Git while the heavy content sits in a store that fetches on demand (and can be pruned locally). Use it from day one for design assets, media, datasets, compiled artifacts — anything big and binary.

### Q11. Why shouldn't you commit large binaries directly into Git?

Because of immutability + full-history clones. When you commit a binary:

- It's stored as a blob and referenced by that commit forever. **Deleting it in a later commit doesn't remove it** — every prior commit still contains it, so it's still in every clone.
- Binaries don't delta-compress well (unlike text), so they don't shrink much in packfiles.
- Every `git clone` downloads *all* versions of the file across all history. Ten edits of a 200 MB file = ~2 GB permanently added to clone size and repo size.

The result is a repo that's slow to clone and never gets smaller on its own. The two correct approaches are: keep big binaries **out** of Git (artifact store, object storage, CDN) or route them through **Git LFS** so only pointers are versioned. If a big file is *already* committed, shrinking the repo requires a **history rewrite** (`git filter-repo`) — see the Rewriting History topic.

### Q12. How does .gitattributes configure LFS (and what else is it for)?

`.gitattributes` assigns per-path attributes. For LFS, `git lfs track` writes filter rules into it so matching files are transparently swapped for pointers on commit and restored on checkout:

```
*.psd  filter=lfs diff=lfs merge=lfs -text
*.mp4  filter=lfs diff=lfs merge=lfs -text
```

`filter=lfs` runs the clean/smudge filters that convert file↔pointer; `-text` marks them binary so Git won't try line-ending conversion or textual diffs.

`.gitattributes` also controls non-LFS behavior: line-ending normalization (`* text=auto`, `*.sh text eol=lf`), marking files binary (`*.png binary`), custom diff/merge drivers, and `export-ignore` for `git archive`. It's tracked in the repo so every clone gets the same rules — important, because LFS only works if everyone shares the same tracking config.

### Q13. What other tooling speeds up large repositories?

Beyond clone/checkout filtering:

- **commit-graph** — a cached binary index of commit metadata with generation numbers; makes `log`, merge-base, and ancestry checks much faster. Often written automatically during `gc`/`fetch`.
- **fsmonitor** — a background filesystem watcher (Watchman or the built-in monitor) so `git status` consults recent-change notifications instead of stat-ing every file. Huge win on large working trees.
- **Scalar** — Microsoft's opinionated large-repo manager (now shipped with Git) that turns on partial clone, sparse-checkout (cone), commit-graph, fsmonitor, and background maintenance with one command (`scalar clone`).
- **Background maintenance** — `git maintenance start` schedules incremental repacks, commit-graph updates, and prefetches so you don't pay a big `gc` cost interactively.

```bash
git config core.fsmonitor true
git config core.untrackedcache true
git maintenance start
scalar clone https://example.com/acme/huge-monorepo.git
```

These are pure accelerators — they change performance, not the object model.

### Q14. How do you remove an accidentally-committed large file to shrink the repo?

Deleting it in a new commit is **not** enough — the blob remains in every earlier commit, so the repo size doesn't drop. You must **rewrite history** to purge it from all commits:

```bash
# modern tool (install separately)
git filter-repo --path assets/huge.zip --invert-paths
# or strip everything over a size threshold
git filter-repo --strip-blobs-bigger-than 10M
```

Then force-push and have everyone re-clone (the SHAs of all touched commits change). Afterward, `git gc --prune=now` reclaims the disk space locally.

Consequences to call out: this rewrites every downstream commit SHA, so it's disruptive — coordinate with the team, exactly like removing a secret. Going forward, prevent recurrence by adding the pattern to `.gitignore`, routing big files through **LFS**, or adding a pre-receive size check. Full mechanics live in the Rewriting History & Recovery topic.

### Q15. Pick an approach: a team needs to share a design-heavy asset folder and a common library across three apps.

Two different problems, two different tools:

- **The common library** → prefer a **package/artifact dependency** (publish `@acme/shared` to a private registry) so each app pins a version and upgrades on its own schedule. If it must be in-source and actively co-developed with the apps, put everything in a **monorepo** so changes are atomic — otherwise a **submodule** pinned by commit gives source-level pinning across three separate app repos. A **subtree** works if you want the library files present with zero clone-time steps, at the cost of heavier history.
- **The design-heavy assets** → **Git LFS** from the start (`git lfs track "*.psd" "*.png"`), so the big binaries live in a side store and clones stay small. Never commit them raw — every version would live in every clone forever.

If the three apps are tightly coupled and change together, I'd lean monorepo + LFS + sparse-checkout: atomic cross-app changes, small working trees per developer, and binaries kept lean. If they're independently owned and released, polyrepo with a published shared package + LFS in whichever repo holds the assets.

## Rewriting History & Recovery

### Summary

**What this topic covers**

The surgical tools for changing history that's already recorded — and the safety net for when something goes wrong. Three concern areas: (1) **rewriting** — `commit --amend`, interactive rebase, `reset`, and `git filter-repo` for bulk history surgery (secrets, big files, author emails, subdirectory extraction); (2) **the consequences** — why rewriting shared history breaks everyone downstream, and how to coordinate it safely with `--force-with-lease` and branch protection; and (3) **recovery** — the reflog as the primary undo, `git fsck` for orphaned objects, and walkthroughs for recovering deleted branches and clobbered force-pushes. The 16 questions here are the highest-stakes Git you'll be asked: getting a secret out of history, undoing a bad `reset --hard`, and rescuing `main` after someone force-pushed over it. It's the object model (immutable objects, movable refs, the reflog) applied under pressure.

**Mental model**

Rewriting history never *edits* a commit — objects are immutable. It always creates **new** commits and moves a branch pointer to them; the old commits become unreachable but linger until GC. That single fact drives everything here. Rank the tools by blast radius: **amend** rewrites just the last commit; **interactive rebase** rewrites a run of recent commits; **reset** moves a branch pointer (optionally discarding work with `--hard`); **filter-repo** rewrites *every* commit in the repo. The more history you rewrite, the more downstream SHAs change, and the more people you disrupt — hence the golden rule: don't rewrite history others have based work on, *unless* you must (removing a secret) and you coordinate. The recovery side is the mirror image: because rewrites only move pointers and orphan objects rather than deleting them, the **reflog** — Git's log of where HEAD and branches have pointed — lets you find the old tip and point a branch back at it. Almost every "I destroyed my work" situation is recoverable within the GC window by reading the reflog.

**Key terms**

- **`git commit --amend`** — replace the last commit with a new one (new SHA) carrying updated content/message.
- **interactive rebase** — `git rebase -i` to reorder, squash, edit, drop, or reword a run of commits (all rewritten).
- **`git reset`** — move the current branch to another commit; `--soft`/`--mixed`/`--hard` decide what happens to index and working tree.
- **`git filter-repo`** — the modern tool to rewrite entire history (remove files/secrets, change emails, extract subdirs). Replaces `filter-branch`/BFG.
- **history rewrite** — producing new commit SHAs for existing logical commits; requires a force-push and re-clone downstream.
- **reflog** — a local log of every position HEAD and each branch has held; the primary recovery mechanism.
- **`git revert`** — a *new* commit that undoes a prior one; safe on shared history (no rewrite).
- **`--force` vs `--force-with-lease`** — overwrite the remote; lease refuses if the remote moved since your last fetch.
- **`git fsck`** — integrity check; `--lost-found`/`--dangling` surface orphaned commits and blobs.
- **dangling/unreachable object** — an object no ref reaches; recoverable until GC prunes it.
- **branch protection** — server-side rules blocking force-push/deletion of protected branches (e.g. `main`).
- **GC window** — the grace period before unreachable objects are actually pruned; your recovery deadline.

**Why interviewers ask this**

This is where interviewers probe whether they can trust you with a shared repo. (1) **Judgment under danger** — do you know that `reset --hard` and force-push are recoverable *and* that they hurt teammates? The best answer pairs the mechanism with the coordination. (2) **The secret-removal question** is a favorite because the naive answer (delete it and commit) is *wrong twice*: it doesn't purge history, and it ignores that the secret must be **rotated** because it's already been pushed and cloned. (3) **Recovery composure** — "you force-pushed and clobbered a teammate's commits, get them back" tests whether you reach for the reflog calmly or panic. Knowing the object model turns these from scary into routine, which is exactly the senior signal they're listening for.

**Common confusions**

- "Amend/rebase edit commits in place" — no; they create new commits with new SHAs and move the branch. The originals linger in the reflog.
- "Deleting a secret in a new commit removes it" — it's still in every prior commit. You must rewrite history *and* rotate the secret.
- "`--force` and `--force-with-lease` are the same" — lease refuses to overwrite if the remote advanced since your last fetch, protecting a teammate's just-pushed work; plain `--force` clobbers unconditionally.
- "A bad `reset --hard` loses my work permanently" — the previous tip is in the reflog (`HEAD@{1}`); reset back to it. Recoverable until GC.
- "`revert` and `reset` are interchangeable" — revert adds a new inverse commit (safe on shared branches); reset moves the pointer (rewrites, unsafe on shared branches).
- "Once GC runs it's hopeless" — often true, but a teammate's up-to-date clone or the server's own reflog/refs may still have the commits.

**What follows from this topic**

This is the capstone that ties the primer together. It leans on Git Internals (immutable objects, refs as pointers, reachability, the reflog, GC) and on the reset/revert/rebase mechanics from the branching and undoing topics. It connects to Large Repos — removing an accidentally-committed big file is the same `filter-repo` machinery as removing a secret. And it defines the team-coordination rules that make collaborative workflows safe: the golden rule about shared history, `--force-with-lease`, and branch protection on `main`. If you can explain both how to rewrite history and how to recover from a rewrite gone wrong, you understand Git.

### Q1. What are the three levels of history rewriting, from safest to most dangerous?

Rank by how much history — and how many people — a rewrite touches:

- **Local rewrite of recent commits** — `git commit --amend` (last commit) and `git rebase -i` (a run of recent commits). Safe *if those commits are only local*; you're polishing before sharing.
- **Moving a branch pointer** — `git reset` (especially `--hard`) repositions your branch to another commit, potentially discarding commits and working-tree changes. Local and recoverable via reflog, but destructive to uncommitted work.
- **Bulk rewrite of all history** — `git filter-repo` rewrites *every* commit in the repo (remove a file from all history, change all author emails, extract a subdirectory). Maximum blast radius: every SHA changes, everyone must re-clone.

The through-line: none of these edit objects in place — they create new commits and move pointers, orphaning the old ones (recoverable via reflog). Danger scales with how much you rewrite and, crucially, whether that history is **shared**. Rewriting purely local commits is routine; rewriting pushed history is a coordinated team event.

### Q2. What does `git commit --amend` do, and when is it unsafe?

`git commit --amend` replaces the most recent commit with a new one. It's used to fix the last commit's message or fold in a forgotten change:

```bash
git commit --amend -m "Fix typo in payment handler"   # rewrite the message
git add forgotten.js && git commit --amend --no-edit   # add a file to the last commit
```

Crucially it does **not** edit the commit — it creates a *new* commit (new SHA, same-ish content) and moves the branch to it. The original is now unreachable (but in the reflog).

It's unsafe once the commit is **already pushed and others have it**: amending then requires a force-push, and anyone who based work on the old commit now has a divergent history. Amend freely on local, unpushed commits; coordinate (and use `--force-with-lease`) if it's already shared.

### Q3. How does interactive rebase let you rewrite recent commits?

`git rebase -i <base>` opens a to-do list of the commits after `<base>`, and you choose an action per commit:

```
pick   a1b2c3  Add login form
squash d4e5f6  Fix validation      # fold into previous
reword 7890ab  Add tests           # edit the message
drop   cdef01  Debug logging       # remove entirely
```

Actions: `pick` (keep), `reword` (change message), `edit` (stop to amend), `squash`/`fixup` (combine into the prior commit), `drop` (delete), and reordering by moving lines. Git replays the list, creating **new commits** for everything from the first change onward — so every rewritten commit (and its descendants) gets a new SHA.

Use it to clean up a messy feature branch before opening a PR: squash "WIP" commits, fix messages, drop debug commits. Same golden rule: only rebase commits you haven't shared, or coordinate a force-push if you have.

### Q4. Recap `git reset` — how do --soft, --mixed, and --hard differ?

`git reset <commit>` moves the current branch pointer to `<commit>`. The flag decides what happens to the **index** and **working tree**:

| Mode | Branch moves | Index reset | Working tree | Use for |
|---|---|---|---|---|
| `--soft` | Yes | No | No | Recommit differently; changes stay staged |
| `--mixed` (default) | Yes | Yes | No | Unstage changes; keep edits in working tree |
| `--hard` | Yes | Yes | Yes | Discard everything back to `<commit>` |

```bash
git reset --soft HEAD~1     # undo last commit, keep changes staged
git reset HEAD~1            # undo last commit, keep changes unstaged (--mixed)
git reset --hard HEAD~1     # undo last commit AND discard its changes
git reset --hard origin/main   # force local branch to match remote (throws away local commits)
```

`--hard` is the dangerous one — it discards uncommitted work irrecoverably (uncommitted changes aren't in the object store) but *committed* work it drops is still recoverable via the reflog.

### Q5. What is git filter-repo and why is it preferred over filter-branch and BFG?

`git filter-repo` is the modern tool for rewriting **entire** history across all commits and branches. It's the recommended replacement for two older tools:

- **`git filter-branch`** — built-in but notoriously *slow* (spawns processes per commit), error-prone, and officially discouraged by Git's own docs.
- **BFG Repo-Cleaner** — faster than filter-branch but limited to a few operations (deleting files, replacing text).

`filter-repo` is fast, safe-by-default (it refuses to run on a repo with uncommitted changes and works on a fresh clone), and far more capable:

```bash
git filter-repo --path secrets.env --invert-paths          # remove a file from all history
git filter-repo --strip-blobs-bigger-than 10M              # purge large blobs everywhere
git filter-repo --mailmap mailmap.txt                      # rewrite author/committer emails
git filter-repo --path libs/shared --path-rename libs/shared/:   # extract a subdir as new repo
```

It's a separate install (`pip install git-filter-repo`), not shipped with Git. Whatever it does, the result is the same: every touched commit gets a new SHA, so it's always followed by a force-push and a team re-clone.

### Q6. Walk me through removing a committed secret (API key) from history.

Two mandatory parts — miss either and you're not safe.

**1. Rotate the secret first.** This is non-negotiable and comes *first*: the key has already been pushed, cloned, cached by CI, and possibly scraped by bots. Rewriting history does **not** un-leak it. Revoke the old key and issue a new one immediately.

**2. Purge it from all history:**

```bash
# remove the whole file from every commit
git filter-repo --path config/secrets.env --invert-paths
# or redact just the string, keeping the file
git filter-repo --replace-text <(echo 'AKIA1234EXAMPLE==>REDACTED')

git push --force-with-lease --all
git push --force-with-lease --tags
```

**3. Coordinate the fallout.** Every SHA changed, so tell the team to re-clone (or hard-reset to the rewritten remote). Delete stale forks/branches that still contain the secret, and check that CI logs, caches, and any mirrors don't retain it.

The interview trap: candidates who only do step 2 fail, because the secret is already out. "Rewrite *and* rotate" is the complete answer.

### Q7. Why doesn't removing a file in a new commit actually purge it from history?

Because history is **immutable** and each commit references a full snapshot. Deleting `secrets.env` and committing only records that the file is *absent going forward* — every earlier commit still points at a tree that still points at the blob with the secret.

```
A---B---C---D   (D "removes" secrets.env)
    ^   ^
    files still present in the trees of B and C
```

Anyone can `git show B:secrets.env` or check out commit `C` and read it. The blob remains in the object database, reachable through those old commits, and ships in every clone. To *truly* remove it you must rewrite every commit that ever contained it (`git filter-repo`), which produces new SHAs for those commits and everything after — followed by a force-push, a team re-clone, and (for a secret) rotation.

### Q8. What are the consequences of rewriting shared history?

Because rewriting produces **new SHAs** for every affected commit, the rewritten branch and the copies on everyone else's machines **diverge**:

```
before:  A---B---C           (everyone has this)
after:   A---B'---C'         (you rewrote B and C → new commits)
```

- You can only publish it with a **force-push** (the histories aren't fast-forwardable).
- Teammates who pull get a mess — their local `B`/`C` don't match `B'`/`C'`; naive pulls create duplicate commits or ugly merges. They must **re-clone** or `git reset --hard origin/<branch>` (losing local work not yet pushed).
- Open PRs, CI pipelines, and tags pinned to old SHAs break.
- Anyone who branched off the old commits is now stranded on orphaned history.

That's the **golden rule**: don't rewrite history others have based work on. The sanctioned exceptions — removing a secret or a huge file — are worth the disruption, but you *coordinate*: announce it, pick a quiet window, force-push with `--force-with-lease`, and walk the team through re-syncing.

### Q9. What's the difference between --force and --force-with-lease?

Both overwrite the remote branch, but lease adds a safety check.

- **`git push --force`** — unconditionally overwrite the remote with your local branch. If a teammate pushed after your last fetch, you *silently delete their commits*.
- **`git push --force-with-lease`** — push only if the remote is still at the SHA you last saw (your remote-tracking ref). If someone else pushed in the meantime, the remote moved, the lease is broken, and the push is **rejected** — so you don't clobber work you never saw.

```bash
git push --force-with-lease origin feature/login   # refuses if origin/feature/login advanced
```

Always prefer `--force-with-lease`. It turns "I destroyed a teammate's commit" into "push rejected, let me fetch and look." It's not a substitute for coordination — it protects against the *unknown* push, but you should still announce a shared-history rewrite. (Note: `--force-with-lease` needs an accurate remote-tracking ref, so don't pair it with a background `git fetch` that would update the lease behind your back.)

### Q10. What is the reflog and why is it your primary recovery tool?

The **reflog** records every position `HEAD` (and each branch) has held locally — every commit, checkout, reset, rebase, merge, and amend. Even when an operation makes commits *unreachable* from any branch, the reflog still references them, so they're not GC'd and you can get them back.

```bash
git reflog                     # HEAD's recent positions, newest first
git reflog show main           # a specific branch's history of tips
```

```
a1b2c3 HEAD@{0}: reset: moving to HEAD~3
d4e5f6 HEAD@{1}: commit: Add feature   ← the work you "lost"
7890ab HEAD@{2}: commit: Fix bug
```

To recover, point a branch (or reset) back at the pre-disaster entry:

```bash
git reset --hard HEAD@{1}          # undo the bad reset
git checkout -b rescue d4e5f6      # or grab the lost commit onto a new branch
```

It's **local** and **per-clone** — the reflog on your machine only knows your operations. That's why a teammate's clone can sometimes recover what your reflog can't, and vice versa. It's the first thing to reach for in almost any "I lost commits" situation, valid until GC prunes past the expiry window (default ~90 days for reachable, ~30 for unreachable).

### Q11. I ran `git reset --hard` and lost commits — how do I get them back?

Stay calm — `reset --hard` moved your branch pointer but the old commits are still in the object store, referenced by the reflog.

```bash
git reflog                       # find the entry just before the reset
# a1b2c3 HEAD@{0}: reset: moving to HEAD~2
# d4e5f6 HEAD@{1}: commit: Important work   ← this is the tip you want

git reset --hard HEAD@{1}        # move your branch back to it
# or, non-destructively:
git branch recovered d4e5f6      # create a branch at the lost tip
```

Caveat: `reset --hard` also discards **uncommitted** working-tree changes, and those were never in the object store, so they're genuinely gone (unless you'd `git add`-ed them — staged blobs can sometimes be found via `git fsck --lost-found`). Anything that was **committed** is recoverable via the reflog within the GC window. Once you've confirmed the recovery, you're back to normal.

### Q12. How do you recover a deleted branch or a dangling commit?

**Deleted branch** — the commits survive; you just lost the pointer. Find the tip and recreate it:

```bash
git reflog                          # look for "checkout: moving from feature/login ..." or the commit
git branch feature/login <tip-sha>  # recreate the branch at its old tip
```

If the branch tip isn't in HEAD's reflog (e.g. you never had it checked out recently), fall back to `git fsck`:

```bash
git fsck --lost-found               # writes dangling commits/blobs under .git/lost-found
git fsck --dangling                 # list dangling objects
git log --oneline <dangling-sha>    # inspect a candidate to confirm it's the one
git branch recovered <dangling-sha> # rescue it
```

`git fsck` finds objects no ref points to — the safety net when the reflog can't help (e.g. after the reflog entry expired but before GC pruned the object). All of this works because deleting a branch removes a *pointer*, not the *objects*, which linger until GC.

### Q13. Someone force-pushed and clobbered main — walk me through recovering it.

The old commits still exist *somewhere*; the force-push only moved the remote pointer. Work through the sources in order:

**1. The pusher's reflog.** Whoever force-pushed has the previous tip in their local reflog:

```bash
git reflog show origin/main        # or HEAD reflog on their machine
git push --force-with-lease origin <good-sha>:main   # restore the remote
```

**2. Any up-to-date clone.** A teammate (or a CI runner) who fetched before the bad push has the real `main` tip. From that machine:

```bash
git log --oneline origin/main      # confirm it has the good history
git push --force-with-lease origin <good-sha>:main
```

**3. The server's own reflog / refs.** Many hosts (GitHub, GitLab, self-hosted) keep server-side reflogs or ref snapshots; admins can restore, or you can find the dangling commit via the host UI/API.

**4. Local object stores.** Even a plain `git fetch` may have left the old objects in someone's `.git`; `git fsck --dangling` can surface them.

Then **restore and prevent recurrence**: turn on **branch protection** so `main` can't be force-pushed, and announce the fix so nobody re-clobbers. The lesson to state: this is recoverable precisely because force-push moves a pointer and orphans objects rather than deleting them — but it's disruptive, which is why protecting `main` matters.

### Q14. How does reverting a merge differ from rewriting history?

**`git revert`** creates a *new* commit that applies the inverse of a prior commit. It doesn't touch existing history, so it's **safe on shared branches** — everyone just pulls the new commit. That's the right tool for undoing something already pushed to `main`.

Reverting a **merge** commit needs `-m` to pick which parent is "mainline":

```bash
git revert -m 1 <merge-sha>   # undo the merge, keeping parent 1 (the branch you merged INTO)
```

The subtlety: reverting a merge undoes the *changes* it brought in, but the branch is still recorded as merged. If you later want to re-merge that feature, Git thinks it's already integrated, so you often have to revert the revert (or rebase the feature) to bring it back in. 

Contrast with a **history rewrite** (`reset`/`rebase`/`filter-repo`) that *removes* the merge as if it never happened — cleaner history but requires a force-push and breaks everyone downstream. Rule of thumb: on shared branches, **revert** (add an inverse commit); rewrite only on unshared history or coordinated exceptions.

### Q15. When should you NOT rewrite history?

Don't rewrite history that others have already based work on — the golden rule. Specifically avoid it when:

- The commits are **pushed to a shared branch** (`main`, a release branch, anything teammates pull). Rewriting forces a disruptive re-clone/hard-reset on everyone.
- Others have **branched off** or opened PRs against those commits — you'll strand their work on orphaned history.
- You just want to *undo* something on a shared branch — use `git revert` (a new inverse commit) instead; it's safe and needs no force-push.

The sanctioned exceptions are **removing a leaked secret** or **a repo-bloating large file** from all history — cases where the value of purging outweighs the disruption. Even then you *coordinate*: announce it, pick a low-activity window, use `--force-with-lease`, and walk the team through re-syncing. The default posture: rewrite freely on **local, unshared** commits (clean up before pushing); once it's shared, prefer additive fixes (revert) unless there's a compelling, coordinated reason.

### Q16. How long do you have to recover lost commits before GC removes them?

Recovery works because unreachable objects linger before pruning — but there's a deadline. Two config windows govern it:

- **`gc.reflogExpire`** (default **90 days**) — how long reachable reflog entries are kept.
- **`gc.reflogExpireUnreachable`** (default **30 days**) — how long reflog entries for *unreachable* commits (the ones you'd recover) are kept.

`git gc` (run automatically when loose objects accumulate) expires reflog entries past these windows and then prunes objects that nothing — no ref, no reflog — reaches, subject to `gc.pruneExpire` (default ~2 weeks). So in practice you usually have **weeks** to recover a lost commit, not minutes.

Two caveats: a manual `git gc --prune=now` or `git reflog expire --expire=now --all` collapses the window to *zero* and can destroy recoverable commits immediately — don't run those while trying to recover. And even after your local objects are gone, a **teammate's clone** or the **server's refs/reflog** may still hold the commits. Until GC actually runs, `git fsck --lost-found` remains your backstop for orphaned objects.
## Configuration, Hooks & Attributes

### Summary

**What this topic covers**

How Git is *configured* and *extended* per-machine, per-repo, and per-path — the layer between "Git the object model" and "Git the way your team actually runs it." Three concern areas: (1) **git config** — the layered settings system (system → global → local → worktree), the settings that matter (identity, editor, default branch, pull/push behaviour, conflict style, rerere, credential helper), and **aliases** to shorten your workflow; (2) **`.gitignore` and `.gitattributes`** — the two versioned control files that tell Git what to skip and how to treat specific paths (line-ending normalization, binary handling, LFS filters, diff/merge drivers, linguist stats); and (3) **git hooks** — event-triggered scripts (client-side pre-commit/commit-msg/pre-push, server-side pre-receive/update/post-receive) that enforce policy, plus the critical caveat that hooks are *local and unversioned* so teams share them via frameworks (pre-commit, Husky, lefthook) and enforce on the server/CI. The 15 questions here separate people who use Git out of the box from people who have *set up* Git for a team.

**Mental model**

Think of Git config as **cascading overrides**, exactly like CSS. The most specific scope wins. A read of any setting walks: system (`/etc/gitconfig`, whole machine) → global (`~/.gitconfig`, your user) → local (`.git/config`, this repo) → worktree (if `extensions.worktreeConfig` is on). Later, more-specific files override earlier ones. `.gitignore` and `.gitattributes`, by contrast, are **versioned** and **path-scoped** — they travel with the repo and apply rules by file glob. Hooks are the **event system**: Git fires named scripts at lifecycle points (before commit, after receive), and the script's exit code can *veto* the operation (non-zero on pre-commit aborts the commit). The single most important mental correction: **client-side hooks are advisory, not security**. Anyone can `--no-verify` or just not install them. Real enforcement lives server-side (pre-receive) or in CI/branch-protection. Config shapes *your* experience; hooks and attributes shape the *repo's* behaviour; only server-side controls bind *everyone*.

**Key terms**

- **config scope** — system / global / local / worktree; precedence increases toward local.
- **`core.excludesfile`** — points at a global gitignore (patterns you want ignored in every repo, e.g. `.DS_Store`).
- **alias** — a saved subcommand; `alias.co = checkout`, or a shell alias with a leading `!` to run arbitrary commands.
- **`.gitignore`** — versioned list of untracked paths Git should not surface; does **not** un-track already-tracked files.
- **`.gitattributes`** — versioned per-path settings: `text`/`eol` normalization, `-diff`/`-merge` for binaries, `filter` (LFS), `linguist-*`, `export-ignore`.
- **`text=auto` / `core.autocrlf`** — line-ending normalization; store LF in the repo, check out platform-native.
- **hook** — an executable in `.git/hooks/` (or `core.hooksPath`) fired on an event; non-zero exit can abort.
- **client-side hook** — `pre-commit`, `prepare-commit-msg`, `commit-msg`, `pre-push`; advisory, bypassable with `--no-verify`.
- **server-side hook** — `pre-receive`, `update`, `post-receive`; run on the remote, the real enforcement point.
- **rerere** — "reuse recorded resolution"; remembers how you resolved a conflict and replays it.
- **credential helper** — caches or stores credentials (`osxkeychain`, `manager`, `cache`) so you don't retype them.
- **hook manager** — pre-commit framework / Husky / lefthook; versions and shares hooks via the repo.

**Why interviewers ask this**

This topic sorts "I clone and commit" from "I own the repo's setup." Juniors often don't know config is layered, think `.gitignore` un-tracks files, or believe a pre-commit hook *guarantees* linted code. Seniors know the precedence order, reach for `--show-origin` to debug a mystery setting, know `git rm --cached` is how you stop tracking an already-committed file, and — most tellingly — can articulate *why client hooks can't be trusted for enforcement* and where real gates live (server hooks, CI, branch protection). The `.gitattributes` line-ending question is a classic filter: everyone who's shipped cross-platform has been burned by CRLF-vs-LF, and the answer reveals whether you've operated Git in a mixed Windows/Unix team. "How would you enforce commit standards across a team?" is the senior capstone — the right answer names hook managers *and* server-side/CI enforcement, not just "add a pre-commit hook."

**Common confusions**

- "Adding a file to `.gitignore` stops Git tracking it" — no. `.gitignore` only affects **untracked** files. An already-committed file keeps being tracked until `git rm --cached`.
- "`--global` config lives in the repo" — no, it's `~/.gitconfig`, per-user. `--local` (`.git/config`) is per-repo and wins over global.
- "A pre-commit hook guarantees clean commits" — anyone can `git commit --no-verify`, and hooks aren't cloned. Enforce in CI.
- "Hooks are shared when I push them" — `.git/hooks/` is **not** versioned. You share hooks via a managed dir + `core.hooksPath` or a tool like pre-commit/Husky.
- "`core.autocrlf=true` everywhere" — that's the Windows setting; on macOS/Linux you want `input`, or better, commit a `.gitattributes` with `* text=auto` so it's not per-machine.
- "`.gitattributes` and `.gitignore` are the same kind of file" — both versioned and glob-based, but ignore says *skip this*, attributes says *treat this path this way*.

**What follows from this topic**

Config and attributes underpin everything else: the LFS `filter` here connects to large-file handling and repo bloat in **Scenario & Troubleshooting Playbooks**; `rerere.enabled` and `merge.conflictStyle=zdiff3` make the conflict-resolution playbooks far less painful. Hooks are the client-side half of a story whose server-side/CI half lives in **Git in CI/CD & at Scale** — the "client hooks are advisory, CI enforces" thread runs straight into branch protection and required status checks. If you can configure Git for a team here, the CI topic is about making that enforcement *binding*.

### Q1. What are the levels of git config and how does precedence work?

Four scopes, read in order, most-specific wins:

| Scope | File | Flag | Applies to |
|---|---|---|---|
| System | `/etc/gitconfig` | `--system` | Every user on the machine |
| Global | `~/.gitconfig` (or `~/.config/git/config`) | `--global` | Your user, all repos |
| Local | `.git/config` | `--local` (default) | This one repo |
| Worktree | `.git/config.worktree` | `--worktree` | One worktree (needs `extensions.worktreeConfig`) |

Reads cascade: local overrides global overrides system. Writes default to local when inside a repo.

```bash
git config --global user.name "alice"      # set for all your repos
git config user.email "alice@acme.test"    # set for THIS repo only (local)
git config --list --show-origin            # every setting + which file it came from
git config --show-origin user.email        # debug: which file wins for one key
```

`--show-origin` is the answer to "why is my commit author wrong in this repo" — it shows exactly which file set the value.

### Q2. Which git config settings do you set on a new machine?

Identity first (Git refuses to commit without it), then quality-of-life:

```bash
git config --global user.name  "alice"
git config --global user.email "alice@acme.test"

git config --global init.defaultBranch main
git config --global pull.rebase true          # rebase on pull, no ugly merge commits
git config --global push.autoSetupRemote true # first push creates the upstream for you
git config --global push.default simple

git config --global merge.conflictStyle zdiff3  # show the common ancestor in conflicts
git config --global rerere.enabled true          # remember conflict resolutions
git config --global core.editor "code --wait"    # or vim/nano
git config --global fetch.prune true             # drop deleted remote branches on fetch
git config --global diff.colorMoved zebra        # highlight moved lines
```

On Windows add `core.autocrlf=true`; on macOS/Linux `input` (or rely on `.gitattributes`). Set `credential.helper` per-platform (Q11). This is the "senior clones onto a fresh laptop" answer — identity + sane pull/push + conflict ergonomics.

### Q3. How do git aliases work? Give useful examples.

Aliases live under the `[alias]` section. A plain value shorthands a subcommand; a leading `!` runs an arbitrary shell command.

```bash
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.st "status -sb"
git config --global alias.last "log -1 HEAD"
git config --global alias.unstage "restore --staged"

# Pretty one-line graph log:
git config --global alias.lg "log --graph --oneline --decorate --all"

# Shell alias (leading !) — can call multiple commands / take args:
git config --global alias.cleanup '!git branch --merged main | grep -v main | xargs -r git branch -d'
```

Now `git co`, `git lg`, `git unstage <file>`. The `!` form runs from the repo root and can chain commands — useful for anything a single subcommand can't express. Keep destructive aliases (like `cleanup`) obvious so you don't fire them by accident.

### Q4. What is `.gitignore` and how do its patterns work?

`.gitignore` is a versioned list of glob patterns for paths Git should **not** track or nag you about. It only affects **untracked** files.

Pattern rules:
- `build/` — trailing slash matches directories only.
- `*.log` — glob; ignores all `.log` files.
- `!important.log` — leading `!` **negates** (re-includes) a previously ignored path.
- `/config` — leading slash anchors to the `.gitignore`'s own directory (root, not nested).
- `**/temp` — `**` matches across directory levels.
- `#` — comment; blank lines ignored.

Precedence: patterns are read top-to-bottom, later wins; a per-directory `.gitignore` (nested) overrides the root for that subtree. You *cannot* re-include a file if its parent directory is ignored — un-ignore the directory first, then re-ignore its contents.

### Q5. I added a file to `.gitignore` but Git still tracks it. Why?

Because `.gitignore` **only applies to untracked files**. Once a file is committed, Git keeps tracking it regardless of ignore rules. You must remove it from the index (while keeping it on disk):

```bash
git rm --cached secrets.env      # stop tracking, keep the local file
echo "secrets.env" >> .gitignore
git commit -m "Stop tracking secrets.env"
```

For a whole directory: `git rm -r --cached build/`. This is a top-3 real-world Git gotcha. The mnemonic: **`.gitignore` prevents adds, `git rm --cached` undoes a past add.** (If it was a *secret*, also rotate it and consider history rewrite — see the secrets playbook.)

### Q6. How do you debug why a file is or isn't ignored?

`git check-ignore -v` tells you exactly which pattern (and which file) decides:

```bash
git check-ignore -v build/output.o
# .gitignore:4:build/    build/output.o   <- matched by line 4

git check-ignore -v src/keep.log
# (no output, exit 1) -> the file is NOT ignored
```

The `-v` (verbose) output is `<source>:<line>:<pattern>\t<path>`, so you see whether a root `.gitignore`, a nested one, or the global excludes file matched. Empty output + exit code 1 means nothing ignores it. This beats staring at your ignore files trying to reason out precedence and negation by hand.

### Q7. What is a global gitignore and when do you use it?

A gitignore that applies to **every** repo on your machine, for things that are about *your environment*, not the project — editor swap files, OS cruft, personal tooling.

```bash
git config --global core.excludesfile ~/.gitignore_global
# then edit ~/.gitignore_global:
#   .DS_Store
#   *.swp
#   .idea/
#   .vscode/
```

The rule of thumb: **project-specific ignores go in the repo's `.gitignore`** (so teammates share them); **your-machine ignores go in the global excludes** (so you don't force `.DS_Store` rules on a Linux teammate, or your JetBrains `.idea/` on a VS Code team). Keeping OS/editor noise out of the repo's `.gitignore` is a courtesy that scales.

### Q8. What is `.gitattributes` and what can it control?

`.gitattributes` is a versioned file that assigns per-path **attributes** — it tells Git how to *treat* files matching a glob. Key uses:

- **Line-ending normalization**: `* text=auto` (store LF in repo, check out native), or `*.sh text eol=lf`.
- **Binary files**: `*.png binary` (shorthand for `-diff -merge -text`) so Git doesn't try to diff/merge or mangle them.
- **Custom diff/merge drivers**: `*.md diff=markdown`, or a merge driver for generated files.
- **Filters (clean/smudge)**: `*.psd filter=lfs diff=lfs merge=lfs -text` — how Git LFS hooks in.
- **Language stats**: `*.min.js linguist-generated=true`, `docs/* linguist-documentation` to fix GitHub's language bar.
- **Archive export**: `tests/ export-ignore` drops paths from `git archive` tarballs.

```gitattributes
* text=auto
*.sh   text eol=lf
*.bat  text eol=crlf
*.png  binary
*.psd  filter=lfs diff=lfs merge=lfs -text
*.min.js linguist-generated=true
```

Because it's committed, it applies **consistently for everyone**, unlike `core.autocrlf` which is per-machine.

### Q9. Explain the CRLF vs LF problem and how Git handles line endings.

Windows uses CRLF (`\r\n`) line endings; macOS/Linux use LF (`\n`). In a mixed team, files flip-flop and every commit shows spurious whole-file diffs ("Bob changed 400 lines" = just line endings).

Two mechanisms:

- **`core.autocrlf`** (per-machine config): `true` on Windows (checkout CRLF, commit LF), `input` on Unix (commit LF, leave checkout alone), `false` (do nothing). The problem: it's a *local* setting, so it's easy for one teammate to have it wrong.
- **`.gitattributes` with `text=auto`** (versioned): the *right* answer. `* text=auto` tells every clone to store LF in the repo and check out native line endings, regardless of anyone's local config.

```gitattributes
* text=auto          # normalize: LF in repo, native on checkout
*.sh   text eol=lf   # always LF (shell scripts break with CRLF)
*.bat  text eol=crlf # always CRLF (Windows batch)
```

Senior answer: **commit a `.gitattributes`** so normalization is a repo property, not a per-developer footgun. To fix an already-polluted repo, add the file then `git add --renormalize .`.

### Q10. What are git hooks and what's the difference between client-side and server-side hooks?

Hooks are executable scripts in `.git/hooks/` (or `core.hooksPath`) that Git fires at lifecycle events. A non-zero exit from a "pre-" hook **aborts** the operation.

**Client-side** (run on the developer's machine):
- `pre-commit` — before the commit is created; lint/format/run fast tests. Non-zero aborts.
- `prepare-commit-msg` / `commit-msg` — validate or template the message (e.g. enforce Conventional Commits, require a ticket ID).
- `pre-push` — before objects are sent; run the test suite, block pushing WIP.

**Server-side** (run on the remote when it receives a push):
- `pre-receive` — sees all refs being updated; the real enforcement gate (reject non-fast-forward, block force-push to `main`, require signed commits). Non-zero rejects the whole push.
- `update` — like pre-receive but per-ref.
- `post-receive` — after acceptance; trigger CI, deploy, send notifications.

The crucial distinction: **client hooks are advisory and bypassable; server hooks bind everyone** because they run on infrastructure the developer doesn't control.

### Q11. Are git hooks shared with the team? How do teams manage them?

**No.** `.git/hooks/` is **not versioned** — it's inside `.git/`, so cloning a repo gives you the *sample* hooks, never the team's real ones. Each developer would have to install them manually, and nothing stops them from deleting or skipping them.

So teams use a **hook manager** that lives *in* the repo and installs hooks on setup:

- **pre-commit** (the Python framework) — `.pre-commit-config.yaml` lists hooks; `pre-commit install` wires them up.
- **Husky** (JS ecosystem) — hooks committed under `.husky/`, installed via a `prepare` npm script.
- **lefthook** — fast, language-agnostic, `lefthook.yml`.

Alternatively, commit a `hooks/` directory and point Git at it:

```bash
git config core.hooksPath .githooks   # use versioned .githooks/ instead of .git/hooks/
```

But the honest senior caveat: **even shared client hooks are advisory** — `--no-verify` skips them. They're for fast developer feedback. *Enforcement* still has to happen server-side or in CI (see Q13).

### Q12. What does `--no-verify` do and why does it matter for policy?

`--no-verify` (on `git commit` and `git push`) **skips client-side hooks** — pre-commit, commit-msg, pre-push all get bypassed:

```bash
git commit --no-verify -m "emergency hotfix"   # skips pre-commit / commit-msg
git push --no-verify                            # skips pre-push
```

It's legitimately useful (a hook is broken, or you're committing WIP to a scratch branch). But it's exactly *why you cannot rely on client hooks for policy*: any developer can opt out with one flag, and hooks aren't even installed on a fresh clone. The correct architecture is **client hooks for fast feedback, CI + branch protection for enforcement**. If your lint gate can be skipped with `--no-verify`, it isn't a gate — it's a suggestion. Put the binding check in a required CI status check (see the CI/CD topic).

### Q13. How would you enforce commit standards across a whole team?

Layered defence — fast local feedback *plus* an un-skippable backstop:

1. **Shared client hooks via a manager** (pre-commit / Husky / lefthook), committed to the repo. Gives developers instant lint/format/message-format feedback so bad commits rarely leave the laptop.
2. **`commit-msg` hook** to enforce message format (Conventional Commits, ticket ID) locally.
3. **Server-side / CI enforcement** — the binding layer, since client hooks are bypassable:
   - **Branch protection** on `main`: require PRs, require passing status checks, require review, block force-push.
   - **CI checks** that re-run lint/format/tests and validate commit messages/PR titles — a required status check means the merge button stays greyed until they pass.
   - Optionally a **pre-receive hook** on a self-hosted server to reject non-compliant pushes outright.

The interview-winning sentence: *"Client hooks make the right thing easy; CI and branch protection make the wrong thing impossible."* Never answer this with "add a pre-commit hook" alone — that shows you don't know `--no-verify` exists.

### Q14. How do credential helpers and commit signing get configured?

**Credential helpers** cache or store your remote credentials so HTTPS pushes don't prompt every time:

```bash
git config --global credential.helper osxkeychain   # macOS keychain
git config --global credential.helper manager        # Git Credential Manager (cross-platform)
git config --global credential.helper 'cache --timeout=3600'  # in-memory, 1h
```

For SSH remotes you skip helpers entirely — auth is your SSH key (`~/.ssh/id_ed25519`, loaded via `ssh-agent`).

**Commit/tag signing** proves authorship (supply-chain integrity):

```bash
git config --global user.signingkey <KEY_ID>   # GPG, or an SSH key
git config --global commit.gpgsign true         # sign every commit
git config --global gpg.format ssh              # sign with SSH key instead of GPG
git tag -s v1.0 -m "release"                     # signed (annotated) tag
git log --show-signature                         # verify
```

CI/branch-protection can then **require signed commits**. Signing is verified downstream; the config just makes signing automatic.

### Q15. What do `rerere` and `merge.conflictStyle=zdiff3` do, and why enable them?

Both make conflict resolution dramatically less painful — classic "I've operated Git seriously" tells.

**`rerere`** ("reuse recorded resolution") records how you resolved a given conflict hunk, and *replays that resolution automatically* the next time the identical conflict appears. Invaluable when you rebase a long-lived branch repeatedly, or resolve the same merge conflict across a rebase's many commits:

```bash
git config --global rerere.enabled true
```

**`merge.conflictStyle=zdiff3`** changes conflict markers to show the **common ancestor** (the base) between your version and theirs, not just the two conflicting sides:

```text
<<<<<<< HEAD
our change
||||||| base            <- zdiff3 adds this: what the code was BEFORE either side
original line
=======
their change
>>>>>>> feature
```

Seeing the base makes it obvious *what each side changed*, so you resolve correctly instead of guessing. `zdiff3` is a cleaner successor to the older `diff3`. Set both globally and every future merge/rebase gets easier — see the conflict-resolution playbooks in the troubleshooting topic.

## Git in CI/CD & at Scale

### Summary

**What this topic covers**

How Git behaves inside **automation** (CI/CD pipelines) and inside **very large organisations/repos**, where naive Git usage falls over. Three concern areas: (1) **CI checkout mechanics** — how a runner clones a repo (shallow, single-branch, detached HEAD), and the gotchas that shallow/partial clones introduce (`git describe`, `blame`, `log` counts, SonarQube, merge-base all need history you didn't fetch); (2) **using Git as pipeline signal** — diffing against the base branch to run only affected tests, tagging build artifacts by commit SHA for immutable traceability, triggering pipelines on push/PR/tag, generating changelogs from history; and (3) **scale** — partial clone (`--filter=blob:none`), sparse-checkout, commit-graph, fsmonitor, Scalar/VFS for monorepos, Git LFS, and submodules in CI. The 15 questions here connect Git to the DevOps world: enforcement lives in **branch protection + required status checks** (because client hooks can't bind), and reproducibility lives in **pinning the SHA**.

**Mental model**

In CI, treat every checkout as **hostile to your assumptions**: it's probably *shallow* (`--depth 1`, one commit), *single-branch*, and on a *detached HEAD* (a raw SHA, no branch). That's deliberate — CI optimises for clone speed and bandwidth over completeness — but it means anything depending on *history* (tag distance, blame, commit counts, merge-base) will be wrong or empty until you fetch more. At scale, the mental shift is that **you don't need the whole repo to work on part of it**: partial clone defers downloading blobs until touched, and sparse-checkout materialises only the directories you care about. The unifying idea across both: **the commit SHA is the one immutable, reproducible handle** on a state of the code. CI should check out a *SHA* (not a moving branch), tag artifacts by that SHA, and treat it as the build's identity end-to-end. Branches move; tags can be re-pointed; the SHA is forever.

**Key terms**

- **shallow clone** — `--depth N`; only the last N commits, no deep history. Fast, but breaks history-dependent commands.
- **single-branch clone** — `--single-branch`; fetch one ref, not all branches. CI default.
- **detached HEAD** — HEAD at a raw SHA, not a branch; normal in CI (it checks out a commit).
- **`fetch-depth`** — the CI knob (GitHub Actions `actions/checkout` `fetch-depth`, GitLab `GIT_DEPTH`) controlling shallow depth; `0` = full history.
- **partial clone** — `--filter=blob:none`; fetch commits/trees now, blobs lazily on demand. For huge repos.
- **sparse-checkout** — materialise only some directories in the working tree; the rest stay virtual. Monorepo essential.
- **merge-base** — the common ancestor of two branches; the anchor for "what changed on my branch" (`origin/main...HEAD`).
- **build SHA** — the commit hash used to tag images/artifacts for immutable traceability.
- **commit-graph / fsmonitor** — on-disk graph cache and filesystem monitor that speed up `log`/`status` on big repos.
- **Scalar / VFS for Git** — Microsoft tooling for enormous monorepos (background maintenance, partial clone, sparse).
- **Git LFS** — stores large binaries out-of-band, replacing them with pointers; CI must fetch the objects.
- **required status check** — a CI result branch protection makes mandatory before merge; the real enforcement gate.

**Why interviewers ask this**

This is where "I know Git commands" becomes "I've operated Git in production automation." Anyone can `git clone`; the signal is knowing *why your CI `git describe` returns nothing* (shallow clone stripped the tags/history) and how to fix it (`fetch-depth: 0` or `git fetch --tags --unshallow`). Seniors know the affected-tests trick (`git diff --name-only origin/main...HEAD`), why artifacts are tagged by SHA not by branch, and — the architectural point — that **CI + branch protection is where policy is enforced** because client hooks are advisory. At scale, mentioning partial clone, sparse-checkout, and Scalar shows you've thought about monorepos that don't fit the "clone everything" model. Weak candidates treat CI checkout as `git clone` and are baffled when blame/describe/SonarQube misbehave.

**Common confusions**

- "CI checks out my branch" — usually it checks out a *detached SHA* (the exact commit that triggered the run), not a branch pointer.
- "A shallow clone is just a faster clone" — it's *lossy*: no deep history, so `git describe`, `blame`, `log` counts, and merge-base can fail or lie.
- "Tag the Docker image with the branch name" — branches move; tag by **commit SHA** for a reproducible, immutable build identity.
- "Client hooks enforce our CI rules" — no; hooks are bypassable/uninstalled. **Required status checks + branch protection** enforce.
- "Partial clone and shallow clone are the same" — shallow truncates *history* (fewer commits); partial defers *blobs* (full history, lazy file content). Different trade-offs.
- "`git diff origin/main HEAD` gives my branch's changes" — use the three-dot `origin/main...HEAD` (diff from the *merge-base*) to exclude changes `main` made after you branched.

**What follows from this topic**

This topic is the *enforcement* half of the story whose *authoring* half lived in **Configuration, Hooks & Attributes** — the "client hooks are advisory" thread lands here as branch protection and required status checks. The SHA-as-immutable-identity idea underpins reproducible deploys and rollbacks. Shallow-clone and LFS gotchas feed straight into the recovery scenarios in **Scenario & Troubleshooting Playbooks** ("why is my CI blame/describe empty"). If the config topic was Git for a team, this is Git for a team's *robots*.

### Q1. How does a CI runner typically clone the repo, and why?

Most CI systems do a **shallow, single-branch clone at a detached HEAD**:

```bash
git clone --depth 1 --single-branch --branch main <url> .
# or, more precisely, they fetch the exact triggering SHA and check it out detached
git checkout <commit-sha>   # detached HEAD — no branch pointer
```

Why: CI runs thousands of times; cloning a full repo with all history and branches wastes minutes and bandwidth on every job. `--depth 1` fetches only the tip commit; `--single-branch` skips other refs; checking out the exact SHA guarantees the build reflects precisely the commit that triggered it (reproducible). GitHub's `actions/checkout` and GitLab's runners default to shallow (`fetch-depth: 1` / `GIT_DEPTH: 20` or similar). The consequence — and the source of most CI-Git bugs — is that you have **almost no history**, which breaks the commands in Q2.

### Q2. What breaks with a shallow clone, and how do you fix it?

A shallow clone has no deep history, so anything that walks the commit graph misbehaves:

- **`git describe`** — returns nothing / errors (can't find the nearest tag).
- **`git log` counts** (`git rev-list --count`) — wrong; only sees the shallow window.
- **`git blame`** — truncated; lines attributed to the shallow boundary commit.
- **merge-base ops** (`git diff origin/main...HEAD`) — no common ancestor available.
- **SonarQube / coverage-diff tools** — need history to compute new-code blame.

Fixes — fetch more history:

```bash
git fetch --unshallow                     # convert to a full clone
git fetch --depth=100                     # or just deepen
git fetch --tags                          # tags are often omitted by shallow clones
```

In GitHub Actions set `fetch-depth: 0` (full) on `actions/checkout`; in GitLab set `GIT_DEPTH: 0`. Rule of thumb: **shallow by default, deepen only the jobs that need history** (release tagging, blame-based tools) so you keep most jobs fast.

### Q3. How do you run only the tests affected by a change in CI?

Diff the branch against its merge-base with the target branch and map changed paths to affected suites:

```bash
git fetch origin main
git diff --name-only origin/main...HEAD   # files changed on THIS branch only
```

The **three-dot** `origin/main...HEAD` diffs from the *merge-base* — it excludes changes `main` made after you branched, giving exactly *your* changes. Feed that file list into path filters:

- CI-native path filters (GitHub Actions `paths:`, GitLab `rules: changes:`) skip whole jobs when no relevant file changed.
- Monorepo build tools (Nx, Turborepo, Bazel) use the same diff to compute an **affected** graph and build/test only impacted packages.

Caveat: this needs enough history for the merge-base to exist — so these jobs often need `fetch-depth: 0` (Q2). Getting the two-dot vs three-dot distinction right is the classic senior tell here.

### Q4. Why tag build artifacts by commit SHA instead of branch or tag name?

Because the **SHA is immutable and unique**; branches and tags are movable pointers. If you tag a Docker image `app:main`, "main" means something different every merge — you can't reproduce or roll back to a precise build. Tagging `app:git-<sha>` gives every build a permanent, traceable identity:

```bash
SHA=$(git rev-parse --short HEAD)
docker build -t acme/app:$SHA .
docker push acme/app:$SHA
# deploy references the SHA, so a rollback = redeploy the previous SHA's image
```

Benefits: exact traceability (image ↔ source commit), safe rollback (redeploy an old SHA), and immutability (the same SHA always means the same code). You can *also* push a moving `:latest`/`:main` for convenience, but the **SHA tag is the source of truth**. This is the reproducible-deploy backbone: pin the SHA everywhere.

### Q5. What triggers a CI pipeline from Git, and how do those events differ?

Three main Git events, each a different intent:

- **push** — commits landed on a branch. Runs build/test/lint for feature branches; often gates deploys on pushes to `main`.
- **pull/merge request** — a proposed merge. CI checks out a *merge preview* (your branch merged into the target) and runs the required status checks that branch protection enforces. This is where the merge is gated.
- **tag** — a release marker (`v1.2.0`). Triggers the release/publish pipeline (build artifacts, push images, deploy to prod).

```yaml
on:
  push:        { branches: [main] }
  pull_request: { branches: [main] }
  push:        { tags: ['v*'] }     # release on version tags
```

The distinction matters: PR builds validate a *hypothetical* merge (so they need the merge-base), push builds validate *actual* history, and tag builds are your release gate. Signed tags (Q10) add supply-chain verification on the release path.

### Q6. What is a partial clone and how does it differ from a shallow clone?

Both reduce clone cost, but along different axes:

| | Shallow clone | Partial clone |
|---|---|---|
| Flag | `--depth N` | `--filter=blob:none` |
| Omits | Old **commits** (history) | File **blobs** (content) |
| History | Truncated | **Full** |
| Blobs | Present (for the depth) | Fetched **lazily** on checkout/access |
| Best for | Fast CI jobs, no history needed | Huge repos where you need history but not every file's content |

```bash
git clone --filter=blob:none <url>      # commits + trees now, blobs on demand
git clone --filter=tree:0 <url>         # even leaner: trees lazy too
```

A partial clone keeps the whole commit graph (so `describe`/`blame`/merge-base still work) but defers downloading file contents until you actually touch a file — ideal for enormous monorepos where the *history* is cheap but the *file data* is huge. Shallow is the opposite trade: keep the current files, drop the history.

### Q7. How does sparse-checkout help with monorepos?

Sparse-checkout materialises **only the directories you care about** in the working tree, leaving the rest virtual — essential when a monorepo has thousands of directories but your build touches five.

```bash
git clone --filter=blob:none --sparse <url>   # partial + sparse
cd repo
git sparse-checkout init --cone
git sparse-checkout set services/payments libs/common
```

Now only `services/payments` and `libs/common` exist on disk; the rest of the tree isn't checked out, so `status`, builds, and IDE indexing are fast. Combined with partial clone, a CI job for one service never downloads or materialises the other 200 services. Cone mode (`--cone`) restricts patterns to directory prefixes, which is much faster than arbitrary globs on big trees. This plus partial clone is how giant monorepos stay workable.

### Q8. How do you handle Git LFS in CI?

Git LFS replaces large binaries with small pointer files and stores the real objects on an LFS server. In CI you must ensure the **actual objects** get fetched, not just the pointers:

```bash
git lfs install
git lfs pull                 # download the real LFS objects for this checkout
# or fetch specific paths:
git lfs pull --include="assets/*.psd"
```

In GitHub Actions, `actions/checkout` takes `lfs: true`. Gotchas:
- Without it, your build gets **pointer files** (a few lines of text) instead of the real binary — confusing failures.
- LFS bandwidth is metered/quota'd, so **cache** LFS objects between runs (`actions/cache` on `.git/lfs`).
- LFS needs its own **credentials** (same or separate from repo auth).

The `.gitattributes` `filter=lfs` lines (from the config topic) are what route those paths through LFS in the first place. Fetch cost is the main CI concern — cache aggressively.

### Q9. How are submodules handled in CI, including private ones?

Submodules are separate repos pinned at a specific SHA inside the parent. A plain checkout leaves them empty, so CI must recurse:

```bash
git clone --recurse-submodules <url>
# or after clone:
git submodule update --init --recursive
```

In GitHub Actions: `actions/checkout` with `submodules: recursive`. For **private** submodules the catch is **credentials** — the token used for the parent repo often can't read the submodule:
- Use a token/deploy key/GitHub App with access to *all* the submodule repos.
- Or rewrite submodule URLs to use the CI token: `git config url."https://x:$TOKEN@github.com/".insteadOf "https://github.com/"`.

Pin submodules by SHA (that's how they work) so builds are reproducible; a submodule that tracks a branch is a reproducibility hazard. Missing-submodule-credentials is the single most common private-monorepo CI failure.

### Q10. How do you verify signed commits or tags in CI, and why?

For supply-chain integrity — proving a release actually came from an authorised author and wasn't tampered with. CI verifies signatures and fails the build if they're missing/invalid:

```bash
git verify-commit HEAD        # verify the commit's GPG/SSH signature
git verify-tag v1.2.0         # verify a signed release tag
git log --show-signature -1   # inspect
```

You need the trusted public keys available on the runner (GPG keyring or an SSH `allowed_signers` file). Branch protection can **require signed commits** so unsigned work can't merge; the release pipeline then verifies the signed *tag* before building/deploying. This is one link in the same chain as artifact-by-SHA (Q4) and pinned SHAs — provenance from author → commit → tag → artifact → deploy. Enforcement, as always, is server-side (branch protection), not a client hook.

### Q11. Where should Git-related policy actually be enforced in a team's workflow?

At the **server, via branch protection + required status checks** — never at client hooks alone (they're advisory and bypassable with `--no-verify`, and aren't even installed on fresh clones). Concretely, protect `main` with:

- **Require a PR** — no direct pushes to `main`.
- **Require passing status checks** — CI must go green (build, tests, lint, commit-message/PR-title validation). The merge button stays disabled until they pass — *this* is the binding gate.
- **Require review** (and optionally code-owner approval).
- **Require signed commits** / linear history / up-to-date-with-base.
- **Block force-push and deletion** of `main`.

The layered model: client hooks (fast local feedback) → CI checks (re-run everything on the server) → branch protection (makes those checks mandatory). Interview line: *"A check anyone can `--no-verify` isn't enforcement; a required status check is."* This is the direct continuation of the hooks discussion in the configuration topic.

### Q12. How do you make CI checkouts reproducible?

Pin to an **immutable SHA**, not a moving reference, at every layer:

- **Check out the exact commit SHA** that triggered the run (CI does this by default via detached HEAD) — not `main`, which may have moved.
- **Tag artifacts by that SHA** (Q4) so the built image is traceable to precise source.
- **Pin actions/dependencies** by SHA too (e.g. `uses: actions/checkout@<sha>` rather than `@v4`) to avoid a moving tag changing your pipeline underneath you.
- **Pin submodules** by SHA (Q9).
- For deploys, **deploy a SHA-tagged artifact**, so redeploying the same SHA reproduces the same running system and rollback is deterministic.

```bash
git rev-parse HEAD             # the immutable build identity — thread it everywhere
```

The principle: **branches and tags move; only the SHA is forever.** A reproducible pipeline is one where every input is content-addressed. Non-reproducible builds almost always trace to a moving reference (`:latest`, `main`, `@v4`) somewhere in the chain.

### Q13. What performance tooling exists for very large repos?

When a repo has millions of commits/files, base Git commands get slow; several features/tools speed them up:

- **commit-graph** (`git commit-graph write`, on by default via `fetch.writeCommitGraph`) — an on-disk cache of the commit DAG; makes `git log`, merge-base, and `--graph` fast.
- **fsmonitor** (`core.fsmonitor=true`) — a filesystem watcher so `git status` doesn't scan the whole tree.
- **partial clone + sparse-checkout** (Q6, Q7) — don't download/materialise what you don't need.
- **`git maintenance`** (`git maintenance start`) — background repacking, commit-graph, prefetch.
- **Scalar** (ships with Git) and **VFS for Git** — Microsoft tooling that bundles partial clone, sparse-checkout, background maintenance, and prefetch for enormous monorepos (Windows/Office scale).
- **untracked-cache** and index v4 — speed up status/index ops.

The theme: giant monorepos need Git configured to be *lazy and cached* rather than eager. If someone's `git status` takes 30 seconds, the answer is fsmonitor + commit-graph + sparse-checkout, not "split the repo" (though that's sometimes right too).

### Q14. Why is my CI `git blame` / `git describe` empty or wrong?

Because the CI checkout is **shallow** — it fetched only the tip commit (`--depth 1`), so:

- **`git describe`** can't find the nearest tag (tags/history weren't fetched) → errors or empty.
- **`git blame`** has no history to walk → attributes everything to the shallow boundary commit.
- **`git log` / rev-list counts** only see the shallow window → wrong numbers.

Fix by fetching the history (and tags) those commands need:

```bash
git fetch --unshallow          # full history
git fetch --tags               # describe needs tags
# or in GitHub Actions:
#   - uses: actions/checkout@v4
#     with: { fetch-depth: 0 }   # 0 = full history + tags
```

This is *the* canonical CI-Git support ticket. The mental check: **any command that needs the past will fail on a shallow clone** — deepen only the jobs that need it. It's not a bug in blame/describe; it's missing data.

### Q15. What are common Git failures in CI and how do you diagnose them?

The recurring set — nearly all trace to CI's shallow/detached/lazy checkout:

- **Shallow-clone errors** — "fatal: no merge base" on a diff, empty `describe`/`blame`. Fix: `fetch-depth: 0` / `--unshallow` (Q2, Q14).
- **Detached HEAD surprises** — scripts assuming a branch name find none; `git rev-parse --abbrev-ref HEAD` returns `HEAD`. Fix: read the branch from CI env vars, or check out a real branch.
- **Missing tags** — release scripts can't see version tags. Fix: `git fetch --tags`.
- **Missing submodule content / auth** — empty submodule dirs or 403s. Fix: `submodules: recursive` + a token that can read them (Q9).
- **LFS pointers instead of files** — binaries are tiny text files. Fix: `lfs: true` / `git lfs pull` (Q8).
- **Dubious ownership** — "detected dubious ownership in repository" when CI runs as a different user. Fix: `git config --global --add safe.directory <path>`.
- **Line-ending noise** — spurious diffs from CRLF/LF. Fix: commit `.gitattributes` (config topic).

Diagnostic instinct: when Git misbehaves in CI, first ask *"what did the checkout NOT fetch?"* — depth, tags, submodules, LFS. That single question resolves most of them.

## Scenario & Troubleshooting Playbooks

### Summary

**What this topic covers**

The capstone: concrete "I did X — how do I fix it?" recovery playbooks, the single most practically-tested area of Git in interviews and on the job. It assumes the fundamentals from earlier topics (the object model, refs as movable pointers, reset vs revert, rebase's history rewrite, the reflog) and turns them into *procedures*. The 17 questions are real emergencies: committed to the wrong branch, committed a secret, need to undo a commit (pushed or not), a bad merge, a deleted branch, a force-push that clobbered `main`, detached-HEAD commits, a hairy merge conflict, a typo'd message, a messy branch to squash, ugly merge commits from pull, `reset --hard` data loss, a bloated repo, a diverged branch, reverting a range, a file that should've been ignored, and finding the commit that introduced a bug. Each answer gives the exact command sequence, the *why*, and — critically — the **data-loss and shared-history danger flags**.

**Mental model**

Two questions decide every recovery. **First: is this history LOCAL or SHARED?** Local (never pushed, or only on your own branch) → you may freely rewrite it: `reset`, `rebase`, `commit --amend`, `--force-with-lease`. Shared (others have pulled it) → **do not rewrite**; use `revert` (a new commit that undoes) and coordinate. Rewriting shared history is the cardinal Git sin — it detonates everyone else's clone. **Second: is anything truly lost?** Almost never. Every commit HEAD has pointed at is in the **reflog** for ~90 days; unreferenced commits survive in the object database until `gc`, recoverable via `git fsck --lost-found`. So recovery is mostly **moving a pointer back** to a commit that still exists, not resurrecting deleted data. Internalise this and panic disappears: a "lost" commit after a bad reset is a `git reflog` away; a deleted branch is `git reflog` → `git checkout -b`. You're moving refs around a graph that mostly still exists.

**Key terms**

- **reflog** — per-ref log of where HEAD/branches have pointed (`HEAD@{n}`); the primary recovery tool, ~90-day retention.
- **`git fsck --lost-found`** — finds dangling/unreachable commits and blobs not in any reflog; the deeper safety net.
- **local vs shared history** — has anyone else pulled it? Decides rewrite (reset/rebase) vs safe-undo (revert).
- **reset `--soft` / `--mixed` / `--hard`** — move the branch pointer; keep index+wd / reset index keep wd / discard everything.
- **revert** — a *new* commit that undoes a prior one; safe on shared history (adds, never rewrites).
- **`--force-with-lease`** — force-push that aborts if the remote moved since you fetched; safer than `--force`.
- **cherry-pick** — copy a specific commit onto the current branch (move commits between branches).
- **rebase -i (interactive)** — reorder/squash/reword/drop commits; rewrites history (local only).
- **`revert -m 1`** — revert a merge commit, keeping mainline parent 1; note the "can't re-merge" gotcha.
- **`git filter-repo`** — rewrite history across all commits (purge a secret or a huge file); rewrites everything.
- **detached HEAD** — commits made with no branch pointing at them; save with `git branch`/`checkout -b`.
- **bisect** — binary search over history to find the commit that introduced a bug (`git bisect run`).

**Why interviewers ask this**

This is the truest test of *operational* Git. Anyone can `git commit`; the question is whether, when something breaks, you reach for the right tool with the right danger-awareness — or make it worse with a `reset --hard` or a `push --force` to `main`. Interviewers watch for two reflexes: (1) **reflog-first thinking** — do you know "lost" work is usually recoverable, or do you panic? (2) **shared-history discipline** — do you instinctively pick `revert` over `reset+force` on a pushed branch? A candidate who says "I'd `git push --force` to fix the shared branch" just failed. The best answers also *rotate the secret* (not just rewrite history), *use `--force-with-lease`* (not `--force`), and *flag the data-loss* before running the destructive command. These are the habits that separate someone safe to give repo admin from someone who'll eventually nuke `main`.

**Common confusions**

- "`reset --hard` deleted my commits forever" — almost never; they're in the reflog (`git reflog`, then `reset --hard HEAD@{n}`).
- "`revert` and `reset` both undo a commit" — `reset` *moves the pointer* (rewrites, local-safe only); `revert` *adds a new undo commit* (shared-safe). Different tools.
- "I'll just `--force` to fix the shared branch" — force-push overwrites teammates' commits. Use `revert`, or at minimum `--force-with-lease`, and only on your own branch.
- "Removing a secret from the latest commit removes it from history" — no; it's in every earlier commit until you `filter-repo`. And it's already leaked — **rotate it** regardless.
- "Reverting a bad merge lets me re-merge the branch later cleanly" — no; the revert makes Git think those changes are already present. You must revert-the-revert or rebase. (Q5's gotcha.)
- "Detached-HEAD commits are gone once I checkout away" — only if you didn't save them; `git branch <name> <sha>` (from reflog) rescues them.

**What follows from this topic**

This is where every earlier topic pays off: reset/revert/rebase mechanics, refs-as-pointers, the reflog safety net, `filter-repo` for secrets and big files (which ties back to `.gitattributes`/LFS from the configuration topic and the shallow-clone realities from CI). There's nothing after this — it's the synthesis. If you can walk an interviewer through recovering a force-clobbered `main` from the reflog while flagging the shared-history danger, you've demonstrated the whole primer. Treat these 17 playbooks as the definitive Git-recovery reference: know the command *and* the danger flag for each.

### Q1. I committed to the wrong branch. How do I move the commits?

If the commits are **local** (not pushed), move the pointers. Say you committed to `main` but meant `feature/login`:

```bash
git branch feature/login          # create feature branch AT current commit (marks the work)
git reset --hard origin/main      # move main back to where it should be
git checkout feature/login        # your commits are safe here
```

```text
before:  A---B---C   main (C,B were meant for feature)
after:   A          main
              \
               B---C  feature/login
```

If it's just one or two commits, **cherry-pick** instead:

```bash
git checkout feature/login
git cherry-pick <sha-of-B> <sha-of-C>
git checkout main && git reset --hard HEAD~2   # drop them from main
```

Danger flag: `reset --hard` discards working-tree changes — commit or stash first. If `main` was already **pushed**, don't reset it (shared history); revert on main and re-apply on the feature branch, or coordinate.

### Q2. I committed a secret / API key. How do I remove it?

Two mandatory steps — and the order matters:

**1. Rotate the secret immediately.** Once pushed, assume it's compromised (crawlers scrape public repos in seconds; teammates and CI logs have it). History rewrite does *not* un-leak it — the only real fix for the exposure is a new credential.

**2. Purge it from history** with `git filter-repo` (not the old `filter-branch`):

```bash
git filter-repo --invert-paths --path secrets.env      # remove the file from ALL history
# or scrub a string from every file:
git filter-repo --replace-text <(echo 'AKIAEXAMPLE==>REDACTED')
git push --force-with-lease --all                       # rewrite the remote
```

Then rotate collaborators' clones (everyone must re-clone; old clones still contain it). Add the path to `.gitignore` so it can't recur. Danger flags: `filter-repo` **rewrites every commit SHA** (shared-history nuke — coordinate with the team), and it's irreversible. But the headline is: **rewriting history is cleanup; rotating the secret is the actual fix.**

### Q3. How do I undo the last commit?

Depends on whether it's pushed and whether you want to keep the changes:

| Situation | Command | Effect |
|---|---|---|
| Not pushed, keep changes staged | `git reset --soft HEAD~1` | Uncommit, keep index + wd |
| Not pushed, keep changes unstaged | `git reset --mixed HEAD~1` (default) | Uncommit, keep wd, clear index |
| Not pushed, discard changes | `git reset --hard HEAD~1` | Uncommit **and delete the work** |
| Already pushed (shared) | `git revert HEAD` | New commit that undoes it — safe |

```bash
git reset --soft HEAD~1    # most common: undo commit, re-edit, re-commit
```

Danger flag: `--hard` throws away the changes (recoverable via reflog for a while, but treat as lost). If it's pushed, **use `revert`, not reset** — see Q4.

### Q4. How do I undo a commit that's already been pushed?

Use **`git revert`** — it creates a *new* commit that inverts the target, so you never rewrite shared history:

```bash
git revert <sha>       # makes a new commit undoing <sha>
git push               # normal push, no force needed
```

```text
A---B---C---D          (D is the revert of B; B still exists in history)
```

Why not `reset` + `--force`? Because teammates have already pulled the pushed commit; rewriting it forces everyone into a painful recovery and can clobber work they built on top. `revert` is additive and safe. The trade-off is that the bad commit *stays in history* (with an undo next to it) rather than vanishing — which is correct for an audit trail. Only `reset+force` shared history if you've coordinated a full team stop-and-re-clone, which you almost never should.

### Q5. I need to undo a bad merge. How?

If the merge is **local/unpushed**, just move the branch back:

```bash
git reset --hard ORIG_HEAD     # ORIG_HEAD = where you were before the merge
```

If it's **pushed** (shared), revert the merge commit, specifying which parent is mainline:

```bash
git revert -m 1 <merge-sha>    # -m 1 keeps parent 1 (the branch you merged INTO)
```

**The gotcha:** reverting a merge tells Git those changes are now "undone," so if you later fix the feature branch and try to merge it again, Git thinks its commits are *already present* and skips them — you get an incomplete re-merge. To re-merge cleanly you must **revert the revert** first (`git revert <revert-sha>`), or rebase the feature branch onto a fresh base. This is the single most misunderstood recovery in Git — always flag it when reverting a merge.

### Q6. How do I recover a deleted branch or lost commits after a bad reset/rebase?

The **reflog** — it records every position HEAD has held, so the "lost" commit is still findable:

```bash
git reflog                        # find the SHA before the mistake, e.g. HEAD@{4}
git reset --hard HEAD@{4}         # restore the branch to that point
# or recover a deleted branch:
git checkout -b feature/login <sha-from-reflog>
```

```text
git reflog output:
  a1b2c3d HEAD@{0}: reset: moving to HEAD~3   <- the mistake
  d4e5f6a HEAD@{1}: commit: add validation    <- the work you want back
```

If it's not even in the reflog (e.g. reflog expired), fall back to `git fsck --lost-found` (Q13). Danger flag: `reset --hard` to recover will itself discard current uncommitted work — stash first. This is *the* answer to demonstrate reflog-first thinking: **nothing HEAD touched in the last ~90 days is truly gone.**

### Q7. Someone force-pushed and clobbered main. How do I recover it?

The clobbered commits still exist somewhere — recover from a reflog or an un-updated clone:

```bash
# Option A — your local reflog for the remote-tracking ref:
git reflog show origin/main            # find the good SHA before the force-push
git reset --hard <good-sha>
git push --force-with-lease origin main   # restore the good state

# Option B — a teammate/CI that hasn't fetched still has good origin/main:
#   grab the SHA from their clone (git rev-parse origin/main) and push it back.
```

If no reflog and no good clone, `git fsck` on the server (or any clone) can surface the dangling commits. Prevention is the real lesson: **branch protection blocks force-push to `main`** (see the CI topic) so this can't happen. Danger flag: coordinate before force-pushing the restore, and use `--force-with-lease` so you don't clobber a *second* time if someone else already fixed it. Then have a serious word about who force-pushed `main`.

### Q8. I'm in detached HEAD and made commits. How do I keep them?

In detached HEAD, commits have **no branch pointing at them** — checkout away and they become unreferenced (eventually GC'd). Save them by creating a branch *before* you move:

```bash
git branch feature/rescue        # branch AT the current detached commit
git checkout feature/rescue      # or: git switch -c feature/rescue in one step
```

If you already checked out away and lost them, get the SHA from the reflog and branch from it:

```bash
git reflog                       # find the detached commit's SHA
git branch feature/rescue <sha>
```

```text
detached:   A---B---C   <- HEAD here, no branch (C,B float free)
after:      A---B---C   feature/rescue  <- now anchored, safe
```

The rule: **a commit with no ref is a candidate for garbage collection.** Anchor detached work with a branch and it's permanent. CI runs detached by design (CI topic) — that's fine because CI doesn't need to keep commits.

### Q9. Walk me through resolving a big merge conflict.

Method, not panic. First, set `merge.conflictStyle=zdiff3` and `rerere.enabled` globally (config topic) so conflicts show the common ancestor and resolutions replay.

```bash
git merge feature/login          # conflicts reported
git status                       # list conflicted files
```

For each conflicted file, the markers show three sides with zdiff3:

```text
<<<<<<< HEAD
our version
||||||| base
what it was before either side   <- the key: shows what each side CHANGED
=======
their version
>>>>>>> feature/login
```

Resolve by understanding *both intents* (the base tells you what each side changed relative to it — don't just pick a side blindly), edit to the correct combined result, then:

```bash
git add <file>                   # mark resolved
git merge --continue             # or: git commit
# always TEST before committing the merge
```

Tools: `git mergetool`, or `git checkout --ours/--theirs <file>` when one side wins wholesale. Abort and start over with `git merge --abort`. Danger flag: a merge you resolved without testing is a merge you haven't finished.

### Q10. How do I fix a typo in a commit message?

If it's the **most recent** commit and **unpushed**, amend it:

```bash
git commit --amend -m "correct message"
```

If it's **further back** (still unpushed), interactive rebase and `reword`:

```bash
git rebase -i HEAD~5             # mark the commit 'reword' (or 'r'), save; edit the message
```

If it's **already pushed**, you're rewriting shared history — only do it on a branch that's yours (a feature branch pre-PR), then `git push --force-with-lease`. Never rewrite a message on shared `main` for a typo; it's not worth detonating everyone's history. Danger flag: `--amend` and `rebase -i` change the commit SHA, so on a shared branch they force teammates to reconcile — restrict to local/own-branch history.

### Q11. How do I squash my messy feature branch before opening a PR?

Interactive rebase, squashing the noise into meaningful commits:

```bash
git rebase -i main               # or HEAD~6 to target the last 6 commits
```

In the editor, keep the first commit as `pick`, mark the rest `squash` (fold in, keep message) or `fixup` (fold in, discard message):

```text
pick   a1b2c3d Add login form
squash d4e5f6a fix typo
squash 7g8h9i0 wip
fixup  1j2k3l4 more wip           <- fixup: silently merge, drop its message
```

Save, then edit the combined message. Result: a clean, reviewable history. This is safe because a **pre-PR feature branch is your local/own history** — rewrite freely. If you'd already pushed the branch, finish with `git push --force-with-lease`. Danger flag: only squash *your* branch; never rebase-squash shared `main`. Many teams also just "Squash and merge" in the PR UI, which does this at merge time.

### Q12. My pull keeps creating ugly merge commits. How do I stop that?

Because a default `git pull` does fetch + **merge**, creating a merge commit every time your local and remote both moved. Switch to rebase or fast-forward-only:

```bash
git pull --rebase                          # replay your local commits on top of remote — linear
git config --global pull.rebase true       # make it the default everywhere
git config --global pull.ff only           # or: refuse to auto-merge; you decide
```

```text
merge pull:   ...---o---M   (M = noise merge commit)
                  \     /
                   your commits
rebase pull:  ...---o---A'---B'   (your commits replayed, linear, no merge commit)
```

Rebase gives a clean linear history; `ff-only` refuses to create a merge and errors if you've diverged (forcing an explicit choice). Danger flag: `pull --rebase` rewrites *your local, unpushed* commits — that's fine (local history), but don't rebase commits you've already shared. Set `pull.rebase true` once and forget it.

### Q13. I ran `git reset --hard` and lost uncommitted work. Can I get it back?

**Committed** work: yes, always — it's in the reflog:

```bash
git reflog
git reset --hard HEAD@{1}         # the state before the bad reset
```

**Uncommitted** work (changes that were never committed *or* staged): harder, because `reset --hard` overwrote the working tree and there's no commit to point at. If the changes were ever **staged** (`git add`ed), they're blobs in the object DB — recover via fsck:

```bash
git fsck --lost-found            # dangling blobs land in .git/lost-found/
# inspect dangling blobs to find your content:
git show <dangling-blob-sha>
```

If they were never staged and never committed, they're genuinely gone (only your editor's local history / IDE backup might save you). Danger flag / lesson: **`reset --hard` on uncommitted work is one of the few truly destructive Git operations** — `git stash` before any hard reset. Committed = recoverable; merely-edited = pray.

### Q14. A huge file bloated the repo. How do I fix it?

The file lives in **history**, so deleting it in a new commit doesn't shrink the repo — every past commit still references it. Purge it from all history and repack:

```bash
git filter-repo --path bigfile.zip --invert-paths   # remove from ALL history
# then reclaim space:
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force-with-lease --all
```

Going forward, put large binaries in **Git LFS** so they never bloat the pack again:

```bash
git lfs track "*.zip"            # writes a filter=lfs rule to .gitattributes
```

Danger flags: `filter-repo` **rewrites every commit SHA** downstream of the file's introduction (shared-history rewrite — coordinate a re-clone), and `gc --prune=now` is irreversible. This ties back to `.gitattributes`/LFS (config topic) and to why CI does shallow/partial clones on big repos (CI topic).

### Q15. My branch diverged from origin and my push was rejected. What do I do?

"Rejected — non-fast-forward" means origin has commits you don't. **Never** blindly `--force` (you'd delete origin's commits). Integrate first:

```bash
git fetch origin
git rebase origin/feature/login      # replay your commits on top of theirs (linear)
# resolve any conflicts, then:
git push
# if you'd previously pushed this branch and rebased it:
git push --force-with-lease          # safe force: aborts if origin moved unexpectedly
```

Or `git merge origin/feature/login` if your team prefers merge commits. Choose `--force-with-lease` over `--force` because it **checks the remote hasn't changed since your last fetch** — if a teammate pushed in the meantime, it aborts instead of clobbering them. Danger flag: force-push (even with lease) only on branches that are *yours*; never on shared `main`. Diverged `main` → integrate with rebase/merge, no force.

### Q16. How do I revert a range of commits?

Give `revert` a range (note the exclusive lower bound with `^` or `~`), which creates undo commits for each — safe on shared history:

```bash
git revert <oldest>^..<newest>      # revert every commit in the range, inclusive
git revert --no-commit A..D         # stage all the reversions, make ONE combined commit
git commit -m "Revert feature X"
```

`--no-commit` (`-n`) is often what you want: it applies all the reversions to the index without committing each, so you get a single clean "Revert feature X" commit instead of N separate ones. Reverts apply newest-to-oldest automatically so they don't conflict with each other.

If the range is **local/unpushed** and you'd rather it just vanish, `git reset --hard <before-the-range>` — but that rewrites history (local only). On shared history, always `revert`. Danger flag: reverting a range that includes a *merge* commit needs `-m` per merge and hits the re-merge gotcha (Q5).

### Q17. How do I find which commit introduced a bug?

`git bisect` — binary search over history. Mark a known-good and known-bad commit; Git checks out the midpoint repeatedly, halving the search each step:

```bash
git bisect start
git bisect bad                    # current commit is broken
git bisect good v1.2.0            # this old tag was fine
# Git checks out a midpoint; test it, then:
git bisect good   # or: git bisect bad
# ...repeat until Git names the first bad commit, then:
git bisect reset                  # return to where you started
```

Automate it with a test script — `git bisect run` does the whole search hands-off:

```bash
git bisect start HEAD v1.2.0      # bad=HEAD, good=v1.2.0
git bisect run ./test.sh          # exit 0 = good, non-0 = bad; Git finds the culprit
```

Over 1000 commits that's ~10 tests instead of 1000. `git bisect run` is the senior answer — it turns "which of these hundreds of commits broke it" into an automated binary search. Note it needs enough history (a full clone, not shallow — CI topic).
