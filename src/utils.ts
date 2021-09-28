// TODO: Implement
export const camelize = (name: string) => {
  return name;
}

export const debounce = (fn: Function, time = 100) => {
  let call = true;
  return (...args: any[]) => {
    if (call) {
      call = false;
      setTimeout(() => {
        call = true;
      }, time);
      return fn(...args);
    }
  }
}
