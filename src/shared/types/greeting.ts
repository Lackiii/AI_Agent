export type GreetingIntervalMode = '5m' | '10m' | '30m' | '1h' | 'random';

export type GreetingSettingsDTO = {
  enabled: boolean;
  intervalMode: GreetingIntervalMode;
};
