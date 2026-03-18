/** ワークフロー本体とテストで共有するロガー定義。 */
export type LogFn = (message: string) => void;

/** タイムスタンプ付きのログを標準出力へ書き出す。 */
export const defaultLog: LogFn = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

/** ログを出したくない経路で使う no-op ロガー。 */
export const noopLog: LogFn = () => {};
