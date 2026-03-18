/** Logging utilities shared by the workflow and tests. */
export type LogFn = (message: string) => void;

/** Writes timestamped workflow logs to stdout. */
export const defaultLog: LogFn = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

/** Disables logging when a quiet execution path is preferred. */
export const noopLog: LogFn = () => {};
