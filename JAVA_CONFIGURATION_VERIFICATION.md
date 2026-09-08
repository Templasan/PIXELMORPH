# Java Configuration Verification
**Date**: 2026-09-08  
**Task**: Verify JDK 17 is properly configured for Android builds

---

## Current Status

### ✅ JDK 17 Installation
```
Location: C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot
Version: 17.0.20.1 (Temurin)
Status: ✅ INSTALLED
```

### ⚠️ JAVA_HOME Configuration
- **Action Taken**: Set `JAVA_HOME` to user environment variable
- **Value**: `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`
- **Scope**: User level (permanent across sessions)
- **Status**: ⏳ PENDING TERMINAL RESTART

---

## How to Verify JAVA_HOME is Working

### Step 1: Close and Reopen Terminal/IDE

**Close completely**:
- Close all PowerShell windows
- Close IDE/Code editor if open
- Wait 2 seconds

**Reopen**:
- Open a fresh PowerShell or terminal
- Navigate back to project: `cd C:\Users\templ\Desktop\Facul\TristezaParaMobile\PIXELMORPH`

### Step 2: Verify Environment Variable

```powershell
$env:JAVA_HOME
```

**Expected Output**:
```
C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot
```

If empty or different → JAVA_HOME not set yet (try closing ALL terminals)

### Step 3: Verify Java Version

```bash
java -version
```

**Expected Output**:
```
openjdk version "17.0.20.1" 2026-08-18
OpenJDK Runtime Environment Temurin-17.0.20.1+1 (build 17.0.20.1+1)
OpenJDK 64-Bit Server VM Temurin-17.0.20.1+1 (build 17.0.20.1+1, mixed mode, sharing)
```

If shows Java 25 → PATH is pointing to default Java, not JDK 17

**Fix**: Re-verify JAVA_HOME is set (Step 2)

### Step 4: CRITICAL - Verify Gradle Will Use JDK 17

When you generate the Android development build, Gradle will create a wrapper. You can verify it uses JDK 17 with:

```bash
# After building (when gradlew exists)
cd android
./gradlew -version
```

**Expected Output**:
```
------------------------------------------------------------
Gradle 8.x.x
------------------------------------------------------------

Build time:   ...
Revision:     ...

Kotlin:       ...
Groovy:       ...
JVM:          17.0.20.1 ...
OS:           Windows 11 ...
```

**Key Check**: `JVM: 17.0.20.1` should appear ✓

---

## Building Development Build

### First Time Build
```bash
npm run build:dev:android
```

This uses EAS (Expo cloud build service). The JAVA_HOME doesn't affect this (runs in cloud), but we need it for:

### Local Build (if you switch to local compilation)
```bash
# Only if using local build instead of EAS
cd android
./gradlew assembleDebug
```

For local builds, JAVA_HOME **must** be set and point to JDK 17.

---

## Troubleshooting

### Problem: `java -version` still shows Java 25

**Cause**: Terminal cached old environment

**Solution**:
1. Close ALL PowerShell/terminal windows completely
2. Wait 5 seconds
3. Open fresh terminal
4. Check again: `$env:JAVA_HOME`

### Problem: `java -version` now shows 17 but wants to verify Gradle

**For Now**: This is normal. Gradle wrapper only exists after first Android build.

**When ready to build**:
```bash
npm run build:dev:android    # Uses EAS cloud (no local Gradle needed)
```

**If switching to local build later**:
- Gradle wrapper will be generated
- Run `cd android && ./gradlew -version`
- Should show `JVM: 17.0.20.1`

### Problem: Gradle still uses Java 25 despite JAVA_HOME set

**Cause**: Gradle might have cached Java location

**Solution**:
```bash
# Clear Gradle cache
cd android
./gradlew --stop
rm -rf .gradle
```

Then retry build.

---

## Commands Summary

```powershell
# Set JAVA_HOME (already done)
[Environment]::SetEnvironmentVariable(
  "JAVA_HOME",
  "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot",
  "User"
)

# Verify after restarting terminal
$env:JAVA_HOME                    # Should show path to JDK 17
java -version                     # Should show 17.0.20.1

# When building (EAS - cloud build)
npm run build:dev:android         # Uses EAS, not affected by local JAVA_HOME

# After Android build exists, verify Gradle uses JDK 17
cd android
./gradlew -version               # Should show JVM: 17.0.20.1
```

---

## Current Project State

### ✅ What's Configured
- Expo SDK 56.0.21 with React Native 0.85.0
- New Architecture enabled (app.json + gradle.properties)
- Android SDK configuration: minSdk 26, compileSdk 34, targetSdk 34
- EAS Development Build configured (eas.json)
- Node.js 22.19.0 LTS
- TypeScript, ESLint, Jest all passing

### ⏳ Pending
- Terminal restart for JAVA_HOME to take effect
- First Android development build (to generate gradlew)
- Verification that Gradle uses JDK 17

### ✅ After These Steps
- Foundation will be fully validated
- Ready to start feature implementation

---

## Next Steps

1. **Restart terminal** (close all, reopen fresh)
2. **Verify JAVA_HOME**: `$env:JAVA_HOME`
3. **Verify Java**: `java -version` (should be 17.0.20.1)
4. **Ready to build**: `npm run build:dev:android`
5. **After build**: `cd android && ./gradlew -version` (should show JVM 17)

---

## Reference

- **JDK Location**: `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`
- **JAVA_HOME Variable**: Set to user environment
- **Gradle Version**: Will be determined by Expo SDK 56 (likely 8.x)
- **Expected Gradle JVM**: 17.0.20.1

---

**Note**: This file documents the exact verification steps. Follow them in order to confirm JDK 17 is properly configured.
