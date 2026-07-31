/**
 * Remove an element from an unordered array in O(1) by swapping it with the
 * last element and popping. Returns the element that was swapped into the
 * removed slot, or undefined if the index was out of bounds.
 */
export function swapRemove<T>(array: T[], index: number): T | undefined {
  if (index < 0 || index >= array.length) return undefined;
  const last = array[array.length - 1];
  array[index] = last;
  array.pop();
  return last;
}
