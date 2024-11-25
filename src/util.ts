import * as fs from 'fs';
import * as path from 'path';

export async function catchPromise<T>(promise: Promise<any>): Promise<[T, any]> {
  try {
    const response = await promise;
    return [(await response.json()) as T, null];
  } catch (error) {
    console.error(error);
    return [null, error];
  }
}

const logFilePath = './action.log';

function writeLog(text: string) {
  fs.appendFileSync(logFilePath, `${text}\n`);
}

export function log(text: string) {
  writeLog(`▶️ ${text}`);
}

export function warn(text: string) {
  writeLog(`⚠️ ${text}`);
}

export function time(text: string) {
  writeLog(`⏱️ ${text}`);
}

export function info(text: string) {
  writeLog(`ℹ️ ${text}`);
}
