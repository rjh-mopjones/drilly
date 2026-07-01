---
type: interview-prep
---

# Linux Interview Primer — 336 Questions

Comprehensive Q+A primer for senior Linux / DevOps / SRE interviews. First entry in the DevOps track — sister note to the language and cloud primers. Same shape, ops-flavoured: the kernel & filesystem, permissions, processes & signals, systemd, packaging, the CLI toolkit, bash, memory/CPU/disk/network internals, observability, security hardening, container primitives, and production troubleshooting playbooks.

Each answer is interview-shaped: opinionated, concrete, real commands with the flags that matter, real `/proc` and `/etc` paths, and what the kernel actually does under load. systemd baseline; distro-aware (Debian/Ubuntu + RHEL/Fedora).

1. [[#Linux Fundamentals & Architecture]]
2. [[#The Filesystem & FHS]]
3. [[#File Permissions & Ownership]]
4. [[#Users, Groups & Authentication]]
5. [[#Processes & Signals]]
6. [[#Job Scheduling]]
7. [[#systemd & Service Management]]
8. [[#Package Management]]
9. [[#Text Processing & the CLI Toolkit]]
10. [[#Shell Scripting with Bash]]
11. [[#I/O Redirection, Pipes & File Descriptors]]
12. [[#Memory & Swap]]
13. [[#CPU, Load & Scheduling]]
14. [[#Disk, Filesystems & LVM]]
15. [[#Networking Fundamentals]]
16. [[#Network Troubleshooting]]
17. [[#Logging & Monitoring]]
18. [[#Security & Hardening]]
19. [[#Performance Troubleshooting & Debugging]]
20. [[#Containers & the Kernel]]
21. [[#Scenario & Troubleshooting Playbooks]]

---

## Linux Fundamentals & Architecture

### Summary

**What this topic covers**

The bedrock every Linux interview starts on: what "Linux" actually *is*, how a machine goes from power-on to a login prompt, and the boundary between the parts you can see (files, shells, commands) and the parts you can't (the kernel, system calls, memory protection). Three concern areas live here: (1) the **anatomy** — kernel vs the GNU userland vs a distribution, kernel space vs user space, monolithic-with-modules design; (2) the **lifecycle** — the boot chain from firmware through the bootloader, kernel, initramfs, and `init`/systemd to a running target; and (3) the **operating surface** — the shell, `PATH` resolution, `/proc` and `/sys` as live kernel interfaces, and the distro families you'll actually meet in production. The 16 questions here are the warm-ups, but they gate everything: if you can't say where the kernel ends and userland begins, the process, memory, and container topics later won't land.

**Mental model**

Picture two rings. The **kernel** runs in a privileged CPU mode (kernel space) with direct access to hardware, memory, and scheduling. Everything else — your shell, `ls`, nginx, systemd — runs in **user space**, sandboxed, unable to touch hardware directly. The only doorway between them is the **system call**: `open()`, `read()`, `fork()`, `execve()`. When `cat file` runs, the `cat` binary is user space; the actual disk read is a `read()` syscall trapping into the kernel. "Linux" strictly means the *kernel* Linus Torvalds started in 1991; the commands and libraries around it are mostly GNU and other projects; a **distribution** bundles a kernel + userland + package manager + defaults into something installable. That three-part split (kernel / userland / distro) is the single most clarifying idea in this topic — get it and questions about "why does RHEL differ from Ubuntu" or "what does the kernel actually do" answer themselves.

**Key terms**

- **Kernel** — the core program managing CPU scheduling, memory, devices, filesystems, and networking; the only code running in privileged mode.
- **User space vs kernel space** — the privilege boundary; user code must issue a **syscall** to ask the kernel to do anything hardware-touching.
- **System call** — the API into the kernel (`open`, `read`, `write`, `fork`, `execve`, `mmap`); trace them with `strace`.
- **GNU userland** — coreutils, bash, glibc — the tools that make a kernel usable; "GNU/Linux" acknowledges this.
- **Distribution** — kernel + userland + package manager + release policy (Debian/Ubuntu, RHEL/Fedora, Arch, Alpine).
- **Bootloader** — GRUB2 (or systemd-boot); loads the kernel and initramfs from `/boot`.
- **initramfs** — a temporary in-RAM root filesystem holding drivers needed to mount the real root.
- **init / PID 1** — the first user-space process; on modern distros it's **systemd**, which brings up the rest via units and targets.
- **Kernel module** — dynamically loadable driver code (`lsmod`, `modprobe`, `.ko` files); keeps the monolithic kernel extensible.
- **/proc and /sys** — virtual filesystems exposing live kernel and process state as files.
- **Target (systemd) / runlevel (SysV)** — a named system state (`multi-user.target`, `graphical.target`) replacing numeric runlevels.
- **uname** — reports kernel name, release, and architecture (`uname -r`, `uname -m`).

**Why interviewers ask this**

This is the fastest way to separate someone who *operates* Linux from someone who only *uses* it. A junior says "Linux is an operating system"; a senior distinguishes kernel, userland, and distribution, and can explain why that matters at 3am — e.g. a syscall-level `strace` when an app hangs, or knowing that a "Linux" CVE might be a kernel bug (patch + reboot) or a glibc bug (patch + restart services). Interviewers also probe the boot chain because half of production incidents are boot failures: a bad `/etc/fstab`, a missing initramfs driver after a kernel upgrade, a GRUB misconfig. If you can narrate BIOS/UEFI → GRUB → kernel → initramfs → systemd cleanly, you can debug a box that won't come up — and that's an SRE core competency.

**Common confusions**

- "Linux is the whole OS" — Linux is the *kernel*; the OS is kernel + userland + distro packaging.
- "systemd is the kernel" — no; systemd is PID 1, a user-space process the kernel starts after boot.
- "Monolithic kernel means you can't add drivers without recompiling" — Linux is monolithic *but modular*; `modprobe` loads drivers at runtime.
- "/proc files are real files on disk" — they're virtual, generated on read by the kernel; they occupy no disk.
- "Runlevels still exist" — systemd uses **targets**; runlevel commands are compatibility shims.
- "All distros are basically the same" — package manager, init defaults, file locations, and release cadence differ enough to break automation across families.

**What follows from this topic**

The kernel/user-space boundary is the foundation for the **Processes & Signals** topic (a signal is the kernel poking a user process) and the **Memory** topic (the kernel owns the page cache and the OOM killer). `/proc` and `/sys` reappear everywhere — process inspection, tuning via `sysctl`, cgroup limits. The boot chain leads into **systemd service management**. The everything-is-a-file philosophy sets up **The Filesystem & FHS** and **File Permissions** — the next two topics — because if devices, kernel state, and sockets are all files, then the permission model and the directory tree are how you actually control the system.

### Q1. What is Linux, really — kernel, GNU userland, or a distribution?

All three words describe different layers, and conflating them is the classic junior tell.

- **Linux is the kernel** — the ~30M-line core that Linus Torvalds released in 1991. It schedules processes, manages memory, drives hardware, and implements filesystems and networking. That's *all* Linux strictly is.
- **The GNU userland** is the surrounding toolset: `bash`, coreutils (`ls`, `cp`, `cat`), `glibc`, `grep`, `gcc`. A bare kernel can't even give you a shell — you need userland. This is why the Free Software Foundation insists on "GNU/Linux."
- **A distribution** is the shippable product: a chosen kernel version + userland + a package manager + init system + security defaults + release policy. Ubuntu, RHEL, Arch, and Alpine are all "Linux" but make wildly different choices.

Why it matters operationally: a "Linux vulnerability" could be kernel (fix = patch + reboot), glibc (fix = patch + restart everything linking it), or a distro package. Knowing which layer you're patching tells you the blast radius.

### Q2. Explain the difference between kernel space and user space, and how they communicate.

**Kernel space** is code running in the CPU's privileged mode (ring 0 on x86): the kernel itself. It can touch any memory, any device, and control scheduling. **User space** is where every normal program runs (ring 3): isolated, memory-protected, unable to directly access hardware.

The *only* bridge is the **system call**. When your program needs something privileged — read a file, allocate memory, send a packet — it issues a syscall, which traps into the kernel, switches to kernel mode, does the work, and returns.

```bash
strace -f -e trace=open,read,write ls    # watch the syscalls ls makes
```

This boundary is why a buggy user program can crash itself but not the machine, and why a kernel panic *is* fatal — there's nothing above the kernel to catch it. Context-switching across this boundary has a cost, which is why high-performance systems batch syscalls (`io_uring`, `sendfile`, `mmap`).

### Q3. Walk me through the Linux boot process from power-on to login.

The chain, in order:

1. **Firmware (BIOS or UEFI)** — POST, then hands off to a bootloader. UEFI reads an EFI System Partition; legacy BIOS reads the MBR.
2. **Bootloader (GRUB2)** — presents the boot menu, loads the selected **kernel** (`vmlinuz`) and **initramfs** from `/boot` into memory, passes the kernel command line (e.g. `root=/dev/sda2 ro`).
3. **Kernel** — decompresses, initialises the CPU, memory, and core drivers, then mounts the **initramfs** as a temporary root.
4. **initramfs** — a small in-RAM filesystem holding the drivers/modules needed to find and mount the *real* root filesystem (RAID, LVM, encrypted disks, exotic controllers).
5. **Pivot to real root + `init` (PID 1)** — the kernel executes `/sbin/init`, which today is **systemd**.
6. **systemd** — activates units to reach the default **target** (`multi-user.target` for a server, `graphical.target` for a desktop), which starts networking, logging, and your services, ending at a login prompt (`getty` or a display manager).

Debugging tip: most "won't boot" incidents live in steps 2–5 — bad GRUB config, a kernel upgrade that didn't rebuild initramfs, or a broken `/etc/fstab` stalling systemd.

### Q4. What is a monolithic kernel, and how does Linux stay extensible if it's monolithic?

Linux is a **monolithic kernel**: filesystems, drivers, networking, and scheduling all run in one privileged address space (contrast with a microkernel like Minix, where drivers run as user-space servers). Monolithic means fast in-kernel calls but a larger trusted codebase — a buggy driver can panic the whole kernel.

The escape hatch is **loadable kernel modules**. You don't recompile the kernel to add a driver; you load a `.ko` file at runtime.

```bash
lsmod                      # list loaded modules
modprobe nvme              # load a module (and its dependencies)
modinfo nvme               # metadata about a module
modprobe -r nvme           # unload
```

So Linux gets microkernel-like extensibility (add/remove drivers live) while keeping monolithic performance. Modules are why one generic distro kernel boots on thousands of hardware combos — it loads only what the detected hardware needs.

### Q5. What is a shell, and what's the difference between a login and an interactive shell?

A **shell** is a user-space program that reads commands, expands them (globbing, variables, pipes), and asks the kernel to execute them via `fork()` + `execve()`. `bash` is the default on most distros; `zsh` (now macOS default) and `dash` (Debian's `/bin/sh`) are common alternates.

Two orthogonal properties decide which startup files run:

- **Login shell** — started at authentication (SSH, console login, `su -`). Reads `/etc/profile` then `~/.bash_profile` / `~/.profile`.
- **Interactive non-login shell** — a terminal you open inside an existing session. Reads `~/.bashrc`.
- **Non-interactive** — a script; reads whatever `$BASH_ENV` points to, usually nothing.

```bash
echo $0            # '-bash' (leading dash) = login shell
shopt -q login_shell && echo login || echo not-login
```

This trips people up constantly: "my `PATH` export works in SSH but not in cron" is almost always a login-vs-non-login startup-file issue.

### Q6. Explain the "everything is a file" philosophy.

In Unix/Linux, most system resources are exposed through the filesystem namespace as file-like objects you can `open`/`read`/`write`/`close`:

- **Regular files and directories** — obvious.
- **Devices** — `/dev/sda` (disk), `/dev/null`, `/dev/random` are files; reading/writing them talks to the driver.
- **Kernel and process state** — `/proc/cpuinfo`, `/proc/<pid>/status`, `/sys/class/net/eth0/…` are files you `cat`.
- **Pipes and sockets** — named pipes (FIFOs) and Unix domain sockets appear as filesystem entries.

The payoff is a **uniform interface**: the same tools (`cat`, `grep`, `dd`, redirection) work across radically different resources. You tune the kernel by writing to a file (`echo 1 > /proc/sys/net/ipv4/ip_forward`), inspect a process by reading files under `/proc/<pid>/`, and disable a device the same way you'd touch any file. It's the design decision that makes the shell so powerful.

### Q7. Compare the major distro families and why the difference matters in production.

| Family | Members | Package mgr | Signature traits |
|---|---|---|---|
| **Debian** | Debian, Ubuntu | `apt`/`dpkg` (`.deb`) | Huge repos, predictable LTS, Ubuntu dominant in cloud |
| **Red Hat** | RHEL, Fedora, CentOS Stream, Rocky, Alma | `dnf`/`rpm` (`.rpm`) | Enterprise support, SELinux-on by default, long lifecycles |
| **Arch** | Arch, Manjaro | `pacman` | Rolling release, bleeding edge, DIY |
| **Alpine** | Alpine | `apk` | musl libc + busybox, tiny (~5MB), the default container base |

Why it matters: package names, file paths, default firewall (ufw vs firewalld), init defaults, and SELinux/AppArmor differ across families, so automation written for Ubuntu breaks on RHEL. Alpine's **musl** libc (not glibc) causes subtle bugs with binaries expecting glibc — a frequent container gotcha. Picking a family is a long-term support and staffing decision, not a taste one.

### Q8. What does `uname` tell you, and how do you check the kernel version?

`uname` reports kernel and machine identity:

```bash
uname -r     # 6.8.0-45-generic   -> kernel release (what you patch/reboot for)
uname -m     # x86_64             -> machine architecture
uname -s     # Linux              -> kernel name
uname -a     # everything at once
```

`uname -r` is the one that matters operationally: it's the running kernel, which you compare against `/boot` to confirm a kernel upgrade will take effect after reboot. Note it reports the *running* kernel, not the newest installed one — after `apt upgrade` you may have a newer kernel on disk but still be running the old one until reboot. For the distro (not kernel) version, use `cat /etc/os-release`.

### Q9. What are /proc and /sys, and how do they differ?

Both are **virtual filesystems** — no disk backing; the kernel generates their contents on read. They're the "everything is a file" interface to the kernel.

- **/proc** — the older one, per-process and system info. `/proc/<pid>/` exposes each process (`status`, `cmdline`, `fd/`, `maps`). `/proc/cpuinfo`, `/proc/meminfo`, `/proc/mounts` expose system state. `/proc/sys/` is writable tunables (also reachable via `sysctl`).
- **/sys** (sysfs) — the newer, more structured one, modelling the device/driver tree: `/sys/class/net/eth0/`, `/sys/block/sda/`, device power and topology.

```bash
cat /proc/loadavg                     # load averages
cat /proc/$$/status                   # this shell's process state
echo 1 > /proc/sys/net/ipv4/ip_forward   # enable routing (transient)
sysctl -w net.ipv4.ip_forward=1          # same thing, the proper way
```

Rule of thumb: **/proc for process + legacy tunables, /sys for hardware/device topology.**

### Q10. What are runlevels and how do systemd targets replace them?

Old SysV init used numeric **runlevels** (0 = halt, 1 = single-user, 3 = multi-user text, 5 = graphical, 6 = reboot), configured via `/etc/inittab` and `/etc/rc*.d/` symlinks executed sequentially.

systemd replaces them with named, dependency-driven **targets**:

| Runlevel | systemd target |
|---|---|
| 0 | `poweroff.target` |
| 1 | `rescue.target` |
| 3 | `multi-user.target` |
| 5 | `graphical.target` |
| 6 | `reboot.target` |

```bash
systemctl get-default                        # multi-user.target
systemctl set-default multi-user.target      # boot to text, no GUI
systemctl isolate rescue.target              # switch now
```

Targets are better because they're **dependency graphs**, not ordered scripts — systemd starts independent units in parallel, dramatically cutting boot time, and only starts what a target actually requires.

### Q11. What's the difference between 32-bit and 64-bit, and how do you tell what you're running?

The width refers to the CPU's registers and address space. **64-bit (x86_64 / aarch64)** can address far more than 4GB of RAM (the ~4GB ceiling is the practical killer of 32-bit), has more registers, and is the default everywhere today. **32-bit (i386/i686, armhf)** survives only on old or tiny embedded hardware.

```bash
uname -m        # x86_64 = 64-bit kernel; i686 = 32-bit
getconf LONG_BIT   # 64 or 32
lscpu | grep 'Op-mode'   # shows 32-bit, 64-bit CPU support
```

Nuance: a 64-bit CPU can run a 32-bit kernel, and a 64-bit kernel can run 32-bit userland binaries if multilib/compat libraries are installed. In containers, an Alpine or Debian image's architecture must match the host (or run under emulation like qemu-user), which is why multi-arch image builds exist.

### Q12. How does the shell find a command when you type it?

The shell resolves a bare command name through a defined lookup order:

1. **Aliases** — checked first (`alias ll='ls -l'`).
2. **Shell functions and builtins** — `cd`, `echo`, `type` live in the shell itself; no new process.
3. **`$PATH` search** — for external commands, the shell scans each directory in `PATH` left to right and runs the first match.

```bash
echo $PATH                 # /usr/local/bin:/usr/bin:/bin:...
which python3              # first PATH match only
type -a python3           # ALL matches + whether alias/builtin/file
command -v ls             # scriptable "where is this"
hash -r                   # clear the shell's cached command locations
```

`type -a` beats `which` because it reveals aliases, functions, and builtins that `which` misses. Classic bug: two versions of a binary in different `PATH` dirs — `type -a` shows you which one wins and why. If a command "isn't found" but the file exists, check `PATH` ordering and the execute bit.

### Q13. How do man pages and built-in help work, and how do you navigate them?

`man` opens the manual page for a command, formatted and paged.

```bash
man ls              # the manual
man 5 crontab       # section 5 (file formats) — not the command
man -k network      # keyword search across all pages (apropos)
```

Man pages are organised into **sections**: 1 = user commands, 2 = syscalls, 3 = library functions, 5 = file formats (`man 5 fstab`), 8 = admin commands. The same name can exist in several sections (`man 1 printf` the command vs `man 3 printf` the C function), hence `man 5 crontab` for the file format vs `man 1 crontab` for the command.

Other help sources: `--help` (quick usage, built into most tools), `info` (GNU's hyperlinked docs), `help <builtin>` for shell builtins like `cd` that have no man page, and `tldr` (community-maintained example-first summaries).

### Q14. If a command hangs, how do you tell what the kernel is doing on its behalf?

Drop to the syscall level with **`strace`** — it intercepts and prints every system call the process makes, so you see exactly where it's blocked.

```bash
strace -f -T -tt mycommand           # -f follow forks, -T time each call, -tt timestamps
strace -p 12345                      # attach to a running PID
strace -e trace=network curl host    # filter to network syscalls
```

If it's stuck in `read()` on a socket, it's waiting on the network; stuck in `open()`/`stat()` on a path, it's a filesystem/NFS problem; a tight loop of `futex` calls suggests lock contention. For a process already wedged, `cat /proc/<pid>/wchan` names the kernel function it's sleeping in, and `cat /proc/<pid>/stack` (as root) shows the kernel stack. This "trap into the kernel and watch the syscalls" move is the senior instinct — it turns "it's slow" into "it's blocked in a DNS lookup."

### Q15. What is `/dev/null` and why does the everything-is-a-file model make redirection so powerful?

`/dev/null` is a **special character device** that discards everything written to it and returns EOF when read — the "bit bucket." Because it's a file, you throw output away with ordinary redirection:

```bash
noisy_command > /dev/null 2>&1     # discard stdout AND stderr
```

That `2>&1` works because the three standard streams (stdin 0, stdout 1, stderr 2) are themselves file descriptors — files. The everything-is-a-file design means one mechanism, redirection, composes across all of them: send stdout to a real file, stderr to `/dev/null`, pipe stdout to another process, or read stdin from a device. Related specials: `/dev/zero` (infinite zero bytes, used to zero-fill or size-test), `/dev/random`/`/dev/urandom` (kernel entropy). The uniformity is exactly why shell pipelines are so expressive.

### Q16. A colleague says "just recompile the kernel to get that new network card working." Is that the right call?

Almost never on a production server. Modern distro kernels are **modular** — the driver you need is very likely already an available module, or ships in a `linux-modules-extra` / matching package. The right sequence:

```bash
lspci -k                 # see the device and whether a driver is bound
lspci -nn | grep -i net  # get the PCI vendor:device ID
modprobe <driver>        # load the module
dmesg | tail             # check the kernel's view of the device
```

If the module exists, `modprobe` (and udev at boot) loads it automatically once the hardware is detected — no recompile. You'd only recompile or build an out-of-tree module (DKMS) for genuinely unsupported/proprietary hardware, and even then DKMS rebuilds the module against each new kernel rather than rebuilding the whole kernel. Recompiling the kernel on a production box is slow, risky, and creates a bespoke artifact you now have to maintain forever — a strong anti-pattern. Reach for the module first.

## The Filesystem & FHS

### Summary

**What this topic covers**

How Linux organises *everything* into a single tree rooted at `/`, and the machinery underneath it. Three concern areas: (1) the **map** — the Filesystem Hierarchy Standard, so you know where configs, logs, binaries, and temporary files live and why (`/etc` vs `/var` vs `/usr` vs `/tmp`); (2) the **plumbing** — inodes, hard vs symbolic links, mount points, and the virtual filesystems (proc, sysfs, tmpfs, devtmpfs) that make non-disk things appear as files; and (3) the **mechanics** — path resolution, file types, the separation between a filename and the data it points to. The 16 questions here turn "I know `cd` and `ls`" into "I understand what a directory *is* and why deleting a file frees no space while a process still holds it open." Disk-full and inode-exhaustion debugging live in the Disk & Storage topic; here we build the model that makes those debugs obvious.

**Mental model**

There is exactly **one tree**. Unlike Windows' `C:`/`D:`, Linux has a single hierarchy from `/`, and additional disks, partitions, network shares, and virtual filesystems are **mounted** onto directories within it (`/`, `/home`, `/boot`, `/proc`). A path like `/var/log/syslog` may cross several physical devices as you descend — mounting is transparent. The second core idea: a **filename is not the file**. A directory is just a table mapping names to **inode numbers**; the inode holds the metadata (owner, permissions, timestamps, size, and pointers to the data blocks) but *not* the name. That indirection explains hard links (two names, one inode), why `rm` is really "unlink this name" (data survives until link count *and* open handles hit zero), and why you can be out of inodes with disk to spare. Hold "one tree, and names point at inodes" and the rest of the topic is deduction.

**Key terms**

- **FHS** — Filesystem Hierarchy Standard; the convention for what goes where (`/etc`, `/var`, `/usr`, …).
- **inode** — on-disk structure holding a file's metadata + data-block pointers; identified by an inode number, *not* a name.
- **Hard link** — an additional directory entry pointing at the same inode; shares data, same filesystem only, can't cross to directories.
- **Symbolic (soft) link** — a tiny file whose contents are a *path* to another file; can cross filesystems and target directories, breaks if the target moves.
- **Mount point** — a directory where another filesystem is grafted into the tree (`mount`, `/etc/fstab`).
- **Virtual filesystem** — kernel-generated, RAM-backed: **proc**, **sysfs**, **tmpfs**, **devtmpfs**.
- **Path** — **absolute** starts at `/`; **relative** starts from the current directory (`.`), using `..` for parent.
- **Hidden file** — a name starting with `.`; hidden from `ls` unless `-a`.
- **File type** — the first char of `ls -l`: `-` file, `d` dir, `l` symlink, `b`/`c` block/char device, `p` pipe, `s` socket.
- **/dev/null, /dev/zero, /dev/random** — special devices: discard, infinite zeros, entropy.
- **Bind mount** — mounting an existing directory at a second location in the tree.

**Why interviewers ask this**

Filesystem literacy is the difference between someone who *guesses* where a log is and someone who *knows*. Interviewers use it to test whether you can reason about disk incidents without panicking: "the disk is full but `du` shows little usage" (a deleted-but-held-open file — pure inode/link reasoning), "we're out of space but `df` says 40% free" (inode exhaustion), "the symlink in the deploy broke after we moved the release dir" (relative vs absolute link targets). Knowing the FHS also signals you can drop onto an unfamiliar box and immediately find configs (`/etc`), logs (`/var/log`), and service data (`/var`, `/srv`, `/opt`) without hunting. Juniors memorise commands; seniors reason from the inode model and the tree, which is exactly what production debugging rewards.

**Common confusions**

- "Deleting a file frees space immediately" — not if a process still has it open; space returns when the last open handle closes.
- "A symlink and a hard link are basically the same" — a hard link *is* the file (same inode); a symlink is a signpost that can dangle.
- "`df` and `du` should always agree" — they measure different things (allocated blocks vs summed file sizes) and diverge on sparse files, held-open deletions, and mount overlaps.
- "You can't run out of space if the disk isn't full" — you can run out of **inodes** while blocks are free.
- "`/tmp` survives reboots" — often tmpfs (RAM) and wiped on boot; never store anything you need there.
- "`.` and `..` are shell magic" — they're real directory entries the filesystem maintains.

**What follows from this topic**

The inode and link model feeds directly into **File Permissions & Ownership** — the very next topic — because permission and ownership bits live *in the inode*, and directory-execute permission is what makes path traversal work. Mount points and `/etc/fstab` lead into the **Disk & Storage** topic (LVM, filesystems, `df`/`du` deep dive, inode exhaustion). The virtual filesystems (`/proc`, `/sys`) tie back to **Fundamentals** and forward to **Processes** (each process is a directory under `/proc`). Bind mounts and namespaced filesystem views are a primitive that **Containers** later build on.

### Q1. Walk me through the Filesystem Hierarchy Standard — what lives where?

The FHS gives every distro a predictable layout. The ones that matter daily:

| Path | Holds |
|---|---|
| `/` | The root of everything; the only top-level. |
| `/etc` | System-wide **configuration** (text files). No binaries. |
| `/var` | **Variable** data: logs (`/var/log`), spools, caches, databases. |
| `/usr` | The bulk of installed software: `/usr/bin`, `/usr/lib`, `/usr/share`. Read-mostly. |
| `/bin`, `/sbin` | Essential user / system binaries (on modern distros, symlinks into `/usr`). |
| `/home` | Per-user home directories. |
| `/tmp` | World-writable scratch space; often wiped on reboot. |
| `/opt` | Self-contained third-party/vendor software. |
| `/srv` | Data served by the system (web, ftp). |
| `/boot` | Kernel, initramfs, GRUB. |
| `/dev` | Device nodes (devtmpfs). |
| `/proc`, `/sys` | Virtual kernel interfaces. |
| `/run` | Runtime state since boot (tmpfs): PIDs, sockets. |

The most useful split to internalise: **`/etc` = config, `/var` = data that changes, `/usr` = installed programs.** That trio covers where you'll spend 90% of your time.

### Q2. What's the difference between /bin and /sbin, and why are they symlinks to /usr now?

Historically:

- **`/bin`** — essential commands every user needs (`ls`, `cp`, `bash`), available even in single-user mode.
- **`/sbin`** — essential **system** binaries, mostly root-only admin tools (`fdisk`, `ip`, `mount`, `reboot`). "s" for system/superuser.

The distinction was that `/bin` and `/sbin` had to work before `/usr` (potentially a separate mounted disk) was available at early boot.

Modern distros (Fedora, Ubuntu, Debian) have done the **`/usr` merge (usrmerge)**: `/bin`, `/sbin`, `/lib` are now symlinks to `/usr/bin`, `/usr/sbin`, `/usr/lib`. The initramfs now provides everything needed at early boot, so the split lost its purpose. Practically: `/sbin` still signals "admin tool," and it may not be in a non-root user's `PATH`, which is why `ifconfig`/`ip` sometimes appear "not found" until you use the full path or `sudo`.

### Q3. What is an inode and what does it store?

An **inode** (index node) is the on-disk record for a file. It stores essentially *everything about the file except its name and its data*:

- File type and **permission bits**
- **Owner** UID and **group** GID
- **Size** in bytes
- **Timestamps**: mtime (content modified), ctime (inode changed), atime (accessed)
- **Link count** (how many names point here)
- **Pointers to the data blocks** on disk

Crucially, the **name lives in the directory**, not the inode — a directory is a table mapping names → inode numbers. That separation is the key to everything: hard links, `rm` semantics, and inode exhaustion.

```bash
ls -i file            # show the inode number
stat file             # full inode metadata
df -i                 # inode usage per filesystem
```

A filesystem is created with a fixed number of inodes; a million tiny files can exhaust inodes while gigabytes of disk sit free.

### Q4. Compare hard links and symbolic links in full.

| | Hard link | Symbolic (soft) link |
|---|---|---|
| What it is | Another **name** for the same inode | A small file containing a **path** |
| Shares data? | Yes — same inode, same blocks | Points by name; indirection |
| Cross filesystems? | **No** (inode numbers are per-fs) | **Yes** |
| Link to a directory? | No (except `.`/`..`) | Yes |
| If original deleted? | Data survives (link count > 0) | Link **dangles** (broken) |
| `ls -l` shows | Normal file, link count > 1 | `l` type, `-> target` |
| Own inode? | No (shares) | Yes (its own tiny inode) |

```bash
ln  file hardlink        # hard link — same inode as file
ln -s /path/target soft  # symlink — stores the path "/path/target"
ls -li                   # compare inode numbers and link counts
```

Rule of thumb: **symlinks for almost everything** (flexible, cross-fs, obvious in `ls`), hard links for the rare case where you need a second name that must survive deletion of the first *and* stay on the same filesystem (e.g. some backup/dedup schemes).

### Q5. A symlink in our deploy broke after we renamed the release directory. Why?

Because the symlink stored a **path**, and that path no longer resolves. Symlinks come in two flavours by how the target was written:

- **Absolute** (`ln -s /srv/app/releases/v3/config config`) — breaks if anything in that absolute path changes.
- **Relative** (`ln -s ../releases/current/config config`) — resolves relative to the *link's own location*, breaking if you move the link relative to the target.

```bash
ls -l config             # config -> /srv/app/releases/v3/config
readlink -f config       # resolve fully; empty/error = dangling
find /srv/app -xtype l    # list all broken symlinks under a tree
```

The classic "current release" pattern uses a symlink `current -> releases/v3` and repoints it atomically on deploy (`ln -sfn releases/v4 current`) — the `-n` prevents descending into an existing symlinked dir. Your break happened because a stored path went stale; fix it by recreating the link (relative if the layout moves as a unit).

### Q6. What's the difference between an absolute and a relative path?

- **Absolute path** starts at the root `/` and is unambiguous regardless of where you are: `/var/log/nginx/access.log`.
- **Relative path** is interpreted from your **current working directory** (`pwd`): `nginx/access.log` means "nginx/access.log *below wherever I am now*."

Two special entries make relative paths work: **`.`** (current directory) and **`..`** (parent directory). So `../config` means "config in the parent," and `./script.sh` forces "the script *here*" (needed because `.` usually isn't in `PATH`).

```bash
pwd                      # where am I
cat ./notes.txt          # relative, explicit
cat ../../etc/hostname   # walk up two, then down
```

Rule for automation: **use absolute paths in scripts, cron jobs, and systemd units** — they run with an unpredictable working directory, and a relative path is a latent bug. Relative paths are for interactive convenience.

### Q7. What are the virtual filesystems, and how do they differ from a disk filesystem?

Virtual (pseudo) filesystems present kernel data as files but store nothing on disk:

- **proc** (`/proc`) — process and system info, generated on read (`/proc/meminfo`, `/proc/<pid>/`).
- **sysfs** (`/sys`) — device/driver topology and tunables.
- **tmpfs** — a **RAM-backed** filesystem for real (but volatile) files; used for `/run`, `/dev/shm`, often `/tmp`. Fast, disappears on reboot, counts against RAM.
- **devtmpfs** (`/dev`) — device nodes the kernel populates automatically as hardware appears.

```bash
mount | grep -E 'proc|sysfs|tmpfs|devtmpfs'
df -h /run /dev/shm       # tmpfs sizes
```

The difference: a disk filesystem (ext4, xfs) persists to a block device; virtual filesystems are the kernel exposing itself (proc/sysfs) or handing you RAM storage (tmpfs). This is the concrete implementation of "everything is a file" — you inspect and tune the kernel with `cat` and `echo`.

### Q8. What does the first character of `ls -l` output tell you?

It's the **file type**, and there are seven you should recognise:

| Char | Type | Example |
|---|---|---|
| `-` | Regular file | `/etc/hostname` |
| `d` | Directory | `/var/log` |
| `l` | Symbolic link | `/usr/bin/vi -> vim` |
| `b` | Block device | `/dev/sda` (buffered, block I/O) |
| `c` | Character device | `/dev/null`, `/dev/tty` (stream I/O) |
| `p` | Named pipe (FIFO) | created by `mkfifo` |
| `s` | Socket | `/run/docker.sock` |

```bash
ls -l /dev/sda /dev/null /run/docker.sock
# brw-rw---- ... /dev/sda      (block)
# crw-rw-rw- ... /dev/null     (character)
# srw-rw---- ... /run/docker.sock (socket)
```

Block vs character is the subtle one: **block devices** (disks) do buffered, randomly-addressable block I/O; **character devices** (terminals, `/dev/null`) do unbuffered stream I/O. Knowing the type char lets you read `ls -l` fluently and spot when something is a socket or device rather than a file.

### Q9. Why does deleting a large file sometimes not free any disk space?

Because on Linux, `rm` doesn't delete data — it **unlinks a name**. The data blocks are freed only when *both* conditions hold: the inode's **link count is zero** (no directory entries left) **and** no process has the file **open**.

If a running process (say, a logger writing to a deleted `/var/log/huge.log`) still holds the file descriptor, the inode and its blocks stay allocated even though the name is gone — the file is invisible to `ls` but consuming disk.

```bash
lsof +L1                 # files with link count < 1 (deleted but open)
lsof -nP | grep deleted  # same idea, shows the holding PID
ls -l /proc/<pid>/fd/    # deleted files show "(deleted)"
```

The fix isn't `rm` again (already gone) — it's to make the process release the handle: restart or `HUP` it, or truncate via the fd (`: > /proc/<pid>/fd/3`). This is the single most common "disk full but `du` shows nothing" incident, and it's pure inode/link-count reasoning.

### Q10. What are `.` and `..`, and are they real?

They're **real directory entries**, not shell tricks. Every directory contains, from creation, two entries:

- **`.`** — a link to the directory *itself* (its own inode).
- **`..`** — a link to its *parent* directory's inode.

That's why a freshly created empty directory has a **link count of 2** (the parent's entry for it, plus its own `.`), and why each subdirectory you add bumps the parent's link count by one (each child's `..` points back).

```bash
ls -ai            # shows . and .. with their inode numbers
stat .            # '.' resolves to the current directory's inode
```

These entries are how relative path navigation (`cd ..`, `./x`) actually works at the filesystem level — the kernel follows the `..` entry to walk up. They're also the reason hard links to directories are forbidden: arbitrary directory hard links would create loops that `..` can't consistently resolve.

### Q11. What are hidden files and how does hiding actually work?

A "hidden" file is simply any name that **starts with a dot** (`.bashrc`, `.git`, `.env`). There's no hidden *attribute* — it's a pure naming convention that `ls` honours by omitting dot-prefixed entries unless you pass `-a`.

```bash
ls        # skips dotfiles
ls -a     # shows everything, including . and ..
ls -A     # everything EXCEPT . and .. (cleaner)
```

The convention exists because home directories are full of per-user config ("dotfiles") that would clutter every listing. A famous origin story: the `.`/`..` hiding was an accident in early Unix `ls` (a sloppy filter for entries starting with `.`), and the dotfile convention grew from it.

Gotcha: shell globbing also skips dotfiles by default, so `rm *` won't remove `.env`, and `cp * dest/` misses `.config`. Use `shopt -s dotglob` (bash) or explicit `.[!.]*` patterns when you need them.

### Q12. Explain mount points and the unified directory tree.

Linux has **one** filesystem tree starting at `/`. Every additional storage device — a second disk, a partition, an NFS share, a USB stick, a tmpfs — is attached at a **mount point**, which is just a directory. After mounting, accessing paths under that directory transparently reads the mounted filesystem.

```bash
mount | column -t                 # everything currently mounted
findmnt                           # the mount tree, readable
mount /dev/sdb1 /mnt/data         # graft sdb1 onto /mnt/data
df -h                             # per-mount usage
```

Persistent mounts go in **`/etc/fstab`** (device/UUID, mount point, fs type, options, dump/pass), applied at boot. A single logical path like `/var/log` might live on a different device than `/`, and users never notice — that's the point of the unified tree.

Two gotchas: mounting onto a non-empty directory **hides** its existing contents until unmount, and a syntactically broken `/etc/fstab` can stall boot in emergency mode — so validate with `mount -a` (or `findmnt --verify`) before rebooting.

### Q13. What is a bind mount and when would you use one?

A **bind mount** makes an existing directory (or file) appear at a second location in the tree — the same underlying data visible at two paths, without copying and without a separate filesystem.

```bash
mount --bind /srv/app/data /var/www/data     # both paths, one data set
mount --rbind /src /dst                       # recursive: include submounts
# in /etc/fstab:
# /srv/app/data  /var/www/data  none  bind  0 0
```

Use cases: exposing a subdirectory of one filesystem inside a chroot or a service's expected path; presenting shared data under multiple locations; giving a container a specific host directory (Docker's `-v /host:/container` bind-mounts under the hood). A bind mount differs from a symlink in that it's a *real mount* — programs see it as an ordinary directory on the actual filesystem, chroots can't escape it via `..`, and permission/namespace semantics are cleaner. Bind mounts, together with namespaces, are a core primitive behind container filesystems.

### Q14. What are `/dev/null`, `/dev/zero`, and `/dev/random`?

These are **special character devices** — the kernel exposing useful data sources/sinks as files:

- **`/dev/null`** — the bit bucket. Writes are discarded; reads return EOF. Used to throw away output: `cmd > /dev/null 2>&1`.
- **`/dev/zero`** — an infinite stream of zero bytes. Used to zero-fill or create sized files: `dd if=/dev/zero of=blank bs=1M count=100`.
- **`/dev/random`** and **`/dev/urandom`** — kernel entropy. `/dev/urandom` is the modern default for almost all randomness (crypto keys, tokens); `/dev/random` historically blocked when the entropy pool was low, which caused hangs — on current kernels the practical advice is "use `urandom`."

```bash
head -c 16 /dev/urandom | base64      # 16 random bytes
dd if=/dev/zero of=/tmp/1g bs=1M count=1024   # a 1GB file of zeros
```

They exemplify everything-is-a-file: standard I/O tools operate on entropy and void alike.

### Q15. At a high level, why can `df` and `du` disagree about disk usage?

They measure fundamentally different things:

- **`df`** asks the *filesystem* how many blocks are allocated on a device — the authoritative "how full is the disk."
- **`du`** walks a directory tree and sums the sizes of the files it can **see and traverse**.

They diverge when those views don't match:

1. **Deleted-but-open files** — space is allocated (counts in `df`) but the name is gone, so `du` can't see it. The number-one cause.
2. **A mount hiding files** — files under a directory that now has something mounted over it are counted by `df` (on the underlying fs) but not reached by `du`.
3. **Permissions** — `du` as a non-root user skips directories it can't enter, undercounting.
4. **Sparse files / block rounding** — `du` can report allocated blocks vs apparent size differently (`du --apparent-size`).

```bash
df -h /var                # filesystem truth
du -sh /var/* | sort -h   # where the space is, per subtree
```

Rule: **`df` for "is the disk full," `du` for "what's using it."** When they disagree by a lot, suspect a held-open deleted file (`lsof +L1`).

### Q16. How does the kernel resolve a pathname like `/var/log/syslog`?

Path resolution is a **step-by-step walk**, and understanding it explains a surprising number of "permission denied" mysteries:

1. Start at the **root inode** for an absolute path (`/`), or the current working directory's inode for a relative one.
2. For each component, read the current directory to find the name → **inode number** mapping. This requires **execute (`x`) permission on the directory** (execute on a dir = "may traverse/look up names in it").
3. Move to that inode. If it's a **symlink**, resolve the stored path (recursively, up to a loop limit) and continue.
4. Repeat until the final component; then check the permission you actually need (read/write/execute) on the *final* file.

```bash
namei -l /var/log/syslog     # shows perms at EVERY step of the walk
```

The senior insight: you can be denied access to a file you have full `rwx` on if any **parent directory** lacks the `x` bit — because the kernel can't traverse into it to reach the file. "Permission denied" is frequently a directory-traversal problem, not a file-permission one — `namei -l` pinpoints exactly which component blocks the walk. This directly sets up the permissions topic next.

## File Permissions & Ownership

### Summary

**What this topic covers**

The Unix access-control model and everything layered on top of it. Three concern areas: (1) the **classic model** — the user/group/other × read/write/execute matrix, reading `ls -l`, and setting it with `chmod` (octal and symbolic) and `chown`/`chgrp`; (2) the **subtleties** — what r/w/x mean differently on files vs directories, `umask` and default permissions, and the three special bits (SUID, SGID, sticky) that solve real problems and create real risks; and (3) the **beyond-basic** tools — POSIX ACLs for when three permission classes aren't enough, file attributes (`chattr +i`), and Linux **capabilities** as the modern, safer alternative to SUID-root. The 17 questions run from "what does `755` mean" to "why is a world-writable SUID-root binary a disaster" and "how would you let a service bind port 80 without running it as root." Permissions are where security incidents and "permission denied" tickets both originate, so fluency here pays off constantly.

**Mental model**

Every file's inode carries an **owner (UID)**, a **group (GID)**, and **nine permission bits**: read/write/execute for each of **user (owner), group, other**. When you touch a file, the kernel checks *one* class in order — if you're the owner, only the owner bits apply; else if you're in the group, only group bits; else other. (Root bypasses all of it.) The single biggest conceptual leap is that **r/w/x mean different things on directories than on files**: on a directory, `x` means "traverse/enter," `r` means "list names," and `w` (plus `x`) means "create/delete entries *inside*." So directory permissions, not file permissions, often decide whether you can reach or delete something. On top of the base model sit three special bits (SUID/SGID/sticky) and, when the owner/group/other split is too coarse, ACLs and capabilities. Think "identity → matched class → the right rwx for files-vs-dirs," and permission puzzles resolve.

**Key terms**

- **UGO / rwx** — user, group, other × read, write, execute; the nine base bits.
- **Octal notation** — `r=4, w=2, x=1`; `755` = `rwxr-xr-x`, `644` = `rw-r--r--`.
- **`chmod`** — change mode bits, symbolic (`u+x`, `go-w`) or octal (`chmod 640`).
- **`chown` / `chgrp`** — change owner / group (`chown alice:devs file`).
- **`umask`** — bits *masked off* the default (files 666, dirs 777) at creation; typical `022` → files 644, dirs 755.
- **SUID (4xxx)** — run an executable with the **file owner's** identity (e.g. `passwd` runs as root).
- **SGID (2xxx)** — on a file, run as the file's group; **on a directory**, new files inherit the directory's group.
- **Sticky bit (1xxx)** — on a directory, only a file's owner (or root) can delete it; set on `/tmp`.
- **POSIX ACL** — per-user/per-group permissions beyond UGO (`getfacl`, `setfacl`).
- **`chattr` / `lsattr`** — filesystem attributes; `+i` = immutable (even root can't modify until cleared).
- **Capabilities** — fine-grained slices of root's power (`CAP_NET_BIND_SERVICE`) grantable per-binary (`getcap`/`setcap`).
- **Directory `x`** — the traverse bit; without it you can't reach anything inside, whatever the file's own perms.

**Why interviewers ask this**

Permissions are simultaneously an operations skill and a security skill, so they reveal two things at once. On operations: can you diagnose "permission denied" correctly — is it the file, or a parent directory missing `x`, or ownership, or an ACL? Juniors `chmod 777` and move on (creating a vulnerability); seniors find the *minimum* correct fix and understand the traverse bit. On security: SUID-root binaries, world-writable files, and over-broad ownership are classic privilege-escalation vectors, and interviewers want to hear you reason about *least privilege* — why you'd use a capability instead of SUID, why `chmod 777` on a web root is a red flag, why the sticky bit exists on shared directories. Getting the special bits and capabilities right is a strong senior/SRE signal because it shows you think about the security model, not just making the error go away.

**Common confusions**

- "`chmod 777` fixes permission problems" — it's almost always wrong and a security hole; the real fix is usually ownership or a parent directory's `x` bit.
- "Execute on a directory lets me run it" — no; `x` on a directory means *traverse into it*.
- "SUID changes who owns the file" — no; SUID changes the **effective identity of the running process** to the file's owner.
- "The sticky bit stops writing files" — modern sticky (on dirs) restricts **deletion/rename** to the file's owner, not writing.
- "root is limited by permissions" — root bypasses the rwx checks (but *not* an immutable `chattr +i` attribute or certain LSM/SELinux policies).
- "`umask` adds permissions" — it **removes** them from the creation defaults.

**What follows from this topic**

This topic closes the loop with **The Filesystem & FHS** — permission and ownership bits live in the inode, and the directory-traverse bit is exactly what path resolution needs. It sets up the **Users, Groups & Auth** topic (UIDs/GIDs, `sudo`, PAM) and the **Security & Hardening** topic (SELinux/AppArmor extend and can override the classic model; capabilities and `chattr` are hardening tools). SUID and capabilities also reappear under **Containers**, where dropping capabilities and running as non-root are baseline practices. Master least privilege here and the security topics become application rather than new theory.

### Q1. Explain the Linux permission model — user, group, other and read, write, execute.

Every file/directory has an **owner (a UID)** and an associated **group (a GID)**, plus nine permission bits arranged as three triplets:

```
 rwx  rwx  rwx
 user group other
```

- **user (owner)** — permissions for the file's owner.
- **group** — permissions for members of the file's group.
- **other** — everyone else.

Each triplet has **r** (read), **w** (write), **x** (execute). The kernel checks exactly **one** class, in order: if you're the owner it uses the owner bits *only* (even if group/other are broader); else if you're in the group, the group bits; else other. Root skips these checks entirely.

```bash
ls -l file       # -rw-r--r-- 1 alice devs ...
```

That reads as: regular file; owner alice can read+write; group devs can read; others can read. The "one matching class wins" rule surprises people — being in the group doesn't help if *you're the owner* and the owner bits are restrictive.

### Q2. How do you read the output of `ls -l`?

Decompose the first field character by character:

```
-rwxr-x---  1  alice  devs  4096  Jul  1 10:00  deploy.sh
│└┬┘└┬┘└┬┘
│ │  │  └── other: --- (nothing)
│ │  └───── group: r-x (read, execute)
│ └──────── user:  rwx (read, write, execute)
└────────── type:  - (regular file)
```

Then the fields: **link count** (1), **owner** (alice), **group** (devs), **size** in bytes (4096), **mtime**, **name**.

```bash
ls -l          # human view
ls -ln         # show numeric UID/GID instead of names (useful across systems)
stat deploy.sh # exact bits, all three timestamps, inode
```

`ls -ln` is the pro move when names don't resolve (containers, NFS with mismatched UID maps) — it shows the raw numbers the kernel actually checks.

### Q3. What's the difference between octal and symbolic chmod?

Two ways to express the same nine bits.

**Octal** — each triplet is a digit summed from `r=4, w=2, x=1`:

| Octal | Bits | Meaning |
|---|---|---|
| 7 | rwx | 4+2+1 |
| 6 | rw- | 4+2 |
| 5 | r-x | 4+1 |
| 4 | r-- | 4 |

```bash
chmod 755 script.sh    # rwxr-xr-x  (common for executables)
chmod 644 file.txt     # rw-r--r--  (common for data)
chmod 600 secret.key   # rw-------  (owner only)
```

**Symbolic** — relative changes with `who` (`u`/`g`/`o`/`a`) and `op` (`+`/`-`/`=`):

```bash
chmod u+x deploy.sh    # add execute for owner
chmod go-w file        # remove write from group and other
chmod a=r file         # set exactly read for all, clear the rest
chmod -R g+rX dir/      # recursive; capital X = execute only on dirs/already-exec files
```

Use octal to set an absolute mode; use symbolic to tweak one bit without disturbing others. The capital-`X` trick (`g+rX`) is invaluable recursively — it adds directory-traverse without making every data file executable.

### Q4. What do read, write, and execute actually mean on a directory versus a file?

This is the most-tested subtlety, because the meanings differ:

| Bit | On a **file** | On a **directory** |
|---|---|---|
| **r** | Read contents | **List** the names inside (`ls`) |
| **w** | Modify contents | **Create/delete/rename** entries inside (needs `x` too) |
| **x** | Execute it | **Traverse/enter** — `cd` into it, access things inside by name |

Key consequences:

- **`x` without `r` on a dir** — you can `cd` in and access a file *if you know its exact name*, but `ls` fails ("permission denied"). Used for "drop box" directories.
- **`r` without `x`** — `ls` may show names but you can't `stat`, enter, or read any file inside.
- **Deleting a file** depends on the **directory's** `w`+`x`, *not* the file's permissions — you can delete a file you can't write, if you can write its directory.

```bash
chmod 711 /home/alice   # others can traverse to reach public subdirs but can't list
```

"Execute on a directory = permission to walk through it" is the sentence to have ready.

### Q5. How do `chown` and `chgrp` work, and who's allowed to use them?

- **`chown`** changes the **owner** (and optionally group): `chown alice file`, `chown alice:devs file`, `chown :devs file` (group only).
- **`chgrp`** changes just the group: `chgrp devs file`.

```bash
chown -R www-data:www-data /srv/app     # recursively hand a tree to a service account
chown --reference=good.conf new.conf    # copy owner/group from another file
```

Permission rules matter: **only root can change a file's owner.** A normal user *cannot* give their file away (this prevents quota evasion and confused-deputy tricks). A non-root user can `chgrp` a file they own **only to a group they're a member of**. This is why deployment scripts that re-own files typically run under `sudo`, and why "operation not permitted" on `chown` usually means "you're not root."

### Q6. What is `umask` and how does it determine default permissions?

`umask` is a **mask of bits to remove** from the base creation permissions. The base defaults are **666** for files (`rw-rw-rw-`, no execute — you don't want new data files executable) and **777** for directories. The kernel subtracts the umask:

```
files:  666 - umask
dirs:   777 - umask
```

With the common `umask 022`:
- new files → `666 & ~022` = **644** (`rw-r--r--`)
- new dirs → `777 & ~022` = **755** (`rwxr-xr-x`)

A stricter `umask 077` gives files 600 and dirs 700 — private to the owner, common on multi-tenant boxes.

```bash
umask            # show current (e.g. 0022)
umask 027        # group can read, others get nothing (files 640, dirs 750)
```

Set it in `/etc/profile`, `~/.bashrc`, or a systemd unit's `UMask=`. It's a *mask*, not an addition — a frequent confusion. It only affects **newly created** files; it never changes existing ones.

### Q7. Explain the three special permission bits: SUID, SGID, and sticky.

Beyond the nine base bits sit three special bits, shown in the execute positions of `ls -l`:

- **SUID (setuid, octal 4000)** — on an **executable**, the process runs with the **file owner's** identity, not the caller's. This is how `/usr/bin/passwd` (owned by root, SUID) lets a normal user edit `/etc/shadow`. Shows as `s` in the user-execute slot: `-rwsr-xr-x`.
- **SGID (setgid, octal 2000)** — on an **executable**, runs with the file's **group**. More usefully, **on a directory**, new files created inside inherit the *directory's* group (not the creator's primary group) — the mechanism for shared team directories. Shows as `s` in the group-execute slot.
- **Sticky bit (octal 1000)** — on a **directory**, restricts deletion/rename so only a file's **owner** (or root) can remove it, even in a world-writable dir. Set on `/tmp`. Shows as `t` in the other-execute slot: `drwxrwxrwt`.

```bash
chmod u+s binary      # or chmod 4755
chmod g+s shared/     # or chmod 2775  (group-inheriting dir)
chmod +t /shared/tmp  # or chmod 1777
ls -l /usr/bin/passwd /tmp -d
```

### Q8. Why is a SUID-root binary a security risk?

Because a SUID-root program is a **legitimate way for an unprivileged user to run code as root** — so *any* bug in it (buffer overflow, command injection, an unsanitised `system()` call, a race) can become full privilege escalation. The binary is a standing offer of root to whoever can trick it.

Concrete dangers:
- A world-writable *or* attacker-modifiable SUID-root file = trivial root.
- A SUID binary that runs external commands and honours a user-controlled `PATH` or `IFS` = injection to root.
- Even read of protected files if the SUID program leaks memory or follows symlinks carelessly.

Defensive practice:
```bash
find / -perm -4000 -type f 2>/dev/null     # AUDIT every SUID binary
find / -perm -2000 -type f 2>/dev/null     # SGID too
```

Keep the SUID-root set as small as possible, mount untrusted filesystems `nosuid`, and prefer **capabilities** (next questions) so a binary gets *only* the one privilege it needs instead of all of root. Auditing SUID binaries is a standard step in host hardening and incident response.

### Q9. How does the sticky bit protect /tmp?

`/tmp` is **world-writable** (`1777`, `drwxrwxrwt`) — every user needs to create files there. Without protection, "write on the directory" would also let *any* user **delete or rename anyone else's** files in `/tmp`, enabling denial-of-service and file-swap attacks.

The **sticky bit** (the `t`) fixes this: in a sticky directory, you may only **delete or rename a file if you own the file** (or you own the directory, or you're root) — regardless of the directory's write permission. So users can still freely create their own temp files, but can't clobber each other's.

```bash
ls -ld /tmp          # drwxrwxrwt  ← the trailing t
chmod +t /shared     # apply to any shared writable directory
```

Combine sticky with SGID on team-shared directories: SGID makes new files inherit the group, sticky stops members deleting each other's files — the standard "collaborative directory" recipe (`chmod 3775 /shared/project`).

### Q10. Set up a directory where a team can collaborate on files. What permissions and special bits?

Goal: everyone in group `devs` can create and edit files, new files automatically belong to `devs` (not each member's personal group), and members can't delete each other's files.

```bash
groupadd devs                          # (if needed)
mkdir /srv/project
chgrp devs /srv/project                # own it to the team group
chmod 2775 /srv/project                # rwx owner, rwx group, r-x other, + SGID
chmod +t /srv/project                  # add sticky -> mode becomes 3775
# result: drwxrwsr-t
```

Why each piece:
- **`2` (SGID)** — new files/subdirs **inherit the `devs` group**, so everyone can access them without manual `chgrp`.
- **`775`** — group has full `rwx`; others read/traverse only.
- **`+t` (sticky)** — members can delete only their **own** files.
- A permissive **`umask 002`** for team members ensures new files are group-writable (`664`), otherwise SGID inheritance alone still leaves files group-read-only.

This SGID+sticky+group-writable-umask trio is the canonical shared-directory answer.

### Q11. What are POSIX ACLs and when do you need them?

The classic model has exactly **three** permission classes (owner/group/other). That breaks when you need *"alice and bob can write, the audit group can read, everyone else nothing"* — more than one user or group with distinct rights. **POSIX ACLs** extend the inode with a list of additional user/group entries.

```bash
getfacl file                          # show the ACL
setfacl -m u:alice:rw file            # grant alice rw specifically
setfacl -m g:audit:r  file            # grant group audit read
setfacl -x u:alice    file            # remove alice's entry
setfacl -m d:u:alice:rwx dir/         # DEFAULT ACL: inherited by new files in dir
setfacl -b file                       # strip all ACLs
```

A file with ACLs shows a **`+`** in `ls -l` (`-rw-rw----+`). **Default ACLs** on a directory are inherited by everything created inside — the ACL equivalent of SGID, and how you build rich shared trees. Use ACLs when the owner/group/other split is genuinely too coarse; don't reach for them by default (they add complexity and some tools/backup paths handle them imperfectly). The mental trigger: **"I need per-user or multi-group rules" → ACLs.**

### Q12. What are file attributes, and what does `chattr +i` do?

Beyond permissions, ext4/xfs/btrfs support **file attributes** — filesystem-level flags set with `chattr` and read with `lsattr`. The famous one:

- **`+i` (immutable)** — the file **cannot be modified, deleted, renamed, or linked to — even by root** — until the attribute is cleared.

```bash
chattr +i /etc/resolv.conf     # freeze it (stop something rewriting it)
lsattr /etc/resolv.conf        # ----i---------e-- shows the i
chattr -i /etc/resolv.conf     # unlock before legitimate edits
```

Other useful attributes: **`+a` (append-only)** — can only be appended to, great for logs you don't want tampered/truncated; **`+A`** — don't update atime (perf). 

This is one of the rare cases where **root is blocked** by the filesystem: immutability is enforced below the permission layer. Practical uses: pinning `/etc/resolv.conf` against a service that keeps clobbering it, protecting log files (`+a`), or a lightweight tamper barrier. The catch: it's easy to forget you set it — "root can't edit this file!" is very often a stray `+i`, so check `lsattr` when a root write mysteriously fails.

### Q13. When a user creates a file, what owner and group does it get?

- **Owner** — the **effective UID** of the creating process (normally the user running it).
- **Group** — by default, the user's **primary group** (from `/etc/passwd` / `/etc/group`)... **unless** the parent directory has the **SGID** bit, in which case the new file inherits the **directory's group** instead.

```bash
touch file; ls -l file       # owner=you, group=your primary group
# in an SGID directory:
ls -ld shared/               # drwxrwsr-x ... group devs
touch shared/file; ls -l shared/file   # group = devs (inherited), not your primary
```

The permission bits come from the base defaults minus your **umask** (Q6). So three things decide a new file's identity/perms: the process's UID (owner), the SGID-or-not directory (group), and the umask (mode). This is exactly why shared team directories use SGID — to override the "primary group" default so collaborators can all access new files.

### Q14. A user gets "permission denied" on a file they clearly have read access to. How do you debug it?

Don't trust the file's own bits — walk the whole path, because the failure is often a **parent directory** missing the traverse (`x`) bit.

```bash
namei -l /srv/app/config/settings.yml    # perms at EVERY component of the path
```

`namei -l` prints owner/group/mode for `/`, `srv`, `app`, `config`, and the file — the first component lacking the `x` bit (for your class) is your culprit, even if the file itself is `644`.

Checklist, in order:
1. **Parent directory `x`** — can you *traverse* to the file? (most common cause)
2. **Your identity vs the matched class** — `id` and `ls -ln`; remember only the *first* matching class applies (owner bits can be *more* restrictive than group).
3. **ACLs** — a `+` in `ls -l`; run `getfacl`.
4. **Immutable attribute** — `lsattr` for a stray `+i`/`+a` (bites on writes).
5. **SELinux/AppArmor** — `ls -Z`, `getenforce`, and `ausearch`/`dmesg` for AVC denials, which DAC tools won't explain.

The senior move is checking the *directory chain and MAC layer*, not just `ls -l` on the file — most "denied on a readable file" tickets are a directory `x` bit or an SELinux context.

### Q15. What are Linux capabilities and how do they improve on SUID-root?

**Capabilities** split root's monolithic power into ~40 independent privileges, so a process can hold *just one* instead of all of root. Examples: `CAP_NET_BIND_SERVICE` (bind ports < 1024), `CAP_NET_RAW` (raw sockets, for `ping`), `CAP_SYS_TIME`, `CAP_CHOWN`, `CAP_DAC_OVERRIDE`.

The win over SUID-root: a SUID-root binary that's exploited hands the attacker **everything**; a binary with only `CAP_NET_BIND_SERVICE` that's exploited grants **only** the ability to bind low ports. Least privilege, enforced.

```bash
getcap /usr/bin/ping                        # cap_net_raw=ep
setcap 'cap_net_bind_service=+ep' /usr/local/bin/myserver   # bind :80 as non-root
getcap -r / 2>/dev/null                      # audit all file capabilities
```

This is why modern `ping` is **no longer SUID-root** — it carries `CAP_NET_RAW` instead. The `+ep` means the capability is Effective and Permitted. Capabilities also underpin container security: Docker drops most capabilities by default and lets you add back only what a workload needs (`--cap-add`, `--cap-drop`). The interview-ready framing: **"capabilities let you grant a slice of root instead of all of it — the modern replacement for SUID-root."**

### Q16. How do file permissions interact with the root user?

The **root user (UID 0) bypasses the discretionary (rwx/UGO/ACL) permission checks entirely.** Root can read, write, and delete any file regardless of its mode — which is exactly why you minimise what runs as root.

But root is **not** omnipotent; several things still constrain it:

- **The immutable attribute** (`chattr +i`) — root can't modify the file until it clears the attribute (Q12).
- **Execute still needs an execute bit** — even root can't `execve` a file with no `x` bit anywhere (though root can trivially `chmod +x` it first).
- **Mandatory Access Control** — **SELinux** (enforcing) or **AppArmor** policy can deny root operations that DAC would allow; MAC sits *above* the "root wins" rule.
- **Capabilities/namespaces** — a "root" process inside a container with dropped capabilities isn't real host root; and read-only mounts stop even root writing.
- **Kernel lockdown / `nosuid`,`noexec` mount options** — restrict what even root can do on that mount.

So the accurate statement is "root bypasses the *classic* permission bits, but not immutability, MAC, or namespace/mount restrictions." That nuance — that modern Linux deliberately builds layers root *doesn't* automatically defeat — is the senior-level point.

### Q17. Someone runs `chmod -R 777` on `/var/www` to fix a web app error. What's wrong with that and what should they do instead?

`chmod -R 777` is a **security red flag and almost never the real fix.** It makes every file and directory writable *and executable* by **every user on the system** — any local account (or a compromised process) can now modify the site's code, drop a webshell, or alter config. It also usually doesn't even address the actual cause.

The real problem is almost always **ownership or a single missing bit**, not "not enough permission for everyone." The correct approach:

1. **Identify the service's user** — nginx/apache/php-fpm run as `www-data` (Debian) or `nginx`/`apache` (RHEL).
2. **Fix ownership**, then apply *least* privilege:
```bash
chown -R www-data:www-data /var/www/app
find /var/www/app -type d -exec chmod 755 {} \;   # dirs: traverse+read
find /var/www/app -type f -exec chmod 644 {} \;   # files: read (no execute)
chmod 640 /var/www/app/.env                        # secrets: owner+group only
```
3. If the app needs to **write** to specific paths (uploads, cache), grant write **only there** (`chmod 775` or an ACL) and only to the service group.

Diagnose *why* it was denied (`namei -l`, check the service user) rather than sledgehammering it. "Never `chmod 777`; fix ownership and grant the minimum" is the answer that signals security awareness.
## Users, Groups & Authentication

### Summary

**What this topic covers**

Who a Linux system thinks you are, and how it decides. This topic covers the identity plumbing every SRE eventually has to debug: the flat-file account databases (`/etc/passwd`, `/etc/shadow`, `/etc/group`, `/etc/gshadow`), the numeric identities underneath the names (UID and GID, with 0 = root), the difference between a primary group and supplementary groups, the account-management verbs (`useradd`/`usermod`/`userdel`, `passwd`, `adduser`), and the two escalation paths (`su` and `sudo` via `/etc/sudoers`). It also covers where authentication *actually* happens — PAM and NSS — and the shell-startup rules (login vs non-login vs interactive) that decide which dotfiles run, which is the single most common source of "why is my `PATH` different over SSH than in cron" confusion. The 16 questions run from "what are the fields in `/etc/passwd`" up to "a service account can log in interactively and it shouldn't — how did that happen and how do you lock it down".

**Mental model**

Think of identity in three layers. (1) **The name-to-number map**: humans use names (`alice`), the kernel only ever deals in numbers (UID 1000, GID 1000). `/etc/passwd` and `/etc/group` are the translation tables. Every process runs *as a UID*, not a name — the name is a label resolved for display. (2) **The credential store**: passwords never live in `/etc/passwd` (world-readable); the hashes live in `/etc/shadow` (root-only, mode `0640`/`0000`). (3) **The decision engine**: when something asks "is this password right?" or "what groups is alice in?", the answer comes from PAM (authentication) and NSS (`nsswitch.conf`, name resolution) — pluggable stacks that may consult local files, LDAP, SSSD, Kerberos, etc. The files are just the default backend. Escalation (`sudo`, `su`) is a *fourth* concern layered on top: it's about temporarily becoming another UID (usually 0) under an audited policy.

**Key terms**

- **UID / GID** — numeric user and group IDs. UID 0 is root. Convention: 1–999 system/service accounts, 1000+ regular users (Debian/RHEL modern default).
- **/etc/passwd** — world-readable account table: `name:x:UID:GID:GECOS:home:shell`. The `x` means "password is in shadow".
- **/etc/shadow** — root-only hashed passwords + aging fields. `$6$` prefix = SHA-512.
- **/etc/group** / **/etc/gshadow** — group membership and group passwords.
- **Primary group** — the GID in the user's passwd entry; owns files they create. **Supplementary groups** — extra memberships from `/etc/group`.
- **PAM** — Pluggable Authentication Modules; the stack that decides *how* auth happens (`/etc/pam.d/`).
- **NSS / nsswitch.conf** — decides *where* names/groups are looked up (files, ldap, sss).
- **sudo / /etc/sudoers** — fine-grained, audited privilege escalation; edit with `visudo`.
- **su** — switch user (needs the target's password, or root can switch to anyone freely).
- **Login vs non-login shell** — determines which startup files run (`~/.bash_profile` vs `~/.bashrc`).
- **nologin shell** — `/usr/sbin/nologin` or `/bin/false`; blocks interactive login for service accounts.

**Why interviewers ask this**

Identity is where security incidents and access-control bugs start, so it's a reliable senior-vs-junior filter. A junior can create a user; a senior knows that adding alice to a group won't take effect until she re-logs in (group membership is baked into the session at login), knows why passwords live in shadow not passwd, and reaches for `sudo` with a scoped rule rather than handing out the root password. Interviewers also probe the "it works in my shell but not in cron/systemd" class of bugs, which almost always traces back to login-vs-non-login shell dotfile rules — understanding that is a strong signal you've actually operated systems, not just read about them. For SRE/DevOps roles they want to hear least-privilege instincts: NOPASSWD only for specific commands, service accounts with `nologin`, no shared root logins.

**Common confusions**

- "Passwords are in `/etc/passwd`" — no, only a placeholder `x`; hashes are in `/etc/shadow`.
- "`sudo su -` and `sudo -i` are the same as `su`" — `sudo` authenticates *you* and is audited; `su` needs the *target's* password and logs less.
- "Adding a user to a group takes effect immediately" — not for existing sessions; supplementary groups are resolved at login. Re-login or `newgrp`.
- "Root is special in the kernel" — root is just UID 0; most privilege checks are literally `if (uid == 0)`. The name "root" is a convention.
- "The `#` prompt vs `$` prompt is cosmetic" — by convention `#` means you're UID 0. Worth respecting.

**What follows from this topic**

Identity underpins everything else. The UID/GID model here is exactly what the **Permissions & Ownership** topic builds on — file mode bits are checked against your effective UID and group set. The login-vs-non-login shell distinction reappears in **Job Scheduling** (cron's stripped environment) and in service startup. And the "become another user" mechanics feed directly into how **Processes & Signals** thinks about process credentials and daemons dropping privileges after binding a port.

### Q1. What are the fields in a line of `/etc/passwd`?

Seven colon-separated fields:

```
alice:x:1000:1000:Alice Example,,,:/home/alice:/bin/bash
```

1. **Username** — login name.
2. **Password placeholder** — historically the hash; now almost always `x`, meaning "look in `/etc/shadow`".
3. **UID** — numeric user ID. 0 = root.
4. **GID** — the user's *primary* group ID.
5. **GECOS** — comma-separated free text (full name, phone, etc.); mostly cosmetic.
6. **Home directory** — starting `$HOME`.
7. **Login shell** — program run on login. `/usr/sbin/nologin` or `/bin/false` here blocks interactive login.

`/etc/passwd` is world-readable *by design* — lots of tools need name↔UID lookups — which is exactly why the password hash was moved out to `/etc/shadow`.

### Q2. What's in `/etc/shadow` and why is it separate from `/etc/passwd`?

`/etc/shadow` holds the actual password hashes plus aging metadata, and is readable only by root (mode `0640` root:shadow, or `0000`). It exists purely so hashes aren't world-readable — because `/etc/passwd` has to be.

Fields (colon-separated): username, hashed password, days-since-epoch of last change, min days between changes, max password age, warning period, inactivity period, expiration date, reserved.

The hash field encodes the algorithm: `$1$` = MD5 (obsolete), `$5$` = SHA-256, `$6$` = SHA-512 (the common modern default), `$y$` = yescrypt (newer distros). A `*` or `!` in the field means the account has no valid password / is locked. An empty field means no password required — a red flag.

### Q3. Explain UID and GID, and the significance of UID 0.

UID (user ID) and GID (group ID) are the numeric identities the kernel actually enforces on — names are a userspace convenience resolved via `/etc/passwd` and NSS. Every process carries a UID/GID (and effective/real/saved variants); file permission checks compare against them.

**UID 0 is root.** It's not magic in the name — most kernel privilege checks are effectively `if (uid == 0) allow`. Rename root to anything you like; UID 0 is what matters.

Conventional ranges (see `/etc/login.defs`):

| Range | Purpose |
|---|---|
| 0 | root |
| 1–999 | system / service accounts (daemons) |
| 1000+ | regular human users (Debian/RHEL modern) |
| 65534 | `nobody` (unprivileged) |

Two accounts sharing UID 0 both *are* root — a classic backdoor pattern to check for during audits (`awk -F: '$3==0'  /etc/passwd`).

### Q4. Primary group vs supplementary groups — what's the difference?

Your **primary group** is the GID in field 4 of your `/etc/passwd` line. It's the group that owns files you create by default, and there's exactly one.

**Supplementary (secondary) groups** are additional memberships listed in `/etc/group`. You can be in many; they grant access to group-owned resources (e.g. `docker`, `sudo`, `wheel`).

```bash
id alice        # shows uid, primary gid, and all supplementary groups
groups alice    # just the group names
newgrp docker   # start a subshell with docker as the *primary* group
```

Key gotcha: supplementary group membership is resolved **at login** and baked into the session. Add alice to `docker` and her *current* shells won't see it — she must log out and back in (or `newgrp docker`) before `id` reflects it. This trips up "I added them to the group but they still get permission denied".

### Q5. What are `/etc/group` and `/etc/gshadow`?

`/etc/group` is the group database: `groupname:x:GID:member1,member2`. The member list is the *supplementary* membership — users whose primary GID is this group are **not** listed here (their membership comes from `/etc/passwd`), which surprises people grepping for a user in `/etc/group`.

`/etc/gshadow` is to groups what `/etc/shadow` is to users: it stores group passwords (rarely used) and the group administrator list, root-readable only. Group passwords let a non-member temporarily join via `newgrp` if they know it — almost nobody uses this in practice.

### Q6. Compare `useradd`, `adduser`, `usermod`, and `userdel`.

- **`useradd`** — low-level, non-interactive, same everywhere. `useradd -m -s /bin/bash -G sudo alice` (`-m` makes the home dir, `-s` sets shell, `-G` adds supplementary groups). By itself it may not create a home dir or set a password.
- **`adduser`** — Debian/Ubuntu's friendly interactive Perl wrapper around `useradd`: prompts for password, creates the home dir, copies `/etc/skel`. Not present (or a different tool) on RHEL.
- **`usermod`** — modify an existing account. Critical flag: `usermod -aG docker alice` — the `-a` (append) is essential; `usermod -G docker alice` *replaces* all supplementary groups, silently removing alice from every other group. Forgetting `-a` is a famous foot-gun.
- **`userdel`** — remove an account. `userdel -r alice` also removes the home dir and mail spool; without `-r` you leave orphaned files owned by a now-unmapped UID.

### Q7. What does `passwd` do, and how do you lock an account?

`passwd` sets or changes a password (writes the hash to `/etc/shadow`). A regular user changing their own password must supply the old one; root can set anyone's without it.

Useful forms:

```bash
passwd alice        # root sets alice's password
passwd -l alice     # lock: prepends ! to the hash, disabling password login
passwd -u alice     # unlock
passwd -e alice     # expire now — force change at next login
chage -l alice      # view aging info (expiry, last change)
```

Note `passwd -l` only blocks *password* auth — SSH key login and existing sessions still work. To fully disable login you also set the shell to `nologin` (and remove keys / kill sessions). `usermod -L`/`-U` do the same lock/unlock.

### Q8. What is `sudo` and how does `/etc/sudoers` work?

`sudo` runs a command as another user (root by default) under a policy defined in `/etc/sudoers`, authenticating with *your own* password and logging every invocation. It's the modern, auditable, least-privilege escalation mechanism.

Always edit with **`visudo`** — it syntax-checks before saving, so you don't lock yourself out with a typo (a broken sudoers can make sudo refuse to run at all).

```
# user  host = (runas) commands
alice   ALL=(ALL:ALL) ALL                    # full sudo
%sudo   ALL=(ALL:ALL) ALL                    # anyone in group sudo (Debian)
%wheel  ALL=(ALL) ALL                        # RHEL equivalent group
deploy  web01=(root) NOPASSWD: /bin/systemctl restart app
```

The last line is the least-privilege ideal: `deploy` can restart exactly one service on one host without a password, and nothing else. Prefer scoped rules and drop-in files under `/etc/sudoers.d/` over granting blanket `ALL`.

### Q9. `sudo -i` vs `sudo su -` vs `su -` — what's the difference?

All three can land you in a root shell, but the auth and audit story differs:

| Command | Password asked | Environment | Notes |
|---|---|---|---|
| `su -` | **root's** password | login shell (root's env, home) | Requires knowing root's password; shared-secret anti-pattern |
| `su` | root's password | keeps your env/cwd | Non-login; `PATH` etc. stay yours |
| `sudo -i` | **your** password | login shell as root | Audited; the clean way to get root |
| `sudo su -` | your password | login shell as root | Works but redundant — `sudo -i` is cleaner |

Prefer `sudo -i` (or `sudo -s` for a non-login root shell): you authenticate as yourself, it's logged, and nobody needs to know the root password — which means you can revoke access by editing sudoers instead of rotating a shared secret.

### Q10. What is `NOPASSWD` and when is it appropriate?

`NOPASSWD:` in a sudoers rule tells sudo to *not* prompt for a password for the matching command(s). It's essential for automation — CI runners, deploy scripts, and monitoring agents can't type a password.

The safety rule: **never** pair `NOPASSWD` with `ALL`. `deploy ALL=(ALL) NOPASSWD: ALL` is effectively passwordless root — anyone who compromises the `deploy` account or a script running as it owns the box. Scope it to exact commands:

```
ci  ALL=(root) NOPASSWD: /usr/bin/systemctl restart app, /usr/bin/docker pull *
```

Even then, watch for commands that can shell out (`vim`, `less`, `tar --to-command`, `find -exec`) — a NOPASSWD rule for those is a privilege-escalation hole.

### Q11. Login vs non-login vs interactive shells — which dotfiles run?

This is the highest-value "why does my environment differ" answer. For bash:

- **Login shell** (SSH login, `su -`, console login, `bash -l`): reads `/etc/profile`, then the *first* of `~/.bash_profile`, `~/.bash_login`, `~/.profile`.
- **Interactive non-login shell** (a new terminal tab in a GUI, `bash`): reads `/etc/bash.bashrc` (Debian) and `~/.bashrc`.
- **Non-interactive shell** (a script, a cron job, `ssh host cmd`): reads *neither* by default — it consults `$BASH_ENV` if set, otherwise nothing.

The common idiom is to have `~/.bash_profile` source `~/.bashrc` so login shells also get interactive config. This layering is exactly why `PATH` set in `~/.bashrc` is missing in cron (non-interactive) and sometimes over `ssh host cmd`. If an interviewer asks "it works when I SSH in and run it, but not from cron," this is the answer.

### Q12. What is PAM, at a high level?

PAM (Pluggable Authentication Modules) is the framework that decides *how* authentication and account policy happen, decoupling it from individual applications. Instead of `login`, `sshd`, `sudo`, and `su` each implementing password checking, they each call into PAM, and PAM runs a configurable *stack* of modules.

Config lives in `/etc/pam.d/` (one file per service, e.g. `/etc/pam.d/sshd`). Each line has a **type** (`auth`, `account`, `password`, `session`), a **control** (`required`, `requisite`, `sufficient`, `optional`), and a **module** (`pam_unix.so` for `/etc/shadow`, `pam_ldap.so`, `pam_google_authenticator.so` for MFA, `pam_faillock.so` for lockout after failed attempts).

The practical upshot: you add MFA, password-complexity rules, or account lockout by dropping a module into the stack — no application changes. When "the password is right but login is refused," suspect a PAM `account`/`session` module (expiry, faillock, access.conf), not the password itself.

### Q13. What is `nsswitch.conf` and how does it relate to PAM?

`/etc/nsswitch.conf` controls *where* the system looks up names — users, groups, hostnames, netgroups — via NSS (Name Service Switch). PAM answers "is this credential valid?"; NSS answers "does this user/group exist and what are its attributes?". They're complementary, often confused.

```
passwd:     files sss ldap
group:      files sss ldap
hosts:      files dns
```

Each line lists databases tried in order. `passwd: files sss` means "check `/etc/passwd` first, then SSSD (which fronts LDAP/AD)." This is how a box joined to a central directory resolves users that aren't in the local files. If `getent passwd alice` returns a user that isn't in `/etc/passwd`, NSS is pulling it from a remote source — `getent` is the right tool to test the *whole* NSS chain, not `grep /etc/passwd`.

### Q14. What are service/system accounts and why give them a `nologin` shell?

Daemons run as dedicated unprivileged accounts (`www-data`, `nginx`, `postgres`, `_apt`) so that a compromise of the service doesn't hand over root or a real user. These are **system accounts**: typically UID < 1000, no password, home dir under `/var/lib/...`, and a login shell of `/usr/sbin/nologin` or `/bin/false`.

The `nologin` shell means even if someone obtains that account's credentials or triggers a login, there's no interactive shell to drop into — `/usr/sbin/nologin` prints a message and exits non-zero; `/bin/false` just exits. It doesn't stop the daemon (which is exec'd by systemd, not via a login), and it doesn't stop `sudo -u www-data cmd`, but it closes off `ssh www-data@host` and `su - www-data`.

Auditing tip: an unexpected service account with `/bin/bash` as its shell is a finding — either misconfiguration or a backdoor.

### Q15. How do you see who's logged in and login history?

```bash
who        # current logins: user, tty, login time, source
w          # who + what they're running + load average
last       # login/logout history from /var/log/wtmp (most recent first)
last -f /var/log/btmp   # (as root) FAILED login attempts
lastlog    # last login time per account
```

`who` and `w` read `/var/run/utmp` (current sessions); `last` reads `/var/log/wtmp` (historical). `w` is the fast triage command — one line per user plus the system load, so you see both "who's on" and "is the box busy." For a security question, `last -f /var/log/btmp` (failed attempts) and `lastb` reveal brute-force patterns; a flood of failed root logins is the classic SSH-exposed-to-internet signature.

### Q16. A regular user needs to restart one service. How do you grant that safely?

Least privilege via a scoped sudoers rule — not the root password, not group `sudo`, not `NOPASSWD: ALL`.

```bash
visudo -f /etc/sudoers.d/deploy-restart
```

```
deploy  ALL=(root) NOPASSWD: /usr/bin/systemctl restart app.service
```

This lets `deploy` run exactly that one command as root, passwordless (so it works from CI), and nothing else. Points to make in an interview:

1. **Use a drop-in file** under `/etc/sudoers.d/` (validated with `visudo -c`) so the change is self-contained and easy to revoke.
2. **Pin the exact command including arguments** — `systemctl` without a pinned verb+unit would let them `systemctl` anything, including masking security services or `edit` (which spawns an editor → shell escape).
3. **Prefer a systemd approach** if it fits: a polkit rule or a `PartOf`/socket-activation design can avoid sudo entirely.
4. Log/monitor: sudo already logs to the journal / `/var/log/auth.log`; that's your audit trail.

## Processes & Signals

### Summary

**What this topic covers**

How Linux turns a program into a running process, tracks it, and controls it — and how you observe and steer that from the command line. The 17 questions here cover the anatomy of a process (PID, PPID, address space, file descriptors), the fork/exec/wait creation model, the tools to inspect processes (`ps`, `top`, `htop`, `pgrep`, `/proc`), the process state machine (R/S/D/Z/T, with the notorious uninterruptible-sleep `D` and zombie `Z`), the role of PID 1 (init/systemd), job control (foreground/background, controlling terminal), and the signal system (`SIGTERM` vs `SIGKILL` vs `SIGHUP`/`SIGINT`/`SIGSTOP`) with the tools that send them (`kill`, `pkill`, `killall`). It finishes on the operational essentials: `nice`/`renice`, threads vs processes, daemons, exit codes and `$?`, trapping signals, and how a graceful shutdown actually works.

**Mental model**

A process is an *instance of a program plus its context*: an address space (code, heap, stack, mmap'd regions), a table of open file descriptors, a set of credentials (UID/GID), and kernel bookkeeping (PID, PPID, state, priority). New processes are born by **cloning**: `fork()` duplicates the parent (copy-on-write), then the child `exec()`s to replace its image with a new program, and the parent later `wait()`s to collect the child's exit status. That single fork→exec→wait triangle explains almost everything: why the shell is the parent of the commands you run, what a zombie is (a child that exited but hasn't been `wait()`ed), what an orphan is (a child whose parent died, reparented to PID 1), and why PID 1 must reap. Signals are the async control channel layered on top: the kernel (or another process) can interrupt a process to say "terminate," "stop," "hang up," and the process either uses the default action or a handler it registered. Everything you do with `kill`, `Ctrl-C`, and graceful shutdown is sending signals.

**Key terms**

- **PID / PPID** — process ID and parent PID. PID 1 is init/systemd.
- **fork / exec / wait** — clone a process / replace its image with a new program / collect a child's exit status.
- **Address space** — a process's private virtual memory (code, data, heap, stack, shared libs).
- **File descriptor** — a small int indexing an open file/socket/pipe; 0/1/2 are stdin/stdout/stderr.
- **Process states** — R (running/runnable), S (interruptible sleep), D (uninterruptible sleep), Z (zombie), T (stopped/traced).
- **Zombie** — exited child not yet reaped; holds only a PID + exit status.
- **Orphan** — process whose parent died; reparented to PID 1, which reaps it.
- **Signal** — async notification: SIGTERM(15), SIGKILL(9), SIGINT(2), SIGHUP(1), SIGSTOP/SIGCONT.
- **nice / renice** — set/adjust scheduling priority (niceness -20 highest … +19 lowest).
- **Daemon** — long-running background service, detached from a controlling terminal.
- **/proc/<pid>** — kernel's per-process view: `status`, `fd/`, `cmdline`, `environ`, `maps`.

**Why interviewers ask this**

Process and signal fluency is the dividing line between someone who *uses* a shell and someone who can *operate* a production box. Anyone can `kill -9`; a senior knows why `kill -9` is a last resort (no cleanup, corrupt state, orphaned locks) and reaches for `SIGTERM` first. The zombie/orphan/`D`-state questions test whether you understand the parent-child lifecycle rather than memorizing `ps` flags — you can't `kill -9` a zombie (it's already dead) and you can't kill a `D`-state process at all (it's in the kernel). Interviewers love the "process won't die" and "load average is high but CPU idle" scenarios precisely because they separate the "reboot it" crowd from people who reason about state. For SRE roles, graceful-shutdown and signal-trapping questions map directly to writing services that don't lose data on deploy.

**Common confusions**

- "`kill` kills processes" — `kill` *sends a signal*; the default is `SIGTERM` (polite), and many signals don't kill at all (`SIGSTOP`, `SIGCONT`, `SIGHUP`).
- "`kill -9` is the reliable way to stop something" — it's the *last* resort; it skips cleanup and can't be caught, causing corruption and stale locks.
- "You can kill a zombie" — no; a zombie is already dead. You fix it by making its *parent* reap it (or the parent dies and PID 1 reaps).
- "A `D`-state process is hung — kill it" — you *can't* kill `D` (uninterruptible sleep, usually blocked on I/O). It clears when the I/O completes or you fix the storage.
- "Threads and processes are basically the same" — threads share an address space and FDs; processes don't. On Linux both are `task_struct`s created by `clone()` with different flags.
- "High load average means high CPU" — load counts R *and* D tasks; a box wedged on I/O can show load 40 with idle CPUs.

**What follows from this topic**

Signals and process states are the vocabulary the rest of the system speaks. **Job Scheduling** relies on it — cron and systemd timers spawn processes, and a job that "hangs" is a process-state question; graceful shutdown of a scheduled job means trapping `SIGTERM`. The daemon and PID-1 discussion connects to systemd service management (units send `SIGTERM` then `SIGKILL` on `TimeoutStopSec`). And the `/proc` and file-descriptor material feeds directly into performance debugging (FD leaks, `lsof`) and the memory/OOM-killer topic, where the kernel sends `SIGKILL` to the process it picks.

### Q1. What is a process, and what distinguishes it from a program?

A **program** is a passive file on disk — an ELF executable, a script. A **process** is a *running instance* of that program: the program's code loaded into memory plus all the runtime context the kernel tracks for it.

That context is what makes it a process:

- A **PID** (and PPID linking it to its parent).
- A private **virtual address space**: text (code), data, heap, stack, memory-mapped files and shared libraries.
- A **file descriptor table** (open files, sockets, pipes).
- **Credentials** — real/effective UID and GID.
- **State** (R/S/D/Z/T), scheduling priority, CPU registers, and accounting.

One program can back many processes (ten `nginx` workers, a hundred `python` jobs). The kernel represents each as a `task_struct`. So "process" = program image + execution context + kernel bookkeeping.

### Q2. Explain the fork/exec/wait model.

This is how every process on Linux (except PID 1) is created:

1. **`fork()`** — the kernel clones the calling process. Parent and child are near-identical; they differ only in the return value (child gets 0, parent gets the child's PID). Memory is **copy-on-write** — pages are shared read-only until one side writes, so fork is cheap.
2. **`exec()`** (execve and friends) — the child replaces its own memory image with a new program. Same PID, brand-new code/data. If you *don't* exec, you just have two copies of the parent.
3. **`wait()`** (waitpid) — the parent blocks until the child exits and collects its exit status, freeing the child's last kernel resources.

The shell is the canonical example: type `ls`, the shell `fork()`s, the child `exec()`s `ls`, the shell `wait()`s and then prints the next prompt. Skipping `wait()` is exactly how zombies happen — the child's exit status sits unreaped.

### Q3. How do you view running processes? Compare `ps aux` and `ps -ef`.

Both list all processes; they're two historical syntaxes (BSD vs System V) showing mostly the same thing:

```bash
ps aux     # BSD style: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
ps -ef     # SysV style: UID PID PPID C STIME TTY TIME CMD
```

Practical differences: `ps aux` gives you **%CPU/%MEM and RSS** (great for "what's eating memory"); `ps -ef` shows **PPID** clearly (great for tracing parent-child trees). Neither updates — they're snapshots.

For live monitoring use **`top`** (built-in, sortable with `P` for CPU / `M` for memory) or **`htop`** (colored, scrollable, tree view, kill from the UI). For finding a PID by name use **`pgrep nginx`** (or `pgrep -a nginx` to see the command line), and `ps -ef --forest` / `pstree` to see the hierarchy.

### Q4. Explain the process states R, S, D, Z, T.

The `STAT` column in `ps` and the state in `/proc/<pid>/status`:

| Code | State | Meaning |
|---|---|---|
| **R** | Running / runnable | On a CPU or in the run queue waiting for one |
| **S** | Interruptible sleep | Waiting for an event (I/O, timer); wakes on signal — the normal idle state |
| **D** | Uninterruptible sleep | Blocked in the kernel (usually disk/NFS I/O); **cannot be interrupted or killed** |
| **Z** | Zombie | Exited, waiting for parent to reap; holds only PID + exit status |
| **T** | Stopped / traced | Suspended by SIGSTOP/SIGTSTP or under a debugger |

The two that generate interview questions are **D** and **Z**. `D` matters because a process stuck there ignores *every* signal including `SIGKILL` — it's the kernel that must complete or abandon the I/O — and lots of `D` processes drive load average up while CPU sits idle. `Z` matters because it's already dead: you can't kill it; you reap it via the parent.

### Q5. Why can't you kill a process in the `D` state?

Because it's asleep *inside the kernel*, in a code path that deliberately can't be interrupted. `D` = uninterruptible sleep. The process made a syscall (usually I/O — a slow disk, a hung NFS mount, a stuck device) and the kernel put it to sleep in a state where signal delivery is disabled, so the in-flight operation isn't left half-done with inconsistent kernel data structures.

Consequences:

- **`SIGKILL` doesn't work.** The signal is *queued* but can't be *delivered* until the process returns to userspace, which it won't until the I/O completes or errors out.
- It **counts toward load average** — this is why you can see load 40 with idle CPUs (a NFS server went away and 40 processes are all wedged in `D`).

The fix isn't `kill -9`; it's clearing the underlying I/O — reconnect the NFS mount, recover the disk, or as a last resort reboot. If processes are frequently in `D`, investigate storage, not the processes.

### Q6. What is a zombie process and how is it reaped?

A **zombie** (state `Z`, `<defunct>` in `ps`) is a child that has *exited* but whose parent hasn't called `wait()` to collect its exit status yet. It's not running and uses no memory or CPU — the only thing it holds is an entry in the process table (a PID + the exit code) so the parent can still read that status.

Reaping: the parent calls `wait()`/`waitpid()`, the kernel hands over the exit status, and the zombie disappears. Well-behaved parents install a `SIGCHLD` handler (children send `SIGCHLD` on exit) and reap there.

A few zombies are harmless and transient. A *flood* of zombies is a bug in the parent — it's spawning children and never reaping. You **can't kill a zombie** (it's already dead; `kill -9` does nothing). To clear them you either fix/restart the buggy parent, or if the parent dies, its zombies are reparented to PID 1, which reaps them immediately.

### Q7. What is an orphan process, and what happens to it?

An **orphan** is a process whose parent exited before it did. Orphans aren't a problem — the kernel immediately **reparents** them to PID 1 (init/systemd), so `PPID` becomes 1. PID 1's job includes `wait()`ing on its adopted children, so when an orphan eventually exits, PID 1 reaps it and no zombie lingers.

Contrast with a zombie: an orphan is *alive* with a new parent; a zombie is *dead* awaiting reaping. Deliberately orphaning is actually a classic daemonization trick — a process forks, the parent exits, and the child (now an orphan adopted by init) keeps running detached from the original shell. `nohup` and `disown` lean on the same idea so a job survives terminal logout.

### Q8. What is special about PID 1?

PID 1 is the **first userspace process** the kernel starts at boot, and the ancestor of everything else — on modern distros it's **systemd** (historically SysV `init`). It has two non-negotiable duties:

1. **Reaping orphans.** Every orphaned process gets reparented to PID 1, so PID 1 must `wait()` on them or the system fills with zombies.
2. **It can't die.** If PID 1 exits, the kernel panics ("Attempted to kill init"). It also can't be killed by signals it hasn't explicitly handled — the kernel protects it.

This matters in **containers**: whatever you set as the entrypoint becomes PID 1 *inside* the container. If that's a shell script or an app that doesn't reap children or forward signals, you get zombie accumulation and `docker stop` failing to shut down gracefully (the app never sees `SIGTERM`). That's why images use `tini`/`--init` or an app that handles PID-1 responsibilities.

### Q9. Explain foreground vs background jobs and the controlling terminal.

When you run a command in a terminal it starts in the **foreground**: it owns the terminal, receives keyboard input, and `Ctrl-C` (`SIGINT`) / `Ctrl-Z` (`SIGTSTP`) go to it. The terminal is its **controlling terminal**.

Job control (a shell feature):

```bash
sleep 100 &      # start in background — shell returns immediately
jobs             # list this shell's jobs
Ctrl-Z           # suspend the foreground job (sends SIGTSTP → state T)
bg               # resume it in the background
fg %1            # bring job 1 to the foreground
```

Only the foreground job gets terminal signals; background jobs keep running but block if they try to read stdin. When you close the terminal, the shell sends **`SIGHUP`** to its jobs — which is why a long task dies on logout unless you `nohup` it, `disown` it, or run it under `tmux`/`screen`/`systemd-run` so it has no dependency on that controlling terminal.

### Q10. Compare the important signals: SIGTERM, SIGKILL, SIGHUP, SIGINT, SIGSTOP, SIGCONT.

| Signal | # | Default action | Catchable? | Typical trigger |
|---|---|---|---|---|
| **SIGHUP** | 1 | Terminate | Yes | Terminal closed; also "reload config" by convention |
| **SIGINT** | 2 | Terminate | Yes | `Ctrl-C` |
| **SIGKILL** | 9 | Terminate | **No** | `kill -9` — forced, uncatchable |
| **SIGTERM** | 15 | Terminate | Yes | Default `kill`; polite "please shut down" |
| **SIGSTOP** | 19 | Stop | **No** | Suspend; uncatchable |
| **SIGCONT** | 18 | Continue | Yes | Resume a stopped process |
| **SIGTSTP** | 20 | Stop | Yes | `Ctrl-Z` (the catchable stop) |

The two uncatchable ones — **SIGKILL** and **SIGSTOP** — are the kernel's guaranteed hammers: a process can't install a handler, ignore, or block them. Everything else can be **caught** (handled), **ignored**, or **blocked**. `SIGTERM` is the default of `kill` precisely because it's catchable — it gives the process a chance to flush buffers and exit cleanly. `SIGHUP`'s "reload config" meaning (nginx, sshd) is pure convention layered on top of a daemon that has no controlling terminal to lose.

### Q11. `kill`, `killall`, `pkill` — what's the difference?

All three send signals; they differ in how you *select* the target:

```bash
kill 1234              # by PID; default signal SIGTERM
kill -9 1234           # send SIGKILL to PID 1234
kill -HUP 1234         # send SIGHUP (reload) by name

pkill nginx            # by name pattern (match against process name)
pkill -f 'python app'  # match against the full command line
pkill -u alice sshd    # constrain by user

killall nginx          # by exact process name — signals ALL matching
killall -9 firefox
```

`kill` takes PIDs (or `%job`). `pkill`/`pgrep` match by pattern and support filters (`-u` user, `-f` full cmdline, `-t` tty) — `pgrep` first to *see* what you'd hit, then `pkill`. `killall` matches by exact command name and hits every instance. Danger: on some Unixes (Solaris) `killall` kills *everything* — on Linux it's name-based, but the habit of `pgrep`-before-`pkill` avoids nuking more than you meant.

### Q12. Why is `kill -9` considered a last resort?

Because `SIGKILL` gives the process **no chance to clean up**. It can't be caught or handled, so the kernel just tears the process down immediately. That means:

- **No graceful shutdown** — in-flight requests dropped, buffers not flushed, data possibly lost or half-written.
- **Stale resources** — lock files, PID files, `/tmp` sockets, and shared-memory segments aren't removed, so the service may refuse to restart ("address already in use," "stale lock").
- **Corrupt state** — a database or file being written can be left inconsistent.

The correct escalation is **`SIGTERM` first** (let it shut down cleanly), wait a few seconds, and only `SIGKILL` if it's still hung. systemd does exactly this: `SIGTERM` on stop, then `SIGKILL` after `TimeoutStopSec`. Reserve `-9` for a genuinely wedged process — and remember it *still* won't kill a `D`-state process, which is the case people most often reach for it.

### Q13. What are `nice` and `renice`, and how does priority work?

**Niceness** is a hint to the scheduler about a process's CPU priority, from **-20 (highest priority, least "nice")** to **+19 (lowest priority, most "nice")**; default 0. Higher niceness = yields CPU to others.

```bash
nice -n 10 ./batch-job.sh     # start a job at niceness +10 (deprioritized)
renice -n 5 -p 1234           # change PID 1234 to niceness +5
renice -n -5 -u alice         # (root) bump all of alice's processes
```

Only root can set *negative* niceness (raise priority); regular users can only lower their own processes' priority. Niceness affects CPU scheduling **only** — it does nothing for I/O or memory. For I/O priority you use `ionice`. Practical use: run backups, compiles, or batch jobs at high niceness so they don't starve interactive/latency-sensitive work. It's a relative hint, not a hard cap — a `nice +19` job still runs full-speed on an otherwise idle box.

### Q14. What can you learn from `/proc/<pid>`?

`/proc/<pid>/` is the kernel's live, virtual view of a single process — no files on disk, generated on read. It's where the `ps`/`top` numbers actually come from, and it's invaluable when a tool won't tell you what you need:

- **`status`** — state (R/S/D/Z), UIDs/GIDs, memory (VmRSS), threads count, signals blocked/pending.
- **`cmdline`** — the exact argv (NUL-separated) the process was started with.
- **`environ`** — its environment variables (great for "what `PATH`/config did this daemon actually inherit?").
- **`fd/`** — a symlink per open file descriptor; reveals open files, sockets, pipes, and **FD leaks**.
- **`maps` / `smaps`** — memory-mapped regions (libraries, heap, stack) and per-region memory use.
- **`cwd`** and **`exe`** — symlinks to the working dir and the executable (even if deleted — how you recover a deleted-but-running binary).

Example: `ls -l /proc/1234/fd | wc -l` to count open FDs when you suspect a leak, or `cat /proc/1234/environ | tr '\0' '\n'` to see a service's environment.

### Q15. Threads vs processes on Linux — what actually differs?

On Linux both are the same kernel object — a `task_struct` created by **`clone()`**; the difference is *what they share*, controlled by clone flags:

- A **process** (`fork`) gets its **own** address space, file-descriptor table, and signal handlers (copy-on-write of the parent).
- A **thread** (`pthread_create` → `clone` with `CLONE_VM | CLONE_FILES | CLONE_SIGHAND | ...`) **shares** the address space, open files, and signal handlers with its siblings; it has its own stack, registers, and thread ID (`tid`).

Implications: threads communicate through shared memory (fast, but need locking); processes are isolated (safer, communicate via IPC — pipes, sockets, shared-memory segments). A crash/segfault in one thread takes down the whole process; a crashing process doesn't touch its siblings. In `top`, press `H` to show individual threads; each thread has a `tid` but they share the process's `pid`. This shared-vs-isolated trade-off is the whole "why multiprocess (nginx, PostgreSQL) vs multithread (JVM)" architecture conversation.

### Q16. What is a daemon and what is the "double fork"?

A **daemon** is a long-running background service with **no controlling terminal** — so it survives logout and isn't tied to a shell (sshd, cron, nginx). The classic Unix daemonization recipe (the "double fork"):

1. `fork()` and let the parent exit — the child is now orphaned, adopted by init, and no longer a process-group leader.
2. `setsid()` — create a new session, detaching from the controlling terminal and becoming session leader.
3. `fork()` **again** — the grandchild is no longer a session leader, so it can *never* reacquire a controlling terminal (which only a session leader can).
4. `chdir("/")`, reset `umask`, and redirect stdin/stdout/stderr to `/dev/null` (or a log).

The second fork is the subtle bit people miss — without it the process is a session leader and could accidentally grab a TTY. **In practice you don't write this anymore**: systemd (`Type=simple`/`Type=notify`) launches your service in the foreground and handles detachment, logging (journald), and restart. Hand-rolled double-forking is legacy; understanding it explains *why* systemd services should stay in the foreground.

### Q17. What are exit codes, `$?`, and how does trapping signals enable graceful shutdown?

**Exit code**: every process returns an integer status on exit — **0 = success**, non-zero = failure. The shell exposes the last one as **`$?`**:

```bash
grep pattern file
echo $?        # 0 = found, 1 = not found, 2 = error
```

Conventions: 1–125 are app-defined errors, 126 = not executable, 127 = command not found, and **128 + N means killed by signal N** (137 = 128+9 = SIGKILL, 143 = 128+15 = SIGTERM). Seeing a container exit 137 tells you the OOM killer or `kill -9` got it.

**Trapping signals** is how a process shuts down gracefully. It installs a handler for `SIGTERM` and does cleanup before exiting:

```bash
cleanup() { echo "draining..."; rm -f /run/app.lock; exit 0; }
trap cleanup SIGTERM SIGINT
```

A graceful shutdown flow: orchestrator sends **SIGTERM** → the app's handler stops accepting new work, finishes in-flight requests, flushes buffers, releases locks, then exits 0 → if it doesn't finish within the timeout, the orchestrator sends **SIGKILL**. This is exactly the contract behind `systemctl stop` (`TimeoutStopSec`) and Kubernetes pod termination (`terminationGracePeriodSeconds`) — write services that trap `SIGTERM` and you get clean deploys instead of dropped requests.

## Job Scheduling

### Summary

**What this topic covers**

Running work on a schedule, and debugging it when it silently doesn't run. This topic covers the two families of Linux schedulers: the classic **cron** ecosystem (`crontab -e`, the five-field format, user crontabs vs `/etc/crontab` vs `/etc/cron.d` vs the `cron.daily`/`hourly` drop-in dirs, `@reboot`/`@daily` shortcuts, `anacron` for machines that aren't always on) and the modern **systemd timers** (`OnCalendar`, `OnBootSec`, `OnUnitActiveSec`, `Persistent=true`, `systemctl list-timers`). The 15 questions run from "read me this crontab line" to the single most common real-world failure — a job that works in your interactive shell but not under cron because of the stripped-down environment — plus `at`/`batch` for one-off jobs, preventing overlapping runs with `flock`, timezone gotchas, and where scheduled-job output actually goes.

**Mental model**

Two schedulers, one question: *what fires the job, and in what environment?* **cron** is a dead-simple time-matching daemon — every minute it checks each crontab and runs any line whose five time fields match "now," in a **deliberately minimal environment** (a bare `PATH`, `SHELL=/bin/sh`, `HOME` set, none of your login profile). That minimal environment is the source of ~80% of cron bugs: the script works when you run it, fails under cron, because `cron` didn't source `~/.bashrc` and can't find your tool. **systemd timers** are the modern alternative: a `.timer` unit activates a `.service` unit. They cost two files instead of one line, but you get journald logging, dependency ordering, resource limits, `Persistent=true` (run missed jobs after downtime), and monotonic timers (`OnBootSec`/`OnUnitActiveSec`) that cron can't express. The mental split: cron for quick, portable, user-level jobs; systemd timers for anything production where you need observability and missed-run handling.

**Key terms**

- **crontab** — a user's table of scheduled jobs; edit with `crontab -e`, list with `crontab -l`.
- **Five fields** — `minute hour day-of-month month day-of-week` then the command.
- **/etc/crontab & /etc/cron.d** — system crontabs; these have an **extra user field** before the command.
- **cron.daily / .hourly / .weekly** — drop a script in; run by `run-parts` on a schedule.
- **@reboot / @daily / @hourly** — nickname shortcuts for common schedules.
- **anacron** — runs periodic jobs that were *missed* while the machine was off; not time-of-day precise.
- **at / batch** — one-shot scheduling: `at` at a specific time, `batch` when load drops.
- **systemd timer** — a `.timer` unit that triggers a `.service` unit.
- **OnCalendar** — wall-clock schedule (like cron); **OnBootSec / OnUnitActiveSec** — monotonic (relative) schedules.
- **Persistent=true** — run a missed timer job after the system comes back up.
- **flock** — a lock wrapper to stop overlapping runs of the same job.
- **MAILTO** — cron variable controlling where job output is emailed.

**Why interviewers ask this**

Scheduling is where "works on my machine" goes to die, so it's a great practical-competence probe. The classic question — "your backup script runs fine by hand but the cron job produces nothing, debug it" — instantly reveals whether you understand cron's environment isolation and output handling, or whether you'd flail. Seniors immediately check: absolute paths? where's the output going (nowhere, by default, unless redirected)? is `PATH` the problem? did the job actually fire (`grep CRON /var/log/syslog`, `journalctl -u`)? Interviewers also use timers-vs-cron to gauge whether you've kept up with systemd — knowing *why* timers are increasingly preferred (logging, `Persistent=`, no silent failures) signals modern ops experience. And overlap/locking (`flock`) and timezone questions separate people who've been paged by a job that ran twice or an hour early from people who haven't.

**Common confusions**

- "cron uses my normal shell environment" — no. Minimal `PATH` (often just `/usr/bin:/bin`), `sh` not `bash`, no profile sourced. Use absolute paths.
- "`/etc/crontab` and a user crontab have the same format" — system crontabs (`/etc/crontab`, `/etc/cron.d`) have an **extra user field**; user crontabs don't.
- "If a cron job errors I'll see it" — only if you capture output or check `MAILTO`/logs; by default output is emailed locally and usually lost.
- "cron catches up on missed jobs" — plain cron does **not**; if the machine was off at 3am, the 3am job just didn't run. Use `anacron` or a timer with `Persistent=true`.
- "`OnCalendar` and `OnBootSec` are the same kind of timer" — one is wall-clock (realtime), the other is monotonic (relative to an event). Different use cases.
- "Two overlapping runs are fine" — a long job can still be running when the next fires; without `flock` you get concurrent runs corrupting each other.

**What follows from this topic**

Scheduling ties the whole primer together operationally. A job "that didn't run" is often a **Processes & Signals** problem (it's stuck in `D`, or a previous run never exited and `flock` blocked the new one) or a **Users, Groups & Authentication** problem (the cron environment is a non-login, non-interactive shell — the exact dotfile-sourcing rule from that topic). Debugging where the output went leans on journald and log files. And the systemd-timer material connects directly to systemd service management — a timer is just a unit that starts another unit, so everything you know about `systemctl status`, `journalctl -u`, and `TimeoutStopSec` applies.

### Q1. Explain the five fields of a crontab line.

```
# ┌───────── minute (0–59)
# │ ┌─────── hour (0–23)
# │ │ ┌───── day of month (1–31)
# │ │ │ ┌─── month (1–12 or jan–dec)
# │ │ │ │ ┌─ day of week (0–7, 0 and 7 = Sunday, or sun–sat)
# │ │ │ │ │
  30 2 * * *  /srv/app/backup.sh
```

That runs `backup.sh` at **02:30 every day**. Operators in any field: `*` (every), `*/5` (every 5th — step), `1,15` (list), `9-17` (range).

The subtle trap is **day-of-month + day-of-week together**. `0 0 13 * 5` does **not** mean "Friday the 13th" — cron treats the two day fields as **OR**, so it runs on the 13th of *every* month **and** every Friday. When both day fields are restricted (not `*`), the job runs if *either* matches. Interviewers love this one.

### Q2. `crontab -e` vs `/etc/crontab` vs `/etc/cron.d` vs `/etc/cron.daily` — when do you use each?

| Mechanism | Owner | Format | Use for |
|---|---|---|---|
| `crontab -e` (user crontab) | per user, in `/var/spool/cron/...` | 5 fields + command | A user's own jobs; runs as that user |
| `/etc/crontab` | root-edited system file | 5 fields **+ user** + command | System-wide jobs, historically |
| `/etc/cron.d/<file>` | dropped in by packages/config-mgmt | 5 fields **+ user** + command | Packaged/managed jobs — the clean modern place |
| `/etc/cron.{hourly,daily,weekly,monthly}` | drop a **script** in | no time fields — just an executable | "Run this roughly daily," ordering by name |

Key distinctions: **system crontabs (`/etc/crontab`, `/etc/cron.d`) have an extra field naming the user** to run as; user crontabs don't (they run as their owner). The `cron.daily`-style dirs contain *scripts, not crontab lines* — `run-parts` executes everything in them on the schedule set by `/etc/crontab` or a systemd timer (`cron.daily` is increasingly driven by `anacron`/timers). For config management, prefer a file in `/etc/cron.d/` — it's self-contained and easy to deploy/remove.

### Q3. What do `@reboot`, `@daily`, and the other nicknames mean?

cron accepts nickname shortcuts in place of the five fields:

| Nickname | Equivalent | Meaning |
|---|---|---|
| `@reboot` | — | Once, at cron startup (≈ boot) |
| `@yearly` / `@annually` | `0 0 1 1 *` | Once a year |
| `@monthly` | `0 0 1 * *` | First of the month |
| `@weekly` | `0 0 * * 0` | Sunday midnight |
| `@daily` / `@midnight` | `0 0 * * *` | Every day at midnight |
| `@hourly` | `0 * * * *` | Top of every hour |

`@reboot` is the interesting one — it runs the job once when cron starts after boot, a poor-man's "start my thing at boot" for user-level processes. Caveat: it fires when *cron* starts, not when the network/dependencies are up, so for real services a systemd unit with proper `After=` ordering is more reliable.

### Q4. Why does a script work when I run it but fail under cron?

Almost always the **environment**. cron runs jobs in a deliberately minimal environment, *not* your interactive shell:

- **`PATH` is tiny** — typically `/usr/bin:/bin`, so tools in `/usr/local/bin` or a language version manager (`pyenv`, `nvm`) aren't found.
- **`SHELL` is `/bin/sh`**, not bash — bashisms break.
- **No profile is sourced** — `~/.bashrc`, `~/.bash_profile`, virtualenv activation, exported vars: none of it runs (cron shells are non-login, non-interactive).
- **`HOME` is set, but cwd is `$HOME`** and much else is unset.

Fixes: use **absolute paths** for every binary and file; set `PATH=...` explicitly at the top of the crontab; source what you need inside the script (`. /opt/venv/bin/activate`); and don't assume `bash`. To *reproduce* cron's environment for debugging: `env -i /bin/sh -c '/srv/app/job.sh'`. This is the single most-asked cron interview scenario — lead with "it's the environment: PATH and un-sourced profile."

### Q5. Where does cron output go, and what is `MAILTO`?

By default, **anything a cron job writes to stdout or stderr is emailed** to the job's owner via the local mail system. On a box with no MTA configured (most cloud instances), that mail goes nowhere — so **failures vanish silently**. That's why "the cron job did nothing and I saw no error" is so common.

Controls:

```
MAILTO="alerts@acme.example"     # send job output here
MAILTO=""                        # disable mail entirely
30 2 * * *  /srv/app/backup.sh >> /var/log/backup.log 2>&1
```

The robust pattern is to **redirect output explicitly** — `>> logfile 2>&1` captures both streams to a file you control, instead of relying on mail. `2>&1` is essential: without it you capture stdout but stderr (where errors go) still tries to mail. For visibility into whether the job even *fired*, check the cron daemon's own log: `grep CRON /var/log/syslog` (Debian) or `journalctl -u cron` / `-u crond`.

### Q6. What is anacron and how does it differ from cron?

**anacron** runs periodic jobs measured in **days**, and crucially it **catches up on jobs missed while the machine was off** — which plain cron never does. cron assumes the machine is always on: if it's asleep at 03:00, the 03:00 job simply doesn't run. anacron instead records the *last time each job ran* (in `/var/spool/anacron/`) and, on boot/periodically, runs anything overdue.

`/etc/anacrontab` format is different — `period delay job-id command` (e.g. `1 5 daily.backup /srv/backup.sh` = "run daily, 5 min after anacron starts"). It has **no time-of-day precision** — it guarantees "roughly once a day," not "at 3am."

This is why laptops and desktops wire `cron.daily`/`weekly` through anacron: your machine isn't up at 3am, but the daily jobs still run shortly after you power on. On always-on servers, plain cron (or systemd timers) is fine. Modern systems often replace anacron entirely with systemd timers using `Persistent=true`.

### Q7. What are `at` and `batch` for?

Both schedule **one-off** jobs (unlike cron's recurring jobs):

```bash
echo '/srv/app/report.sh' | at 03:00           # run once at 3am
at now + 2 hours                                # interactive; Ctrl-D to finish
at 10:00 AM next friday
atq                                             # list pending at-jobs
atrm 7                                          # remove job 7

echo '/srv/app/heavy.sh' | batch                # run once when load < 1.5
```

`at` fires at a specific time and then the job is gone. `batch` is `at`'s sibling that waits until **system load drops below a threshold** (default 0.8/1.5) before running — good for deferring a heavy one-off until the box is quiet. Both need the `atd` daemon running, and they *do* capture the job's environment at submission time (more forgiving than cron). Use them for "do this thing once, later," where a crontab entry would be overkill and you'd have to remember to remove it.

### Q8. What are systemd timers and how do they compare to cron?

A systemd **timer** is a unit (`foo.timer`) that activates a corresponding service (`foo.service`) on a schedule. It's the modern alternative to cron. You write two files:

```ini
# /etc/systemd/system/backup.timer
[Unit]
Description=Nightly backup
[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true
[Install]
WantedBy=timers.target
```

```ini
# /etc/systemd/system/backup.service
[Unit]
Description=Nightly backup
[Service]
Type=oneshot
ExecStart=/srv/app/backup.sh
```

Then `systemctl enable --now backup.timer`.

| | cron | systemd timer |
|---|---|---|
| Setup | one line | two unit files |
| Logging | none (mail/redirect) | **journald** (`journalctl -u backup`) |
| Missed runs | lost | `Persistent=true` catches up |
| Dependencies | none | full `After=`/`Requires=` ordering |
| Resource limits | none | `CPUQuota=`, `MemoryMax=`, etc. |
| Randomized delay | no | `RandomizedDelaySec=` |
| Portability | universal | systemd only |

Timers win on **observability and control**; cron wins on simplicity and portability. Increasingly preferred in production because the *service* logs to the journal (no silent failures), you get `Persistent=` catch-up for free, and the job inherits systemd's sandboxing/limits.

### Q9. Explain `OnCalendar`, `OnBootSec`, and `OnUnitActiveSec`.

These are the three timer types, split into **realtime** (wall clock) and **monotonic** (relative to an event):

- **`OnCalendar=`** — realtime, cron-like wall-clock schedule. `OnCalendar=*-*-* 02:30:00` = daily 02:30; `OnCalendar=Mon *-*-* 09:00:00` = Mondays 9am; `OnCalendar=hourly`/`daily` shortcuts exist. Verify with `systemd-analyze calendar 'Mon *-*-* 09:00'`.
- **`OnBootSec=`** — monotonic; fire *this long after boot*. `OnBootSec=5min` = 5 minutes after boot.
- **`OnUnitActiveSec=`** — monotonic; fire *this long after the service last ran*. `OnUnitActiveSec=1h` = every hour *since the last activation*.

The classic recurring pattern combines two monotonic settings: `OnBootSec=5min` + `OnUnitActiveSec=1h` = "start 5 min after boot, then every hour after each run." Monotonic timers are relative to system events, so they self-adjust to uptime and drift — something cron literally can't express (cron only does wall-clock). Use `OnCalendar` when you need "at 3am"; use the monotonic pair when you need "every N after boot/last run."

### Q10. How do you list and inspect timers?

```bash
systemctl list-timers --all      # NEXT run, LAST run, and the unit for every timer
systemctl status backup.timer    # is it active/enabled? when does it next fire?
systemctl cat backup.timer       # show the unit definition
journalctl -u backup.service     # the actual job output/logs
systemd-analyze calendar 'daily' # explain/verify an OnCalendar expression
```

`systemctl list-timers` is the go-to overview — a table with `NEXT` (when it fires next), `LAST` (when it last ran), `LEFT`/`PASSED`, and the activated unit. It answers "is my job scheduled and when will it run" at a glance, which cron can't do (cron has no equivalent "when's the next run" command). Pair it with `journalctl -u <service>` to see whether past runs succeeded — the combination of "when will it run" + "what happened last time it ran" is exactly the observability cron lacks.

### Q11. Monotonic vs realtime timers — what's the difference and when do you use each?

- **Realtime timers** (`OnCalendar=`) fire at **wall-clock** times: "02:30 daily," "the 1st at midnight." They track the calendar and are affected by timezone and clock changes.
- **Monotonic timers** (`OnBootSec=`, `OnUnitActiveSec=`, `OnStartupSec=`) fire relative to a **system event** (boot, service startup, last activation) using a clock that only moves forward and ignores wall-clock jumps.

Use **realtime** when the job must happen at a specific time of day — nightly backups, business-hours reports. Use **monotonic** when you care about *intervals* rather than clock times — "health-check every 5 minutes regardless of when we booted," "warm the cache 2 minutes after startup." Monotonic timers are robust to a machine that boots at random times or has its clock adjusted; realtime timers are what you want for "at 3am sharp." cron only offers the realtime style, which is one reason "every N minutes since boot" is cleaner as a systemd timer.

### Q12. A scheduled job "didn't run." How do you debug it?

Work outside-in — *did it fire, did it run, did it succeed?*

**For cron:**
1. **Did cron try?** Check the daemon log: `grep CRON /var/log/syslog` (Debian) or `journalctl -u cron`/`-u crond`. If there's no line, the schedule is wrong or the crontab isn't installed (`crontab -l`).
2. **Did it fail on environment?** The usual culprit — `PATH`/un-sourced profile (see Q4). Reproduce with `env -i /bin/sh -c '/path/job.sh'`.
3. **Where did output go?** By default it's mailed and lost. Add `>> /var/log/job.log 2>&1` and re-check.
4. **Format traps** — wrong file (user vs `/etc/cron.d` needs the user field), unescaped `%` (which cron turns into newlines), or the day-of-week OR-trap.

**For systemd timers:**
1. `systemctl list-timers` — is it even scheduled? `NEXT` shows the next fire.
2. `systemctl status foo.timer` — enabled and active?
3. `journalctl -u foo.service` — the run's output and exit status (`Type=oneshot` jobs show their result here).

Lead with "check whether it fired at all before assuming the script is broken."

### Q13. How do you prevent overlapping runs of the same job?

If a job can take longer than its interval, the next scheduled run can start while the previous is still going — two copies racing (double-writing a backup, corrupting a report). The standard tool is **`flock`**, which takes an exclusive lock on a file and only runs the command if it gets it:

```bash
# in crontab — if a previous run still holds the lock, skip this run
*/5 * * * *  /usr/bin/flock -n /var/lock/sync.lock /srv/app/sync.sh
```

`-n` means non-blocking: fail immediately (skip this run) if the lock is held, rather than queueing up a pile of waiting processes. Drop `-n` to wait instead. The lock auto-releases when the process exits (even on crash), so no stale-lock cleanup — better than a hand-rolled PID/lockfile.

For **systemd**, you often get this for free: a `oneshot` service won't start a second instance while the first is still active, so a timer firing during a long run is simply skipped (or use `RefuseManualStart`/instance limits). This is one more reason timers reduce foot-guns.

### Q14. What timezone gotchas affect scheduled jobs?

cron runs in the **system timezone** by default — but there are traps:

- **Which TZ?** cron uses the daemon's timezone (usually `/etc/localtime` / `/etc/timezone`). If someone changes the system TZ, every wall-clock cron job shifts. Set `CRON_TZ=UTC` (or `TZ=`) at the top of a crontab to pin a job's timezone explicitly — running production jobs in **UTC** avoids surprises entirely.
- **DST transitions** — the nasty one. On "spring forward," jobs scheduled in the skipped hour (e.g. 02:30 when 02:00→03:00) **don't run**; on "fall back," jobs in the repeated hour can run **twice**. Vixie cron has some DST heuristics but the safe answer is: schedule critical jobs in **UTC**, which has no DST.
- **systemd timers** support a `OnCalendar` timezone suffix and default to the system TZ; you can also pass `OnCalendar=*-*-* 02:30:00 UTC`.

Interview-ready summary: run scheduled jobs in **UTC** to dodge both TZ-change drift and DST double-runs/skips; only use local time when a human-facing "9am local" requirement forces it.

### Q15. How should scheduled jobs be logged?

Never rely on cron's default (mail that usually goes nowhere). Make logging explicit and observable:

- **cron:** redirect both streams to a file — `command >> /var/log/job.log 2>&1` — and rotate it with `logrotate`. For structured visibility, pipe through `logger` so it lands in syslog/journal with a tag: `command 2>&1 | logger -t job-backup`. Always capture **stderr** (`2>&1`); that's where the errors are.
- **systemd timers:** logging is automatic — the service's stdout/stderr go to **journald**. `journalctl -u backup.service` shows every run with timestamps and exit status; `journalctl -u backup.service --since today`. This zero-config, queryable log is one of the biggest reasons to prefer timers.
- **Always record the essentials:** start time, end time, exit code, and a summary of what happened. A job that logs "started" but never "finished" (with an exit code) is how you spot a hang or a `flock`-skipped run.

The principle: a scheduled job you can't see the result of is a job you'll discover is broken only when something downstream fails. Capture output, capture the exit code, and put it somewhere you'll actually look (journald or a rotated logfile), with alerting on non-zero exits.
## systemd & Service Management

### Summary

**What this topic covers**

How processes become *services* on a modern Linux box — the init system that PID 1 runs, how you declare a long-running daemon, and how you operate it in production. systemd is the default init and service manager on every mainstream distro since roughly 2015 (Debian 8, RHEL 7, Ubuntu 16.04), so this is table stakes for DevOps/SRE work. The 16 questions here move from "what is systemd and why did it replace SysV init" through the anatomy of a unit file, the `systemctl` verbs you type fifty times a day, the enable-vs-start distinction that trips up juniors, journald and `journalctl` for logs, dependency ordering (`Requires`/`Wants`/`After`), restart policies and backoff, drop-in overrides, resource control via cgroups, socket activation, and how you actually debug a service that won't start or a boot that's slow.

**Mental model**

Think of systemd as a **dependency-based supervisor**, not a script runner. Old SysV init ran numbered shell scripts sequentially per runlevel — slow, order-fragile, no supervision. systemd instead models the system as a graph of **units** (things it can manage: services, sockets, mounts, timers, targets) with declared dependencies, and brings the graph up in parallel, only serialising where you tell it to. PID 1 is `systemd` itself; it forks and *tracks* every service in its own **cgroup**, so it always knows exactly which processes belong to a unit (no more lost double-forked daemons). A `.service` says "run this ExecStart, keep it alive per Restart=, put it in this cgroup, log its stdout to the journal." Reaching a "runlevel" becomes "activate this `.target`, which Wants a set of units." Once you internalise "everything is a unit in a dependency graph, tracked by cgroup, logging to journald," the rest is syntax.

**Key terms**

- **unit** — the atom systemd manages; typed by suffix: `.service`, `.socket`, `.target`, `.timer`, `.mount`, `.path`, `.device`.
- **PID 1** — the `systemd` process itself; parent/reaper of everything, started by the kernel at boot.
- **`.service` unit** — declares a daemon: `[Unit]` (metadata/deps), `[Service]` (how to run it), `[Install]` (how to enable it).
- **`systemctl`** — the control tool: `start`/`stop`/`restart`/`reload`/`status`/`enable`/`disable`/`mask`.
- **enable vs start** — `enable` wires up autostart at boot (creates `[Install]` symlinks); `start` runs it *now*. Independent.
- **target** — a synchronisation/grouping unit; the systemd replacement for runlevels (`multi-user.target`, `graphical.target`).
- **journald** — the binary logging daemon; `journalctl` queries it (`-u`, `-f`, `--since`, `-p`).
- **`daemon-reload`** — re-reads unit files from disk after you edit them; required before your changes take effect.
- **`Requires` / `Wants` / `After`** — dependency (hard/soft) vs ordering; they are orthogonal.
- **drop-in override** — `systemctl edit <unit>` creates `/etc/systemd/system/<unit>.d/override.conf` layered over the vendor unit.
- **cgroup** — kernel control group; systemd puts each unit in one for tracking and resource limits (`MemoryMax`, `CPUQuota`).
- **socket activation** — systemd holds a listening socket and starts the service on first connection.

**Why interviewers ask this**

Because operating services *is* the job. A junior can `systemctl restart nginx`; a senior knows why `restart` dropped the connections a `reload` would have kept, why their edited unit "did nothing" until `daemon-reload`, and why the service that "was running yesterday" is now `failed` with a Result=oom-kill in `systemctl status`. This topic separates people who memorise commands from people who understand the model: the enable-vs-start distinction alone is a fast filter. In an incident, "the service is flapping" needs someone who can read `Restart=on-failure` + `StartLimitIntervalSec` backoff, pull the last crash from `journalctl -u svc -p err`, and add a drop-in `MemoryMax` without editing the vendor file. That's the signal interviewers want.

**Common confusions**

- "`enable` starts the service" — no. `enable` only sets up autostart at boot. Use `enable --now` to do both.
- "I edited the unit and restarted, nothing changed" — you skipped `systemctl daemon-reload`; systemd is still running the old in-memory copy.
- "`Requires` implies ordering" — it doesn't. `Requires=` is a hard dependency; `After=` is ordering. You almost always need both.
- "journald replaces all logs" — apps that write their own files (nginx access logs) still do; journald captures stdout/stderr of units.
- "targets are just renamed runlevels" — targets can be composed and depended on arbitrarily; runlevels were a fixed 0–6 integer.
- "`reload` and `restart` are interchangeable" — `reload` re-reads config in the *same* process (no downtime if supported); `restart` kills and re-spawns.

**What follows from this topic**

Service management sits on top of the process and signal machinery from the Processes topic — `systemctl stop` sends `SIGTERM` then `SIGKILL` after a timeout, exactly the graceful-shutdown pattern. Resource control here (`MemoryMax`, `CPUQuota`) is cgroups, the same primitive the Containers/namespaces material builds on. journald ties into the Text Processing topic — you often pipe `journalctl` into `grep`/`awk`. And installing the service package that ships a unit is the Package Management topic. If you can reason about units, you can reason about how containers are just cgroup-and-namespace-scoped processes supervised the same way.

### Q1. What is systemd and why did it replace SysV init?

**systemd** is the init system and service manager that runs as **PID 1** on modern Linux. It replaced the old **SysV init** (sequential `/etc/init.d` shell scripts run per numbered runlevel) for concrete reasons:

- **Parallel startup** — SysV ran scripts one after another in `S##`/`K##` order; systemd builds a dependency graph and starts independent units concurrently, cutting boot time dramatically.
- **Declared dependencies** — instead of encoding order in filename numbers, units declare `After=`/`Requires=`; systemd computes ordering.
- **Process tracking via cgroups** — SysV lost track of daemons that double-forked; systemd puts every service in its own cgroup, so it always knows every child process (clean stop, no orphans).
- **Socket & bus activation** — services can start on demand when their socket gets a connection, so you don't pay to start everything eagerly.
- **Unified supervision & logging** — automatic restart on crash (`Restart=`) and stdout/stderr captured into journald, no custom PID files.

The tradeoff people complain about is scope creep — systemd also absorbed logging (journald), networking (networkd), name resolution (resolved), timers (replacing cron), etc. But the core win is real: services became declarative, supervised, and parallel.

### Q2. What are the main unit types in systemd?

A **unit** is anything systemd manages, distinguished by file suffix:

| Suffix | What it manages |
|---|---|
| `.service` | A daemon/process (most common) |
| `.socket` | A listening socket for socket activation; starts the paired `.service` on connect |
| `.target` | A grouping/sync point (the runlevel replacement), e.g. `multi-user.target` |
| `.timer` | A scheduled trigger for a unit (the cron replacement) |
| `.mount` / `.automount` | A filesystem mount point (generated from `/etc/fstab` or declared) |
| `.path` | Watches a file/dir and activates a unit on change |
| `.device` | A kernel device exposed as a unit (udev-backed) |
| `.slice` | A cgroup subtree for grouping resource limits |

You list them with `systemctl list-units --type=service` (or `--all` to include inactive). Most day-to-day work is `.service`; `.timer`, `.socket`, and `.target` come up in more senior questions.

### Q3. Walk me through the anatomy of a .service unit file.

Three sections. Example for a web app:

```ini
[Unit]
Description=Acme API server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/srv/app/bin/api --port 8080
User=acme
Group=acme
Restart=on-failure
RestartSec=5s
MemoryMax=512M

[Install]
WantedBy=multi-user.target
```

- **`[Unit]`** — metadata and ordering/dependencies: `Description`, `After=`/`Before=`, `Requires=`/`Wants=`.
- **`[Service]`** — how to run it. `ExecStart=` is the command. `Type=` tells systemd how to know it's "up" (`simple` = the ExecStart process *is* the service; `forking` = it double-forks; `notify` = it calls `sd_notify`; `oneshot` = runs to completion). `User=`/`Group=` drop privileges. `Restart=` + `RestartSec=` control supervision. Resource limits (`MemoryMax=`, `CPUQuota=`) go here.
- **`[Install]`** — only used by `enable`/`disable`. `WantedBy=multi-user.target` means "when I enable this, symlink it into multi-user.target's wants," i.e. start at normal boot.

Vendor units live in `/lib/systemd/system/` (or `/usr/lib/...`); your overrides go in `/etc/systemd/system/`.

### Q4. What is the difference between `systemctl start` and `systemctl enable`?

This is the classic filter question. They are **independent**:

- **`start`** runs the service **right now**, in the current boot. Nothing persists — reboot and it's gone unless something else starts it.
- **`enable`** sets it to **start automatically at boot**. It doesn't run it now — it just creates the symlinks from the unit's `[Install]` section (e.g. into `multi-user.target.wants/`).

So the four states are: enabled+running, enabled+stopped (will come back on reboot), disabled+running (running now, gone after reboot), disabled+stopped.

To do both at once: `systemctl enable --now nginx`. The mirror is `disable --now` (stop and remove from boot). Forgetting `enable` is why "the service works but disappeared after the reboot" — a very common production incident.

### Q5. I edited a unit file and restarted the service but my change didn't apply. Why?

Because systemd runs units from an **in-memory copy** loaded at boot (or last reload), not from the file on each start. After editing a unit on disk you must:

```bash
systemctl daemon-reload      # re-read unit files from disk
systemctl restart myapp      # now apply the new definition
```

`daemon-reload` reparses all unit files and rebuilds the dependency graph; without it, `restart` just re-runs the *old* definition. systemd even warns you: `status` shows "Warning: The unit file ... changed on disk. Run 'systemctl daemon-reload'."

Note `daemon-reload` is different from a unit's own `reload` (`systemctl reload nginx`), which tells the *service* to re-read *its* config (e.g. `nginx -s reload`) without restarting.

### Q6. Explain targets versus runlevels.

**Targets** are systemd's replacement for SysV **runlevels** — named synchronisation points that pull in a set of units. The rough mapping:

| Runlevel | Target |
|---|---|
| 3 (multi-user, no GUI) | `multi-user.target` |
| 5 (multi-user + GUI) | `graphical.target` |
| 1 (single user) | `rescue.target` |
| 0 (halt) | `poweroff.target` |
| 6 (reboot) | `reboot.target` |

Differences that matter: runlevels were a fixed integer set (0–6); targets are arbitrary, composable, and can depend on each other (`graphical.target` pulls in `multi-user.target`). You set the boot default with `systemctl set-default multi-user.target` and switch live with `systemctl isolate graphical.target`. `systemctl get-default` shows the current default.

### Q7. What is journald and how do you use journalctl to debug a service?

**journald** is systemd's logging daemon — it captures the stdout/stderr of every unit plus kernel and syslog messages into a structured, indexed binary journal. **`journalctl`** queries it. The flags that matter:

```bash
journalctl -u nginx.service        # only this unit
journalctl -u nginx -f             # follow (like tail -f)
journalctl -u nginx --since "10 min ago"
journalctl -u nginx --since today --until "1 hour ago"
journalctl -u nginx -p err         # priority: only err and worse
journalctl -b                      # this boot only; -b -1 = previous boot
journalctl -k                      # kernel (dmesg) messages
journalctl -u nginx -o json-pretty # structured output
```

Priorities (`-p`) run `emerg`(0) → `alert` → `crit` → `err`(3) → `warning` → `notice` → `info` → `debug`(7). Debugging flow for a crashing service: `systemctl status svc` for the headline, then `journalctl -u svc -b -p warning` to see what it logged before dying.

### Q8. Is journald persistent across reboots? How does it relate to /var/log?

By **default on many distros the journal is volatile** — stored in `/run/log/journal`, which is tmpfs, so it's **lost on reboot** (you can only see the current boot). To make it persistent:

```bash
mkdir -p /var/log/journal
# set Storage=persistent in /etc/systemd/journald.conf
systemctl restart systemd-journald
```

Then it lives in `/var/log/journal/` and `journalctl -b -1` (previous boot) works. Relationship to the old `/var/log/*` files: journald is separate from classic syslog text files. Many systems run both — journald forwards to `rsyslog`/`syslog-ng` which writes `/var/log/syslog`, `/var/log/messages`, etc. Apps that manage their own log files (nginx's `access.log`) still write there directly; journald only captures what units send to stdout/stderr or syslog. Check journal disk use with `journalctl --disk-usage` and trim with `journalctl --vacuum-size=500M`.

### Q9. Explain Requires vs Wants vs After/Before.

Two orthogonal axes people constantly conflate: **dependency** (should the other unit be running) and **ordering** (in what sequence).

- **`Requires=B`** — hard dependency. If A starts, B is started too; if B fails/stops, A is stopped. Strong coupling.
- **`Wants=B`** — soft dependency. A tries to start B, but A starts anyway if B fails. The preferred, looser default.
- **`After=B` / `Before=B`** — *ordering only*. `After=B` means "don't start A until B is up," but says **nothing** about whether B should exist.

The gotcha: `Requires=B` **without** `After=B` starts them *in parallel* — A may come up before B is ready. You almost always pair them: `Requires=postgres.service` + `After=postgres.service`. Use `Wants=`+`After=` when the dependency is nice-to-have (e.g. `Wants=network-online.target` + `After=network-online.target`).

### Q10. How do restart policies and backoff work? A service is flapping — how do you reason about it?

`Restart=` in `[Service]` controls supervision. Common values: `no` (default), `on-failure` (restart only on non-zero exit / signal / timeout), `on-abnormal` (signals/timeouts), `always` (even on clean exit). `RestartSec=` sets the delay between restarts (default 100ms — too fast, bump it).

**Flapping** = the service keeps crashing and restarting. systemd has a rate limiter to stop infinite crash loops:

- **`StartLimitIntervalSec=`** (default 10s) and **`StartLimitBurst=`** (default 5): if the unit restarts more than `burst` times within the interval, systemd gives up and puts it in `failed` state with "start request repeated too quickly."

```bash
[Service]
Restart=on-failure
RestartSec=5s
StartLimitIntervalSec=60
StartLimitBurst=3
```

To diagnose: `systemctl status svc` shows restart count and the "start-limit-hit" reason; `journalctl -u svc` shows *why* it keeps dying. Fix the root cause (bad config, OOM, missing dependency) rather than just widening the limit. Reset the failed counter with `systemctl reset-failed svc`.

### Q11. What is a drop-in override and why use `systemctl edit`?

A **drop-in** lets you override *part* of a vendor unit without editing (and later fighting a package update over) the original file. `systemctl edit nginx` creates:

```
/etc/systemd/system/nginx.service.d/override.conf
```

You put only the directives you want to change there; systemd merges them on top of the vendor unit in `/lib/systemd/system/`. Example — raise the memory limit and change restart behaviour:

```ini
[Service]
MemoryMax=1G
Restart=always
```

Benefits: package upgrades replacing the vendor unit don't clobber your change, and `systemctl cat nginx` shows the merged result plus where each line came from. Use `systemctl edit --full nginx` to override the whole unit instead. For list-valued directives like `ExecStart=`, you must reset first (`ExecStart=` empty line, then the new value) because they'd otherwise append.

### Q12. How do you limit a service's memory and CPU with systemd?

Because every unit lives in a **cgroup**, you set resource limits declaratively in `[Service]` (or via a drop-in) and the kernel enforces them:

```ini
[Service]
MemoryMax=512M        # hard cap; exceeding triggers cgroup OOM kill of the service
MemoryHigh=400M       # soft throttle before the hard cap
CPUQuota=50%          # at most half of one CPU
TasksMax=100          # cap number of threads/processes
IOWeight=100          # relative block-IO priority
```

`MemoryMax` is the important one for keeping a leaky service from taking down the box — when it exceeds the cap, the kernel OOM-kills *within that cgroup* (`systemctl status` shows `Result=oom-kill`) instead of letting the global OOM killer pick a random victim. Apply with `systemctl daemon-reload && systemctl restart svc`, then verify live usage with `systemctl status svc` (shows `Memory:` and `CPU:`) or `systemd-cgtop`. This is the same cgroup machinery containers use.

### Q13. What is socket activation?

**Socket activation** means systemd itself creates and holds the listening socket (via a `.socket` unit), and only starts the actual service when the *first connection arrives*. You pair a `foo.socket` with `foo.service`:

```ini
# foo.socket
[Socket]
ListenStream=8080

[Install]
WantedBy=sockets.target
```

Benefits: (1) **on-demand start** — rarely-used services don't consume resources until needed; (2) **parallelism/ordering-free boot** — systemd can open all sockets up front, so clients can connect before the backing service is even ready (the connection just queues), removing startup ordering headaches; (3) **zero-downtime restarts** — the socket stays open across a service restart, so no connections are refused. This is how `ssh.socket`, and classically `inetd`/`xinetd`, work. `enable` the `.socket`, not the `.service`.

### Q14. What does it mean to mask a unit, and how is it different from disable?

- **`disable`** removes the unit from boot autostart (deletes `[Install]` symlinks), but you can still start it manually and other units can pull it in via dependencies.
- **`mask`** symlinks the unit to `/dev/null`, making it **completely unstartable** — `systemctl start` fails, and nothing can activate it as a dependency either.

```bash
systemctl mask cups.service     # cannot be started at all
systemctl unmask cups.service   # reverse it
```

Use `mask` when you need a hard guarantee a service never runs (e.g. masking `NetworkManager` before configuring `networkd`, or masking a service another package keeps trying to pull in). It's the strongest "off" switch. `systemctl status` on a masked unit shows `Loaded: masked`.

### Q15. A service failed to start. Walk me through debugging it.

Systematic flow, no guessing:

```bash
systemctl status myapp.service      # 1. headline: active state, last exit code/signal, recent log lines
journalctl -u myapp -b -p warning   # 2. what it logged this boot before dying
systemctl cat myapp                 # 3. the effective (merged) unit — check ExecStart, User, paths
```

Read the `status` output carefully: `Result=exit-code` with `status=203/EXEC` means the `ExecStart` binary path is wrong or not executable; `217/USER` means the `User=` doesn't exist; `Result=oom-kill` means it hit `MemoryMax` or the system OOM killer; `timeout` means `Type=notify`/`forking` and it never signalled ready.

Then reproduce: run the exact `ExecStart` command manually as the `User=` to see the real error. If you edited the unit, `daemon-reload` first. `systemd-analyze verify myapp.service` catches syntax errors. Once fixed: `systemctl reset-failed myapp && systemctl start myapp`.

### Q16. Boot is slow. How do you find what's taking so long?

`systemd-analyze` is built for exactly this:

```bash
systemd-analyze                 # total: kernel + initrd + userspace time
systemd-analyze blame           # units sorted by how long each took to initialise
systemd-analyze critical-chain  # the dependency chain on the critical path (what actually gated boot)
systemd-analyze plot > boot.svg # visual timeline
```

`blame` shows the slowest units, but be careful — a unit taking 30s isn't necessarily *on the critical path* if it started in parallel. `critical-chain` is the honest answer: it shows the serialised chain of `After=` dependencies that determined total boot time, with `@` timestamps. Common culprits: `NetworkManager-wait-online.service` / `systemd-networkd-wait-online.service` blocking on DHCP, a slow `.mount`, or a service with a long `Type=notify` startup. Fix by removing an unnecessary `After=network-online.target`, or disabling the wait-online unit if the service doesn't truly need the network up first.

## Package Management

### Summary

**What this topic covers**

How software gets installed, updated, and removed on Linux — and why "just run `make install`" is usually the wrong answer. This is core ops knowledge: patching, dependency resolution, and reproducible installs are daily SRE concerns. The 15 questions here cover the two dominant ecosystems — **Debian/Ubuntu** (`dpkg` low-level, `apt` high-level, `.deb`) and **RHEL/Fedora** (`rpm` low-level, `dnf`/`yum` high-level, `.rpm`) — what a package manager actually does (dependency resolution, install scripts, a database of every installed file), repositories with GPG signing and trust, querying which package owns a file, pinning/holding versions, cleaning caches, why mixing `make install` with packages causes pain, the shift toward universal packages (Snap/Flatpak/AppImage) and containers, "dependency hell," updating safely in production, source vs binary packages, and automating security updates.

**Mental model**

A package manager is really two things stacked: a **low-level tool** that installs/removes one already-downloaded package file and records what it did, and a **high-level tool** that resolves dependencies and talks to remote repositories. On Debian: `dpkg` installs a single `.deb` (and will *fail* if a dependency is missing — it doesn't fetch), while `apt` sits on top, computing the full dependency tree and downloading everything from configured repos. On RHEL it's the same shape: `rpm` is the low-level file installer, `dnf` (formerly `yum`) is the dependency-resolving repo client. The package manager maintains a **database** of every installed package and every file it owns, which is what makes clean uninstall, upgrade, and "which package owns `/usr/bin/foo`" possible. `make install` bypasses all of this — it scatters files the database doesn't know about, which is why it eventually breaks. Repositories are just signed collections of packages; **GPG signatures** are the trust anchor.

**Key terms**

- **`dpkg`** — Debian low-level tool: installs/removes a single `.deb`, doesn't resolve or fetch dependencies.
- **`apt`** / `apt-get` — Debian high-level tool: dependency resolution + repository downloads on top of dpkg.
- **`rpm`** — RHEL/Fedora low-level tool: installs/removes a single `.rpm`, maintains the RPM database.
- **`dnf`** / `yum` — RHEL/Fedora high-level tool: dependency resolution + repos on top of rpm (`yum` is the older name).
- **repository** — a server hosting packages + metadata index; configured in `/etc/apt/sources.list*` or `/etc/yum.repos.d/`.
- **GPG signing** — packages/metadata are signed; the client verifies against trusted keys so you don't install tampered software.
- **dependency resolution** — computing the full set of packages needed and installing them in the right order.
- **maintainer scripts** — pre/post install/remove hooks a package runs (create users, restart services).
- **hold / pin** — freeze a package at a version so an upgrade won't move it.
- **dependency hell** — an unsatisfiable/conflicting web of version requirements; "held broken packages" is apt's symptom.
- **Snap / Flatpak / AppImage** — universal package formats bundling their own dependencies, distro-independent.
- **unattended-upgrades** — automatic (usually security-only) patching on Debian/Ubuntu.

**Why interviewers ask this**

Patching is where breaches and outages actually happen, so ops interviewers care whether you can update a fleet *safely*. A junior runs `apt upgrade -y` on prod and hopes; a senior knows the difference between `update`, `upgrade`, and `full-upgrade`, stages patches through a test environment, pins the versions that must not move, and knows how to find *which* package a stray file belongs to during an incident. The `dpkg` vs `apt` (and `rpm` vs `dnf`) distinction is a quick competence probe — if you think `dpkg` downloads dependencies, you haven't operated these systems. And "why not `make install`?" tests whether you understand the package *database* — the thing that makes a system auditable and upgradable.

**Common confusions**

- "`dpkg -i` will pull in dependencies" — no. `dpkg` installs one file and errors if deps are missing; `apt install ./file.deb` (or `apt -f install` after) resolves them.
- "`apt update` upgrades my packages" — no. `update` only refreshes the *package list/metadata*; `upgrade` installs the newer versions.
- "`apt upgrade` will fully upgrade everything" — plain `upgrade` won't remove or add packages to satisfy changes; `full-upgrade`/`dist-upgrade` will.
- "yum and dnf are different tools" — dnf is the modern rewrite of yum; on RHEL 8+ `yum` is just a symlink to `dnf`.
- "`make install` is fine, it's just files" — those files aren't in the package DB, so they're invisible to upgrades, conflict with future packages, and can't be cleanly removed.
- "Snap/Flatpak are the same as apt packages" — they bundle dependencies and are sandboxed/distro-independent; larger, slower to start, isolated from system libs.

**What follows from this topic**

Package management is upstream of nearly everything else in this primer: the systemd `.service` units you operate are shipped *by* packages (with a maintainer script that runs `systemctl daemon-reload`); the CLI tools in the Text Processing topic (`grep`, `sed`, `awk`) arrive via `coreutils`/`grep`/`sed` packages; security hardening depends on timely patching, which is this topic's `unattended-upgrades`. The universal-package and container trend at the end of this section leads directly into the namespaces/cgroups container material — containers are, in one sense, the ultimate "bundle every dependency" answer to dependency hell.

### Q1. Explain the difference between dpkg and apt.

Two layers of the same Debian/Ubuntu stack:

- **`dpkg`** is the **low-level** tool. It installs, removes, and queries a single already-present `.deb` file. Critically, it does **not** resolve or download dependencies — `dpkg -i foo.deb` *fails* if `foo` needs a library that isn't installed, leaving the package half-configured.
- **`apt`** (and `apt-get`) is the **high-level** tool built on top. It reads configured repositories, computes the full dependency tree, downloads every needed `.deb`, and hands them to dpkg in the right order.

```bash
dpkg -i ./app.deb          # install just this file; may fail on missing deps
apt install ./app.deb      # apt resolves+fetches deps, then installs the local file
dpkg -l | grep app         # query the installed-package database
```

Rule of thumb: use `apt` to install from repos, use `dpkg` for querying (`-l`, `-L`, `-S`) or when you already have the file and apt for the dependency fix-up (`apt -f install`).

### Q2. What's the difference between `apt update`, `apt upgrade`, and `apt full-upgrade`?

These are constantly confused and the difference matters in production:

- **`apt update`** — refreshes the **package index** (metadata) from the repositories. It installs *nothing*; it just learns what versions are now available. Always run first.
- **`apt upgrade`** — installs the newest versions of already-installed packages, but **conservatively**: it will *not remove* any package and will *not install new* packages to satisfy changes. If an upgrade would require removing something, it holds that package back.
- **`apt full-upgrade`** (aka `dist-upgrade`) — like upgrade but **will add and remove** packages as needed to resolve changed dependencies. Needed for kernel transitions and major upgrades; more powerful, more dangerous.

```bash
apt update && apt upgrade         # normal patching
apt full-upgrade                  # when packages are "kept back"
```

"Packages kept back" after `upgrade` is the signal that a `full-upgrade` is required — but review what it wants to *remove* before running it on prod.

### Q3. apt vs apt-get — which should I use and why?

`apt-get` (and `apt-cache`) is the older, stable, script-oriented interface. **`apt`** is the newer, human-friendly front-end introduced around 2014 that combines the most-used `apt-get`/`apt-cache` commands with a progress bar and colour.

Guidance: use **`apt` interactively** (nicer output, `apt search`, `apt list --installed`), and use **`apt-get` in scripts/automation** because its CLI output is stable and guaranteed not to change between releases (`apt` explicitly warns it's "not intended to be a stable interface"). Functionally for install/remove/update they're equivalent; `apt` just has a friendlier default UX.

### Q4. What does a package manager actually do beyond copying files?

Four jobs that `cp`/`make install` don't do:

1. **Dependency resolution** — figures out the complete set of other packages required and installs them in a valid order.
2. **Runs maintainer scripts** — pre/post install and remove hooks that create system users, generate config, register/restart systemd services, compile modules, etc.
3. **Maintains a database of installed files** — records every file each package owns, enabling clean removal, upgrade, and ownership queries (`dpkg -S`, `rpm -qf`). It also detects conflicts (two packages claiming the same file).
4. **Verifies integrity and trust** — checks GPG signatures and checksums so you don't install corrupted or tampered software.

That database is the whole point: it makes the system *auditable* and *upgradable*. Anything installed outside it (manual `make install`) is invisible to these guarantees.

### Q5. How do repositories, GPG signing, and trust work?

A **repository** is a server hosting packages plus a signed metadata index. Clients are configured to trust specific ones:

- Debian: `/etc/apt/sources.list` and `/etc/apt/sources.list.d/*.list` (or `.sources`); keys in `/etc/apt/trusted.gpg.d/` or `signed-by=` per-repo.
- RHEL: `/etc/yum.repos.d/*.repo`; keys referenced by `gpgkey=` with `gpgcheck=1`.

**GPG signing** is the trust anchor. The repo maintainer signs the metadata index (and packages) with a private key; you import their public key. On every `apt update`/`dnf` run, the client verifies the index signature against the trusted key. If it doesn't match — tampered or MITM'd repo — the update is rejected. This is why adding a third-party repo means importing its key first, and why you should never blindly `[trusted=yes]` a repo (that disables verification). The modern Debian practice is `signed-by=/usr/share/keyrings/foo.gpg` so a key only signs the one repo it's meant to.

### Q6. How do you find out which package owns a given file?

Reverse lookup from a file path to its package — essential during incidents ("what installed this binary?"):

```bash
# Debian/Ubuntu
dpkg -S /usr/bin/ssh          # which installed package owns this file
apt-file search /usr/bin/foo  # which (possibly not-installed) package would provide it

# RHEL/Fedora
rpm -qf /usr/bin/ssh          # query file -> owning package
dnf provides /usr/bin/foo     # search repos for what provides it
```

And the forward direction — list all files a package installed:

```bash
dpkg -L openssh-client        # Debian
rpm -ql openssh-clients       # RHEL
```

Note `dpkg -S` only knows about *installed* packages; `apt-file`/`dnf provides` query repository metadata for files from packages you haven't installed yet.

### Q7. How do you list installed packages and query package info on each distro?

```bash
# Debian/Ubuntu
dpkg -l                       # all installed packages (state, name, version)
dpkg -l | grep nginx
apt list --installed
apt show nginx                # detailed metadata for a package

# RHEL/Fedora
rpm -qa                       # all installed packages
rpm -qa | grep nginx
rpm -qi nginx                 # info on an installed package
dnf list installed
dnf info nginx
```

`dpkg -l` output's first column encodes state (`ii` = installed OK; `rc` = removed but config remains). `rpm -qa` is unsorted; pipe through `sort`. To find *available* (not just installed) versions: `apt-cache policy nginx` or `dnf --showduplicates list nginx`.

### Q8. How do you hold or pin a package at a specific version?

When an upgrade must not move a package (a database engine, a kernel, an app pinned to a known-good build):

```bash
# Debian/Ubuntu — hold
apt-mark hold nginx           # freeze at current version
apt-mark unhold nginx         # release
apt-mark showhold             # list held packages
# finer control via apt pinning in /etc/apt/preferences.d/ (Pin-Priority)

# RHEL/Fedora
dnf install python3-dnf-plugin-versionlock
dnf versionlock add nginx
dnf versionlock delete nginx
# or ad hoc: dnf update --exclude=nginx
```

On Debian, apt **pinning** (`/etc/apt/preferences.d/`) is the more powerful mechanism — assign priorities to hold a package, or prefer a specific repo/release. Held packages are why `apt upgrade` reports items "kept back."

### Q9. What is dependency hell, and what does "held broken packages" mean?

**Dependency hell** is when package version requirements conflict in a way the resolver can't satisfy: package A needs libX ≥ 2.0, package B needs libX < 2.0, and you want both. Or a package requires something not available in your configured repos.

apt's symptom is the message **"The following packages have unmet dependencies"** / **"held broken packages."** It means apt found a set of requirements it *can't* satisfy without breaking something, so it refuses to proceed rather than leave you half-installed.

How to dig out:
```bash
apt -f install          # attempt to fix broken/half-configured deps
apt install foo=1.2.3   # force a specific compatible version
apt-cache policy foo    # see candidate vs installed vs available versions
dpkg --configure -a     # finish configuring interrupted installs
```

Modern package managers with SAT-solver resolution (apt, dnf) hit this far less than the old days, but third-party repos with conflicting versions still trigger it. The container/universal-package trend exists partly to sidestep it entirely.

### Q10. Why shouldn't you mix `make install` with the package manager?

Because `make install` copies files into `/usr/local` (or worse, `/usr`) **without telling the package database**. Consequences:

- **Invisible to the package manager** — `dpkg -S`/`rpm -qf` won't find the files; upgrades and audits don't know they exist.
- **No clean uninstall** — there's no record of what was placed where; removal is manual and error-prone (unless the Makefile has a working `uninstall` target, which many don't).
- **Conflicts and shadowing** — a manually built binary in `/usr/local/bin` can shadow the packaged one on `PATH`, causing "why is it running the old version?" mysteries. If it lands in `/usr`, a future package install may collide.
- **Dependency drift** — the packaged libraries update underneath your hand-built binary, which may then break because it was linked against the old ABI.

Better options: build a proper package (`checkinstall`, `fpm`, or a real `.deb`/`.rpm` spec), install into an isolated prefix (`/opt/app`) that's off the default paths, or ship it in a container. If you must `make install`, use `/usr/local` and keep a manifest.

### Q11. What are Snap, Flatpak, and AppImage, and why do they exist?

They're **universal / distro-independent package formats** that bundle an app together with its dependencies, sidestepping "dependency hell" and per-distro packaging:

| Format | Model | Notes |
|---|---|---|
| **Snap** | Canonical; central store (Snap Store); auto-updates; daemon `snapd` | Sandboxed (AppArmor); can ship services; criticised for closed backend + slow startup |
| **Flatpak** | Community/Red Hat; Flathub store; per-user or system | Sandboxed (bubblewrap/portals); shared "runtimes" reduce duplication; desktop-app focused |
| **AppImage** | Single self-contained executable file; no install, no store | Just download and run; no auto-update or sandbox by default; most portable |

Why they exist: traditional packages are tied to a distro release's library versions, so shipping one app across Ubuntu/Fedora/Debian means maintaining many packages and fighting version skew. Universal packages bundle their own libs so one artefact runs everywhere. Tradeoffs: larger disk footprint (duplicated libraries), slower cold start, weaker integration with system theming/libs, and they don't get security fixes via the system library update — the bundle must be rebuilt. For servers, **containers** are the same idea taken further.

### Q12. What's the difference between source and binary packages?

- **Binary package** (`.deb`, `.rpm`) — precompiled files ready to install for a specific architecture (amd64, arm64). This is what `apt`/`dnf` install by default. Fast, no build toolchain needed.
- **Source package** — the upstream source plus packaging metadata/build recipe (Debian: `.dsc` + `.orig.tar.gz` + `debian/`; RHEL: a `.src.rpm` with a spec file). You *build* it into a binary package for your machine.

```bash
# Debian: fetch and build from source
apt source nginx
apt build-dep nginx            # install build dependencies
dpkg-buildpackage -us -uc

# RHEL
dnf download --source nginx    # get the .src.rpm
rpmbuild --rebuild nginx.src.rpm
```

You build from source when you need a custom compile flag, a patch, a newer version than the repos ship, or a build for an architecture without prebuilt binaries. Gentoo/Arch's AUR lean on source builds; most production servers use binary packages for speed and reproducibility.

### Q13. How do you update a production fleet safely?

Never `apt upgrade -y` straight onto prod. A safe pattern:

1. **Stage and test** — apply the same updates to a staging/canary host first, run smoke tests, watch for regressions.
2. **Pin what must not move** — `apt-mark hold` / `dnf versionlock` the database, kernel, or app versions you can't afford to bump unexpectedly.
3. **Prefer security-only where possible** — apply just security updates rather than every available upgrade (`unattended-upgrades` security origin; `dnf update --security`).
4. **Do it in waves** — roll to a small percentage of the fleet, verify health metrics, then proceed. Config-management/orchestration (Ansible, etc.) makes this repeatable.
5. **Snapshot/rollback plan** — snapshot the VM or know the downgrade path before you start; kernel updates especially need a tested reboot and a fallback boot entry.
6. **Control the timing** — during a maintenance window, with monitoring watching, not on a Friday afternoon.

The theme: reproducible, tested, incremental, reversible — the same principles as any production change.

### Q14. How do you check for and apply only security updates?

```bash
# Debian/Ubuntu
apt update
apt list --upgradable                        # see what's available
unattended-upgrade --dry-run -d              # what the security auto-updater would do
# unattended-upgrades config: /etc/apt/apt.conf.d/50unattended-upgrades

# RHEL/Fedora
dnf updateinfo list security                 # list available security errata
dnf update --security                        # apply only security-flagged updates
dnf updateinfo info --security               # details/CVEs
```

**unattended-upgrades** (Debian/Ubuntu) is the standard for automatic patching — configured to apply only the *security* origin by default, so you get CVE fixes without unexpected feature-version churn. Enable with `dpkg-reconfigure -plow unattended-upgrades`. On RHEL, `dnf-automatic` is the equivalent. For servers you typically auto-apply security updates and manually gate everything else. Track what's outstanding with `apt list --upgradable` or `dnf check-update`.

### Q15. What's the difference between removing and purging a package?

On Debian, `remove` and `purge` differ in what they leave behind:

- **`apt remove nginx`** — removes the package's *program* files but **keeps its configuration** (`/etc/nginx/...`) and any data. Reinstalling restores your old config. `dpkg -l` shows the package as `rc` (removed, config remains).
- **`apt purge nginx`** (or `dpkg -P`) — removes the package **and** its config files. A clean slate.

```bash
apt remove nginx       # keep /etc config
apt purge nginx        # also delete config
apt autoremove         # remove now-unneeded dependencies pulled in earlier
```

Note neither touches files in `/var` created *at runtime* (databases, logs) or user home data — those are deliberately preserved. On RHEL, `dnf remove` behaves like purge for most config (RPM marks config files `%config`; `.rpmsave` copies may be left). Use `apt autoremove` regularly to clear orphaned dependencies, and `apt clean`/`dnf clean all` to reclaim the download cache.

## Text Processing & the CLI Toolkit

### Summary

**What this topic covers**

The Unix philosophy in practice: small sharp tools that read text on stdin and write text on stdout, composed with pipes into one-liners that would be a whole script in another language. This is where SRE work lives — parsing logs, extracting fields, summarising, filtering — and interviewers love it because it reveals whether you *think in pipelines*. The 18 questions cover `grep` (patterns and its flags, basic vs extended vs Perl regex), `sed` (substitution, in-place edit, delete/print), `awk` (fields, patterns+actions, FS/OFS, column math), `cut`, `sort`, `uniq` (and why it needs sorted input), `wc`, `tr`, `head`/`tail` (including `tail -f`), `find` (`-name`/`-type`/`-mtime`/`-size`/`-exec`/`-delete` and find-vs-locate), `xargs` (and the `-0`/`-print0` NUL-safety trick), `tee`, `column`, `comm`/`diff`, the regex fundamentals underneath it all, the shell-globbing-vs-regex distinction, and the classic "top 10 IPs in an access log" pipeline that ties it together.

**Mental model**

Everything is a **stream of text lines**, and each tool does one transformation on that stream: `grep` *filters* lines, `sed` *edits* lines, `awk` *splits lines into fields and computes*, `sort`/`uniq` *aggregate*, `cut` *selects columns*. Pipes (`|`) wire one tool's stdout into the next's stdin, so you build a data pipeline left-to-right: select → filter → transform → aggregate → present. The reflex to develop: when you have text and a question ("how many 500s per endpoint?"), reach for a pipeline before a Python script. The mental hierarchy for *which* tool: `grep` to find/filter, `cut`/`awk` to pull fields, `sort | uniq -c | sort -rn` to rank by frequency, `sed`/`awk` to rewrite. Regex is the connective tissue — the same pattern language (with dialect differences) drives grep, sed, and awk. Know when a task outgrows the pipeline: once you need real data structures or multi-pass logic, switch to a script.

**Key terms**

- **`grep`** — filter lines matching a pattern; the workhorse of "find lines that…".
- **`sed`** — stream editor; `s/old/new/g` substitution, `-i` in-place, line delete/print.
- **`awk`** — field-aware processing language; `$1..$NF` fields, `pattern { action }`, arithmetic and aggregation.
- **`cut`** — extract columns by delimiter (`-d`, `-f`) or byte/char position.
- **`sort`** — order lines; `-n` numeric, `-r` reverse, `-k` by field, `-u` unique.
- **`uniq`** — collapse *adjacent* duplicate lines; `-c` counts. Needs sorted input.
- **`tr`** — translate/delete characters (`tr 'a-z' 'A-Z'`, `tr -d`, `tr -s` squeeze).
- **`find`** — recursively locate files by name/type/time/size and act on them (`-exec`, `-delete`).
- **`xargs`** — build command lines from stdin; `-0` pairs with `find -print0` for spaces/newlines.
- **`tee`** — split a stream: write to a file *and* pass it on to stdout.
- **regex** — pattern language: anchors (`^ $`), classes (`[…]`, `\d`, `\w`), quantifiers (`* + ? {n,m}`), greedy by default.
- **glob vs regex** — shell globbing (`*.log`) is filename matching by the shell; regex is line-content matching inside tools.

**Why interviewers ask this**

Because pipeline fluency is a near-perfect proxy for day-to-day operational competence. Handed a 2GB access log on a box with no fancy tooling, a senior engineer produces "top 10 offending IPs" in one line from memory; a junior reaches for uploading it somewhere or writing 40 lines of Python. The questions also probe *understanding*, not memorisation: "why does `uniq` miss duplicates?" (it only collapses adjacent lines — you must `sort` first) is a beautiful filter, as is knowing why `find … | xargs rm` breaks on filenames with spaces and how `-print0`/`-0` fixes it. And the regex/glob distinction catches people who've been getting lucky. This is bread-and-butter for on-call log spelunking, so it's asked constantly.

**Common confusions**

- "`uniq` removes all duplicates" — no, only *adjacent* ones. `sort | uniq` (or `sort -u`) is the idiom.
- "grep uses the same regex as Perl/PCRE" — by default grep is **basic** regex (BRE) where `+`, `?`, `{}`, `()` are literal unless backslash-escaped; use `grep -E` (extended) or `grep -P` (Perl) for the familiar syntax.
- "`*` means the same in the shell and in grep" — in the shell `*` is a glob (any filename chars); in regex `*` means "zero-or-more of the *previous* character." Totally different.
- "`sed -i` edits safely" — it rewrites the file in place with no undo; test without `-i` (or use `-i.bak`) first.
- "`cut` handles multiple spaces" — `cut -d' '` treats each space as a separate delimiter, so runs of spaces break it; `awk` splits on *runs* of whitespace by default.
- "`find -exec` and `xargs` are equivalent" — similar, but `xargs` batches (faster) and `find -print0 | xargs -0` is the space-safe pattern; `-exec … +` also batches.

**What follows from this topic**

These tools are the glue for every other topic. You pipe `journalctl` (systemd topic) into `grep`/`awk` to hunt errors; you parse `ps`/`ss` output (Processes/Networking) with `awk` to extract the columns you need; you scan `/var/log` and `/proc` files with `grep` and `sed`. The regex fundamentals here reappear in log-based alerting and config templating. And the "know when to stop and write a real script" judgement connects to the shell-scripting discipline — pipelines for the quick question, a version-controlled script for anything you'll run twice.

### Q1. Explain the most useful grep flags.

`grep PATTERN file` prints matching lines. The flags that earn their keep:

```bash
grep -i error log            # case-insensitive
grep -v error log            # invert: lines NOT matching
grep -r error /var/log       # recursive through a directory tree
grep -n error log            # prefix each match with its line number
grep -c error log            # count matching lines (not print them)
grep -o 'user=[a-z]*' log    # print only the matched part, not the whole line
grep -E 'warn|error' log     # extended regex (alternation without backslashes)
grep -w error log            # match whole word only (not "errors")
grep -A3 -B2 error log       # 3 lines After, 2 Before each match (context)
```

Combos you'll actually type: `grep -rn TODO src/` (find every TODO with location), `grep -ic error log` (case-insensitive count), `grep -v '^#' config` (drop comment lines). `-o` is underrated — it turns grep into a field extractor.

### Q2. What's the difference between basic, extended, and Perl regex in grep?

grep has three regex dialects, which trips everyone up:

- **BRE (basic, the default)** — `+`, `?`, `{}`, `()`, `|` are **literal** characters; to get their special meaning you must backslash them: `\+`, `\?`, `\(`, `\|`.
- **ERE (`grep -E`, extended)** — those metacharacters work **without** backslashes: `grep -E 'foo|bar'`, `grep -E '(ab)+'`. This is what most people mean by "regex."
- **PCRE (`grep -P`, Perl)** — the full modern engine: `\d`, `\w`, `\s`, lookahead/lookbehind, non-greedy `*?`. Powerful but not available in every grep build (GNU only).

```bash
grep    'colou\?r' f    # BRE: need \? for optional
grep -E 'colou?r'  f    # ERE: bare ? works
grep -P '\d{3}'    f    # PCRE: \d shorthand + {n}
```

Rule of thumb: reach for `-E` by default (matches what you expect), and `-P` when you need `\d`/lookaround.

### Q3. How do you do search-and-replace with sed?

`sed` is the stream editor; the substitution command is `s/pattern/replacement/flags`:

```bash
sed 's/foo/bar/'    file    # replace FIRST foo on each line
sed 's/foo/bar/g'   file    # g = global: every foo on each line
sed 's/foo/bar/gi'  file    # g + case-insensitive
sed 's/foo/bar/2'   file    # only the 2nd occurrence per line
sed 's#/var/log#/srv/log#g' file   # use # as delimiter to avoid escaping /
```

By default sed writes to **stdout** and leaves the file untouched — good for testing. Use `&` to reference the whole match and `\1`,`\2` for captured groups (`\(...\)` in BRE, or `sed -E` for `(...)`):

```bash
sed -E 's/(\w+)@(\w+)/\2-\1/' file   # swap around the @
```

### Q4. How do you edit a file in place with sed, and what's the risk?

`-i` (in-place) rewrites the file directly instead of printing to stdout:

```bash
sed -i 's/debug/info/g' config.yml       # overwrites config.yml, no backup
sed -i.bak 's/debug/info/g' config.yml   # writes config.yml, keeps config.yml.bak
```

**The risk:** `-i` alone has **no undo** — a bad pattern silently corrupts the file. Always either (1) run without `-i` first to preview the output, or (2) use `-i.bak` to keep a backup. A classic footgun is an unanchored pattern replacing more than intended (`s/1/one/g` also hits "10", "21"). Also note GNU sed (`-i` no suffix) and BSD/macOS sed (`-i ''` requires an explicit empty argument) differ — a script that works on Linux can error on a Mac.

### Q5. How does awk work? Explain fields, patterns, and actions.

`awk` reads input line by line, **splits each line into fields** (default: on whitespace runs), and runs `pattern { action }` blocks. Fields are `$1`, `$2`, … `$NF` (last field); `$0` is the whole line; `NF` = number of fields, `NR` = current record (line) number.

```bash
awk '{ print $1 }' file            # print first field of every line
awk '{ print $NF }' file           # print last field
awk 'NR==5' file                   # print line 5 (pattern true, default action = print)
awk '$3 > 100' file                # print lines whose 3rd field > 100
awk '/error/ { print $1, $5 }' f   # lines matching /error/, print fields 1 and 5
awk 'NF==0' file                   # blank lines (zero fields)
```

The model: `pattern { action }` — if the pattern is true, run the action; omit the pattern and it runs on every line; omit the action and it defaults to `print $0`. `BEGIN{}`/`END{}` blocks run before/after all input (great for headers and totals).

### Q6. Show me how to sum a column with awk.

The canonical awk idiom — accumulate in `END`:

```bash
awk '{ sum += $3 } END { print sum }' file
```

`sum += $3` runs on every line (uninitialised variables start at 0 in awk), and the `END` block prints the total after the last line. Variations:

```bash
# average of column 3
awk '{ sum += $3 } END { print sum/NR }' file

# sum column 2 only for lines where column 1 == "GET"
awk '$1=="GET" { sum += $2 } END { print sum }' log

# sum bytes (field 10) per status code (field 9) — associative array
awk '{ bytes[$9] += $10 } END { for (s in bytes) print s, bytes[s] }' access.log
```

That last one — associative arrays keyed by a field — is where awk beats a pipeline: one pass, grouped aggregation. It's the moment people realise awk is a real language, not just `print $1`.

### Q7. What are FS and OFS in awk?

**FS** = input **F**ield **S**eparator (how awk splits `$1`,`$2`,…). **OFS** = **O**utput Field Separator (what `print a, b` puts *between* fields). Both default to whitespace/single-space.

```bash
awk -F: '{ print $1 }' /etc/passwd          # FS=":" via -F, print username
awk 'BEGIN{FS=":"; OFS="\t"} { print $1, $3 }' /etc/passwd   # split on :, join with tab
awk -F',' '{ print $2 }' data.csv           # naive CSV column 2
```

Key subtlety: setting `OFS` only takes effect when you **rebuild `$0`** (e.g. assign to a field: `$1=$1`) or use `print` with commas. `-F` is shorthand for setting FS on the command line. Default FS splits on *runs* of whitespace (so leading spaces don't create empty fields) — which is exactly why `awk` handles ragged columns better than `cut`.

### Q8. When would you use cut, and what's its limitation?

`cut` extracts columns — simpler and faster than awk when the delimiter is consistent:

```bash
cut -d: -f1 /etc/passwd        # delimiter ":", field 1 (usernames)
cut -d, -f2,4 data.csv         # fields 2 and 4 from a CSV
cut -c1-8 file                 # characters 1–8 of each line (fixed width)
cut -d' ' -f1 access.log       # first space-delimited field
```

**The limitation:** `cut -d' '` treats **every single space as a delimiter**, so runs of spaces produce empty fields and misalign everything. On `ls -l` or logs with variable spacing, `cut` mangles the output. `awk` splits on *runs* of whitespace by default, so for whitespace-delimited data prefer `awk '{print $1}'`. Use `cut` for clean single-char delimiters (`:`, `,`, `\t`); use `awk` for ragged whitespace.

### Q9. Explain sort and why uniq needs sorted input.

`sort` orders lines; the flags that matter:

```bash
sort file                # lexical (string) order
sort -n file             # numeric order (so 9 < 10, not "10" < "9")
sort -r file             # reverse
sort -k2 file            # sort by the 2nd field
sort -k2 -n file         # numeric sort on field 2
sort -t: -k3 -n /etc/passwd   # field separator ":", numeric by field 3 (UID)
sort -u file             # sort and dedupe in one step
```

`uniq` only collapses **adjacent** identical lines — it compares each line to the *previous* one. So `uniq` on unsorted input misses duplicates that aren't next to each other:

```bash
sort file | uniq         # correct dedupe
sort file | uniq -c      # dedupe WITH a count of each
sort file | uniq -d      # show only lines that were duplicated
```

The `sort | uniq -c | sort -rn` chain (count occurrences, then rank) is one of the most-used pipelines in ops.

### Q10. Explain wc and tr with examples.

**`wc`** (word count) counts lines/words/bytes:

```bash
wc -l file        # number of lines (the common one)
wc -w file        # words
wc -c file        # bytes;  wc -m for characters
grep error log | wc -l    # how many error lines (though grep -c is better)
```

**`tr`** (translate) maps or deletes characters — it works on the *stream*, not files (stdin only):

```bash
tr 'a-z' 'A-Z' < file        # uppercase everything
tr -d '\r' < dosfile         # delete carriage returns (fix CRLF)
tr -s ' ' < file             # squeeze runs of spaces into one
echo "$PATH" | tr ':' '\n'   # split PATH onto separate lines
tr -cd '[:alnum:]' < file    # delete everything that's NOT alphanumeric
```

`tr -s` (squeeze) is handy to normalise messy whitespace before `cut`; `tr -d '\r'` is the classic CRLF fix.

### Q11. What does `tail -f` do, and how is it different from head/tail?

`head` prints the *start* of a file, `tail` the *end*:

```bash
head file           # first 10 lines
head -n 20 file     # first 20
tail file           # last 10 lines
tail -n 50 file     # last 50
tail -n +100 file   # from line 100 to the end
```

**`tail -f`** (follow) is the important one: it prints the end of the file and then **keeps the file open, streaming new lines as they're appended** — the standard way to watch a live log:

```bash
tail -f /var/log/nginx/access.log
tail -f app.log | grep -i error     # live-filter for errors
tail -F app.log                     # -F also handles log rotation (reopens the file)
```

Use `-F` (capital) over `-f` for rotated logs — it re-opens the path when logrotate moves the file, whereas `-f` keeps following the old (now deleted) inode. For systemd services, `journalctl -u svc -f` is the equivalent.

### Q12. Explain the find command and its most useful expressions.

`find` walks a directory tree and tests each entry, then acts:

```bash
find /var/log -name '*.log'          # by name (glob, quote it!)
find . -iname '*.JPG'                # case-insensitive name
find . -type f                       # only files (d=dir, l=symlink)
find . -type f -mtime -7             # modified in the last 7 days (-7 = less than)
find . -mtime +30                    # modified more than 30 days ago
find . -size +100M                   # larger than 100 MB
find . -type f -name '*.tmp' -delete # find and delete .tmp files
find /home -user alice               # owned by alice
find . -maxdepth 2 -name '*.conf'    # limit recursion depth
```

Time signs are the classic trap: `-mtime -7` = *within* 7 days, `-mtime +7` = *older than* 7 days, `-mtime 7` = exactly the 7th day back. Quote glob patterns (`-name '*.log'`) so the *shell* doesn't expand them first. `find` is the go-to for "clean up files older than N days" cron jobs.

### Q13. How do you run a command on each file found?

Two ways: `-exec` (built into find) and piping to `xargs`:

```bash
find . -name '*.log' -exec gzip {} \;      # run gzip once PER file ({}=path, \;=end)
find . -name '*.log' -exec gzip {} +       # batch: pass many files per gzip call (faster)
find . -name '*.bak' -delete               # built-in delete, no exec needed

find . -name '*.log' | xargs gzip          # pipe paths to xargs -> gzip
find . -name '*.log' -print0 | xargs -0 gzip   # NUL-safe: handles spaces/newlines
```

`-exec … \;` runs the command once per file; `-exec … +` batches many files into one invocation (much faster for large sets, like `xargs`). Prefer `-delete` over `-exec rm` for deletion (safer, no subprocess). The `-print0 | xargs -0` pattern is the space-safe idiom — see the next question.

### Q14. Why does `find … | xargs rm` break on filenames with spaces, and how do you fix it?

By default `xargs` splits its input on **whitespace** (spaces, tabs, newlines). So a file named `my report.log` arrives as **two** arguments — `my` and `report.log` — and `rm` tries to delete two nonexistent files. Worse, a maliciously named file could inject arguments.

**The fix:** use NUL (`\0`) as the separator instead of whitespace, since NUL can't appear in a filename:

```bash
find . -name '*.log' -print0 | xargs -0 rm
```

`find -print0` outputs each path terminated by a NUL byte; `xargs -0` splits on NUL. Now `my report.log` stays one argument. This `-print0`/`-0` pairing is *the* correct way to pipe filenames. Alternatives that also handle spaces: `find … -delete` (no xargs at all) or `find … -exec rm {} +`. Whenever you see `find | xargs` without `-print0`, it's a latent bug.

### Q15. What is xargs for beyond avoiding "argument list too long"?

`xargs` builds command lines from stdin. Its jobs:

- **Turn stdin into arguments** — many tools (`rm`, `cp`, `kill`) take args, not stdin; `xargs` bridges: `cat pids.txt | xargs kill`.
- **Avoid "Argument list too long"** — it batches items into multiple invocations under the OS arg-length limit, instead of one giant command line.
- **Parallelism** — `-P` runs batches concurrently: `find . -name '*.jpg' -print0 | xargs -0 -P4 -n1 convert` processes 4 images at a time.
- **Placement control** — `-I{}` puts each item at a specific spot: `ls *.txt | xargs -I{} mv {} {}.bak`.
- **One-per-line / count control** — `-n1` (one arg per command), `-d'\n'` (split on newlines only, tolerating spaces).

```bash
grep -rl 'TODO' src/ | xargs -I{} sed -i 's/TODO/DONE/' {}   # edit every file containing TODO
```

`-P` for parallelism is the underused superpower — a poor man's `parallel`.

### Q16. What does tee do?

`tee` **splits a stream**: it reads stdin and writes it to *both* a file **and** stdout, so you can save output and keep piping it:

```bash
command | tee output.log                 # see it on screen AND save to file
command | tee output.log | grep error    # save full output, but only show errors
command | tee -a output.log              # -a = append instead of overwrite
```

The killer use is **writing to a root-owned file inside a pipeline**, where redirection (`>`) fails because the *shell* (not sudo) opens the file:

```bash
echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf
```

Here `sudo tee` runs as root and opens the file, whereas `sudo echo ... > file` would try to open `file` as your user and get "Permission denied." That `sudo tee` trick is worth memorising.

### Q17. Write a one-liner for the top 10 IP addresses in an access log.

The classic ops pipeline — and a favourite interview question:

```bash
awk '{ print $1 }' access.log | sort | uniq -c | sort -rn | head -10
```

Read it left to right:

1. `awk '{print $1}'` — pull the first field (the client IP) from each log line.
2. `sort` — group identical IPs together (required so `uniq` works).
3. `uniq -c` — collapse adjacent duplicates and prefix each with its **count**.
4. `sort -rn` — sort **r**everse **n**umerically by that count (biggest first).
5. `head -10` — take the top 10.

Variations show fluency: filter first with `grep`, or count status codes instead:

```bash
grep ' 500 ' access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head
awk '{print $9}' access.log | sort | uniq -c | sort -rn      # requests per status code
awk '$9==404 {print $7}' access.log | sort | uniq -c | sort -rn | head   # top 404 URLs
```

### Q18. What's the difference between shell globbing and regex?

They *look* similar (`*`) but are completely different mechanisms:

| | Glob (shell) | Regex (grep/sed/awk) |
|---|---|---|
| Who processes it | The **shell**, before the command runs | The **tool**, on each line of input |
| What it matches | **Filenames** on disk | **Text** within lines |
| `*` means | Any run of characters (in a filename) | Zero-or-more of the *previous* char |
| `?` means | Exactly one character | Zero-or-one of the previous char |
| `[abc]` | One of a,b,c (same-ish) | One of a,b,c (character class) |
| Anchoring | Implicit (whole filename) | Explicit with `^` and `$` |

```bash
ls *.log            # glob: shell expands to matching filenames
grep 'a*b' file     # regex: "zero or more a's then a b" (matches "b", "ab", "aaab")
```

The trap: `grep *.log file` — the shell expands `*.log` into filenames *before* grep sees it, so grep uses the first as the pattern. And `ls '^foo'` won't work because the shell doesn't understand `^`. Rule: globbing is filename matching by the shell; regex is content matching inside tools. When you want a literal regex passed through, **quote it** so the shell doesn't glob it.
## Shell Scripting with Bash

### Summary

**What this topic covers**

The parts of bash that separate a script that works on your laptop from one that survives production: quoting, exit codes, conditionals, loops, functions, and the `set -euo pipefail` discipline that turns silent failure into loud failure. This topic has 17 questions. Bash is the glue of every Linux box — init snippets, CI steps, deploy hooks, cron jobs, container entrypoints — so an interviewer uses it to test whether you understand the language's traps (word-splitting, unquoted globs, subshell scoping) rather than whether you can memorise flags. The single most important skill here is knowing **when to quote** and **when to stop writing bash and reach for Python**. Everything else (arrays, `getopts`, `trap`, here-docs) is in service of writing scripts that fail safely and are readable by the next on-call engineer.

**Mental model**

Bash is a **macro-expansion language pretending to be a programming language**. Before a command runs, the shell performs a fixed sequence of expansions on the line — brace, tilde, parameter (`$var`), command substitution (`$(...)`), arithmetic (`$((...))`), then **word-splitting** and **filename (glob) expansion** — and only then executes the result. Almost every bash bug is really a surprise from that expansion pipeline: an unquoted `$var` containing a space becomes two arguments; an unquoted `*` becomes a list of files. Quoting (`"$var"`) is how you tell the shell *"treat this as one word, and do not glob it."* The second mental shift: bash "returns" via **exit codes**, not values — `0` is success, non-zero is failure, and `$?` holds the last one. Functions and `if` operate on exit codes, not booleans. Command substitution captures *stdout*; the exit code rides separately. Hold those two models — the expansion pipeline and the exit-code convention — and 90% of bash behaviour stops being surprising.

**Key terms**

- **shebang** — `#!/usr/bin/env bash` first line; picks the interpreter. `env` finds bash on `$PATH` (more portable than `/bin/bash`).
- **word-splitting** — after expansion, the shell splits unquoted results on `$IFS` (space/tab/newline) into separate words. Quoting prevents it.
- **`"$var"` vs `$var`** — double-quoted preserves the value as one word; unquoted invites word-splitting and globbing. The `#1` bug.
- **`$(...)`** — command substitution; captures a command's stdout. Prefer over legacy backticks (nestable, readable).
- **`$?`** — exit code of the last command. `$$` is PID, `$!` is last background PID, `$0` script name, `$@`/`$*` args.
- **`[ ]` vs `[[ ]]`** — `[` is the `test` builtin (POSIX); `[[` is a bash keyword with safer parsing, `&&`, `=~` regex, no word-split on unquoted vars.
- **`(( ))`** — arithmetic evaluation/context; `$(( ))` for arithmetic expansion.
- **`set -euo pipefail`** — exit on error, exit on unset variable, fail a pipeline if any stage fails. The "strict mode" preamble.
- **`trap`** — run a handler on a signal or on `EXIT`; used for cleanup (temp files, locks).
- **`getopts`** — builtin parser for short options (`-v`, `-o file`).
- **here-doc (`<<EOF`) / here-string (`<<<`)** — feed multi-line / single-line text to a command's stdin.
- **ShellCheck** — static analyser (`shellcheck script.sh`); catches quoting and portability bugs before they ship.

**Why interviewers ask this**

Bash is where sloppiness has real blast radius: a deploy script that word-splits a path can `rm -rf` the wrong directory. Junior candidates write scripts that work on the happy path and quote nothing; senior candidates default to `"$var"`, add `set -euo pipefail`, check exit codes, and clean up with `trap`. The interviewer is probing for **production instincts**: do you handle the failure case, do you know that `cmd | while read` runs in a subshell, do you know that parsing `ls` is a bug? They also want to see judgement about *scope* — a senior engineer knows bash is the wrong tool past ~100 lines of logic or any real data structure, and says so. Getting the "spot the bug" quoting question right signals you've been burned in production and learned from it.

**Common confusions**

- "Single and double quotes are interchangeable" — no. Single quotes are **literal** (no expansion at all); double quotes expand `$var`/`$(...)` but still prevent word-splitting and globbing.
- "`set -e` makes my script bulletproof" — it has many exceptions (commands in `if`/`||`/`&&` conditions, functions called in conditions, pipelines without `pipefail`). It's a helpful default, not a guarantee.
- "`[ ]` and `[[ ]]` are the same" — `[[` is safer and bash-only; `[` is a command whose arguments get word-split and globbed, so unquoted `[ $x = y ]` breaks on empty/spaced values.
- "`$*` and `$@` are the same" — only unquoted. Quoted, `"$@"` preserves each argument as a separate word; `"$*"` joins them into one string. Always use `"$@"` to forward args.
- "`cmd | while read; do X=...; done` sets X" — the `while` runs in a subshell; `X` is lost after the pipe. Use process substitution or a here-string instead.

**What follows from this topic**

Bash scripting sits on top of everything else in this primer. The quoting and word-splitting model is really about how the shell tokenises before handing off to **I/O Redirection, Pipes & File Descriptors** (the next topic) — pipes and subshells are the same subshell-scoping trap seen from another angle. Exit codes connect to **process management and signals** (`trap`, `kill`, `$?`). Reading files line-by-line, redirection inside loops, and here-docs all lean on the file-descriptor model. If quoting feels shaky, fix it first — it's the foundation the redirection topic builds on.

### Q1. Why does every script start with `#!/usr/bin/env bash` and what does the shebang actually do?

The **shebang** (`#!`) on line 1 tells the kernel which interpreter to run the file with. When you execute `./deploy.sh`, the kernel reads the first two bytes, sees `#!`, and runs the named interpreter with the script path as an argument.

`#!/usr/bin/env bash` vs `#!/bin/bash`:

- `#!/bin/bash` hardcodes the path. Fine on most Linux, but bash may live elsewhere (e.g. `/usr/local/bin/bash` on macOS/BSD, or newer bash installed alongside an old system one).
- `#!/usr/bin/env bash` asks `env` to find `bash` on `$PATH` — more portable across systems.

The trade-off: `env` ignores extra args in the shebang on many systems, and it trusts `$PATH`. For a security-sensitive script running as root, a hardcoded path is more predictable. For portable tooling, `env` wins.

If you write bash-specific syntax (`[[`, arrays, `local`), do **not** use `#!/bin/sh` — on Debian/Ubuntu `/bin/sh` is `dash`, not bash, and your `[[` will fail with a cryptic error.

### Q2. What is the difference between single quotes, double quotes, and no quotes?

| | Expansion? | Word-split / glob? | Use for |
|---|---|---|---|
| `'literal'` | None at all | No | Fixed strings, regex, `awk` bodies |
| `"$var"` | `$var`, `$(...)`, `$(( ))` | No | **Default** — almost everything |
| `$var` | Yes | **Yes** | Almost never (only when you *want* splitting) |

```bash
name="acme corp"
echo "$name"    # acme corp   (one argument)
echo $name      # acme corp   (TWO arguments — word-split on the space)
echo '$name'    # $name       (literal, no expansion)
```

The rule: **quote every variable expansion with double quotes** unless you have a specific reason not to. Unquoted `$var` is the single most common source of bash bugs — spaces, glob characters (`*`, `?`), and empty values all break.

### Q3. This deploy script deleted the wrong files. Spot the bug.

```bash
DIR=$1
rm -rf $DIR/*
```

Two bugs, both about quoting.

**Bug 1 — unquoted `$DIR`.** If the caller passes `/srv/app old` (a path with a space), `$DIR` word-splits into `/srv/app` and `old`, so `rm -rf` targets `/srv/app/*` **and** `old/*`. Worse, if `$DIR` is *empty* (caller forgot the argument), the command becomes `rm -rf /*`.

**Fix:**

```bash
set -euo pipefail
DIR="${1:?usage: deploy.sh <dir>}"   # fail loudly if $1 is unset/empty
rm -rf -- "$DIR"/*
```

`"${1:?msg}"` aborts with a message if `$1` is missing. Quoting `"$DIR"` keeps it one argument. The `--` stops `rm` from treating a path that starts with `-` as a flag. This is exactly the class of bug `set -u` and ShellCheck exist to catch.

### Q4. What is command substitution and how do you capture a command's output?

Command substitution runs a command and substitutes its **stdout** into the surrounding line:

```bash
now="$(date +%Y-%m-%d)"
count="$(grep -c ERROR /var/log/app.log)"
echo "Found $count errors on $now"
```

Use `$(...)`, not legacy backticks `` `...` `` — `$(...)` nests cleanly and is more readable. Note:

- It captures **stdout only**; stderr still goes to the terminal (redirect with `2>&1` if you want it).
- Trailing newlines are stripped.
- **Always quote** the result: `x="$(cmd)"` and use `"$x"` — otherwise the captured value word-splits.
- The exit code of the substituted command is *not* the exit code of the assignment; `x=$(false)` succeeds. Check `$?` separately or use `set -e` carefully.

### Q5. Explain exit codes and the `$?` variable.

Every command returns an **exit code**: `0` means success, `1–255` means failure (the meaning is command-specific). `$?` holds the exit code of the most recent command.

```bash
grep -q ERROR /var/log/app.log
if [ $? -eq 0 ]; then echo "errors found"; fi
```

But the idiomatic form checks the command directly — `if` operates on exit codes:

```bash
if grep -q ERROR /var/log/app.log; then
  echo "errors found"
fi
```

Conventions: `0` success; `1` general error; `2` misuse of builtins; `126` not executable; `127` command not found; `128+N` killed by signal N (so `130` = SIGINT/Ctrl-C, `137` = SIGKILL, `143` = SIGTERM). A script's own exit code is the last command's unless you `exit N` explicitly. Set meaningful codes so callers (CI, systemd) can react.

### Q6. What's the difference between `[ ]`, `[[ ]]`, and `(( ))`?

- **`[ ]`** — the POSIX `test` builtin. `[` is literally a command; its arguments are word-split and glob-expanded, so unquoted variables are dangerous. Portable to `/bin/sh`.
- **`[[ ]]`** — a bash **keyword** (not a command). No word-splitting on unquoted variables inside it, supports `&&`/`||`, pattern matching (`==`), and regex (`=~`). Prefer this in bash.
- **`(( ))`** — arithmetic context. Bare variable names (no `$`), C-style operators, and returns exit status based on the value (non-zero value → success).

```bash
[[ "$name" == web* ]]        # glob match, safe with spaces
[[ "$ip" =~ ^10\. ]]         # regex match
(( count > 10 ))             # numeric comparison
[ -f /etc/passwd ]           # POSIX file test
```

### Q7. How do you compare strings vs numbers, and what are the file-test operators?

**String comparison** (`[[ ]]` or `[ ]`): `=`/`==` (equal), `!=`, `<`/`>` (lexical), `-z "$s"` (empty), `-n "$s"` (non-empty).

**Numeric comparison**: `-eq -ne -lt -le -gt -ge` (in `[ ]`/`[[ ]]`), or C-style `> < ==` inside `(( ))`.

```bash
[[ "$env" == prod ]]      # string equal
(( retries >= 3 ))        # numeric
[ "$a" -eq "$b" ]         # numeric equal (POSIX)
```

**File tests**: `-f` (regular file), `-d` (directory), `-e` (exists), `-r/-w/-x` (readable/writable/executable), `-s` (non-empty), `-L` (symlink). Mixing them up — using `-eq` on strings or `==` on numbers — is a classic bug; `[ "10" = "10.0" ]` is false (string) but `[ 10 -eq 10 ]` on non-integers errors.

### Q8. How do you write for, while, and until loops?

```bash
# C-style / list iteration
for host in web01 web02 web03; do
  echo "checking $host"
done

for i in $(seq 1 5); do echo "$i"; done
for ((i=0; i<5; i++)); do echo "$i"; done   # arithmetic for

# while: run while condition succeeds (exit 0)
while (( retries < 3 )); do
  ((retries++))
done

# until: run until condition succeeds
until ping -c1 -W1 web01 &>/dev/null; do
  sleep 1
done
```

`while` loops while the test *succeeds*; `until` loops until it *succeeds* (i.e. while it fails). Use `until` for "wait for X to come up" polling. **Never** `for f in $(ls)` to iterate files — that word-splits on spaces and breaks; use a glob `for f in ./*` instead.

### Q9. What is the correct way to read a file line by line?

```bash
while IFS= read -r line; do
  printf '%s\n' "$line"
done < input.txt
```

The three critical pieces:

- **`IFS=`** — clears the field separator so leading/trailing whitespace is preserved.
- **`-r`** — raw mode; without it, backslashes are interpreted (mangling `\n`, Windows paths).
- **`< input.txt`** — redirect the file into the loop's stdin. Do **not** do `cat file | while read` — that pipe runs the loop in a subshell (see Q13) and reads from the pipe.

The common wrong versions — `for line in $(cat file)` (word-splits on every space, not just newlines) and dropping `-r` (eats backslashes) — corrupt data silently. The `while IFS= read -r` idiom is the one to memorise.

### Q10. How do functions work, and what's the difference between `$@`, `"$@"`, and `$*`?

```bash
log() {
  local level="$1"; shift
  printf '[%s] %s\n' "$level" "$*"
}
log INFO "starting deploy"
```

- Arguments arrive as `$1 $2 …`; `$#` is the count; `shift` drops `$1`.
- **`local`** scopes a variable to the function — always use it; unscoped variables are global and leak.
- Functions "return" via **exit code** (`return N`, 0–255), not values. To return data, `echo` it and capture with `$(...)`.

Forwarding arguments:

| Form | Behaviour |
|---|---|
| `$*` | All args, word-split (broken on spaces) |
| `$@` | All args, word-split (broken on spaces) |
| `"$*"` | All args joined into **one** string (space-separated) |
| `"$@"` | Each arg preserved as a **separate** quoted word |

**Always use `"$@"`** to pass arguments through — it's the only form that survives spaces. `"$*"` is occasionally useful for joining into a message.

### Q11. How do arrays and arithmetic work in bash?

**Arrays** (bash, not POSIX sh):

```bash
hosts=(web01 web02 web03)
echo "${hosts[0]}"        # first element
echo "${hosts[@]}"        # all elements (quote it!)
echo "${#hosts[@]}"       # length
hosts+=(web04)            # append
for h in "${hosts[@]}"; do echo "$h"; done
```

Always use `"${arr[@]}"` (quoted, `@`) to iterate — `${arr[*]}` joins into one word. Associative arrays: `declare -A m; m[key]=value`.

**Arithmetic**:

```bash
(( total = a + b ))       # arithmetic command
result=$(( a * 2 + 1 ))   # arithmetic expansion
(( count++ ))
```

No `$` needed on variable names inside `(( ))`. Bash does **integer-only** math — for floating point you need `bc` or `awk`. That integer limitation is one more reason to reach for Python when the logic gets numeric.

### Q12. What does `set -euo pipefail` do, and what are its pitfalls?

The "strict mode" preamble. Each flag:

- **`-e`** (`errexit`) — exit immediately if any command returns non-zero (with exceptions).
- **`-u`** (`nounset`) — error on referencing an unset variable (catches typos like `"$hostname"` vs `"$host_name"`).
- **`-o pipefail`** — a pipeline's exit code is the **rightmost non-zero**, not just the last command's. Without it, `grep foo file | sort` reports success even if `grep` found nothing / errored.

```bash
set -euo pipefail
IFS=$'\n\t'   # optional: safer word-splitting
```

**Pitfalls** — `-e` is deceptively leaky:

- Commands in `if`, `while`, `||`, `&&` conditions are exempt (by design).
- A function that fails inside a condition doesn't trigger exit.
- `x=$(cmd)` where `cmd` fails doesn't always exit under `-e`.
- `-u` breaks on `"${1:-}"`-style optional args unless you provide defaults.

It's a strong default that catches whole classes of bugs, but treat it as a seatbelt, not an airbag — you still check critical commands explicitly.

### Q13. Why does `cat file | while read line; do count=$((count+1)); done` leave `count` at 0?

Because **each stage of a pipeline runs in its own subshell**. The `while` loop on the right of the `|` executes in a child process; `count` is incremented in that child, and when the pipeline ends the child dies, taking its variables with it. The parent's `count` is untouched.

**Fixes** — avoid the pipe so the loop runs in the current shell:

```bash
# Redirect instead of pipe
while read -r line; do ((count++)); done < file

# Process substitution
while read -r line; do ((count++)); done < <(some_command)

# Or use lastpipe (bash 4.2+, non-interactive)
shopt -s lastpipe
some_command | while read -r line; do ((count++)); done
```

This is the single most common "why is my variable empty after the loop?" bug, and it's the same subshell trap that shows up throughout the pipes/redirection topic.

### Q14. What is `trap` and how do you use it for cleanup?

`trap` registers a handler to run when the shell receives a signal or hits a pseudo-signal like `EXIT`. It's how you guarantee cleanup — removing temp files, releasing locks — no matter how the script exits.

```bash
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT          # runs on any exit: normal, error, or signal

trap 'echo "interrupted"; exit 130' INT TERM   # handle Ctrl-C / SIGTERM
```

`EXIT` fires on **every** exit path — normal completion, `exit`, `set -e` abort, or a caught signal — which makes it the right place for cleanup. Combine with `set -e`: even if a command mid-script fails and triggers exit, the trap still runs and removes the temp dir. For lock files, `trap 'rm -f "$lockfile"' EXIT` prevents stale locks after a crash.

### Q15. How do you parse command-line options — positional params vs `getopts`?

For a couple of positional args, use `$1 $2` with defaults and validation:

```bash
env="${1:?usage: deploy <env> [tag]}"
tag="${2:-latest}"
```

For flags (`-v`, `-o file`), use the `getopts` builtin — it handles bundling (`-vf`) and option-arguments:

```bash
verbose=0; output=""
while getopts ":vo:h" opt; do
  case "$opt" in
    v) verbose=1 ;;
    o) output="$OPTARG" ;;
    h) usage; exit 0 ;;
    \?) echo "unknown: -$OPTARG" >&2; exit 2 ;;
  esac
done
shift $((OPTIND - 1))   # drop parsed options, leaving positional args
```

The trailing `:` in `o:` means "takes an argument" (in `$OPTARG`); a leading `:` enables silent error handling. `getopts` only does **short** options — for `--long` flags you either parse manually with a `case` in a `while`, or (the honest answer) switch to Python's `argparse`.

### Q16. What are here-docs, here-strings, and case statements?

**Here-doc** — feed a multi-line block to a command's stdin:

```bash
cat > /etc/app/config.yaml <<EOF
env: $ENV
port: 8080
EOF
```

`<<EOF` expands variables inside the block; **`<<'EOF'`** (quoted delimiter) makes it literal — no expansion. `<<-EOF` strips leading **tabs** so you can indent the block.

**Here-string** — feed a single string to stdin: `grep foo <<< "$var"`. Handy to avoid `echo "$var" | grep` (and its subshell).

**Case statement** — cleaner than an `if/elif` ladder for matching one value against patterns:

```bash
case "$env" in
  prod|production) deploy_prod ;;
  staging)         deploy_staging ;;
  dev|*)           deploy_dev ;;
esac
```

Patterns are globs (`web*`, `*.log`), `|` is OR, `*)` is the default. Each branch ends with `;;`.

### Q17. When is bash the wrong tool, and what is ShellCheck?

**Reach for Python (or Go) when** you hit any of: real data structures (nested maps, JSON — parsing JSON in bash is a war crime; use `jq` at most), floating-point math, string manipulation beyond trivial `${var//x/y}`, error handling that needs stack context, anything over ~100 lines, or logic a teammate has to maintain. Bash excels at *orchestrating other programs* — pipe `grep` into `sort` into `awk`, call `curl`, wire up systemd. The moment you're writing algorithms *in* bash rather than gluing tools *with* bash, you've picked the wrong tool. A senior engineer states this explicitly in an interview.

**ShellCheck** (`shellcheck script.sh`) is a static analyser that catches the bugs this whole topic is about: unquoted variables (SC2086), `for f in $(ls)` (SC2045), useless `cat` (SC2002), unhandled `cd` failures, and dozens more. Run it in CI and in your editor. It won't make bash the right tool, but it makes the bash you do write far safer — treating its warnings as errors is the mark of a team that's been burned.

## I/O Redirection, Pipes & File Descriptors

### Summary

**What this topic covers**

How data flows into, out of, and between Linux programs: the three standard streams, redirection operators, pipes, and the file-descriptor mechanics underneath them. This topic has 15 questions. This is the machinery behind every command line you've ever typed — `cmd > file`, `a | b`, `2>&1` — and it's where a lot of "why did that not work?" confusion lives. The headline traps are **order-sensitivity** (`>file 2>&1` vs `2>&1 >file` do different things), the fact that **stderr is not piped by default**, and that **pipelines run in subshells** (the same variable-scoping bug from the bash topic, seen through the redirection lens). Master file descriptors and you understand not just redirection but how the shell, containers, logging, and `tee`/`xargs`/process-substitution tricks all work.

**Mental model**

Every process is born with three open **file descriptors** (FDs) — small integers indexing its open files: **0 = stdin**, **1 = stdout**, **2 = stderr**. By default all three point at your terminal. Redirection is just **reassigning where an FD points** before the program runs: `> file` makes FD 1 point at `file`; `2> err` makes FD 2 point at `err`. The program itself doesn't know or care — it still writes to "FD 1", the shell has just rewired the other end. A **pipe** connects FD 1 of the left process to FD 0 of the right process through an in-kernel buffer — data flows without touching disk. The crucial subtlety: `2>&1` means "make FD 2 a **copy of wherever FD 1 currently points**" — it's evaluated left to right, at that instant, which is why order matters. Hold that one idea — *redirections are FD reassignments applied left-to-right* — and the confusing cases (`2>&1` before vs after `>file`) become mechanical rather than mysterious.

**Key terms**

- **stdin (0)** — standard input; where a program reads. Default: keyboard/terminal.
- **stdout (1)** — standard output; normal program output. Default: terminal.
- **stderr (2)** — standard error; diagnostics/errors, kept separate so they don't pollute piped data.
- **`>` / `>>`** — redirect stdout: `>` truncates (overwrites), `>>` appends.
- **`<`** — redirect stdin from a file.
- **`2>` / `2>&1`** — redirect stderr to a file / to wherever stdout currently points.
- **`&>` / `&>>`** — bash shorthand for "both stdout and stderr" to a file.
- **`/dev/null`** — the bit bucket; discards anything written, returns EOF on read.
- **pipe (`|`)** — connects one command's stdout to the next's stdin via a kernel buffer.
- **`tee`** — reads stdin, writes to both stdout **and** one or more files (a T-junction).
- **process substitution (`<(cmd)`, `>(cmd)`)** — presents a command's I/O as a filename (`/dev/fd/N`).
- **here-doc (`<<`) / here-string (`<<<`)** — inline multi-line / single-line stdin.
- **FIFO / named pipe** — a persistent pipe on the filesystem, created with `mkfifo`.

**Why interviewers ask this**

Redirection is a daily tool, and getting it subtly wrong causes real incidents: logs that silently go nowhere, errors swallowed because stderr wasn't captured, a `cmd | while read` loop that mysteriously loses state. An interviewer asks the classic **"what's the difference between `>file 2>&1` and `2>&1 >file`?"** because it cleanly separates people who memorised incantations from people who understand FDs are reassigned left-to-right. Senior signal: you know stderr isn't piped by default, you reach for `tee` to log-and-see, you know `2>/dev/null` is how you silence noise, and you can debug "output appears late" as a **buffering** problem, not a hang. This topic also underpins container logging (stdout/stderr are what Docker/journald capture) and CI (where merging streams correctly determines whether a failure is even visible).

**Common confusions**

- "`2>&1 >file` sends errors to the file too" — no. Order matters: at the time `2>&1` runs, FD 1 still points at the terminal, so stderr goes to the terminal and only stdout goes to the file.
- "Pipes carry errors too" — `|` connects only **stdout** to the next command; stderr still goes to the terminal unless you redirect it (`2>&1 |` or `|&`).
- "`>` and `>>` are basically the same" — `>` **truncates** the file to zero first; `>>` appends. Using `>` in a loop wipes previous iterations.
- "`cmd > file` then reading `file` in the same pipeline works" — the shell sets up all redirections before running; you can't read a file you're truncating in the same line.
- "My command hung" — often it's **block buffering**: output through a pipe is buffered in 4–8KB chunks and only flushes at the end. It's slow to appear, not hung. `stdbuf`/`--line-buffered` fixes it.

**What follows from this topic**

This is the mechanical underpinning of the **Shell Scripting** topic — the subshell/variable-scoping trap (`cmd | while read`) is a pipe consequence, and here-docs/here-strings appear in both. It connects forward to **process management** (a pipeline is multiple processes; each has its own FDs), to **logging & journald** (systemd captures a service's stdout/stderr), and to **containers** (Docker's log driver reads FD 1 and 2 of PID 1). Understanding FDs also demystifies `lsof`, `/proc/<pid>/fd/`, and "too many open files" (FD-limit) errors you'll debug later.

### Q1. What are the three standard streams and their file descriptor numbers?

Every process starts with three open file descriptors:

- **FD 0 — stdin** — where the program reads input. Default: the terminal (keyboard).
- **FD 1 — stdout** — where normal output goes. Default: the terminal.
- **FD 2 — stderr** — where errors and diagnostics go. Default: the terminal.

The key design decision is **separating stdout from stderr**. It means you can pipe a program's real output to the next command while its error messages still reach your screen — `grep pattern file | sort` sorts the matches, but if `grep` can't open the file, that error shows up on the terminal rather than getting fed into `sort`. It also lets you capture data and diagnostics to different destinations: `cmd > data.txt 2> errors.log`. You can see a running process's FDs at `/proc/<pid>/fd/`.

### Q2. Explain `>`, `>>`, and `<`.

- **`>`** — redirect stdout to a file, **truncating** it first (creates it if absent, wipes it if present). `echo hi > out.txt` replaces out.txt's contents.
- **`>>`** — redirect stdout to a file, **appending**. `echo hi >> log.txt` adds to the end.
- **`<`** — redirect stdin **from** a file. `sort < unsorted.txt` feeds the file into sort's stdin.

```bash
date > /tmp/stamp        # overwrite
date >> /tmp/history     # append
wc -l < access.log       # read file as stdin (no filename arg passed to wc)
```

The `>` vs `>>` distinction bites in loops: `for h in a b c; do check "$h" > report; done` leaves only `c`'s output because each iteration truncates. Use `>>` (and truncate once before the loop) to accumulate. Note `< file` differs subtly from passing the filename: `wc -l < f` reads stdin so it prints just the number, no filename.

### Q3. How do you redirect stderr, and why does the order of `2>&1` matter?

`2>` redirects stderr to a file. `2>&1` means **"make FD 2 point to wherever FD 1 currently points."** Because redirections are applied **left to right**, order is everything:

```bash
cmd >file 2>&1     # FD1 → file, THEN FD2 → (copy of FD1) → file.  Both in file. ✅
cmd 2>&1 >file     # FD2 → (copy of FD1 = terminal), THEN FD1 → file.
                   # stderr → terminal, stdout → file. ✅ (probably NOT what you wanted)
```

Read `2>&1` as "2 becomes a **duplicate of 1 as it stands right now**," not "2 follows 1 forever." In the second line, at the moment `2>&1` executes, FD 1 still points at the terminal, so stderr is bound to the terminal; the later `>file` only moves stdout. This is the single most-asked redirection interview question, and the answer is always: *redirections evaluate left-to-right, and `2>&1` copies the current target.*

### Q4. What does `&>` do, and how do you discard output with `/dev/null`?

**`&>file`** (and `&>>file` to append) is bash shorthand for **`>file 2>&1`** — send both stdout and stderr to one file, order-safe:

```bash
cmd &> combined.log        # both streams → file (bash)
cmd > combined.log 2>&1    # portable equivalent
```

**`/dev/null`** is the "bit bucket" — a special device that discards everything written to it and returns EOF immediately on read. Uses:

```bash
cmd 2>/dev/null            # silence errors only
cmd > /dev/null            # discard normal output, keep errors
cmd &>/dev/null            # discard everything (just want the exit code)
cmd < /dev/null            # give a command empty stdin (won't block waiting)
```

`&>/dev/null` is the idiom for "run this, I only care whether it succeeded" — common in `if command -v foo &>/dev/null; then`. Feeding `/dev/null` as stdin (`< /dev/null`) stops a backgrounded command from blocking on input.

### Q5. How do pipes work, and why isn't stderr piped by default?

A pipe (`|`) connects the **stdout** of the left command to the **stdin** of the right command through an in-kernel buffer — no temp file, data streams as it's produced:

```bash
grep ERROR app.log | sort | uniq -c | sort -rn
```

The kernel creates a pipe (a pair of FDs), points the left process's FD 1 at the write end and the right process's FD 0 at the read end, and runs both **concurrently**. If the reader is slow, the writer blocks when the pipe buffer (typically 64KB) fills — natural backpressure.

**stderr isn't piped** because a pipe only rewires FD 1. FD 2 still points at the terminal. This is deliberate: you want the *data* to flow down the pipeline while *errors* remain visible rather than being fed as bogus input to the next stage. To include stderr in the pipe: `cmd 2>&1 | next` (or bash's `cmd |& next`).

### Q6. Why does a variable set inside `cmd | while read ...` disappear afterward?

Because **every stage of a pipeline runs in a separate subshell (child process)**. The `while` loop on the right of the `|` runs in a child; any variable it sets lives and dies in that child. When the pipeline finishes, the child exits and the parent shell never sees the change.

```bash
count=0
grep -c . file | while read -r n; do count=$n; done
echo "$count"    # still 0 — the assignment happened in a subshell
```

Fixes — remove the pipe so the loop runs in the current shell:

```bash
while read -r n; do count=$n; done < <(grep -c . file)   # process substitution
while read -r n; do count=$n; done <<< "$(grep -c . file)"  # here-string
shopt -s lastpipe                                         # bash: run last stage in current shell
```

This is the same subshell trap as in the bash topic — worth recognising from both directions because it's one of the most common real-world bash bugs.

### Q7. What is `pipefail` and why does a pipeline sometimes report success when a stage failed?

A pipeline's exit code is, by default, the exit code of the **last** command only. So if an early stage fails, the pipeline can still report success:

```bash
grep ERROR missing.log | sort
echo $?    # 0 — because sort succeeded, even though grep errored on a missing file
```

`set -o pipefail` changes this: the pipeline returns the exit code of the **rightmost command that failed** (non-zero), or 0 if all succeed. Combined with `set -e`, this makes a failing early stage actually abort the script:

```bash
set -o pipefail
grep ERROR missing.log | sort    # now exits non-zero
```

This matters enormously in CI and deploy scripts — without `pipefail`, `curl ... | tar x` silently "succeeds" even when `curl` 404s and pipes an empty/HTML body into `tar`. Always set `pipefail` in production scripts.

### Q8. What does `tee` do and when do you use it?

`tee` reads stdin and writes it to **both** stdout **and** one or more files — a T-junction in the pipe. It lets you save a stream to a file while still seeing it (or piping it onward):

```bash
make 2>&1 | tee build.log            # watch the build AND save it
cmd | tee out.txt | grep ERROR       # log everything, but only show errors
echo "hello" | sudo tee /etc/motd    # write to a root-owned file via a pipe
tee -a log.txt                       # -a appends instead of truncating
```

The `sudo tee` trick is important: `sudo cmd > /root/file` **doesn't work** because the shell opens the redirect *as your user* before `sudo` runs. `... | sudo tee /root/file` runs the file-writing part (`tee`) under sudo, so it has permission. `tee` is the standard answer to "how do I log this and see it at the same time?"

### Q9. What is process substitution and how does it differ from a pipe?

Process substitution lets you use a **command's output (or input) as if it were a filename**. Bash implements it via `/dev/fd/N`:

- **`<(cmd)`** — cmd's stdout appears as a readable file.
- **`>(cmd)`** — a writable file that feeds cmd's stdin.

```bash
diff <(sort a.txt) <(sort b.txt)     # diff two commands' outputs — impossible with a plain pipe
comm -23 <(sort listA) <(sort listB)
while read -r x; do ...; done < <(generate)   # avoids the subshell variable bug
tar cz app | tee >(sha256sum > app.sha) > app.tgz   # branch a stream
```

The difference from a pipe: a pipe (`|`) connects exactly **two** commands, stdout→stdin, single file. Process substitution gives you a **filename** you can hand to any command that expects file arguments — enabling multiple inputs (`diff <(...) <(...)`), and letting the consumer loop run in the current shell (so `while read < <(cmd)` avoids the subshell scoping trap).

### Q10. Explain here-docs and here-strings.

Both feed text into a command's **stdin** inline, without a separate file.

**Here-doc** (`<<`) — multi-line block, terminated by a delimiter:

```bash
mysql <<EOF
USE app;
UPDATE users SET active=1 WHERE env='prod';
EOF
```

- `<<EOF` **expands** `$variables` and `$(cmd)` inside the block.
- `<<'EOF'` (quoted delimiter) treats the block **literally** — no expansion (use for scripts, config with `$` in it).
- `<<-EOF` strips leading **tab** characters, letting you indent the heredoc inside a function.

**Here-string** (`<<<`) — a single line/string to stdin:

```bash
grep -i error <<< "$log_line"
bc <<< "2 + 2"
read -r a b c <<< "$line"      # split a string into variables
```

Here-strings are the clean way to feed one variable to a command without `echo "$x" |` (which spawns a subshell and an extra process).

### Q11. What are named pipes (FIFOs) and when would you use one?

A **named pipe** (FIFO) is a pipe that exists as a **file on the filesystem**, created with `mkfifo`. Unlike an anonymous `|` pipe (which lives only for one command line), a FIFO persists and lets **unrelated processes** — started separately, even by different users — connect to it by path.

```bash
mkfifo /tmp/mypipe
gzip -c < /tmp/mypipe > out.gz &   # reader waits (blocks) for a writer
echo "some data" > /tmp/mypipe     # writer; unblocks the reader
```

Behaviour: opening a FIFO for writing **blocks** until a reader opens it (and vice versa) — it's a rendezvous point. No data is stored on disk; the file is just a named connection. Uses: streaming between processes without a temp file (e.g. feeding a backup to a compressor/uploader), simple IPC in shell, or connecting a producer and consumer that can't share an anonymous pipe. Clean it up with `rm` when done.

### Q12. What are custom file descriptors and what does `exec 3>` do?

Beyond 0/1/2, a process can open **additional** file descriptors (3, 4, …). `exec` **without a command** applies redirections to the **current shell** permanently, so `exec 3> file` opens FD 3 for the rest of the script:

```bash
exec 3> /tmp/debug.log     # open FD 3 for writing
echo "step 1 done" >&3     # write to FD 3 without repeating the filename
echo "normal output"       # still goes to stdout
exec 3>&-                  # close FD 3
```

This is useful for a dedicated log/side-channel: you open the log once, then write to `>&3` throughout, keeping stdout clean for the program's real output. `exec 3<>file` opens FD 3 for **both** read and write (used for sockets and FIFOs). `exec 3>&-` closes it. A common pattern is saving the original stdout before redirecting: `exec 3>&1; exec 1>log; ...; exec 1>&3` to restore. Custom FDs are how scripts multiplex several output streams without temp files.

### Q13. My command's output appears all at once at the end, or seems to hang. Why?

Almost always **buffering**, not a hang. The C standard library changes buffering based on where stdout points:

- **Terminal** → **line-buffered**: flushes on every newline (you see output live).
- **Pipe or file** → **block-buffered**: buffers ~4–8KB and only flushes when full or on exit.

So `long_running_cmd | grep foo` may show nothing for a long time even though `long_running_cmd` is printing — its output is sitting in a block buffer because it's writing to a pipe, not a terminal. It's delayed, not stuck.

Fixes to force line buffering through a pipe:

```bash
stdbuf -oL long_running_cmd | grep foo      # force line-buffered stdout
grep --line-buffered foo                     # many tools have their own flag
unbuffer long_running_cmd | ...              # from expect package (fakes a tty)
```

Recognising "output batches at the end" as a buffering artefact — rather than assuming the program is broken — is a strong senior signal.

### Q14. How does `xargs` work, and how does it relate to pipes?

A pipe feeds data to a command's **stdin**, but many commands (`rm`, `cp`, `mkdir`, `kill`) take their targets as **command-line arguments**, not stdin. `xargs` bridges the gap: it reads items from stdin and turns them into arguments for a command.

```bash
find . -name '*.tmp' | xargs rm            # rm gets filenames as ARGS
cat hosts.txt | xargs -n1 ping -c1         # one host per invocation
find . -name '*.log' -print0 | xargs -0 rm # NUL-separated: safe for spaces/newlines
git branch --merged | xargs -r git branch -d   # -r: don't run if input is empty
ls *.jpg | xargs -P4 -n1 convert ...       # -P4: run 4 in parallel
```

Key flags: **`-0`** with `find -print0` handles filenames with spaces/newlines (the safe idiom); **`-n1`** one argument per run; **`-I{}`** places the argument at a specific spot (`xargs -I{} mv {} /dest/`); **`-P`** parallelism; **`-r`** skips execution on empty input. `xargs` is the answer to "the pipe gives me a list, but the command wants arguments."

### Q15. How do you apply a redirection to a whole block or an entire script?

You can redirect a **group of commands** at once, so you don't repeat the redirection on every line.

**Command group `{ }`** (runs in the *current* shell) or subshell `( )`:

```bash
{
  echo "== report =="
  date
  df -h
} > report.txt 2>&1          # all three commands' output → report.txt
```

**`exec` for the whole script** — redirect the script's own stdout/stderr from a point onward:

```bash
#!/usr/bin/env bash
exec >> /var/log/deploy.log 2>&1   # everything after this line is logged
echo "deploy started at $(date)"    # goes to the log, not the terminal
```

`exec >file 2>&1` with no command reassigns the running shell's FDs, so every subsequent command inherits them — the standard way a daemon or cron script sends all its output to a log file. Use `{ ...; } >file` for a section, `exec` for "from here to the end." Note `{ }` needs the spaces and trailing semicolon; `( )` does the same but in a subshell (variable changes won't escape).

## Memory & Swap

### Summary

**What this topic covers**

How Linux manages RAM, swap, the page cache, and what happens when memory runs out. This topic has 15 questions. It's where the most persistent production myth lives — *"the server is out of memory, `free` shows almost nothing free!"* — which is usually wrong, because Linux deliberately uses "free" RAM as **cache**. The real skills here are reading `free -h` correctly (the **available** column, not **free**), understanding virtual vs resident memory (VSZ vs RSS), knowing how the **OOM killer** picks a victim and where it leaves evidence, and diagnosing genuine memory pressure vs healthy caching. For SRE/DevOps this is daily bread: capacity planning, sizing containers, reading `cgroup` limits, and explaining why a pod got OOM-killed at 2am.

**Mental model**

Linux treats RAM as a resource to **use, not hoard**. Any RAM not needed by processes is spent on the **page cache** — copies of recently-read files — because idle RAM is wasted RAM; cached pages make the next read instant and are instantly **reclaimable** the moment a process needs the memory. This is why a healthy server shows very little "free" memory and that's *correct*. Second, every process sees a private **virtual address space** far larger than physical RAM; the kernel maps virtual pages to physical **page frames** on demand (demand paging), and unmaps/evicts them under pressure. **RSS** (resident) is how much of a process is actually in RAM right now; **VSZ** (virtual) is how much it has *mapped*, most of which may never be resident. When physical RAM plus swap genuinely can't satisfy demand, the kernel's last resort is the **OOM killer**, which sacrifices a process to save the system. The mental shift interviewers look for: *"used + cached ≈ everything, and that's fine — I look at **available**, not **free**, and I distinguish a leak (RSS climbing without bound) from cache (reclaimable)."*

**Key terms**

- **Virtual memory (VSZ)** — total address space a process has mapped; can vastly exceed RAM. Mostly not resident.
- **Resident memory (RSS)** — the portion actually in physical RAM now. What "costs" real memory.
- **Page cache** — RAM holding cached file contents; reclaimable; the reason `free` shows little free.
- **`free` vs `available`** — `free` = truly unused RAM; **`available`** = free + reclaimable cache = what a new app can actually get. Use available.
- **buff/cache** — buffers + page cache; reclaimable memory shown by `free`.
- **Swap** — disk space used to hold pages evicted from RAM under pressure; extends capacity but is orders of magnitude slower.
- **swappiness** — `vm.swappiness` (0–100/200); tunes the kernel's eagerness to swap anonymous pages vs drop cache.
- **OOM killer** — kernel routine that kills a process when memory (and swap) is exhausted; picks by `oom_score`.
- **oom_score / oom_score_adj** — per-process badness rating; `oom_score_adj` (-1000..1000) biases which process dies.
- **anonymous memory** — process memory not backed by a file (heap, stack); can only go to swap, not be dropped.
- **overcommit** — kernel lets processes allocate more virtual memory than RAM+swap (`vm.overcommit_memory`).
- **kswapd** — kernel daemon that reclaims pages in the background as free memory drops below watermarks.

**Why interviewers ask this**

Memory is where confident-sounding wrong answers get exposed. A junior sees `free` reporting 200MB free out of 32GB and panics or adds RAM; a senior looks at **available**, sees 26GB reclaimable cache, and correctly says the box is fine. The OOM killer is a favourite because it forces you to reason about the kernel's behaviour under stress: how does it choose a victim, where's the evidence (`dmesg`, journald), and how do you bias it (`oom_score_adj`)? In the container era this is even sharper — a process can be OOM-killed by its **cgroup memory limit** while the host has plenty of RAM, and diagnosing that requires knowing where cgroup limits live. The interviewer wants to know you won't misdiagnose healthy caching as a leak, won't set swappiness by cargo cult, and can produce evidence when a service dies mysteriously.

**Common confusions**

- "`free` shows no free memory → the server is out of memory" — the **#1 myth**. Cached memory is reclaimable; look at the **available** column. Little free + lots available = healthy.
- "Swap is bad, disable it" — some swap is healthy; it lets the kernel evict truly-idle anonymous pages to keep more cache. *Thrashing* (constant swap in/out) is bad; having swap is not.
- "High RSS = memory leak" — not necessarily; a leak is RSS climbing **without bound** over time. Steady high RSS is just a big working set.
- "The OOM killer kills the process that asked for the memory" — no; it kills the process with the highest badness (`oom_score`), often a *different*, large process.
- "swappiness=0 disables swap" — it strongly discourages swapping anonymous pages but doesn't disable swap; the kernel may still swap to avoid OOM. `swapoff` disables it.
- "A container OOM means the host is out of RAM" — often it's the container's **cgroup limit**, not the host. Check `memory.max`/`memory.current`.

**What follows from this topic**

Memory ties directly to **process management** (RSS/VSZ come from `ps`/`top`, OOM kills are signals — SIGKILL, exit 137), to **performance troubleshooting** (memory pressure shows up as swap I/O in `vmstat`, and as `D`-state processes stuck in reclaim), and to **containers & cgroups** (memory limits and OOM are cgroup features; a pod's OOMKilled status comes from here). Swap I/O also connects to the **disk & filesystems** topic — a swapping box looks like a disk-bound box in `iostat`. If you can read `free -h` correctly and explain an OOM kill with evidence, you can debug the majority of "the server ran out of memory" pages you'll get on call.

### Q1. What is the difference between virtual memory and resident memory (VSZ vs RSS)?

Every process has a **virtual address space** — a private map of addresses the CPU's MMU translates to physical RAM. Not all of it lives in RAM at once.

- **VSZ (Virtual Size)** — the **total** address space the process has mapped: code, heap, stack, shared libraries, memory-mapped files, even memory it reserved but never touched. It can be huge and largely fictional — mapping isn't the same as using.
- **RSS (Resident Set Size)** — the portion actually **resident in physical RAM** right now. This is the memory that genuinely costs you.

```bash
ps -eo pid,comm,vsz,rss --sort=-rss | head
```

A JVM might show VSZ of 12GB but RSS of 2GB — it *reserved* a large heap address range but only *touched* 2GB. When capacity planning, **sum RSS, not VSZ** (with the caveat that RSS double-counts shared library pages across processes — `smem`'s PSS metric corrects for that). VSZ matters mainly for address-space limits; RSS matters for "will this fit in RAM."

### Q2. Why does `free` show almost no free memory but the server runs fine?

Because Linux **uses spare RAM as page cache** — it caches file contents in otherwise-idle memory so future reads are instant. This cache is **reclaimable**: the instant a process needs memory, the kernel drops cached pages (they're just copies of on-disk data) and hands the RAM over. So on a healthy box, "free" trends toward zero because the kernel spent that RAM on cache. **This is optimal behaviour, not a problem** — idle RAM is wasted RAM.

The number that matters is **available**, not **free**. `available` estimates how much memory a new application could get *without swapping* — it's free memory *plus* reclaimable cache.

```
$ free -h
               total   used   free   shared  buff/cache   available
Mem:            32Gi   5Gi    400Mi   200Mi    26Gi         26Gi
```

Here `free` is 400Mi (scary if you don't know better) but `available` is 26Gi (the box is fine). Misreading this is the single most common memory misdiagnosis in ops.

### Q3. Walk me through the columns of `free -h`.

```
               total   used   free   shared  buff/cache   available
Mem:            32Gi   5Gi    400Mi   200Mi    26Gi         26Gi
Swap:          4.0Gi   0.5Gi  3.5Gi
```

- **total** — total physical RAM the kernel manages.
- **used** — memory in active use by processes (roughly total − free − buff/cache), excluding reclaimable cache.
- **free** — truly unused, not backing anything. On a healthy busy server this is **small** and that's fine.
- **shared** — memory shared between processes (tmpfs, shared memory segments).
- **buff/cache** — buffers + page cache: file data cached in RAM. **Reclaimable.**
- **available** — the important one: an estimate of how much a new process can allocate without swapping = free + most of buff/cache.

Rule of thumb: judge memory health by **available**. If available is large, you're fine regardless of how small free is. If available is near zero *and* swap is filling, that's real pressure. The Swap line shows swap total/used/free the same way.

### Q4. What is swap and how does swappiness control it?

**Swap** is disk space (a swap partition or swapfile) the kernel uses to hold pages evicted from RAM when memory is tight. It extends effective capacity, but disk is ~1000× slower than RAM, so swapped-out memory is slow to access.

**`vm.swappiness`** (0–100, up to 200 on newer kernels; default 60) tunes how aggressively the kernel swaps out **anonymous** pages (heap/stack) versus reclaiming **page cache**:

- **High swappiness** — more willing to swap anon pages out to keep file cache. Good for file-serving workloads.
- **Low swappiness** (e.g. 10) — prefers to drop cache and keep process memory in RAM. Common for databases that want their working set resident.
- **swappiness=0** — strongly discourages swapping anon pages, but does **not** disable swap; the kernel will still swap to avoid OOM.

```bash
sysctl vm.swappiness              # read
sysctl -w vm.swappiness=10        # set (persist in /etc/sysctl.d/)
```

Having swap is healthy — it lets the kernel evict genuinely idle memory. **Thrashing** (constant swap-in/out because the working set exceeds RAM) is the bad state; that shows as high `si`/`so` in `vmstat` and disk-bound behaviour.

### Q5. How does the OOM killer decide which process to kill?

When memory **and** swap are exhausted and the kernel can't reclaim enough to satisfy an allocation, it invokes the **OOM killer** as a last resort to save the system from a total lockup. It scans processes and kills the one with the highest **badness score** (`oom_score`), then that memory is freed.

The score is roughly proportional to the process's memory usage (RSS + swap + page tables) as a fraction of available memory — so it tends to kill the **biggest** memory user, which is *not* necessarily the process that triggered the allocation. That's why "my small script got a `Killed` message" often means a *different*, larger process was actually the one sacrificed — or your script grew large.

You bias the decision with **`oom_score_adj`** (range -1000 to +1000, in `/proc/<pid>/oom_score_adj`):

- `-1000` — effectively immune (never picked). Used for critical daemons like sshd.
- `+1000` — first to die.

```bash
cat /proc/<pid>/oom_score        # current badness
cat /proc/<pid>/oom_score_adj    # bias
echo -1000 > /proc/<pid>/oom_score_adj   # protect a process
```

### Q6. A process just died with no error. How do you tell if the OOM killer did it?

The OOM killer leaves clear evidence in the **kernel log**. Check `dmesg` or journald:

```bash
dmesg -T | grep -i -E 'killed process|out of memory|oom'
journalctl -k --since "1 hour ago" | grep -i oom
grep -i 'killed process' /var/log/syslog   # or /var/log/messages on RHEL
```

You'll see lines like:

```
Out of memory: Killed process 4823 (java) total-vm:8300140kB, anon-rss:6100024kB ...
oom-kill:constraint=CONSTRAINT_NONE,...,task=java,pid=4823
```

That tells you the **victim** (pid/name), its RSS at death, and whether it was a system-wide OOM (`CONSTRAINT_NONE`) or a **cgroup** OOM (`CONSTRAINT_MEMCG` — hit a container/cgroup limit, not host RAM). For containers, the orchestrator surfaces it too: `kubectl describe pod` shows `Reason: OOMKilled` and the container's last state, and `docker inspect` shows `"OOMKilled": true`. A process killed by OOM dies via **SIGKILL**, so its exit code is **137** (128 + 9) — seeing exit 137 in logs is itself an OOM tell.

### Q7. How do you distinguish a real memory leak from healthy caching?

Both can make a machine "look full," but they're different:

- **Page cache growth** is the kernel filling free RAM with file cache. It's **reclaimable** — it stops at "all RAM used," never causes OOM by itself, and shows up in **buff/cache** with a healthy **available** number. Not a leak.
- **A memory leak** is a *process's* **RSS climbing without bound** over time — anonymous memory it allocates and never frees. It's **not** reclaimable (anon memory can only go to swap), so it eventually eats swap and triggers the OOM killer.

To tell them apart, watch **per-process RSS over time**, not total system memory:

```bash
ps -eo pid,comm,rss --sort=-rss | head
watch -n5 'ps -o rss= -p <pid>'          # is THIS process growing unboundedly?
smem -tk -c 'pid name rss pss'           # PSS handles shared-memory double-counting
```

Leak signature: one process's RSS trends **monotonically up** across hours regardless of load, and won't come back down. Cache signature: buff/cache rises to fill RAM then plateaus, and drops instantly under pressure (or after `echo 1 > /proc/sys/vm/drop_caches` in a test). If available memory stays healthy and no single process's RSS is runaway, it's cache, not a leak.

### Q8. What is `/proc/meminfo` and what are the key fields?

`/proc/meminfo` is the kernel's authoritative memory breakdown — `free` and most tools parse it. Key fields:

```bash
grep -E 'MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree|Dirty|Slab' /proc/meminfo
```

- **MemTotal / MemFree** — total and truly-unused RAM.
- **MemAvailable** — the kernel's own estimate of allocatable memory (what `free`'s available column reports). Trust this.
- **Buffers / Cached** — block-device buffers and page cache (reclaimable file cache).
- **SwapTotal / SwapFree** — swap capacity and remaining.
- **Dirty** — pages modified in cache but not yet written to disk (high Dirty can indicate write-back pressure).
- **Slab** — kernel data structures (dentries, inodes); `SReclaimable` part can be reclaimed.
- **AnonPages** — anonymous (non-file-backed) process memory — heap/stack, the stuff that can only be swapped.
- **HugePages_*** — huge page pool stats.

This is the ground truth when a tool's summary is ambiguous — e.g. to confirm MemAvailable directly rather than eyeballing `free`.

### Q9. What tools do you use to investigate memory, and what does each show?

- **`free -h`** — quick system summary; read the **available** column.
- **`vmstat 1`** — memory + swap **activity** over time. The **`si`/`so`** columns (swap-in/swap-out KB/s) are the tell for thrashing; sustained non-zero = active swapping = pressure.
- **`top` / `htop`** — per-process **RES** (=RSS, real memory) and **VIRT** (=VSZ, virtual). Sort by RES (`>` in htop, `M` in top) to find memory hogs. Ignore VIRT for "who's using RAM."
- **`ps -eo pid,comm,rss,vsz --sort=-rss`** — scriptable per-process snapshot.
- **`smem`** — reports **PSS** (Proportional Set Size), which fairly splits shared-library memory across processes; the honest per-process number when many processes share libraries.
- **`/proc/<pid>/status`** — `VmRSS`, `VmSwap`, `VmHWM` (peak RSS) for a single process. `VmSwap` shows how much of *that* process is swapped out.
- **`/proc/meminfo`** — kernel ground truth.

USE-method framing: `free`/`meminfo` = **utilisation**, `vmstat si/so` = **saturation** (swapping), OOM logs = **errors**.

### Q10. What are huge pages and transparent huge pages (THP)?

Normal memory pages are **4KB**. The CPU caches virtual→physical translations in the **TLB**; with 4KB pages, a process touching many GB needs a huge number of TLB entries, and TLB misses cost performance. **Huge pages** (typically **2MB**, or 1GB "gigantic" pages) map far more memory per TLB entry, reducing misses — a big win for databases and JVMs with large heaps.

- **Explicit huge pages** — pre-allocated pool (`vm.nr_hugepages`), requested explicitly by apps (e.g. Oracle, PostgreSQL `huge_pages=on`). Reserved, not swappable.
- **Transparent Huge Pages (THP)** — the kernel automatically promotes ranges to huge pages without app changes. Convenient, but the background **khugepaged** compaction and page-fault latency can cause **latency spikes and fragmentation** — which is why databases (Redis, MongoDB, Oracle) commonly **recommend disabling THP**:

```bash
cat /sys/kernel/mm/transparent_hugepage/enabled     # [always] madvise never
echo never > /sys/kernel/mm/transparent_hugepage/enabled
```

Interview signal: knowing THP is *usually* helpful but is a well-known latency footgun for low-latency data stores is the senior take.

### Q11. What is anonymous vs file-backed memory, and why does it matter for swap?

Every page of process memory is one of two kinds:

- **File-backed** — memory that mirrors a file on disk: program code (the executable), shared libraries, `mmap`'d files. Under pressure the kernel can simply **drop** these pages (they can be re-read from the file), so they never need swap.
- **Anonymous** — memory **not** backed by any file: the heap (`malloc`), the stack, anonymous `mmap`. There's no file to re-read it from, so the *only* way to evict it is to **write it to swap**.

This is why swap matters specifically for anonymous memory. When RAM is tight, the kernel first drops clean file-backed/cache pages (cheap, no I/O). If that's not enough, it must push **anonymous** pages to swap (expensive disk write). And if there's **no swap** and anon memory can't be reclaimed, the only remaining option is the **OOM killer**. So swappiness is essentially "how eager am I to swap anon pages vs drop file cache," and a leaking process (all anon) with no swap goes straight to OOM.

### Q12. How do memory limits and OOM work inside containers (cgroups)?

Containers cap memory via **cgroups**. A container can be OOM-killed while the **host has plenty of free RAM**, because it hit *its own* cgroup limit — a completely different failure from host exhaustion.

- **cgroup v2** (modern): `memory.max` (hard limit), `memory.high` (soft throttle), `memory.current` (current usage), under `/sys/fs/cgroup/.../`.
- **cgroup v1**: `memory.limit_in_bytes`, `memory.usage_in_bytes`.

```bash
cat /sys/fs/cgroup/memory.max        # the limit (v2)
cat /sys/fs/cgroup/memory.current    # current usage
```

When a cgroup's usage hits `memory.max` and reclaim fails, the kernel runs a **cgroup-scoped OOM kill** — it kills a process *inside that cgroup*, logged as `constraint=CONSTRAINT_MEMCG` in dmesg. Kubernetes surfaces this as **`OOMKilled`** with exit **137**; the pod's memory `limit` becomes `memory.max`. Classic gotcha: the **JVM/Node before container-awareness** would read the *host's* total RAM (not the cgroup limit) and size its heap too large, then get OOM-killed — fixed by container-aware runtimes or explicit `-Xmx`/`--max-old-space-size`. Diagnosing "my pod keeps dying" starts with: is it the cgroup limit (`memory.current` near `memory.max`) or the host?

### Q13. The monitoring says "server ran out of memory." How do you diagnose it?

Work from symptom to root cause, USE-style:

1. **Confirm it's real.** `free -h` — is **available** genuinely near zero, or just **free**? Low free + high available = healthy caching, not an outage. Don't chase a myth.
2. **Check saturation.** `vmstat 1` — are `si`/`so` (swap in/out) sustained non-zero? That's thrashing = real pressure. Is swap full (`free` Swap line)?
3. **Check for OOM kills.** `dmesg -T | grep -i oom` / `journalctl -k` — did the OOM killer fire? Which victim, and was it `CONSTRAINT_NONE` (host) or `CONSTRAINT_MEMCG` (cgroup/container)?
4. **Find the hog.** `ps -eo pid,comm,rss --sort=-rss | head` or `top` sorted by RES. One giant process? Many processes? A process whose RSS is climbing over time (leak) vs a legitimately large working set?
5. **Classify.** Leak (unbounded RSS growth) → restart mitigates, fix the app. Undersized box / working set > RAM → add RAM or reduce concurrency. Cgroup limit too low → raise the container limit. Runaway query/batch → cap it.

The discipline that separates senior from junior: **step 1**. Half of "out of memory" pages are misread `free` output, and confirming available before touching anything saves needless capacity changes.

### Q14. What is memory overcommit and what does `vm.overcommit_memory` control?

Linux **overcommits** by default: it lets processes allocate (via `malloc`/`mmap`) **more virtual memory than RAM + swap**, betting that most allocations are never fully touched. This works because reserving address space is free — physical pages are only assigned on **first write** (demand paging), and lots of software (the JVM, `fork()` with copy-on-write, sparse arrays) reserves far more than it uses. The downside: allocations "succeed" that the system can't actually back, so when processes *do* touch the memory and RAM runs out, the **OOM killer** enforces reality.

**`vm.overcommit_memory`** controls the policy:

- **0** (default) — heuristic; the kernel allows reasonable overcommit and rejects wildly large single allocations.
- **1** — always overcommit, never refuse. Used where you know allocations are sparse (some scientific/DB workloads).
- **2** — strict accounting; refuse allocations beyond `swap + RAM × overcommit_ratio` (default ratio 50%). `malloc` fails cleanly with ENOMEM instead of risking an OOM kill later — favoured where you want allocation failures over surprise kills.

```bash
sysctl vm.overcommit_memory vm.overcommit_ratio
```

The trade-off: overcommit gives flexibility and density but defers failure to OOM-kill time; strict mode gives predictable `malloc` failures but wastes capacity.

### Q15. What is memory reclaim, and what do kswapd and direct reclaim mean?

**Reclaim** is how the kernel frees memory when it runs low — by evicting pages: dropping clean file-cache pages, writing dirty pages back to disk, and swapping out anonymous pages. It happens two ways:

- **`kswapd` (background reclaim)** — a per-NUMA-node kernel daemon that wakes when free memory drops below the low **watermark** and reclaims pages *asynchronously*, aiming to refill free memory back above the high watermark. Because it runs in the background, processes don't stall — this is the healthy, invisible case.
- **Direct reclaim** — when memory is demanded *faster than kswapd can keep up* and free memory hits the min watermark, the **allocating process itself** is forced to do reclaim work *synchronously* before its allocation returns. This **stalls the process** — visible as latency spikes and CPU in reclaim, and processes stuck in **`D`** (uninterruptible sleep) waiting on write-back I/O.

Watermarks (`min`/`low`/`high`, tunable via `vm.min_free_kbytes`) set the thresholds. Diagnostic signals: `vmstat` showing high `si`/`so` and shrinking cache, elevated `sy` CPU, and processes in `D` state. Sustained **direct reclaim** is the on-call signature of a box under genuine memory pressure — the kernel can't reclaim fast enough in the background, so everything slows down. It often precedes an OOM kill.
## CPU, Load & Scheduling

### Summary

**What this topic covers**

How Linux schedules work onto CPUs, and how you read the signals that tell you a box is CPU-starved — versus stuck waiting on something else entirely. Three concern areas live here: (1) **load and its interpretation** — the 1/5/15-minute load average, the runqueue, and the single most misunderstood metric on Linux (load counts uninterruptible-sleep tasks, not just CPU demand); (2) **the CPU accounting fields** — `%us`/`%sy`/`%id`/`%wa`/`%st` in `top`, the `r` and `b` columns in `vmstat`, per-core views in `mpstat`; and (3) **scheduling and control** — the CFS scheduler, nice/priority, real-time classes, CPU affinity, cgroup CPU quotas and container throttling, and Pressure Stall Information. The 16 questions here move from "what does load average mean" to "load is 40 but every core is 95% idle — diagnose it."

**Mental model**

The CPU has a **runqueue**: tasks that are runnable (want CPU right now). The scheduler (CFS — the Completely Fair Scheduler) time-slices the runqueue across cores, giving each task a fair share weighted by its `nice` value. That is the whole game for CPU-bound work. But **load average is not CPU utilization** — it is the number of tasks in state R (running/runnable) *plus* state D (uninterruptible sleep, almost always blocked on I/O). So a box can show load 40 with CPUs 100% idle: 40 processes all stuck in D waiting on a dying disk or an NFS mount. Utilization tells you how busy the CPU is; saturation (load beyond core count, runqueue depth `r`) tells you how much work is *waiting*. The senior instinct is USE: for CPU, Utilization = `%us+%sy`, Saturation = runqueue length / load-vs-cores, Errors = throttling. Always divide load by core count before panicking: load 8 on 16 cores is half-idle; load 8 on 2 cores is drowning.

**Key terms**

- **Load average** — runnable (R) + uninterruptible-sleep (D) task count, exponentially averaged over 1/5/15 min. From `/proc/loadavg`.
- **`%wa` (iowait)** — CPU idle *because* every runnable task is blocked on I/O. Not CPU work; a symptom of slow storage.
- **`%st` (steal)** — time the hypervisor gave your vCPU to another VM. Only meaningful on virtualized/cloud hosts; high steal = noisy neighbour or overcommit.
- **CFS** — Completely Fair Scheduler; default for normal tasks. Allots CPU proportional to weight derived from `nice`.
- **nice / NI** — priority hint, -20 (greediest) to +19 (nicest). `renice` changes a running process.
- **PR** — kernel priority shown in `top`; for normal tasks PR = 20 + NI. RT tasks show `rt` or negative.
- **Real-time classes** — `SCHED_FIFO`/`SCHED_RR` (`chrt`), priorities 1–99, preempt all normal tasks; misuse can starve the box.
- **CPU affinity** — pinning a process to specific cores with `taskset` or `sched_setaffinity`.
- **Context switch (`cs`)** — swapping one task off a core for another; cheap individually, a saturation signal in bulk (`vmstat` `cs`).
- **cgroup CPU quota** — `CPUQuota=`/`cpu.max`; caps a container's CPU-seconds per period. Exceeding it causes **throttling**, not more CPU.
- **PSI** — Pressure Stall Information in `/proc/pressure/{cpu,io,memory}`; % of time tasks stalled waiting for a resource.

**Why interviewers ask this**

Load average is the classic senior/junior separator. A junior sees "load 40" and says "the CPU is overloaded." A senior asks "how many cores, and what's `%wa` and `%st`?" — because load counts blocked-on-I/O tasks, so high load with idle CPU is usually a *storage* or *lock* problem, not a compute one. Interviewers (especially SRE/DevOps) want to see you triage systematically: is this box CPU-bound, I/O-bound, or memory-bound? They also probe container-era knowledge — cgroup throttling is the #1 reason a containerized app is slow while host CPU looks fine, and candidates who only know bare-metal miss it entirely.

**Common confusions**

- "Load average is CPU utilization" — no. It includes D-state (uninterruptible sleep) tasks. High load + idle CPU = I/O wait or blocked processes.
- "Load of 4 is bad" — depends on core count. 4 on a 8-core box is comfortable; 4 on 1 core is a 4× backlog.
- "iowait means the CPU is doing I/O work" — the CPU does *no* work during `%wa`; it's idle time attributed to pending I/O. High `%wa` points at storage, not CPU.
- "Steal time is my process's fault" — `%st` is the hypervisor stealing your vCPU for other tenants; it's an infra/overcommit problem.
- "My container has 8 cores so it can use them all" — not if `CPUQuota`/`cpu.max` limits it; it gets throttled and latency spikes even at low host utilization.
- "Nice makes a process run faster" — nice only matters under contention; on an idle box it changes nothing.

**What follows from this topic**

Load's D-state insight points straight at **Disk, Filesystems & LVM** (iowait, `iostat`, blocked-on-storage) and at process states in the Processes topic (D = uninterruptible sleep). The memory dimension of "what's making this slow" links to the memory/OOM topic (page cache, swap thrash inflating load). cgroup CPU limits and PSI connect to the containers/namespaces material. Master this and you can walk into any "the box is slow" incident and split CPU-bound from I/O-bound from memory-bound in under a minute.

### Q1. What is load average, and what exactly does it count?

Load average is the exponentially-weighted moving average of the number of tasks that are **runnable (state R)** *plus* **in uninterruptible sleep (state D)**, sampled over 1, 5, and 15 minutes. Read it from `/proc/loadavg` or `uptime`:

```bash
uptime
# 14:02:11 up 40 days,  3:11,  2 users,  load average: 0.52, 0.44, 0.39
cat /proc/loadavg
# 0.52 0.44 0.39 2/431 18922   (runnable/total procs, last PID)
```

The three numbers are 1/5/15-minute averages — rising means load is trending up, falling means recovering. The critical, non-obvious part: **it is not CPU utilization**. Because D-state (usually blocked on disk/NFS) counts too, a box can have a high load average while the CPUs sit idle. That single fact is the most common Linux interview trap.

### Q2. Load average is 40 but `top` shows the CPUs 95% idle. What's going on?

Classic. Load counts **D-state (uninterruptible sleep)** tasks, not just CPU demand. If 40 processes are all blocked waiting on I/O, the load average climbs to ~40 while the CPU has nothing runnable to do — so it's idle.

Diagnose:

```bash
uptime                 # confirm high load
top                    # is %wa (iowait) high? is %id high?
vmstat 1 5             # look at the 'b' column (blocked) and 'wa'
ps -eo state,pid,cmd | grep '^D'   # list processes stuck in D
iostat -x 1            # %util near 100 on a disk => storage bottleneck
```

Usual culprits: a failing/slow disk, a stalled NFS or network mount, heavy fsync load, or a device driver issue. The CPU is a bystander; the fix is on the storage/I/O side. If instead `%wa` is low and `%st` (steal) is high, the hypervisor is starving your vCPUs — an infra problem.

### Q3. How do you interpret load average relative to core count?

Divide load by the number of cores. Load equal to core count means the machine is fully utilized with no backlog; below means spare capacity; above means tasks are queuing.

```bash
nproc                          # number of logical CPUs
# or
grep -c ^processor /proc/cpuinfo
```

- Load 4 on **1 core** → 4× oversubscribed, terrible.
- Load 4 on **4 cores** → fully loaded, no headroom, borderline.
- Load 4 on **16 cores** → 25% busy, healthy.

A useful rule of thumb: sustained load per core above ~1.0 means saturation (tasks waiting). But always check *why* — if the excess is D-state, more cores won't help.

### Q4. Explain the CPU fields in `top`: %us, %sy, %id, %wa, %st, %ni, %hi, %si.

These are the CPU time breakdown (the `%Cpu(s)` line):

| Field | Meaning |
|---|---|
| `us` | User space — application code |
| `sy` | System/kernel — syscalls, kernel work |
| `ni` | User time for **nice**d (re-prioritized) processes |
| `id` | Idle — nothing to run |
| `wa` | I/O wait — idle, but a runnable task is blocked on I/O |
| `hi` | Hardware interrupts |
| `si` | Software interrupts (softirqs — network, timers) |
| `st` | **Steal** — vCPU time taken by the hypervisor for other VMs |

Reading them: high `us` = app is CPU-bound; high `sy` = syscall-heavy (context switches, small I/Os, forking); high `wa` = storage bottleneck; high `st` = noisy-neighbour/overcommit on a cloud host; high `si` = often network packet processing. `id + used = 100%`.

### Q5. What is steal time (%st) and when do you care?

Steal time is the percentage of time your **virtual** CPU was ready to run but the hypervisor scheduled another guest instead. It's only meaningful on virtualized/cloud instances (KVM, Xen, EC2). On bare metal it's always 0.

High, sustained `%st` (say >5–10%) means the physical host is oversubscribed — your vCPU is contending with noisy neighbours. Your app slows down and there's nothing you can do inside the guest: the fix is a bigger/dedicated instance, a different host, or complaining to the cloud provider. Interviewers love this because it's a symptom that looks like your problem but isn't — the CPU work you expected simply isn't being scheduled onto real silicon.

### Q6. What do the `r` and `b` columns in `vmstat` tell you?

```bash
vmstat 1 5
# procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
#  r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
#  2  0      0 812345  91234 512345    0    0    12    34  512 1024 15  3 81  1  0
```

- **`r`** — processes **runnable** (running or waiting for a CPU). If `r` consistently exceeds core count, the CPU is saturated — real CPU pressure.
- **`b`** — processes in **uninterruptible sleep** (blocked, usually on I/O). Persistent nonzero `b` with high `wa` means a storage bottleneck.

So `r` high = CPU-bound; `b` high = I/O-bound. `cs` (context switches) and `in` (interrupts) climbing fast can indicate scheduling thrash. This split is the fastest way to classify a slow box.

### Q7. What does `%wa` (iowait) actually mean — is the CPU busy?

No — during `%wa` the CPU is **idle**. iowait is idle time that the kernel attributes to "there was at least one task blocked on I/O." It's a hint that storage might be the bottleneck, not a measure of CPU work.

Caveats interviewers like: iowait can *understate* the problem on multi-core boxes (if any core has other runnable work, that time isn't counted as iowait), and it can be misleading with many cores. The reliable confirmation is `iostat -x 1` — look at per-device `%util` and `await` (average I/O latency). High `%wa` plus a device pinned at `%util` ~100 with rising `await` = storage bottleneck. Low `%wa` doesn't guarantee storage is healthy; cross-check with `iostat`.

### Q8. What is the CFS scheduler and how does it allocate CPU?

CFS — the **Completely Fair Scheduler** — is the default Linux scheduler for normal (`SCHED_OTHER`) tasks. Instead of fixed time slices, it tracks each task's **virtual runtime** (`vruntime`) — accumulated CPU time weighted by the task's `nice` value — and always runs the task with the lowest `vruntime`, i.e. the one that has had least of its fair share. Lower nice (higher priority) makes vruntime accrue more slowly, so that task gets scheduled more often.

The goal is proportional fairness: with two equal-nice CPU-bound tasks on one core, each gets ~50%. A `nice -20` task competing with a `nice 0` task gets a much larger slice. There is no fixed quantum; CFS picks a target latency and divides it. (Note: newer kernels, 6.6+, replace CFS with **EEVDF**, a related fair scheduler — worth mentioning if the interviewer is current.)

### Q9. Explain nice and renice, and the PR/NI columns in `top`.

**nice** is a priority hint for normal tasks, ranging from **-20 (highest priority / greediest)** to **+19 (lowest / nicest to others)**. Default is 0.

```bash
nice -n 10 ./batch-job.sh        # start a low-priority job
renice -n 5 -p 12345             # change a running process's niceness
renice -n -5 -p 12345            # raise priority (needs root for negative)
```

In `top`: **NI** is the nice value; **PR** is the kernel's internal priority. For normal tasks `PR = 20 + NI` (so NI 0 → PR 20, NI -20 → PR 0). Real-time tasks show `PR` as `rt` or a negative number. Key nuance: **nice only matters under contention** — on an idle CPU a niced process runs just as fast. Lowering priority is the polite way to run batch/backup jobs without starving interactive work.

### Q10. What are real-time scheduling priorities and why are they dangerous?

Linux has real-time scheduling classes — **`SCHED_FIFO`** (run until you block or yield) and **`SCHED_RR`** (round-robin among equal priorities) — with priorities **1–99**, all of which preempt every normal `SCHED_OTHER` task regardless of nice.

```bash
chrt -f 50 ./low-latency-app     # SCHED_FIFO priority 50
chrt -p 12345                    # inspect a process's policy/priority
```

They're for latency-critical work (audio, industrial control, packet processing). The danger: a `SCHED_FIFO` task that spins without yielding will **monopolize a core and starve everything else**, including kernel threads — you can hang the box. The kernel's RT throttling (`sched_rt_runtime_us`) exists precisely to stop a runaway RT task from locking up the system. Use RT priorities sparingly and only when you understand the workload's blocking behaviour.

### Q11. How do you pin a process to specific CPUs, and why?

Use **CPU affinity** via `taskset` (or `sched_setaffinity` in code):

```bash
taskset -c 0,1 ./app             # launch pinned to cores 0 and 1
taskset -cp 2-3 12345            # move running PID 12345 to cores 2,3
taskset -cp 12345                # show current affinity
```

Why pin: to keep a latency-sensitive process on dedicated cores (avoiding scheduler migration), to preserve **CPU cache locality** and reduce cache thrash, to isolate noisy workloads, or to align a NUMA-aware app with local memory (pair with `numactl`). Downside: you give up the scheduler's load balancing, so bad pinning can leave some cores idle while pinned cores queue. Common in HPC, trading, and DPDK-style packet processing.

### Q12. How do you get a per-core CPU view instead of an aggregate?

The aggregate line in `top` hides a single hot core. To see per-core:

```bash
mpstat -P ALL 1        # per-CPU stats every second (from sysstat)
top                    # then press '1' to expand per-core lines
htop                   # per-core meters at the top
```

This matters for single-threaded bottlenecks: an app pinned to (or bottlenecked on) one core can sit at 100% on CPU3 while the box shows ~12% aggregate on 8 cores — the aggregate masks it. `mpstat -P ALL` also breaks out per-core `%usr`, `%sys`, `%iowait`, `%steal`, so you can spot one core drowning in softirqs (e.g. a single NIC queue) while others idle.

### Q13. How do you decide if a box is CPU-bound, I/O-bound, or memory-bound?

Systematic triage (a USE-method sweep):

```bash
uptime                 # load trend vs core count
top / mpstat -P ALL 1  # %us high => CPU-bound; %wa high => I/O-bound
vmstat 1               # r >> cores => CPU; b>0 & wa => I/O; si/so => swap thrash (memory)
iostat -x 1            # device %util ~100, await rising => storage
free -h                # available low + heavy si/so => memory pressure
```

- **CPU-bound**: high `%us`, `r` > cores, low `%wa`, memory fine. Fix: more/faster cores, optimize code, scale out.
- **I/O-bound**: high `%wa`, `b` > 0, a disk at `%util` ~100. Fix: faster storage, reduce fsyncs, cache.
- **Memory-bound**: `free` "available" low, `si`/`so` (swap in/out) nonzero, load inflated by swap thrash. Fix: more RAM, reduce footprint, tune swappiness.

Naming the class before reaching for a fix is exactly the reasoning interviewers want.

### Q14. What are context switches, and when do they become a problem?

A context switch is the kernel saving one task's CPU state and restoring another's. Two kinds: **voluntary** (a task blocks, e.g. on I/O or a lock) and **involuntary** (the scheduler preempts it because its time slice ended or a higher-priority task woke).

```bash
vmstat 1               # 'cs' column = context switches/sec
pidstat -w 1           # per-process voluntary/involuntary switches
```

Individually a switch is cheap (~microseconds), but at scale it burns CPU on scheduling overhead and trashes CPU caches. Red flags: `cs` in the hundreds of thousands per second, or a process with huge involuntary switches (too many runnable threads fighting for too few cores) or huge voluntary switches (lock contention / chatty I/O). The fix depends on the cause: reduce thread count, batch I/O, or resolve lock contention.

### Q15. How do cgroup CPU limits cause a container to be throttled?

A container's CPU is capped by a cgroup **quota**: `cpu.max` (cgroup v2) or `cpu.cfs_quota_us`/`cfs_period_us` (v1), surfaced by orchestrators as `CPUQuota=` (systemd) or Kubernetes `limits.cpu`. The quota is CPU-seconds allowed per period (default 100 ms). Once the container uses its quota within a period, the kernel **throttles** it — it gets *no* CPU until the next period, even if the host is idle.

```bash
cat /sys/fs/cgroup/cpu.max                 # e.g. "50000 100000" = 0.5 CPU
cat /sys/fs/cgroup/cpu.stat                # nr_throttled, throttled_usec
```

Symptom: app latency spikes and p99 tail explodes while **host** CPU utilization looks low — because the app keeps hitting its ceiling and getting parked. Check `cpu.stat` for `nr_throttled`/`throttled_usec` climbing. The fix is raising the limit (or removing it), or reducing per-request CPU. This is one of the most common "the box has spare CPU but my service is slow" incidents in the container era.

### Q16. What is Pressure Stall Information (PSI) and how do you use it?

PSI, in `/proc/pressure/{cpu,io,memory}`, reports the percentage of time tasks were **stalled waiting** for a resource — a direct saturation signal that's more actionable than load average.

```bash
cat /proc/pressure/cpu
# some avg10=0.42 avg60=0.35 avg300=0.30 total=123456789
cat /proc/pressure/io
# some avg10=8.15 ... full avg10=3.20 ...
```

`some` = at least one task stalled; `full` = *all* runnable tasks stalled (nothing progressing — the worst case). Unlike load average, PSI cleanly separates CPU, I/O, and memory pressure and gives you a "% of wall-clock time lost to waiting" number. It underpins tools like **`oomd`/`systemd-oomd`** (act on memory pressure before the OOM killer) and cgroup-v2 monitoring. In interviews it signals you're current on modern Linux observability rather than only knowing `uptime`.

## Disk, Filesystems & LVM

### Summary

**What this topic covers**

Everything from the block device up to the mounted filesystem, plus the volume-management and troubleshooting layer that SREs live in. Three concern areas: (1) **the storage stack** — block devices, partitions (MBR vs GPT), filesystems (ext4/xfs/btrfs), and how you turn raw disk into a mounted tree via `/etc/fstab`; (2) **capacity and its failure modes** — `df` vs `du`, inode exhaustion, the deleted-but-held-open file, and how to run a disk-full incident; and (3) **flexible/​resilient storage** — LVM (PV/VG/LV, online resize, snapshots), RAID, swap, journaling, tmpfs, and I/O observability. The 16 questions run from "what's the difference between `df` and `du`" to "the disk is 100% full but `du` only accounts for half of it — where's the space?"

**Mental model**

Storage is a stack, and every layer can be the problem. At the bottom: **block devices** (`/dev/sda`, `/dev/nvme0n1`) — raw addressable blocks. On top: **partitions** carve a device into regions (GPT on anything modern). On top of that (optionally): **LVM**, which pools physical volumes into a volume group and hands out logical volumes you can resize and snapshot without repartitioning. Then a **filesystem** (ext4, xfs) formats a partition or LV, tracking files via **inodes** (metadata + block pointers) and directory entries (name → inode). Finally **mounting** grafts that filesystem onto a directory in the single unified tree. Two capacity dimensions run in parallel: **data blocks** (bytes, what `df` shows) and **inodes** (file *count*, `df -i`) — you can exhaust either. And a file's space is freed only when the last **link count** *and* the last open **file descriptor** are gone — which is why deleting a huge log a process still holds open frees nothing until the process exits.

**Key terms**

- **Block device** — `/dev/sda`, `/dev/nvme0n1`; storage addressed in fixed-size blocks. `lsblk` shows the tree.
- **Partition table** — MBR (legacy, ≤2 TB, 4 primary) vs **GPT** (modern, huge disks, many partitions). `parted`/`fdisk`/`gdisk`.
- **Filesystem** — ext4 (default, reliable), xfs (great for large files/parallel I/O, RHEL default), btrfs/ZFS (snapshots, checksums). `mkfs.<type>`.
- **inode** — on-disk structure holding a file's metadata + data-block pointers; the filename is *not* in it (it's in the directory). Finite pool set at `mkfs`.
- **mount / `/etc/fstab`** — attaches a filesystem to a directory; fstab persists mounts (device/UUID, mountpoint, type, options, dump, pass).
- **`df` vs `du`** — `df` = free/used blocks per *filesystem*; `du` = space consumed per *directory tree*.
- **inode exhaustion** — out of inodes though bytes remain free → "No space left on device" with `df` showing free space. Check `df -i`.
- **LVM** — PV (physical volume) → VG (volume group) → LV (logical volume); enables online resize and snapshots.
- **RAID / mdadm** — software RAID; levels 0 (stripe), 1 (mirror), 5 (parity), 10 (stripe of mirrors).
- **journaling** — filesystem writes an intent log so `fsck` after a crash is fast and consistent.
- **tmpfs** — RAM-backed filesystem (`/dev/shm`, `/run`); fast, volatile, counts against memory.
- **`lsof +L1`** — lists open files with link count < 1: the deleted-but-still-open files eating space.

**Why interviewers ask this**

Disk-full is one of the top-three production incidents, and it separates people who memorized `df -h` from people who can actually recover a box. The signature test is the "df says 100% full, du says 50%" puzzle — it forces you to know both inode exhaustion *and* the deleted-but-held-open-file trap. LVM questions probe whether you can grow a filesystem **online** under load (real SRE work) rather than taking downtime. And filesystem choice (ext4 vs xfs) plus RAID levels test whether you understand durability/performance trade-offs rather than reciting names.

**Common confusions**

- "`df` and `du` should always agree" — they routinely disagree: deleted-but-open files, files under a mountpoint, sparse files, and reserved blocks all cause gaps.
- "No space left on device always means out of bytes" — it can mean out of **inodes** (`df -i`) while bytes are free (millions of tiny files).
- "`rm` on a big file frees space immediately" — not if a process holds it open; space returns only when the fd closes. Use `lsof +L1`.
- "Growing a disk grows the filesystem" — no. After `lvextend`/resizing the partition you must `resize2fs` (ext4) or `xfs_growfs` (xfs) to grow the FS itself.
- "xfs can be shrunk like ext4" — xfs **cannot shrink**; ext4 can (offline). Pick accordingly.
- "RAID is a backup" — it isn't; RAID survives *disk* failure, not `rm -rf`, corruption, or ransomware.

**What follows from this topic**

The iowait and D-state material from **CPU, Load & Scheduling** resolves here — a slow disk is what pins tasks in uninterruptible sleep and inflates load. tmpfs and swap tie into the memory/OOM topic (page cache, swap-on-disk). Mount namespaces preview the containers topic. And the disk-full runbook is the kind of incident-response reasoning that recurs in the networking and systemd/logging topics (journald filling `/var/log`). Storage is where "the box is slow" and "the box is full" incidents actually get solved.

### Q1. What's the difference between `df` and `du`, and why might they disagree?

**`df`** reports free/used space per *mounted filesystem*, read from the filesystem's own accounting — fast, whole-FS view. **`du`** walks a *directory tree* and sums the space of files it finds — slower, path-scoped.

```bash
df -h /var                 # filesystem-level: size, used, avail, use%
du -sh /var/*              # per-subdirectory usage under /var
```

They disagree when:
- **Deleted-but-open files**: a process holds a deleted file open — `df` counts the space (not yet freed), `du` can't see the file (no directory entry). The classic gap.
- **Files hidden under a mountpoint**: files written to a directory *before* something was mounted over it — `du` on the mount sees the mounted FS, not the shadowed files.
- **Reserved blocks**: ext4 reserves ~5% for root; `df` counts it as used-ish.
- **Sparse files / different block accounting**: `du` counts allocated blocks, which can differ from apparent size.

### Q2. The disk is 100% full but `du -sh /*` only accounts for half the space. Where did it go?

Two prime suspects, in order:

**1. Deleted-but-held-open file.** A process (often a logger or a long-running app) has an open file descriptor to a file that was `rm`'d. The directory entry is gone (so `du` can't see it) but the inode and its blocks persist until the fd closes — `df` still counts them.

```bash
lsof +L1                    # files with link count < 1 (deleted, still open)
lsof -nP | grep '(deleted)'
ls -l /proc/<pid>/fd | grep deleted
```

Fix: restart or signal the process to reopen its file (`kill -HUP` for many daemons), or truncate via the fd: `: > /proc/<pid>/fd/<n>`. **Do not** just `rm` again — the file's already unlinked.

**2. Files hidden under a mountpoint.** Something was written to `/data` before the real disk got mounted there; now those files are shadowed. Unmount and check, or bind-mount the parent to inspect.

Also check inode exhaustion (`df -i`) — different failure, same "full" symptom.

### Q3. `df` shows plenty of free space but writes fail with "No space left on device." Why?

You're out of **inodes**, not bytes. Every file/dir/symlink consumes one inode; the pool is fixed at `mkfs` time. Workloads that create millions of tiny files (mail queues, session files, cache dirs, npm) can exhaust inodes while gigabytes of data space remain free.

```bash
df -i /var                 # IFree/IUse% — check inode usage
df -h /var                 # shows free bytes — misleadingly fine
# find the offender: directories with the most files
for d in /var/*; do echo "$(find "$d" -xdev | wc -l) $d"; done | sort -rn | head
```

Fix: delete the mass of small files (often an unrotated cache or maildir). Longer-term: reformat with more inodes (`mkfs.ext4 -N <count>` or `-i <bytes-per-inode>`), or switch to xfs which allocates inodes dynamically and rarely hits this.

### Q4. Explain the Linux block device naming: /dev/sda vs /dev/nvme0n1 vs partitions.

- **`/dev/sda`** — SCSI/SATA/USB disk (the `sd` = SCSI disk driver); letters increment per disk: `sda`, `sdb`. Partitions append numbers: `sda1`, `sda2`.
- **`/dev/nvme0n1`** — an NVMe SSD. `nvme0` = controller 0, `n1` = namespace 1; partitions use a `p`: `nvme0n1p1`, `nvme0n1p2`.
- **`/dev/vda`, `/dev/xvda`** — virtio (KVM) and Xen virtual disks in clouds/VMs.
- **`/dev/dm-0`, `/dev/mapper/...`** — device-mapper targets (LVM LVs, LUKS, multipath).

```bash
lsblk -f                   # tree of devices, partitions, FS type, UUID, mountpoint
```

Naming can change across reboots (enumeration order), which is exactly why `/etc/fstab` should mount by **UUID** or **label**, not `/dev/sdX`.

### Q5. What's the difference between MBR and GPT partition tables?

| | MBR | GPT |
|---|---|---|
| Age | Legacy (1983) | Modern (UEFI era) |
| Max disk | 2 TB | ~9.4 ZB (effectively unlimited) |
| Primary partitions | 4 (extended for more) | 128 by default |
| Redundancy | Single table (fragile) | Primary + backup table + CRC |
| Firmware | BIOS | UEFI (BIOS via protective MBR) |

Use **GPT** on anything new — it's required above 2 TB, stores a backup table, and self-checks with CRCs. Tools: `parted`/`gdisk` (GPT-aware), `fdisk` (now handles GPT too), `lsblk`. MBR only lingers for old BIOS systems or compatibility.

### Q6. Compare ext4, xfs, and btrfs — when would you pick each?

- **ext4** — the reliable default. Journaled, mature, can **shrink** (offline), fine for general-purpose root filesystems. Fixed inode count at format time.
- **xfs** — RHEL/CentOS default. Excellent for **large files and high parallel I/O** (databases, media), scales to huge filesystems, dynamic inode allocation. Can grow online but **cannot shrink**.
- **btrfs** — copy-on-write with **snapshots, checksums, built-in RAID, and transparent compression**. Great for flexibility and data integrity; historically less battle-tested for some RAID modes. (ZFS is the enterprise alternative with similar features, out-of-tree.)

```bash
mkfs.ext4 /dev/vg0/data
mkfs.xfs  /dev/vg0/data
```

Rule of thumb: root/general → ext4; big-data or RHEL shops → xfs; snapshot/integrity needs → btrfs/ZFS. Interview point: xfs's inability to shrink is a real planning constraint.

### Q7. Walk through /etc/fstab: what are the six fields?

Each line defines a persistent mount:

```
UUID=1234-abcd  /data   ext4   defaults,noatime  0  2
```

1. **Device** — what to mount. Use `UUID=` or `LABEL=` (stable across reboots), not `/dev/sdX`.
2. **Mount point** — target directory (e.g. `/data`), or `none` for swap.
3. **Filesystem type** — `ext4`, `xfs`, `swap`, `tmpfs`, `nfs`.
4. **Options** — comma-separated: `defaults`, `noatime` (skip access-time writes, faster), `ro`, `nofail` (don't block boot if missing), `noexec`, `nosuid`.
5. **dump** — legacy backup flag, almost always `0`.
6. **pass** — `fsck` order at boot: `1` for root, `2` for others, `0` to skip.

```bash
mount -a                   # mount everything in fstab (test after editing)
findmnt --verify           # validate fstab before rebooting
```

A bad fstab entry without `nofail` can hang boot — always `mount -a`/`findmnt --verify` before rebooting.

### Q8. Why mount by UUID instead of device name, and where do options like noatime help?

**Device names aren't stable.** `/dev/sda` and `/dev/sdb` are assigned in enumeration order, which can swap across reboots or when you add a disk — so a fstab entry pointing at `/dev/sdb1` might mount the wrong disk. A **UUID** (or filesystem **LABEL**) is baked into the filesystem and follows it regardless of device letter.

```bash
blkid /dev/sda1            # shows UUID and LABEL
lsblk -f
```

Useful options: **`noatime`** stops the kernel writing an access timestamp on every read — a real I/O win on busy filesystems (or `relatime`, the modern default, which updates lazily). **`ro`** for immutable data, **`nosuid`/`noexec`/`nodev`** to harden mounts like `/tmp`, **`nofail`** so an absent optional disk doesn't block boot, **`discard`** or periodic `fstrim` for SSD TRIM.

### Q9. What is LVM and why use it over raw partitions?

LVM (Logical Volume Manager) inserts an abstraction between disks and filesystems: **PV** (physical volume — a disk/partition) → **VG** (volume group — a pool of PVs) → **LV** (logical volume — a virtual "partition" carved from the VG that you format and mount).

```bash
pvcreate /dev/sdb /dev/sdc           # init PVs
vgcreate vg0 /dev/sdb /dev/sdc       # pool them into a VG
lvcreate -L 50G -n data vg0          # carve a 50G LV
mkfs.ext4 /dev/vg0/data && mount /dev/vg0/data /data
```

Why bother over raw partitions:
- **Online resize** — grow an LV (and its FS) while mounted; span multiple disks.
- **Snapshots** — point-in-time copies for backups/testing.
- **Flexibility** — add a disk to the VG and extend LVs without repartitioning or downtime.
- **Thin provisioning**, striping, and moving data between disks (`pvmove`) live/online.

The cost is one more layer to understand; in practice LVM (or ZFS/btrfs) is standard on servers precisely because resizing raw partitions safely is painful.

### Q10. How do you grow a filesystem that's running out of space, online?

Two steps, and the second is the one people forget: **grow the block layer, then grow the filesystem.** With LVM on ext4:

```bash
lvextend -L +20G /dev/vg0/data       # add 20G to the LV (or -l +100%FREE)
resize2fs /dev/vg0/data              # grow the ext4 FS to fill it (online)
```

With xfs:

```bash
lvextend -L +20G /dev/vg0/data
xfs_growfs /data                     # xfs grows by mountpoint, online only
```

If it's a cloud disk without LVM: expand the volume in the console, grow the partition (`growpart /dev/sda 1`), then `resize2fs`/`xfs_growfs`. Key exam points: **`resize2fs` for ext4, `xfs_growfs` for xfs**, both work while mounted; xfs can only grow, never shrink; and forgetting the resize step leaves the extra space invisible to the filesystem.

### Q11. What are LVM snapshots and how are they used for backups?

An LVM snapshot is a point-in-time, copy-on-write image of an LV. At creation it's near-instant and near-zero size; as the *origin* changes, LVM copies the original blocks into the snapshot's reserved space (COW), so the snapshot keeps showing the moment it was taken.

```bash
lvcreate -s -L 5G -n data_snap /dev/vg0/data   # snapshot of the 'data' LV
mount -o ro /dev/vg0/data_snap /mnt/snap        # back up from a consistent view
# ... run backup ...
lvremove /dev/vg0/data_snap
```

Use case: take a snapshot, back it up (or dump a database from) the frozen view while the live LV keeps serving writes — no downtime, consistent backup. Caveat: size the snapshot for expected churn; if writes exceed its reserved space the snapshot **fills and is dropped** (invalidated). Snapshots are a backup *aid*, not a backup — they live on the same VG/disks. (btrfs/ZFS snapshots are cheaper and more robust for heavy use.)

### Q12. Give an overview of RAID levels and when you'd use each.

Software RAID via **`mdadm`** (or hardware controllers) combines disks for performance and/or redundancy:

| Level | Layout | Redundancy | Use case |
|---|---|---|---|
| **0** | Stripe | None (any disk fails → all lost) | Max speed/capacity, scratch data |
| **1** | Mirror | Survives 1 of 2 | OS/boot, small critical data |
| **5** | Stripe + 1 parity | Survives 1 disk | Capacity + redundancy, read-heavy |
| **6** | Stripe + 2 parity | Survives 2 disks | Large arrays, rebuild safety |
| **10** | Mirror then stripe | Survives 1 per mirror | Databases — speed + redundancy |

```bash
mdadm --create /dev/md0 --level=10 --raid-devices=4 /dev/sd[b-e]
cat /proc/mdstat                     # array status / rebuild progress
```

RAID 5's weak spot: rebuilds are slow and stress the surviving disks (risk of a second failure) — many shops prefer 6 or 10 for large arrays. Non-negotiable interview line: **RAID is not a backup** — it protects against disk failure, not deletion, corruption, or disaster.

### Q13. How does swap on disk work, and how does it relate to memory pressure?

Swap is disk space (a partition or a file) the kernel uses to **page out** inactive anonymous memory when RAM is under pressure, freeing physical pages for hotter data and page cache.

```bash
swapon --show                        # active swap devices/files and usage
free -h                              # see Swap used/free
# add a swapfile:
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
```

Relationship to pressure: a little swap usage is fine (cold pages parked). The danger is **thrashing** — when the working set exceeds RAM, the kernel constantly swaps in/out, `vmstat` shows high `si`/`so`, iowait spikes, and load balloons while real work stalls. Tune with **`vm.swappiness`** (lower = prefer reclaiming cache over swapping anon memory). On latency-critical/DB boxes some disable swap, but with no swap the OOM killer acts sooner. Swap trades a slowdown for surviving a memory spike instead of an outright OOM kill.

### Q14. What do journaling and fsck do, and when does fsck run?

**Journaling**: before committing metadata (and optionally data) changes, the filesystem writes the intended operations to an on-disk **journal**. If the box crashes mid-write, on next mount the FS *replays* the journal to reach a consistent state — turning what used to be a long full scan into a quick recovery. ext4 offers `data=ordered` (default — journal metadata, order data writes), `journal` (safest, slowest), `writeback` (fastest, riskiest). xfs is always journaled.

**`fsck`** checks and repairs filesystem structure (inodes, link counts, block bitmaps, orphaned files → `lost+found`).

```bash
fsck -n /dev/sdb1          # check read-only, report only
fsck /dev/sdb1             # repair (must be UNMOUNTED — never on a mounted FS)
```

It runs at boot when the FS is marked dirty or after a max mount-count/interval (the fstab **pass** column sets order), and manually for suspected corruption. Golden rule: **never `fsck` a mounted, writable filesystem** — you'll corrupt it. Journaling makes routine `fsck` rare; you mostly need it after hardware faults.

### Q15. What is tmpfs and where is it used?

tmpfs is a **RAM-backed filesystem** — files live in the page cache/swap, never on a persistent disk, so it's very fast and **volatile** (gone on reboot).

```bash
mount | grep tmpfs
# tmpfs on /run type tmpfs (rw,nosuid,nodev,size=...)
mount -t tmpfs -o size=512m tmpfs /mnt/fast
```

Standard uses: **`/run`**, **`/dev/shm`** (POSIX shared memory / IPC), and often **`/tmp`** on systemd systems. It grows on demand up to its `size=` limit and can spill to swap under pressure. Key gotchas: its usage **counts against RAM**, so a runaway process filling `/dev/shm` causes memory pressure and can trigger the OOM killer; and never store anything you need after reboot on tmpfs. It's ideal for scratch space, caches, and reducing SSD wear.

### Q16. Walk me through diagnosing a "disk full" production incident.

Systematic runbook:

```bash
df -h                       # 1. which filesystem is full? (/, /var, /data?)
df -i                       # 2. inodes exhausted instead of bytes?
du -xsh /var/* | sort -rh | head    # 3. -x stays on one FS; find big dirs
ncdu -x /var                # interactive drill-down (if available)
lsof +L1                    # 4. deleted-but-open files holding space
journalctl --disk-usage     # 5. runaway journald? logs?
```

Order of reasoning: (1) confirm *which* mount — a full `/` is very different from a full `/data`. (2) Rule in/out **inode exhaustion** early (`df -i`). (3) Find the space with `du -x` (stay on one filesystem) or `ncdu`. (4) If `du` can't account for it, check **deleted-but-open files** (`lsof +L1`) — restart/HUP the holder rather than re-`rm`. (5) Common offenders: unrotated logs (`/var/log`, journald with no `SystemMaxUse`), core dumps, an app's temp/cache dir, an untruncated DB.

Safe remediation: rotate/compress or truncate logs (`: > file`, never `rm` an in-use log), clear caches, extend the LV/FS (see the online-grow question) — and add monitoring + logrotate + journald limits so it doesn't recur. Never blindly `rm -rf` under pressure; identify the owner first.

## Networking Fundamentals

### Summary

**What this topic covers**

The Linux networking model an SRE needs to configure interfaces, read the routing and socket tables, resolve names, and systematically debug "this box can't reach that service." Three concern areas: (1) **configuration & the modern toolset** — the `ip` suite (replacing `ifconfig`/`route`), addressing, CIDR, the routing table and default gateway; (2) **names & ports** — DNS resolution order (`/etc/hosts`, `/etc/resolv.conf`, systemd-resolved, nsswitch), ports/sockets, ephemeral vs well-known; and (3) **sockets, TCP state & troubleshooting** — `ss` vs `netstat`, TCP vs UDP, the handshake and connection states (LISTEN/ESTABLISHED/TIME_WAIT), NAT/private ranges, loopback, MTU, and a repeatable connectivity-debugging method. The 18 questions run from "read me this routing table" to "why is this box drowning in TIME_WAIT sockets."

**Mental model**

A packet leaving your box goes through a decision funnel, and debugging is walking that funnel top to bottom. **Name → address**: the app resolves a hostname via the resolver order (`/etc/nsswitch.conf` → usually `/etc/hosts` then DNS via `/etc/resolv.conf`/systemd-resolved). **Address → route**: the kernel consults the **routing table** (`ip route`) — is the destination on a directly-connected subnet, or does it go via the **default gateway**? **Route → interface → link**: it picks an interface (`ip addr`/`ip link`), and if the link is down or has no IP, nothing leaves. **Port → socket**: the destination host must have a process **listening** on that port (`ss -tlnp`), and no firewall in between may drop it. The whole art of "why can't A reach B" is figuring out *which* of those steps fails — DNS, routing, the local interface, a listening service, or a firewall — and you test each in turn rather than guessing.

**Key terms**

- **`ip` suite** — `ip addr` (addresses), `ip route` (routing table), `ip link` (interfaces/state); the modern replacement for `ifconfig`/`route`/`arp`.
- **CIDR / subnet** — `10.0.1.0/24`: prefix length says how many bits are network vs host; defines which addresses are "local."
- **Default gateway** — the `default`/`0.0.0.0/0` route: where packets go when the destination isn't on a directly-connected subnet.
- **DNS resolution order** — `/etc/nsswitch.conf` `hosts:` line decides `files` (`/etc/hosts`) vs `dns`; `/etc/resolv.conf` lists nameservers; systemd-resolved often fronts it via `127.0.0.53`.
- **Port** — 16-bit endpoint; **well-known** 0–1023 (privileged), **registered** 1024–49151, **ephemeral** ~32768–60999 (client source ports).
- **Socket** — an endpoint = (protocol, local IP:port, remote IP:port); a connection is the 4-tuple.
- **`ss`** — modern socket stat tool; `ss -tlnp` = TCP, listening, numeric, with owning process. Replaces `netstat`.
- **TCP vs UDP** — TCP: connection, 3-way handshake, ordered/reliable; UDP: connectionless, fire-and-forget (DNS, metrics).
- **TCP states** — LISTEN, SYN-SENT/RECV, ESTABLISHED, FIN-WAIT, **TIME_WAIT** (the active closer waits ~2·MSL before reusing the tuple).
- **NAT / private ranges** — RFC 1918: `10/8`, `172.16/12`, `192.168/16`; translated to a public IP at the edge.
- **loopback (`lo`, 127.0.0.1)** — the host talking to itself; never leaves the machine.
- **MTU** — max frame payload (usually 1500); mismatches cause fragmentation or black-holed large packets.

**Why interviewers ask this**

Networking is where distributed systems break, and "it's a DNS problem" is a cliché because it so often is. Interviewers want to see a **method**, not a lucky guess: given "service A can't reach service B," a senior engineer checks DNS, then a route, then whether B is even listening, then a firewall — in a defined order — while a junior pings once and shrugs. The `ss -tlnp` question tests whether you can find *which process owns a port* (daily incident work), and the TIME_WAIT question separates people who memorized state names from people who understand who closes a connection and why a busy proxy accumulates thousands of them. Modern-tooling fluency (`ip`/`ss` over `ifconfig`/`netstat`) is also a currency signal.

**Common confusions**

- "`ping` works so networking is fine" — ping is ICMP; the *service* uses TCP/UDP on a specific port that a firewall may block while ICMP passes. Test the actual port.
- "`ifconfig`/`netstat` are the right tools" — they're legacy (deprecated `net-tools`); use `ip` and `ss`. They can even show stale/incomplete info on modern setups.
- "DNS always goes to `/etc/resolv.conf`" — on systemd-resolved systems resolv.conf points at `127.0.0.53` and the real config is `resolvectl`; and `/etc/hosts` usually wins first per `nsswitch.conf`.
- "Lots of TIME_WAIT means a leak/attack" — usually normal for the side that **actively closes** many short connections (busy clients/proxies); it's the kernel safely retiring tuples.
- "Private IPs are routable on the internet" — RFC 1918 ranges aren't; they need NAT at the edge.
- "The port is open because the host is up" — the host can be reachable while **no process listens** on that port (connection refused) — different from a firewall drop (timeout).

**What follows from this topic**

The "is a process listening" step ties back to the Processes topic (`ss -tlnp` → PID → `/proc`). Firewalls (iptables/nftables, SELinux) are deliberately deferred to the security topic — here you only note "is a firewall dropping it?" as a funnel step. NAT, private ranges, and interfaces preview the containers/namespaces material (each container gets its own network namespace and veth). And the systematic "walk the funnel" method mirrors the incident-response reasoning used in the CPU and disk topics — same discipline, different layer.

### Q1. Why use the `ip` command over `ifconfig` and `route`?

`ifconfig`, `route`, `netstat`, and `arp` are from the legacy **net-tools** package, effectively deprecated and not installed by default on many modern distros. The **iproute2** `ip` suite is the maintained replacement and exposes features net-tools can't even show (multiple addresses per interface, policy routing, namespaces).

```bash
ip addr              # (ifconfig)     show addresses per interface
ip -br addr          #                brief one-line-per-interface view
ip route             # (route -n)     show the routing table
ip link              #                interface state (up/down, MAC, MTU)
ip neigh             # (arp)          ARP/neighbour table
```

Beyond being current, `ip` gives correct info where `ifconfig` misleads — e.g. `ifconfig` shows only the primary address of an interface with several. Interview signal: reaching for `ip`/`ss` says you've worked on recent systems.

### Q2. Explain CIDR notation and how you tell if two hosts are on the same subnet.

CIDR writes an address plus a **prefix length**: `10.0.1.25/24`. The prefix is how many leading bits are the **network**; the rest identify the **host**. `/24` = 24 network bits = a 255.255.255.0 mask = 256 addresses (254 usable), so `10.0.1.0`–`10.0.1.255`.

Two hosts are on the **same subnet** (can talk directly, no gateway) if applying the mask yields the same network address:

```
10.0.1.25/24  → network 10.0.1.0
10.0.1.200/24 → network 10.0.1.0   ✓ same subnet → direct delivery
10.0.2.5/24   → network 10.0.2.0   ✗ different  → goes via gateway
```

Smaller prefix = bigger network (`/16` = 65k hosts); larger = smaller (`/30` = 2 usable, point-to-point). This matters because "same subnet → ARP and deliver directly; different subnet → send to the default gateway" is the routing decision the kernel makes for every packet.

### Q3. What is the default gateway and how do you read the routing table?

The default gateway is where the kernel sends any packet whose destination **isn't** on a directly-connected subnet — the `default` (a.k.a. `0.0.0.0/0`) route.

```bash
ip route
# default via 10.0.1.1 dev eth0 proto dhcp metric 100
# 10.0.1.0/24 dev eth0 proto kernel scope link src 10.0.1.25
```

Read it top-down by specificity: the kernel picks the **most specific** matching route. A packet to `10.0.1.50` matches the connected `10.0.1.0/24` route → delivered directly on `eth0`. A packet to `8.8.8.8` matches nothing specific → falls to `default via 10.0.1.1` → sent to the gateway. `metric` breaks ties (lower wins). Check the effective route for a destination with:

```bash
ip route get 8.8.8.8         # shows exactly which route/interface/src is used
```

No default route = you can reach your local subnet but nothing beyond it — a classic "local works, internet doesn't" cause.

### Q4. How does DNS resolution order work on a modern Linux box?

An app calling `getaddrinfo()` consults **`/etc/nsswitch.conf`**, whose `hosts:` line defines the order of sources:

```
hosts: files dns          # or: files resolve [!UNAVAIL=return] dns myhostname
```

- **`files`** → check **`/etc/hosts`** first (static overrides win before DNS).
- **`dns`** / **`resolve`** → query nameservers.

Where the nameservers come from depends on the stack:
- Classic: **`/etc/resolv.conf`** lists `nameserver` IPs and `search` domains.
- systemd systems: `/etc/resolv.conf` is often a symlink pointing at **`127.0.0.53`** (systemd-resolved's stub), and the real config lives in `resolvectl`/`/etc/systemd/resolved.conf`.

```bash
resolvectl status            # systemd-resolved: servers, per-link config, cache
cat /etc/resolv.conf
getent hosts example.com     # resolves via the FULL nsswitch order (unlike dig)
```

Key point interviewers probe: **`/etc/hosts` normally wins over DNS**, and `dig`/`nslookup` query DNS *directly* — bypassing `nsswitch`/`/etc/hosts` — so they can disagree with what the application actually resolves. Use `getent hosts` to see the app's real answer.

### Q5. Explain ports and sockets, and the well-known vs ephemeral ranges.

A **port** is a 16-bit number (0–65535) identifying an endpoint within a host so multiple services/connections share one IP. A **socket** is the full endpoint — `(protocol, IP, port)` — and an established connection is the **4-tuple** `(local IP:port, remote IP:port)`.

Ranges:
- **Well-known (0–1023)** — privileged; binding needs root (or `CAP_NET_BIND_SERVICE`). e.g. 22 SSH, 80 HTTP, 443 HTTPS, 53 DNS.
- **Registered (1024–49151)** — assigned to apps (5432 Postgres, 6379 Redis).
- **Ephemeral (~32768–60999 on Linux)** — the kernel's dynamic source ports for **outbound** connections; range in `/proc/sys/net/ipv4/ip_local_port_range`.

So when your client connects to `web01:443`, the kernel picks an ephemeral local port; the server side keeps 443. A single server can hold huge numbers of connections on port 443 because each is distinguished by the *client's* IP:port in the 4-tuple. Ephemeral-port exhaustion (too many simultaneous outbound conns from one host) is a real failure mode for busy proxies.

### Q6. How do you find which process is listening on a port?

`ss` with the right flags — the daily incident tool:

```bash
ss -tlnp
# t=TCP  l=listening  n=numeric (no DNS/port-name lookup)  p=process
# State  Recv-Q Send-Q Local Address:Port  Peer  Process
# LISTEN 0      511    0.0.0.0:443         *:*   users:(("nginx",pid=1234,fd=6))
ss -tlnp | grep :443         # who owns 443?
ss -ulnp                     # UDP listeners
```

`-p` needs root to see processes you don't own. Alternatives: `lsof -i :443` (also shows the PID/command), and legacy `netstat -tlnp` (same idea, deprecated tool). This is the answer to "port 8080 already in use" (find and kill/reconfigure the holder) and "is my service actually listening, and on which address — `0.0.0.0` vs `127.0.0.1`?" (binding to loopback only is a common "works locally, unreachable remotely" bug).

### Q7. Why prefer `ss` over `netstat`?

`ss` (from iproute2) is the modern socket-statistics tool; `netstat` (net-tools) is deprecated. `ss` is **much faster** on busy hosts — it reads socket info directly from the kernel via netlink instead of parsing `/proc/net/*` line by line (which crawls with tens of thousands of sockets). It also has richer filtering and shows TCP internals `netstat` can't.

```bash
ss -tlnp                     # listening TCP + owning process
ss -tan state established    # all established TCP connections
ss -tan state time-wait | wc -l   # count TIME_WAIT sockets
ss -ti                       # TCP internals: rtt, cwnd, retransmits
ss -s                        # socket summary by state
```

The rough translation: `ss -tlnp` ≈ `netstat -tlnp`, `ss -tan` ≈ `netstat -tan`. If an interviewer says `netstat`, note you'd use `ss` and why (speed + state filtering + it's the maintained tool).

### Q8. Explain TCP vs UDP and, at a high level, the 3-way handshake.

**TCP** is connection-oriented and reliable: ordered delivery, retransmission of lost segments, flow control, and congestion control — at the cost of setup/teardown overhead and head-of-line blocking. Used for HTTP(S), SSH, databases — anywhere correctness matters. **UDP** is connectionless and best-effort: no handshake, no delivery guarantee, no ordering — just fast, low-overhead datagrams. Used for DNS, DHCP, metrics/telemetry, VoIP, and QUIC's foundation, where speed beats reliability or the app handles retries.

The **3-way handshake** (TCP connection setup):

```
Client → SYN            (I want to talk; here's my sequence number)
Server → SYN-ACK        (OK; here's mine, and I ack yours)
Client → ACK            (ack yours — connection ESTABLISHED)
```

After that, data flows both ways. Teardown is a separate FIN/ACK exchange. The handshake is why TCP has connection latency (one round-trip before any data) that UDP avoids — relevant when discussing tail latency or connection pooling.

### Q9. Walk through the main TCP connection states.

The lifecycle (see them with `ss -tan`):

- **LISTEN** — server socket waiting for connections (`ss -tln`).
- **SYN-SENT** — client sent SYN, awaiting SYN-ACK.
- **SYN-RECV** — server got SYN, sent SYN-ACK, awaiting final ACK (a flood of these = SYN-flood/backlog issue).
- **ESTABLISHED** — connection open, data flowing. The state you want to see.
- **FIN-WAIT-1 / FIN-WAIT-2 / CLOSING / LAST-ACK** — the teardown handshake in progress.
- **TIME-WAIT** — the side that **actively closed** waits ~2×MSL (~60 s on Linux) before releasing the tuple, so stray delayed packets from the old connection don't corrupt a new one reusing the same 4-tuple.
- **CLOSE-WAIT** — the local app received a FIN but **hasn't closed its socket yet**; lots of CLOSE-WAIT = an application bug (leaking sockets), not a kernel issue.

Two states that matter in interviews: **TIME_WAIT** (normal, on the active closer) and **CLOSE_WAIT** (app forgot to `close()`).

### Q10. A busy server has tens of thousands of sockets in TIME_WAIT. Is that a problem?

Usually not by itself — it's expected on whichever side **actively closes** many short-lived connections (a busy reverse proxy, or a client hammering a service without keep-alive). After close, that side holds the 4-tuple in TIME_WAIT for ~2×MSL (~60 s) so late-arriving packets from the old connection can't be mistaken for a new one on the same tuple. The kernel is protecting correctness.

When it *does* bite: if you're making huge numbers of outbound connections from **one source IP** to **one destination IP:port**, you can exhaust the ephemeral-port space (each TIME_WAIT tuple is reserved) → new connections fail. Real fixes:

```bash
ss -tan state time-wait | wc -l                 # measure it
# prefer:
```
- **Reuse connections** — HTTP keep-alive / connection pooling (kills the problem at the source).
- **`net.ipv4.tcp_tw_reuse=1`** — let the kernel reuse TIME_WAIT tuples for new *outbound* connections (safe).
- Widen `ip_local_port_range`. Avoid the old `tcp_tw_recycle` (removed — broke NAT). The right answer is almost always "use keep-alive," not "tune sysctls."

### Q11. What are the private (RFC 1918) address ranges and how does NAT fit in?

RFC 1918 reserves three ranges for **private** networks, never routable on the public internet:

- **10.0.0.0/8** — `10.0.0.0`–`10.255.255.255` (16.7M addrs)
- **172.16.0.0/12** — `172.16.0.0`–`172.31.255.255`
- **192.168.0.0/16** — `192.168.0.0`–`192.168.255.255`

Because these can't route publicly, **NAT (Network Address Translation)** at the edge (router/cloud gateway) rewrites the private source IP:port of outbound packets to a public IP:port, tracks the mapping, and reverses it for replies — letting many private hosts share a few public IPs. This is why your laptop on `192.168.1.x` reaches the internet but the internet can't directly initiate to it. In cloud VPCs the same idea appears as private subnets + a NAT gateway for egress. Related: `100.64.0.0/10` (CGNAT) and `169.254.0.0/16` (link-local/APIPA — a `169.254.x.x` address usually means DHCP failed).

### Q12. What is the loopback interface and when does it matter?

**`lo`**, address **127.0.0.1** (IPv6 `::1`), is the virtual interface a host uses to talk **to itself** — traffic never touches a wire or NIC. Anything a machine sends to `127.0.0.1` loops back in the kernel.

```bash
ip addr show lo
# lo: <LOOPBACK,UP> ... inet 127.0.0.1/8 scope host lo
```

Why it matters operationally: services often **bind to `127.0.0.1`** (a database, a metrics endpoint, a local proxy) so they're reachable only from the same host — secure by default but **unreachable from other machines**. The classic bug: an app listening on `127.0.0.1:8080` works in local tests but "refuses connections" from another box — the fix is binding to `0.0.0.0` (all interfaces) or the specific LAN IP. Conversely, binding a sensitive admin port to `0.0.0.0` accidentally exposes it. `ss -tlnp` shows exactly which address a service bound to.

### Q13. Give a high-level overview of network interfaces, bonding, and VLANs.

An **interface** is the kernel's handle for a network connection — physical (`eth0`, `enp3s0`) or virtual (`lo`, `veth`, `br0` bridges, `docker0`, tunnels).

```bash
ip -br link          # all interfaces + up/down state
ip link set eth0 up  # bring one up
```

- **Bonding (link aggregation)** — combine several NICs into one logical `bond0` for **redundancy** (failover if one link dies) and/or **higher throughput** (active-backup, 802.3ad LACP, balance-rr modes). Common on servers with dual NICs.
- **VLAN (802.1Q)** — logically segment one physical link into multiple isolated L2 networks via a VLAN tag; appears as `eth0.100` for VLAN 100. Lets one cable carry several separated networks (prod/mgmt/storage).
- **Bridge** — a software L2 switch (`br0`) joining interfaces; the basis of VM/container networking.

You don't need to configure these from memory in most interviews, but recognizing `bond0`, `eth0.100`, `veth`, and `br0` and saying what each is for shows real infra exposure.

### Q14. How do you test connectivity to a specific port (not just ping)?

`ping` only proves ICMP reachability — it says nothing about whether the **service** is up, because firewalls often allow ICMP but block the app port. Test the actual TCP port:

```bash
nc -zv web01 443            # netcat: -z scan (no data), -v verbose; succeeds/refuses/times out
curl -v telnet://web01:443  # or curl to the real endpoint
# no nc installed? bash's built-in pseudo-device:
timeout 2 bash -c '</dev/tcp/web01/443' && echo open || echo closed
```

Interpreting results is the skill:
- **Connected/succeeded** → something is listening and reachable.
- **Connection refused** → you *reached* the host but **no process is listening** on that port (or it's bound to loopback).
- **Timed out / no route** → a **firewall dropped** it, or a routing/network problem — the packet never got an answer.

That refused-vs-timeout distinction (service-down vs firewall-block) is exactly what separates a targeted fix from flailing.

### Q15. What is MTU and how can it cause hard-to-debug failures?

**MTU (Maximum Transmission Unit)** is the largest payload a link will carry in one frame — typically **1500 bytes** on Ethernet (jumbo frames go to 9000).

```bash
ip link show eth0            # shows "mtu 1500"
ping -M do -s 1472 host      # -M do = don't fragment; 1472+28 hdr = 1500; tune to find max
```

Why it bites: if a path has a smaller MTU somewhere (VPNs, tunnels, PPPoE, some cloud overlays reduce it) and a large packet is sent with the **don't-fragment** bit, a router must drop it and return an ICMP "fragmentation needed" message (**Path MTU Discovery**). If a firewall blocks that ICMP — common — the sender never learns, and large packets are silently **black-holed**: small requests (SSH login, `ping`) work fine, but big transfers (a large HTTP response, a file copy, a TLS handshake with big certs) hang. The signature is "connects and small stuff works, but stalls on bulk data." Fixes: lower the interface MTU, enable MSS clamping on the gateway, or unblock ICMP fragmentation-needed.

### Q16. Systematically debug "this box can't reach that service."

Walk the funnel top-down; each step localizes the fault:

```bash
# 1. Name resolution — does the hostname resolve, and to the right IP?
getent hosts svc.acme.internal      # uses real nsswitch order (files+dns)
dig svc.acme.internal               # raw DNS answer (bypasses /etc/hosts)

# 2. Routing — is there a route / correct source interface?
ip route get 10.0.2.50              # which route/iface/src would be used?

# 3. Local link — is the interface up with an IP?
ip -br addr

# 4. L3 reachability (if ICMP allowed) then the ACTUAL port:
ping -c1 10.0.2.50                  # ICMP only — may be blocked
nc -zv 10.0.2.50 5432               # the port that matters

# 5. Is the service even listening (run on the TARGET)?
ss -tlnp | grep 5432

# 6. Firewall? (checked in the security topic) — timeout vs refused is the clue
```

Reasoning: **refused** = reached host, nothing listening (or bound to loopback) → fix the service. **Timeout** = firewall drop or routing black-hole → check firewall/routes. **DNS returns wrong/no IP** → fix `/etc/hosts`/DNS. Doing this in order — instead of pinging once and guessing — is the whole point of the question.

### Q17. What's the difference between "connection refused" and "connection timed out"?

They point at completely different faults, so the distinction drives your next move:

- **Connection refused** — your SYN **reached the host**, but the kernel replied with a **TCP RST** because **no process is listening** on that port (or it's bound to `127.0.0.1` only, or crashed). The network path is fine; the *service* is the problem. Fast failure.

- **Connection timed out** — your SYN got **no answer at all**. Something silently **dropped** it: a firewall/security-group with a DROP rule, a routing black-hole, or the host is down/unreachable. Slow failure (the client retries then gives up).

```bash
nc -zv host 5432
# "Connection refused"  → service not listening → check ss -tlnp on target
# "timed out"           → firewall/route/host-down → check firewall + ip route
```

A senior candidate volunteers this without prompting: "refused means it's the app, timeout means it's the network/firewall." It's one of the highest-signal, lowest-effort things to get right.

### Q18. How does DNS caching work and where can stale entries hide?

DNS answers carry a **TTL**; resolvers cache them for that long to cut latency and load. On Linux the cache can live in several places, and stale entries in any of them cause "I updated the record but the box still hits the old IP":

- **systemd-resolved** — caches per-link; flush with `resolvectl flush-caches`, inspect with `resolvectl statistics`.
- **nscd** (older systems) — name-service cache daemon; `nscd -i hosts` to invalidate.
- **The application itself** — many runtimes (notably the **JVM**) cache DNS resolutions in-process (historically forever), so restarting the app is sometimes the only fix.
- **Upstream/recursive resolvers** — your ISP's or the cloud VPC resolver caches too; you can't flush those, you wait out the TTL.

```bash
resolvectl flush-caches      # systemd-resolved
resolvectl query example.com # shows the answer + which cache/link
dig +ttl example.com         # see remaining TTL on the record
```

Practical lesson interviewers want: **set low TTLs before a planned IP change** (e.g. drop to 60 s a day ahead), because you can flush local caches but not everyone else's — the TTL is your real switchover window. `dig` shows a raw answer that may differ from what the cached, `nsswitch`-mediated app actually sees (`getent hosts`).
## Network Troubleshooting

### Summary

**What this topic covers**

The systematic diagnosis of "something can't talk to something else" on a Linux box — the single most common category of production incident an SRE will touch. This topic has 15 questions spanning the whole path a packet takes: is the physical/virtual link up, does the host have an IP and a route, does DNS resolve, does the firewall permit the flow, does TLS negotiate, and does the application actually answer? The tooling is the classic kit — `ping`, `traceroute`/`mtr`, `dig`/`nslookup`/`host`, `curl`/`wget`, `nc`/`netcat`, `tcpdump`, `ss`, `openssl s_client` — plus the interpretive skill of reading what each one's output *means*. The goal is not to memorise flags but to build a repeatable triage that narrows "the site is down" from a vague complaint to a specific broken layer in under five minutes.

**Mental model**

Think in layers, bottom-up, and bisect. A connection is a stack: **link** (is the NIC up, cable/veth attached) → **IP** (does the host have an address, is the subnet right) → **routing** (is there a route to the destination, a default gateway) → **DNS** (does the name resolve to an address) → **transport/firewall** (can a TCP SYN reach the port and get a SYN-ACK) → **TLS** (does the certificate chain and handshake succeed) → **application** (does the server return a sensible response). Every tool probes one or two of these layers. The discipline is to **localise the break before reaching for fixes**: `ping` an IP to test reachability without DNS; `ping` a name to fold DNS back in; `curl -v` to watch DNS → connect → TLS → HTTP in one shot. The two symptoms you must instantly distinguish are **connection refused** (something answered — a RST — so IP/routing is fine, but nothing is listening on that port) versus **timeout** (nothing answered — a firewall dropped it, or the host is unreachable). That one distinction routes half of all network tickets.

**Key terms**

- **`ping`** — ICMP echo; tests raw reachability + round-trip latency, independent of TCP/app.
- **`traceroute` / `mtr`** — maps the hop-by-hop path; `mtr` runs it continuously with per-hop loss stats.
- **`dig`** — the DNS query tool of record; `dig +short`, `dig @resolver name`, `dig -x ip` for reverse.
- **`curl -v`** — verbose client that narrates DNS, TCP connect, TLS, and HTTP request/response.
- **`nc` (netcat)** — swiss-army TCP/UDP tool: port checks, banner grabs, one-line listeners.
- **`tcpdump`** — packet capture with BPF filters (`host`, `port`, `and`/`or`); `-w file.pcap` for Wireshark.
- **`ss`** — socket statistics (successor to `netstat`); `ss -tlnp` shows listening TCP sockets + process.
- **`openssl s_client`** — opens a raw TLS connection to inspect certs, chain, and protocol/cipher.
- **Connection refused (RST)** — host reachable, port closed / nothing listening.
- **Connection timeout** — no response at all; firewall drop or dead route/host.
- **Path MTU** — largest packet that fits every hop; a mismatch (blocked ICMP frag-needed) causes hangs.
- **TTL** — DNS record cache lifetime; also the IP hop-count field traceroute abuses.

**Why interviewers ask this**

Network debugging is where SRE seniority shows. A junior reaches for one tool (`ping`) and, when it fails, is stuck. A senior narrates a *decision tree*: "ping the IP — if that works but the name fails, it's DNS; if the IP times out but the gateway pings, it's routing or a remote firewall; if I get connection refused, the service is down not the network." Interviewers want to hear that you distinguish **refused vs timeout**, that you know DNS is a separate failure domain, and that you reach for `tcpdump`/`ss` to get ground truth rather than guessing. Bonus signal: mentioning that ICMP being blocked doesn't mean the service is down (many networks drop ping but pass TCP), and that TLS/cert problems are their own layer. This is also a proxy for calm-under-fire: can you triage methodically when the pager is screaming?

**Common confusions**

- "Ping failed, so the site is down" — many firewalls drop ICMP while permitting TCP/443. Ping is a hint, not a verdict.
- "Connection refused and connection timeout are the same failure" — they're opposites: refused means the host answered (RST, port closed); timeout means nothing answered (drop/unreachable).
- "`nslookup` and `dig` are interchangeable" — `nslookup` is deprecated and its output is easy to misread; `dig` is the tool professionals use and quote.
- "traceroute shows the exact return path" — it shows the forward path only; return paths can differ, and later hops timing out is often just rate-limited ICMP, not a break.
- "If DNS resolves, DNS is fine" — a *stale* or *slow* resolver (high `dig` query time, wrong TTL) breaks apps even when it eventually answers.
- "curl and the browser see the same thing" — different DNS caches, proxies, and `--resolve` overrides mean curl can succeed while a browser fails, and vice-versa.

**What follows from this topic**

Network triage sits on top of the process and socket knowledge from earlier topics — `ss -tlnp` ties a listening port back to a PID, which you kill/restart with the process-management tools. Firewall behaviour (refused vs dropped) is the practical face of the **Security & Hardening** topic's iptables/nftables/ufw material, and DNS/TLS failures frequently surface first in the **Logging & Monitoring** topic's log streams. When a "network" incident turns out to be a full disk or an OOM-killed daemon, you'll fall back to the filesystem and memory topics — the systematic layered approach here is the connective tissue across all of them.

### Q1. A user reports "the site is down." Walk me through your triage.

Localise the break layer by layer, bottom-up, and bisect. My rough sequence:

1. **Reachability without DNS** — `ping 10.0.0.20` (the server's IP). Works? Link/IP/routing are fine. Fails? Drop to routing/link.
2. **DNS** — `dig +short app.acme.internal`. No answer or wrong answer → DNS is the fault. Answer looks right → keep going.
3. **Port** — `nc -vz app.acme.internal 443` or `curl -v`. **Connection refused** → service is down (nothing listening), not the network. **Timeout** → firewall drop or unreachable.
4. **TLS** — `openssl s_client -connect app.acme.internal:443`. Cert expired / chain broken shows here.
5. **App** — `curl -I https://app.acme.internal/`. 200/301? App is up. 502/503? Upstream/backend is the problem, not the network.

The whole thing is often one command: `curl -v https://app.acme.internal/` narrates DNS → connect → TLS → HTTP and tells you which stage broke. I don't reach for fixes until I know the layer.

### Q2. What is the difference between "connection refused" and "connection timed out"? Why does it matter?

This is the single most important distinction in network debugging.

| Symptom | What happened | Likely cause |
|---|---|---|
| **Connection refused** | Host sent a TCP **RST** — it's reachable, but nothing is listening on that port | Service down/crashed, wrong port, service bound to `127.0.0.1` not `0.0.0.0` |
| **Connection timed out** | **No response at all** | Firewall **DROP** rule, wrong route, host down/unreachable, security group blocking |

Refused means the network is fine and the *service* is your problem — go check `ss -tlnp` and the process. Timeout means a *packet never got an answer* — go check firewalls (local `iptables`/`nftables`, cloud security groups), routes, and whether the host is even up. Conflating the two sends you debugging the wrong layer for an hour.

```bash
nc -vz 10.0.0.20 443     # "Connection refused" vs "timed out" in the message
```

### Q3. `ping example.com` fails with "unknown host" but `ping 93.184.216.34` works. What's broken?

DNS. "Unknown host" (or "Name or service not known") means the name never resolved to an address — the ICMP layer was never even reached. Since pinging the raw IP works, reachability, routing, and the remote host are all fine. The break is purely name resolution.

Debug the resolver chain:
- `cat /etc/resolv.conf` — is there a `nameserver` line? Is it pointing somewhere sane?
- `dig example.com` — does the configured resolver answer? Try `dig @1.1.1.1 example.com` to test a known-good resolver; if that works but the default doesn't, your resolver is the fault.
- `cat /etc/nsswitch.conf` — is `hosts:` using `files dns`? A broken `/etc/hosts` entry can shadow real DNS.

Contrast with **"100% packet loss"** on a name that *did* resolve — that's a reachability/firewall problem, not DNS.

### Q4. Explain `dig`. How do you query a specific resolver and do a reverse lookup?

`dig` is the DNS diagnostic tool. Key forms:

```bash
dig app.acme.com                 # full answer, TTL, authority, query time
dig +short app.acme.com          # just the answer records — scriptable
dig @1.1.1.1 app.acme.com        # query a SPECIFIC resolver, bypass local config
dig app.acme.com MX              # a specific record type (MX, TXT, NS, AAAA)
dig -x 10.0.0.20                 # REVERSE lookup (IP -> name, via PTR records)
dig +trace app.acme.com          # walk the delegation from the root down
```

Two things I always read in the output: the **TTL** (how long it's cached — a high TTL means changes propagate slowly) and the **Query time** at the bottom (a slow resolver, say 800ms, silently degrades every app on the box). `@resolver` is how I prove "is it *our* resolver that's broken or the record itself" — if `dig @8.8.8.8` returns the right answer but `dig` (default) doesn't, the record is fine and our resolver is the problem. Prefer `dig` over the deprecated `nslookup`.

### Q5. What does `traceroute` show, and how is `mtr` better?

`traceroute` maps the **forward path** hop by hop. It sends packets with increasing IP TTL (1, 2, 3…); each router that decrements TTL to zero sends back an ICMP "time exceeded," revealing its address and the RTT to it. You see where latency spikes or where the path dies.

`mtr` (My TraceRoute) combines traceroute + ping and runs it **continuously**, giving a live table with **per-hop packet loss and latency**. That's decisive: a single traceroute might show one timed-out hop that's just a router rate-limiting ICMP (harmless). `mtr` run for 30 seconds shows *sustained* loss starting at a specific hop — that's your real break point.

Caveats: intermediate hops timing out is often benign (ICMP deprioritised). What matters is **loss that persists from a hop onward to the destination**. Loss at hop 5 that clears by hop 6 is cosmetic; loss at hop 5 that continues to the end is the problem.

### Q6. How do you use `curl -v` to debug an HTTP/HTTPS request?

`curl -v` narrates the entire request lifecycle, which makes it my default HTTP debugger:

```bash
curl -v https://app.acme.com/
```

You see, in order: DNS resolution result, the TCP connect, the **TLS handshake** (protocol, cipher, cert subject/issuer/expiry), the request headers sent (`>`), and the response headers received (`<`). Each stage that succeeds tells you the layer below is healthy.

Useful flags:
- `curl -I` — HEAD request; just headers, fast health check (status code, redirects, server).
- `curl -L` — follow redirects (see the 301→200 chain).
- `curl --resolve app.acme.com:443:10.0.0.20 https://app.acme.com/` — force a specific IP while keeping the Host/SNI, to test a backend directly bypassing DNS/LB.
- `curl -w "%{time_namelookup} %{time_connect} %{time_starttransfer}\n" -o /dev/null -s URL` — timing breakdown to find *which* stage is slow (DNS vs connect vs server).
- `curl -k` — skip cert verification (to confirm a cert error is the sole issue — never in prod clients).

### Q7. When would you use `wget` instead of `curl`, and vice-versa?

They overlap but have different centres of gravity.

| | `curl` | `wget` |
|---|---|---|
| Primary use | API/HTTP debugging, scripting, uploads | Downloading files, recursive mirroring |
| Output | stdout by default (pipe-friendly) | writes to file by default |
| Recursion | No | Yes (`-r`, mirror a site) |
| Resume | `-C -` | `-c` |
| Protocols | Huge (HTTP, FTP, SMTP, etc.) | HTTP(S), FTP |
| Verbose debug | `-v` (great) | `-d`/`-S` (weaker) |

Reach for **curl** when testing an endpoint, sending headers/JSON, or scripting an API call (`curl -X POST -d`). Reach for **wget** when you want to *download and save* a file or recursively fetch a directory, especially in a quick shell one-liner where saving to disk is the point. For interview purposes: curl is the debugging tool, wget is the fetching tool.

### Q8. How do you check whether a remote port is open with `nc`?

`nc` (netcat) probes a port without needing the actual client:

```bash
nc -vz 10.0.0.20 443       # -v verbose, -z scan (no data), check TCP/443
nc -vz -u 10.0.0.20 53     # -u for UDP (e.g. DNS)
nc -vz 10.0.0.20 20-25     # a port RANGE
```

`succeeded!` means the port is open and something is listening. `Connection refused` means reachable-but-closed; `timed out` means dropped/unreachable — same distinction as everywhere.

Beyond checks, `nc` can **grab a banner** (`nc host 22` prints the SSH version string), act as a **quick listener** (`nc -l 9000` on one box, connect from another to prove a firewall path end-to-end), or pipe data. For a pure "is this port reachable from here" test, `nc -vz` is faster than spinning up the real client.

### Q9. Explain `tcpdump`. How do you capture traffic to a specific host and port?

`tcpdump` is packet capture with **BPF filters** — the ground truth when higher-level tools disagree.

```bash
tcpdump -i eth0 host 10.0.0.20 and port 443 -n
```

- `-i eth0` — the interface (`-i any` for all).
- `host 10.0.0.20 and port 443` — BPF filter: only that host + port. Combine with `and`/`or`/`not`, `src`/`dst`.
- `-n` — don't resolve IPs/ports to names (faster, and avoids DNS lookups polluting the capture).
- `-nn` — also skip port-name resolution.
- `-c 100` — stop after 100 packets.
- `-w capture.pcap` — write raw packets to a file for **Wireshark** analysis later; `-r file.pcap` to read back.

Reading a TCP handshake live tells you a lot: you should see `SYN` → `SYN-ACK` → `ACK`. If you see the SYN leave but **no SYN-ACK returns**, the packet is being dropped upstream (firewall) — a timeout at ground level. If you see `SYN` then an immediate `RST`, the port is closed (refused). Capturing on both ends localises which direction drops.

### Q10. What does `ss` tell you, and how do you list listening services?

`ss` (socket statistics) is the modern replacement for `netstat` — faster, reads `/proc/net` directly.

```bash
ss -tlnp            # TCP, Listening, Numeric, Process — the everyday command
ss -tulnp           # add UDP
ss -tan             # all TCP sockets with state (ESTAB, TIME-WAIT, etc.)
ss -tn state established '( dport = :443 )'   # filter by state/port
```

The flags: `-t` TCP, `-u` UDP, `-l` listening only, `-n` numeric (don't resolve), `-p` show the owning process/PID.

`ss -tlnp` answers "what's actually listening here and who owns it?" — the first thing I run when a client gets *connection refused*. A classic finding: the service is bound to `127.0.0.1:8080` instead of `0.0.0.0:8080`, so it works locally but refuses every remote connection. You see that immediately in the `Local Address:Port` column (`127.0.0.1:8080` vs `0.0.0.0:8080` or `*:8080`).

### Q11. A service is up (the process is running) but clients get "connection refused." What are the likely causes?

The process running doesn't mean it's *reachable*. Refused specifically means the host answered with a RST — so something is answering, but not on the socket the client wants. Check, roughly in order:

1. **Bound to the wrong interface** — `ss -tlnp` shows `127.0.0.1:8080` instead of `0.0.0.0:8080`. It listens on loopback only, so remote clients are refused. Fix the app's bind address.
2. **Wrong port** — the app moved to 8081 but clients/LB still hit 8080; nothing listens on 8080 → refused.
3. **Not actually listening yet** — the process is up but still initialising and hasn't `bind()`+`listen()`ed. `ss -tlnp` shows no socket.
4. **A local proxy/LB in front** returning the refusal because *its* upstream is down.

Contrast: if it were a firewall, you'd get a **timeout**, not refused. Refused points you at the socket/bind, not the network path. `ss -tlnp | grep 8080` is the one-liner that usually settles it.

### Q12. Load balancer health checks pass but users get intermittent timeouts. How do you investigate?

Intermittent + timeout (not refused) points at packet loss or a subset of unhealthy backends, not a total outage.

- **Backend fan-out** — the LB health check might hit a shallow `/healthz` while real traffic hits a backend that's slow or one bad pod. Test each backend directly: `curl --resolve app.acme.com:443:10.0.0.31 https://app.acme.com/` per backend IP.
- **Packet loss on the path** — `mtr` for 60s to look for sustained per-hop loss; intermittent timeouts often trace to a flaky hop or an overloaded NIC.
- **Conntrack / connection table exhaustion** — a busy box hitting `nf_conntrack` limits drops new flows silently. Check `dmesg` for `nf_conntrack: table full, dropping packet`.
- **MTU / PMTU black hole** — large responses hang while small ones (health checks) pass, because ICMP frag-needed is blocked. Test with `ping -M do -s 1472`.
- **Capture during a failure** — `tcpdump` on a backend; if SYNs arrive but responses don't leave, it's the app/host; if SYNs never arrive, it's upstream.

The tell that separates these from a full outage is *intermittent* + *timeout*: something is dropping *some* packets.

### Q13. How do you test a TLS/SSL certificate from the command line?

`openssl s_client` opens a raw TLS connection and dumps everything about the handshake and chain:

```bash
openssl s_client -connect app.acme.com:443 -servername app.acme.com
```

`-servername` sets SNI (essential on shared hosts, or you get the wrong cert). You'll see the presented certificate chain, the negotiated protocol/cipher, and a `Verify return code` (0 = OK; anything else names the failure — expired, self-signed, unable to get local issuer = broken chain).

Quick expiry/subject checks:

```bash
echo | openssl s_client -connect app.acme.com:443 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer
```

Or just let curl tell you: `curl -v` prints the cert dates and a clear error like `certificate has expired` or `unable to get local issuer certificate` (missing intermediate). Two of the most common real-world TLS incidents are **expired certs** (renew) and **missing intermediate certificates** — the leaf is valid but the server didn't send the chain, so some clients fail; `s_client` shows only the leaf in the chain.

### Q14. What is path MTU discovery and how does a broken PMTU manifest?

MTU is the largest packet an interface will send un-fragmented (typically 1500 bytes on Ethernet). **Path MTU Discovery (PMTUD)** finds the smallest MTU along the whole path: the sender marks packets "Don't Fragment," and if a hop's MTU is smaller, that hop returns an ICMP "fragmentation needed" telling the sender to shrink.

The classic broken case: a firewall **blocks ICMP** (including frag-needed). Now the sender never learns to shrink, oversized packets are silently dropped, and you get a **PMTU black hole**. The symptom is distinctive and maddening: the **TCP handshake succeeds and small requests work, but large transfers hang** — a curl that connects fine then stalls partway, or SSH that connects then freezes on a big output. It looks intermittent and app-specific but it's a network MTU problem.

Diagnose by probing packet sizes:

```bash
ping -M do -s 1472 10.0.0.20    # 1472 + 28 hdr = 1500; if this fails but -s 1400 works, MTU is < 1500
```

Fixes: lower the MTU, or enable MSS clamping on the router/tunnel (common with VPN/PPPoE overhead).

### Q15. You suspect DNS is slow, not broken. How do you confirm and quantify it?

"Broken" DNS returns nothing; "slow" DNS eventually answers but taxes every request. Quantify it:

```bash
dig app.acme.com | grep "Query time"     # e.g. ";; Query time: 850 msec"  <- bad
```

Run it a few times: a cold query then a warm one shows whether caching helps. Compare resolvers — `dig @127.0.0.53` (local systemd-resolved stub) vs `dig @1.1.1.1` (public). If the public resolver answers in 20ms but the local one takes 800ms, the local resolver/forwarder is the bottleneck.

Also check with curl's timing breakdown, which isolates the DNS phase from connect and transfer:

```bash
curl -w "dns=%{time_namelookup}s connect=%{time_connect}s\n" -o /dev/null -s https://app.acme.com/
```

A large `time_namelookup` relative to `time_connect` proves the latency is in resolution. Common culprits: an unreachable secondary `nameserver` in `/etc/resolv.conf` being tried first (each attempt eats the timeout), missing negative caching, or `search` domains causing multiple failed lookups per name. Slow DNS is a top cause of "the app feels laggy" reports that have nothing to do with the app.

## Logging & Monitoring

### Summary

**What this topic covers**

Where a Linux system tells you what it's doing, and how you watch it — both in the calm of steady-state and the panic of an incident. This topic has 15 questions covering the on-disk log layout (`/var/log`), the syslog model (facilities and severities), the modern systemd **journald** stack (`journalctl`), the older rsyslog/syslog-ng daemons and central log forwarding, **log rotation** (logrotate and the disk-fill failure it prevents), the **kernel ring buffer** (`dmesg`, where OOM kills and hardware errors surface), and the observability layer on top: the three pillars (metrics, logs, traces), the **USE** and **RED** systematic-diagnosis methods, centralized logging (ELK/Loki), and security auditing with `auditd`. The through-line is: know where the evidence is, know how to stream it live during an incident, and know how to keep logs from filling the disk (which is itself a top-cause incident).

**Mental model**

A Linux box emits three streams of truth. (1) The **kernel ring buffer** — a fixed-size in-memory buffer the kernel writes to, read with `dmesg`; this is where OOM-killer decisions, disk errors, and driver messages appear. (2) **syslog** — the userspace logging protocol: every daemon tags a message with a **facility** (who: auth, cron, daemon, mail…) and a **severity** (how bad: emerg=0 … debug=7), and a syslog daemon (rsyslog) routes it to files under `/var/log`. (3) **journald** — systemd's structured, indexed, binary journal that captures stdout/stderr of every unit plus syslog, queryable with `journalctl`. On a modern box, journald and rsyslog often coexist: journald collects, rsyslog persists to text and forwards to a central server. Above the raw logs sits **observability**: logs (discrete events), metrics (numeric time-series), traces (request paths across services). When diagnosing, apply a *method* — **USE** (per resource: Utilization, Saturation, Errors) for infrastructure, **RED** (per service: Rate, Errors, Duration) for request-driven services — so you check systematically instead of staring.

**Key terms**

- **`/var/log`** — the conventional home for text logs: `syslog`/`messages`, `auth.log`/`secure`, `kern.log`, `dmesg`.
- **syslog facility** — the message source category (auth, authpriv, cron, daemon, kern, mail, local0–7).
- **syslog severity** — emerg(0), alert(1), crit(2), err(3), warning(4), notice(5), info(6), debug(7).
- **rsyslog / syslog-ng** — syslog daemons that route, filter, and forward log messages.
- **journald** — systemd's binary structured log store; queried by `journalctl`.
- **`dmesg`** — reads the kernel ring buffer; OOM kills, hardware/driver errors.
- **logrotate** — rotates, compresses, and prunes log files to prevent disk-fill.
- **auditd** — the Linux audit daemon; records security-relevant syscalls/events (`ausearch`, `aureport`).
- **USE method** — Utilization / Saturation / Errors, checked per resource (CPU, memory, disk, net).
- **RED method** — Rate / Errors / Duration, checked per service.
- **Three pillars** — metrics, logs, traces: the complementary observability signals.
- **ELK / Loki** — centralized log stacks (Elasticsearch+Logstash+Kibana; Grafana Loki).

**Why interviewers ask this**

When production breaks, logs are the first evidence and often the only evidence. A junior greps a single file and hopes; a senior knows the *map* — "OOM? that's `dmesg`/journald with `-k`. Auth failure? `/var/log/auth.log` or `journalctl -u sshd`. Service crash-looping? `journalctl -u app -f --since '5 min ago'`." Interviewers probe whether you can **stream logs live during an incident**, **filter by unit/priority/time** instead of scrolling, and whether you understand the disk-fill trap (a runaway log filling `/var` and taking the box down — logrotate exists for a reason). At senior level they want a *method*: USE/RED show you diagnose systematically rather than randomly. Knowing that journald is binary (you can't just `cat` it), that logs need central aggregation at scale, and that `auditd` is the tool for "who ran what," all signal real operational time.

**Common confusions**

- "journald logs are text files I can grep" — they're a **binary** journal; you query them with `journalctl`, not `cat`/`grep` on `/var/log/journal`.
- "journald replaces rsyslog" — they usually **coexist**: journald collects and indexes, rsyslog persists to `/var/log/*.log` and forwards off-box.
- "logs persist forever by default" — journald is often **volatile** (RAM, lost on reboot) unless `/var/log/journal` exists; and logrotate deletes old text logs. Configure persistence deliberately.
- "dmesg and syslog are the same" — `dmesg` is the **kernel** ring buffer; syslog is **userspace**. OOM/hardware live in dmesg.
- "more logging is always better" — verbose logging fills disks and buries signal; disk-fill from logs is itself a common outage.
- "metrics and logs are the same thing" — metrics are cheap numeric time-series for trends/alerts; logs are expensive discrete events for detail. You want both.

**What follows from this topic**

Logging is where the other topics surface their failures: the **memory** topic's OOM killer announces itself in `dmesg`/journald; the **process** topic's crash-loops show up as repeated `systemd` unit restarts in `journalctl -u`; the **Network Troubleshooting** topic's DNS/TLS errors and connection drops land in service logs first. The USE/RED methods here are the disciplined counterpart to that topic's layered network triage. And the security-relevant streams — `auth.log`, `auditd`, failed logins — feed directly into the **Security & Hardening** topic, where fail2ban and SSH auditing consume exactly these logs. Master the map here and every other incident becomes "which log, which filter, which method."

### Q1. Where do logs live on a Linux system, and what are the important files?

Traditionally under **`/var/log`**, though on a systemd box much of this is a text mirror of the journal:

- **`/var/log/syslog`** (Debian/Ubuntu) / **`/var/log/messages`** (RHEL) — the catch-all general system log.
- **`/var/log/auth.log`** (Debian) / **`/var/log/secure`** (RHEL) — authentication: sudo, sshd logins, PAM. First stop for security questions.
- **`/var/log/kern.log`** — kernel messages (also in `dmesg`).
- **`/var/log/dmesg`** — kernel ring buffer snapshot from boot.
- **`/var/log/journal/`** — the systemd **binary** journal (not human-readable directly; use `journalctl`).
- Application dirs — `/var/log/nginx/`, `/var/log/apt/`, `/var/log/cloud-init.log`, etc.

The Debian-vs-RHEL split (`syslog`/`auth.log` vs `messages`/`secure`) trips people up, so I name both. On a pure-systemd host, always keep in mind that `/var/log/journal` is the source of truth and the text files may be a subset written by rsyslog.

### Q2. Explain the syslog model — facilities and severities.

Syslog tags every message with two dimensions so daemons can route and filter it.

**Facility** = *who* sent it: `kern`, `user`, `mail`, `daemon`, `auth`, `authpriv`, `cron`, `syslog`, plus `local0`–`local7` for custom apps. This lets rsyslog send, say, all `auth` messages to `auth.log` and all `mail` to `mail.log`.

**Severity** = *how bad*, 0 (most severe) to 7 (least):

| Level | Name | Meaning |
|---|---|---|
| 0 | emerg | system unusable |
| 1 | alert | act immediately |
| 2 | crit | critical condition |
| 3 | err | error |
| 4 | warning | warning |
| 5 | notice | normal but notable |
| 6 | info | informational |
| 7 | debug | debug detail |

An rsyslog rule like `auth,authpriv.*` or `*.err` selects by `facility.severity`. In journald the equivalent is `journalctl -p err` (priority filter, using the same 0–7 scale). Knowing the scale lets you say "show me warning and worse" (`-p warning`) instead of drowning in `info`/`debug`.

### Q3. What is journald and how do you query it with journalctl?

**journald** is systemd's logging service. It captures stdout/stderr of every unit, kernel messages, and syslog, and stores them in an **indexed binary journal** with rich metadata (unit, PID, UID, boot ID, priority). Because it's structured, you query by field instead of grepping text.

Everyday `journalctl`:

```bash
journalctl -u nginx.service        # logs for one unit
journalctl -u nginx -f             # follow live (like tail -f)
journalctl -u nginx --since "10 min ago" --until "5 min ago"
journalctl -p err                  # priority: err and worse (0..7 scale)
journalctl -b                      # this boot only;  -b -1 = previous boot
journalctl -k                      # kernel messages only (dmesg equivalent)
journalctl -u app -o json-pretty   # structured output with all fields
journalctl --disk-usage            # how big is the journal
```

The killer combo during an incident is `journalctl -u app -f -p warning --since "5 min ago"` — one unit, live, warnings-and-worse, recent. Because it's binary, you **can't** `cat /var/log/journal/*`; `journalctl` is mandatory, which is the #1 gotcha for people coming from text-log systems.

### Q4. Is the journal persistent across reboots? How do you make it so?

Not by default on many distros — journald storage can be **volatile**, living in `/run/log/journal` (tmpfs, RAM), so it's **lost on reboot**. That's a nasty surprise when you reboot to fix something and lose the logs explaining why.

It becomes **persistent** when `/var/log/journal/` exists. Control it in `/etc/systemd/journald.conf`:

```ini
[Journal]
Storage=persistent      # auto|persistent|volatile|none
SystemMaxUse=1G         # cap total journal size
MaxRetentionSec=1month
```

```bash
mkdir -p /var/log/journal
systemctl restart systemd-journald
```

`Storage=persistent` forces on-disk. Also cap it (`SystemMaxUse`) so the journal itself doesn't fill `/var` — journald auto-vacuums to stay under the cap, and `journalctl --vacuum-size=500M` / `--vacuum-time=7d` prunes manually. The interview point: check `journalctl -b -1` early — if it errors "no previous boot," your journal is volatile and you should fix that *before* the next incident.

### Q5. How do journald and rsyslog work together?

They coexist by design on most modern distros. **journald** is the collector — it captures everything (unit stdout/stderr, kernel, syslog) into its structured binary store. **rsyslog** then reads from journald (via the `imjournal` or `imuxsock` input module) and does the things journald doesn't: writes classic **text files** (`/var/log/syslog`, `/var/log/auth.log`) that other tools grep, applies facility/severity routing rules, and **forwards logs off the box** to a central server.

So the typical flow is: app → journald (collect + index locally) → rsyslog (persist to text + forward to central log server). You get journald's fast local querying (`journalctl`) *and* rsyslog's forwarding/aggregation. Neither fully replaces the other: journald has no built-in network forwarding to arbitrary syslog servers, and rsyslog gives you the text logs and central pipeline that ops tooling still expects.

### Q6. How do you forward logs to a central server?

Use rsyslog (or syslog-ng) as a forwarder. In `/etc/rsyslog.conf` or a drop-in under `/etc/rsyslog.d/`:

```conf
# forward everything to a central collector
# @@ = TCP (reliable), @ = UDP (fire-and-forget)
*.* @@logserver.acme.internal:514
```

`@@host:514` is **TCP** (reliable, ordered, survives brief blips with a queue); a single `@` is **UDP** (lossy but lightweight). Production uses TCP, often with RELP or TLS for reliability/encryption, and a disk-assisted queue so logs buffer locally if the collector is down instead of being dropped.

On the collector, rsyslog listens (`module(load="imtcp") input(type="imtcp" port="514")`) and writes incoming logs, usually keyed by source host. At larger scale this feeds a proper aggregation stack (ELK/Loki) rather than flat files. Central logging matters because during an incident you often *can't* reach the dying box to read its local logs — they need to already be elsewhere.

### Q7. What is log rotation and why is logrotate essential?

Logs grow without bound; a chatty service can fill `/var` and take the whole box down (disk-full is a classic self-inflicted outage). **logrotate** prevents that by periodically rotating logs: renaming the current file, starting a fresh one, compressing old ones, and deleting the oldest.

Config lives in `/etc/logrotate.conf` and `/etc/logrotate.d/<service>`:

```conf
/var/log/nginx/*.log {
    daily              # rotate frequency
    rotate 14          # keep 14 old files, then delete
    compress           # gzip rotated files
    delaycompress      # keep the most recent rotation uncompressed
    missingok          # don't error if the log is absent
    notifempty         # skip empty logs
    size 100M          # OR rotate when it hits 100M (whichever first)
    postrotate
        systemctl reload nginx    # tell the daemon to reopen its file handle
    endscript
}
```

The subtle bit is `postrotate`/`copytruncate`: after renaming the file, the daemon is still writing to the old inode, so you either signal it to reopen (`postrotate ... reload`) or use `copytruncate` (copy then truncate in place). Get this wrong and the app keeps writing to the deleted-but-open file, and disk usage doesn't actually drop until restart.

### Q8. What is `dmesg` and the kernel ring buffer? What lives there?

`dmesg` prints the **kernel ring buffer** — a fixed-size in-memory buffer the kernel writes its own messages to. "Ring" because it's circular: once full, new messages overwrite the oldest. It's distinct from syslog (which is userspace).

What surfaces there, and why it matters in incidents:

- **OOM killer** — `Out of memory: Killed process 4211 (java)`. When memory is exhausted, the kernel kills a process and *only announces it here* (and in journald). If a service "just disappeared," `dmesg | grep -i oom` is the first check.
- **Hardware / disk errors** — `I/O error`, `ata bus error`, failing-disk SMART messages, filesystem going read-only.
- **Segfaults**, driver messages, network device up/down, connection-tracking table-full drops.

```bash
dmesg -T              # human-readable timestamps (raw dmesg uses seconds-since-boot)
dmesg -l err,crit     # filter by level
dmesg -w              # follow (like tail -f) for the kernel
journalctl -k         # the same kernel messages, via journald, with history across boots
```

`dmesg -T` (real timestamps) and `journalctl -k -b -1` (kernel log from the *previous* boot, which the ring buffer loses) are the pro moves.

### Q9. What are the three pillars of observability?

**Metrics, logs, and traces** — three complementary signal types.

- **Metrics** — numeric time-series (CPU %, request rate, error count, latency p99), cheap to store and aggregate. Great for **dashboards and alerting** ("error rate > 1%") and spotting *that* something changed. Tools: Prometheus, Grafana.
- **Logs** — discrete, timestamped event records with detail (stack traces, request params). Great for **the why** once metrics tell you *when*. Expensive at volume. Tools: ELK, Loki.
- **Traces** — the path of a single request across services, with timing per span. Great for **where** in a distributed system the latency/error lives. Tools: Jaeger, Tempo, OpenTelemetry.

They answer different questions: metrics say *something is wrong and roughly when*, traces say *which service/hop*, logs say *exactly what*. Mature observability correlates them (a spike in the latency metric → the slow trace → the error log line), often via a shared **request-id** threaded through all three. Relying on only one leaves a blind spot: metrics-only can't explain *why*; logs-only can't cheaply show *trends*.

### Q10. Explain the USE method and the RED method for diagnosis.

Both are checklists so you diagnose systematically instead of poking randomly.

**USE** (Brendan Gregg) — for each **resource** (CPU, memory, disk, network, I/O), check:
- **Utilization** — % time busy (e.g. CPU at 95%).
- **Saturation** — queued/waiting work it can't service yet (run-queue length, swap activity, disk I/O wait).
- **Errors** — error counts (NIC drops, disk I/O errors, ECC errors).

USE is for **infrastructure**: walk every resource, and the one showing high saturation or errors is your bottleneck. Example: CPU utilization low but load average high → look at **saturation** on disk (D-state, uninterruptible I/O wait).

**RED** — for each **service/request path**, track:
- **Rate** — requests per second.
- **Errors** — failed requests per second.
- **Duration** — latency distribution (p50/p95/p99).

RED is for **request-driven services**: it maps directly onto SLOs and user pain. A rising Error rate or p99 Duration tells you the service is unhealthy even if the box's USE metrics look fine. Use USE to find a saturated *resource*, RED to find an unhealthy *service* — together they cover both layers.

### Q11. A service is crash-looping. How do you use logs to find out why?

The unit restarting on a loop leaves a clear trail in journald.

```bash
systemctl status app.service          # current state, last few log lines, restart count
journalctl -u app.service -n 100 --no-pager      # last 100 lines for the unit
journalctl -u app.service -f          # follow live and watch the next crash happen
journalctl -u app.service -p err      # just errors, cut the noise
journalctl -u app.service --since "10 min ago"
```

`systemctl status` shows the restart cadence and exit code (e.g. `status=1` app error, `status=137` = 128+9 = SIGKILL, often OOM). Then read the journal *just before each restart* — the real cause is the last error line before systemd logs "Main process exited... scheduled restart."

If the exit is 137/OOM, cross-check `dmesg -T | grep -i oom` — the kernel killed it, so the app log may show nothing, the truth is in the ring buffer. If it exits instantly with a config error, you'll see the parse/bind failure at the top of each restart cycle (e.g. `address already in use` → something else holds the port; check `ss -tlnp`).

### Q12. What is centralized logging (ELK / Loki) and why aggregate logs?

At more than a handful of hosts, logging into each box to grep is unworkable — and when a box dies you lose its logs. Centralized logging ships every host's logs to one searchable place.

**ELK** — **E**lasticsearch (indexed store + search), **L**ogstash (ingest/parse/transform pipeline; or lightweight **Filebeat** shippers), **K**ibana (query + dashboards). Powerful full-text search, heavier to run.

**Loki** (Grafana) — indexes only **labels** (not full text), stores raw log lines cheaply, queried with LogQL in Grafana. Cheaper and simpler, pairs naturally with Prometheus metrics; you trade some search power for cost.

Why aggregate: (1) **survivability** — logs outlive the host that made them; (2) **correlation** — search across all services at once for a request-id or error; (3) **retention & compliance**; (4) **alerting** on log patterns. The design tension is cost vs searchability: index everything (ELK) and it's fast but expensive; index labels only (Loki) and it's cheap but you filter more. Either way, thread a **request-id** through services so you can follow one request across every host's logs.

### Q13. What is auditd and when do you use it over syslog?

**auditd** is the Linux Audit daemon — it hooks the kernel audit subsystem to record **security-relevant events** at the syscall level: file access, permission changes, user logins, and any rule-matched syscall. It's the tool for "**who did what, when**," which ordinary syslog can't reliably answer.

You write rules in `/etc/audit/rules.d/`:

```bash
# watch a sensitive file for any write/attribute change, tag it "passwd_changes"
auditctl -w /etc/passwd -p wa -k passwd_changes
# watch a directory
auditctl -w /etc/ssh/ -p wa -k ssh_config
```

Query with `ausearch -k passwd_changes` and summarise with `aureport`.

Use auditd over syslog when you need **tamper-evident, complete** records for security/compliance (PCI, CIS benchmarks, forensic "who deleted this file"). Syslog logs what applications *choose* to log; auditd logs what the *kernel* observed, so an attacker can't simply not-log their action. Cost: it's verbose and can be heavy, so you scope rules to what matters (auth, sensitive files, privilege changes) rather than auditing everything.

### Q14. How do you prevent runaway logs from filling the disk?

Disk-full from logs is a common self-inflicted outage — `/var` fills, the app can't write, and things cascade. Defences, layered:

1. **logrotate** — the primary control: rotate by `size`/`daily`, `compress`, and `rotate N` to cap how many are kept. Make sure chatty apps have a drop-in in `/etc/logrotate.d/`.
2. **Cap the journal** — `SystemMaxUse=1G` in `journald.conf` (or `journalctl --vacuum-size=500M`) so the binary journal self-limits.
3. **Separate partition** — put `/var/log` on its own filesystem/LVM volume so a log flood fills *that* and not root `/`, keeping the system usable.
4. **Alert on disk usage** — a `df`-based alert at 80% gives you runway before 100%.
5. **Fix the source** — a log spamming millions of lines/minute is usually a bug or wrong log level; drop it from `debug` to `warning`. Rotation buys time, but a truly runaway logger needs the tap turned down.

The `copytruncate`/`postrotate` gotcha from logrotate matters here too: if the daemon keeps writing to a deleted-but-open inode, rotating won't free space until you signal it to reopen the file. `lsof +L1` finds those "deleted but held open" files eating disk.

### Q15. During an incident, how do you watch logs live and correlate across sources?

Get eyes on the live stream immediately, filtered to the relevant unit, and correlate by time and request-id.

```bash
journalctl -u app -f -p warning              # live, this unit, warnings+ only
journalctl -f                                # everything live (firehose)
tail -f /var/log/nginx/error.log             # classic text-log follow
journalctl --since "10:31:00" --until "10:34:00"   # bound to the incident window
```

Correlation technique:
- **Timestamp alignment** — pin the exact minute the alert fired and pull *every* source (`journalctl --since/--until`, app log, LB log) for that window; a cause in one service often shows a few seconds before the effect in another. Make sure clocks are NTP-synced or correlation lies.
- **Request-id** — grep the shared trace/request id across services (`journalctl | grep $REQ_ID`, or one query in Kibana/Loki) to follow a single request end-to-end.
- **Multi-tail** — `multitail`, `tmux` panes, or a Grafana/Kibana live view to watch several streams side by side.

The discipline: narrow by **unit + priority + time window** rather than scrolling a firehose, and lean on centralized logging so you're querying one place instead of ssh-ing to dying hosts. Pair this with the RED metrics to know *when* to bound the window and *which* service degraded first.

## Security & Hardening

### Summary

**What this topic covers**

How to lock down a Linux server and reason about its attack surface — the SRE/DevOps half of security, not exploit-writing. This topic has 16 questions covering **SSH** (key vs password auth, `authorized_keys`, `sshd_config` hardening, agent-forwarding risk, host keys), the **principle of least privilege** and `sudo`, **firewalls** (iptables tables/chains, nftables as the successor, `ufw`/`firewalld` frontends, default-deny), **fail2ban** for brute-force mitigation, **Mandatory Access Control** — SELinux (enforcing/permissive, contexts, `audit2allow`) versus AppArmor (profiles) — **patching** (unattended-upgrades, CVEs), **file integrity and immutable bits**, **secrets management** (never commit secrets, file permissions like `600`), disabling unused services and closing ports, the **SUID** risk, security **auditing** (auditd, `last`/`lastb`), and a practical "harden a fresh server" checklist. The unifying idea is **defence in depth with a default-deny posture**: minimise what's exposed, authenticate strongly, constrain what each process can do, and keep an audit trail.

**Mental model**

Security hardening is **attack-surface reduction plus least privilege plus auditability**, applied in layers so no single failure is fatal. Reduce surface: every open port, running service, and privileged account is a way in — close, stop, or downgrade each one you don't need. Authenticate strongly: SSH keys not passwords, root login off, brute-force auto-banned. Constrain blast radius: `sudo` instead of root, MAC (SELinux/AppArmor) so a compromised web server can't read `/etc/shadow` even as root, file permissions and immutable bits on sensitive files. Keep evidence: auth logs, auditd, `last`/`lastb` so you can answer "who got in and what did they touch." The organising principle throughout is **default-deny**: firewalls drop by default and allow explicitly; sudoers grant specific commands not blanket root; MAC denies unless a policy permits. You assume any one control can fail — a leaked key, an unpatched CVE — and layer the others so the attacker still hits a wall. "It's always DNS" has a security sibling: "it's always SELinux" — because MAC silently denies things that look like app bugs.

**Key terms**

- **Key-based SSH auth** — asymmetric keypair; public key in `~/.ssh/authorized_keys`, private key never leaves the client.
- **`sshd_config`** — the SSH server config; hardening knobs like `PermitRootLogin no`, `PasswordAuthentication no`.
- **Least privilege** — grant the minimum access needed; `sudo` for scoped elevation instead of root.
- **iptables / nftables** — the kernel packet-filter (netfilter); nftables is the modern successor to iptables.
- **ufw / firewalld** — friendlier frontends over nftables/iptables (Ubuntu / RHEL respectively).
- **default-deny** — drop everything by default, allow only what's explicitly needed.
- **fail2ban** — scans auth logs and bans IPs that brute-force (via firewall rules).
- **SELinux** — MAC via labels/contexts; modes enforcing/permissive/disabled; `getenforce`/`setenforce`.
- **AppArmor** — MAC via path-based profiles; Ubuntu's default MAC.
- **SUID/SGID** — bits that run a binary as its owner/group; a classic privilege-escalation vector.
- **unattended-upgrades** — automatic security patching (Debian); `dnf-automatic` on RHEL.
- **auditd / lastb** — security event auditing; `last` shows logins, `lastb` failed login attempts.

**Why interviewers ask this**

A server exposed to the internet is under automated attack within minutes, so hardening is table stakes for anyone touching production. Interviewers separate people who've actually run exposed servers from people who haven't by asking for a **concrete hardening checklist** and probing the *reasons*: why keys over passwords (keys aren't brute-forceable, aren't reused, aren't phished as easily), why `PermitRootLogin no` (removes the single most-attacked account and forces an audit trail via named users + sudo), why default-deny (allowlists fail safe; denylists forget something). They want to hear **least privilege** as a reflex, awareness that **SELinux/AppArmor** exist and how to debug them (rather than the junior move of disabling SELinux the moment something breaks), and a real answer on **secrets** — that committing a key to git is a resume-generating event and env/`600`-perm files plus a vault are the fix. It's also a maturity check: do you patch proactively (unattended-upgrades, CVE watch) or only after an incident?

**Common confusions**

- "SSH keys are encrypted so they're safe to share" — the **private** key never leaves your client; you distribute only the **public** key. Sharing a private key defeats the whole model.
- "Disabling SELinux is a normal fix" — it's the junior reflex. `setenforce 0` to *test* a hypothesis is fine; leaving it disabled removes a whole defence layer. Fix the context with `audit2allow` instead.
- "iptables and nftables are competitors you run together" — nftables is the **successor**; running both rule sets simultaneously causes confusion. Modern distros use nftables (often behind `iptables-nft`).
- "A firewall makes the app secure" — it reduces surface but does nothing against a vulnerable app on an *open* port. Defence in depth, not a single wall.
- "Root login over SSH is fine if the password is strong" — root is the universally-targeted account; disabling it removes the guessing target and forces per-user accountability.
- "Secrets in an env var / private repo are safe" — private repos get cloned, forked, and leaked; env vars leak into logs and `/proc`. Neither replaces a real secrets manager and tight file perms.

**What follows from this topic**

Hardening consumes the outputs of the other topics and closes the loop. The firewall material is the enforcement side of the **Network Troubleshooting** topic's "refused vs dropped" — a default-deny DROP rule *is* the timeout you diagnosed there. The auth logs, `auditd`, and `lastb` here are exactly the streams the **Logging & Monitoring** topic taught you to collect and centralize, and fail2ban is an automated consumer of them. Least privilege and the SUID/permission-bit discussion build directly on the users-and-permissions fundamentals from earlier topics, and MAC (SELinux/AppArmor) plus namespaces/cgroups are the same isolation primitives that underpin container security. Hardening is where all the prior knowledge becomes a defensive posture.

### Q1. Why is key-based SSH authentication preferred over passwords?

Keys win on every security axis:

- **Not brute-forceable** — a password can be guessed; a 4096-bit RSA or Ed25519 key cannot be feasibly brute-forced. Password auth on an exposed box faces thousands of guesses a day.
- **The secret never travels** — with keys, the **private key stays on the client**; only the public key sits on the server (`~/.ssh/authorized_keys`). A server compromise doesn't leak your credential. With passwords, the secret is transmitted (over the encrypted channel, but still typed and reused).
- **Not reused / not phishable** — people reuse passwords across services; a per-host keypair isn't reused, and there's nothing to phish by tricking a user into typing it.
- **Revocable per-user** — remove one line from `authorized_keys` to cut off one person.

The model is asymmetric crypto: the server encrypts a challenge with your public key; only your private key can answer, proving identity without sending a shared secret. The standard hardening move is to disable password auth entirely (`PasswordAuthentication no`) once keys work, so brute-force attacks have literally nothing to guess. Protect the private key with a passphrase and use ssh-agent so you're not typing it constantly.

### Q2. Walk me through hardening sshd_config.

Edit `/etc/ssh/sshd_config` (or a drop-in in `/etc/ssh/sshd_config.d/`), then `sshd -t` to validate and `systemctl reload sshd`. The high-value settings:

```conf
PermitRootLogin no              # never log in as root directly; use a user + sudo
PasswordAuthentication no       # keys only — kills brute-force
PubkeyAuthentication yes
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no                # off unless needed
AllowUsers alice bob           # allowlist who may log in
MaxAuthTries 3                  # limit guesses per connection
ClientAliveInterval 300         # drop idle sessions
Protocol 2                      # (default now) SSH-2 only
```

The two that matter most: **`PermitRootLogin no`** (removes the single most-attacked account and forces named users + sudo, giving you an audit trail) and **`PasswordAuthentication no`** (leaves brute-forcers nothing to guess). Changing the port off 22 (`Port 2222`) cuts log noise from automated scanners but is **obscurity, not security** — don't count it as a real control. Always keep an existing session open and test a new login in a second terminal before you disconnect, so a config typo doesn't lock you out.

### Q3. What is the principle of least privilege, and how does sudo implement it?

**Least privilege**: every user, process, and service gets the *minimum* access required to do its job, and nothing more. So a compromise or mistake has the smallest possible blast radius — a web server that only needs to read `/srv/app` can't wipe `/etc` if it runs as an unprivileged user.

**`sudo`** implements it for humans: instead of sharing the root password or logging in as root, users log in as themselves and elevate for *specific* actions, all logged to `/var/log/auth.log`. `/etc/sudoers` (edited via `visudo`, which syntax-checks) can scope grants tightly:

```sudoers
# alice may restart nginx and nothing else — not full root
alice ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
# the deploy group may run the deploy script as the app user
%deploy ALL=(app) /usr/local/bin/deploy.sh
```

The wins over shared root: **accountability** (auth.log records *who* ran *what*), **scoping** (grant one command, not a shell), and **revocability** (remove one sudoers line). The anti-pattern is `alice ALL=(ALL) NOPASSWD: ALL` — that's just root with extra steps and no real constraint. Least privilege also applies to services: run daemons as dedicated unprivileged users, use systemd sandboxing (`ProtectSystem`, `NoNewPrivileges`, `PrivateTmp`).

### Q4. Explain iptables — tables and chains.

`iptables` is the userspace tool for the kernel's **netfilter** packet filter. It's organised as **tables** containing **chains** of rules.

**Tables** (by purpose):
- **filter** — the default; ACCEPT/DROP/REJECT decisions.
- **nat** — address translation (SNAT/DNAT, port forwarding, masquerade).
- **mangle** — packet header modification (TOS, TTL, marks).
- **raw** — connection-tracking exemptions.

**Chains** (hook points, in the filter table):
- **INPUT** — packets destined *for this host*.
- **OUTPUT** — packets *originating from this host*.
- **FORWARD** — packets *routed through* this host (routers, containers, NAT).

Each chain has a **default policy** (ACCEPT or DROP) applied if no rule matches. Rules match on source/dest IP, port, protocol, interface, and connection state, with a target (`-j ACCEPT/DROP/REJECT`).

```bash
iptables -L -n -v                                  # list filter rules with counters
iptables -A INPUT -p tcp --dport 22 -j ACCEPT      # allow SSH in
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT  # allow replies
iptables -P INPUT DROP                              # default-deny inbound
```

The key design is **default-deny**: set `-P INPUT DROP`, then explicitly ACCEPT the handful of things you need (SSH, 443, established connections). A denylist ("block these bad ports") always forgets one; an allowlist fails safe.

### Q5. What is nftables and how does it relate to iptables?

**nftables** is the modern replacement for iptables (and ip6tables/arptables/ebtables), sharing the same netfilter kernel hooks but with a cleaner, unified design. It's the successor, not a competitor.

Why it's better:
- **One tool** for IPv4, IPv6, ARP, bridging — instead of four separate iptables variants.
- **One combined rule set** with a better syntax (`nft` command, config in `/etc/nftables.conf`), sets/maps as first-class citizens, and atomic rule replacement (no rule-by-rule race).
- **Better performance** on large rule sets.

```bash
nft list ruleset                                   # show everything
nft add rule inet filter input tcp dport 22 accept
```

The relationship in practice: modern distros (RHEL 8+, Debian 10+) use nftables **as the backend**, often with an `iptables-nft` shim so old `iptables` commands still work by translating to nftables under the hood. The gotcha is running *both* legacy iptables and native nftables rule sets at once — they can both be active and it's confusing to reason about. Pick one. For most people, you interact with a frontend (ufw/firewalld) that drives nftables anyway.

### Q6. What are ufw and firewalld?

Frontends that make the firewall usable without hand-writing iptables/nftables rules.

**ufw** ("Uncomplicated FireWall", Ubuntu/Debian) — simple, verb-based:

```bash
ufw default deny incoming        # default-deny posture
ufw default allow outgoing
ufw allow 22/tcp                 # or: ufw allow OpenSSH
ufw allow 443/tcp
ufw enable
ufw status verbose
```

**firewalld** (RHEL/Fedora) — **zone-based**, dynamic (change rules without flushing connections):

```bash
firewall-cmd --set-default-zone=public
firewall-cmd --zone=public --add-service=https --permanent
firewall-cmd --reload            # --permanent needs a reload to take effect
```

firewalld's zones (`public`, `internal`, `trusted`, `dmz`…) let you apply different rule sets per interface/network — handy on multi-homed hosts. Both compile down to nftables/iptables; you rarely need the raw tools day-to-day. The important habit either way is **`default deny incoming` + explicit allows**. The firewalld `--permanent` vs runtime split trips people up: without `--permanent` the rule vanishes on reload; with only `--permanent` it doesn't apply until you `--reload`.

### Q7. What does fail2ban do and how?

**fail2ban** automatically bans IP addresses that show malicious patterns — primarily SSH (and web/mail) brute-force. It's a log-watcher wired to the firewall.

How it works: **jails** each define a **filter** (a regex matching failure lines in a log) and an **action** (usually add a firewall DROP for the offender). It tails logs like `/var/log/auth.log`; when an IP exceeds `maxretry` failures within `findtime`, fail2ban bans it for `bantime` by inserting an iptables/nftables rule.

```ini
# /etc/fail2ban/jail.local
[sshd]
enabled  = true
maxretry = 5           # 5 failures...
findtime = 10m         # ...within 10 minutes...
bantime  = 1h          # ...earns a 1-hour ban
```

```bash
fail2ban-client status sshd      # who's banned, counts
fail2ban-client set sshd unbanip 10.0.0.99
```

It dramatically cuts the noise and risk from automated scanners hammering SSH. Note it's a *complement* to key-only auth, not a replacement — with `PasswordAuthentication no` there's nothing to brute-force, but fail2ban still trims connection spam and covers other services. Watch out for banning yourself (whitelist your management IPs via `ignoreip`).

### Q8. Compare SELinux and AppArmor.

Both are **Mandatory Access Control (MAC)** — they constrain what a process can do *beyond* standard Unix permissions, so even a root-running compromised service is boxed in. The difference is how they identify what to confine.

| | SELinux | AppArmor |
|---|---|---|
| Model | **Label/context**-based (every file, process, port has a security context) | **Path**-based profiles |
| Default on | RHEL/Fedora/CentOS | Ubuntu/SUSE |
| Granularity | Very fine, very powerful | Simpler, easier to read/write |
| Learning curve | Steep | Gentle |
| Modes | enforcing / permissive / disabled | enforce / complain (per profile) |
| Debug tool | `audit2allow`, `ausearch` | `aa-logprof`, `aa-complain` |

**SELinux** labels everything (e.g. `httpd_sys_content_t` on web files) and policy dictates which contexts may interact — powerful but notoriously fiddly (`ls -Z`, `chcon`, `restorecon`). **AppArmor** confines by filesystem path in a human-readable profile — less granular but far easier to author and reason about. Both let a policy say "the web server may read `/srv/app` and bind :443, and *nothing else*," so a web-app exploit can't read `/etc/shadow` even as root. Which you use is mostly dictated by your distro.

### Q9. SELinux is blocking your app. How do you debug it (without disabling it)?

First, confirm SELinux is actually the culprit — the running joke is "it's always SELinux" for exactly this reason. Set it **permissive temporarily** to test the hypothesis:

```bash
getenforce                 # Enforcing / Permissive / Disabled
setenforce 0               # permissive: log denials but don't block (RUNTIME only, not a fix)
```

If the app works in permissive, SELinux was blocking it. Now find the specific denial rather than leaving it off:

```bash
ausearch -m avc -ts recent            # AVC (Access Vector Cache) denials — the SELinux "deny" log
# or: grep denied /var/log/audit/audit.log
```

Then fix it properly, in order of preference:
1. **Correct the context** if it's mislabelled — e.g. web content in a non-standard dir needs `httpd_sys_content_t`: `semanage fcontext -a -t httpd_sys_content_t "/srv/app(/.*)?" && restorecon -Rv /srv/app`.
2. **Toggle a boolean** if one exists for your case: `setsebool -P httpd_can_network_connect on`.
3. **Generate a targeted policy** only if truly needed: `ausearch -m avc -ts recent | audit2allow -M myapp && semodule -i myapp.pp` — but read what `audit2allow` proposes; blindly allowing everything defeats the point.

Then `setenforce 1` back to enforcing. The anti-pattern is `SELINUX=disabled` in `/etc/selinux/config` and walking away — that throws out a whole defence layer to avoid a five-minute context fix.

### Q10. How do you keep a Linux system patched, and what's a CVE?

A **CVE** (Common Vulnerabilities and Exposures) is a public identifier for a specific known vulnerability, e.g. `CVE-2021-4034` (PwnKit). Vendors publish advisories mapping CVEs to fixed package versions; your job is to get those fixes deployed before attackers exploit them.

**Automatic security patching:**
- Debian/Ubuntu — **unattended-upgrades**: `apt install unattended-upgrades`, configured in `/etc/apt/apt.conf.d/50unattended-upgrades` to auto-apply the *security* pocket. Reboots for kernel updates can be scheduled (`Unattended-Upgrade::Automatic-Reboot`).
- RHEL/Fedora — **dnf-automatic**: enable `dnf-automatic-install.timer` to download+apply.

**Manual / operational:**
```bash
apt update && apt upgrade                     # Debian
dnf check-update && dnf upgrade --security     # RHEL, security-only
```

The tension is patch-fast (security) vs stability (don't auto-break prod at 3am). A common posture: **auto-apply security updates automatically**, apply feature/kernel updates on a scheduled maintenance window, and use **livepatch/kpatch** to patch the kernel without rebooting where uptime matters. Track CVEs relevant to your stack (distro security mailing lists, `oscap`/vulnerability scanners) so you're not blindsided by a critical like a remote-code-exec in your web server. Patching is the control with the highest ROI and the one most often neglected until an incident.

### Q11. What are file immutable bits and how do they help?

Beyond standard `rwx` permissions, ext4/xfs support extended attributes set with `chattr`. The headline one is **immutable** (`+i`): a file that **cannot be modified, deleted, renamed, or linked to — even by root** — until the bit is removed.

```bash
chattr +i /etc/resolv.conf     # freeze it — nothing can change it, even root
lsattr /etc/resolv.conf         # show attributes (----i---------)
chattr -i /etc/resolv.conf     # remove it to allow changes again
```

Also useful: **append-only** (`+a`) — the file can only be appended to, not overwritten or truncated, which is excellent for **logs you don't want an attacker to tamper with or wipe** (they can add lines but can't erase their tracks).

How it helps security: it protects critical config (`/etc/passwd`, `/etc/resolv.conf` that keeps getting stomped by DHCP, sudoers) from accidental *or malicious* modification, and append-only frustrates log-wiping. The caveat: it's a speed-bump, not a wall — an attacker with root can `chattr -i` and then modify (unless you've also locked down capabilities via MAC or `securelevel`). It's a defence-in-depth layer, best combined with file-integrity monitoring (AIDE/Tripwire) that *alerts* when a watched file changes.

### Q12. How should secrets be managed on a Linux server?

The rules, roughly in priority order:

1. **Never commit secrets to git.** A key in a repo — even a private one — is compromised: repos get cloned, forked, backed up, and history is forever. If it happens, **rotate the secret immediately** (revoke, don't just delete the commit — it's in history and clones). Use `.gitignore`, pre-commit secret scanners (gitleaks), and history-rewrite tools if one slips.
2. **Lock down file permissions.** A secret in a file must be `600` (owner read/write only) or `400`, owned by the service user: `chmod 600 /etc/app/secret.key`. SSH refuses to use a private key that's group/world-readable, for exactly this reason.
3. **Prefer a secrets manager** over files/env for anything real — HashiCorp Vault, AWS Secrets Manager, `systemd` credentials — so secrets are centrally rotated, access-audited, and never sit at rest in plaintext.
4. **Env vars vs files** — env vars are convenient but leak: they show in `/proc/<pid>/environ`, get inherited by child processes, and end up in logs/crash dumps. Files with tight perms are often safer; a mounted secret (tmpfs) better still.

The interview signal is treating a leaked secret as **rotate-now**, not "delete the file." And knowing that "it's in a private repo / an env var" is *not* secure enough for production credentials.

### Q13. Why disable unused services and close ports?

Every running service is **attack surface** — a listening socket is a door, and a door you don't use is a door you forgot to lock. The fewer services, the fewer potential vulnerabilities, the fewer things to patch, and the smaller the chance one has an unpatched CVE facing the internet.

Audit what's listening and running:

```bash
ss -tulnp                    # every listening socket + owning process
systemctl list-units --type=service --state=running
```

For anything you don't need — a leftover database bound to `0.0.0.0`, an old `telnet`/`rpcbind`/`avahi`, a debug port — **stop and disable it** so it doesn't come back on reboot:

```bash
systemctl disable --now cups.service     # stop now AND prevent auto-start
```

Then **close the port at the firewall** as well (default-deny already helps): defence in depth means even if a service restarts, the firewall still blocks it. A classic finding: a database or admin panel unintentionally bound to a public interface (`0.0.0.0`) instead of localhost, discovered by internet scanners within hours. "Minimise, then default-deny" is the whole game: run the least, expose the least.

### Q14. Recap the SUID risk. Why is it a hardening concern?

The **SUID** bit (`chmod u+s`, shows as `rws` in the owner slot) makes a binary run with the **owner's** privileges regardless of who executes it. Legitimately, `passwd` is SUID-root so a normal user can update `/etc/shadow` (which only root can write) through that one controlled program.

The risk: a SUID-root binary with a **bug** (buffer overflow, command injection, unsafe `PATH`/env handling) becomes a **local privilege escalation** — any user who runs it can potentially get root. PwnKit (CVE-2021-4034) was exactly this: a SUID-root helper (`pkexec`) escalated any local user to root. So every SUID-root binary is a piece of trusted, security-critical code.

Hardening steps:

```bash
find / -perm -4000 -type f 2>/dev/null    # audit ALL SUID binaries
```

Review that list, remove SUID from anything that doesn't need it (`chmod u-s`), keep the set minimal, and keep those binaries patched. Mount options help too: `nosuid` on filesystems where SUID should never apply (`/tmp`, `/home`, removable media) neutralises any SUID binary planted there. The principle: SUID is necessary but dangerous, so treat the SUID inventory as a small, tightly-controlled, audited set — an unexpected new SUID binary is a red flag worth investigating.

### Q15. How do you audit who has logged in and detect suspicious access?

Multiple overlapping sources so an attacker can't erase all traces:

```bash
last                  # successful logins (reads /var/log/wtmp) — who, when, from where, duration
lastb                 # FAILED login attempts (reads /var/log/btmp) — brute-force evidence
lastlog               # the most recent login per user
who / w               # who's logged in RIGHT NOW (w also shows what they're running)
```

`last` shows the login history; **`lastb`** is the security-interesting one — a flood of failed logins from many IPs is brute-force, from *one internal* IP is more worrying. Cross-reference with the auth log:

```bash
grep "Failed password" /var/log/auth.log      # (auth.log on Debian, secure on RHEL)
grep "Accepted publickey" /var/log/auth.log   # successful key logins — expected users only?
journalctl -u sshd --since today
```

For tamper-evident, kernel-level auditing use **auditd** (`ausearch`, `aureport --auth`), which records events the attacker can't simply not-log. The senior habits: **ship these logs off-box** (centralized logging) so a root attacker can't wipe local `wtmp`/`btmp`/`auth.log` to cover tracks; watch for **logins at odd hours, from unexpected geographies, or from service accounts that shouldn't log in interactively**; and alert on the first successful login from a new IP. This is exactly where the Logging & Monitoring topic's centralization pays off — local logs are only trustworthy until the box is owned.

### Q16. Give me a practical checklist to harden a fresh internet-facing server.

A concrete, ordered pass I'd run on a new box before it takes traffic:

1. **Patch first** — `apt update && apt upgrade` (or `dnf upgrade --security`); enable **unattended-upgrades** for ongoing security patches.
2. **Create a non-root user** with sudo; add your SSH **public** key to its `~/.ssh/authorized_keys` (`chmod 700 ~/.ssh`, `600 authorized_keys`).
3. **Harden SSH** — in `sshd_config`: `PermitRootLogin no`, `PasswordAuthentication no`, `PubkeyAuthentication yes`, `AllowUsers <you>`; `sshd -t` then reload. Test a new login before closing the current one.
4. **Firewall, default-deny** — `ufw default deny incoming`, `ufw default allow outgoing`, `ufw allow OpenSSH`, then only the ports the app needs (e.g. 443); `ufw enable`.
5. **fail2ban** — install and enable the `sshd` jail to auto-ban brute-forcers.
6. **Minimise services** — `ss -tulnp` and disable anything listening you don't need (`systemctl disable --now`); ensure databases bind to localhost, not `0.0.0.0`.
7. **MAC on** — leave SELinux **enforcing** (RHEL) or AppArmor enabled (Ubuntu); don't disable it.
8. **Secrets** — no secrets in git; app secrets in `600`-perm files owned by the service user or a secrets manager.
9. **Time + logs** — NTP synced (so log timestamps correlate), and forward logs to a **central server** so they survive a compromise.
10. **Audit baseline** — enable `auditd`, and optionally file-integrity monitoring (AIDE) with a baseline snapshot.

The spine of the list is the mental model: **patch, authenticate strongly (keys, no root), default-deny the network, minimise surface, constrain with MAC, and keep an off-box audit trail** — defence in depth so no single failure hands over the box.
## Performance Troubleshooting & Debugging

### Summary

**What this topic covers**

This is the topic where Linux knowledge stops being trivia and becomes a job skill: given a slow or broken box, how do you *methodically* find the bottleneck instead of guessing? The 16 questions here cover a repeatable methodology — Brendan Gregg's **USE method** (for every resource: Utilization, Saturation, Errors) and his **60-second checklist** (`uptime`, `dmesg`, `vmstat`, `mpstat`, `pidstat`, `iostat`, `free`, `sar`, `top`) — plus the tools that answer specific questions: `strace`/`ltrace` (what syscalls/library calls is this process making, and why is it hung), `lsof` (what files/sockets does it have open), the `/proc/<pid>/` tree (the ground truth behind every tool), `perf` and flame graphs (where is CPU actually being spent), and the resource-limits layer (`ulimit`, `EMFILE`, cgroups). The through-line: **classify the bottleneck first** (CPU vs memory vs disk I/O vs network vs lock contention), then reach for the tool that confirms it. Guessing wastes the incident; measuring ends it.

**Mental model**

Think of a slow system as one of five resources being exhausted, and your job as *binary search across those five*. CPU-bound shows as high `%usr`/`%sys` and a runnable-heavy load average. Memory-bound shows as swapping, page-cache thrash, or the OOM killer. Disk-bound shows as high `%iowait`, processes stuck in `D` (uninterruptible sleep), and `iostat` `%util` near 100. Network-bound shows as retransmits, dropped packets, and full socket queues. Lock/contention-bound shows as idle CPU *and* idle disk while throughput is low — the process is blocked in `futex()` or waiting on a mutex, which `strace -c` or `perf` reveals. The USE method makes this exhaustive: you don't stop at "CPU looks busy," you check Utilization *and* Saturation *and* Errors for **every** resource, so you never miss the disk that's throwing errors while the CPU looks fine. Start cheap and broad (`uptime`, `top`, `dmesg`), narrow to one resource, then go deep on one process (`strace -p`, `/proc/<pid>/`).

**Key terms**

- **USE method** — for every resource, check **U**tilization, **S**aturation, **E**rrors. A complete triage checklist.
- **`vmstat 1`** — system-wide CPU/memory/swap/IO per second; `r` column = runnable, `b` = blocked, `si`/`so` = swap in/out.
- **`pidstat 1`** — per-process CPU, memory, I/O, and context switches over time; the per-PID counterpart to `vmstat`.
- **`iostat -xz 1`** — per-device disk stats; `%util`, `await` (latency), `r/s`+`w/s` (IOPS) are the ones that matter.
- **`strace`** — traces **system calls** a process makes; `-f` follows children, `-p` attaches, `-c` prints a summary, `-e trace=` filters.
- **`ltrace`** — traces **library calls** (e.g. `malloc`, `strcmp`), one layer above syscalls.
- **`lsof`** — lists open files (and sockets); `lsof -p PID`, `lsof -i :PORT`, `lsof +L1` (deleted-but-held-open).
- **`/proc/<pid>/`** — kernel's live view of a process: `fd/`, `limits`, `status`, `stack`, `wchan`, `cmdline`.
- **`perf`** — CPU profiler using hardware counters; `perf top` (live), `perf record`/`report` (sampled), feeds flame graphs.
- **`ulimit` / `EMFILE`** — per-process resource limits; hitting the open-file limit yields `Too many open files` (`EMFILE`).
- **eBPF / bcc** — in-kernel programmable tracing (`execsnoop`, `biolatency`, `opensnoop`); low-overhead deep observability.
- **`sar`** — historical metrics from `sysstat`; lets you look at *yesterday's* CPU/IO, not just now.

**Why interviewers ask this**

Anyone can recite `top`. The signal an SRE/DevOps interviewer wants is *method*: given "the app is slow," does the candidate flail (restart it, add RAM, blame the network) or run a structured triage? A junior reaches for one favourite tool; a senior narrates the USE method, forms a hypothesis, checks it cheaply, and knows which `/proc` file or `strace` invocation confirms it. They're also probing depth-on-demand: can you explain what `strace` actually does (ptrace, syscall interception, and its overhead), why a process is in `D` state, or how load average includes uninterruptible sleepers? The best answers pair a command with *what you'd conclude from each possible output* — that shows you've actually debugged production, not just read man pages.

**Common confusions**

- **"High load average means high CPU."** Load counts runnable **and** uninterruptible (`D`-state) tasks. Load 40 with idle CPU usually means disk/IO or NFS stall, not CPU.
- **"`strace` is free."** It intercepts every syscall via `ptrace` and can slow a process 10–100x. Never blanket-`strace` a hot production process; use `-c`, `-e`, or eBPF instead.
- **"`free` shows I'm out of memory."** The "used" number includes page cache. Read the **available** column — the kernel hands cache back under pressure.
- **"I/O wait means the CPU is busy."** `%iowait` is *idle* CPU time spent waiting on I/O — it's a disk problem wearing a CPU costume.
- **"`perf` and `strace` do the same thing."** `strace` traces syscalls (kernel boundary crossings); `perf` samples where CPU cycles go (on-CPU profiling). Different questions.

**What follows from this topic**

This is the practical spine of the primer. It builds directly on **Processes & Signals** (`D` state, process states, signals to a hung process), **Memory Management** (OOM, page cache, swap), and **Networking** (`ss`, retransmits, socket queues), and it feeds straight into **Scenario & Troubleshooting Playbooks**, where these tools get wired into end-to-end incident walkthroughs. If **Containers & the Kernel** is on your list, note that every tool here needs cgroup-awareness inside a container — `free` and `top` lie without it.

### Q1. Walk me through your first 60 seconds on a slow Linux box.

Brendan Gregg's 60-second checklist — broad tools first, each answering "which resource?" before you go deep:

```bash
uptime               # load averages (1/5/15 min) — trending up or down?
dmesg | tail         # kernel errors: OOM kills, disk errors, TCP drops
vmstat 1             # r (runnable), b (blocked), si/so (swap), us/sy/wa/id
mpstat -P ALL 1      # per-CPU — is one core pinned (single-threaded) or all?
pidstat 1            # which process is burning CPU/IO, over time not a snapshot
iostat -xz 1         # per-disk %util, await (latency), r/s w/s (IOPS)
free -m              # available memory (not "used"), swap usage
sar -n DEV 1         # network throughput and errors per interface
top / htop           # confirm the top offender
```

**How to read it:** `uptime` says whether there's a problem and if it's growing. `vmstat`'s `r` column > CPU count means CPU saturation; `b` > 0 and `wa` high means I/O. `si`/`so` nonzero means you're swapping (memory pressure). `mpstat` distinguishes one hot core (single-threaded app) from all cores busy. `pidstat` names the culprit. Each tool eliminates a resource class so you narrow to one before deep-diving.

### Q2. Explain the USE method.

For **every resource** in the system, check three things:

| | Meaning | Example (CPU) | Example (Disk) |
|---|---|---|---|
| **U**tilization | % time the resource was busy | `%usr + %sys` from `mpstat` | `%util` from `iostat` |
| **S**aturation | queued work it couldn't service yet | run-queue length (`vmstat r`) | `avgqu-sz` / `aqu-sz`, `await` |
| **E**rrors | error events | — | `dmesg` disk errors, SMART |

Resources to sweep: CPU, memory, disk I/O, network interfaces, and often the storage/network *controllers* and locks. The method's power is that it's **exhaustive** — you can't hand-wave "CPU looks fine" and stop; you check U, S, and E for each resource, so a disk quietly throwing errors while CPU is idle can't hide. It's the opposite of tool-first debugging: you start from a checklist of resources and pick the tool that fills each cell.

### Q3. What does `strace` do, and how do you use it to find why a process is hung?

`strace` intercepts every **system call** a process makes (via the `ptrace` syscall) and prints it with arguments and return values. It's how you see a process's conversation with the kernel — every `open`, `read`, `write`, `connect`, `futex`.

To debug a hang, attach to the running PID:

```bash
strace -f -p 12345          # -f follows threads/children
```

Then read the **last line** — a hung process is blocked *in* a syscall:

- `read(3, ` with no return → blocked reading fd 3 (find it with `lsof -p 12345`; often a socket waiting on a peer).
- `futex(0x..., FUTEX_WAIT, ...` → blocked on a lock/mutex; lock contention.
- `connect(...)` hanging → network/DNS reachability.
- `flock(...)` / `fcntl(..., F_SETLKW` → waiting on a file lock.

Other essentials:

```bash
strace -c -p 12345          # summary: which syscalls, counts, time, errors
strace -e trace=open,openat -f ./app   # only file opens — "what file can't it find?"
strace -e trace=network -f ./app       # only network syscalls
```

`-c` is the safe production choice (aggregate, less output). To find "what file is it failing to open," grep the trace for `ENOENT` (no such file) or `EACCES` (permission denied). **Caveat:** `strace` adds huge overhead (stops the process on every syscall) — don't blanket-trace a hot production process; use `-c`, filter with `-e`, or use eBPF.

### Q4. `strace` vs `ltrace` vs `perf` — when do you use each?

| Tool | Traces | Answers | Overhead |
|---|---|---|---|
| `strace` | System calls (kernel boundary) | "What is it asking the kernel to do? Why is it blocked?" | High |
| `ltrace` | Library calls (`malloc`, `strlen`, `libssl`) | "What library functions is it calling?" | High |
| `perf` | CPU samples (hardware counters) | "Where are CPU cycles actually going?" (on-CPU) | Low |

Rule of thumb: **`strace` for "it's stuck or erroring on a syscall"** (hung reads, failed opens, `EMFILE`), **`ltrace` for "which library call is misbehaving"** (rarer, and it's flakier with modern dynamic linking), **`perf` for "it's burning CPU and I want the hot path"** (feeds flame graphs). `strace`/`ltrace` are *tracing* every event (heavyweight); `perf` is *sampling* at a frequency (lightweight, safe on prod).

### Q5. How do you find which process is holding a port, or which files a process has open?

`lsof` ("list open files" — and in Unix, sockets are files too):

```bash
lsof -i :8080            # who owns port 8080 (both listening and connected)
lsof -i -P -n            # all network connections, numeric ports/IPs (fast)
lsof -p 12345            # every file/socket PID 12345 has open
lsof /var/log/app.log    # which processes have this file open
lsof +L1                 # files with link count 0 — deleted but still held open
```

Modern equivalents worth naming: `ss -ltnp` (listening TCP sockets with the owning PID) is the fast replacement for `lsof -i` / `netstat`. And `fuser 8080/tcp` or `fuser -m /mnt` answers "who's using this port/mount" — handy before an unmount.

`lsof +L1` is the killer feature: it finds the classic "disk is full but `du` shows nothing" bug — a process holding a deleted log file. The space isn't freed until the fd closes.

### Q6. What lives in `/proc/<pid>/` and how is it useful for debugging?

`/proc/<pid>/` is the kernel's live, filesystem-shaped view of a process — the ground truth that every tool reads:

- **`fd/`** — symlinks for every open file descriptor. `ls -l /proc/12345/fd` shows exactly what's open (files, sockets, pipes); counting them (`ls /proc/12345/fd | wc -l`) diagnoses fd leaks.
- **`limits`** — this process's actual soft/hard limits (open files, memory) — the real answer to "did it hit `ulimit`?"
- **`status`** — human-readable state: `State:` (R/S/D/Z/T), `VmRSS` (resident memory), `Threads`, `voluntary_ctxt_switches`.
- **`stack`** / **`wchan`** — the kernel stack / the function it's sleeping in. For a `D`-state process, `cat /proc/12345/wchan` tells you *what* it's blocked on.
- **`cmdline`**, **`environ`**, **`cwd`**, **`exe`** — how it was launched, its environment, working dir, and binary.
- **`io`** — bytes read/written by this process.

Example: a process is stuck. `cat /proc/12345/status` shows `State: D`, `cat /proc/12345/wchan` shows an NFS function → it's blocked on a hung NFS mount, and no signal will free it.

### Q7. The load average is 40 but CPU usage is near 0%. What's happening?

Load average is **not** CPU utilization. On Linux it counts tasks that are **runnable** (`R`) *plus* tasks in **uninterruptible sleep** (`D`). So load 40 with idle CPU means ~40 tasks are stuck in `D` state — almost always **blocked on I/O**: a saturated or failing disk, or a hung NFS/network mount.

Confirm and localise:

```bash
vmstat 1                       # high 'b' (blocked) column, high 'wa'
iostat -xz 1                   # a device at %util 100, await in the hundreds of ms
ps -eo state,pid,cmd | grep '^D'   # list the D-state processes
```

Then find what they're waiting on: `cat /proc/<pid>/wchan`. If it's NFS, the mount is dead (check `dmesg`, `mount`). If it's a local disk, `iostat` will show the device pegged with huge latency — suspect a failing disk (`dmesg | grep -i error`, SMART) or a runaway writer. The lesson: high load + idle CPU = look at I/O, never at CPU.

### Q8. `iostat` shows `%util` at 100%. What does that mean and what do you check next?

`%util` is the percentage of time the device had at least one I/O in flight. At 100% the disk is *never idle* — but on SSDs and RAID that can parallelise, 100% `%util` doesn't strictly mean saturated (a single-queue metric on a multi-queue device). The number that actually matters is **`await`** (average I/O latency in ms) and the **queue size** (`aqu-sz`/`avgqu-sz`):

```bash
iostat -xz 1
```

- `await` normal for SSD is < 1–2 ms, spinning disk ~10 ms. `await` in the hundreds → the disk is the bottleneck.
- High `aqu-sz` (requests queued) → saturation (the S in USE).
- Then find *who*: `iotop -o` (only processes doing I/O) or `pidstat -d 1` names the process. `pidstat -d` shows per-process `kB_rd/s` and `kB_wr/s`.

Next steps: is it reads or writes? Sequential or random? Is it swap I/O (check `vmstat si/so` — memory pressure masquerading as disk load)? And check `dmesg` for disk errors — a failing disk retries and inflates latency.

### Q9. How would you profile where a CPU-bound process is spending its time?

Sampling with `perf` — it interrupts the CPU at a frequency and records the stack, so overhead is low enough for production:

```bash
perf top                            # live, system-wide hottest functions
perf top -p 12345                   # live, one process
perf record -F 99 -g -p 12345 -- sleep 30   # sample at 99Hz with call graphs for 30s
perf report                         # interactive breakdown of the recording
```

`-F 99` (99 Hz, not 100, to avoid lock-stepping with periodic tasks) and `-g` (capture call graphs) are the standard flags. To visualise, generate a **flame graph**: fold the samples and render an SVG where box width = time on CPU and the y-axis is stack depth. The widest boxes are your hot paths — you read it in seconds versus scrolling `perf report`. Needs kernel `perf_event_paranoid` permissions and, ideally, debug symbols/frame pointers for readable stacks. For lower overhead or off-CPU analysis, eBPF tools (`profile`, `offcputime` from bcc) do the same job.

### Q10. A process throws "Too many open files." How do you diagnose and fix it?

That's `EMFILE` — the process hit its **open file descriptor limit**. Remember sockets and pipes count as fds, so leaks or high-concurrency servers hit it.

Diagnose:

```bash
cat /proc/12345/limits | grep 'open files'   # the actual limit in force
ls /proc/12345/fd | wc -l                    # how many it currently has open
lsof -p 12345 | wc -l                        # same, with detail on WHAT they are
```

If `lsof -p` shows thousands of the same socket or file, it's an **fd leak** in the app (not closing connections) — fix the code; raising the limit just delays the crash.

If it's legitimately high concurrency, raise the limit:

```bash
ulimit -n 65536                              # this shell/session (soft limit)
```

Permanently: `/etc/security/limits.conf` (or a drop-in) for login sessions, or for a systemd service the `LimitNOFILE=` directive in the unit — **not** `ulimit`, which systemd ignores. Also check the system-wide ceiling `fs.file-max` (`sysctl`) and the per-process hard limit. The two-step is: confirm leak-vs-legitimate first, then either fix code or raise the right limit.

### Q11. What are `ulimit` and resource limits, and where do you set them for a service?

`ulimit` exposes per-process **resource limits** the kernel enforces — open files (`-n`), max processes/threads (`-u`), core dump size (`-c`), memory (`-v`), stack (`-s`). Each has a **soft** limit (current, raisable up to the hard limit by an unprivileged user) and a **hard** limit (ceiling, only root raises).

Where to set them depends on how the process starts:

- **Interactive/login shells** → `/etc/security/limits.conf` or `/etc/security/limits.d/*.conf` (via the PAM `pam_limits` module). `ulimit -n 4096` in a shell only affects that shell and its children.
- **systemd services** → the unit file's `[Service]` section: `LimitNOFILE=65536`, `LimitNPROC=`, etc. This is the #1 gotcha: systemd does **not** read `limits.conf` for services, so editing it does nothing for a daemon — you must set `Limit*=` in the unit (then `systemctl daemon-reload` + restart).
- **System-wide ceilings** → `sysctl` / `/etc/sysctl.d/`: `fs.file-max` (all fds system-wide), `kernel.pid_max`.

Check what a running process actually got: `cat /proc/<pid>/limits`.

### Q12. `vmstat 1` output shows nonzero `si` and `so`. What does that tell you?

`si` (swap in) and `so` (swap out) are **pages per second moving between RAM and swap**. Sustained nonzero values mean the system is under **memory pressure** and actively swapping — the kernel is evicting pages to disk to free RAM. This is a red flag because swap is orders of magnitude slower than RAM; a swapping system feels frozen even with idle CPU, and the swap I/O shows up as disk load in `iostat` (misleading you toward "disk problem" when the root cause is memory).

Distinguish two cases: a one-off `so` spike as something starts is fine; *continuous* `si`/`so` churn (pages going out *and* coming back) is **thrashing** — the working set doesn't fit in RAM. Correlate with `free -m` (low `available`, high `Swap used`) and `pidstat`/`top` sorted by RSS to find the memory hog. Fixes: cut the app's memory, add RAM, or (short-term) find and restart the leaker before the OOM killer does it for you.

### Q13. Give an overview of eBPF and the bcc tools. Why do they matter for debugging?

**eBPF** lets you run small, verified programs *inside the kernel*, attached to hooks (syscalls, tracepoints, kprobes, network events), without patching or rebooting. The kernel verifier guarantees they can't crash it, and they run at near-native speed — so you get deep production observability with overhead far below `strace`.

**bcc** and **bpftrace** are the toolkits built on it. High-signal one-shot tools:

- `execsnoop` — every new process as it's `exec`'d (catch short-lived processes `top` never shows — the mystery cron/fork storm).
- `opensnoop` — every file open, with the failing ones (find "what file is it looking for?" without `strace`'s overhead).
- `biolatency` / `biosnoop` — block-I/O latency as a histogram / per-I/O (real disk latency distribution).
- `tcpconnect` / `tcpretrans` — connections and TCP retransmits live.
- `runqlat` — scheduler run-queue latency (CPU saturation you can't see in `%util`).

Why it matters: `strace` traces one process at high cost; eBPF traces *the whole system* cheaply and safely, which is exactly what you want on a production box mid-incident. It's the modern answer to "observe without disrupting."

### Q14. A process is stuck in `D` state and won't die even with `kill -9`. Why, and what do you do?

`D` is **uninterruptible sleep** — the process is blocked inside a kernel syscall waiting on I/O that can't be interrupted, so it doesn't respond to *any* signal, including `SIGKILL` (9). The kernel deliberately won't deliver signals until the I/O completes, to avoid corrupting in-flight kernel state. This is why `kill -9` "doesn't work" on `D`-state processes — it's not a bug, it's by design.

Find what it's waiting on:

```bash
ps -eo state,pid,wchan:32,cmd | grep '^D'
cat /proc/<pid>/wchan        # the kernel function it's sleeping in
cat /proc/<pid>/stack        # full kernel stack (needs privilege)
```

Usual culprits: a **hung NFS mount** (server gone, `hard` mount), a **failing local disk** (I/O retrying forever), or stuck storage. You can't kill the process directly — you must fix the underlying I/O: restore/remount the NFS server, or the process clears when the disk I/O finally errors out or completes. If storage is genuinely dead, the honest answer in an interview is: often a **reboot** is the only way to clear a truly wedged `D`-state process, because you can't force the kernel to abandon the I/O. Prevention: mount NFS with `soft`/`intr` where appropriate so I/O can time out.

### Q15. The app is slow. Give me a structured triage instead of a guess.

Narrate the funnel — broad to narrow, cheap checks first, one hypothesis at a time:

1. **Scope it.** Is it *this box* or *the whole service*? Slow for all users or some? Since when, and what changed (deploy, traffic spike, cron)? One question here can save an hour.
2. **Broad resource sweep** (the 60-second checklist / USE method): `uptime`, `top`, `vmstat 1`, `iostat -xz 1`, `free -m`, `ss -s`, `dmesg | tail`. Classify: CPU? memory/swap? disk I/O? network? Or all idle (→ locks/downstream)?
3. **Follow the hot resource.** CPU-bound → `pidstat`/`perf` to the hot function. I/O-bound → `iotop`/`iostat await` to the device and process. Memory → `free available`, swap, OOM in `dmesg`. Network → `ss -tn` state counts, retransmits, downstream latency.
4. **Idle everything but still slow?** It's blocked, not busy — a downstream dependency (DB, API), DNS, or lock contention. `strace -c -p` the process: lots of time in `futex` = lock contention; time in `connect`/`recvfrom` = waiting on the network/DB.
5. **Confirm with one measurement, then act.** State the hypothesis, prove it with a single command's output, fix, verify the metric moved. Communicate at each step.

The meta-point interviewers want: measure before mutating, and never fix two things at once.

### Q16. `dmesg` and `journalctl -k` — what kernel-level problems do you look for during triage?

The kernel ring buffer (`dmesg`, or `journalctl -k` / `journalctl --dmesg` for the persistent, timestamped view) is where the *hardware and kernel* report problems that never reach the app's logs. During an incident, scan it early — it often names the root cause outright:

- **OOM kills** — `Out of memory: Killed process 12345 (java)` with a score table. Confirms memory pressure and tells you *what* got killed and why.
- **Disk/filesystem errors** — `I/O error`, `EXT4-fs error`, `blk_update_request`, ATA resets → a failing disk behind your high `await`.
- **Network drops** — `nf_conntrack: table full, dropping packet` (conntrack exhaustion), NIC resets, TCP `possible SYN flooding`/listen-queue overflow.
- **Filesystem gone read-only** — `Remounting filesystem read-only` after errors → writes are failing silently for the app.
- **Segfaults / traps** — `segfault at ... error 4` for a crashing binary.
- **cgroup/OOM inside containers** — memory cgroup OOM events for a specific container.

Use `dmesg -T` for human timestamps (raw `dmesg` shows seconds-since-boot) and `dmesg -l err,crit` to filter to serious levels. The habit: **before you theorise, read `dmesg`** — half the time the kernel already told you what broke.

## Containers & the Kernel

### Summary

**What this topic covers**

The single most clarifying idea in modern Linux ops: **a container is not a VM — it's just a process** (or a group of them) running on the host kernel, *fenced off* by kernel features. There is no guest OS, no hypervisor, no second kernel. Docker, Podman, Kubernetes pods — all of them are userspace choreography over three kernel primitives: **namespaces** (what a process can *see*), **cgroups** (what a process can *use*), and a **union filesystem** (overlayfs — layered, copy-on-write images). The 15 questions here take you from that mental model down to the mechanics: which namespace isolates what (pid/net/mnt/uts/ipc/user), how cgroups v1/v2 enforce `--memory` and `--cpus` and trigger a per-container OOM, why `free` and `top` *lie inside a container*, `chroot` vs `pivot_root`, Linux **capabilities** and why `--privileged` is dangerous, seccomp profiles, rootless containers via user namespaces, and how `docker run` maps onto `clone()` + cgroups + overlayfs under the hood (runc/containerd). If you can explain "containers are namespaced, cgrouped processes sharing the host kernel," you can reason about every container behaviour and every container security question.

**Mental model**

Start a normal process, then take things away from it. `clone()` with namespace flags gives the new process its *own* view of PIDs (it thinks it's PID 1), its own network stack, its own mount table, its own hostname — while it's still just a task in the host kernel's scheduler. Put it in a **cgroup** and the kernel caps its CPU, memory, and I/O, and accounts its usage. Give it a root filesystem assembled from stacked read-only image layers plus one writable layer on top (**overlayfs**, copy-on-write), and it has its own `/`. That's a container: `namespaces + cgroups + overlayfs + a dropped-capabilities, seccomp-filtered process`. The crucial consequence: **the kernel is shared**. A container runs the *host's* kernel — there's no isolation boundary as strong as a VM's, which is why container escapes are kernel exploits and why `--privileged` (which strips the fencing) is so dangerous. "It works on my machine" is solved not by isolation but by the **image**: the filesystem, libraries, and dependencies are baked in and identical everywhere.

**Key terms**

- **Namespace** — isolates what a process *sees*. Types: `pid`, `net`, `mnt`, `uts` (hostname), `ipc`, `user`, `cgroup`, `time`.
- **cgroup (control group)** — limits and accounts what a process *uses*: CPU, memory, I/O, pids. v1 (per-controller hierarchies) vs v2 (unified hierarchy).
- **overlayfs / union fs** — stacks read-only image layers + one writable layer; **copy-on-write** on first write to a file.
- **Image vs container** — image = immutable stacked layers; container = image + a writable top layer + runtime namespaces/cgroups.
- **`clone()` / `unshare` / `nsenter`** — syscall/tools to create namespaces (`unshare`) and enter existing ones (`nsenter`).
- **Capabilities** — the ~40 fine-grained slices of root's power (`CAP_NET_ADMIN`, `CAP_SYS_ADMIN`…); containers drop most by default.
- **`--privileged`** — disables the fencing: all capabilities, all devices, no seccomp — nearly host-equivalent power. Avoid.
- **seccomp** — filters which syscalls a process may make; Docker's default profile blocks ~44 dangerous syscalls.
- **`pivot_root` vs `chroot`** — both change `/`; `pivot_root` is the real container mechanism (unmounts old root), `chroot` is weaker.
- **runc / containerd** — runc is the low-level OCI runtime that actually calls `clone()`+cgroups; containerd manages images/lifecycle above it.
- **User namespace** — maps container UID 0 to an unprivileged host UID; the basis of **rootless** containers.
- **OOM (cgroup)** — exceed the memory cgroup limit and the kernel OOM-kills a process *inside that container*, not the host.

**Why interviewers ask this**

This separates people who *use* Docker from people who *understand* it. A junior says "containers are lightweight VMs"; a senior says "containers are processes isolated by namespaces and limited by cgroups, sharing the host kernel" — and everything downstream (security posture, the `free`-lies-in-a-container gotcha, why you can't run a different kernel, why `--privileged` is a footgun) follows from that one correct sentence. For SRE/DevOps it's also intensely practical: OOMKilled pods, CPU throttling from cgroup limits, image-layer bloat, and rootless/security hardening are daily concerns. Interviewers probe whether you can connect the abstraction (a `docker run` flag) to the primitive (a cgroup file), because that's what lets you debug a container that a `docker logs` won't explain.

**Common confusions**

- **"Containers are lightweight VMs."** No — no guest kernel, no hypervisor. They're host processes with a restricted view. VMs virtualise hardware; containers partition one kernel.
- **"Each container has its own kernel."** They all share the *host* kernel. That's why a kernel bug is a container escape, and why you can't run a Windows container on a Linux kernel (natively).
- **"`free`/`top` inside a container show the container's memory."** They read `/proc/meminfo`, which is the **host's** — non-cgroup-aware tools report host RAM/CPU. Read the cgroup files (or use cgroup-aware tooling) for real limits.
- **"`--privileged` just gives a few extra permissions."** It strips essentially all isolation (all caps, host devices, no seccomp) — a privileged container is roughly root on the host.
- **"root inside a container is root on the host."** Not with a user namespace — container UID 0 maps to an unprivileged host UID. Without user namespaces, though, it's closer to true than people think.

**What follows from this topic**

This topic reframes everything: **Processes** (a container is a PID namespace; its PID 1 has special signal semantics), **Memory** (cgroup OOM vs host OOM), **Performance Troubleshooting** (every tool needs cgroup-awareness inside a container), and **Networking** (the net namespace, veth pairs, bridges). It leads straight into the **Scenario & Troubleshooting Playbooks** — "the container was OOMKilled," "`free` says 32G but the pod died at 512M" — where the primitives here become the explanation.

### Q1. A container is not a VM. Explain the actual difference.

A **VM** virtualises *hardware*: a hypervisor (KVM, ESXi) runs a full **guest OS with its own kernel** on emulated/virtual CPU, memory, and devices. Strong isolation, but heavy — each VM boots a kernel, takes gigabytes, starts in seconds.

A **container** virtualises the *OS*: it's a normal **process on the host kernel**, fenced off by namespaces (restricted view) and cgroups (restricted resources), with a root filesystem from a layered image. No guest kernel, no hypervisor, no boot — it starts as fast as launching a process and adds ~megabytes.

| | VM | Container |
|---|---|---|
| Isolates | Hardware (own kernel) | Process (shared host kernel) |
| Boundary | Hypervisor — strong | Kernel namespaces — weaker |
| Kernel | One per VM | Shared with host |
| Startup / size | Seconds / GBs | Milliseconds / MBs |
| Escape = | Hypervisor breakout (rare) | Kernel exploit |

The one-liner: **VMs run their own kernel; containers share the host's.** That single fact explains container speed, container density, why you can't run a different-kernel OS in a container, and why container security is fundamentally kernel security.

### Q2. What are Linux namespaces and what does each one isolate?

Namespaces partition **what a process can see** — each type gives the process a private instance of a global kernel resource:

| Namespace | Isolates |
|---|---|
| `pid` | Process IDs — the container's first process is PID 1; can't see host PIDs |
| `net` | Network stack — own interfaces, routing table, iptables, ports |
| `mnt` | Mount points — own filesystem tree / view of mounts |
| `uts` | Hostname and domain name |
| `ipc` | System V IPC, POSIX message queues, shared memory |
| `user` | UID/GID mappings — container root ↔ unprivileged host user |
| `cgroup` | The process's view of its cgroup hierarchy |
| `time` | Boot/monotonic clocks (newer) |

Inspect a process's namespaces:

```bash
ls -la /proc/<pid>/ns    # symlinks; matching inode numbers = same namespace
```

Create/enter them manually (this is what container runtimes do under the hood):

```bash
unshare --pid --net --mount --fork --uts bash   # new process in fresh namespaces
nsenter -t <pid> -n -m bash                      # enter an existing container's net+mnt ns
```

A "container" is largely just a process placed in a fresh set of these namespaces at once.

### Q3. What are cgroups and how does Docker use them to enforce `--memory` and `--cpus`?

**cgroups (control groups)** limit, account, and prioritise **what a process can use** — CPU time, memory, block I/O, and PID count. Where namespaces control *visibility*, cgroups control *resources*.

When you run `docker run --memory=512m --cpus=1.5 ...`, the runtime creates a cgroup for the container and writes those limits into the cgroup filesystem. On cgroup **v2** (`/sys/fs/cgroup/...`):

- `--memory=512m` → `memory.max = 536870912`. Exceed it and the kernel **OOM-kills a process inside that cgroup** — the container is OOMKilled, the host is unaffected.
- `--cpus=1.5` → `cpu.max = 150000 100000` (150 ms of CPU per 100 ms period = 1.5 cores). Exceed it and the kernel **throttles** the container (it's paused until the next period), which shows up as latency, not a crash.

You can read the live accounting from inside/outside: `cat /sys/fs/cgroup/.../memory.current`, `cpu.stat` (`nr_throttled`, `throttled_usec`). This is why "the pod is slow" can mean **CPU throttling** from a too-low `--cpus`/limit even though host CPU is idle — a classic Kubernetes gotcha.

### Q4. cgroups v1 vs v2 — what changed and why does it matter?

**v1** grew organically as *independent hierarchies, one per controller* — a separate tree for `cpu`, another for `memory`, another for `blkio`, each mounted under `/sys/fs/cgroup/<controller>`. A process could sit at different positions in each tree, which made coordinated limits (e.g. memory pressure driving I/O decisions) awkward or impossible, and the interfaces were inconsistent.

**v2** is a **single unified hierarchy**: every process is at one place in one tree, and controllers are enabled per-cgroup. Cleaner, consistent interface (`memory.max`, `cpu.max`, `io.max`), proper **pressure stall information** (PSI — `cpu.pressure`, `memory.pressure`, `io.pressure` tell you *how stalled* a workload is), and better memory+I/O coordination.

Why it matters in practice: modern distros and systemd default to v2; Kubernetes and Docker have moved to it. Some older tooling assumed v1 paths and broke. If you're debugging container limits, first check which you're on:

```bash
stat -fc %T /sys/fs/cgroup    # 'cgroup2fs' = v2, 'tmpfs' = v1
```

The high-value v2 addition for SREs is **PSI** — a direct signal of resource saturation the USE method wants.

### Q5. Explain overlayfs and copy-on-write in container images.

A container image is a **stack of read-only layers**. overlayfs unifies them into one filesystem view, plus a single **writable upper layer** (the container layer) on top:

- **lowerdir** — the image's read-only layers (base OS, then each `RUN`/`COPY` in the Dockerfile adds a layer).
- **upperdir** — the writable layer, unique to this running container.
- **merged** — what the container sees: the union of all of them.

**Copy-on-write:** reads come straight from the lower (shared) layers. The first time the container *writes* to a file, overlayfs copies that file up into the writable layer and modifies the copy — the underlying image layer is never touched. This is why:

- Containers start instantly (no copying the image, just mount a new writable layer).
- Many containers from one image **share** the read-only layers on disk (huge space savings).
- Writes to large existing files are slow the first time (the whole file is copied up).
- **Data in the writable layer dies with the container** — that's why persistent data needs a **volume** (a bind/mount that bypasses the layered fs).

Layer caching also explains Dockerfile ordering advice: put rarely-changing steps first so their layers stay cached across builds.

### Q6. `chroot` vs `pivot_root` — which do containers actually use and why?

Both change what a process considers `/`, but they differ in strength:

- **`chroot`** changes the root directory for a process, but the old root is still mounted and reachable through tricks (open fd to a dir outside, then `chdir("..")` repeatedly; `chroot` doesn't change the *current* working directory). It was never designed as a security boundary — "`chroot` is not a jail."
- **`pivot_root`** *swaps* the mount namespace's root: it moves the current root to a subdirectory and makes a new mount the root, then you **unmount the old root entirely** so it's gone from the mount table. Combined with a `mnt` namespace, the process genuinely cannot reach the host filesystem.

Real container runtimes use **`pivot_root`** (inside a fresh mount namespace), not `chroot`, precisely because the old root must be unmounted to prevent escape. `chroot` still shows up for lightweight cases (build tools, some minimal sandboxes), but for container isolation `pivot_root` + mount namespace is the correct mechanism.

### Q7. What are Linux capabilities, and why is `--privileged` dangerous?

Historically, a process was either **root** (uid 0, all-powerful) or not. **Capabilities** break root's power into ~40 independent privileges you can grant or drop individually:

- `CAP_NET_BIND_SERVICE` — bind ports < 1024.
- `CAP_NET_ADMIN` — configure networking (interfaces, iptables).
- `CAP_SYS_ADMIN` — the "kitchen sink" cap (mount, many admin ops) — nearly root by itself.
- `CAP_SYS_PTRACE`, `CAP_DAC_OVERRIDE` (bypass file permissions), `CAP_SYS_MODULE` (load kernel modules).

Docker runs containers with **most capabilities dropped by default** — a container root has only a safe subset. You tune it with `--cap-drop`/`--cap-add` (best practice: `--cap-drop=ALL` then add only what's needed).

**`--privileged`** throws that away: it grants **all capabilities**, disables seccomp and AppArmor/SELinux confinement, and exposes host devices (`/dev`). A privileged container root can load kernel modules, access raw devices, mount filesystems — effectively **root on the host**. It's a common escape vector. Use it almost never; if you need one capability (say `NET_ADMIN`), add just that cap instead of going privileged.

### Q8. How does `docker run` map onto kernel primitives under the hood?

`docker run` is high-level choreography; the actual container is built by lower layers (Docker → containerd → **runc**) calling kernel syscalls:

1. **Pull/prepare the filesystem** — assemble the image's read-only layers + a new writable layer via **overlayfs**; this becomes the container's root.
2. **Create namespaces** — `clone()` (or `unshare`) the first process with `CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWNS | CLONE_NEWUTS | CLONE_NEWIPC` (and `CLONE_NEWUSER` if rootless), giving it isolated PID/net/mount/hostname/IPC views.
3. **Set up the root fs** — inside the mount namespace, `pivot_root` into the overlay merged dir and unmount the old root.
4. **Apply cgroups** — create a cgroup and write the resource limits (`memory.max`, `cpu.max`, `pids.max`) from `--memory`/`--cpus`.
5. **Restrict privileges** — drop capabilities to the default set, apply the **seccomp** profile, apply AppArmor/SELinux labels.
6. **Set up networking** — create a `veth` pair, one end in the container's net namespace, the other attached to the `docker0` bridge; configure NAT for outbound.
7. **`exec` the entrypoint** — the container's PID 1.

So a container = `clone(namespaces) + cgroups + pivot_root(overlayfs) + drop caps + seccomp + veth`. runc is the OCI runtime that performs steps 2–7; containerd manages images and lifecycle above it.

### Q9. Why does `free` (and `top`) "lie" inside a container, and how do you get real numbers?

Because `free`, `top`, `nproc`, and friends read **`/proc/meminfo`** and **`/proc/cpuinfo`**, which are **not namespaced** — they reflect the **host's** total RAM and CPU count, not the container's cgroup limits. So a container capped at `--memory=512m` on a 64 GB host will have `free` cheerfully report ~64 GB available. Then the app sizes its heap/caches/worker pool to that phantom capacity, blows past `memory.max`, and gets **OOMKilled** — even though `free` said there was plenty. Same trap with CPU: a JVM or Go runtime seeing host `nproc` spins up threads for cores it can't use, causing CPU throttling.

Get the truth from the **cgroup files**:

```bash
cat /sys/fs/cgroup/memory.max        # v2: the real memory limit
cat /sys/fs/cgroup/memory.current    # current usage
cat /sys/fs/cgroup/cpu.max           # quota period → effective cores
```

Fixes: use **cgroup-aware** runtimes/tools (modern JVMs honour cgroup limits automatically; Go respects `GOMAXPROCS`, set it from the limit e.g. via `automaxprocs`), and set explicit limits in the app rather than trusting `free`. Newer container-aware `free`/`top` builds and tools like `cgroup`-aware `htop` help, but the reliable source is the cgroup filesystem.

### Q10. What are rootless containers and user namespaces?

A **user namespace** maps UIDs/GIDs between container and host: container **UID 0 (root)** maps to an **unprivileged host UID** (say 100000). So a process that is "root" inside the container has *no* privilege on the host — if it escapes, it's just a nobody user. This decouples in-container root from host root.

**Rootless containers** build on this: the *entire* container runtime runs as an ordinary, non-root host user, with user namespaces mapping the container's uid range into that user's subordinate uid range (`/etc/subuid`, `/etc/subgid`). Podman does this natively; Docker supports a rootless mode.

Why it matters: it removes the biggest container risk — a container-escape-to-host-root — because there *is* no host root involved. The daemon itself isn't a privileged attack surface. Trade-offs: some operations need workarounds (binding ports < 1024, certain storage drivers, performance of the fuse-overlayfs fallback), and networking is set up differently (slirp4netns / pasta instead of a bridge). For security-sensitive or multi-tenant CI, rootless is the modern default recommendation.

### Q11. What is seccomp and how do containers use it?

**seccomp** (secure computing mode) filters which **system calls** a process is allowed to make. With seccomp-BPF, you attach a policy that allows, denies, or kills on specific syscalls — shrinking the kernel attack surface, because most container escapes go through some rarely-used syscall.

Docker applies a **default seccomp profile** to every container that blocks ~44 dangerous or rarely-needed syscalls — things like `keyctl`, `add_key`, `ptrace` (in some modes), `mount`, `reboot`, `kexec_load`, `bpf`, and syscalls for loading kernel modules. Normal apps never touch these, so the profile is invisible in practice but closes real escape routes.

Key points for an interview: it's **defence in depth** alongside capabilities and namespaces (capabilities gate *privileged operations*, seccomp gates *syscalls* — overlapping but distinct). You can supply a custom profile (`--security-opt seccomp=profile.json`) to tighten further, or `--security-opt seccomp=unconfined` to disable it — which, like `--privileged`, widens the attack surface and should be rare. If a container needs a blocked syscall (e.g. some debuggers need `ptrace`), the right move is a *custom profile* allowing just that syscall, not disabling seccomp wholesale.

### Q12. How do runc and containerd relate to Docker and Kubernetes?

They're the layers of the stack, from high-level to the kernel:

- **runc** — the low-level **OCI runtime**. It does the actual kernel work for *one* container: `clone()` with namespace flags, set up cgroups, `pivot_root`, drop caps, apply seccomp, `exec` the process. It runs the container and exits. Tiny and standardised (OCI runtime spec).
- **containerd** — the **container lifecycle manager** above runc: pulls and stores images, manages the overlay snapshots, tracks running containers, handles networking hooks, and calls runc to actually start/stop them. It's a long-running daemon.
- **Docker (dockerd)** — the developer-facing layer above containerd: the CLI, image building (`docker build`), Docker networking, volumes, the API. Under the hood it delegates to containerd, which delegates to runc.
- **Kubernetes** — talks to a runtime via the **CRI** (Container Runtime Interface), typically to **containerd** directly (Docker's `dockershim` was removed in k8s 1.24), which again uses runc.

So the chain is **Docker/Kubernetes → containerd → runc → kernel**. Alternatives swap layers: **CRI-O** replaces containerd for k8s; **gVisor (runsc)** and **Kata Containers** replace runc with a stronger-isolation runtime (a userspace kernel or a lightweight VM) when shared-kernel isolation isn't enough.

### Q13. Inside a container, what PID is the app, and why does PID 1 matter?

Because of the **PID namespace**, the container's first process is **PID 1** — it thinks it's the init of its own little system, and it can't see host PIDs. From the host, that same process has an ordinary high PID; the mapping is the namespace at work.

PID 1 carries special kernel semantics that bite containers:

- **Signal handling** — the kernel does **not** apply default signal actions to PID 1. If your app is PID 1 and hasn't installed a `SIGTERM` handler, `docker stop` (which sends `SIGTERM`) is *ignored*, and Docker falls back to `SIGKILL` after the grace period — slow, unclean shutdowns.
- **Zombie reaping** — PID 1 is responsible for `wait()`-ing on orphaned children. If your app spawns subprocesses and isn't a proper init, dead children become **zombies** that accumulate.

The fix is a lightweight init as PID 1: `docker run --init` (injects `tini`), or bake `tini`/`dumb-init` into the image, so signals are forwarded and zombies are reaped — and make sure your app actually handles `SIGTERM` for graceful shutdown. This is a very common "why does my container take 10s to stop / leak zombies" gotcha.

### Q14. How does "it works on my machine" get solved by containers, exactly?

The problem was never the *process* — it was everything *around* it: the OS libraries, language runtime version, system packages, config file locations, environment variables, and file layout differed between the dev laptop, CI, and prod. Same code, different substrate, different behaviour.

A container image **bakes that entire substrate into an immutable artifact**. The Dockerfile pins the base OS, installs exact library and runtime versions, copies the app, and sets env/config — all captured as overlay layers. Ship the *image*, and every environment runs bit-for-bit the same filesystem and dependencies. The only thing that varies is the host **kernel** (shared), which is stable enough that it rarely matters.

Note what containers *don't* isolate to be precise in an interview: they don't give you a different kernel, and they don't magically fix *stateful* differences (a prod database with different data, external service endpoints, resource limits). "Works on my machine" for *dependency and environment* drift — solved. For *data/config/scale* differences — that's what env vars, config maps, and staging environments handle. The image guarantees a reproducible filesystem, not a reproducible universe.

### Q15. A container was "OOMKilled" but the host had plenty of free memory. Explain.

The OOM here is a **cgroup memory OOM**, not a host OOM. The container's memory cgroup had a limit (`--memory` / k8s `resources.limits.memory` → `memory.max`), the processes inside it grew past that limit, and the kernel invoked the OOM killer **scoped to that cgroup** — killing a process *inside the container* while the host, with gigabytes free, is completely fine. The host never felt pressure; only the container's little accounting bucket overflowed.

How to confirm and diagnose:

```bash
dmesg | grep -i 'oom\|killed process'        # kernel logs the cgroup OOM + the victim
docker inspect <id> --format '{{.State.OOMKilled}}'   # true
cat /sys/fs/cgroup/memory.events             # 'oom_kill' counter, 'max' hits
kubectl describe pod ...                      # State: Terminated, Reason: OOMKilled, exit 137
```

Exit code **137** = 128 + 9 (SIGKILL) — the OOM killer's fingerprint. Root causes: the limit is set too low for the real working set, a memory leak, or — the sneaky one — the app read `free`/host memory (see the "`free` lies" question), sized its heap/cache to 32 GB, and blew past a 512 MB limit. Fixes: raise the limit if it's genuinely too small, fix the leak, or make the app cgroup-aware so it sizes to the limit, not the host.

## Scenario & Troubleshooting Playbooks

### Summary

**What this topic covers**

This is the capstone — the "walk me through debugging this" round that senior Linux/SRE interviews live on. Instead of teaching one tool, the 16 questions here are **worked incident playbooks**: a realistic symptom ("disk is 100% full," "can't SSH in," "load is 40 but CPU is idle," "the service won't start," "502 from the app"), and for each, the exact command sequence, the decision tree, and the reasoning at every branch. They pull together everything from the rest of the primer — processes and signals, memory and the OOM killer, filesystems and inodes, systemd and journald, networking and `ss`, and the performance tools (`strace`, `lsof`, `iostat`, `/proc`) — and wire them into end-to-end triage. The goal isn't to memorise commands; it's to internalise a *method*: clarify the symptom, form a cheap-to-test hypothesis, check the likely-and-cheap things first, and narrate as you go.

**Mental model**

An incident is a search problem, and your job is to prune the space fast without breaking things further. Three habits make the difference. **First, clarify before you act** — "slow" for whom, since when, one box or the fleet, what changed (a deploy, a cron, a traffic spike). The change that broke it is usually recent. **Second, check cheap and likely before expensive and exotic** — `df -h` before you theorise about filesystem corruption; `systemctl status` + `journalctl` before you `strace`. **Third, use the USE method as a net** so you don't tunnel on your first guess: sweep CPU, memory, disk, network, and locks, classify the bottleneck, *then* deep-dive. Throughout, **communicate**: say your hypothesis, run the command, read the result aloud, update the hypothesis. Interviewers are scoring the narration as much as the commands — a candidate who says "I'd check `df` first because a full disk causes a dozen unrelated symptoms" beats one who silently types the right thing. And always: **measure before you mutate**, change one thing at a time, and know how you'll verify the fix.

**Key terms**

- **Clarify-first** — establish scope, timeline, and recent changes before touching anything.
- **Cheap-first** — run the fast, high-yield checks (`df`, `dmesg`, `systemctl status`) before expensive tracing.
- **USE sweep** — Utilization/Saturation/Errors across CPU, memory, disk, network to classify the bottleneck.
- **`df` vs `du`** — `df` = free blocks per filesystem (what the FS *reports*); `du` = space files actually use. Divergence = deleted-but-open files or a mount hiding files.
- **Deleted-but-open file** — a process holding an unlinked file keeps its blocks allocated; `df` full, `du` clean. Find with `lsof +L1`.
- **`systemctl status` + `journalctl -u`** — the two-command entry to any "service won't start" — status shows state/exit code, journal shows *why*.
- **Exit 137 / 143** — 128+signal: 137 = SIGKILL (OOM/`kill -9`), 143 = SIGTERM. Reveals *how* a process died.
- **`D` state** — uninterruptible sleep; a process stuck here is blocked on I/O and won't die on SIGKILL.
- **`ss -ltnp`** — listening sockets with owning process; the modern "what's on this port" and "is it even listening?"
- **OOM killer** — kernel kills a process under memory pressure; logged in `dmesg` with a scoring table.
- **`journalctl -k` / `dmesg`** — kernel-level evidence (OOM, disk errors, network drops) the app logs won't show.

**Why interviewers ask this**

This round is the closest thing to watching you work a real 3 a.m. page. It reveals whether your knowledge is *connected*: a candidate who aced the individual topics but can't drive an open-ended "the site is down, go" is a candidate who's memorised, not operated. Interviewers watch for method over recall — do you clarify scope, or start randomly restarting services? Do you check the disk before blaming the network? Do you reason about *why* a symptom implies a cause ("load high + CPU idle → it's I/O, not compute")? And crucially, do you communicate a hypothesis-driven loop instead of silently flailing? A strong candidate turns a vague prompt into a structured, narrated investigation and knows the *cheap* checks that resolve 80% of incidents. That's the exact skill on-call demands, which is why this is often the deciding round.

**Common confusions**

- **"Restart it and see."** Restarting destroys the evidence and often the state you needed to diagnose. Investigate first when you safely can.
- **"`df` says full, so add disk."** Often it's a deleted-open file or inode exhaustion — adding disk doesn't fix either. Diagnose *why* before you provision.
- **"High load = need more CPU."** Load includes I/O-blocked (`D`) tasks. Adding CPUs to an I/O-bound box does nothing.
- **"The app log is empty, so nothing's wrong."** The kernel (`dmesg`), the init system (`journalctl -u`), and upstream (LB/proxy) logs hold the evidence the app never got to write — e.g. an OOM kill or a failed bind.
- **"Fix everything you see at once."** Change one variable, verify, move on — or you'll never know what actually fixed it (and may cause a new incident).

**What follows from this topic**

Nothing — this is the destination. It consumes **Processes & Signals**, **Memory Management**, **Filesystems & Storage**, **systemd & Services**, **Networking**, and **Performance Troubleshooting & Debugging**, and turns them into operational muscle. If a playbook here uses a tool you can't fully explain, that's your signal to revisit the source topic. Treat these as rehearsals: practise narrating them aloud, because in the interview (and on-call) the reasoning *is* the deliverable.

### Q1. "The server is slow." Walk me through it.

Clarify first: slow for whom, since when, this box or the service, and what changed (deploy? traffic? cron?). Then run the funnel — broad, cheap, one hypothesis at a time.

```bash
uptime                 # is load high, and rising or falling?
dmesg -T | tail        # OOM kills, disk/network errors staring you in the face
top / htop             # one process hot? one core or all?
vmstat 1               # r (CPU saturation) vs b+wa (I/O) vs si/so (swap)
iostat -xz 1           # a disk at high await/%util?
free -m                # 'available' low? swapping?
ss -s ; ss -tn state established | wc -l   # connection pileup?
```

Read it as a decision tree: **CPU-bound** (`vmstat r` > cores, `us`/`sy` high) → `pidstat`/`perf` to the hot process/function. **I/O-bound** (`b`/`wa` high, `D`-state procs) → `iotop`/`iostat await` to the device. **Memory-bound** (`si`/`so`, low `available`, OOM in `dmesg`) → find the RSS hog. **Network** → `ss` states, retransmits, downstream latency. **Everything idle but still slow** → it's blocked, not busy: lock contention or a slow downstream (DB/API/DNS) — `strace -c -p <pid>` shows time in `futex` (locks) or `recvfrom`/`connect` (waiting on network). State the hypothesis, confirm with one command, fix, verify the metric moved.

### Q2. `df` says the disk is 100% full. Find and fix it — including the trap.

```bash
df -h                          # confirm which filesystem, how full
df -i                          # ALSO check inodes — 100% inodes, 0% blocks is a real case
du -xhd1 / 2>/dev/null | sort -h | tail   # biggest dirs on THIS fs (-x = don't cross mounts)
du -xhd1 /var | sort -h | tail            # drill into the offender (often /var/log)
```

Walk `du` down to the fat directory, then decide: rotate/truncate logs, clear a runaway `/tmp`, remove old artifacts. **Truncate a live log without stopping the writer** (deleting it wouldn't free space — see the trap):

```bash
truncate -s 0 /var/log/app.log      # or: : > /var/log/app.log
```

**The trap:** `df` says 100% but `du` finds nothing. That's a **deleted-but-still-open file** — someone `rm`'d a huge log, but a process still holds the fd, so the kernel keeps the blocks allocated until that fd closes. `du` walks directory entries (gone); `df` counts allocated blocks (still held). Find it:

```bash
lsof +L1                            # open files with link count 0 (deleted, held open)
```

Fix by restarting (or signaling to reopen) the holding process — *then* the space frees. Two more culprits to rule out: **inode exhaustion** (`df -i` full from millions of tiny files — deleting files, not adding disk, is the fix), and **a mount hiding files** (something written to a directory *before* a filesystem was mounted over it; check with the mount unmounted).

### Q3. Load average is 40 but CPU is basically idle. What's happening?

Load average counts **runnable + uninterruptible-sleep (`D`)** tasks, not CPU busyness. Load 40 with idle CPU = ~40 tasks stuck in `D`, blocked on I/O that can't be interrupted.

```bash
vmstat 1                                   # high 'b' (blocked), high 'wa'; low 'us'/'sy'
ps -eo state,pid,wchan:32,cmd | grep '^D'  # who's in D and what they're waiting on
iostat -xz 1                               # a device at %util 100 with huge await?
cat /proc/<pid>/wchan                      # exact kernel function they're sleeping in
dmesg -T | grep -i 'error\|nfs\|ata'       # disk errors or NFS stalls
```

Two dominant causes: a **failing/saturated local disk** (I/O retrying, `iostat` await in the hundreds — check `dmesg` for ATA resets, run SMART) or a **hung NFS/network mount** (all readers of that mount pile into `D`; `wchan` shows an NFS function). The fix is at the I/O layer — restore the disk or remount/recover NFS — **not** adding CPUs, which would do nothing. Key interview point: name that load ≠ CPU, and that `D`-state tasks won't even die on `kill -9` until the I/O resolves.

### Q4. You can't SSH into a box. How do you diagnose it?

Work outward-in, cheapest first, and localise *which layer* is broken:

1. **Network reachability** — `ping <host>`. No ICMP? Could be the host down, a firewall, or routing. `traceroute`/`mtr` shows where it dies.
2. **Is the port open?** — `nc -vz <host> 22` or `ss` from another angle. Connection **refused** = host up, sshd not listening (crashed/stopped, or bound to another interface). **Timeout** = firewall/security-group dropping, or host/network down. Refused vs timeout is the key fork.
3. **Is the host even up?** — console/out-of-band (cloud serial console, IPMI, hypervisor). If you have console access, you sidestep SSH entirely.
4. **On the console, check the usual killers:**
   - **Disk full** — `df -h`; a full `/` breaks sshd (can't create session files, write logs). Extremely common.
   - **Too many processes / out of memory** — fork bomb or OOM; you may not even get a shell. `dmesg` for OOM.
   - **sshd down** — `systemctl status sshd`, `journalctl -u sshd`.
   - **Firewall** — `iptables -L -n` / `nft list ruleset`; a bad rule just locked you out.
   - **Load so high it won't schedule sshd** — the `D`-state/I/O storm above.
   - **`/etc/hosts.deny`, PAM, full `/tmp`, or expired host keys** — the long tail.

The framing interviewers want: **refused vs timeout vs no-route** immediately narrows it to service / firewall / network, and **a full disk** is the single most common "everything's broken including SSH" root cause — check it early via console.

### Q5. A systemd service won't start. Debug it.

Two commands get you 90% of the way:

```bash
systemctl status app.service        # state, main PID, exit code, last few log lines
journalctl -u app.service -e        # the actual error, full output (-e jumps to end)
journalctl -u app.service --since "10 min ago"
```

Read `status` for the **exit code / signal** and the sub-state (`failed`, `activating`, auto-restart looping). Then the journal usually names it. Common causes and the tell:

- **Config error / bad flag** — the app logs a parse error on startup; fix and `systemctl restart`.
- **Port already in use** — `bind: address already in use` → `ss -ltnp | grep :PORT` to find the squatter.
- **Missing file / permission** — `No such file` / `Permission denied`; check the unit's `User=`, `WorkingDirectory=`, and file ownership/SELinux (`ausearch`/`audit.log` if enforcing).
- **Dependency not up** — `After=`/`Requires=` target failed; check that unit too.
- **Hit a resource limit** — e.g. `LimitNOFILE` too low → `EMFILE` at startup.
- **Crash-loop** — `status` shows rapid restarts; `StartLimitHit`. Look at the exit code (139 = SIGSEGV, 137 = OOM).

Validate the unit itself with `systemd-analyze verify app.service`, and after editing the unit remember `systemctl daemon-reload`. If the app runs by hand but fails under systemd, suspect the **environment**: systemd gives a clean env, different `PATH`, its own `ulimit`s (set via `Limit*=`, *not* `limits.conf`), and a sandbox (`ProtectSystem=`, `PrivateTmp=`).

### Q6. The OOM killer struck. Investigate.

```bash
dmesg -T | grep -i -A3 'killed process'   # the victim, its RSS, and the score table
journalctl -k | grep -i oom
journalctl -u app.service | tail          # did the app log anything before dying?
```

The kernel logs a full report: which process it killed, that process's memory, and an `oom_score` table of candidates. The OOM killer fires when the system (or a **cgroup**) can't reclaim enough memory; it picks the victim by `oom_score` (roughly, biggest memory user, adjustable via `oom_score_adj`). Note it may kill an *innocent* big process, not the actual leaker.

Determine scope: **host OOM** (whole machine out of memory — check `free`, swap) vs **cgroup/container OOM** (one container hit its `memory.max` while the host was fine — exit code **137**, `docker inspect .State.OOMKilled`, `kubectl describe pod` → `OOMKilled`). Then root-cause: a genuine **leak** (RSS growing over time — trend it with `pidstat -r`/monitoring), a **limit set too low** for the real working set, a **traffic/load spike**, or a container app that **sized itself to host memory** and ignored its cgroup limit. Fixes accordingly: fix the leak, right-size the limit, add memory/swap, or make the app cgroup-aware. Prevention: alert on memory trends *before* the kill, and tune `oom_score_adj` to protect critical processes.

### Q7. The app logs "Too many open files." Diagnose and fix.

`EMFILE` — the process hit its open-file-descriptor limit (sockets and pipes count too).

```bash
cat /proc/<pid>/limits | grep 'open files'   # the limit actually in force
ls /proc/<pid>/fd | wc -l                    # how many it holds now
lsof -p <pid> | awk '{print $5, $9}' | sort | uniq -c | sort -rn | head   # WHAT is open
```

Decide leak vs legitimate: if `lsof` shows thousands of the *same* socket (e.g. `CLOSE_WAIT` connections never closed) or duplicate file handles, it's an **fd leak** — the app isn't closing things, and raising the limit just delays the crash; fix the code. If it's genuine high concurrency, raise the limit **in the right place**:

- **systemd service** → `LimitNOFILE=65536` in the unit's `[Service]`, then `daemon-reload` + restart. (systemd ignores `/etc/security/limits.conf`.)
- **login shell / non-systemd** → `/etc/security/limits.d/*.conf`.
- Check the system-wide ceiling: `sysctl fs.file-max`.

Verify it took effect by re-reading `/proc/<pid>/limits` on the *running* process — a frequent mistake is raising the limit but never restarting the process, so it keeps the old one.

### Q8. A process is stuck in `D` state. What does that mean and what can you do?

`D` = **uninterruptible sleep**: the process is blocked inside a kernel syscall on I/O the kernel won't interrupt, so it ignores **all** signals — including `SIGKILL` (`kill -9` does nothing).

```bash
ps -eo state,pid,wchan:40,cmd | grep '^D'
cat /proc/<pid>/wchan      # kernel function it's sleeping in
cat /proc/<pid>/stack      # full kernel stack (root)
dmesg -T | tail            # NFS timeouts? disk I/O errors?
```

Almost always the blocking I/O is a **hung NFS mount** (server unreachable with a `hard` mount) or a **failing/stuck disk**. You cannot kill the process directly; you must clear the underlying I/O — recover/remount the NFS server, or the disk finally errors out. If storage is genuinely dead and won't return, the honest reality is that a **reboot** may be the only way to clear a truly wedged `D`-state process. Prevention: mount NFS `soft`/`intr` (or with sane timeouts) so I/O can fail instead of hanging forever, and monitor disk health. One `D`-state process is usually benign; *many* of them are why your load average is 40 while CPU is idle.

### Q9. "Address already in use" / port already in use. Diagnose it.

The port you want is already bound. Find the owner:

```bash
ss -ltnp | grep :8080        # listening TCP sockets + PID/program (modern)
lsof -i :8080                # same, alternative
fuser 8080/tcp               # just the PID(s)
```

Two distinct cases:

1. **Another process genuinely owns the port** — `ss -ltnp` names it. Decide: kill/stop the squatter, or reconfigure one service to a different port. Often it's an old instance of *your own* app that didn't shut down.
2. **`TIME_WAIT` / stale socket** — nothing is *listening*, but restarting your server still fails to bind. The old socket is lingering in `TIME_WAIT` (normal TCP teardown, ~60s). Real fix: the app should set **`SO_REUSEADDR`** on the listening socket so it can rebind immediately (most servers do; if yours doesn't, that's the bug). Check with `ss -tan state time-wait | grep :8080`. Don't reach for `net.ipv4.tcp_tw_reuse` as a first resort — `SO_REUSEADDR` in the app is the correct fix.

Interview nuance: distinguish "someone is *listening* on it" (`ss -ltnp` shows a LISTEN) from "a connection is in `TIME_WAIT`" — different problems, different fixes.

### Q10. The website returns 502 / connection refused. Server-side triage.

Distinguish the two symptoms first — they point at different layers:

- **Connection refused** — nothing is listening on that port (the backend is *down*), or a firewall is actively rejecting.
- **502 Bad Gateway** — the reverse proxy (nginx/HAProxy/LB) *reached* your app but got a bad/no response — app crashed, hung, timed out, or restarting.

Triage from the proxy inward:

```bash
systemctl status app nginx          # are both actually running?
ss -ltnp | grep :<app-port>         # is the APP listening on the port nginx proxies to?
curl -v http://127.0.0.1:<app-port>/health   # bypass the proxy — does the app answer locally?
journalctl -u app -e                # app crash/exception/OOM?
tail -f /var/log/nginx/error.log    # nginx's view: 'connect() failed', 'upstream timed out'
```

Decision tree: if `curl` to the app **locally** works but the public URL 502s → the problem is **proxy↔app** (wrong upstream host/port in nginx config, SELinux blocking nginx's outbound connect — `setsebool httpd_can_network_connect`, or a firewall between them). If `curl` locally **also fails** → the **app** is the problem: not listening (crashed/OOMKilled — check exit 137, `dmesg`), hung (all worker threads blocked on a slow DB — `strace`/thread dump), or in a crash-loop. Also rule out **resource exhaustion**: app out of DB connections, out of file descriptors (`EMFILE`), or the box out of memory. `nginx -t` catches a broken config after a change. The `curl-the-backend-directly` step is the single highest-value move — it cleanly splits "proxy problem" from "app problem."

### Q11. A cron job didn't run. Debug it.

Cron failures are almost always **environment or logging**, not cron itself. Check in order:

```bash
grep CRON /var/log/syslog            # Debian/Ubuntu: did cron fire the job at all?
journalctl -u cron -u crond          # systemd view
systemctl status cron                # is the cron daemon even running?
crontab -l                           # is the entry there — and in the RIGHT user's crontab?
```

If cron **did** fire but the job failed, the classic causes:

- **Minimal environment.** Cron runs with a bare `PATH` (often just `/usr/bin:/bin`) and *no* profile — so `python`, `node`, or a tool in `/usr/local/bin` isn't found, and env vars your script relies on are unset. Fix: use **absolute paths** for every binary, and set needed vars *inside* the script or the crontab.
- **Output is discarded.** Cron mails stdout/stderr locally; if mail isn't set up, errors vanish. Always redirect: `... >> /var/log/myjob.log 2>&1` — then read that log for the real error.
- **The `%` trap** — an unescaped `%` in a crontab command is turned into a newline. Escape as `\%`.
- **Missing trailing newline** in the crontab file → the last line is ignored.
- **Permissions / user** — script not executable, or the entry is in the wrong user's crontab so it runs with unexpected privileges/paths.
- **Wrong schedule / timezone** — misread the five fields, or the box's TZ isn't what you assumed (`timedatectl`).

The method: **confirm it fired** (syslog), then **capture its output** (redirect to a log), then **run the exact command in a stripped shell** (`env -i /bin/sh -c '<command>'`) to reproduce the environment cron gave it. Note modern systems often use **systemd timers** instead — there, `systemctl list-timers` and `journalctl -u <unit>` are the equivalents.

### Q12. `/tmp` keeps filling up. Track it down and stop it.

```bash
df -h /tmp                         # confirm it's /tmp (own mount? tmpfs in RAM?)
du -xhd1 /tmp | sort -h | tail     # biggest offenders
ls -laSh /tmp | head               # largest files
ls -la --time-style=+%F /tmp       # who/when — pattern to a process
lsof +D /tmp 2>/dev/null           # which processes have files open under /tmp
```

Find the writer, then decide. Common causes: an app writing temp/scratch files and never cleaning up (crashes before its cleanup, or a bug), a runaway job dumping cores or debug output, or upload/session files piling up. Match the file names/owner to a service (`lsof +D /tmp`, or `lsof +L1` if they're deleted-but-open and `df` disagrees with `du` — the same trap as the root-disk case, since a process holding a deleted `/tmp` file keeps the space).

Fixes: fix the app to clean up (or point it at a properly managed scratch dir with its own quota); enable/verify **`systemd-tmpfiles`** which ages out `/tmp` (`/usr/lib/tmpfiles.d/tmp.conf`, `systemctl status systemd-tmpfiles-clean.timer`); and note that if `/tmp` is **tmpfs** (RAM-backed), filling it is memory pressure, not disk — it can push the box toward swap/OOM, so it's more urgent. Long term, give `/tmp` its own filesystem/quota so a runaway can't take down `/`.

### Q13. `top` shows high `%iowait`. What does that mean and how do you chase it?

`%iowait` is **idle CPU time during which there was outstanding disk I/O** — the CPU had nothing to run because tasks were blocked waiting on the disk. High `iowait` = the disk is the bottleneck, not the CPU (it's an I/O problem wearing a CPU costume). Caveat: on a busy box other work fills that idle time, so low `iowait` doesn't prove no I/O problem — always corroborate with `iostat`.

```bash
iostat -xz 1                 # per-device: await (latency), %util, r/s+w/s (IOPS), aqu-sz
iotop -o                     # which PROCESS is doing the I/O (only active ones)
pidstat -d 1                 # per-process kB_rd/s, kB_wr/s over time
vmstat 1                     # 'b' (blocked) high; and si/so — is it SWAP I/O?
```

Read `iostat`: `await` in the hundreds of ms (vs <2ms SSD / ~10ms HDD) confirms the disk is slow/saturated; high `aqu-sz` means requests are queuing (saturation). Then identify **who** (`iotop`/`pidstat -d`) and **what kind** — sequential vs random, reads vs writes. Two sneaky root causes to rule out: **swap I/O** (`vmstat si/so` nonzero → it's really *memory* pressure driving disk load; fix the memory hog, not the disk) and a **failing disk** (`dmesg` for I/O errors/ATA resets, SMART for reallocated sectors — a dying disk retries and inflates `await`). Fixes flow from the cause: throttle/optimise the heavy process, fix the query/logging pattern, add IOPS/faster storage, or replace the failing disk.

### Q14. A process is eating 100% CPU. Find it and figure out why.

```bash
top    # or: ps -eo pid,ppid,%cpu,%mem,cmd --sort=-%cpu | head
```

Identify the PID, then figure out *why* it's hot rather than just killing it (killing loses the evidence and the root cause recurs):

- **One core pinned vs all cores** — `mpstat -P ALL 1`. One core at 100% = single-threaded hot loop; all cores = parallel work or a thread pool spinning.
- **User vs system time** — `pidstat 1` (`%usr` vs `%system`). High `%system` (kernel) often means a syscall storm — confirm with `strace -c -p <pid>` (e.g. a tight loop of `poll`/`futex`/`gettimeofday`, or busy-waiting on a lock).
- **Where in the code** — `perf top -p <pid>` (or a flame graph via `perf record -g`) shows the exact hot function. For a JVM/Python/Go app, grab a thread dump / profiler to see the hot stack.

Decide from the evidence: a genuine **busy loop / bug** (spinning on a condition, a runaway regex, a GC death-spiral), **legitimate load** (it's actually doing work and needs more capacity or optimisation), or a **stuck retry loop** (hammering a failing dependency — `strace` shows repeated failing `connect`/`read`). Mitigate safely: `renice`/`cpulimit` or a cgroup `cpu.max` to cap it *without* killing, while you fix the root cause. Only kill (`SIGTERM` first, `SIGKILL` if it ignores) if it's endangering the box. State the *why* — interviewers want the diagnosis, not just `kill -9`.

### Q15. DNS resolution is intermittently failing. Diagnose it.

Intermittent is the key word — steady-state tools may look fine, so you're hunting a flaky path.

```bash
cat /etc/resolv.conf                 # which resolvers, search domains, options
resolvectl status                    # systemd-resolved: per-link servers, cache (modern)
dig example.com                       # does it resolve? note SERVER and query time
dig @1.1.1.1 example.com              # bypass the configured resolver — is IT the problem?
for i in $(seq 20); do dig +short example.com >/dev/null || echo "fail $i"; done  # catch intermittency
```

Reason about layers: `getent hosts example.com` uses the **full NSS stack** (`/etc/nsswitch.conf`, `/etc/hosts`, then DNS) — if `getent` differs from `dig`, an `/etc/hosts` entry or nsswitch ordering is involved. Common intermittent causes:

- **One of multiple resolvers is bad.** `resolv.conf` lists several nameservers; the resolver tries them in order with a timeout, so if the first is flaky you get *intermittent* slow/failed lookups. Test each with `dig @<server>`.
- **Caching layer misbehaving** — `systemd-resolved`/`dnsmasq`/`nscd` serving stale or empty results; restart/flush (`resolvectl flush-caches`) and see if the pattern changes.
- **UDP packet loss / MTU / rate limiting** — DNS is UDP; a lossy network or an upstream rate-limiter drops some queries. `dig +tcp` succeeding while UDP fails is a strong signal.
- **Load-balanced/anycast resolver** where one backend is broken — some queries hit the bad node.
- **Slow / timing-out lookups** perceived as "failures" — check `dig`'s query time; app timeouts shorter than resolver timeout turn slow into failed.

Method: reproduce the intermittency in a loop, isolate *which resolver/path* fails by querying servers directly, and check the caching daemon. Fix by removing/replacing the flaky nameserver, fixing the cache, or addressing the packet loss.

### Q16. Give me your general framework for any "spot the issue" ops incident.

The meta-answer that ties the topic together — say this, then apply it:

1. **Clarify the symptom.** What exactly is broken, for whom, since when, one host or the fleet, and *what changed* (deploy, config, cron, traffic, cert expiry). Recent change ≈ root cause.
2. **Form a hypothesis, check cheap-and-likely first.** `df -h`, `dmesg -T | tail`, `systemctl status`, `free -m`, `uptime` — the fast, high-yield checks resolve most incidents before you reach for tracing.
3. **USE-method sweep so you don't tunnel.** Utilization/Saturation/Errors across CPU, memory, disk, network — classify the bottleneck class instead of fixating on your first guess.
4. **Narrow to one resource, then one process, then one cause.** `pidstat`/`iotop`/`ss` to the offender; `strace -c`, `/proc/<pid>/`, `perf`, `journalctl` to the reason.
5. **Read the layers the app can't log** — `dmesg`/`journalctl -k` (OOM, disk, network drops), the init system (`journalctl -u`), and upstream (LB/proxy) logs.
6. **Change one thing, verify, communicate.** State the hypothesis out loud, prove it with one measurement, apply one fix, confirm the metric moved, and narrate throughout. Measure before you mutate; never fix two things at once.
7. **Capture evidence before destructive actions.** A restart often "fixes" it *and* erases the cause — grab a thread dump / `ps` / `lsof` / logs first when it's safe.

The interviewer is scoring the *loop* — clarify, hypothesise, cheap-check, sweep, narrow, verify, communicate — far more than any single command. A calm, narrated, hypothesis-driven investigation is the whole signal.
