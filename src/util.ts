export async function catchPromise<T>(promise: Promise<any>): Promise<[T, any]> {
  try {
    const response = await promise;
    return [(await response.json()) as T, null];
  } catch (error) {
    console.error(error);
    return [null, error];
  }
}

export function log(text: string) {
  console.log(`\x1b[36m▶️ ${text}\x1b[0m`);
}

export function warn(text: string) {
  console.log(`\x1b[31m⚠️ ${text}\x1b[0m`);
}

export function time(text: string) {
  console.log(`\x1b[35m⏱️ ${text}\x1b[0m`);
}

export function info(text: string) {
  console.log(`\x1b[33mℹ️ ${text}\x1b[0m`);
}
