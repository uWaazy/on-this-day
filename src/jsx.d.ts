declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }

  interface IntrinsicAttributes {
    key?: string | number;
  }
}