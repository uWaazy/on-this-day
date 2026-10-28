import { App } from "./app/App";

const react = Spicetify.React;

function render() {
  return react.createElement(App);
}

(globalThis as typeof globalThis & {
  render: () => unknown;
}).render = render;