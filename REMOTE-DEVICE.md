# Remote device (Android phone on a laptop, adb from this PC over Tailscale)

Everything stays inside the private Tailscale network. No router port, no public adb (5037/5555) or SSH.

- adb on this PC: `C:\Users\templ\AppData\Local\Android\Sdk\platform-tools\adb.exe` (already in the user PATH, v37.0.1).
- App package: `com.anonymous.pixelmorph`.

---

## 0. One-time setup on THIS PC (run it yourself, in an **Administrator PowerShell**)

### 0.1 Tailscale

```powershell
winget search tailscale                      # confirm the id (expected: Tailscale.Tailscale)
winget install --id Tailscale.Tailscale -e
tailscale up                                 # prints the login link: open it and sign in
tailscale ip -4                              # this PC's Tailscale IP (100.x.y.z)
```

### 0.2 OpenSSH Server, key-only, reachable only from Tailscale

```powershell
# Install and start sshd, start automatically
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic

# Key-only login
$cfg = "$env:ProgramData\ssh\sshd_config"
(Get-Content $cfg) `
  -replace '^#?\s*PasswordAuthentication\s+\w+', 'PasswordAuthentication no' `
  -replace '^#?\s*PubkeyAuthentication\s+\w+', 'PubkeyAuthentication yes' |
  Set-Content $cfg -Encoding ascii
if (-not (Select-String -Path $cfg -Pattern '^PasswordAuthentication no' -Quiet)) {
  Add-Content $cfg 'PasswordAuthentication no' -Encoding ascii
}

# Firewall: sshd only from the Tailscale range (100.64.0.0/10)
Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue | Disable-NetFirewallRule
New-NetFirewallRule -Name 'sshd-tailscale-only' -DisplayName 'OpenSSH Server (Tailscale only)' `
  -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow -RemoteAddress 100.64.0.0/10 -Program "$env:SystemRoot\System32\OpenSSH\sshd.exe"

# Authorized keys for an administrator account: this file, with these permissions
$keys = "$env:ProgramData\ssh\administrators_authorized_keys"
if (-not (Test-Path $keys)) { New-Item -ItemType File -Path $keys | Out-Null }
icacls.exe $keys /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"

Restart-Service sshd
```

Paste the laptop's public key (one line, `ssh-ed25519 AAAA... user@laptop`) into
`C:\ProgramData\ssh\administrators_authorized_keys` (open Notepad as Administrator), save, and run `Restart-Service sshd`.

Check: `Get-NetFirewallRule -Name sshd-tailscale-only | Get-NetFirewallAddressFilter` shows `100.64.0.0/10`.

---

## Option B: direct (phone exposes adb over Tailscale)

Needs Tailscale on the **phone** too (Play Store app, same account).

On the laptop, with the phone on USB:

```bash
adb devices                 # the phone shows as 'device' (accept the USB debugging prompt)
adb tcpip 5555              # adb on the phone now listens on 5555 (until the phone reboots)
```

On this PC:

```bash
adb connect <phone-tailscale-ip>:5555
adb devices                 # <phone-tailscale-ip>:5555  device
```

Note: on the phone, port 5555 accepts any host that can reach it. Use it only while the phone is on Tailscale and trusted networks, and run `adb usb` on the laptop when done.

### Option B without a cable: Wireless debugging (Android 11+)

Needs Tailscale on this PC (section 0.1) and on the phone; the laptop and OpenSSH are not needed.

On the phone (must be on a Wi-Fi network, wireless debugging does not turn on with mobile data only):
1. Developer options → **Wireless debugging** → on.
2. **Pair device with pairing code**: note the `IP:pairing-port` and the 6-digit code (expires in ~1 min).
3. Back on the Wireless debugging screen: note the `IP:port` shown under "IP address & port" (a different port).

Use the phone's **Tailscale** IP (Tailscale app → this device) with those ports. On this PC:

```bash
adb pair <phone-tailscale-ip>:<pairing-port> <6-digit-code>   # once per PC/phone pair
adb connect <phone-tailscale-ip>:<port>                         # every time wireless debugging restarts (the port changes)
adb devices
```

Poco / HyperOS / MIUI: in Developer options also enable **Install via USB** (else `adb install` fails with
`INSTALL_FAILED_USER_RESTRICTED`) and **USB debugging (Security settings)** (taps/permissions); Xiaomi usually
requires a signed-in Mi account and a SIM for these.

## Option A: SSH tunnel (phone stays USB-only; recommended)

On the laptop, once:

```bash
ssh-keygen -t ed25519 -C "laptop-adb"      # creates ~/.ssh/id_ed25519 and id_ed25519.pub
cat ~/.ssh/id_ed25519.pub                  # paste this line on the PC (section 0.2)
```

On the laptop, each session (phone on USB, laptop's adb server running: `adb start-server`):

```bash
ssh -N -R 5038:localhost:5037 templ@<pc-tailscale-ip>
```

This PC's port 5038 now forwards to the laptop's adb server. On this PC (Git Bash):

```bash
export ADB_SERVER_SOCKET=tcp:localhost:5038
adb devices                 # lists the phone attached to the laptop
```

PowerShell equivalent: `$env:ADB_SERVER_SOCKET = 'tcp:localhost:5038'`.
Without that variable, adb on this PC uses its own local server (emulator) again.

---

## Day to day (on this PC)

With several devices attached, add `-s <serial>` (serial from `adb devices`).

```bash
adb devices -l                                                    # list devices
adb install -r C:/apks/<file>-arm64-celular.apk                   # install/update, keeps app data
adb shell monkey -p com.anonymous.pixelmorph -c android.intent.category.LAUNCHER 1   # open the app
adb logcat -c                                                     # clear the log
adb logcat '*:E' | grep -iE "pixelmorph|ReactNativeJS|AndroidRuntime"               # errors from the app
adb logcat --pid=$(adb shell pidof -s com.anonymous.pixelmorph)  # everything from the app's process
adb exec-out screencap -p > shot.png                              # screenshot
```
