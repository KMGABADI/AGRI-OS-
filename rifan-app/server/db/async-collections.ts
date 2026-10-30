export async function asyncMap<T, R>(
  rows: Iterable<T>,
  fn: (value: T, index: number) => R | Promise<R>,
): Promise<R[]> {
  const input = [...rows],
    output: R[] = new Array(input.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(10, input.length) }, async () => {
      while (next < input.length) {
        const index = next++;
        output[index] = await fn(input[index], index);
      }
    }),
  );
  return output;
}
export async function asyncFilter<T>(
  rows: Iterable<T>,
  fn: (value: T, index: number) => unknown,
) {
  const input = [...rows],
    keep = await asyncMap(input, fn);
  return input.filter((_, index) => keep[index]);
}
export async function asyncFind<T>(
  rows: Iterable<T>,
  fn: (value: T, index: number) => unknown,
) {
  let index = 0;
  for (const value of rows) {
    if (await fn(value, index++)) return value;
  }
  return undefined;
}
export async function asyncSome<T>(
  rows: Iterable<T>,
  fn: (value: T, index: number) => unknown,
) {
  return (await asyncFind(rows, fn)) !== undefined;
}
export async function asyncEach<T>(
  rows: Iterable<T>,
  fn: (value: T, index: number) => unknown,
) {
  let index = 0;
  for (const value of rows) await fn(value, index++);
}
export async function asyncReduce<T, R>(
  rows: Iterable<T>,
  fn: (previous: R, value: T, index: number) => R | Promise<R>,
  initial: R,
) {
  let index = 0,
    value = initial;
  for (const row of rows) value = await fn(value, row, index++);
  return value;
}
