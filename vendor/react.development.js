// Minimal React stub for offline dev
const React = {
  createElement: (...args) => ({ __element: args }),
  useState: (init) => {
    let val = typeof init === 'function' ? init() : init;
    const set = (v) => { val = typeof v === 'function' ? v(val) : v; };
    return [val, set];
  },
  useEffect: () => {},
  useRef: (init) => ({ current: init }),
  Component: class {}
};
