export type LogFn = (message: string) => void;

export const defaultLog: LogFn = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

export const noopLog: LogFn = () => {};
