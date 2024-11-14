export async function catchPromise(promise: Promise<any>): Promise<[any, any]> {
  try {
    const response = await promise;
    return [await response.json(), null];
  } catch (error) {
    console.error(error);
    return [null, error];
  }
}

export function log(text: string) {
  console.log(`\x1b[35m🤖 ${text}\x1b[0m`);
}
