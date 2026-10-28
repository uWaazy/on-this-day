declare const Spicetify: any;

type EffectCallback = () =>
  | void
  | (() => void);

type DependencyList =
  readonly unknown[];

type SetStateAction<T> =
  | T
  | ((previous: T) => T);

type Dispatch<T> =
  (value: T) => void;

type SetState<T> =
  Dispatch<SetStateAction<T>>;

type UseState = <T>(
  initialState: T | (() => T)
) => [T, SetState<T>];

type UseEffect = (
  effect: EffectCallback,
  deps?: DependencyList
) => void;

type UseMemo = <T>(
  factory: () => T,
  deps: DependencyList
) => T;

export const React = Spicetify.React;

export function createPortal(children: any, container: Element): any {
  const reactDom = Spicetify.ReactDOM;
  return typeof reactDom?.createPortal === "function"
    ? reactDom.createPortal(children, container)
    : children;
}

export const useState =
  Spicetify.React.useState as UseState;

export const useEffect =
  Spicetify.React.useEffect as UseEffect;

type UseRef = <T>(
  initialValue: T
) => { current: T };

export const useMemo =
  Spicetify.React.useMemo as UseMemo;

export const useRef =
  Spicetify.React.useRef as UseRef;

type UseCallback = <T extends (...args: any[]) => any>(callback: T, deps: DependencyList) => T;

export const useCallback = Spicetify.React.useCallback as UseCallback;

/** React.memo: evita re-renderizar cartões/seções quando as props não mudaram. */
export function memo<P>(component: (props: P) => any): (props: P) => any {
  return (Spicetify.React.memo ? Spicetify.React.memo(component) : component) as (props: P) => any;
}
