import { instrumentSource } from '../src/instrumentation/instrumentImpl.ts'

const snippet = `console.log("inicio");

Promise.resolve().then(() => {
  console.log("micro: then 1");
});

setTimeout(() => {
  console.log("macro: timeout");
}, 0);

console.log("fin");
`

const { code, error } = instrumentSource(snippet)
if (error) {
  console.error('ERROR:', error)
} else {
  console.log(code)
}
