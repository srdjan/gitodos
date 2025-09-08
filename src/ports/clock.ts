export interface Clock {
  readonly now: () => Date;
  readonly timestamp: () => number;
}

