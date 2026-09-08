# PixelMorph Environment Setup

## Required Environment

### Node.js
- **Version**: 22 LTS (22.19.0 or later)
- **Verification**: `node --version`

### Java Development Kit
- **Version**: JDK 17
- **Path**: Set via `JAVA_HOME` environment variable
- **Verification**: `java -version` and `javac -version`

### Android Development
- **Android SDK**: Installed and configured
- **Android Home**: Set via `ANDROID_HOME` environment variable
- **SDK Packages**:
  - Build Tools 34.0.0
  - Android API 34 (compileSdk)
  - Android API 26 (minSdk)

### React Native & Expo
- **Expo SDK**: 56
- **React Native**: 0.85.0
- **Architecture**: New Architecture (mandatory)
- **Development Workflow**: Expo Development Build

## Setup Verification

Run the following to verify your environment:

```bash
# Node.js
node --version
# Expected: v22.x.x

# Java
java -version
javac -version
# Expected: version "17.x.x"

# Android
adb --version
echo $ANDROID_HOME

# Expo
npx expo --version
```

## Building for Android

### Development Build
```bash
npm run build:dev:android
```

This command:
1. Uses EAS Build (Expo's cloud build service)
2. Generates a development APK with native module support
3. Enables Hot Reload and Fast Refresh during development

### Running on Device
```bash
npm start -- --android
```

This will:
1. Start the Expo Metro bundler
2. Connect to your Android device or emulator
3. Load the development build

## Development Workflow

1. **Start development server**:
   ```bash
   npm start
   ```

2. **Build development app** (first time or after native changes):
   ```bash
   npm run build:dev:android
   ```

3. **Run tests**:
   ```bash
   npm test
   ```

4. **Type checking**:
   ```bash
   npm run type-check
   ```

5. **Linting**:
   ```bash
   npm run lint
   ```

## Environment Configuration

### API Configuration
Create a `.env` file based on `.env.example`:

```bash
API_BASE_URL=http://localhost:3000
ENVIRONMENT=development
LOG_LEVEL=debug
```

Environment profiles:
- **Development**: `localhost:3000`
- **Staging**: `https://staging-api.pixelmorph.dev`
- **Production**: `https://api.pixelmorph.dev`

## Troubleshooting

### Java version issues
If you get Java version errors:
```bash
export JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot"
```

### Android SDK issues
Ensure `ANDROID_HOME` is set:
```bash
echo $ANDROID_HOME
# Should output: C:\Users\templ\AppData\Local\Android\Sdk
```

### Dependencies not installing
Clear cache and reinstall:
```bash
rm -rf node_modules
npm cache clean --force
npm install
```

## Documentation

- [Architecture](./docs/architecture.md)
- [Building & Deployment](./docs/environments.md)
- [Dependencies](./docs/dependencies.md)
