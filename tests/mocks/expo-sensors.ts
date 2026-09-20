// Mock for expo-sensors in Jest environment
export const Gyroscope = {
  setUpdateInterval: jest.fn(),
  addListener: jest.fn((_callback) => ({
    remove: jest.fn(),
  })),
};

export const Accelerometer = {
  setUpdateInterval: jest.fn(),
  addListener: jest.fn((_callback) => ({
    remove: jest.fn(),
  })),
};
